import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ITelephonyProvider,
  CallInitiationOptions,
  CallResponse,
  CallInstructionsOptions,
} from './telephony-provider.interface';

// Vonage SDK will be imported here once installed
// import { Vonage } from '@vonage/server-sdk';

@Injectable()
export class VonageProvider implements ITelephonyProvider {
  private readonly logger = new Logger(VonageProvider.name);
  private vonageClient: any = null; // Will be Vonage type once SDK is installed
  private fromNumber: string | null = null;
  private webhookBaseUrl: string;
  private applicationId: string | null = null;

  constructor(private configService: ConfigService) {
    this.webhookBaseUrl =
      this.configService.get<string>('vonage.webhookBaseUrl') ||
      'http://localhost:3000';
  }

  getName(): string {
    return 'vonage';
  }

  async initialize(): Promise<void> {
    const apiKey = this.configService.get<string>('vonage.apiKey');
    const apiSecret = this.configService.get<string>('vonage.apiSecret');
    this.fromNumber = this.configService.get<string>('vonage.phoneNumber') || null;
    this.applicationId = this.configService.get<string>('vonage.applicationId') || null;

    if (!apiKey || !apiSecret) {
      this.logger.warn(
        'Vonage credentials not found. Vonage provider will not work.',
      );
      return;
    }

    try {
      // Dynamic import to avoid errors if package not installed
      const { Vonage } = await import('@vonage/server-sdk');
      this.vonageClient = new Vonage({
        apiKey,
        apiSecret,
      });
      this.logger.log('Vonage provider initialized');
    } catch (error) {
      this.logger.error(
        'Failed to initialize Vonage SDK. Make sure @vonage/server-sdk is installed.',
        error,
      );
      throw new Error(
        'Vonage SDK not installed. Run: npm install @vonage/server-sdk',
      );
    }
  }

  async initiateCall(options: CallInitiationOptions): Promise<CallResponse> {
    const simulateCalls = this.configService.get<boolean>('vonage.simulateCalls');

    // If simulation mode is enabled, return a mock call
    if (simulateCalls) {
      this.logger.warn(
        `[SIMULATION MODE] Simulating call to ${options.toNumber} for test run ${options.testRunId}. ` +
          `No real call will be made. Webhooks will not be called. ` +
          `To make real calls, set VONAGE_SIMULATE_CALLS=false in .env`,
      );

      return {
        sid: `VONAGE${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        status: 'ringing',
        to: options.toNumber,
        from: this.fromNumber || '+15555555555',
        direction: 'outbound',
        dateCreated: new Date(),
        dateUpdated: new Date(),
      };
    }

    if (!this.vonageClient) {
      throw new Error('Vonage client not initialized. Check credentials.');
    }

    if (!this.fromNumber) {
      throw new Error('Vonage phone number not configured');
    }

    if (!this.applicationId) {
      throw new Error(
        'Vonage Application ID not configured. You need to create a Voice API application in Vonage dashboard.',
      );
    }

    try {
      // Vonage uses NCCO (Nexmo Call Control Object) for call instructions
      // The webhook URL will return NCCO when called
      const call = await this.vonageClient.voice.createOutboundCall({
        to: [
          {
            type: 'phone',
            number: options.toNumber,
          },
        ],
        from: {
          type: 'phone',
          number: this.fromNumber,
        },
        answer_url: [options.webhookUrl], // Vonage will GET this URL for NCCO
        event_url: [
          `${this.webhookBaseUrl}/v1/telephony/webhook/status?testRunId=${options.testRunId}`,
        ],
      });

      this.logger.log(
        `Call initiated: ${call.uuid} to ${options.toNumber} for test run ${options.testRunId}`,
      );

      return {
        sid: call.uuid,
        status: call.status || 'ringing',
        to: options.toNumber,
        from: this.fromNumber,
        direction: 'outbound',
        dateCreated: new Date(),
        dateUpdated: new Date(),
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to initiate call: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  generateCallInstructions(options: CallInstructionsOptions = {}): string {
    // Vonage uses NCCO (Nexmo Call Control Object) - JSON format
    const ncco: any[] = [];

    // If audio URL is provided, stream it
    if (options.audioUrl) {
      ncco.push({
        action: 'stream',
        streamUrl: [options.audioUrl],
      });
    }

    // If record is enabled, record the response
    if (options.record) {
      ncco.push({
        action: 'record',
        eventUrl: [options.actionUrl || ''],
        maxLength: options.maxLength || 10,
        timeout: options.timeout || 3,
        beepStart: true,
      });
    } else {
      // If no recording, just pause briefly
      ncco.push({
        action: 'talk',
        text: ' ', // Empty talk to pause
      });
    }

    // If action URL is provided and not recording, redirect
    if (options.actionUrl && !options.record) {
      ncco.push({
        action: 'stream',
        streamUrl: [options.actionUrl],
      });
    }

    // Return as JSON string (Vonage expects JSON, not XML like Twilio)
    return JSON.stringify(ncco);
  }

  async getCallDetails(callSid: string): Promise<any> {
    if (!this.vonageClient) {
      throw new Error('Vonage client not initialized. Check credentials.');
    }

    try {
      const call = await this.vonageClient.voice.getCall(callSid);
      return call;
    } catch (error: any) {
      this.logger.error(
        `Failed to get call details for ${callSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getCallRecordings(callSid: string): Promise<any[]> {
    if (!this.vonageClient) {
      throw new Error('Vonage client not initialized. Check credentials.');
    }

    try {
      // Vonage recordings are accessed differently
      const recordings = await this.vonageClient.voice.getRecording(callSid);
      return Array.isArray(recordings) ? recordings : [recordings];
    } catch (error: any) {
      this.logger.error(
        `Failed to get recordings for call ${callSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async hangupCall(callSid: string): Promise<any> {
    if (!this.vonageClient) {
      throw new Error('Vonage client not initialized. Check credentials.');
    }

    try {
      const call = await this.vonageClient.voice.updateCall(callSid, {
        action: 'hangup',
      });
      return call;
    } catch (error: any) {
      this.logger.error(
        `Failed to hangup call ${callSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  parseWebhookPayload(body: any): {
    callSid: string;
    recordingUrl?: string;
    recordingSid?: string;
    recordingStatus?: string;
    callStatus?: string;
    [key: string]: any;
  } {
    // Vonage webhook format is different from Twilio
    return {
      callSid: body.uuid || body.call_uuid || body.conversation_uuid || '',
      recordingUrl: body.recording_url || body.url,
      recordingSid: body.recording_uuid || body.recording_id,
      recordingStatus: body.status || body.recording_status,
      callStatus: body.status || body.call_status,
      ...body,
    };
  }
}

