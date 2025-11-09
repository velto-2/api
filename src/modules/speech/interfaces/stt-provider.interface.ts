export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
}

export interface STTProvider {
  transcribe(
    audio: Buffer | string,
    languageCode: string,
    options?: TranscriptionOptions,
  ): Promise<TranscriptionResult>;
  supports(languageCode: string): boolean;
}

export interface TranscriptionOptions {
  model?: string;
  language?: string;
  prompt?: string;
  mimeType?: string;
}


