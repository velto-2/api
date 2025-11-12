import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Body,
  UseGuards,
  HttpException,
  Request,
  HttpStatus,
  Delete,
  Patch,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ImportedCallsService } from './imported-calls.service';
import { StorageService } from './services/storage.service';
import { CallProcessorService } from './services/call-processor.service';
import { WebhookService } from './services/webhook.service';
import { PerformanceMonitorService } from './services/performance-monitor.service';
import { CacheService } from './services/cache.service';
import { RateLimitService } from './services/rate-limit.service';
import { ExportService } from './services/export.service';
import {
  RateLimitGuard,
  RateLimit,
} from '../../common/guards/rate-limit.guard';
import { UploadCallDto } from './dto';
@ApiTags('imported-calls')
@Controller('imported-calls')
export class ImportedCallsController {
  constructor(
    private readonly service: ImportedCallsService,
    private readonly storageService: StorageService,
    private readonly processorService: CallProcessorService,
    private readonly webhookService: WebhookService,
    private readonly performanceMonitor: PerformanceMonitorService,
    private readonly cacheService: CacheService,
    private readonly rateLimitService: RateLimitService,
    private readonly exportService: ExportService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a call audio file' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(RateLimitGuard)
  @RateLimit({ endpoint: 'upload' })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 500 * 1024 * 1024 }), // 500MB
          new FileTypeValidator({
            fileType: /^audio\/(mpeg|wav|wave|flac|ogg|webm|mp4|x-m4a)$/,
          }),
        ],
      }),
    )
    file: any,
    @Body() metadata: UploadCallDto,
    @Request() req: any,
  ) {
    if (!file) throw new Error('File is required');

    // Get customerId from authenticated user's organization, or fallback to default
    const customerId = req.user?.organizationId || 'default-customer';
    const fileHash = this.storageService.generateHash(file.buffer);

    // Decode filename properly to handle UTF-8 characters (Arabic, Chinese, etc.)
    const decodedFileName = this.decodeFileName(file.originalname);
    const extension = decodedFileName.split('.').pop() || 'mp3';

    const call = await this.service.create({
      customerId,
      fileName: decodedFileName,
      fileSize: file.size,
      status: 'uploading',
      metadata: {
        callDate: metadata.callDate ? new Date(metadata.callDate) : undefined,
        customerPhoneNumber: metadata.customerPhoneNumber,
        agentId: metadata.agentId,
        agentName: metadata.agentName,
        campaignId: metadata.campaignId,
        region: metadata.region,
        customFields: metadata.customFields,
      },
    });

    const callId = (call._id as any).toString();
    const filePath = await this.storageService.saveFile(
      customerId,
      callId,
      file.buffer,
      extension,
    );
    const r2Key = this.storageService.generateR2Key(
      customerId,
      callId,
      extension,
    );

    await this.service.update(callId, { r2Key: filePath, status: 'pending' });

    // Process asynchronously
    this.processorService.processCall(callId).catch((err) => {
      console.error('Background processing failed', err);
    });

    return {
      callId,
      status: 'pending',
      uploadedAt: (call as any).createdAt || new Date(),
      estimatedProcessingTime: '5-10 minutes',
    };
  }

  @Post('bulk-upload')
  @ApiOperation({ summary: 'Upload multiple call audio files' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(RateLimitGuard)
  @RateLimit({ endpoint: 'bulk-upload' })
  @UseInterceptors(FilesInterceptor('files', 50)) // Max 50 files
  async bulkUpload(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 500 * 1024 * 1024 }), // 500MB per file
          new FileTypeValidator({ fileType: /(mp3|wav|flac|ogg|webm|m4a)$/ }),
        ],
      }),
    )
    files: any[],
    @Body() metadata: UploadCallDto,
    @Request() req: any,
  ) {
    if (!files || files.length === 0) {
      throw new HttpException(
        'At least one file is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (files.length > 50) {
      throw new HttpException(
        'Maximum 50 files allowed per batch',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Get customerId from authenticated user's organization, or fallback to default
    const customerId = req.user?.organizationId || 'default-customer';
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const calls: any[] = [];
    const rejectedCalls: any[] = [];

    // Process each file
    for (const file of files) {
      try {
        const decodedFileName = this.decodeFileName(file.originalname);
        const extension = decodedFileName.split('.').pop() || 'mp3';

        const call = await this.service.create({
          customerId,
          fileName: decodedFileName,
          fileSize: file.size,
          status: 'uploading',
          metadata: {
            callDate: metadata.callDate
              ? new Date(metadata.callDate)
              : undefined,
            customerPhoneNumber: metadata.customerPhoneNumber,
            agentId: metadata.agentId,
            agentName: metadata.agentName,
            campaignId: metadata.campaignId,
            region: metadata.region,
            customFields: metadata.customFields,
          },
        });

        const callId = (call._id as any).toString();
        const filePath = await this.storageService.saveFile(
          customerId,
          callId,
          file.buffer,
          extension,
        );
        const r2Key = this.storageService.generateR2Key(
          customerId,
          callId,
          extension,
        );

        await this.service.update(callId, {
          r2Key: filePath,
          status: 'pending',
        });

        // Process asynchronously
        this.processorService.processCall(callId).catch((err) => {
          console.error(`Background processing failed for call ${callId}`, err);
        });

        calls.push({
          callId,
          fileName: decodedFileName,
          status: 'pending',
        });
      } catch (error) {
        rejectedCalls.push({
          fileName: file.originalname,
          reason: error.message || 'Unknown error',
        });
      }
    }

    return {
      batchId,
      totalCalls: files.length,
      acceptedCalls: calls.length,
      rejectedCalls: rejectedCalls.length,
      rejections: rejectedCalls,
      calls,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List imported calls' })
  async list(
    @Query('customerId') customerId?: string,
    @Query('agentId') agentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    const result = await this.service.findAll({
      customerId: customerId || 'default-customer',
      agentId,
      status,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      campaignId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });

    return {
      page: parseInt(page || '1'),
      limit: parseInt(limit || '20'),
      totalPages: Math.ceil(result.total / parseInt(limit || '20')),
      totalCalls: result.total,
      calls: result.calls,
    };
  }


  @Get('bulk-status')
  @ApiOperation({ summary: 'Get status for multiple calls' })
  async getBulkStatus(
    @Query('callIds') callIds: string,
    @Query('customerId') customerId?: string,
  ) {
    if (!callIds) {
      throw new HttpException(
        'callIds parameter is required (comma-separated)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const ids = callIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id);
    return this.service.getBulkStatus(ids, customerId);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get aggregated analytics' })
  async getAnalytics(
    @Query('customerId') customerId?: string,
    @Query('agentId') agentId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.service.getAnalytics({
      customerId: customerId || 'default-customer',
      agentId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      campaignId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get call details' })
  async getOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get(':id/evaluation')
  @ApiOperation({ summary: 'Get call evaluation' })
  async getEvaluation(@Param('id') id: string) {
    const call = await this.service.findById(id);
    return call.evaluation;
  }

  @Get(':id/transcript')
  @ApiOperation({ summary: 'Get call transcript' })
  async getTranscript(@Param('id') id: string) {
    const call = await this.service.findById(id);
    return {
      callId: (call._id as any).toString(),
      duration: call.duration,
      language: call.metadata?.language,
      transcripts: call.transcripts,
    };
  }

  @Get(':id/audio')
  @ApiOperation({ summary: 'Get call audio file' })
  async getAudio(@Param('id') id: string, @Res() res: Response) {
    const call = await this.service.findById(id);

    if (!call.r2Key) {
      throw new HttpException('Audio file not found', HttpStatus.NOT_FOUND);
    }

    try {
      const audioBuffer = await this.storageService.getFile(call.r2Key);
      const extension = call.fileName?.split('.').pop() || 'mp3';
      const mimeTypes: Record<string, string> = {
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        flac: 'audio/flac',
        ogg: 'audio/ogg',
        webm: 'audio/webm',
        m4a: 'audio/mp4',
      };
      const mimeType = mimeTypes[extension] || 'audio/mpeg';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${call.fileName}"`,
      );
      res.send(audioBuffer);
    } catch (error) {
      throw new HttpException(
        'Failed to load audio file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('export-bulk')
  @ApiOperation({ summary: 'Export multiple calls' })
  async exportBulk(
    @Body() body: { callIds: string[]; format?: 'json' | 'csv' | 'pdf' },
    @Res() res: Response,
    @Query('customerId') customerId?: string,
  ) {
    if (!body.callIds || body.callIds.length === 0) {
      throw new HttpException(
        'callIds array is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const format = body.format || 'csv';
    const calls = await Promise.all(
      body.callIds.map((id) => this.service.findById(id, customerId)),
    );

    if (format === 'pdf') {
      try {
        const callsData = calls.map((call) => ({
          callId: (call._id as any).toString(),
          fileName: call.fileName,
          duration: call.duration,
          status: call.status,
          uploadedAt: (call as any).createdAt,
          evaluation: call.evaluation,
        }));

        const pdfBuffer =
          await this.exportService.generateBulkEvaluationPDF(callsData);
        const filename = `calls_export_${new Date().toISOString().split('T')[0]}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`,
        );
        res.send(pdfBuffer);
        return;
      } catch (error: any) {
        throw new HttpException(
          error.message || 'Failed to generate PDF',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    if (format === 'csv') {
      const csvRows = [
        [
          'Call ID',
          'File Name',
          'Duration (ms)',
          'Status',
          'Overall Score',
          'Grade',
          'Latency Score',
          'Pronunciation Score',
          'Jobs-to-be-Done Score',
          'Uploaded At',
        ],
      ];

      calls.forEach((call) => {
        csvRows.push([
          (call._id as any).toString(),
          call.fileName || '',
          call.duration?.toString() || 'N/A',
          call.status || 'N/A',
          call.evaluation?.overallScore?.toString() || 'N/A',
          call.evaluation?.grade || 'N/A',
          call.evaluation?.latency?.score?.toString() || 'N/A',
          call.evaluation?.pronunciation?.score?.toString() || 'N/A',
          call.evaluation?.jobsToBeDone?.score?.toString() || 'N/A',
          (call as any).createdAt?.toISOString() || 'N/A',
        ]);
      });

      const csvContent = csvRows
        .map((row) => row.map((cell) => `"${cell}"`).join(','))
        .join('\n');

      return {
        format: 'csv',
        data: csvContent,
        filename: `calls_export_${new Date().toISOString().split('T')[0]}.csv`,
      };
    }

    return {
      format: 'json',
      data: calls.map((call) => ({
        callId: (call._id as any).toString(),
        fileName: call.fileName,
        duration: call.duration,
        status: call.status,
        uploadedAt: (call as any).createdAt,
        metadata: call.metadata,
        evaluation: call.evaluation,
      })),
      filename: `calls_export_${new Date().toISOString().split('T')[0]}.json`,
    };
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export call data' })
  async exportCall(
    @Param('id') id: string,
    @Query('format') format: 'json' | 'csv' | 'pdf' = 'json',
    @Res() res: Response,
  ) {
    const call = await this.service.findById(id);
    const callData = {
      callId: (call._id as any).toString(),
      fileName: call.fileName,
      fileSize: call.fileSize,
      duration: call.duration,
      status: call.status,
      uploadedAt: (call as any).createdAt || new Date(),
      metadata: call.metadata,
      transcripts: call.transcripts,
      evaluation: call.evaluation,
      exportedAt: new Date().toISOString(),
    };

    if (format === 'pdf') {
      try {
        const pdfBuffer =
          await this.exportService.generateEvaluationPDF(callData);
        const filename = `${callData.fileName.replace(/\.[^/.]+$/, '')}_export.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`,
        );
        res.send(pdfBuffer);
        return;
      } catch (error: any) {
        throw new HttpException(
          error.message || 'Failed to generate PDF',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    if (format === 'csv') {
      // Convert to CSV format
      const csvRows = [
        ['Field', 'Value'],
        ['Call ID', callData.callId],
        ['File Name', callData.fileName],
        ['File Size (bytes)', callData.fileSize],
        ['Duration (ms)', callData.duration || 'N/A'],
        ['Status', callData.status],
        ['Uploaded At', callData.uploadedAt],
        ['Overall Score', callData.evaluation?.overallScore || 'N/A'],
        ['Grade', callData.evaluation?.grade || 'N/A'],
        ['', ''],
        ['Transcript Entries', ''],
        ['Timestamp (ms)', 'Speaker', 'Message', 'Duration (ms)', 'Confidence'],
      ];

      callData.transcripts.forEach((entry: any) => {
        csvRows.push([
          entry.timestamp || '',
          entry.speaker || '',
          entry.message || '',
          entry.duration || '',
          entry.confidence ? (entry.confidence * 100).toFixed(2) + '%' : '',
        ]);
      });

      const csvContent = csvRows
        .map((row) => row.map((cell) => `"${cell}"`).join(','))
        .join('\n');
      return {
        format: 'csv',
        data: csvContent,
        filename: `${callData.fileName.replace(/\.[^/.]+$/, '')}_export.csv`,
      };
    }

    return {
      format: 'json',
      data: callData,
      filename: `${callData.fileName.replace(/\.[^/.]+$/, '')}_export.json`,
    };
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry failed call processing' })
  async retry(@Param('id') id: string) {
    const call = await this.service.findById(id);

    if (call.status !== 'failed') {
      throw new HttpException(
        'Call is not in failed state',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.service.update(id, {
      status: 'pending',
      error: undefined,
      retryCount: (call.retryCount || 0) + 1,
      lastRetryAt: new Date(),
    });

    this.processorService.processCall(id).catch((err) => {
      console.error('Background processing failed', err);
    });

    return {
      callId: id,
      status: 'pending',
      message: 'Processing retry initiated',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a call (soft delete)' })
  async delete(
    @Param('id') id: string,
    @Query('permanent') permanent?: string,
  ) {
    const call = await this.service.findById(id);

    if (permanent === 'true') {
      // Hard delete - remove file and database record
      if (call.r2Key) {
        await this.storageService.deleteFile(call.r2Key);
      }
      await this.service.delete(id);
      return { message: 'Call permanently deleted' };
    } else {
      // Soft delete
      await this.service.update(id, { deletedAt: new Date() });
      return { message: 'Call deleted (soft delete)' };
    }
  }

  @Patch(':id/metadata')
  @ApiOperation({ summary: 'Update call metadata' })
  async updateMetadata(
    @Param('id') id: string,
    @Body() body: { metadata?: any },
  ) {
    const call = await this.service.findById(id);

    await this.service.update(id, {
      metadata: {
        ...call.metadata,
        ...body.metadata,
      },
    });

    return this.service.findById(id);
  }

  @Post('webhooks')
  @ApiOperation({ summary: 'Configure webhook for customer' })
  async configureWebhook(
    @Body() body: { url: string; secret?: string; events?: string[] },
    @Query('customerId') customerId?: string,
  ) {
    // In production, store in database
    // For now, use WebhookService to add config
    await this.webhookService.addWebhookConfig(
      customerId || 'default-customer',
      {
        url: body.url,
        secret: body.secret,
        events: body.events || ['call.completed', 'call.failed'],
      },
    );
    return { message: 'Webhook configured successfully' };
  }

  @Delete('webhooks')
  @ApiOperation({ summary: 'Remove webhook configuration' })
  async removeWebhook(
    @Query('url') url: string,
    @Query('customerId') customerId?: string,
  ) {
    await this.webhookService.removeWebhookConfig(
      customerId || 'default-customer',
      url,
    );
    return { message: 'Webhook removed successfully' };
  }

  @Get('performance/metrics')
  @ApiOperation({ summary: 'Get performance metrics for a call' })
  async getPerformanceMetrics(@Query('callId') callId: string) {
    if (!callId) {
      throw new HttpException('callId is required', HttpStatus.BAD_REQUEST);
    }
    const metrics = this.performanceMonitor.getMetrics(callId);
    if (!metrics) {
      throw new HttpException(
        'Metrics not found for this call',
        HttpStatus.NOT_FOUND,
      );
    }
    return metrics;
  }

  @Get('performance/aggregate')
  @ApiOperation({ summary: 'Get aggregate performance metrics' })
  async getAggregateMetrics(
    @Query('customerId') customerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const from = dateFrom ? new Date(dateFrom) : undefined;
    const to = dateTo ? new Date(dateTo) : undefined;
    return this.performanceMonitor.getAggregateMetrics(customerId, from, to);
  }

  @Get('cache/stats')
  @ApiOperation({ summary: 'Get cache statistics' })
  async getCacheStats() {
    return this.cacheService.getStats();
  }

  @Delete('cache')
  @ApiOperation({ summary: 'Clear cache entries' })
  async clearCache(
    @Query('pattern') pattern?: string,
    @Query('all') all?: string,
  ) {
    if (all === 'true') {
      this.cacheService.clearAll();
      return { message: 'All cache cleared' };
    } else if (pattern) {
      this.cacheService.clearPattern(pattern);
      return { message: `Cache cleared for pattern: ${pattern}` };
    } else {
      const cleaned = this.cacheService.cleanExpired();
      return { message: `Cleaned ${cleaned} expired entries` };
    }
  }

  @Get('rate-limit/status')
  @ApiOperation({ summary: 'Get rate limit status' })
  async getRateLimitStatus(
    @Query('key') key: string,
    @Query('endpoint') endpoint: string = 'api',
  ) {
    if (!key) {
      throw new HttpException('key is required', HttpStatus.BAD_REQUEST);
    }
    return this.rateLimitService.getRateLimitStatus(key, endpoint);
  }

  @Get('rate-limit/stats')
  @ApiOperation({ summary: 'Get rate limit statistics' })
  async getRateLimitStats() {
    return this.rateLimitService.getStats();
  }

  @Delete('rate-limit')
  @ApiOperation({ summary: 'Reset rate limit for a key' })
  async resetRateLimit(
    @Query('key') key: string,
    @Query('endpoint') endpoint?: string,
  ) {
    if (!key) {
      throw new HttpException('key is required', HttpStatus.BAD_REQUEST);
    }
    this.rateLimitService.resetRateLimit(key, endpoint);
    return { message: 'Rate limit reset successfully' };
  }

  /**
   * Decode filename from various encodings to UTF-8
   * Handles RFC 5987 encoding and common browser encoding issues
   */
  private decodeFileName(fileName: string): string {
    if (!fileName) return fileName;

    try {
      // Handle RFC 5987 encoding: filename*=UTF-8''encoded-name
      const rfc5987Match = fileName.match(/filename\*=UTF-8''(.+)/i);
      if (rfc5987Match) {
        return decodeURIComponent(rfc5987Match[1]);
      }

      // Handle URL-encoded filenames
      if (fileName.includes('%')) {
        try {
          return decodeURIComponent(fileName);
        } catch {
          // If decode fails, continue with other methods
        }
      }

      // Try to fix common ISO-8859-1 to UTF-8 mis-encoding
      // This happens when browsers send UTF-8 as ISO-8859-1
      try {
        // Convert from Latin1 (ISO-8859-1) to UTF-8
        const buffer = Buffer.from(fileName, 'latin1');
        const utf8String = buffer.toString('utf8');

        // Check if the conversion produced valid UTF-8
        // If the original was already UTF-8, this might produce mojibake
        // So we check if the result looks like valid text
        if (utf8String && !utf8String.includes('')) {
          return utf8String;
        }
      } catch {
        // Conversion failed, use original
      }

      // If all else fails, return as-is (might already be correct)
      return fileName;
    } catch (error) {
      // If any error occurs, return original filename
      return fileName;
    }
  }
}
