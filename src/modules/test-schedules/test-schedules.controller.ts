import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TestSchedulesService } from './test-schedules.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Test Schedules')
@ApiBearerAuth()
@Controller('test-schedules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TestSchedulesController {
  constructor(private readonly schedulesService: TestSchedulesService) {}

  @Post()
  @RequirePermissions('TEST_RUN.EXECUTE')
  @ApiOperation({ summary: 'Create a test schedule' })
  async create(
    @Body() createDto: CreateScheduleDto,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.schedulesService.create(organizationId, createDto);
  }

  @Get()
  @RequirePermissions('TEST_RUN.READ')
  @ApiOperation({ summary: 'Get all test schedules' })
  async findAll(@CurrentOrganization() organizationId: string) {
    return this.schedulesService.findAll(organizationId);
  }

  @Get(':id')
  @RequirePermissions('TEST_RUN.READ')
  @ApiOperation({ summary: 'Get a test schedule by ID' })
  async findOne(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.schedulesService.findOne(id, organizationId);
  }

  @Patch(':id')
  @RequirePermissions('TEST_RUN.UPDATE')
  @ApiOperation({ summary: 'Update a test schedule' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateScheduleDto,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.schedulesService.update(id, organizationId, updateDto);
  }

  @Patch(':id/toggle')
  @RequirePermissions('TEST_RUN.UPDATE')
  @ApiOperation({ summary: 'Toggle schedule active status' })
  async toggleActive(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.schedulesService.toggleActive(id, organizationId);
  }

  @Delete(':id')
  @RequirePermissions('TEST_RUN.DELETE')
  @ApiOperation({ summary: 'Delete a test schedule' })
  async remove(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    return this.schedulesService.remove(id, organizationId);
  }
}

