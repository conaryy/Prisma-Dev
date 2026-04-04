import { BadRequestException, Injectable } from '@nestjs/common';
import type { K3AuditDocument, Prisma } from '@prisma/client';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { promisify } from 'node:util';
import * as mammoth from 'mammoth';
import { PrismaService } from './database/prisma.service';
import { GoogleDriveService } from './google-drive.service';
import type { CurrentUser } from './common/current-user';

const execFileAsync = promisify(execFile);
const CRITERION_CODE_REGEX = /^\d{1,2}\.\d{1,2}\.\d{1,2}$/;
const CATEGORY_CODE_REGEX = /^\d{1,2}\.\d{1,2}$/;
const SECTION_CODE_REGEX = /^\d{1,2}$/;

type AuditStatus = 'V' | 'M' | 'm' | 'X' | 'unknown';
type ParsedAuditStatus = Exclude<AuditStatus, 'unknown'>;

export type UploadedQuestionFile = {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
  storageName: string;
  storageProvider: 'local' | 'google-drive';
  driveSyncStatus?: 'pending' | 'synced';
  driveFileId?: string | null;
  driveFolderId?: string | null;
  driveUrl?: string | null;
  driveOwnerSub?: string | null;
  driveOwnerEmail?: string | null;
};

export type ChecklistItem = {
  code: string;
  sectionCode: string | null;
  sectionTitle: string | null;
  categoryCode: string | null;
  categoryTitle: string | null;
  description: string;
  evidence: string[];
  status: AuditStatus;
  uploadedFiles: UploadedQuestionFile[];
  groupId: string | null;
};

export type QuestionGroup = {
  id: string;
  name: string;
  questionCodes: string[];
  uploadedFiles: UploadedQuestionFile[];
};

type SectionSummary = {
  sectionCode: string;
  sectionTitle: string;
  total: number;
  sesuai: number;
  major: number;
  minor: number;
  tidakBerlaku: number;
  percentage: number;
};

export type AuditAnalysis = {
  documentId?: string;
  fileName: string;
  analyzedAt: string;
  metadata: {
    branch: string | null;
    documentNumber: string | null;
    auditDate: string | null;
    expectedCriteria: number | null;
  };
  totals: {
    totalCriteria: number;
    expectedCriteria: number;
    detectedCriteria: number;
    sesuai: number;
    major: number;
    minor: number;
    tidakBerlaku: number;
    unknown: number;
    applicableCriteria: number;
    compliancePercentage: number;
    completionPercentage: number;
  };
  sectionSummary: SectionSummary[];
  items: ChecklistItem[];
  groups: QuestionGroup[];
};

export type ChecklistDocumentSummary = {
  id: string;
  fileName: string;
  documentUrl: string;
  analyzedAt: string;
  branch: string | null;
  documentNumber: string | null;
  auditDate: string | null;
  expectedCriteria: number | null;
  detectedCriteria: number;
  compliancePercentage: number;
  completionPercentage: number;
  groupCount: number;
};

