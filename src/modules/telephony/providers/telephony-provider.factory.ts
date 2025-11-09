import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ITelephonyProvider } from './telephony-provider.interface';
import { TwilioProvider } from './twilio.provider';
import { VonageProvider } from './vonage.provider';

@Injectable()
export class TelephonyProviderFactory {
  private readonly logger = new Logger(TelephonyProviderFactory.name);

  constructor(private configService: ConfigService) {}

  /**
   * Create a telephony provider based on configuration
   */
  async createProvider(): Promise<ITelephonyProvider> {
    const providerName =
      this.configService.get<string>('telephony.provider') || 'twilio';

    this.logger.log(`Creating telephony provider: ${providerName}`);

    let provider: ITelephonyProvider;

    switch (providerName.toLowerCase()) {
      case 'twilio':
        provider = new TwilioProvider(this.configService);
        break;
      case 'vonage':
        provider = new VonageProvider(this.configService);
        break;
      default:
        this.logger.warn(
          `Unknown provider "${providerName}", defaulting to Twilio`,
        );
        provider = new TwilioProvider(this.configService);
    }

    // Initialize the provider
    await provider.initialize();

    return provider;
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): string[] {
    return ['twilio', 'vonage'];
  }
}

