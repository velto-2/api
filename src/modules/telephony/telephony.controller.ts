import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  Header,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TelephonyService } from './telephony.service';
import { Public } from '../../common/decorators/public.decorator';
import { TestRunsService } from '../test-runs/test-runs.service';

@ApiTags('Telephony')
@Controller('telephony')
export class TelephonyController {
  private readonly logger = new Logger(TelephonyController.name);

  constructor(
    private readonly telephonyService: TelephonyService,
    @Inject(forwardRef(() => TestRunsService))
    private readonly testRunsService: TestRunsService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('webhook/voice')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/xml')
  @ApiOperation({ summary: 'Twilio voice webhook handler' })
  @ApiResponse({
    status: 200,
    description: 'TwiML response',
    content: {
      'text/xml': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  async handleVoiceWebhook(
    @Query('testRunId') testRunId: string,
    @Query('action') action: string,
    @Body() body: any,
  ): Promise<string> {
    this.logger.log(
      `Voice webhook received for test run ${testRunId}, action: ${action}`,
    );

    // Get test run to find current audio URL
    const testRun = await this.testRunsService.findOne(testRunId);
    const audioUrl = testRun?.metadata?.currentAudioUrl;
    const webhookBaseUrl =
      this.configService.get<string>('twilio.webhookBaseUrl') ||
      'http://localhost:3000';

    // Recording callback URL
    const recordingCallbackUrl = `${webhookBaseUrl}/v1/telephony/webhook/recording`;

    if (!audioUrl) {
      this.logger.warn(
        `No audio URL found for test run ${testRunId}, returning empty TwiML`,
      );
      // Return TwiML that just says something
      return this.telephonyService.generateTwiML({
        audioUrl: undefined,
        record: false,
      });
    }

    this.logger.log(`Playing audio URL: ${audioUrl} for test run ${testRunId}`);
    this.logger.log(`Recording callback URL: ${recordingCallbackUrl}`);

    // Generate TwiML that plays audio and records response
    const twiml = this.telephonyService.generateTwiML({
      audioUrl: audioUrl,
      record: true,
      maxLength: 10,
      timeout: 3,
      actionUrl: recordingCallbackUrl, // Twilio will POST recording info here
    });

    this.logger.log(`Generated TwiML: ${twiml.substring(0, 200)}...`);
    return twiml;
  }

  @Public()
  @Post('webhook/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Twilio status callback webhook' })
  async handleStatusCallback(@Body() body: any): Promise<void> {
    this.logger.log(`Call status update: ${JSON.stringify(body)}`);
    // Handle status updates (initiated, ringing, answered, completed)
    // This will update the test run status in the database
  }

  @Public()
  @Post('webhook/recording')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Twilio recording callback webhook' })
  async handleRecordingCallback(@Body() body: any): Promise<void> {
    this.logger.log(`[RECORDING CALLBACK] Received: ${JSON.stringify(body)}`);
    
    // Extract recording information from Twilio webhook
    // Twilio sends different formats depending on the callback type
    const recordingUrl = body.RecordingUrl || body.recordingUrl || body.url;
    const callSid = body.CallSid || body.callSid;
    const recordingSid = body.RecordingSid || body.recordingSid || body.sid;
    const recordingStatus = body.RecordingStatus || body.status;
    
    this.logger.log(
      `[RECORDING CALLBACK] Parsed - URL: ${recordingUrl}, CallSid: ${callSid}, Status: ${recordingStatus}`,
    );
    
    if (!recordingUrl || !callSid) {
      this.logger.warn(
        `[RECORDING CALLBACK] Missing recording URL or CallSid. Body keys: ${Object.keys(body).join(', ')}`,
      );
      return;
    }

    // Only process if recording is completed
    if (recordingStatus && recordingStatus !== 'completed') {
      this.logger.log(
        `[RECORDING CALLBACK] Recording status is ${recordingStatus}, waiting for completion...`,
      );
      return;
    }

    // Find test run by call SID
    try {
      this.logger.log(
        `[RECORDING CALLBACK] Processing recording for call ${callSid}`,
      );
      await this.testRunsService.processAgentRecording(
        callSid,
        recordingUrl,
        recordingSid,
      );
      this.logger.log(`[RECORDING CALLBACK] Successfully processed recording`);
    } catch (error) {
      this.logger.error(
        `[RECORDING CALLBACK] Failed to process recording: ${error.message}`,
        error.stack,
      );
    }
  }

  @Get('calls/:callSid')
  @ApiOperation({ summary: 'Get call details by SID' })
  @ApiResponse({ status: 200, description: 'Call details' })
  async getCallDetails(@Param('callSid') callSid: string) {
    return this.telephonyService.getCallDetails(callSid);
  }

  @Get('calls/:callSid/recordings')
  @ApiOperation({ summary: 'Get recordings for a call' })
  @ApiResponse({ status: 200, description: 'List of recordings' })
  async getCallRecordings(@Param('callSid') callSid: string) {
    return this.telephonyService.getCallRecordings(callSid);
  }
}


