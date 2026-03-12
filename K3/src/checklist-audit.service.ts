import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { promisify } from 'node:util';
import * as mammoth from 'mammoth';

const execFileAsync = promisify(execFile);
const CRITERION_CODE_REGEX = /^\d{1,2}\.\d{1,2}\.\d{1,2}$/;
const CATEGORY_CODE_REGEX = /^\d{1,2}\.\d{1,2}$/;
const SECTION_CODE_REGEX = /^\d{1,2}$/;
const STATUS_VALUES = new Set(['V', 'M', 'm', 'X']);

type AuditStatus = 'V' | 'M' | 'm' | 'X' | 'unknown';

export type UploadedQuestionFile = {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
  storageName: string;
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

@Injectable()
export class ChecklistAuditService {
  private latestAnalysis: AuditAnalysis | null = null;
  private readonly uploadsRoot = join(__dirname, '..', 'uploads', 'checklist-evidence');

  getLatestAnalysis() {
    return this.latestAnalysis;
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
    const analysis = this.buildAnalysis(normalizedText, file.originalname);

    if (this.latestAnalysis) {
      await this.cleanupAnalysisFiles(this.latestAnalysis);
    }

    this.latestAnalysis = analysis;
    return analysis;
  }

  async uploadQuestionEvidence(params: {
    questionCode: string;
    file: Express.Multer.File;
  }) {
    if (!params.file) {
      throw new BadRequestException('Pilih file evidence terlebih dahulu.');
    }

    const analysis = this.ensureLatestAnalysis();
    const item = analysis.items.find((entry) => entry.code === params.questionCode);

    if (!item) {
      throw new BadRequestException('Pertanyaan tidak ditemukan pada hasil audit terbaru.');
    }

    await fs.mkdir(this.uploadsRoot, { recursive: true });

    const safeOriginalName = basename(params.file.originalname).replace(/[^a-zA-Z0-9._-]+/g, '-');
    const storageName = `${Date.now()}-${randomUUID()}-${safeOriginalName}`;
    const filePath = join(this.uploadsRoot, storageName);
    await fs.writeFile(filePath, params.file.buffer);

    const uploadedFile: UploadedQuestionFile = {
      id: randomUUID(),
      name: params.file.originalname,
      size: params.file.size,
      uploadedAt: new Date().toISOString(),
      url: `/uploads/checklist-evidence/${storageName}`,
      storageName,
    };

    const targetFiles = this.resolveEvidenceCollection(analysis, item);
    targetFiles.unshift(uploadedFile);
    return analysis;
  }

  async deleteQuestionEvidence(questionCode: string, fileId: string) {
    const analysis = this.ensureLatestAnalysis();
    const item = analysis.items.find((entry) => entry.code === questionCode);

    if (!item) {
      throw new BadRequestException('Pertanyaan tidak ditemukan pada hasil audit terbaru.');
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
    await this.cleanupStoredFileIfUnused(analysis, targetFile.storageName);

    return analysis;
  }

  createQuestionGroup(questionCodes: string[]) {
    const analysis = this.ensureLatestAnalysis();
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
        throw new BadRequestException(`Butir ${code} tidak ditemukan pada hasil audit terbaru.`);
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
    return analysis;
  }

  updateQuestionGroup(groupId: string, questionCodes: string[]) {
    const analysis = this.ensureLatestAnalysis();
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
        throw new BadRequestException(`Butir ${code} tidak ditemukan pada hasil audit terbaru.`);
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

    return analysis;
  }

  deleteQuestionGroup(groupId: string) {
    const analysis = this.ensureLatestAnalysis();
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
    return analysis;
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

          if (STATUS_VALUES.has(value)) {
            status = value as AuditStatus;
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
    const sesuai = items.filter((item) => item.status === 'V').length;
    const major = items.filter((item) => item.status === 'M').length;
    const minor = items.filter((item) => item.status === 'm').length;
    const tidakBerlaku = items.filter((item) => item.status === 'X').length;
    const unknown = items.filter((item) => item.status === 'unknown').length;
    const applicableCriteria = Math.max(items.length - tidakBerlaku, 0);

    return {
      totalCriteria: expectedCriteria,
      expectedCriteria,
      detectedCriteria: items.length,
      sesuai,
      major,
      minor,
      tidakBerlaku,
      unknown,
      applicableCriteria,
      compliancePercentage:
        applicableCriteria > 0 ? Number(((sesuai / applicableCriteria) * 100).toFixed(2)) : 0,
      completionPercentage:
        expectedCriteria > 0 ? Number(((items.length / expectedCriteria) * 100).toFixed(2)) : 0,
    };
  }

  private summarizeBySection(items: ChecklistItem[]) {
    const sectionMap = new Map<string, SectionSummary>();

    items.forEach((item) => {
      const key = item.sectionCode ?? 'lainnya';
      const title = item.sectionTitle ?? 'Tanpa Bab';

      if (!sectionMap.has(key)) {
        sectionMap.set(key, {
          sectionCode: key,
          sectionTitle: title,
          total: 0,
          sesuai: 0,
          major: 0,
          minor: 0,
          tidakBerlaku: 0,
          percentage: 0,
        });
      }

      const summary = sectionMap.get(key)!;
      summary.total += 1;
      if (item.status === 'V') summary.sesuai += 1;
      if (item.status === 'M') summary.major += 1;
      if (item.status === 'm') summary.minor += 1;
      if (item.status === 'X') summary.tidakBerlaku += 1;
    });

    return Array.from(sectionMap.values())
      .map((summary) => {
        const applicable = summary.total - summary.tidakBerlaku;
        return {
          ...summary,
          percentage:
            applicable > 0 ? Number(((summary.sesuai / applicable) * 100).toFixed(2)) : 0,
        };
      })
      .sort((left, right) => {
        const leftCode = Number.parseInt(left.sectionCode, 10);
        const rightCode = Number.parseInt(right.sectionCode, 10);

        if (Number.isNaN(leftCode) || Number.isNaN(rightCode)) {
          return left.sectionCode.localeCompare(right.sectionCode);
        }

        return leftCode - rightCode;
      });
  }

  private captureFirst(source: string, pattern: RegExp) {
    return source.match(pattern)?.[1]?.trim() ?? null;
  }

  private ensureLatestAnalysis() {
    if (!this.latestAnalysis) {
      throw new BadRequestException('Belum ada hasil audit. Upload dokumen checklist terlebih dahulu.');
    }

    return this.latestAnalysis;
  }

  private async cleanupAnalysisFiles(analysis: AuditAnalysis) {
    const files = [
      ...analysis.items.flatMap((item) => item.uploadedFiles),
      ...analysis.groups.flatMap((group) => group.uploadedFiles),
    ];
    await Promise.all(
      Array.from(new Set(files.map((file) => file.storageName))).map((storageName) =>
        fs.rm(join(this.uploadsRoot, storageName), { force: true })
      )
    );
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
        if (seen.has(file.storageName)) {
          return false;
        }

        seen.add(file.storageName);
        return true;
      })
    );
  }

  private async cleanupStoredFileIfUnused(analysis: AuditAnalysis, storageName: string) {
    const stillReferenced = [
      ...analysis.items.flatMap((item) => item.uploadedFiles),
      ...analysis.groups.flatMap((group) => group.uploadedFiles),
    ].some((file) => file.storageName === storageName);

    if (stillReferenced) {
      return;
    }

    await fs.rm(join(this.uploadsRoot, storageName), { force: true });
  }

  private looksLikeCode(value: string) {
    return (
      SECTION_CODE_REGEX.test(value) ||
      CATEGORY_CODE_REGEX.test(value) ||
      CRITERION_CODE_REGEX.test(value) ||
      STATUS_VALUES.has(value)
    );
  }
}
