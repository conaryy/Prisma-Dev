import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { PrismaService } from './database/prisma.service';
import type { CurrentUser } from './common/current-user';

type UploadSourceFile = {
  originalname: string;
  buffer: Buffer;
  mimetype?: string;
};

type UploadEvidenceParams = {
  file: UploadSourceFile;
  documentFileName: string;
  documentNumber: string | null;
  branch: string | null;
  sectionCode: string | null;
  sectionTitle: string | null;
  groupName: string | null;
  questionCode: string;
  targetFolderId?: string | null;
  targetSubfolderName?: string | null;
};

type UploadEvidenceResult = {
  fileId: string;
  folderId: string;
  webViewLink: string;
};

export type GoogleDriveStatus = {
  oauthReady: boolean;
  connected: boolean;
  uploadReady: boolean;
  redirectUri: string | null;
  rootFolderId: string | null;
  rootFolderName: string | null;
  scopes: string[];
  accountEmail: string | null;
  accountName: string | null;
  missingOauthConfig: string[];
};

export type GoogleDriveFolderReference = {
  id: string;
  name: string;
};

export type GoogleDriveItemReference = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  mimeType: string | null;
  webViewLink: string | null;
};

export type GoogleDriveFolderListing = {
  currentFolder: GoogleDriveFolderReference;
  children: GoogleDriveItemReference[];
};

@Injectable()
export class GoogleDriveService {
  private readonly defaultScope = 'https://www.googleapis.com/auth/drive';
  private readonly folderMimeType = 'application/vnd.google-apps.folder';
  private readonly defaultFrontendBaseUrl = 'http://localhost:5175';

  constructor(private readonly prisma: PrismaService) {}

  async getStatusForUser(user: CurrentUser): Promise<GoogleDriveStatus> {
    const oauthRequired = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
    const missingOauthConfig = oauthRequired.filter((key) => !this.readEnv(key));
    const connection = await this.prisma.k3GoogleDriveConnection.findUnique({
      where: {
        userSub: user.sub,
      },
    });
    const configuredRootFolderId = this.readEnv('GOOGLE_DRIVE_ROOT_FOLDER_ID');

    return {
      oauthReady: missingOauthConfig.length === 0,
      connected: Boolean(connection),
      uploadReady: missingOauthConfig.length === 0 && Boolean(connection),
      redirectUri: this.readEnv('GOOGLE_REDIRECT_URI'),
      rootFolderId: configuredRootFolderId ?? 'root',
      rootFolderName: configuredRootFolderId
        ? this.readEnv('GOOGLE_DRIVE_ROOT_FOLDER_NAME')
        : 'My Drive',
      scopes: this.readScopes(),
      accountEmail: connection?.googleEmail ?? null,
      accountName: connection?.googleDisplayName ?? null,
      missingOauthConfig,
    };
  }

