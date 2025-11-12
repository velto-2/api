import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto, UpdateAgentDto } from './dto/create-agent.dto';
import { AgentQueryDto } from './dto/agent-query.dto';
@ApiTags('Agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new agent' })
  @ApiResponse({
    status: 201,
    description: 'Agent created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createDto: CreateAgentDto) {
    return this.agentsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all agents' })
  @ApiResponse({
    status: 200,
    description: 'List of agents',
  })
  findAll(@Query() query: AgentQueryDto) {
    return this.agentsService.findAll(query);
  }

  @Get(':customerId/:agentId')
  @ApiOperation({ summary: 'Get an agent by customer ID and agent ID' })
  @ApiResponse({
    status: 200,
    description: 'Agent found',
  })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  findOne(
    @Param('customerId') customerId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.agentsService.findOne(customerId, agentId);
  }

  @Patch(':customerId/:agentId')
  @ApiOperation({ summary: 'Update an agent' })
  @ApiResponse({
    status: 200,
    description: 'Agent updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  update(
    @Param('customerId') customerId: string,
    @Param('agentId') agentId: string,
    @Body() updateDto: UpdateAgentDto,
  ) {
    return this.agentsService.update(customerId, agentId, updateDto);
  }

  @Delete(':customerId/:agentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an agent (soft delete)' })
  @ApiResponse({
    status: 204,
    description: 'Agent deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  remove(
    @Param('customerId') customerId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.agentsService.delete(customerId, agentId);
  }
}
