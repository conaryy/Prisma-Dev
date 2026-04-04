import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUserDecorator } from './auth/current-user.decorator';
import { SsoAuthGuard } from './auth/sso-auth.guard';
import { ChecklistAuditService } from './checklist-audit.service';
import type { CurrentUser } from './common/current-user';
import { GoogleDriveService } from './google-drive.service';

@Controller()
@UseGuards(SsoAuthGuard)
export class AppController {
  constructor(
    private readonly checklistAuditService: ChecklistAuditService,
    private readonly googleDriveService: GoogleDriveService
  ) {}

  @Get('api/me')
  getSession(@CurrentUserDecorator() user: CurrentUser | undefined) {
    return {
      data: user ?? null,
    };
  }

  @Get('api/google-drive/status')
  async getGoogleDriveStatus(@CurrentUserDecorator() user: CurrentUser | undefined) {
    if (!user) {
      throw new BadRequestException('User login tidak ditemukan.');
    }

    return {
      data: await this.googleDriveService.getStatusForUser(user),
    };
  }

  @Post('api/google-drive/connect-url')
  async createGoogleDriveConnectUrl(
    @CurrentUserDecorator() user: CurrentUser | undefined,
    @Body() body?: { returnTo?: string }
  ) {
    if (!user) {
      throw new BadRequestException('User login tidak ditemukan.');
    }

    return {
      data: {
        authorizationUrl: await this.googleDriveService.createAuthorizationUrlForUser(
          user,
          body?.returnTo
        ),
      },
    };
  }

  @Post('api/google-drive/disconnect')
  async disconnectGoogleDrive(@CurrentUserDecorator() user: CurrentUser | undefined) {
    if (!user) {
      throw new BadRequestException('User login tidak ditemukan.');
    }

    return {
      message: 'Koneksi Google Drive berhasil dilepas.',
      data: await this.googleDriveService.disconnectUserConnection(user.sub),
    };
  }

  @Get('api/google-drive/folders')
  async listGoogleDriveFolders(
    @CurrentUserDecorator() user: CurrentUser | undefined,
    @Query('parentId') parentId?: string
  ) {
    if (!user) {
      throw new BadRequestException('User login tidak ditemukan.');
    }

    return {
      data: await this.googleDriveService.listFoldersForUser(user.sub, parentId),
    };
  }

  @Get('api/checklist-audit/latest')
  async getLatestChecklistAudit() {
    return {
      data: await this.checklistAuditService.getLatestAnalysis(),
    };
  }

  @Get('api/checklist-audit/documents')
  async listChecklistDocuments() {
    return {
      data: await this.checklistAuditService.listDocuments(),
    };
  }

  @Get('api/checklist-audit/documents/:documentId')
  async getChecklistDocument(@Param('documentId') documentId: string) {
    return {
      data: await this.checklistAuditService.getDocumentAnalysis(documentId),
    };
  }

  @Delete('api/checklist-audit/documents/:documentId')
  async deleteChecklistDocument(@Param('documentId') documentId: string) {
    const deletedDocument = await this.checklistAuditService.deleteDocument(documentId);

    return {
      message: 'Dokumen audit berhasil dihapus.',
      data: {
        documentId: deletedDocument.id,
      },
    };
  }

