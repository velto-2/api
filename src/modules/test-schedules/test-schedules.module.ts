import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TestSchedulesService } from './test-schedules.service';
import { TestSchedulesController } from './test-schedules.controller';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { TestRunsModule } from '../test-runs/test-runs.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    TestRunsModule,
    RbacModule,
  ],
  controllers: [TestSchedulesController],
  providers: [TestSchedulesService],
  exports: [TestSchedulesService],
})
export class TestSchedulesModule {}

