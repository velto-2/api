/**
 * Interface for telephony providers (Twilio, Vonage, etc.)
 * All providers must implement this interface to ensure consistent behavior
 */
export interface CallInitiationOptions {
  toNumber: string;
  testRunId: string;
  webhookUrl: string;
}

export interface CallResponse {
  sid: string;
  status: string;
  to: string;
  from: string;
  direction?: string;
  dateCreated?: Date;
  dateUpdated?: Date;
}

export interface CallInstructionsOptions {
  actionUrl?: string;
  audioUrl?: string;
  record?: boolean;
  maxLength?: number;
  timeout?: number;
}

export interface ITelephonyProvider {
  /**
   * Initialize the provider with configuration
   */
  initialize(): Promise<void>;

  /**
   * Initiate a call to the specified phone number
   */
  initiateCall(options: CallInitiationOptions): Promise<CallResponse>;

  /**
   * Generate call instructions (TwiML for Twilio, NCCO for Vonage, etc.)
   */
  generateCallInstructions(options: CallInstructionsOptions): string;

  /**
   * Get call details by SID
   */
  getCallDetails(callSid: string): Promise<any>;

  /**
   * Get call recordings
   */
  getCallRecordings(callSid: string): Promise<any[]>;

  /**
   * Hang up an active call
   */
  hangupCall(callSid: string): Promise<any>;

  /**
   * Parse webhook payload from provider
   */
  parseWebhookPayload(body: any): {
    callSid: string;
    recordingUrl?: string;
    recordingSid?: string;
    recordingStatus?: string;
    callStatus?: string;
    [key: string]: any;
  };

  /**
   * Get provider name
   */
  getName(): string;
}