  @Post('api/checklist-audit/analyze')
  @UseInterceptors(
    FileInterceptor('document', {
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024,
      },
    })
  )
  async analyzeChecklistAudit(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Pilih file Word terlebih dahulu.');
    }

    const analysis = await this.checklistAuditService.analyzeUploadedDocument(file);
    const document =
      analysis.documentId != null
        ? await this.checklistAuditService.getDocumentSummary(analysis.documentId)
        : null;

    return {
      message: 'Dokumen berhasil dianalisis.',
      data: analysis,
      document,
    };
  }

  @Post('api/checklist-audit/:questionCode/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    })
  )
  async uploadQuestionEvidence(
    @Param('questionCode') questionCode: string,
    @Query('documentId') documentId?: string,
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('Pilih file evidence terlebih dahulu.');
    }

    if (!documentId) {
      throw new BadRequestException('Pilih dokumen audit terlebih dahulu.');
    }

    const analysis = await this.checklistAuditService.uploadQuestionEvidence({
      documentId,
      questionCode,
      file,
    });

    return {
      message: 'File evidence berhasil ditambahkan.',
      data: analysis,
    };
  }

  @Post('api/checklist-audit/:questionCode/files/sync-drive')
  async syncQuestionEvidenceToDrive(
    @CurrentUserDecorator() user: CurrentUser | undefined,
    @Param('questionCode') questionCode: string,
    @Query('documentId') documentId?: string,
    @Body() body?: { targetFolderId?: string; targetSubfolderName?: string }
  ) {
    if (!documentId) {
      throw new BadRequestException('Pilih dokumen audit terlebih dahulu.');
    }

    if (!user) {
      throw new BadRequestException('User login tidak ditemukan.');
    }

    const result = await this.checklistAuditService.syncQuestionEvidenceToDrive({
      documentId,
      questionCode,
      targetFolderId: body?.targetFolderId?.trim() || undefined,
      targetSubfolderName: body?.targetSubfolderName?.trim() || undefined,
      user,
    });

    return {
      message:
        result.syncedCount > 0
          ? `${result.syncedCount} file evidence berhasil dikirim ke Google Drive${body?.targetSubfolderName?.trim() ? ` ke folder ${body.targetSubfolderName.trim()}` : ''}.`
          : 'Semua file evidence pada butir ini sudah tersinkron ke Google Drive.',
      data: result.analysis,
    };
  }

  @Delete('api/checklist-audit/:questionCode/files/:fileId')
  async deleteQuestionEvidence(
    @Param('questionCode') questionCode: string,
    @Param('fileId') fileId: string,
    @Query('documentId') documentId?: string
  ) {
    if (!documentId) {
      throw new BadRequestException('Pilih dokumen audit terlebih dahulu.');
    }

    const analysis = await this.checklistAuditService.deleteQuestionEvidence(
      documentId,
      questionCode,
      fileId
    );

    return {
      message: 'File evidence berhasil dihapus.',
      data: analysis,
    };
  }

  @Post('api/checklist-audit/groups')
  async createQuestionGroup(@Body() body: { documentId?: string; questionCodes?: string[] }) {
    if (!body.documentId) {
      throw new BadRequestException('Pilih dokumen audit terlebih dahulu.');
    }

    const analysis = await this.checklistAuditService.createQuestionGroup(
      body.documentId,
      body.questionCodes ?? []
    );

    return {
      message: 'Kelompok evidence berhasil dibuat.',
      data: analysis,
    };
  }

  @Patch('api/checklist-audit/groups/:groupId')
  async updateQuestionGroup(
    @Param('groupId') groupId: string,
    @Body() body: { documentId?: string; questionCodes?: string[] }
  ) {
    if (!body.documentId) {
      throw new BadRequestException('Pilih dokumen audit terlebih dahulu.');
    }

    const analysis = await this.checklistAuditService.updateQuestionGroup(
      body.documentId,
      groupId,
      body.questionCodes ?? []
    );

    return {
      message: 'Kelompok evidence berhasil diperbarui.',
      data: analysis,
    };
  }

  @Delete('api/checklist-audit/groups/:groupId')
  async deleteQuestionGroup(@Param('groupId') groupId: string, @Query('documentId') documentId?: string) {
    if (!documentId) {
      throw new BadRequestException('Pilih dokumen audit terlebih dahulu.');
    }

    const analysis = await this.checklistAuditService.deleteQuestionGroup(documentId, groupId);

    return {
      message: 'Kelompok evidence berhasil dihapus.',
      data: analysis,
    };
  }
}
