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
export class HuggingFaceSTTProvider implements STTProvider {
  private readonly logger = new Logger(HuggingFaceSTTProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  // Supported languages for HuggingFace models
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
    this.apiKey = this.configService.get<string>('huggingface.apiKey') || '';
    const customBaseUrl = this.configService.get<string>('huggingface.baseUrl');

    // If custom baseUrl is provided and doesn't contain '/models', it's a direct endpoint
    // Otherwise, use default HuggingFace Inference API format
    if (customBaseUrl && !customBaseUrl.includes('/models')) {
      this.baseUrl = customBaseUrl; // Direct endpoint (e.g., Inference Endpoints)
    } else {
      this.baseUrl =
        customBaseUrl || 'https://api-inference.huggingface.co/models';
    }

    if (!this.apiKey) {
      this.logger.warn(
        'HuggingFace API key not found. HuggingFace STT features will not work.',
      );
    }

    this.logger.log(`HuggingFace STT configured with baseUrl: ${this.baseUrl}`);
  }

  supports(languageCode: string): boolean {
    return this.supportedLanguages.includes(languageCode);
  }

  async transcribe(
    audio: Buffer | string,
    languageCode: string,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new Error(
        'HuggingFace API key not configured. Please set HUGGINGFACE_API_KEY',
      );
    }

    // Check if using a direct endpoint (Inference Endpoints)
    const isDirectEndpoint = !this.baseUrl.includes('/models');

    if (isDirectEndpoint) {
      // For direct endpoints, use the endpoint directly (no model fallbacks)
      // The model is already deployed on that endpoint
      this.logger.log(
        `Using direct HuggingFace Inference Endpoint: ${this.baseUrl}`,
      );
      return await this.tryTranscribeWithModel(
        audio,
        languageCode,
        'direct-endpoint', // Placeholder, won't be used for direct endpoints
        options,
      );
    }

    // Model selection with fallbacks (for standard HuggingFace Inference API)
    // Try these models in order until one works
    const modelFallbacks = options?.model
      ? [options.model]
      : languageCode === 'ar'
        ? [
            'facebook/wav2vec2-large-xlsr-53-arabic',
            'jonatasgrosman/wav2vec2-large-xlsr-53-arabic',
          ]
        : [
            'openai/whisper-large-v2', // Most accurate
            'openai/whisper-base', // Good balance
            'openai/whisper-medium', // Alternative
            'jonatasgrosman/wav2vec2-large-xlsr-53-english', // Alternative
          ];

    let lastError: any = null;
    for (const model of modelFallbacks) {
      try {
        return await this.tryTranscribeWithModel(
          audio,
          languageCode,
          model,
          options,
        );
      } catch (error: any) {
        lastError = error;
        const statusCode = error.response?.status;
        // If 410/404, try next model. If other error, might be auth or format issue
        if (statusCode === 410 || statusCode === 404) {
          this.logger.warn(
            `Model ${model} not available (${statusCode}), trying next fallback...`,
          );
          continue;
        }
        // For other errors, break and throw
        throw error;
      }
    }

    // All models failed - provide helpful error message
    const errorMessage =
      lastError?.response?.status === 410
        ? `All HuggingFace models are unavailable (410). The models may have been removed or are temporarily unavailable. Please check HuggingFace status or try again later.`
        : lastError?.message || 'All HuggingFace models failed';

    this.logger.error(
      `All HuggingFace models failed. Last error: ${errorMessage}`,
    );

    throw new Error(
      `HuggingFace transcription failed: ${errorMessage}. Please check your HUGGINGFACE_API_KEY and model availability.`,
    );
  }

  private async tryTranscribeWithModel(
    audio: Buffer | string,
    languageCode: string,
    model: string,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    let audioBuffer: Buffer;
    if (Buffer.isBuffer(audio)) {
      audioBuffer = audio;
    } else {
      audioBuffer = Buffer.from(audio, 'base64');
    }

    this.logger.log(
      `Sending transcription request to HuggingFace model: ${model}`,
    );

    // Determine the request URL
    // If baseUrl is a direct endpoint (doesn't contain '/models'), use it directly
    // Otherwise, append model name for standard HuggingFace Inference API
    const isDirectEndpoint = !this.baseUrl.includes('/models');
    const requestUrl = isDirectEndpoint
      ? this.baseUrl
      : `${this.baseUrl}/${model}`;

    // Determine Content-Type and payload format
    const contentType = options?.mimeType || 'audio/mpeg';
    let requestBody: any;
    const requestHeaders: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (isDirectEndpoint) {
      // Direct endpoints expect JSON format with base64-encoded audio
      const audioBase64 = audioBuffer.toString('base64');
      requestBody = {
        inputs: audioBase64,
        // Add parameters if the endpoint supports them
        // Note: max_length/max_new_tokens should be configured on the endpoint itself
        // But we can pass them here if the endpoint accepts runtime parameters
        parameters: {
          // For audio models, these might help if the endpoint supports them
          // max_new_tokens: 448, // Adjust based on expected transcription length
          // return_timestamps: false,
        },
      };
      requestHeaders['Content-Type'] = 'application/json';
      this.logger.debug(
        `Sending JSON with base64 audio to direct endpoint: ${requestUrl}, audio size: ${audioBuffer.length} bytes, base64 length: ${audioBase64.length}`,
      );
    } else {
      // Standard HuggingFace API expects raw binary audio
      requestBody = audioBuffer;
      requestHeaders['Content-Type'] = contentType;
      this.logger.debug(
        `Sending raw binary audio to HuggingFace API: ${requestUrl}, audio size: ${audioBuffer.length} bytes, Content-Type: ${contentType}`,
      );
    }

    const response = await firstValueFrom(
      this.httpService.post(requestUrl, requestBody, {
        headers: requestHeaders,
        timeout: 180000, // 3 minutes for inference (models may need to load)
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        responseType: 'json',
      }),
    );

    // Handle async inference (model loading)
    if (response.data?.error) {
      const errorMsg = response.data.error;
      if (
        errorMsg.includes('loading') ||
        errorMsg.includes('is currently loading')
      ) {
        // Model is loading, wait and retry
        this.logger.warn(`Model ${model} is loading, waiting 20 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 20000));
        return this.tryTranscribeWithModel(audio, languageCode, model, options);
      }
      throw new Error(errorMsg);
    }

    // Extract transcription from response
    let transcription = '';
    if (typeof response.data === 'string') {
      transcription = response.data;
    } else if (response.data?.text) {
      transcription = response.data.text;
    } else if (response.data?.[0]?.text) {
      transcription = response.data[0].text;
    } else if (Array.isArray(response.data) && response.data.length > 0) {
      transcription =
        typeof response.data[0] === 'string'
          ? response.data[0]
          : response.data[0]?.text || '';
    }

    this.logger.log(
      `Transcription completed with ${model}: ${transcription.length} chars`,
    );

    if (!transcription) {
      this.logger.warn('Empty transcription result', response.data);
      throw new Error('Empty transcription result from HuggingFace');
    }

    return {
      text: transcription,
      confidence: response.data?.confidence || 0.9,
      language: languageCode !== 'auto' ? languageCode : 'unknown',
    };
  }
}
