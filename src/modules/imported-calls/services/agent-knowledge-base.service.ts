import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AgentKnowledgeBase,
  AgentKnowledgeBaseDocument,
} from '../schemas/agent-knowledge-base.schema';

@Injectable()
export class AgentKnowledgeBaseService {
  private readonly logger = new Logger(AgentKnowledgeBaseService.name);

  constructor(
    @InjectModel(AgentKnowledgeBase.name)
    private knowledgeBaseModel: Model<AgentKnowledgeBaseDocument>,
  ) {}

  async createOrUpdate(
    customerId: string,
    agentId: string,
    data: {
      expectedJobs?: any[];
      language?: string;
      notes?: string;
    },
  ): Promise<AgentKnowledgeBaseDocument> {
    const existing = await this.knowledgeBaseModel.findOne({ agentId });

    if (existing) {
      existing.expectedJobs = data.expectedJobs || existing.expectedJobs;
      existing.language = data.language || existing.language;
      existing.notes = data.notes !== undefined ? data.notes : existing.notes;
      return existing.save();
    }

    const knowledgeBase = new this.knowledgeBaseModel({
      customerId,
      agentId,
      expectedJobs: data.expectedJobs || [],
      language: data.language || 'en',
      notes: data.notes,
    });

    return knowledgeBase.save();
  }

  async findByAgentId(agentId: string): Promise<AgentKnowledgeBaseDocument | null> {
    return this.knowledgeBaseModel.findOne({ agentId }).exec();
  }

  async findByCustomerId(customerId: string): Promise<AgentKnowledgeBaseDocument[]> {
    return this.knowledgeBaseModel.find({ customerId }).exec();
  }

  async delete(agentId: string): Promise<void> {
    const result = await this.knowledgeBaseModel.deleteOne({ agentId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Knowledge base for agent ${agentId} not found`);
    }
  }

  async addJob(
    agentId: string,
    job: {
      id: string;
      name: string;
      description?: string;
      completionIndicators?: string[];
      requiredSteps?: string[];
    },
  ): Promise<AgentKnowledgeBaseDocument> {
    const knowledgeBase = await this.findByAgentId(agentId);
    if (!knowledgeBase) {
      throw new NotFoundException(`Knowledge base for agent ${agentId} not found`);
    }

    const existingIndex = knowledgeBase.expectedJobs.findIndex((j) => j.id === job.id);
    if (existingIndex >= 0) {
      knowledgeBase.expectedJobs[existingIndex] = job as any;
    } else {
      knowledgeBase.expectedJobs.push(job as any);
    }

    return knowledgeBase.save();
  }

  async removeJob(agentId: string, jobId: string): Promise<AgentKnowledgeBaseDocument> {
    const knowledgeBase = await this.findByAgentId(agentId);
    if (!knowledgeBase) {
      throw new NotFoundException(`Knowledge base for agent ${agentId} not found`);
    }

    knowledgeBase.expectedJobs = knowledgeBase.expectedJobs.filter(
      (j) => j.id !== jobId,
    );

    return knowledgeBase.save();
  }
}

