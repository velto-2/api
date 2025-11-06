import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';

export interface CallInitiationOptions {
  toNumber: string;
  testRunId: string;
  webhookUrl: string;
}

export interface TwiMLOptions {
  actionUrl?: string;
  audioUrl?: string;
  record?: boolean;
  maxLength?: number;
  timeout?: number;
}

@Injectable()
export class TelephonyService {
  private readonly logger = new Logger(TelephonyService.name);
  private readonly twilioClient: twilio.Twilio | null = null;

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get<string>('twilio.accountSid');
    const authToken = this.configService.get<string>('twilio.authToken');

    if (!accountSid || !authToken) {
      this.logger.warn(
        'Twilio credentials not found. Telephony features will not work.',
      );
    } else {
      this.twilioClient = new twilio.Twilio(accountSid, authToken);
    }
  }

  /**
   * Initiate a call to the specified phone number
   * In simulation mode, returns a mock call object without making a real call
   */
  async initiateCall(options: CallInitiationOptions): Promise<any> {
    const simulateCalls = this.configService.get<boolean>('twilio.simulateCalls');
    
    // If simulation mode is enabled, return a mock call
    if (simulateCalls) {
      this.logger.warn(
        `[SIMULATION MODE] Simulating call to ${options.toNumber} for test run ${options.testRunId}. ` +
        `No real call will be made. Webhooks will not be called. ` +
        `To make real calls, set TWILIO_SIMULATE_CALLS=false in .env`,
      );
      
      // Return a mock call object that matches Twilio's call structure
      return {
        sid: `CA${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        status: 'ringing',
        to: options.toNumber,
        from: this.configService.get<string>('twilio.phoneNumber') || '+15555555555',
        direction: 'outbound-api',
        dateCreated: new Date(),
        dateUpdated: new Date(),
      };
    }

    const fromNumber = this.configService.get<string>('twilio.phoneNumber');

    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized. Check credentials.');
    }

    if (!fromNumber) {
      throw new Error('Twilio phone number not configured');
    }

    try {
      // Construct status callback URL properly
      // webhookUrl is like: http://example.com/v1/telephony/webhook/voice?testRunId=123
      // statusCallback should be: http://example.com/v1/telephony/webhook/status?testRunId=123
      const webhookUrlObj = new URL(options.webhookUrl);
      const statusCallbackUrl = `${webhookUrlObj.origin}/v1/telephony/webhook/status${webhookUrlObj.search}`;

      this.logger.log(
        `Creating call with webhook: ${options.webhookUrl}, statusCallback: ${statusCallbackUrl}`,
      );

      const call = await this.twilioClient.calls.create({
        to: options.toNumber,
        from: fromNumber,
        url: options.webhookUrl,
        statusCallback: statusCallbackUrl,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        record: false, // We'll handle recording via TwiML
      });

      this.logger.log(
        `Call initiated: ${call.sid} to ${options.toNumber} for test run ${options.testRunId}`,
      );

      return call;
    } catch (error: any) {
      // Check if it's an unverified number error (trial account limitation)
      if (error.message?.includes('unverified') || error.code === 21211) {
        const helpfulError = new Error(
          `The phone number ${options.toNumber} is not verified in your Twilio account. ` +
          `Trial accounts can only call verified numbers. ` +
          `To verify this number, go to: https://console.twilio.com/us1/develop/phone-numbers/manage/verified ` +
          `Click "Add a new number" and verify ${options.toNumber} via SMS or call. ` +
          `Alternatively, enable simulation mode by setting TWILIO_SIMULATE_CALLS=true in your .env file for free testing without verification.`
        );
        this.logger.error(helpfulError.message);
        throw helpfulError;
      }
      
      // Check if it's a geo-permissions error and provide helpful message
      if (error.message?.includes('not authorized to call') || error.message?.includes('geo-permissions')) {
        const helpfulError = new Error(
          `Twilio account not authorized to call ${options.toNumber}. ` +
          `Enable geo-permissions in Twilio Console: https://www.twilio.com/console/voice/calls/geo-permissions/low-risk. ` +
          `Alternatively, enable simulation mode by setting TWILIO_SIMULATE_CALLS=true in your .env file for free testing.`
        );
        this.logger.error(helpfulError.message);
        throw helpfulError;
      }
      
      this.logger.error(
        `Failed to initiate call: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate TwiML for call handling
   */
  generateTwiML(options: TwiMLOptions = {}): string {
    const twiml = new twilio.twiml.VoiceResponse();

    // If audio URL is provided, play it
    if (options.audioUrl) {
      twiml.play(options.audioUrl);
    }

    // If record is enabled, record the response
    if (options.record) {
      twiml.record({
        maxLength: options.maxLength || 10,
        timeout: options.timeout || 3,
        action: options.actionUrl, // URL to POST recording status
        recordingStatusCallback: options.actionUrl, // URL to POST recording URL when ready
        finishOnKey: '#',
        transcribe: false, // We'll handle transcription separately
      });
    } else {
      // If no recording, just pause briefly
      twiml.pause({ length: 1 });
    }

    // Redirect to next step if action URL is provided
    if (options.actionUrl && !options.record) {
      twiml.redirect(options.actionUrl);
    }

    return twiml.toString();
  }

  /**
   * Get call details by SID
   */
  async getCallDetails(callSid: string): Promise<any> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized. Check credentials.');
    }

    try {
      const call = await this.twilioClient.calls(callSid).fetch();
      return call;
    } catch (error) {
      this.logger.error(
        `Failed to get call details for ${callSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get call recordings
   */
  async getCallRecordings(callSid: string): Promise<any[]> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized. Check credentials.');
    }

    try {
      const recordings = await this.twilioClient
        .calls(callSid)
        .recordings.list();
      return recordings;
    } catch (error) {
      this.logger.error(
        `Failed to get recordings for call ${callSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Hang up an active call
   */
  async hangupCall(callSid: string): Promise<any> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized. Check credentials.');
    }

    try {
      const call = await this.twilioClient.calls(callSid).update({
        status: 'completed',
      });
      return call;
    } catch (error) {
      this.logger.error(
        `Failed to hangup call ${callSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
