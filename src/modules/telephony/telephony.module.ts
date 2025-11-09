import { Module, forwardRef } from '@nestjs/common';
import { TelephonyService } from './telephony.service';
import { TelephonyController } from './telephony.controller';
import { TelephonyProviderFactory } from './providers/telephony-provider.factory';
import { TwilioProvider } from './providers/twilio.provider';
import { VonageProvider } from './providers/vonage.provider';
import { TestRunsModule } from '../test-runs/test-runs.module';

@Module({
  imports: [forwardRef(() => TestRunsModule)],
  providers: [
    TelephonyService,
    TelephonyProviderFactory,
    TwilioProvider,
    VonageProvider,
  ],
  controllers: [TelephonyController],
  exports: [TelephonyService],
})
export class TelephonyModule {}