@Injectable()
export class ChecklistAuditService {
  private readonly uploadsRoot = join(__dirname, '..', 'uploads');
  private readonly evidenceUploadsRoot = join(this.uploadsRoot, 'checklist-evidence');
  private readonly documentUploadsRoot = join(this.uploadsRoot, 'documents');

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleDriveService: GoogleDriveService
  ) {}

  async listDocuments() {
    const documents = await this.prisma.k3AuditDocument.findMany({
      orderBy: {
        analyzedAt: 'desc',
      },
    });

    return documents.map((document) => this.toDocumentSummary(document));
  }

  async getDocumentSummary(documentId: string) {
    const document = await this.prisma.k3AuditDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return null;
    }

    return this.toDocumentSummary(document);
  }

  async getLatestAnalysis() {
    const document = await this.prisma.k3AuditDocument.findFirst({
      orderBy: {
        analyzedAt: 'desc',
      },
    });

    return document ? this.parseStoredAnalysis(document) : null;
  }

  async getDocumentAnalysis(documentId: string) {
    const document = await this.prisma.k3AuditDocument.findUnique({
      where: { id: documentId },
    });

    return document ? this.parseStoredAnalysis(document) : null;
  }

  async deleteDocument(documentId: string) {
    const { document, analysis } = await this.requireStoredAnalysis(documentId);
    const evidenceFiles = this.collectEvidenceFiles(analysis);

    await this.prisma.k3AuditDocument.delete({
      where: { id: document.id },
    });

    await Promise.allSettled([
      fs.rm(join(this.documentUploadsRoot, document.storageName), { force: true }),
      ...evidenceFiles.map((file) => this.deleteStoredEvidenceFile(file)),
    ]);

    return {
      id: document.id,
    };
  }

  async analyzeUploadedDocument(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File Word wajib diunggah.');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (!['.doc', '.docx'].includes(extension)) {
      throw new BadRequestException('Format file harus .doc atau .docx.');
    }

    const rawText =
      extension === '.doc'
        ? await this.extractLegacyDocText(file.buffer)
        : await this.extractDocxText(file.buffer);

    const normalizedText = rawText.replace(/\r\n/g, '\n');
    const baseAnalysis = this.buildAnalysis(normalizedText, file.originalname);
    const documentId = randomUUID();
    const analysis = this.attachDocumentId(baseAnalysis, documentId);

    await fs.mkdir(this.documentUploadsRoot, { recursive: true });

    const safeOriginalName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]+/g, '-');
    const storageName = `${Date.now()}-${randomUUID()}-${safeOriginalName}`;
    const filePath = join(this.documentUploadsRoot, storageName);
    await fs.writeFile(filePath, file.buffer);

    try {
      await this.prisma.k3AuditDocument.create({
        data: this.buildDocumentPersistencePayload({
          id: documentId,
          fileName: file.originalname,
          storageName,
          analysis,
        }),
      });
    } catch (error) {
      await fs.rm(filePath, { force: true });
      throw error;
    }

    return analysis;
  }

  async uploadQuestionEvidence(params: {
    documentId: string;
    questionCode: string;
    file: Express.Multer.File;
  }) {
    if (!params.file) {
      throw new BadRequestException('Pilih file evidence terlebih dahulu.');
    }

    const { document, analysis } = await this.requireStoredAnalysis(params.documentId);
    const item = analysis.items.find((entry) => entry.code === params.questionCode);

    if (!item) {
      throw new BadRequestException('Pertanyaan tidak ditemukan pada dokumen audit terpilih.');
    }

    const targetFiles = this.resolveEvidenceCollection(analysis, item);
    const uploadedFile = await this.storeEvidenceFile(params.file);
    targetFiles.unshift(uploadedFile);

    try {
      return await this.updateStoredAnalysis(document, analysis);
    } catch (error) {
      if (item.groupId) {
        const group = analysis.groups.find((entry) => entry.id === item.groupId);
        if (group) {
          group.uploadedFiles = group.uploadedFiles.filter((entry) => entry.id !== uploadedFile.id);
        }
      } else {
        item.uploadedFiles = item.uploadedFiles.filter((entry) => entry.id !== uploadedFile.id);
      }

      await this.deleteStoredEvidenceFile(uploadedFile);
      throw error;
    }
  }

  async syncQuestionEvidenceToDrive(params: {
    documentId: string;
    questionCode: string;
    targetFolderId?: string;
    targetSubfolderName?: string;
    user: CurrentUser;
  }) {
    const googleDriveStatus = await this.googleDriveService.getStatusForUser(params.user);
    if (!googleDriveStatus.uploadReady) {
      throw new BadRequestException('Akun Google Drive belum terhubung untuk user ini.');
    }

    const { document, analysis } = await this.requireStoredAnalysis(params.documentId);
    const item = analysis.items.find((entry) => entry.code === params.questionCode);

    if (!item) {
      throw new BadRequestException('Pertanyaan tidak ditemukan pada dokumen audit terpilih.');
    }

    const targetFiles = this.resolveEvidenceCollection(analysis, item);
    const pendingFiles = targetFiles.filter((file) => this.isDriveSyncPending(file));
    if (pendingFiles.length === 0) {
      return {
        analysis,
        syncedCount: 0,
      };
    }

    const group = item.groupId ? analysis.groups.find((entry) => entry.id === item.groupId) ?? null : null;
    const snapshots = pendingFiles.map((file) => ({
      file,
      snapshot: { ...file },
    }));
    const uploadedDriveFileIds: string[] = [];

    try {
      for (const pendingFile of pendingFiles) {
        const driveFile = await this.googleDriveService.uploadEvidenceForUser(params.user.sub, {
          file: await this.readStoredEvidenceFile(pendingFile),
          documentFileName: document.fileName,
          documentNumber: analysis.metadata.documentNumber,
          branch: analysis.metadata.branch,
          sectionCode: item.sectionCode,
          sectionTitle: item.sectionTitle,
          groupName: group?.name ?? null,
          questionCode: item.code,
          targetFolderId: params.targetFolderId,
          targetSubfolderName: params.targetSubfolderName,
        });

        pendingFile.driveSyncStatus = 'synced';
        pendingFile.driveFileId = driveFile.fileId;
        pendingFile.driveFolderId = driveFile.folderId;
        pendingFile.driveUrl = driveFile.webViewLink;
        pendingFile.driveOwnerSub = params.user.sub;
        pendingFile.driveOwnerEmail = params.user.email ?? null;
        uploadedDriveFileIds.push(driveFile.fileId);
      }

      return {
        analysis: await this.updateStoredAnalysis(document, analysis),
        syncedCount: pendingFiles.length,
      };
    } catch (error) {
      snapshots.forEach(({ file, snapshot }) => {
        Object.assign(file, snapshot);
      });

      await Promise.allSettled(
        uploadedDriveFileIds.map((fileId) =>
          this.googleDriveService.deleteFileForUser(params.user.sub, fileId)
        )
      );

      throw error;
    }
  }

  async deleteQuestionEvidence(documentId: string, questionCode: string, fileId: string) {
    const { document, analysis } = await this.requireStoredAnalysis(documentId);
    const item = analysis.items.find((entry) => entry.code === questionCode);

    if (!item) {
      throw new BadRequestException('Pertanyaan tidak ditemukan pada dokumen audit terpilih.');
    }

    const targetFiles = this.resolveEvidenceCollection(analysis, item);
    const targetFile = targetFiles.find((entry) => entry.id === fileId);
    if (!targetFile) {
      throw new BadRequestException('File evidence tidak ditemukan.');
    }

    if (item.groupId) {
      const group = analysis.groups.find((entry) => entry.id === item.groupId);
      if (!group) {
        throw new BadRequestException('Kelompok evidence tidak ditemukan.');
      }
      group.uploadedFiles = group.uploadedFiles.filter((entry) => entry.id !== fileId);
    } else {
      item.uploadedFiles = item.uploadedFiles.filter((entry) => entry.id !== fileId);
    }

    const nextAnalysis = await this.updateStoredAnalysis(document, analysis);
    await this.cleanupStoredFileIfUnused(nextAnalysis, targetFile);

    return nextAnalysis;
  }

  async createQuestionGroup(documentId: string, questionCodes: string[]) {
    const { document, analysis } = await this.requireStoredAnalysis(documentId);
    const seedCodes = Array.from(new Set(questionCodes)).filter(Boolean);
    const expandedCodes = new Set(seedCodes);

    analysis.groups.forEach((group) => {
      if (group.questionCodes.some((code) => expandedCodes.has(code))) {
        group.questionCodes.forEach((code) => expandedCodes.add(code));
      }
    });

    const uniqueCodes = Array.from(expandedCodes);

    if (uniqueCodes.length < 2) {
      throw new BadRequestException('Pilih minimal 2 butir untuk digabungkan.');
    }

    const items = uniqueCodes.map((code) => {
      const item = analysis.items.find((entry) => entry.code === code);
      if (!item) {
        throw new BadRequestException(`Butir ${code} tidak ditemukan pada dokumen audit terpilih.`);
      }
      return item;
    });

    const existingGroupIds = Array.from(
      new Set(items.map((item) => item.groupId).filter((value): value is string => Boolean(value)))
    );
    const inheritedGroupFiles = analysis.groups
      .filter((group) => existingGroupIds.includes(group.id))
      .flatMap((group) => group.uploadedFiles);
    const individualFiles = items.flatMap((item) => item.uploadedFiles);

    analysis.groups = analysis.groups.filter((group) => !existingGroupIds.includes(group.id));

    analysis.items.forEach((item) => {
      if (existingGroupIds.includes(item.groupId ?? '')) {
        item.groupId = null;
      }
    });

    items.forEach((item) => {
      item.uploadedFiles = [];
    });

    const group: QuestionGroup = {
      id: randomUUID(),
      name: this.buildGroupName(uniqueCodes),
      questionCodes: uniqueCodes,
      uploadedFiles: this.mergeUploadedFiles(inheritedGroupFiles, individualFiles),
    };

    items.forEach((item) => {
      item.groupId = group.id;
    });

    analysis.groups.unshift(group);
    return this.updateStoredAnalysis(document, analysis);
  }

  async updateQuestionGroup(documentId: string, groupId: string, questionCodes: string[]) {
    const { document, analysis } = await this.requireStoredAnalysis(documentId);
    const group = analysis.groups.find((entry) => entry.id === groupId);

    if (!group) {
      throw new BadRequestException('Kelompok evidence tidak ditemukan.');
    }

    const uniqueCodes = Array.from(new Set(questionCodes)).filter(Boolean);
    if (uniqueCodes.length < 2) {
      throw new BadRequestException('Kelompok harus memiliki minimal 2 butir.');
    }

    const currentCodes = new Set(group.questionCodes);
    const nextItems = uniqueCodes.map((code) => {
      const item = analysis.items.find((entry) => entry.code === code);
      if (!item) {
        throw new BadRequestException(`Butir ${code} tidak ditemukan pada dokumen audit terpilih.`);
      }
      if (item.groupId && item.groupId !== groupId) {
        throw new BadRequestException(
          `Butir ${code} masih tergabung di kelompok lain. Lepaskan dulu dari kelompok tersebut.`
        );
      }
      return item;
    });

    const currentItems = analysis.items.filter((item) => currentCodes.has(item.code));
    const removedItems = currentItems.filter((item) => !uniqueCodes.includes(item.code));
    const addedItems = nextItems.filter((item) => !currentCodes.has(item.code));
    const transferredFiles = addedItems.flatMap((item) => item.uploadedFiles);

    removedItems.forEach((item) => {
      item.groupId = null;
      item.uploadedFiles = [...this.cloneUploadedFiles(group.uploadedFiles), ...item.uploadedFiles];
    });

    addedItems.forEach((item) => {
      item.groupId = groupId;
      item.uploadedFiles = [];
    });

    nextItems.forEach((item) => {
      item.groupId = groupId;
    });

    group.questionCodes = uniqueCodes;
    group.name = this.buildGroupName(uniqueCodes);
    group.uploadedFiles = this.mergeUploadedFiles(group.uploadedFiles, transferredFiles);

    return this.updateStoredAnalysis(document, analysis);
  }

  async deleteQuestionGroup(documentId: string, groupId: string) {
    const { document, analysis } = await this.requireStoredAnalysis(documentId);
    const groupIndex = analysis.groups.findIndex((entry) => entry.id === groupId);

    if (groupIndex < 0) {
      throw new BadRequestException('Kelompok evidence tidak ditemukan.');
    }

    const group = analysis.groups[groupIndex];
    const items = analysis.items.filter((item) => item.groupId === groupId);

    items.forEach((item) => {
      item.groupId = null;
      item.uploadedFiles = [...this.cloneUploadedFiles(group.uploadedFiles), ...item.uploadedFiles];
    });

    analysis.groups.splice(groupIndex, 1);
    return this.updateStoredAnalysis(document, analysis);
  }

  private async extractDocxText(buffer: Buffer) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  private async extractLegacyDocText(buffer: Buffer) {
    const tempFile = join(tmpdir(), `k3-audit-${randomUUID()}.doc`);

    try {
      await fs.writeFile(tempFile, buffer);
      const { stdout } = await execFileAsync('strings', ['-n', '1', tempFile], {
        maxBuffer: 20 * 1024 * 1024,
      });
      return stdout;
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? `Gagal membaca file .doc: ${error.message}`
          : 'Gagal membaca file .doc.'
      );
    } finally {
      await fs.rm(tempFile, { force: true });
    }
  }

  private buildAnalysis(rawText: string, fileName: string): AuditAnalysis {
    const allLines = rawText
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const tableStart = allLines.findIndex(
      (line) => line === 'NO.' || CRITERION_CODE_REGEX.test(line)
    );
    const tableEnd = allLines.findIndex(
      (line, index) =>
        index > tableStart &&
        (line.startsWith('Penilaian Penerapan SMK3') || line.startsWith('Major :'))
    );

    const relevantLines = allLines.slice(
      tableStart >= 0 ? tableStart : 0,
      tableEnd >= 0 ? tableEnd : allLines.length
    );

    const items = this.parseChecklistItems(relevantLines);

    if (items.length === 0) {
      throw new BadRequestException(
        'Struktur checklist tidak terbaca. Pastikan template Word mengikuti format audit SMK3.'
      );
    }

    const documentNumber = this.captureFirst(rawText, /No\.Dok\s*:?\s*([^\n]+)/i);
    const auditDate = this.captureFirst(rawText, /Tanggal\s*:?\s*([^\n]+)/i);
    const branchMatch = rawText.match(/Cabang\s+[A-Za-z][^\n]*/i);
    const expectedCriteria =
      Number(this.captureFirst(rawText, /Tingkat\s+Lanjutan\s+\((\d+)\s+kriteria\)/i)) ||
      items.length;

    const totals = this.calculateTotals(items, expectedCriteria);

    return {
      fileName,
      analyzedAt: new Date().toISOString(),
      metadata: {
        branch: branchMatch?.[0] ?? null,
        documentNumber: documentNumber ?? null,
        auditDate: auditDate ?? null,
        expectedCriteria,
      },
      totals,
      sectionSummary: this.summarizeBySection(items),
      items,
      groups: [],
    };
  }

  private parseChecklistItems(lines: string[]) {
    const items: ChecklistItem[] = [];
    let sectionCode: string | null = null;
    let sectionTitle: string | null = null;
    let categoryCode: string | null = null;
    let categoryTitle: string | null = null;

    for (let index = 0; index < lines.length; ) {
      const current = lines[index];
      const next = lines[index + 1] ?? null;

      if (SECTION_CODE_REGEX.test(current) && next && !this.looksLikeCode(next)) {
        sectionCode = current;
        sectionTitle = next;
        index += 2;
        continue;
      }

      if (CATEGORY_CODE_REGEX.test(current) && next && !this.looksLikeCode(next)) {
        categoryCode = current;
        categoryTitle = next;
        index += 2;
        continue;
      }

      if (CRITERION_CODE_REGEX.test(current)) {
        const code = current;
        const description = lines[index + 1] ?? '';
        const evidence: string[] = [];
        let status: AuditStatus = 'unknown';

        index += 2;

        while (index < lines.length) {
          const value = lines[index];
          const parsedStatus = this.parseStatusValue(value);

          if (parsedStatus) {
            status = parsedStatus;
            index += 1;
            break;
          }

          if (
            CRITERION_CODE_REGEX.test(value) ||
            CATEGORY_CODE_REGEX.test(value) ||
            SECTION_CODE_REGEX.test(value)
          ) {
            break;
          }

          evidence.push(value);
          index += 1;
        }

        items.push({
          code,
          sectionCode,
          sectionTitle,
          categoryCode,
          categoryTitle,
          description,
          evidence,
          status,
          uploadedFiles: [],
          groupId: null,
        });
        continue;
      }

      index += 1;
    }

    return items;
  }

  private calculateTotals(items: ChecklistItem[], expectedCriteria: number) {
    const detectedCriteria = items.length;
    const sesuai = items.filter((item) => item.status === 'V').length;
    const major = items.filter((item) => item.status === 'M').length;
    const minor = items.filter((item) => item.status === 'm').length;
    const tidakBerlaku = items.filter((item) => item.status === 'X').length;
    const unknown = items.filter((item) => item.status === 'unknown').length;
    const applicableCriteria = Math.max(detectedCriteria - tidakBerlaku, 0);
    const compliancePercentage =
      applicableCriteria > 0 ? Number(((sesuai / applicableCriteria) * 100).toFixed(2)) : 0;
    const completionPercentage =
      expectedCriteria > 0 ? Number(((detectedCriteria / expectedCriteria) * 100).toFixed(2)) : 0;

    return {
      totalCriteria: expectedCriteria,
      expectedCriteria,
      detectedCriteria,
      sesuai,
      major,
      minor,
      tidakBerlaku,
      unknown,
      applicableCriteria,
      compliancePercentage,
      completionPercentage,
    };
  }

  private summarizeBySection(items: ChecklistItem[]) {
    const sectionMap = new Map<string, SectionSummary>();

    items.forEach((item) => {
      const sectionKey = item.sectionCode ?? 'tanpa-bab';
      const existing = sectionMap.get(sectionKey) ?? {
        sectionCode: item.sectionCode ?? '-',
        sectionTitle: item.sectionTitle ?? 'Tanpa Bab',
        total: 0,
        sesuai: 0,
        major: 0,
        minor: 0,
        tidakBerlaku: 0,
        percentage: 0,
      };

      existing.total += 1;
      if (item.status === 'V') existing.sesuai += 1;
      if (item.status === 'M') existing.major += 1;
      if (item.status === 'm') existing.minor += 1;
      if (item.status === 'X') existing.tidakBerlaku += 1;

      const applicable = existing.total - existing.tidakBerlaku;
      existing.percentage = applicable > 0 ? Number(((existing.sesuai / applicable) * 100).toFixed(2)) : 0;

      sectionMap.set(sectionKey, existing);
    });

    return Array.from(sectionMap.values()).sort((left, right) => {
      const leftCode = Number(left.sectionCode.replace(/\D/g, '')) || 0;
      const rightCode = Number(right.sectionCode.replace(/\D/g, '')) || 0;
      return leftCode - rightCode;
    });
  }

  private captureFirst(source: string, pattern: RegExp) {
    return source.match(pattern)?.[1]?.trim() ?? null;
  }

  private buildGroupName(questionCodes: string[]) {
    const prefix = this.findCommonPrefix(questionCodes);
    return prefix ? `Kelompok ${prefix}` : `Kelompok ${questionCodes.length} butir`;
  }

  private findCommonPrefix(questionCodes: string[]) {
    if (questionCodes.length === 0) {
      return '';
    }

    const splitCodes = questionCodes.map((code) => code.split('.'));
    const minLength = Math.min(...splitCodes.map((parts) => parts.length));
    const sharedParts: string[] = [];

    for (let index = 0; index < minLength - 1; index += 1) {
      const candidate = splitCodes[0][index];
      if (splitCodes.every((parts) => parts[index] === candidate)) {
        sharedParts.push(candidate);
      } else {
        break;
      }
    }

    return sharedParts.join('.');
  }

  private resolveEvidenceCollection(analysis: AuditAnalysis, item: ChecklistItem) {
    if (!item.groupId) {
      return item.uploadedFiles;
    }

    const group = analysis.groups.find((entry) => entry.id === item.groupId);
    if (!group) {
      throw new BadRequestException('Kelompok evidence tidak ditemukan.');
    }

    return group.uploadedFiles;
  }

  private async storeEvidenceFile(file: Express.Multer.File) {
    return this.storeEvidenceFileLocally(file);
  }

  private async storeEvidenceFileLocally(file: Express.Multer.File): Promise<UploadedQuestionFile> {
    await fs.mkdir(this.evidenceUploadsRoot, { recursive: true });

    const safeOriginalName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]+/g, '-');
    const storageName = `${Date.now()}-${randomUUID()}-${safeOriginalName}`;
    const filePath = join(this.evidenceUploadsRoot, storageName);
    await fs.writeFile(filePath, file.buffer);

    return {
      id: randomUUID(),
      name: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      url: `/uploads/checklist-evidence/${storageName}`,
      storageName,
      storageProvider: 'local',
      driveSyncStatus: 'pending',
      driveFileId: null,
      driveFolderId: null,
      driveUrl: null,
      driveOwnerSub: null,
      driveOwnerEmail: null,
    };
  }

  private cloneUploadedFiles(files: UploadedQuestionFile[]) {
    return files.map((file) => ({
      ...file,
      id: randomUUID(),
    }));
  }

  private mergeUploadedFiles(...collections: UploadedQuestionFile[][]) {
    const seen = new Set<string>();

    return collections.flatMap((files) =>
      files.filter((file) => {
        const storageKey = this.buildUploadedFileStorageKey(file);
        if (seen.has(storageKey)) {
          return false;
        }

        seen.add(storageKey);
        return true;
      })
    );
  }

  private async cleanupStoredFileIfUnused(analysis: AuditAnalysis, targetFile: UploadedQuestionFile) {
    const targetStorageKey = this.buildUploadedFileStorageKey(targetFile);
    const stillReferenced = this.collectEvidenceFiles(analysis).some(
      (file) => this.buildUploadedFileStorageKey(file) === targetStorageKey
    );

    if (stillReferenced) {
      return;
    }

    await this.deleteStoredEvidenceFile(targetFile);
  }

  private collectEvidenceFiles(analysis: AuditAnalysis) {
    const seen = new Set<string>();

    return [...analysis.items.flatMap((item) => item.uploadedFiles), ...analysis.groups.flatMap((group) => group.uploadedFiles)].filter(
      (file) => {
        const storageKey = this.buildUploadedFileStorageKey(file);
        if (seen.has(storageKey)) {
          return false;
        }

        seen.add(storageKey);
        return true;
      }
    );
  }

  private buildUploadedFileStorageKey(file: UploadedQuestionFile) {
    return `${file.storageProvider}:${file.storageName}`;
  }

  private async deleteStoredEvidenceFile(file: UploadedQuestionFile) {
    const driveFileId = file.storageProvider === 'google-drive' ? file.storageName : file.driveFileId;
    if (driveFileId) {
      await this.googleDriveService
        .deleteFileForUser(file.driveOwnerSub, driveFileId)
        .catch(() => undefined);
    }

    if (file.storageProvider === 'google-drive') {
      return;
    }

    await fs.rm(join(this.evidenceUploadsRoot, file.storageName), { force: true });
  }

  private isDriveSyncPending(file: UploadedQuestionFile) {
    return file.storageProvider !== 'google-drive' && file.driveSyncStatus !== 'synced';
  }

  private async readStoredEvidenceFile(file: UploadedQuestionFile) {
    if (file.storageProvider === 'google-drive') {
      throw new BadRequestException('File evidence ini sudah tersimpan penuh di Google Drive.');
    }

    const buffer = await fs.readFile(join(this.evidenceUploadsRoot, file.storageName));
    return {
      originalname: file.name,
      buffer,
    };
  }

  private looksLikeCode(value: string) {
    return (
      SECTION_CODE_REGEX.test(value) ||
      CATEGORY_CODE_REGEX.test(value) ||
      CRITERION_CODE_REGEX.test(value) ||
      Boolean(this.parseStatusValue(value))
    );
  }

  private parseStatusValue(value: string): ParsedAuditStatus | null {
    if (value === 'V' || value === 'M' || value === 'm' || value === 'X') {
      return value;
    }

    if (value === 'v') {
      return 'V';
    }

    if (value === 'x') {
      return 'X';
    }

    return null;
  }

  private async requireStoredAnalysis(documentId: string) {
    if (!documentId.trim()) {
      throw new BadRequestException('Pilih dokumen audit terlebih dahulu.');
    }

    const document = await this.prisma.k3AuditDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new BadRequestException('Dokumen audit tidak ditemukan.');
    }

    return {
      document,
      analysis: this.parseStoredAnalysis(document),
    };
  }

  private parseStoredAnalysis(document: K3AuditDocument) {
    const analysis = document.analysisJson as unknown as AuditAnalysis;
    return this.attachDocumentId(this.normalizeStoredAnalysis(analysis), document.id);
  }

  private attachDocumentId(analysis: AuditAnalysis, documentId: string): AuditAnalysis {
    return {
      ...analysis,
      documentId,
    };
  }

  private normalizeStoredAnalysis(analysis: AuditAnalysis): AuditAnalysis {
    return {
      ...analysis,
      items: analysis.items.map((item) => ({
        ...item,
        uploadedFiles: this.normalizeUploadedFiles(item.uploadedFiles),
      })),
      groups: analysis.groups.map((group) => ({
        ...group,
        uploadedFiles: this.normalizeUploadedFiles(group.uploadedFiles),
      })),
    };
  }

  private normalizeUploadedFiles(files: UploadedQuestionFile[] | undefined) {
    return (files ?? []).map<UploadedQuestionFile>((file) => ({
      ...file,
      storageProvider: file.storageProvider === 'google-drive' ? 'google-drive' : 'local',
      driveSyncStatus:
        file.driveSyncStatus === 'synced' ||
        file.storageProvider === 'google-drive' ||
        Boolean(file.driveFileId)
          ? 'synced'
          : 'pending',
      driveFileId:
        file.driveFileId ?? (file.storageProvider === 'google-drive' ? file.storageName : null),
      driveFolderId: file.driveFolderId ?? null,
      driveUrl: file.driveUrl ?? (file.storageProvider === 'google-drive' ? file.url : null),
      driveOwnerSub: file.driveOwnerSub ?? null,
      driveOwnerEmail: file.driveOwnerEmail ?? null,
    }));
  }

  private buildDocumentPersistencePayload(params: {
    id: string;
    fileName: string;
    storageName: string;
    analysis: AuditAnalysis;
  }) {
    return {
      id: params.id,
      fileName: params.fileName,
      storageName: params.storageName,
      branch: params.analysis.metadata.branch,
      documentNumber: params.analysis.metadata.documentNumber,
      auditDate: params.analysis.metadata.auditDate,
      analyzedAt: new Date(params.analysis.analyzedAt),
      expectedCriteria: params.analysis.metadata.expectedCriteria,
      detectedCriteria: params.analysis.totals.detectedCriteria,
      compliancePercentage: params.analysis.totals.compliancePercentage,
      completionPercentage: params.analysis.totals.completionPercentage,
      totalGroups: params.analysis.groups.length,
      analysisJson: params.analysis as Prisma.InputJsonValue,
    };
  }

  private async updateStoredAnalysis(document: K3AuditDocument, analysis: AuditAnalysis) {
    const nextAnalysis = this.attachDocumentId(analysis, document.id);

    await this.prisma.k3AuditDocument.update({
      where: { id: document.id },
      data: {
        branch: nextAnalysis.metadata.branch,
        documentNumber: nextAnalysis.metadata.documentNumber,
        auditDate: nextAnalysis.metadata.auditDate,
        analyzedAt: new Date(nextAnalysis.analyzedAt),
        expectedCriteria: nextAnalysis.metadata.expectedCriteria,
        detectedCriteria: nextAnalysis.totals.detectedCriteria,
        compliancePercentage: nextAnalysis.totals.compliancePercentage,
        completionPercentage: nextAnalysis.totals.completionPercentage,
        totalGroups: nextAnalysis.groups.length,
        analysisJson: nextAnalysis as Prisma.InputJsonValue,
      },
    });

    return nextAnalysis;
  }

  private toDocumentSummary(document: K3AuditDocument): ChecklistDocumentSummary {
    return {
      id: document.id,
      fileName: document.fileName,
      documentUrl: `/uploads/documents/${document.storageName}`,
      analyzedAt: document.analyzedAt.toISOString(),
      branch: document.branch,
      documentNumber: document.documentNumber,
      auditDate: document.auditDate,
      expectedCriteria: document.expectedCriteria,
      detectedCriteria: document.detectedCriteria,
      compliancePercentage: document.compliancePercentage,
      completionPercentage: document.completionPercentage,
      groupCount: document.totalGroups,
    };
  }
}
