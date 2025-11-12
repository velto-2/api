import { Injectable, Logger } from '@nestjs/common';
import { CloudflareLLMProvider } from '../providers/cloudflare-llm.provider';
import { HuggingFaceLLMProvider } from '../providers/huggingface-llm.provider';
import {
  LLMProvider,
  LLMResponse,
  LLMOptions,
} from '../interfaces/llm-provider.interface';
import { getLanguageConfig } from '../../../common/constants/languages.constant';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private readonly providers: Map<string, LLMProvider> = new Map();

  constructor(
    private cloudflareProvider: CloudflareLLMProvider,
    private huggingfaceProvider: HuggingFaceLLMProvider,
  ) {
    this.providers.set('cloudflare', this.cloudflareProvider);
    this.providers.set('huggingface', this.huggingfaceProvider);
  }

  /**
   * Generate response using the appropriate LLM provider based on language configuration
   */
  async generate(
    messages: Array<{ role: string; content: string }>,
    languageCode: string,
    options?: LLMOptions,
  ): Promise<LLMResponse> {
    const languageConfig = getLanguageConfig(languageCode);

    if (!languageConfig) {
      this.logger.warn(
        `Language ${languageCode} not found, using default cloudflare provider`,
      );
      return this.cloudflareProvider.generate(messages, options);
    }

    const providerName = languageConfig.llm.provider || 'cloudflare';
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`LLM provider ${providerName} is not available`);
    }

    // Use model from language config or options
    const model =
      options?.model || languageConfig.llm.model || '@cf/meta/llama-3.1-8b-instruct';

    // Verify provider supports the model
    if (!provider.supports(model)) {
      this.logger.warn(
        `Provider ${providerName} doesn't support model ${model}, trying default`,
      );
      // Fallback to cloudflare if model not supported
      return this.cloudflareProvider.generate(messages, {
        ...options,
        model: '@cf/meta/llama-3.1-8b-instruct',
      });
    }

    this.logger.log(
      `Generating response for ${languageCode} using ${providerName} with model ${model}`,
    );

    return provider.generate(messages, {
      ...options,
      model: model,
    });
  }

  /**
   * Generate response using multiple providers (orchestration)
   * Returns the first successful response or throws if all fail
   */
  async generateWithFallback(
    messages: Array<{ role: string; content: string }>,
    languageCode: string,
    options?: LLMOptions,
  ): Promise<LLMResponse> {
    const languageConfig = getLanguageConfig(languageCode);
    const providerName = languageConfig?.llm.provider || 'cloudflare';
    const model = options?.model || languageConfig?.llm.model;

    // Try primary provider first
    const primaryProvider = this.providers.get(providerName);
    if (primaryProvider && model && primaryProvider.supports(model)) {
      try {
        return await primaryProvider.generate(messages, { ...options, model });
      } catch (error) {
        this.logger.warn(
          `Primary provider ${providerName} failed, trying fallback`,
        );
      }
    }

    // Fallback to cloudflare
    try {
      return await this.cloudflareProvider.generate(messages, {
        ...options,
        model: '@cf/meta/llama-3.1-8b-instruct',
      });
    } catch (error) {
      this.logger.error('All LLM providers failed');
      throw error;
    }
  }
}

