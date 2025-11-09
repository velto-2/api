import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ITelephonyProvider,
  CallInitiationOptions,
  CallInstructionsOptions,
} from './providers/telephony-provider.interface';
import { TelephonyProviderFactory } from './providers/telephony-provider.factory';

// Re-export interfaces for backward compatibility
export { CallInitiationOptions };
export interface TwiMLOptions extends CallInstructionsOptions {}

@Injectable()
export class TelephonyService implements OnModuleInit {
  private readonly logger = new Logger(TelephonyService.name);
  private provider: ITelephonyProvider | null = null;

  constructor(
    private configService: ConfigService,
    private providerFactory: TelephonyProviderFactory,
  ) {}

  async onModuleInit() {
    try {
      this.provider = await this.providerFactory.createProvider();
      this.logger.log(
        `Telephony service initialized with provider: ${this.provider.getName()}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize telephony provider: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Initiate a call to the specified phone number
   * Delegates to the configured telephony provider
   */
  async initiateCall(options: CallInitiationOptions): Promise<any> {
    if (!this.provider) {
      throw new Error(
        'Telephony provider not initialized. Check configuration and credentials.',
      );
    }

    try {
      return await this.provider.initiateCall(options);
    } catch (error: any) {
      this.logger.error(
        `Failed to initiate call: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate call instructions (TwiML for Twilio, NCCO for Vonage, etc.)
   * Delegates to the configured telephony provider
   */
  generateTwiML(options: TwiMLOptions = {}): string {
    if (!this.provider) {
      throw new Error(
        'Telephony provider not initialized. Check configuration and credentials.',
      );
    }

    return this.provider.generateCallInstructions(options);
  }

  /**
   * Get call details by SID
   * Delegates to the configured telephony provider
   */
  async getCallDetails(callSid: string): Promise<any> {
    if (!this.provider) {
      throw new Error(
        'Telephony provider not initialized. Check configuration and credentials.',
      );
    }

    try {
      return await this.provider.getCallDetails(callSid);
    } catch (error: any) {
      this.logger.error(
        `Failed to get call details for ${callSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get call recordings
   * Delegates to the configured telephony provider
   */
  async getCallRecordings(callSid: string): Promise<any[]> {
    if (!this.provider) {
      throw new Error(
        'Telephony provider not initialized. Check configuration and credentials.',
      );
    }

    try {
      return await this.provider.getCallRecordings(callSid);
    } catch (error: any) {
      this.logger.error(
        `Failed to get recordings for call ${callSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Hang up an active call
   * Delegates to the configured telephony provider
   */
  async hangupCall(callSid: string): Promise<any> {
    if (!this.provider) {
      throw new Error(
        'Telephony provider not initialized. Check configuration and credentials.',
      );
    }

    try {
      return await this.provider.hangupCall(callSid);
    } catch (error: any) {
      this.logger.error(
        `Failed to hangup call ${callSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Parse webhook payload from provider
   * Delegates to the configured telephony provider
   */
  parseWebhookPayload(body: any): {
    callSid: string;
    recordingUrl?: string;
    recordingSid?: string;
    recordingStatus?: string;
    callStatus?: string;
    [key: string]: any;
  } {
    if (!this.provider) {
      throw new Error(
        'Telephony provider not initialized. Check configuration and credentials.',
      );
    }

    return this.provider.parseWebhookPayload(body);
  }
}
