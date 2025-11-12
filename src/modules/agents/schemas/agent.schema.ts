import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Agent {
  @Prop({ required: true, index: true })
  customerId: string; // Organization/user ID

  @Prop({ required: true, index: true })
  agentId: string; // Unique identifier for this agent

  @Prop({ required: true })
  name: string; // Display name

  @Prop()
  description?: string;

  @Prop({ default: 'phone' })
  type: string; // 'phone', 'webhook', 'sip', etc.

  @Prop()
  endpoint?: string; // Phone number or endpoint URL

  @Prop({ default: 'en' })
  language: string; // Primary language

  @Prop({ type: Object })
  metadata?: Record<string, any>; // Additional agent-specific data

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  deletedAt?: Date;
}

export type AgentDocument = Agent & Document;

export const AgentSchema = SchemaFactory.createForClass(Agent);

// Indexes for efficient queries
AgentSchema.index({ customerId: 1, agentId: 1 }, { unique: true });
AgentSchema.index({ customerId: 1, isActive: 1 });
AgentSchema.index({ deletedAt: 1 });

// Transform ObjectId to string in JSON
AgentSchema.set('toJSON', {
  transform: (doc, ret: Record<string, any>) => {
    if (ret._id) {
      ret._id = ret._id.toString();
    }
    return ret;
  },
});
