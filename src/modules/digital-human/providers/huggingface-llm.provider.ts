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
export class HuggingFaceLLMProvider implements LLMProvider {
  private readonly logger = new Logger(HuggingFaceLLMProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.apiKey =
      this.configService.get<string>('huggingface.apiKey') || '';
    this.baseUrl =
      this.configService.get<string>('huggingface.baseUrl') ||
      'https://api-inference.huggingface.co/models';

    if (!this.apiKey) {
      this.logger.warn(
        'HuggingFace API key not configured. LLM features will not work.',
      );
    }
  }

  supports(model: string): boolean {
    // HuggingFace supports models that don't start with @cf/
    // Common models: tiiuae/falcon-7b-instruct, tiiuae/falcon-40b-instruct, etc.
    return !model.startsWith('@cf/') && model.includes('/');
  }

  async generate(
    messages: Array<{ role: string; content: string }>,
    options?: LLMOptions,
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error(
        'HuggingFace API key not configured. Please set HUGGINGFACE_API_KEY',
      );
    }

    const model = options?.model || 'tiiuae/falcon-7b-instruct';
    const maxTokens = options?.maxTokens || 150;
    const temperature = options?.temperature ?? 0.7;

    try {
      // Convert messages to HuggingFace format
      // HuggingFace typically expects a single prompt or conversation format
      const prompt = this.formatMessagesToPrompt(messages);

      // HuggingFace Inference API format
      const payload: any = {
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
          temperature: temperature,
          return_full_text: false,
        },
      };

      this.logger.log(`Sending request to HuggingFace model: ${model}`);

      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/${model}`, payload, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 seconds
        }),
      );

      // Handle async inference (model loading)
      if (response.data?.error) {
        if (response.data.error.includes('loading')) {
          this.logger.warn('Model is loading, waiting 10 seconds...');
          await new Promise((resolve) => setTimeout(resolve, 10000));
          return this.generate(messages, options);
        }
        throw new Error(response.data.error);
      }

      // Extract text from HuggingFace response
      let responseText = '';
      if (Array.isArray(response.data) && response.data.length > 0) {
        responseText = response.data[0].generated_text || '';
      } else if (typeof response.data === 'string') {
        responseText = response.data;
      } else if (response.data?.generated_text) {
        responseText = response.data.generated_text;
      } else if (response.data?.text) {
        responseText = response.data.text;
      }

      // Remove the original prompt from the response if it's included
      if (responseText.includes(prompt)) {
        responseText = responseText.replace(prompt, '').trim();
      }

      return {
        text: responseText.trim(),
        model: model,
      };
    } catch (error: any) {
      this.logger.error(
        `HuggingFace LLM generation failed: ${error.message}`,
        error.stack,
      );
      throw new Error(`LLM generation failed: ${error.message}`);
    }
  }

  /**
   * Format messages array into a prompt string for HuggingFace
   */
  private formatMessagesToPrompt(
    messages: Array<{ role: string; content: string }>,
  ): string {
    // Filter out system messages and format conversation
    const conversationMessages = messages.filter((m) => m.role !== 'system');
    const systemMessage = messages.find((m) => m.role === 'system');

    let prompt = '';

    // Add system prompt if exists
    if (systemMessage) {
      prompt += `${systemMessage.content}\n\n`;
    }

    // Format conversation
    for (const msg of conversationMessages) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n`;
      }
    }

    // Add prompt for next response
    prompt += 'Assistant:';

    return prompt;
  }
}

