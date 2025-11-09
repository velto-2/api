/**
 * Language Configuration System
 * 
 * This file contains all language-specific configurations in a centralized location.
 * Adding a new language requires only adding configuration here - no code changes needed.
 */

export interface Dialect {
  code: string;
  name: string;
  nativeName: string;
  region: string;
  fillerWords: string[];
  commonGreetings: string[];
  commonFarewells: string[];
  features: {
    formalLevel: 'formal' | 'informal' | 'mixed';
    speedOfSpeech: 'slow' | 'medium' | 'fast';
  };
}

export interface LanguageConfig {
  code: string; // ISO 639-1 (ar, en, es)
  name: string; // Display name
  nativeName: string; // Name in native script
  direction: 'ltr' | 'rtl'; // Text direction

  // Dialect support
  dialects: Dialect[];
  defaultDialect: string;

  // AI Service configurations
  stt: {
    provider: 'whisper' | 'azure' | 'google';
    model?: string;
    languageCode: string; // Provider-specific code
  };

  tts: {
    provider: 'elevenlabs' | 'azure' | 'google';
    voiceId?: string;
    languageCode: string;
  };

  llm: {
    provider: 'cloudflare' | 'anthropic' | 'openai';
    model?: string;
    systemPromptTemplate?: string;
  };

  // Language-specific features
  features: {
    dialectSupport: boolean;
    genderVariation: boolean;
    formalInformalVariation: boolean;
  };

  // Natural speech patterns
  fillerWords: string[];
  commonGreetings: string[];
  commonFarewells: string[];

  // Evaluation criteria (language-specific expectations)
  evaluation: {
    minConfidenceScore: number;
    expectedResponseTime: number; // milliseconds
  };
}

export const LANGUAGES: Record<string, LanguageConfig> = {
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',

    dialects: [
      {
        code: 'egyptian',
        name: 'Egyptian Arabic',
        nativeName: 'مصري',
        region: 'Egypt',
        fillerWords: ['يعني', 'طيب', 'ماشي', 'أصل', 'والله'],
        commonGreetings: ['السلام عليكم', 'أهلاً', 'إزيك'],
        commonFarewells: ['مع السلامة', 'باي', 'يلا باي'],
        features: {
          formalLevel: 'informal',
          speedOfSpeech: 'fast',
        },
      },
      {
        code: 'gulf',
        name: 'Gulf Arabic',
        nativeName: 'خليجي',
        region: 'Gulf Countries',
        fillerWords: ['يعني', 'زين', 'ماشي', 'صح', 'والله'],
        commonGreetings: ['السلام عليكم', 'هلا', 'شلونك'],
        commonFarewells: ['مع السلامة', 'باي', 'الله يعطيك العافية'],
        features: {
          formalLevel: 'mixed',
          speedOfSpeech: 'medium',
        },
      },
    ],
    defaultDialect: 'egyptian',

    stt: {
      provider: 'whisper',
      model: '@cf/openai/whisper',
      languageCode: 'ar',
    },

    tts: {
      provider: 'elevenlabs',
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah - verified Arabic support with multilingual_v2
      languageCode: 'ar',
    },

    llm: {
      provider: 'cloudflare',
      model: '@cf/meta/llama-3.1-8b-instruct',
      systemPromptTemplate: 'arabic-prompt-template',
    },

    features: {
      dialectSupport: true,
      genderVariation: true,
      formalInformalVariation: true,
    },

    fillerWords: ['يعني', 'والله', 'طيب', 'يا', 'أصل'],
    commonGreetings: ['السلام عليكم', 'مرحبا', 'أهلاً'],
    commonFarewells: ['مع السلامة', 'باي', 'يلا باي'],

    evaluation: {
      minConfidenceScore: 0.75,
      expectedResponseTime: 2000, // 2 seconds
    },
  },

  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',

    dialects: [
      {
        code: 'us',
        name: 'American English',
        nativeName: 'American English',
        region: 'United States',
        fillerWords: ['um', 'uh', 'like', 'you know', 'so'],
        commonGreetings: ['hello', 'hi', 'hey'],
        commonFarewells: ['goodbye', 'bye', 'see you'],
        features: {
          formalLevel: 'mixed',
          speedOfSpeech: 'medium',
        },
      },
    ],
    defaultDialect: 'us',

    stt: {
      provider: 'whisper',
      model: '@cf/openai/whisper',
      languageCode: 'en',
    },

    tts: {
      provider: 'elevenlabs',
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
      languageCode: 'en',
    },

    llm: {
      provider: 'cloudflare',
      model: '@cf/meta/llama-3.1-8b-instruct',
    },

    features: {
      dialectSupport: false,
      genderVariation: true,
      formalInformalVariation: true,
    },

    fillerWords: ['um', 'uh', 'like', 'you know'],
    commonGreetings: ['hello', 'hi', 'hey'],
    commonFarewells: ['goodbye', 'bye', 'see you'],

    evaluation: {
      minConfidenceScore: 0.8,
      expectedResponseTime: 1500,
    },
  },
};

/**
 * Get language configuration by code
 * Supports both full codes (en-US) and base codes (en)
 */
export function getLanguageConfig(code: string): LanguageConfig | undefined {
  if (!code) return undefined;
  
  // Try exact match first
  if (LANGUAGES[code]) return LANGUAGES[code];
  
  // Extract base language code (en-US -> en)
  const baseCode = code.split('-')[0].toLowerCase();
  return LANGUAGES[baseCode];
}

/**
 * Get dialect configuration
 */
export function getDialectConfig(
  languageCode: string,
  dialectCode: string,
): Dialect | undefined {
  const language = LANGUAGES[languageCode];
  if (!language) return undefined;

  return language.dialects.find((d) => d.code === dialectCode);
}

/**
 * Check if language is supported
 */
export function isLanguageSupported(code: string): boolean {
  return code in LANGUAGES;
}


