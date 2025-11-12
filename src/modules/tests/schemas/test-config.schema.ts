import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TestConfigDocument = TestConfig & Document;

/**
 * Language object - language-agnostic design
 * Stores language information as data, not structure
 */
@Schema({ _id: false })
export class LanguageObject {
  @Prop({ required: true })
  code: string; // ISO 639-1 code (ar, en, es)

  @Prop({ required: true })
  dialect: string; // dialect code (egyptian, gulf, etc.)

  @Prop({ required: true })
  name: string; // Human-readable name (Arabic, English, etc.)
}

const LanguageObjectSchema = SchemaFactory.createForClass(LanguageObject);

/**
 * TestConfig Schema
 * Represents a test configuration that can be reused for multiple test runs
 */
@Schema({ timestamps: true })
export class TestConfig {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  customerId: string; // Organization/user ID

  @Prop({ required: true, index: true })
  agentId: string; // Agent identifier

  @Prop({ required: true })
  agentEndpoint: string; // Phone number or endpoint to call

  @Prop({ default: 'phone' })
  agentType: string; // 'phone', 'webhook', etc.

  @Prop({ type: LanguageObjectSchema, required: true })
  language: LanguageObject;

  @Prop({ required: true })
  persona: string; // Persona identifier (e.g., 'polite_customer', 'frustrated_customer')

  @Prop({ required: true })
  scenarioTemplate: string; // Scenario description or template

  @Prop({ default: true })
  isActive: boolean;
}

export const TestConfigSchema = SchemaFactory.createForClass(TestConfig);

// Transform ObjectId to string in JSON
TestConfigSchema.set('toJSON', {
  transform: (doc, ret: any) => {
    if (ret._id) {
      ret._id = ret._id.toString();
    }
    return ret;
  },
});

// Indexes for performance
TestConfigSchema.index({ customerId: 1, agentId: 1 });
TestConfigSchema.index({ agentId: 1 });
TestConfigSchema.index({ customerId: 1 });
TestConfigSchema.index({ agentEndpoint: 1 });
TestConfigSchema.index({ 'language.code': 1 });
TestConfigSchema.index({ isActive: 1 });
