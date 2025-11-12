import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AgentKnowledgeBaseService } from './services/agent-knowledge-base.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('agent-knowledge-base')
@Controller('agent-knowledge-base')
@Public()
export class AgentKnowledgeBaseController {
  constructor(
    private readonly knowledgeBaseService: AgentKnowledgeBaseService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create or update knowledge base for an agent' })
  async createOrUpdate(
    @Body() dto: CreateKnowledgeBaseDto,
    @Query('customerId') customerId?: string,
  ) {
    const finalCustomerId = customerId || 'default-customer';
    return this.knowledgeBaseService.createOrUpdate(finalCustomerId, dto.agentId, {
      expectedJobs: dto.expectedJobs,
      language: dto.language,
      notes: dto.notes,
    });
  }

  @Get(':agentId')
  @ApiOperation({ summary: 'Get knowledge base for an agent' })
  async getByAgentId(@Param('agentId') agentId: string) {
    const knowledgeBase = await this.knowledgeBaseService.findByAgentId(agentId);
    if (!knowledgeBase) {
      throw new HttpException(
        `Knowledge base for agent ${agentId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    return knowledgeBase;
  }

  @Get()
  @ApiOperation({ summary: 'List knowledge bases for a customer' })
  async list(@Query('customerId') customerId?: string) {
    const finalCustomerId = customerId || 'default-customer';
    return this.knowledgeBaseService.findByCustomerId(finalCustomerId);
  }

  @Delete(':agentId')
  @ApiOperation({ summary: 'Delete knowledge base for an agent' })
  async delete(@Param('agentId') agentId: string) {
    await this.knowledgeBaseService.delete(agentId);
    return { message: 'Knowledge base deleted successfully' };
  }

  @Post(':agentId/jobs')
  @ApiOperation({ summary: 'Add or update a job in knowledge base' })
  async addJob(
    @Param('agentId') agentId: string,
    @Body() job: {
      id: string;
      name: string;
      description?: string;
      completionIndicators?: string[];
      requiredSteps?: string[];
    },
  ) {
    return this.knowledgeBaseService.addJob(agentId, job);
  }

  @Delete(':agentId/jobs/:jobId')
  @ApiOperation({ summary: 'Remove a job from knowledge base' })
  async removeJob(
    @Param('agentId') agentId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.knowledgeBaseService.removeJob(agentId, jobId);
  }
}

