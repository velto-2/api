import { Injectable, Logger } from '@nestjs/common';
import { CloudflareWhisperProvider } from '../providers/cloudflare-whisper.provider';
import { HuggingFaceSTTProvider } from '../providers/huggingface-stt.provider';
import {
  STTProvider,
  TranscriptionResult,
  TranscriptionOptions,
} from '../interfaces/stt-provider.interface';
import { getLanguageConfig } from '../../../common/constants/languages.constant';

@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);
  private readonly providers: Map<string, STTProvider>;

  constructor(
    private whisperProvider: CloudflareWhisperProvider,
    private huggingfaceProvider: HuggingFaceSTTProvider,
  ) {
    this.providers = new Map();
    this.providers.set('whisper', this.whisperProvider);
    this.providers.set('huggingface', this.huggingfaceProvider);
  }

  /**
   * Transcribe audio using the appropriate provider based on language configuration
   */
  async transcribe(
    audio: Buffer | string,
    languageCode: string,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    // Handle auto-detection
    const isAuto = languageCode === 'auto' || !languageCode;

    let languageConfig;
    let finalLanguageCode = languageCode;

    if (!isAuto) {
      languageConfig = getLanguageConfig(languageCode);
      if (!languageConfig) {
        this.logger.warn(
          `Language ${languageCode} not found, using auto-detection`,
        );
        finalLanguageCode = 'auto';
      }
    }

    const providerName = languageConfig?.stt.provider || 'whisper';
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`STT provider ${providerName} is not available`);
    }

    // For auto-detection, skip language validation
    if (!isAuto && !provider.supports(finalLanguageCode)) {
      this.logger.warn(
        `Provider doesn't support ${finalLanguageCode}, using auto-detection`,
      );
      finalLanguageCode = 'auto';
    }

    const transcriptionOptions: TranscriptionOptions = {
      ...options,
      model:
        languageConfig?.stt.model || options?.model || '@cf/openai/whisper',
      language: isAuto ? undefined : languageConfig?.stt.languageCode,
    };

    // Note: We let Cloudflare try first, then fallback on error
    // This avoids pre-checking size and gives Cloudflare a chance to handle it

    this.logger.log(
      `Transcribing audio${isAuto ? ' (auto-detect)' : ` in ${finalLanguageCode}`} using ${providerName}`,
    );

    try {
      return await provider.transcribe(
        audio,
        finalLanguageCode,
        transcriptionOptions,
      );
    } catch (error: any) {
      // If Cloudflare fails with size error (3006), fallback to HuggingFace
      if (
        providerName === 'whisper' &&
        error.response?.data?.errors?.[0]?.code === 3006
      ) {
        const audioSizeMB = Buffer.isBuffer(audio)
          ? audio.length / (1024 * 1024)
          : Buffer.from(audio, 'base64').length / (1024 * 1024);
        this.logger.warn(
          `Cloudflare Whisper failed due to size (${audioSizeMB.toFixed(2)} MB), falling back to HuggingFace`,
        );
        const huggingfaceProvider = this.providers.get('huggingface');
        if (huggingfaceProvider) {
          try {
            // Create new options without Cloudflare model - let HuggingFace use its defaults
            const huggingfaceOptions: TranscriptionOptions = {
              ...options,
              model: undefined, // Let HuggingFace choose based on language
              language: isAuto ? undefined : languageConfig?.stt.languageCode,
            };
            return await huggingfaceProvider.transcribe(
              audio,
              finalLanguageCode,
              huggingfaceOptions,
            );
          } catch (huggingfaceError: any) {
            // If HuggingFace also fails, throw a clear error about file size
            this.logger.error(
              `Both Cloudflare and HuggingFace failed. Cloudflare: size limit, HuggingFace: ${huggingfaceError.message}`,
            );
            throw new Error(
              `Audio file too large for Cloudflare Whisper (${audioSizeMB.toFixed(2)} MB) and HuggingFace models are unavailable. Please compress the audio file to under 3 MB or try again later.`,
            );
          }
        }
        throw new Error(
          `Audio file too large for Cloudflare Whisper (${audioSizeMB.toFixed(2)} MB) and HuggingFace is not configured. Please compress the audio file to under 3 MB.`,
        );
      }
      throw error;
    }
  }
}
