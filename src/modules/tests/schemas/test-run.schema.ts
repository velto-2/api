import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TestRunDocument = TestRun & Document;

/**
 * Transcript entry - represents a single turn in the conversation
 */
@Schema({ _id: false })
export class TranscriptEntry {
  @Prop({ required: true, enum: ['user', 'agent'] })
  speaker: string; // 'user' (digital human) or 'agent' (voice agent)

  @Prop({ required: true })
  message: string; // Transcribed text

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop()
  audioUrl?: string; // URL to audio file if stored

  @Prop()
  latency?: number; // Response time in milliseconds
}

const TranscriptEntrySchema = SchemaFactory.createForClass(TranscriptEntry);

/**
 * Call information
 */
@Schema({ _id: false })
export class CallInfo {
  @Prop()
  callSid?: string; // Twilio call SID

  @Prop()
  duration?: number; // Call duration in seconds

  @Prop()
  status?: string; // Call status

  @Prop()
  startedAt?: Date;

  @Prop()
  endedAt?: Date;
}

const CallInfoSchema = SchemaFactory.createForClass(CallInfo);

/**
 * Evaluation results
 */
@Schema({ _id: false })
export class Evaluation {
  @Prop({ type: Number, min: 0, max: 100 })
  overallScore?: number; // Overall quality score (0-100)

  @Prop({ type: String, enum: ['A', 'B', 'C', 'D', 'F'] })
  grade?: string; // Letter grade (A: 90+, B: 80-89, C: 70-79, D: 60-69, F: <60)

  @Prop({ type: Number })
  averageLatency?: number; // Average response time in milliseconds

  @Prop({ type: Number })
  taskCompleted?: number; // Percentage of tasks completed (0-100)

  @Prop({ type: [String], default: [] })
  issues: string[]; // List of identified issues

  @Prop({ type: Object })
  metrics?: Record<string, any>; // Additional metrics
}

const EvaluationSchema = SchemaFactory.createForClass(Evaluation);

/**
 * TestRun Schema
 * Represents a single execution of a test configuration
 */
@Schema({ timestamps: true })
export class TestRun {
  @Prop({ type: Types.ObjectId, ref: 'TestConfig', required: true })
  testConfigId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @Prop({ type: CallInfoSchema })
  call?: CallInfo;

  @Prop({ type: [TranscriptEntrySchema], default: [] })
  transcripts: TranscriptEntry[];

  @Prop({ type: EvaluationSchema })
  evaluation?: Evaluation;

  @Prop({ type: Object })
  metadata?: Record<string, any>; // Additional metadata

  @Prop()
  error?: string; // Error message if failed

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;
}

export const TestRunSchema = SchemaFactory.createForClass(TestRun);

// Transform ObjectId to string in JSON
TestRunSchema.set('toJSON', {
  transform: (doc, ret: any) => {
    if (ret._id) {
      ret._id = ret._id.toString();
    }
    if (ret.testConfigId) {
      ret.testConfigId = ret.testConfigId.toString();
    }
    return ret;
  },
});

// Indexes for performance
TestRunSchema.index({ testConfigId: 1 });
TestRunSchema.index({ status: 1 });
TestRunSchema.index({ createdAt: -1 });
TestRunSchema.index({ 'call.callSid': 1 });
