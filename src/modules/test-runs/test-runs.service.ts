import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TestRun, TestRunDocument } from '../tests/schemas/test-run.schema';
import { TestsService } from '../tests/tests.service';
import { TelephonyService } from '../telephony/telephony.service';
import { DigitalHumanService } from '../digital-human/digital-human.service';
import { SpeechService } from '../speech/services/speech.service';
import { TTSService } from '../speech/services/tts.service';
import { CreateTestRunDto } from './dto/create-test-run.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TestRunsService {
  private readonly logger = new Logger(TestRunsService.name);
  // In-memory storage for audio files (key: filename, value: audio buffer)
  private readonly audioStorage = new Map<string, Buffer>();

  /**
   * Helper to convert ObjectIds to strings in a plain object
   */
  private convertObjectIdsToStrings(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Types.ObjectId) {
      return obj.toString();
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertObjectIdsToStrings(item));
    }

    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (value instanceof Types.ObjectId) {
          result[key] = value.toString();
        } else if (
          value &&
          typeof value === 'object' &&
          !(value instanceof Date)
        ) {
          result[key] = this.convertObjectIdsToStrings(value);
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  }

  constructor(
    @InjectModel(TestRun.name)
    private testRunModel: Model<TestRunDocument>,
    private testsService: TestsService,
    private telephonyService: TelephonyService,
    private digitalHumanService: DigitalHumanService,
    private speechService: SpeechService,
    private ttsService: TTSService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  async create(dto: CreateTestRunDto): Promise<TestRunDocument> {
    // Verify test config exists
    const testConfig = await this.testsService.findOne(dto.testConfigId);

    // Create test run
    const testRun = new this.testRunModel({
      testConfigId: dto.testConfigId,
      status: 'pending',
      transcripts: [],
      startedAt: new Date(),
    });

    const savedTestRun = await testRun.save();

    // Execute test asynchronously
    const testRunId = String(savedTestRun._id);
    this.executeTest(testRunId).catch((error) => {
      this.logger.error(
        `Test execution failed for ${testRunId}: ${error.message}`,
        error.stack,
      );
      this.updateTestRunStatus(testRunId, 'failed', {
        error: error.message,
      });
    });

    // Return document - ensure testConfigId is serialized as string
    const json: any = savedTestRun.toJSON
      ? savedTestRun.toJSON()
      : savedTestRun;
    // Convert all ObjectIds to strings recursively
    const converted = this.convertObjectIdsToStrings(json);
    return converted as TestRunDocument;
  }

  async findOne(id: string): Promise<TestRunDocument> {
    const testRun = await this.testRunModel.findById(id).lean().exec();

    if (!testRun) {
      throw new NotFoundException(`Test run with ID ${id} not found`);
    }

    // Convert all ObjectIds to strings recursively
    const json = this.convertObjectIdsToStrings(testRun);

    return json as TestRunDocument;
  }

  async findAll(): Promise<TestRunDocument[]> {
    const testRuns = await this.testRunModel
      .find()
      .lean()
      .sort({ createdAt: -1 })
      .exec();

    // Convert all ObjectIds to strings recursively for each test run
    return testRuns.map((run: any) => {
      return this.convertObjectIdsToStrings(run) as TestRunDocument;
    }) as TestRunDocument[];
  }

  async getAnalytics(query: {
    dateFrom?: string;
    dateTo?: string;
    testConfigId?: string;
  }) {
    const filter: any = {};

    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {};
      if (query.dateFrom) {
        filter.createdAt.$gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        filter.createdAt.$lte = new Date(query.dateTo);
      }
    }

    if (query.testConfigId) {
      filter.testConfigId = new Types.ObjectId(query.testConfigId);
    }

    const testRuns = await this.testRunModel.find(filter).lean().exec();

    const totalRuns = testRuns.length;
    const completedRuns = testRuns.filter((r) => r.status === 'completed').length;
    const failedRuns = testRuns.filter((r) => r.status === 'failed').length;
    const pendingRuns = testRuns.filter((r) => r.status === 'pending').length;
    const runningRuns = testRuns.filter((r) => r.status === 'running').length;

    const successRate =
      totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0;

    // Calculate average scores
    const scores = testRuns
      .map((r) => r.evaluation?.overallScore)
      .filter((s) => s !== undefined && s !== null) as number[];
    const averageScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

    // Calculate average latency
    const latencies = testRuns
      .map((r) => r.evaluation?.averageLatency)
      .filter((l) => l !== undefined && l !== null) as number[];
    const averageLatency =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

    // Grade distribution
    const gradeDistribution = {
      A: testRuns.filter((r) => r.evaluation?.grade === 'A').length,
      B: testRuns.filter((r) => r.evaluation?.grade === 'B').length,
      C: testRuns.filter((r) => r.evaluation?.grade === 'C').length,
      D: testRuns.filter((r) => r.evaluation?.grade === 'D').length,
      F: testRuns.filter((r) => r.evaluation?.grade === 'F').length,
    };

    // Group by date for trends
    const dateGroups = new Map<string, any>();
    testRuns.forEach((run: any) => {
      const createdAt = run.createdAt || run.startedAt || new Date();
      const date = new Date(createdAt).toISOString().split('T')[0];
      if (!dateGroups.has(date)) {
        dateGroups.set(date, {
          date,
          testRuns: 0,
          completed: 0,
          failed: 0,
          averageScore: 0,
          averageLatency: 0,
          scores: [],
          latencies: [],
        });
      }
      const group = dateGroups.get(date)!;
      group.testRuns++;
      if (run.status === 'completed') group.completed++;
      if (run.status === 'failed') group.failed++;
      if (run.evaluation?.overallScore) {
        group.scores.push(run.evaluation.overallScore);
      }
      if (run.evaluation?.averageLatency) {
        group.latencies.push(run.evaluation.averageLatency);
      }
    });

    // Calculate averages for each date
    const trends = Array.from(dateGroups.values())
      .map((group) => ({
        date: group.date,
        testRuns: group.testRuns,
        completed: group.completed,
        failed: group.failed,
        successRate:
          group.testRuns > 0
            ? (group.completed / group.testRuns) * 100
            : 0,
        averageScore:
          group.scores.length > 0
            ? group.scores.reduce((a: number, b: number) => a + b, 0) /
              group.scores.length
            : 0,
        averageLatency:
          group.latencies.length > 0
            ? group.latencies.reduce((a: number, b: number) => a + b, 0) /
              group.latencies.length
            : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      summary: {
        totalRuns,
        completedRuns,
        failedRuns,
        pendingRuns,
        runningRuns,
        successRate: Math.round(successRate * 100) / 100,
        averageScore: Math.round(averageScore * 100) / 100,
        averageLatency: Math.round(averageLatency),
      },
      statusDistribution: {
        completed: completedRuns,
        failed: failedRuns,
        pending: pendingRuns,
        running: runningRuns,
      },
      gradeDistribution,
      trends,
    };
  }

  async updateTestRunStatus(
    id: string,
    status: string,
    updates?: any,
  ): Promise<void> {
    const updateData: any = { status };

    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = new Date();
    }

    if (updates) {
      Object.assign(updateData, updates);
    }

    await this.testRunModel.findByIdAndUpdate(id, updateData).exec();
  }

  /**
   * Execute a test run - orchestrates the full conversation
   */
  private async executeTest(testRunId: string): Promise<void> {
    this.logger.log(`Starting test execution for ${testRunId}`);

    try {
      // Update status to running
      await this.updateTestRunStatus(testRunId, 'running');

      // Get test run and config
      const testRun = await this.testRunModel.findById(testRunId).exec();
      if (!testRun) {
        throw new NotFoundException(`Test run with ID ${testRunId} not found`);
      }

      // Get testConfigId - handle both populated and unpopulated cases
      const testConfigId =
        testRun.testConfigId instanceof Object
          ? (testRun.testConfigId as any)._id || testRun.testConfigId
          : testRun.testConfigId;

      const testConfig = await this.testsService.findOne(
        testConfigId.toString(),
      );

      // Create digital human instance
      const digitalHuman = this.digitalHumanService.create(
        testConfig.language.code,
        testConfig.language.dialect,
        testConfig.persona,
        testConfig.scenarioTemplate,
      );

      // Get webhook base URL (provider-agnostic)
      const providerName = this.configService.get<string>('telephony.provider') || 'twilio';
      const webhookBaseUrl =
        this.configService.get<string>(`${providerName}.webhookBaseUrl`) ||
        this.configService.get<string>('twilio.webhookBaseUrl') ||
        'http://localhost:3000';

      const webhookUrl = `${webhookBaseUrl}/v1/telephony/webhook/voice?testRunId=${testRunId}`;
      this.logger.log(
        `Initiating call to ${testConfig.agentEndpoint} with webhook: ${webhookUrl}`,
      );

      // Initiate call via telephony provider
      const call = await this.telephonyService.initiateCall({
        toNumber: testConfig.agentEndpoint,
        testRunId,
        webhookUrl: webhookUrl,
      });

      // Update test run with call info
      await this.testRunModel.findByIdAndUpdate(testRunId, {
        'call.callSid': call.sid,
        'call.startedAt': new Date(),
        'call.status': call.status,
      });

      this.logger.log(`Call initiated: ${call.sid}, status: ${call.status}`);

      // Wait a moment for call to connect
      await this.sleep(2000);

      // Run conversation loop (1 turn for testing)
      const maxTurns = 1;
      let turnCount = 0;

      while (turnCount < maxTurns && !digitalHuman.shouldEnd()) {
        turnCount++;
        this.logger.log(`Conversation turn ${turnCount}/${maxTurns}`);

        try {
          // Generate digital human utterance
          const digitalHumanText = await digitalHuman.generateResponse();
          this.logger.log(`Digital human says: ${digitalHumanText}`);

          // Convert to speech (TTS)
          const ttsResult = await this.ttsService.synthesize(
            digitalHumanText,
            testConfig.language.code,
          );

          // Store audio URL in test run metadata so webhook can access it
          // For MVP, we'll use a simple approach: store audio temporarily
          // In production, you'd upload to Cloudflare R2 or similar
          const audioUrl = await this.storeAudioFile(
            ttsResult.audio,
            `dh-${testRunId}-${turnCount}`,
          );

          // Store current turn info in test run metadata for webhook access
          await this.testRunModel.findByIdAndUpdate(testRunId, {
            $set: {
              'metadata.currentTurn': turnCount,
              'metadata.currentAudioUrl': audioUrl,
              'metadata.waitingForRecording': true,
            },
          });

          // Save digital human utterance to transcript
          await this.addTranscript(testRunId, {
            speaker: 'user',
            message: digitalHumanText,
            audioUrl: audioUrl,
            timestamp: new Date(),
          });

          // Wait for real agent response from Twilio recording callback
          // Poll the database to see if a recording has been transcribed
          const initialTranscriptCount = (await this.findOne(testRunId))
            .transcripts.length;
          const maxWaitTime = 30000; // 30 seconds max wait
          const pollInterval = 1000; // Check every second
          let waitedTime = 0;
          let agentResponse: string | null = null;

          while (waitedTime < maxWaitTime) {
            await this.sleep(pollInterval);
            waitedTime += pollInterval;

            // Check if a new agent transcript was added
            const currentTestRun = await this.findOne(testRunId);
            const currentTranscriptCount = currentTestRun.transcripts.length;

            if (currentTranscriptCount > initialTranscriptCount) {
              // Find the latest agent transcript
              const agentTranscripts = currentTestRun.transcripts.filter(
                (t) => t.speaker === 'agent',
              );
              if (agentTranscripts.length > 0) {
                const latestAgentTranscript =
                  agentTranscripts[agentTranscripts.length - 1];
                agentResponse = latestAgentTranscript.message;
                this.logger.log(`Received agent response: "${agentResponse}"`);
                break;
              }
            }
          }

          if (!agentResponse) {
            this.logger.warn(
              `No agent response received within ${maxWaitTime}ms timeout`,
            );
            // Use a timeout message instead of simulated
            agentResponse = '[No response received - timeout]';
          }

          // Add agent utterance to digital human history (only if we got a real response)
          if (agentResponse && !agentResponse.includes('[No response')) {
            digitalHuman.addAgentUtterance(agentResponse);
          }

          // Check if we should end
          if (digitalHuman.shouldEnd()) {
            this.logger.log('Digital human indicates call should end');
            break;
          }

          // Brief pause between turns
          await this.sleep(1000);
        } catch (error: any) {
          this.logger.error(
            `Error in conversation turn ${turnCount}: ${error.message}`,
          );
          // Continue with next turn
        }
      }

      // Mark as completed
      await this.updateTestRunStatus(testRunId, 'completed', {
        completedAt: new Date(),
      });

      // Run evaluation
      await this.evaluateTestRun(testRunId);

      this.logger.log(`Test execution completed for ${testRunId}`);
    } catch (error: any) {
      this.logger.error(
        `Test execution failed for ${testRunId}: ${error.message}`,
        error.stack,
      );
      await this.updateTestRunStatus(testRunId, 'failed', {
        error: error.message,
      });
      throw error;
    }
  }

  private async addTranscript(
    testRunId: string,
    transcript: {
      speaker: string;
      message: string;
      audioUrl?: string;
      timestamp: Date;
    },
  ): Promise<void> {
    await this.testRunModel.findByIdAndUpdate(
      testRunId,
      {
        $push: {
          transcripts: transcript,
        },
      },
      { new: true },
    );
  }

  private async storeAudioFile(
    audioBuffer: Buffer,
    filename: string,
  ): Promise<string> {
    // Store audio in memory for MVP
    // In production, upload to Cloudflare R2 or similar storage
    this.audioStorage.set(filename, audioBuffer);

    // Get webhook base URL for serving audio
    const webhookBaseUrl =
      this.configService.get<string>('twilio.webhookBaseUrl') ||
      'http://localhost:3000';

    // Return URL that Twilio can access
    return `${webhookBaseUrl}/v1/test-runs/audio/${filename}`;
  }

  /**
   * Get audio file from storage (for serving via HTTP)
   */
  getAudioFile(filename: string): Buffer | null {
    return this.audioStorage.get(filename) || null;
  }

  private async evaluateTestRun(testRunId: string): Promise<void> {
    // Simple evaluation - will be enhanced later
    const testRun = await this.findOne(testRunId);

    const totalTurns = testRun.transcripts.length;
    const userTurns = testRun.transcripts.filter(
      (t) => t.speaker === 'user',
    ).length;
    const agentTurns = testRun.transcripts.filter(
      (t) => t.speaker === 'agent',
    ).length;

    // Calculate average latency (placeholder)
    const averageLatency = 2000; // 2 seconds average

    // Simple scoring (placeholder - will be enhanced with LLM evaluation)
    const overallScore = totalTurns >= 8 ? 85 : totalTurns >= 5 ? 70 : 50;
    const grade =
      overallScore >= 90
        ? 'A'
        : overallScore >= 80
          ? 'B'
          : overallScore >= 70
            ? 'C'
            : overallScore >= 60
              ? 'D'
              : 'F';

    await this.testRunModel.findByIdAndUpdate(testRunId, {
      evaluation: {
        overallScore,
        grade,
        averageLatency,
        taskCompleted: (userTurns / 10) * 100,
        issues: [],
      },
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Process agent recording from Twilio webhook
   * Downloads recording, transcribes it, and saves to transcript
   */
  async processAgentRecording(
    callSid: string,
    recordingUrl: string,
    recordingSid?: string,
  ): Promise<void> {
    this.logger.log(
      `Processing agent recording for call ${callSid}, URL: ${recordingUrl}`,
    );

    // Find test run by call SID
    const testRun = await this.testRunModel
      .findOne({ 'call.callSid': callSid })
      .exec();

    if (!testRun) {
      this.logger.warn(`No test run found for call SID: ${callSid}`);
      return;
    }

    // @ts-ignore
    const testRunId = testRun._id.toString();

    try {
      // Download recording audio
      const recordingResponse = await firstValueFrom(
        this.httpService.get(recordingUrl, {
          responseType: 'arraybuffer',
        }),
      );

      const audioBuffer = Buffer.from(recordingResponse.data);

      // Get test config to determine language
      const testConfigId =
        testRun.testConfigId instanceof Object
          ? (testRun.testConfigId as any)._id || testRun.testConfigId
          : testRun.testConfigId;

      const testConfig = await this.testsService.findOne(
        testConfigId.toString(),
      );

      // Transcribe audio
      const transcription = await this.speechService.transcribe(
        audioBuffer,
        testConfig.language.code,
      );

      // Save agent response to transcript
      await this.addTranscript(testRunId, {
        speaker: 'agent',
        message: transcription.text,
        audioUrl: recordingUrl,
        timestamp: new Date(),
      });

      this.logger.log(
        `Agent response transcribed and saved: "${transcription.text}"`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to process agent recording: ${error.message}`,
        error.stack,
      );
      // Save error message as transcript
      await this.addTranscript(testRunId, {
        speaker: 'agent',
        message: `[Error transcribing: ${error.message}]`,
        timestamp: new Date(),
      });
    }
  }
}
