import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  STTProvider,
  TranscriptionResult,
  TranscriptionOptions,
} from '../interfaces/stt-provider.interface';

@Injectable()
export class CloudflareWhisperProvider implements STTProvider {
  private readonly logger = new Logger(CloudflareWhisperProvider.name);
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly baseUrl: string;

  // Supported languages (Whisper supports many, but we'll list the ones we care about)
  private readonly supportedLanguages = [
    'ar',
    'en',
    'es',
    'fr',
    'de',
    'it',
    'pt',
    'ru',
    'zh',
    'ja',
    'ko',
  ];

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.accountId = this.configService.get<string>('cloudflare.accountId') || '';
    this.apiToken = this.configService.get<string>('cloudflare.apiToken') || '';
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run`;

    if (!this.accountId || !this.apiToken) {
      this.logger.warn(
        'Cloudflare credentials not found. STT features will not work.',
      );
    }
  }

  supports(languageCode: string): boolean {
    return this.supportedLanguages.includes(languageCode);
  }

  async transcribe(
    audio: Buffer | string,
    languageCode: string,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    if (!this.accountId || !this.apiToken) {
      throw new Error(
        'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN',
      );
    }

    if (!this.supports(languageCode)) {
      throw new Error(`Language ${languageCode} is not supported by Whisper`);
    }

    try {
      // Convert audio to base64 if it's a Buffer
      let audioBase64: string;
      if (Buffer.isBuffer(audio)) {
        audioBase64 = audio.toString('base64');
      } else {
        // Assume it's a URL or base64 string
        audioBase64 = audio;
      }

      // Use Whisper model from Cloudflare Workers AI
      const model = options?.model || '@cf/openai/whisper-large-v3';

      // Cloudflare Workers AI expects audio as base64 or URL
      // For base64, we need to send it in the correct format
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/${model}`,
          {
            audio: audioBase64.startsWith('data:') 
              ? audioBase64 
              : `data:audio/wav;base64,${audioBase64}`,
            language: languageCode,
            prompt: options?.prompt,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      const result = response.data;
      
      // Handle different response formats
      const transcription = result.text || result.transcription || result.result?.text || '';

      return {
        text: transcription,
        confidence: result.confidence,
        language: languageCode,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to transcribe audio: ${error.message}`,
        error.stack,
      );
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }
}

