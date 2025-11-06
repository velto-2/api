import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseResponseDto } from '../dto/base-response.dto';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();
    const message = typeof exceptionResponse === 'string' 
      ? exceptionResponse 
      : (exceptionResponse as any)?.message || 'An error occurred';

    const errorResponse = BaseResponseDto.error(
      Array.isArray(message) ? message[0] : message,
      {
        code: HttpStatus[status],
        details: typeof exceptionResponse === 'object' ? exceptionResponse : null,
      },
    );

    errorResponse.meta = {
      timestamp: new Date().toISOString(),
      path: request.url,
      version: '1.0.0',
    };

    this.logger.error(
      `HTTP ${status} Error: ${JSON.stringify({
        message,
        path: request.url,
        method: request.method,
        userId: (request as any).user?.userId,
      })}`,
    );

    response.status(status).json(errorResponse);
  }
}