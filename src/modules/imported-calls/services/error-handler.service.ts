import { Injectable, Logger } from '@nestjs/common';

export enum ErrorType {
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
  EVALUATION_FAILED = 'EVALUATION_FAILED',
  STORAGE_FAILED = 'STORAGE_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ProcessedError {
  type: ErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  retryAfter?: number; // seconds
  details?: any;
}

@Injectable()
export class ErrorHandlerService {
  private readonly logger = new Logger(ErrorHandlerService.name);

  processError(error: any): ProcessedError {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const errorString = errorMessage.toLowerCase();

    // Transcription errors
    if (
      errorString.includes('transcription') ||
      errorString.includes('whisper') ||
      errorString.includes('stt') ||
      error?.response?.data?.errors?.[0]?.code === 3016 ||
      error?.response?.data?.errors?.[0]?.code === 5006
    ) {
      return {
        type: ErrorType.TRANSCRIPTION_FAILED,
        message: errorMessage,
        userMessage: 'Failed to transcribe audio. Please check the audio file format and try again.',
        retryable: true,
        retryAfter: 60,
        details: error.response?.data,
      };
    }

    // Network/API errors
    if (
      errorString.includes('network') ||
      errorString.includes('timeout') ||
      errorString.includes('econnrefused') ||
      error?.code === 'ECONNREFUSED' ||
      error?.code === 'ETIMEDOUT'
    ) {
      return {
        type: ErrorType.NETWORK_ERROR,
        message: errorMessage,
        userMessage: 'Network error occurred. Please check your connection and try again.',
        retryable: true,
        retryAfter: 30,
      };
    }

    // Storage errors
    if (
      errorString.includes('storage') ||
      errorString.includes('file') ||
      errorString.includes('r2') ||
      errorString.includes('enoent')
    ) {
      return {
        type: ErrorType.STORAGE_FAILED,
        message: errorMessage,
        userMessage: 'Failed to access storage. Please try uploading again.',
        retryable: true,
        retryAfter: 60,
      };
    }

    // Validation errors
    if (
      errorString.includes('validation') ||
      errorString.includes('invalid') ||
      errorString.includes('required')
    ) {
      return {
        type: ErrorType.VALIDATION_FAILED,
        message: errorMessage,
        userMessage: 'Invalid input. Please check your file and metadata.',
        retryable: false,
      };
    }

    // Timeout errors
    if (errorString.includes('timeout') || error?.code === 'ETIMEDOUT') {
      return {
        type: ErrorType.TIMEOUT_ERROR,
        message: errorMessage,
        userMessage: 'Request timed out. The file might be too large. Please try again.',
        retryable: true,
        retryAfter: 120,
      };
    }

    // Default
    return {
      type: ErrorType.UNKNOWN_ERROR,
      message: errorMessage,
      userMessage: 'An unexpected error occurred. Please try again or contact support.',
      retryable: true,
      retryAfter: 60,
      details: error,
    };
  }

  shouldRetry(error: ProcessedError, retryCount: number, maxRetries = 3): boolean {
    if (!error.retryable) return false;
    if (retryCount >= maxRetries) return false;
    return true;
  }

  getRetryDelay(error: ProcessedError, retryCount: number): number {
    const baseDelay = error.retryAfter || 60;
    // Exponential backoff: baseDelay * 2^retryCount
    return baseDelay * Math.pow(2, retryCount);
  }
}

