import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { getLanguageConfig } from '../../../common/constants/languages.constant';

export interface TTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface TTSResult {
  audio: Buffer;
  audioUrl?: string;
  duration?: number;
}

@Injectable()
export class TTSService {
  private readonly logger = new Logger(TTSService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    // Get API key and trim whitespace (common issue with .env files)
    // Try multiple ways to get the API key
    let rawApiKey = this.configService.get<string>('elevenlabs.apiKey') || '';
    
    // Fallback: try direct environment variable access
    if (!rawApiKey) {
      rawApiKey = process.env.ELEVENLABS_API_KEY || '';
      this.logger.warn('API key not found in config, trying process.env.ELEVENLABS_API_KEY');
    }
    
    this.apiKey = rawApiKey.trim();
    
    this.baseUrl =
      this.configService.get<string>('elevenlabs.baseUrl') ||
      'https://api.elevenlabs.io/v1';

    if (!this.apiKey) {
      this.logger.warn(
        'ElevenLabs API key not found. TTS features will not work.',
      );
      this.logger.warn(
        `Raw value from config: "${rawApiKey}" (length: ${rawApiKey.length})`,
      );
    } else {
      // Log that API key is loaded (but don't log the actual key)
      const preview = `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`;
      this.logger.log(
        `ElevenLabs API key loaded (length: ${this.apiKey.length} chars, preview: ${preview})`,
      );
    }
  }

  /**
   * Generate speech from text using ElevenLabs
   */
  async synthesize(
    text: string,
    languageCode: string,
    options?: TTSOptions,
  ): Promise<TTSResult> {
    if (!this.apiKey) {
      throw new Error(
        'ElevenLabs API key not configured. Please set ELEVENLABS_API_KEY',
      );
    }

    const languageConfig = getLanguageConfig(languageCode);

    if (!languageConfig) {
      throw new Error(`Language ${languageCode} is not supported`);
    }

    // Get voice ID from language config or options
    let voiceId =
      options?.voiceId ||
      languageConfig.tts.voiceId ||
      null;

    // Check if voice ID is a placeholder or invalid
    if (!voiceId || voiceId === 'arabic-voice-id' || voiceId === 'default-voice-id' || voiceId.includes('voice-id')) {
      this.logger.warn(
        `Voice ID not configured or is a placeholder for language ${languageCode}. ` +
        `Note: With the multilingual model (eleven_multilingual_v2), ANY voice can speak Arabic. ` +
        `Please set a valid ElevenLabs voice ID in language configuration or ELEVENLABS_VOICE_ID env var.`,
      );
      
      // Try to get from environment variable as fallback
      voiceId = this.configService.get<string>('elevenlabs.voiceId') || null;
      
      if (!voiceId) {
        // Provide helpful error with instructions
        throw new Error(
          `No valid voice ID configured for language ${languageCode}. ` +
          `\n\nTo fix this:\n` +
          `1. Call GET /v1/speech/voices to see available voices\n` +
          `2. Pick ANY voice (they all work with multilingual model for Arabic)\n` +
          `3. Set ELEVENLABS_VOICE_ID=voice_id_here in your .env file\n` +
          `\nNote: ElevenLabs multilingual model supports Arabic with any voice. ` +
          `You don't need an Arabic-specific voice.`,
        );
      }
    }

    try {
      // Log request details for debugging (without exposing full API key)
      const apiKeyPreview = this.apiKey 
        ? `${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}` 
        : 'NOT SET';
      
      this.logger.log(
        `Making TTS request: voiceId=${voiceId}, textLength=${text.length}, apiKey=${apiKeyPreview}`,
      );

      // Use the text-to-speech endpoint
      // Match exactly what curl sends (minimal headers)
      const requestBody = {
        text,
        model_id: options?.modelId || 'eleven_multilingual_v2',
        voice_settings: {
          stability: options?.stability ?? 0.5,
          similarity_boost: options?.similarityBoost ?? 0.75,
          style: options?.style ?? 0.0,
          use_speaker_boost: options?.useSpeakerBoost ?? true,
        },
      };

      // Log the exact request we're about to send (for debugging)
      this.logger.log(
        `[DEBUG] ElevenLabs TTS Request: POST ${this.baseUrl}/text-to-speech/${voiceId}`,
      );
      this.logger.log(
        `[DEBUG] Headers: xi-api-key=${this.apiKey.substring(0, 8)}..., Content-Type=application/json`,
      );
      this.logger.log(
        `[DEBUG] Request body keys: ${Object.keys(requestBody).join(', ')}`,
      );

      // Create request config - minimal to match curl
      const requestConfig = {
        headers: {
          'xi-api-key': this.apiKey.trim(), // Only essential headers - match curl
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer' as const, // Get binary audio data
        timeout: 30000, // 30 second timeout
        // Explicitly don't add User-Agent - let axios use its default (which might be different)
        // Don't add Accept header - let server decide
        validateStatus: () => true, // Don't throw on non-2xx, we'll handle it
      };

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/text-to-speech/${voiceId}`,
          requestBody,
          requestConfig,
        ),
      );

      // Check for errors manually
      if (response.status !== 200) {
        let errorMessage = `ElevenLabs API returned ${response.status}`;
        if (response.data) {
          try {
            const errorData = Buffer.isBuffer(response.data)
              ? JSON.parse(response.data.toString('utf-8'))
              : response.data;
            errorMessage = errorData?.detail?.message || errorData?.message || errorMessage;
          } catch (e) {
            // Ignore parse errors
          }
        }
        throw new Error(errorMessage);
      }

      const audioBuffer = Buffer.from(response.data);

      this.logger.log(
        `Generated TTS audio for ${languageCode}, size: ${audioBuffer.length} bytes`,
      );

      return {
        audio: audioBuffer,
        duration: undefined, // Could be calculated from audio metadata
      };
    } catch (error: any) {
      // Log more detailed error information
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        voiceId,
        textLength: text?.length,
        languageCode,
      };
      
      this.logger.error(
        `Failed to generate TTS: ${JSON.stringify(errorDetails)}`,
        error.stack,
      );
      
      // Provide more helpful error message based on status code
      if (error.response?.status === 401) {
        // Try to parse the error response
        let errorMessage = 'Unauthorized - Invalid API key or account issue';
        let isAbuseDetection = false;
        
        if (error.response?.data) {
          try {
            // Handle Buffer data (common in NestJS axios responses)
            let errorData: any;
            if (error.response.data?.type === 'Buffer' && error.response.data?.data) {
              const bufferString = Buffer.from(error.response.data.data).toString('utf-8');
              errorData = JSON.parse(bufferString);
            } else if (typeof error.response.data === 'string') {
              errorData = JSON.parse(error.response.data);
            } else {
              errorData = error.response.data;
            }
            
            errorMessage = errorData?.detail?.message || errorData?.message || errorMessage;
            
            // Check if it's the "unusual activity" / abuse detection error
            if (errorMessage.includes('Unusual activity') || 
                errorMessage.includes('Free Tier usage disabled') ||
                errorMessage.includes('abuse')) {
              isAbuseDetection = true;
            }
          } catch (e) {
            // If parsing fails, use the raw data
            errorMessage = String(error.response.data);
          }
        }
        
        if (isAbuseDetection) {
          throw new Error(
            `ElevenLabs has disabled your free tier due to unusual activity detection.\n\n` +
            `Error: ${errorMessage}\n\n` +
            `This is an account-level restriction, not a code issue. Solutions:\n` +
            `1. Wait 24-48 hours and try again (restrictions may be temporary)\n` +
            `2. Create a new ElevenLabs account with a different email\n` +
            `3. Upgrade to a paid plan (starts at $5/month)\n` +
            `4. Contact ElevenLabs support: https://help.elevenlabs.io\n\n` +
            `Why this happens:\n` +
            `- Multiple requests in quick succession\n` +
            `- Using VPN/proxy that looks suspicious\n` +
            `- Multiple free accounts from same IP\n` +
            `- Account flagged for potential abuse\n\n` +
            `Note: The same API key works in terminal because terminal requests might be:\n` +
            `- Coming from a different IP/network\n` +
            `- Less frequent (not triggering rate limits)\n` +
            `- Using different headers that look more legitimate`,
          );
        } else {
          throw new Error(
            `TTS generation failed (401 Unauthorized): ${errorMessage}\n` +
            `\nPossible causes:\n` +
            `1. Invalid or missing ELEVENLABS_API_KEY in .env file\n` +
            `2. API key doesn't have proper permissions\n` +
            `3. ElevenLabs free tier disabled due to abuse detection\n` +
            `4. Need to upgrade to paid plan\n` +
            `\nCheck your .env file and ensure ELEVENLABS_API_KEY is set correctly.`
          );
        }
      }
      
