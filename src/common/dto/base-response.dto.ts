import { ApiProperty } from '@nestjs/swagger';

export class BaseResponseDto<T = any> {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  data?: T;

  @ApiProperty()
  error?: {
    code?: string;
    details?: any;
  };

  @ApiProperty()
  meta?: {
    timestamp: string;
    path: string;
    version: string;
  };

  constructor(
    success: boolean,
    message: string,
    data?: T,
    error?: { code?: string; details?: any },
  ) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.error = error;
    this.meta = {
      timestamp: new Date().toISOString(),
      path: '',
      version: '1.0.0',
    };
  }

  static success<T>(message: string, data?: T): BaseResponseDto<T> {
    return new BaseResponseDto(true, message, data);
  }

  static error(message: string, error?: { code?: string; details?: any }): BaseResponseDto {
    return new BaseResponseDto(false, message, undefined, error);
  }
}