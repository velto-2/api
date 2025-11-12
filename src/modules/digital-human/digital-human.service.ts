import { Injectable, Logger } from '@nestjs/common';
import { DigitalHumanStrategy } from './strategies/digital-human-strategy.abstract';
import { ArabicDigitalHumanStrategy } from './strategies/arabic-digital-human.strategy';
import { DigitalHumanInstance } from './digital-human-instance';
import {
  getLanguageConfig,
  LANGUAGES,
} from '../../common/constants/languages.constant';
import { LLMService } from './services/llm.service';

@Injectable()
export class DigitalHumanService {
  private readonly logger = new Logger(DigitalHumanService.name);

  constructor(private llmService: LLMService) {}

  /**
   * Create a digital human instance using factory pattern
   * @param languageCode - ISO 639-1 language code (e.g., 'ar', 'en')
   * @param dialectCode - Dialect code (e.g., 'egyptian', 'gulf')
   * @param persona - Persona identifier
   * @param scenario - Scenario description
   * @returns DigitalHumanInstance
   */
  create(
    languageCode: string,
    dialectCode: string,
    persona: string,
    scenario: string,
  ): DigitalHumanInstance {
    const languageConfig = getLanguageConfig(languageCode);

    if (!languageConfig) {
      throw new Error(`Language ${languageCode} is not supported`);
    }

    // Select appropriate strategy based on language
    const strategy = this.getStrategy(
      languageCode,
      dialectCode,
      languageConfig,
    );

    return new DigitalHumanInstance(strategy, persona, scenario);
  }

  /**
   * Get strategy class for language
   */
  private getStrategy(
    languageCode: string,
    dialectCode: string,
    languageConfig: (typeof LANGUAGES)[string],
  ): DigitalHumanStrategy {
    switch (languageCode) {
      case 'ar':
        return new ArabicDigitalHumanStrategy(
          languageConfig,
          dialectCode,
          this.llmService,
        );
      // Add more languages here as they're implemented
      // case 'en':
      //   return new EnglishDigitalHumanStrategy(...);
      // case 'es':
      //   return new SpanishDigitalHumanStrategy(...);
      default:
        throw new Error(`No strategy implemented for language ${languageCode}`);
    }
  }
}
