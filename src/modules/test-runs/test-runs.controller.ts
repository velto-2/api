import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { Types } from 'mongoose';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TestRunsService } from './test-runs.service';
import { CreateTestRunDto } from './dto/create-test-run.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Test Runs')
@Controller('test-runs')
export class TestRunsController {
  constructor(private readonly testRunsService: TestRunsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create and execute a test run' })
  @ApiResponse({
    status: 201,
    description: 'Test run created and execution started',
  })
  async create(@Body() createDto: CreateTestRunDto) {
    return this.testRunsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all test runs' })
  @ApiResponse({
    status: 200,
    description: 'List of test runs',
  })
  async findAll() {
    console.log('ddddd');

    return this.testRunsService.findAll();
  }

  @Public()
  @Get('audio/:filename')
  @ApiOperation({ summary: 'Serve audio file for Twilio playback' })
  @ApiResponse({
    status: 200,
    description: 'Audio file',
    content: {
      'audio/mpeg': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  async getAudio(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const audioBuffer = this.testRunsService.getAudioFile(filename);

    if (!audioBuffer) {
      throw new NotFoundException(`Audio file ${filename} not found`);
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.send(audioBuffer);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get test run analytics' })
  @ApiResponse({
    status: 200,
    description: 'Analytics data retrieved successfully',
  })
  async getAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.testRunsService.getAnalytics(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a test run by ID' })
  @ApiResponse({
    status: 200,
    description: 'Test run details',
  })
  @ApiResponse({ status: 404, description: 'Test run not found' })
  async findOne(@Param('id') id: string) {
    // Validate that id is a valid MongoDB ObjectId to avoid route conflicts
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid test run ID: ${id}`);
    }
    return this.testRunsService.findOne(id);
  }
}
