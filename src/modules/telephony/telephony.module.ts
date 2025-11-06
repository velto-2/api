import { Module, forwardRef } from '@nestjs/common';
import { TelephonyService } from './telephony.service';
import { TelephonyController } from './telephony.controller';
import { TestRunsModule } from '../test-runs/test-runs.module';

@Module({
  imports: [forwardRef(() => TestRunsModule)],
  providers: [TelephonyService],
  controllers: [TelephonyController],
  exports: [TelephonyService],
})
export class TelephonyModule {}


