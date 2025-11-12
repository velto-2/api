import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ImportedCallsController } from './imported-calls.controller';
import { AgentKnowledgeBaseController } from './agent-knowledge-base.controller';
import { ImportedCallsService } from './imported-calls.service';
import { AgentKnowledgeBaseService } from './services/agent-knowledge-base.service';
import { ExportService } from './services/export.service';
import { StorageService } from './services/storage.service';
import { CallProcessorService } from './services/call-processor.service';
import { WebhookService } from './services/webhook.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { PerformanceMonitorService } from './services/performance-monitor.service';
import { CacheService } from './services/cache.service';
import { RateLimitService } from './services/rate-limit.service';
import { ImportedCall, ImportedCallSchema, AgentKnowledgeBase, AgentKnowledgeBaseSchema } from './schemas';
import { SpeechModule } from '../speech/speech.module';
import { DigitalHumanModule } from '../digital-human/digital-human.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ImportedCall.name, schema: ImportedCallSchema },
      { name: AgentKnowledgeBase.name, schema: AgentKnowledgeBaseSchema },
    ]),
    SpeechModule,
    DigitalHumanModule,
    AgentsModule,
    HttpModule,
  ],
  controllers: [ImportedCallsController, AgentKnowledgeBaseController],
  providers: [
    ImportedCallsService,
    AgentKnowledgeBaseService,
    ExportService,
    StorageService,
    CallProcessorService,
    WebhookService,
    ErrorHandlerService,
    PerformanceMonitorService,
    CacheService,
    RateLimitService,
  ],
  exports: [ImportedCallsService, AgentKnowledgeBaseService],
})
export class ImportedCallsModule {}

