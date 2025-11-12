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
    this.accountId =
      this.configService.get<string>('cloudflare.accountId') || '';
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

    if (languageCode !== 'auto' && !this.supports(languageCode)) {
      throw new Error(`Language ${languageCode} is not supported by Whisper`);
    }

    // Use Whisper model from Cloudflare Workers AI
    // Try different Whisper model variants based on availability
    const model = options?.model || '@cf/openai/whisper';

    try {
      // Cloudflare Workers AI API format
      // For @cf/openai/whisper: expects array of 8-bit unsigned integers
      let audioBuffer: Buffer;
      if (Buffer.isBuffer(audio)) {
        audioBuffer = audio;
      } else {
        // If it's a string, assume it's base64 and decode it
        audioBuffer = Buffer.from(audio, 'base64');
      }

      // Log audio size for debugging
      const audioSizeMB = audioBuffer.length / (1024 * 1024);
      this.logger.log(
        `Audio buffer size: ${audioSizeMB.toFixed(2)} MB (${audioBuffer.length} bytes)`,
      );

      // Cloudflare has request size limits (~10-15MB for JSON payload)
      // A 5MB audio file becomes ~15-20MB when serialized as JSON array
      // We'll try anyway and let Cloudflare return 413 if too large
      // This allows the fallback mechanism to work properly
      if (audioSizeMB > 10) {
        this.logger.warn(
          `Audio file is very large (${audioSizeMB.toFixed(2)} MB). Cloudflare may reject it.`,
        );
      }

      // Convert Buffer to Uint8Array and then to array
      // Use Array.from for better memory efficiency with large files
      const audioArray = Array.from(new Uint8Array(audioBuffer));
      
      // Log array conversion details
      this.logger.log(
        `Converted audio buffer to array: ${audioArray.length} elements (original buffer: ${audioBuffer.length} bytes)`,
      );
      
      // Estimate JSON payload size (rough: each number ~2-3 bytes in JSON)
      const estimatedPayloadSize = audioArray.length * 2.5;
      this.logger.log(
        `Estimated JSON payload size: ${(estimatedPayloadSize / (1024 * 1024)).toFixed(2)} MB`,
      );

      const requestBody: any = {
        audio: audioArray, // Array of Uint8 values (0-255)
      };

      // Only include language if not auto-detect
      if (languageCode !== 'auto' && options?.language) {
        requestBody.language = options.language;
      }

      if (options?.prompt) {
        requestBody.prompt = options.prompt;
      }

      this.logger.log(`Sending transcription request to ${model}`);
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/${model}`, requestBody, {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 300000, // 5 minutes for longer audio files
        }),
      );

      this.logger.log(`Transcription response received`);
      this.logger.debug(
        `Response structure: ${JSON.stringify(response.data).substring(0, 200)}`,
      );
      const result = response.data?.result || response.data;

      // Handle different response formats
      const transcription =
        result?.text || result?.transcription || result?.transcript || '';
      // Cloudflare Whisper may return language in different formats
      const detectedLanguage =
        result?.language ||
        result?.detected_language ||
        (languageCode !== 'auto' ? languageCode : 'unknown');

      // Log full response details for debugging
      this.logger.log(
        `Transcription completed: ${transcription.length} chars, language: ${detectedLanguage}`,
      );
      this.logger.debug(
        `Full response keys: ${Object.keys(result || {}).join(', ')}`,
      );
      
      // Check if response might be truncated
      if (result?.text && transcription.length > 0) {
        const responseSize = JSON.stringify(response.data).length;
        this.logger.debug(
          `Response size: ${(responseSize / 1024).toFixed(2)} KB, transcription: ${transcription.length} chars`,
        );
      }

      if (!transcription) {
        this.logger.warn('Empty transcription result', result);
      }

      return {
        text: transcription,
        confidence: result?.confidence || 0.9,
        language: detectedLanguage,
        duration: result?.duration,
      };
    } catch (error: any) {
      const errorDetails = error.response?.data || error.message;
      const errorCode = error.response?.data?.errors?.[0]?.code;

      // Handle specific Cloudflare error codes
      if (errorCode === 6001) {
        // Internal error - could be due to file size or format
        const audioSizeMB = Buffer.isBuffer(audio)
          ? audio.length / (1024 * 1024)
          : Buffer.from(audio, 'base64').length / (1024 * 1024);
        this.logger.error(
          `Cloudflare internal error (6001). Audio size: ${audioSizeMB.toFixed(2)} MB. This may indicate the file is too large or in an unsupported format.`,
        );
      }

      if (errorCode === 5006) {
        // Bad input error - format issue
        this.logger.error(
          `Cloudflare bad input error (5006). Check audio format and size.`,
        );
      }

      if (errorCode === 3006) {
        // Request too large
        const audioSizeMB = Buffer.isBuffer(audio)
          ? audio.length / (1024 * 1024)
          : Buffer.from(audio, 'base64').length / (1024 * 1024);
        this.logger.error(
          `Cloudflare request too large (3006). Audio size: ${audioSizeMB.toFixed(2)} MB. The file is too large to send as a JSON array. Maximum recommended size is ~3 MB.`,
        );
        throw new Error(
          `Audio file too large for Cloudflare Whisper (${audioSizeMB.toFixed(2)} MB). Please use a file smaller than 3 MB or compress the audio.`,
        );
      }

      // If model access denied, try fallback model
      if (errorCode === 5018 && model === '@cf/openai/whisper-large-v3') {
        this.logger.warn(
          'whisper-large-v3 not available, trying base whisper model',
        );
        try {
          return this.transcribe(audio, languageCode, {
            ...options,
            model: '@cf/openai/whisper',
          });
        } catch (fallbackError: any) {
          this.logger.error(
            'Fallback model also failed',
            fallbackError.message,
          );
        }
      }

      this.logger.error(
        `Failed to transcribe audio: ${error.message}`,
        `Response: ${JSON.stringify(errorDetails)}`,
        error.stack,
      );
      throw new Error(
        `Transcription failed: ${error.message} - ${JSON.stringify(errorDetails)}`,
      );
    }
  }
}
