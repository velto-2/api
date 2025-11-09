import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ImportedCallDocument = ImportedCall & Document;

@Schema({ _id: false })
export class TranscriptEntry {
  @Prop({ required: true, enum: ['customer', 'agent', 'unknown'] })
  speaker: string;

  @Prop()
  speakerId?: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  timestamp: number; // milliseconds from call start

  @Prop()
  duration?: number; // milliseconds

  @Prop({ type: Number, min: 0, max: 1 })
  confidence?: number;

  @Prop()
  language?: string;

  @Prop()
  audioSegmentUrl?: string;
}

const TranscriptEntrySchema = SchemaFactory.createForClass(TranscriptEntry);

@Schema({ _id: false })
export class CallMetadata {
  @Prop()
  callDate?: Date;

  @Prop()
  customerPhoneNumber?: string; // encrypted

  @Prop()
  agentId?: string;

  @Prop()
  agentName?: string;

  @Prop()
  campaignId?: string;

  @Prop()
  region?: string;

  @Prop()
  language?: string;

  @Prop()
  dialect?: string;

  @Prop({ type: Object })
  customFields?: Record<string, any>;
}

const CallMetadataSchema = SchemaFactory.createForClass(CallMetadata);

@Schema({ _id: false })
export class EvaluationResult {
  @Prop({ type: Number, min: 0, max: 100 })
  overallScore?: number;

  @Prop({ enum: ['A', 'B', 'C', 'D', 'F'] })
  grade?: string;

  @Prop({ default: Date.now })
  processedAt?: Date;

  @Prop()
  evaluationVersion?: string;

  @Prop({ type: Object })
  latency?: Record<string, any>;

  @Prop({ type: Object })
  interruption?: Record<string, any>;

  @Prop({ type: Object })
  pronunciation?: Record<string, any>;

  @Prop({ type: Object })
  repetition?: Record<string, any>;

  @Prop({ type: Object })
  disconnection?: Record<string, any>;

  @Prop({ type: Object })
  jobsToBeDone?: Record<string, any>;

  @Prop({ type: [Object] })
  criticalIssues?: Array<Record<string, any>>;

  @Prop({ type: [Object] })
  recommendations?: Array<Record<string, any>>;

  @Prop()
  executiveSummary?: string;

  @Prop()
  detailedAnalysis?: string;

  @Prop({ type: Object })
  sentimentAnalysis?: Record<string, any>;

  @Prop({ type: Object })
  benchmarkComparison?: Record<string, any>;
}

const EvaluationResultSchema = SchemaFactory.createForClass(EvaluationResult);

@Schema({ timestamps: true })
export class ImportedCall {
  @Prop({ required: true, index: true })
  customerId: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  fileSize: number;

  @Prop()
  duration?: number;

  @Prop()
  audioUrl?: string;

  @Prop()
  r2Key?: string;

  @Prop()
  externalCallId?: string;

  @Prop({ type: CallMetadataSchema })
  metadata?: CallMetadata;

  @Prop({
    enum: [
      'pending',
      'uploading',
      'processing',
      'transcribing',
      'evaluating',
      'completed',
      'failed',
    ],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop()
  processingStage?: string;

  @Prop({ type: Number, min: 0, max: 100, default: 0 })
  progressPercentage: number;

  @Prop({ type: [TranscriptEntrySchema], default: [] })
  transcripts: TranscriptEntry[];

  @Prop({ type: EvaluationResultSchema })
  evaluation?: EvaluationResult;

  @Prop()
  processingStartedAt?: Date;

  @Prop()
  processingCompletedAt?: Date;

  @Prop()
  processingDuration?: number;

  @Prop()
  error?: string;

  @Prop({ default: 0 })
  retryCount: number;

  @Prop()
  lastRetryAt?: Date;

  @Prop()
  deletedAt?: Date;
}

export const ImportedCallSchema = SchemaFactory.createForClass(ImportedCall);

ImportedCallSchema.index({ customerId: 1, uploadedAt: -1 });
ImportedCallSchema.index({ status: 1, processingStartedAt: 1 });
ImportedCallSchema.index({ 'metadata.callDate': 1, customerId: 1 });
ImportedCallSchema.index({ 'metadata.campaignId': 1 });
ImportedCallSchema.index({ externalCallId: 1 });
ImportedCallSchema.index({ deletedAt: 1 });

ImportedCallSchema.set('toJSON', {
  transform: (doc, ret: any) => {
    if (ret._id) ret._id = ret._id.toString();
    return ret;
  },
});
