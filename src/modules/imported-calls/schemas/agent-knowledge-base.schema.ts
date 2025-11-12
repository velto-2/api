import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class ExpectedJob {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  completionIndicators: string[];

  @Prop({ type: [String], default: [] })
  requiredSteps: string[];
}

const ExpectedJobSchema = SchemaFactory.createForClass(ExpectedJob);

@Schema({ timestamps: true })
export class AgentKnowledgeBase {
  @Prop({ required: true, index: true })
  customerId: string;

  @Prop({ required: true, index: true, unique: true })
  agentId: string;

  @Prop({ type: [ExpectedJobSchema], default: [] })
  expectedJobs: ExpectedJob[];

  @Prop({ default: 'en' })
  language: string;

  @Prop()
  notes?: string;
}

export type AgentKnowledgeBaseDocument = AgentKnowledgeBase & Document;

export const AgentKnowledgeBaseSchema =
  SchemaFactory.createForClass(AgentKnowledgeBase);

AgentKnowledgeBaseSchema.index({ customerId: 1, agentId: 1 });

