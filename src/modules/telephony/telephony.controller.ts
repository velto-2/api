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
  Res,
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
  @ApiOperation({ summary: 'Voice webhook handler (supports Twilio and Vonage)' })
  @ApiResponse({
    status: 200,
    description: 'Call instructions (TwiML for Twilio, NCCO for Vonage)',
  })
  async handleVoiceWebhook(
    @Query('testRunId') testRunId: string,
    @Query('action') action: string,
    @Body() body: any,
    @Res() res: any,
  ): Promise<void> {
    this.logger.log(
      `Voice webhook received for test run ${testRunId}, action: ${action}`,
    );

    // Get test run to find current audio URL
    const testRun = await this.testRunsService.findOne(testRunId);
    const audioUrl = testRun?.metadata?.currentAudioUrl;
    
    // Get provider name to determine content type
    const providerName = this.configService.get<string>('telephony.provider') || 'twilio';
    const webhookBaseUrl =
      this.configService.get<string>(`${providerName}.webhookBaseUrl`) ||
      this.configService.get<string>('twilio.webhookBaseUrl') ||
      'http://localhost:3000';

    // Recording callback URL
    const recordingCallbackUrl = `${webhookBaseUrl}/v1/telephony/webhook/recording`;

    if (!audioUrl) {
      this.logger.warn(
        `No audio URL found for test run ${testRunId}, returning empty instructions`,
      );
      const instructions = this.telephonyService.generateTwiML({
        audioUrl: undefined,
        record: false,
      });
      
      // Set content type based on provider
      if (providerName === 'vonage') {
        res.setHeader('Content-Type', 'application/json');
        res.send(instructions);
      } else {
        res.setHeader('Content-Type', 'text/xml');
        res.send(instructions);
      }
      return;
    }

    this.logger.log(`Playing audio URL: ${audioUrl} for test run ${testRunId}`);
    this.logger.log(`Recording callback URL: ${recordingCallbackUrl}`);

    // Generate call instructions (TwiML for Twilio, NCCO for Vonage)
    const instructions = this.telephonyService.generateTwiML({
      audioUrl: audioUrl,
      record: true,
      maxLength: 10,
      timeout: 3,
      actionUrl: recordingCallbackUrl,
    });

    // Set content type based on provider
    if (providerName === 'vonage') {
      res.setHeader('Content-Type', 'application/json');
      this.logger.log(`Generated NCCO: ${instructions.substring(0, 200)}...`);
    } else {
      res.setHeader('Content-Type', 'text/xml');
      this.logger.log(`Generated TwiML: ${instructions.substring(0, 200)}...`);
    }
    
    res.send(instructions);
  }

  @Public()
  @Post('webhook/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Status callback webhook (supports Twilio and Vonage)' })
  async handleStatusCallback(@Body() body: any): Promise<void> {
    this.logger.log(`Call status update: ${JSON.stringify(body)}`);
    // Handle status updates (initiated, ringing, answered, completed)
    // This will update the test run status in the database
    // Provider-specific parsing is handled by parseWebhookPayload
  }

  @Public()
  @Post('webhook/recording')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recording callback webhook (supports Twilio and Vonage)' })
  async handleRecordingCallback(@Body() body: any): Promise<void> {
    this.logger.log(`[RECORDING CALLBACK] Received: ${JSON.stringify(body)}`);
    
    // Use provider's parseWebhookPayload to extract information
    const parsed = this.telephonyService.parseWebhookPayload(body);
    const { callSid, recordingUrl, recordingSid, recordingStatus } = parsed;
    
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
    } catch (error: any) {
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


