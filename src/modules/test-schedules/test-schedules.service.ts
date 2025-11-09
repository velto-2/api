import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TestRunsService } from '../test-runs/test-runs.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto';
import { validate } from 'node-cron';

@Injectable()
export class TestSchedulesService {
  private readonly logger = new Logger(TestSchedulesService.name);

  constructor(
    private prisma: PrismaService,
    private testRunsService: TestRunsService,
  ) {}

  async create(organizationId: string, createDto: CreateScheduleDto) {
    // Validate cron expression
    if (!validate(createDto.schedule)) {
      throw new BadRequestException('Invalid cron expression');
    }

    // Calculate next run time
    const nextRunAt = this.calculateNextRun(createDto.schedule, createDto.timezone || 'UTC');

    const schedule = await this.prisma.testSchedule.create({
      data: {
        ...createDto,
        organizationId,
        timezone: createDto.timezone || 'UTC',
        isActive: createDto.isActive ?? true,
        nextRunAt,
      },
    });

    return schedule;
  }

  async findAll(organizationId: string) {
    return this.prisma.testSchedule.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const schedule = await this.prisma.testSchedule.findFirst({
      where: { id, organizationId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async update(id: string, organizationId: string, updateDto: UpdateScheduleDto) {
    if (updateDto.schedule && !validate(updateDto.schedule)) {
      throw new BadRequestException('Invalid cron expression');
    }

    const updateData: any = { ...updateDto };

    // Recalculate next run if schedule changed
    if (updateDto.schedule || updateDto.timezone) {
      const current = await this.findOne(id, organizationId);
      updateData.nextRunAt = this.calculateNextRun(
        updateDto.schedule || current.schedule,
        updateDto.timezone || current.timezone,
      );
    }

    return this.prisma.testSchedule.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.testSchedule.delete({
      where: { id },
    });
  }

  async toggleActive(id: string, organizationId: string) {
    const schedule = await this.findOne(id, organizationId);
    return this.prisma.testSchedule.update({
      where: { id },
      data: {
        isActive: !schedule.isActive,
        nextRunAt: !schedule.isActive ? this.calculateNextRun(schedule.schedule, schedule.timezone) : null,
      },
    });
  }

  // Cron job that runs every minute to check for scheduled tests
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledTests() {
    const now = new Date();
    const schedules = await this.prisma.testSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: {
          lte: now,
        },
      },
    });

    for (const schedule of schedules) {
      try {
        this.logger.log(`Executing scheduled test: ${schedule.name} (${schedule.id})`);
        
        // Create test run
        await this.testRunsService.create({
          testConfigId: schedule.testConfigId,
        });

        // Update schedule
        const nextRunAt = this.calculateNextRun(schedule.schedule, schedule.timezone);
        await this.prisma.testSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            nextRunAt,
            runCount: schedule.runCount + 1,
          },
        });

        this.logger.log(`Scheduled test executed: ${schedule.name}`);
      } catch (error) {
        this.logger.error(`Failed to execute scheduled test ${schedule.id}: ${error.message}`);
      }
    }
  }

  private calculateNextRun(cronExpression: string, timezone: string): Date {
    // Simple calculation - for production, use a proper cron parser with timezone support
    // This is a simplified version
    const now = new Date();
    const nextRun = new Date(now.getTime() + 60000); // Default: 1 minute from now
    // TODO: Implement proper cron parsing with timezone
    return nextRun;
  }
}

