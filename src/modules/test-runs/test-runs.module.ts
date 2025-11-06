import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { TestRunsService } from './test-runs.service';
import { TestRunsController } from './test-runs.controller';
import { TestRun, TestRunSchema } from '../tests/schemas/test-run.schema';
import { TestsModule } from '../tests/tests.module';
import { TelephonyModule } from '../telephony/telephony.module';
import { DigitalHumanModule } from '../digital-human/digital-human.module';
import { SpeechModule } from '../speech/speech.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TestRun.name, schema: TestRunSchema }]),
    HttpModule,
    TestsModule,
    forwardRef(() => TelephonyModule),
    DigitalHumanModule,
    SpeechModule,
  ],
  controllers: [TestRunsController],
  providers: [TestRunsService],
  exports: [TestRunsService],
})
export class TestRunsModule {}
