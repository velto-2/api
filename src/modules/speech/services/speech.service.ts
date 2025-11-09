import { Injectable, Logger } from '@nestjs/common';
import { CloudflareWhisperProvider } from '../providers/cloudflare-whisper.provider';
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

  constructor(private whisperProvider: CloudflareWhisperProvider) {
    this.providers = new Map();
    this.providers.set('whisper', this.whisperProvider);
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
        this.logger.warn(`Language ${languageCode} not found, using auto-detection`);
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
      this.logger.warn(`Provider doesn't support ${finalLanguageCode}, using auto-detection`);
      finalLanguageCode = 'auto';
    }

    const transcriptionOptions: TranscriptionOptions = {
      ...options,
      model: languageConfig?.stt.model || options?.model || '@cf/openai/whisper',
      language: isAuto ? undefined : languageConfig?.stt.languageCode,
    };

    this.logger.log(
      `Transcribing audio${isAuto ? ' (auto-detect)' : ` in ${finalLanguageCode}`} using ${providerName}`,
    );

    return provider.transcribe(audio, finalLanguageCode, transcriptionOptions);
  }
}


