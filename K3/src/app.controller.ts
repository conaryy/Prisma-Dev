import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ChecklistAuditService } from './checklist-audit.service';

@Controller()
export class AppController {
  constructor(private readonly checklistAuditService: ChecklistAuditService) {}

  @Get('api/checklist-audit/latest')
  getLatestChecklistAudit() {
    return {
      data: this.checklistAuditService.getLatestAnalysis(),
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

    return {
      message: 'Dokumen berhasil dianalisis.',
      data: analysis,
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
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('Pilih file evidence terlebih dahulu.');
    }

    const analysis = await this.checklistAuditService.uploadQuestionEvidence({
      questionCode,
      file,
    });

    return {
      message: 'File evidence berhasil ditambahkan.',
      data: analysis,
    };
  }

  @Delete('api/checklist-audit/:questionCode/files/:fileId')
  async deleteQuestionEvidence(
    @Param('questionCode') questionCode: string,
    @Param('fileId') fileId: string
  ) {
    const analysis = await this.checklistAuditService.deleteQuestionEvidence(questionCode, fileId);

    return {
      message: 'File evidence berhasil dihapus.',
      data: analysis,
    };
  }

  @Post('api/checklist-audit/groups')
  createQuestionGroup(@Body() body: { questionCodes?: string[] }) {
    const analysis = this.checklistAuditService.createQuestionGroup(body.questionCodes ?? []);

    return {
      message: 'Kelompok evidence berhasil dibuat.',
      data: analysis,
    };
  }

  @Patch('api/checklist-audit/groups/:groupId')
  updateQuestionGroup(
    @Param('groupId') groupId: string,
    @Body() body: { questionCodes?: string[] }
  ) {
    const analysis = this.checklistAuditService.updateQuestionGroup(groupId, body.questionCodes ?? []);

    return {
      message: 'Kelompok evidence berhasil diperbarui.',
      data: analysis,
    };
  }

  @Delete('api/checklist-audit/groups/:groupId')
  deleteQuestionGroup(@Param('groupId') groupId: string) {
    const analysis = this.checklistAuditService.deleteQuestionGroup(groupId);

    return {
      message: 'Kelompok evidence berhasil dihapus.',
      data: analysis,
    };
  }
}