      if (error.response?.status === 400) {
        const errorMessage = error.response?.data?.detail?.message || error.response?.data?.message || error.message;
        throw new Error(`TTS generation failed (400 Bad Request): ${errorMessage}. Voice ID: ${voiceId}, Text length: ${text?.length}`);
      }
      
      throw new Error(`TTS generation failed: ${error.message}`);
    }
  }

  /**
   * Get available voices for a language
   */
  async getVoices(languageCode?: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/voices`, {
          headers: {
            'xi-api-key': this.apiKey,
          },
        }),
      );

      let voices = response.data.voices || [];

      // Filter by language if specified
      if (languageCode) {
        // ElevenLabs voices may have language info in labels or settings
        // For Arabic, we'll look for multilingual voices or Arabic-specific ones
        voices = voices.map((voice: any) => {
          // Check if voice supports the language
          const supportsLanguage = 
            voice.labels?.language === languageCode ||
            voice.labels?.language?.includes(languageCode) ||
            voice.settings?.language === languageCode ||
            // Multilingual voices typically work with all languages when using multilingual model
            voice.category === 'multilingual' ||
            // Some voices are marked as supporting multiple languages
            (voice.labels && Object.keys(voice.labels).length > 0);

          return {
            ...voice,
            supportsLanguage: supportsLanguage || languageCode === 'ar', // Assume all voices work with multilingual model
          };
        });
      }

      return voices;
    } catch (error: any) {
      this.logger.error(
        `Failed to get voices: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get voices: ${error.message}`);
    }
  }
}


