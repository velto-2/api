export interface LLMResponse {
  text: string;
  model?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMProvider {
  generate(
    messages: Array<{ role: string; content: string }>,
    options?: LLMOptions,
  ): Promise<LLMResponse>;
  supports(model: string): boolean;
}

export interface LLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

