import { Injectable, Logger } from '@nestjs/common';
import { DigitalHumanStrategy } from './digital-human-strategy.abstract';
import { Message } from '../interfaces/message.interface';
import {
  LanguageConfig,
  Dialect,
} from '../../../common/constants/languages.constant';
import { LLMService } from '../services/llm.service';

@Injectable()
export class ArabicDigitalHumanStrategy extends DigitalHumanStrategy {
  private readonly logger = new Logger(ArabicDigitalHumanStrategy.name);
  private readonly dialect: Dialect;

  constructor(
    private config: LanguageConfig,
    dialectCode: string,
    private llmService: LLMService,
  ) {
    super();

    // Get dialect configuration
    const dialect = this.config.dialects.find((d) => d.code === dialectCode);
    if (!dialect) {
      throw new Error(`Dialect ${dialectCode} not found for Arabic`);
    }
    this.dialect = dialect;
  }

  generateSystemPrompt(persona: string, scenario: string): string {
    const fillerWords = this.dialect.fillerWords.join(', ');
    const greetings = this.dialect.commonGreetings.join(', ');
    const farewells = this.dialect.commonFarewells.join(', ');

    return `You are simulating an Arabic speaker with ${this.dialect.name} dialect (${this.dialect.nativeName}).
You are having a phone conversation with a customer service agent.

Persona: ${persona}
Scenario: ${scenario}

Important guidelines:
- Respond ONLY in Arabic script (العربية)
- Use natural ${this.dialect.name} expressions
- Use filler words naturally: ${fillerWords}
- Common greetings: ${greetings}
- Common farewells: ${farewells}
- Keep responses concise (1-2 sentences)
- Sound natural and conversational
- Match the ${this.dialect.features.formalLevel} tone
- Speak at ${this.dialect.features.speedOfSpeech} pace

Your goal is to have a realistic conversation that tests the agent's ability to understand and respond to Arabic speakers.`;
  }

  async generateResponse(
    history: Message[],
    agentUtterance?: string,
  ): Promise<string> {
    const systemPrompt = this.generateSystemPrompt(
      history.find((m) => m.role === 'system')?.content.split('\n')[0] ||
        'polite_customer',
      history.find((m) => m.role === 'system')?.content.split('\n')[1] ||
        'Customer inquiry',
    );

    // Build conversation messages for LLM
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
    ];

    // Add agent's utterance if provided
    if (agentUtterance) {
      messages.push({
        role: 'assistant',
        content: `Agent said: ${agentUtterance}`,
      });
      messages.push({
        role: 'user',
        content: 'Respond naturally to what the agent just said.',
      });
    }

    try {
      const response = await this.llmService.generate(
        messages,
        this.config.code,
        {
          model: this.config.llm.model,
          maxTokens: 150,
          temperature: 0.7,
        },
      );

      let responseText = response.text;

      // Remove any English if it somehow got in
      if (responseText.match(/^[a-zA-Z]/)) {
        this.logger.warn(
          'Response contains English, attempting to extract Arabic',
        );
        // Try to extract Arabic text
        const arabicMatch = responseText.match(/[\u0600-\u06FF\s]+/);
        responseText = arabicMatch ? arabicMatch[0] : responseText;
      }

      // Add natural speech patterns
      return this.addNaturalSpeech(responseText);
    } catch (error: any) {
      this.logger.error(
        `Failed to generate response: ${error.message}`,
        error.stack,
      );
      throw new Error(`Response generation failed: ${error.message}`);
    }
  }

  shouldEndCall(history: Message[]): boolean {
    // Check if farewell phrases are present in recent messages
    const recentMessages = history.slice(-3);
    const farewellPhrases = this.dialect.commonFarewells;

    const hasFarewell = recentMessages.some((msg) =>
      farewellPhrases.some((phrase) =>
        msg.content.toLowerCase().includes(phrase.toLowerCase()),
      ),
    );

    // Also check if we've had enough turns (8-10 turns)
    const userTurns = history.filter((m) => m.role === 'user').length;
    if (userTurns >= 10) {
      return true;
    }

    return hasFarewell;
  }

  addNaturalSpeech(text: string): string {
    // Randomly inject filler words at natural points
    const fillerWords = this.getFillerWords();
    if (fillerWords.length === 0) {
      return text;
    }

    // Don't modify every time - 30% chance to add filler
    if (Math.random() > 0.3) {
      return text;
    }

    // Add filler word at the beginning or after a comma
    const randomFiller =
      fillerWords[Math.floor(Math.random() * fillerWords.length)];

    // 50% chance at beginning, 50% after comma or period
    if (Math.random() > 0.5) {
      return `${randomFiller}، ${text}`;
    } else {
      // Insert after first comma or period if exists
      const commaIndex = text.indexOf('،');
      const periodIndex = text.indexOf('.');
      const insertIndex =
        commaIndex > 0 ? commaIndex : periodIndex > 0 ? periodIndex : -1;

      if (insertIndex > 0) {
        return (
          text.slice(0, insertIndex + 1) +
          ` ${randomFiller}،` +
          text.slice(insertIndex + 1)
        );
      }
    }

    return text;
  }

  getFillerWords(): string[] {
    return this.dialect.fillerWords;
  }
}
