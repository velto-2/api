import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from '../../modules/imported-calls/services/rate-limit.service';
import { Request } from 'express';

export const RATE_LIMIT_KEY = 'rateLimit';
export const RATE_LIMIT_SKIP = 'rateLimitSkip';

export interface RateLimitOptions {
  endpoint?: string;
  keyGenerator?: (request: Request) => string;
}

export const RateLimit = (options?: RateLimitOptions) => {
  return SetMetadata(RATE_LIMIT_KEY, options || {});
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private rateLimitService: RateLimitService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if rate limiting is skipped
    const skip = this.reflector.getAllAndOverride<boolean>(RATE_LIMIT_SKIP, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    
    // Get rate limit options from decorator
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      handler,
    );

    if (!options) {
      // No rate limiting configured for this endpoint
      return true;
    }

    // Generate key (customerId, IP, etc.)
    const key = options.keyGenerator
      ? options.keyGenerator(request)
      : this.getDefaultKey(request);

    const endpoint = options.endpoint || 'api';
    const result = this.rateLimitService.checkRateLimit(key, endpoint);

    if (!result.allowed) {
      const retryAfter = result.retryAfter || 0;
      throw new HttpException(
        {
          message: 'Rate limit exceeded',
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          retryAfter,
          resetTime: result.resetTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Add rate limit headers to response
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', this.getLimitForEndpoint(endpoint));
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    return true;
  }

  private getDefaultKey(request: Request): string {
    // Try to get customerId from request body, query, or params
    const customerId =
      request.body?.customerId ||
      request.query?.customerId ||
      request.params?.customerId ||
      request.body?.metadata?.agentId ||
      'default-customer';

    // Fallback to IP address if no customerId
    const ip =
      request.ip ||
      request.headers['x-forwarded-for']?.toString().split(',')[0] ||
      request.connection.remoteAddress ||
      'unknown';

    return customerId !== 'default-customer' ? customerId : ip;
  }

  private getLimitForEndpoint(endpoint: string): number {
    const limits: Record<string, number> = {
      upload: 10,
      'bulk-upload': 5,
      api: 1000,
    };
    return limits[endpoint] || 1000;
  }
}

