import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agent, AgentDocument } from './schemas/agent.schema';
import { CreateAgentDto, UpdateAgentDto } from './dto/create-agent.dto';
import { AgentQueryDto } from './dto/agent-query.dto';

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name)
    private agentModel: Model<AgentDocument>,
  ) {}

  async create(createDto: CreateAgentDto): Promise<AgentDocument> {
    // Check if agent with same customerId + agentId already exists
    const existing = await this.agentModel.findOne({
      customerId: createDto.customerId,
      agentId: createDto.agentId,
      deletedAt: null,
    });

    if (existing) {
      throw new BadRequestException(
        `Agent with ID "${createDto.agentId}" already exists for this customer`,
      );
    }

    const agent = new this.agentModel({
      ...createDto,
      type: createDto.type || 'phone',
      language: createDto.language || 'en',
      isActive: createDto.isActive !== undefined ? createDto.isActive : true,
    });

    return agent.save();
  }

  async findAll(query: AgentQueryDto): Promise<AgentDocument[]> {
    const filter: any = {
      deletedAt: null,
    };

    if (query.customerId) {
      filter.customerId = query.customerId;
    }

    if (query.agentId) {
      filter.agentId = query.agentId;
    }

    if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
    }

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { agentId: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    return this.agentModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(customerId: string, agentId: string): Promise<AgentDocument> {
    const agent = await this.agentModel.findOne({
      customerId,
      agentId,
      deletedAt: null,
    });

    if (!agent) {
      throw new NotFoundException(
        `Agent with ID "${agentId}" not found for customer "${customerId}"`,
      );
    }

    return agent;
  }

  async update(
    customerId: string,
    agentId: string,
    updateDto: UpdateAgentDto,
  ): Promise<AgentDocument> {
    const agent = await this.findOne(customerId, agentId);

    Object.assign(agent, updateDto);
    return agent.save();
  }

  async delete(customerId: string, agentId: string): Promise<void> {
    const agent = await this.findOne(customerId, agentId);
    agent.deletedAt = new Date();
    await agent.save();
  }

  async hardDelete(customerId: string, agentId: string): Promise<void> {
    const result = await this.agentModel.deleteOne({
      customerId,
      agentId,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `Agent with ID "${agentId}" not found for customer "${customerId}"`,
      );
    }
  }
}