  async createAuthorizationUrlForUser(user: CurrentUser, returnTo?: string | null) {
    this.assertOauthConfigured();

    await this.prisma.k3GoogleDriveAuthState.deleteMany({
      where: {
        OR: [
          { userSub: user.sub },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    const state = randomUUID();
    const redirectTarget = this.sanitizeReturnTo(returnTo);

    await this.prisma.k3GoogleDriveAuthState.create({
      data: {
        state,
        userSub: user.sub,
        userEmail: user.email ?? null,
        returnTo: redirectTarget,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const client = this.createOAuthClient();

    return client.generateAuthUrl({
      access_type: 'offline',
      include_granted_scopes: true,
      prompt: 'consent',
      login_hint: user.email ?? undefined,
      scope: this.readScopes(),
      state,
    });
  }

  async handleAuthorizationCallback(params: {
    state?: string;
    code?: string;
    error?: string;
  }) {
    const fallbackReturnTo = '/checklist-audit';
    const storedState = params.state?.trim()
      ? await this.prisma.k3GoogleDriveAuthState.findUnique({
          where: {
            state: params.state.trim(),
          },
        })
      : null;
    const returnTo = storedState?.returnTo || fallbackReturnTo;

    try {
      if (!storedState || storedState.expiresAt.getTime() <= Date.now()) {
        return this.buildFrontendRedirect(returnTo, 'error', 'Sesi koneksi Google Drive sudah kedaluwarsa.');
      }

      if (params.error) {
        return this.buildFrontendRedirect(
          returnTo,
          'error',
          `Otorisasi Google Drive dibatalkan: ${params.error}`
        );
      }

      if (!params.code?.trim()) {
        return this.buildFrontendRedirect(returnTo, 'error', 'Code OAuth Google Drive tidak ditemukan.');
      }

      const client = this.createOAuthClient();
      const existingConnection = await this.prisma.k3GoogleDriveConnection.findUnique({
        where: {
          userSub: storedState.userSub,
        },
      });
      const { tokens } = await client.getToken(params.code.trim());
      const refreshToken = tokens.refresh_token ?? existingConnection?.refreshToken ?? null;

      if (!refreshToken) {
        return this.buildFrontendRedirect(
          returnTo,
          'error',
          'Google tidak mengembalikan refresh token. Cabut akses aplikasi lalu hubungkan ulang.'
        );
      }

      client.setCredentials({
        access_token: tokens.access_token ?? undefined,
        refresh_token: refreshToken,
      });

      const drive = google.drive({
        version: 'v3',
        auth: client,
      });
      const about = await drive.about.get({
        fields: 'user(displayName,emailAddress,permissionId)',
      });
      const googleUser = about.data.user;

      await this.prisma.k3GoogleDriveConnection.upsert({
        where: {
          userSub: storedState.userSub,
        },
        update: {
          userEmail: storedState.userEmail ?? existingConnection?.userEmail ?? null,
          userName: existingConnection?.userName ?? null,
          googleSubject: googleUser?.permissionId ?? existingConnection?.googleSubject ?? null,
          googleEmail: googleUser?.emailAddress ?? existingConnection?.googleEmail ?? null,
          googleDisplayName: googleUser?.displayName ?? existingConnection?.googleDisplayName ?? null,
          refreshToken,
          scope: tokens.scope ?? existingConnection?.scope ?? this.readScopes().join(' '),
        },
        create: {
          userSub: storedState.userSub,
          userEmail: storedState.userEmail ?? null,
          userName: null,
          googleSubject: googleUser?.permissionId ?? null,
          googleEmail: googleUser?.emailAddress ?? null,
          googleDisplayName: googleUser?.displayName ?? null,
          refreshToken,
          scope: tokens.scope ?? this.readScopes().join(' '),
        },
      });

      return this.buildFrontendRedirect(returnTo, 'connected', 'Google Drive berhasil dihubungkan.');
    } catch (error) {
      return this.buildFrontendRedirect(
        returnTo,
        'error',
        this.toDriveErrorMessage(error, 'Gagal menyelesaikan koneksi Google Drive.')
      );
    } finally {
      if (storedState) {
        await this.prisma.k3GoogleDriveAuthState.delete({
          where: {
            state: storedState.state,
          },
        }).catch(() => undefined);
      }
    }
  }

  async disconnectUserConnection(userSub: string) {
    const connection = await this.prisma.k3GoogleDriveConnection.findUnique({
      where: {
        userSub,
      },
    });

    if (!connection) {
      return {
        disconnected: false,
      };
    }

    const client = this.createOAuthClient();

    try {
      await client.revokeToken(connection.refreshToken);
    } catch {
      // Ignore revoke failures and still remove the local connection.
    }

    await this.prisma.k3GoogleDriveConnection.delete({
      where: {
        userSub,
      },
    });

    return {
      disconnected: true,
    };
  }

  async listFoldersForUser(userSub: string, parentId?: string | null): Promise<GoogleDriveFolderListing> {
    try {
      const drive = await this.getDriveClientForUser(userSub);
      const currentFolder = parentId?.trim()
        ? await this.requireFolder(drive, parentId.trim())
        : await this.resolveRootFolder(drive);

      return {
        currentFolder,
        children: await this.listChildItems(drive, currentFolder.id),
      };
    } catch (error) {
      throw this.toDriveException(error, 'Gagal memuat daftar folder Google Drive.');
    }
  }

  async uploadEvidenceForUser(
    userSub: string,
    params: UploadEvidenceParams
  ): Promise<UploadEvidenceResult> {
    try {
      const drive = await this.getDriveClientForUser(userSub);
      const rootFolder = await this.resolveRootFolder(drive);
      const selectedParentFolder = params.targetFolderId?.trim()
        ? await this.requireFolder(drive, params.targetFolderId.trim())
        : null;
      const targetFolder =
        selectedParentFolder == null
          ? await this.resolveAutoTargetFolder(drive, rootFolder.id, params)
          : params.targetSubfolderName?.trim()
            ? await this.ensureFolder(drive, selectedParentFolder.id, params.targetSubfolderName)
            : selectedParentFolder;

      const response = await drive.files.create({
        requestBody: {
          name: this.sanitizeName(params.file.originalname),
          parents: [targetFolder.id],
        },
        media: {
          mimeType: params.file.mimetype || this.detectMimeType(params.file.originalname),
          body: Readable.from(params.file.buffer),
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });

      if (!response.data.id) {
        throw new InternalServerErrorException('Google Drive tidak mengembalikan file ID.');
      }

      return {
        fileId: response.data.id,
        folderId: targetFolder.id,
        webViewLink: response.data.webViewLink ?? `https://drive.google.com/file/d/${response.data.id}/view`,
      };
    } catch (error) {
      throw this.toDriveException(error, 'Gagal upload evidence ke Google Drive.');
    }
  }

  async deleteFileForUser(userSub: string | null | undefined, fileId: string | null | undefined) {
    if (!userSub || !fileId?.trim()) {
      return;
    }

    const connection = await this.prisma.k3GoogleDriveConnection.findUnique({
      where: {
        userSub,
      },
    });

    if (!connection) {
      return;
    }

    const drive = await this.getDriveClientForConnection(connection.refreshToken);

    try {
      await drive.files.delete({
        fileId: fileId.trim(),
        supportsAllDrives: true,
      });
    } catch (error) {
      if (this.isNotFoundError(error) || this.isInvalidGrantError(error)) {
        return;
      }

      throw this.toDriveException(error, 'Gagal menghapus file Google Drive.');
    }
  }

  private async getDriveClientForUser(userSub: string) {
    const connection = await this.prisma.k3GoogleDriveConnection.findUnique({
      where: {
        userSub,
      },
    });

    if (!connection) {
      throw new BadRequestException('Akun Google Drive belum terhubung untuk user ini.');
    }

    return this.getDriveClientForConnection(connection.refreshToken);
  }

  private getDriveClientForConnection(refreshToken: string) {
    this.assertOauthConfigured();

    const client = this.createOAuthClient();
    client.setCredentials({
      refresh_token: refreshToken,
    });

    return google.drive({
      version: 'v3',
      auth: client,
    });
  }

  private createOAuthClient() {
    return new google.auth.OAuth2(
      this.requireEnv('GOOGLE_CLIENT_ID'),
      this.requireEnv('GOOGLE_CLIENT_SECRET'),
      this.requireEnv('GOOGLE_REDIRECT_URI')
    );
  }

  private assertOauthConfigured() {
    const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
    const missing = required.filter((key) => !this.readEnv(key));

    if (missing.length > 0) {
      throw new InternalServerErrorException(
        `Konfigurasi Google Drive belum lengkap: ${missing.join(', ')}.`
      );
    }
  }

  private async resolveAutoTargetFolder(drive: drive_v3.Drive, rootFolderId: string, params: UploadEvidenceParams) {
    const documentFolder = await this.ensureFolder(
      drive,
      rootFolderId,
      this.buildDocumentFolderName(params.documentFileName, params.documentNumber, params.branch)
    );
    const sectionFolder = await this.ensureFolder(
      drive,
      documentFolder.id,
      this.buildSectionFolderName(params.sectionCode, params.sectionTitle)
    );

    return this.ensureFolder(
      drive,
      sectionFolder.id,
      this.buildTargetFolderName(params.groupName, params.questionCode)
    );
  }

  private async resolveRootFolder(drive: drive_v3.Drive) {
    const explicitRootFolderId = this.readEnv('GOOGLE_DRIVE_ROOT_FOLDER_ID');
    if (explicitRootFolderId) {
      return this.requireFolder(drive, explicitRootFolderId);
    }

    return {
      id: 'root',
      name: 'My Drive',
    };
  }

  private async requireFolder(drive: drive_v3.Drive, folderId: string) {
    if (folderId === 'root') {
      return {
        id: 'root',
        name: 'My Drive',
      };
    }

    const response = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });

    if (response.data.mimeType !== this.folderMimeType || !response.data.id) {
      throw new BadRequestException('Folder target Google Drive tidak valid.');
    }

    return {
      id: response.data.id,
      name: response.data.name?.trim() || 'Folder tanpa nama',
    };
  }

  private async ensureFolder(drive: drive_v3.Drive, parentId: string, name: string) {
    const normalizedName = this.sanitizeName(name);
    const escapedName = this.escapeDriveQueryValue(normalizedName);

    const existing = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = '${this.folderMimeType}' and name = '${escapedName}' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 1,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    const existingFolderId = existing.data.files?.[0]?.id;
    if (existingFolderId) {
      return {
        id: existingFolderId,
        name: existing.data.files?.[0]?.name?.trim() || normalizedName,
      };
    }

    const created = await drive.files.create({
      requestBody: {
        name: normalizedName,
        mimeType: this.folderMimeType,
        parents: [parentId],
      },
      fields: 'id, name',
      supportsAllDrives: true,
    });

    if (!created.data.id) {
      throw new InternalServerErrorException(`Gagal membuat folder Google Drive: ${normalizedName}.`);
    }

    return {
      id: created.data.id,
      name: created.data.name?.trim() || normalizedName,
    };
  }

  private async listChildItems(drive: drive_v3.Drive, parentId: string): Promise<GoogleDriveItemReference[]> {
    const response = await drive.files.list({
      q: `'${parentId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink)',
      pageSize: 100,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    return (response.data.files ?? [])
      .filter(
        (
          item
        ): item is { id: string; name?: string | null; mimeType?: string | null; webViewLink?: string | null } =>
          Boolean(item.id)
      )
      .map((item) => {
        const isFolder = item.mimeType === this.folderMimeType;

        return {
          id: item.id,
          name: item.name?.trim() || (isFolder ? 'Folder tanpa nama' : 'File tanpa nama'),
          type: isFolder ? ('folder' as const) : ('file' as const),
          mimeType: item.mimeType ?? null,
          webViewLink: isFolder
            ? null
            : item.webViewLink ?? `https://drive.google.com/file/d/${item.id}/view`,
        };
      })
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'folder' ? -1 : 1;
        }

        return left.name.localeCompare(right.name, 'id', {
          numeric: true,
          sensitivity: 'base',
        });
      });
  }

  private buildDocumentFolderName(fileName: string, documentNumber: string | null, branch: string | null) {
    const baseName = fileName.replace(extname(fileName), '').trim();
    const pieces = [documentNumber, branch, baseName].filter(Boolean);
    return pieces.length > 0 ? pieces.join(' - ') : baseName || 'Dokumen Audit';
  }

  private buildSectionFolderName(sectionCode: string | null, sectionTitle: string | null) {
    const title = sectionTitle?.trim();
    const code = sectionCode?.trim();

    if (code && title) {
      return `Bab ${code} - ${title}`;
    }

    if (code) {
      return `Bab ${code}`;
    }

    if (title) {
      return `Bab - ${title}`;
    }

    return 'Tanpa Bab';
  }

  private buildTargetFolderName(groupName: string | null, questionCode: string) {
    return groupName?.trim() ? groupName : `Butir ${questionCode}`;
  }

  private escapeDriveQueryValue(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private sanitizeName(value: string) {
    const normalized = value
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return normalized.slice(0, 180) || 'Untitled';
  }

  private detectMimeType(fileName: string) {
    const extension = extname(fileName).toLowerCase();

    if (extension === '.pdf') return 'application/pdf';
    if (extension === '.png') return 'image/png';
    if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
    if (extension === '.webp') return 'image/webp';
    if (extension === '.doc') return 'application/msword';
    if (extension === '.docx') {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    return 'application/octet-stream';
  }

  private sanitizeReturnTo(value?: string | null) {
    if (!value) {
      return '/checklist-audit';
    }

    if (value.startsWith('/')) {
      return value;
    }

    try {
      const url = new URL(value);
      const frontendBase = new URL(this.getFrontendBaseUrl());

      if (url.origin === frontendBase.origin) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      // Fallback handled below.
    }

    return '/checklist-audit';
  }

  private buildFrontendRedirect(returnTo: string, status: 'connected' | 'error', message: string) {
    const target = new URL(returnTo, this.getFrontendBaseUrl());
    target.searchParams.set('googleDrive', status);
    target.searchParams.set('googleDriveMessage', message);
    return target.toString();
  }

  private getFrontendBaseUrl() {
    return (this.readEnv('K3_FRONTEND_BASE_URL') ?? this.defaultFrontendBaseUrl).replace(/\/+$/, '');
  }

  private readEnv(key: string) {
    const value = process.env[key]?.trim();
    return value ? value : null;
  }

  private readScopes() {
    const configuredScopes = this.readEnv('GOOGLE_DRIVE_SCOPE');
    const rawScopes = configuredScopes
      ? configuredScopes.split(/[\s,]+/)
      : [this.defaultScope];

    return [...new Set([this.defaultScope, ...rawScopes.map((scope) => scope.trim()).filter(Boolean)])];
  }

  private requireEnv(key: string) {
    const value = this.readEnv(key);
    if (!value) {
      throw new InternalServerErrorException(`Konfigurasi ${key} belum diisi.`);
    }
    return value;
  }

  private isNotFoundError(error: unknown) {
    if (typeof error !== 'object' || error == null) {
      return false;
    }

    const status = 'status' in error ? error.status : undefined;
    const code = 'code' in error ? error.code : undefined;

    return status === 404 || code === 404;
  }

  private isInvalidGrantError(error: unknown) {
    if (typeof error !== 'object' || error == null) {
      return false;
    }

    if ('message' in error && typeof error.message === 'string' && error.message.includes('invalid_grant')) {
      return true;
    }

    if ('response' in error && typeof error.response === 'object' && error.response != null) {
      const response = error.response as { data?: { error?: string } };
      return response.data?.error === 'invalid_grant';
    }

    if ('cause' in error && typeof error.cause === 'object' && error.cause != null) {
      const cause = error.cause as { message?: string };
      return cause.message === 'invalid_grant';
    }

    return false;
  }

  private toDriveErrorMessage(error: unknown, fallbackMessage: string) {
    if (this.isInvalidGrantError(error)) {
      return 'Sesi Google Drive sudah tidak valid. Hubungkan ulang akun Google Anda.';
    }

    return error instanceof Error ? `${fallbackMessage} ${error.message}` : fallbackMessage;
  }

  private toDriveException(error: unknown, fallbackMessage: string) {
    return new BadRequestException(this.toDriveErrorMessage(error, fallbackMessage));
  }
}
