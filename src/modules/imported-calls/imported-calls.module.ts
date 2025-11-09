import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ImportedCallsController } from './imported-calls.controller';
import { ImportedCallsService } from './imported-calls.service';
import { StorageService } from './services/storage.service';
import { CallProcessorService } from './services/call-processor.service';
import { WebhookService } from './services/webhook.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { PerformanceMonitorService } from './services/performance-monitor.service';
import { CacheService } from './services/cache.service';
import { RateLimitService } from './services/rate-limit.service';
import { ImportedCall, ImportedCallSchema } from './schemas';
import { SpeechModule } from '../speech/speech.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ImportedCall.name, schema: ImportedCallSchema }]),
    SpeechModule,
    HttpModule,
  ],
  controllers: [ImportedCallsController],
  providers: [ImportedCallsService, StorageService, CallProcessorService, WebhookService, ErrorHandlerService, PerformanceMonitorService, CacheService, RateLimitService],
  exports: [ImportedCallsService],
})
export class ImportedCallsModule {}

