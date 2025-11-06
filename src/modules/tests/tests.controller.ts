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
import { TestsService } from './tests.service';
import { CreateTestConfigDto, UpdateTestConfigDto, TestConfigQueryDto } from './dto';

@ApiTags('Tests')
@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new test configuration' })
  @ApiResponse({
    status: 201,
    description: 'Test configuration created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createDto: CreateTestConfigDto) {
    return this.testsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all test configurations' })
  @ApiResponse({
    status: 200,
    description: 'List of test configurations',
  })
  findAll(@Query() query: TestConfigQueryDto) {
    return this.testsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a test configuration by ID' })
  @ApiResponse({
    status: 200,
    description: 'Test configuration found',
  })
  @ApiResponse({ status: 404, description: 'Test configuration not found' })
  findOne(@Param('id') id: string) {
    return this.testsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a test configuration' })
  @ApiResponse({
    status: 200,
    description: 'Test configuration updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Test configuration not found' })
  update(@Param('id') id: string, @Body() updateDto: UpdateTestConfigDto) {
    return this.testsService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a test configuration' })
  @ApiResponse({
    status: 204,
    description: 'Test configuration deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Test configuration not found' })
  remove(@Param('id') id: string) {
    return this.testsService.remove(id);
  }
}


