import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  LLMProvider,
  LLMResponse,
  LLMOptions,
} from '../interfaces/llm-provider.interface';

@Injectable()
export class CloudflareLLMProvider implements LLMProvider {
  private readonly logger = new Logger(CloudflareLLMProvider.name);
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly baseUrl: string;

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
        'Cloudflare credentials not configured. LLM features will not work.',
      );
    }
  }

  supports(model: string): boolean {
    // Cloudflare supports models starting with @cf/
    return model.startsWith('@cf/');
  }

  async generate(
    messages: Array<{ role: string; content: string }>,
    options?: LLMOptions,
  ): Promise<LLMResponse> {
    if (!this.accountId || !this.apiToken) {
      throw new Error(
        'Cloudflare credentials not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN',
      );
    }

    const model = options?.model || '@cf/meta/llama-3.1-8b-instruct';
    const maxTokens = options?.maxTokens || 150;
    const temperature = options?.temperature ?? 0.7;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/${model}`,
          {
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      // Cloudflare Workers AI returns response in different formats
      let responseText = '';

      if (response.data) {
        // Check if result is an object with a response property
        if (response.data.result && typeof response.data.result === 'object') {
          responseText =
            response.data.result.response || response.data.result.text || '';
        }
        // Check if result is a string directly
        else if (typeof response.data.result === 'string') {
          responseText = response.data.result;
        }
        // Check for direct response property
        else if (typeof response.data.response === 'string') {
          responseText = response.data.response;
        }
        // Check for message property
        else if (typeof response.data.message === 'string') {
          responseText = response.data.message;
        }
        // Check for text property
        else if (typeof response.data.text === 'string') {
          responseText = response.data.text;
        }
      }

      // Ensure we have a string
      if (typeof responseText !== 'string') {
        this.logger.error(
          `Unexpected response format from Cloudflare AI: ${JSON.stringify(response.data)}`,
        );
        responseText = String(responseText || '');
      }

      return {
        text: responseText.trim(),
        model: model,
      };
    } catch (error: any) {
      this.logger.error(
        `Cloudflare LLM generation failed: ${error.message}`,
        error.stack,
      );
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }
}

