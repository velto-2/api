import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private rateLimitStore: Map<string, RateLimitEntry> = new Map();
  private readonly defaultConfig: RateLimitConfig = {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100, // 100 requests per hour
  };

  // Different rate limits for different endpoints
  private readonly endpointConfigs: Record<string, RateLimitConfig> = {
    upload: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10, // 10 uploads per hour (free tier)
    },
    'bulk-upload': {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5, // 5 bulk uploads per hour
    },
    api: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 1000, // 1000 API calls per hour
    },
  };

  constructor(private configService: ConfigService) {
    // Load rate limit configs from environment
    const uploadLimit = this.configService.get<number>('RATE_LIMIT_UPLOAD');
    const apiLimit = this.configService.get<number>('RATE_LIMIT_API');
    
    if (uploadLimit) {
      this.endpointConfigs.upload.maxRequests = uploadLimit;
    }
    if (apiLimit) {
      this.endpointConfigs.api.maxRequests = apiLimit;
    }

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanExpiredEntries(), 5 * 60 * 1000);
  }

  /**
   * Check if request is allowed based on rate limit
   * @param key - Unique identifier (customerId, IP, etc.)
   * @param endpoint - Endpoint type (upload, bulk-upload, api)
   * @returns { allowed: boolean, remaining: number, resetTime: number }
   */
  checkRateLimit(
    key: string,
    endpoint: string = 'api',
  ): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const config = this.endpointConfigs[endpoint] || this.defaultConfig;
    const now = Date.now();
    const entry = this.rateLimitStore.get(`${key}:${endpoint}`);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired entry
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + config.windowMs,
        firstRequest: now,
      };
      this.rateLimitStore.set(`${key}:${endpoint}`, newEntry);
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: newEntry.resetTime,
      };
    }

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000); // seconds
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter,
      };
    }

    // Increment count
    entry.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(
    key: string,
    endpoint: string = 'api',
  ): {
    count: number;
    limit: number;
    resetTime: number;
    remaining: number;
  } {
    const config = this.endpointConfigs[endpoint] || this.defaultConfig;
    const entry = this.rateLimitStore.get(`${key}:${endpoint}`);

    if (!entry || Date.now() > entry.resetTime) {
      return {
        count: 0,
        limit: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
        remaining: config.maxRequests,
      };
    }

    return {
      count: entry.count,
      limit: config.maxRequests,
      resetTime: entry.resetTime,
      remaining: config.maxRequests - entry.count,
    };
  }

  /**
   * Reset rate limit for a key
   */
  resetRateLimit(key: string, endpoint?: string): void {
    if (endpoint) {
      this.rateLimitStore.delete(`${key}:${endpoint}`);
    } else {
      // Delete all entries for this key
      const keysToDelete: string[] = [];
      for (const storeKey of this.rateLimitStore.keys()) {
        if (storeKey.startsWith(`${key}:`)) {
          keysToDelete.push(storeKey);
        }
      }
      keysToDelete.forEach((k) => this.rateLimitStore.delete(k));
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.rateLimitStore.delete(key));
    
    if (keysToDelete.length > 0) {
      this.logger.debug(`Cleaned ${keysToDelete.length} expired rate limit entries`);
    }
  }

  /**
   * Get rate limit statistics
   */
  getStats(): {
    totalEntries: number;
    activeEntries: number;
    endpoints: Record<string, number>;
  } {
    const now = Date.now();
    let activeCount = 0;
    const endpointCounts: Record<string, number> = {};

    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now <= entry.resetTime) {
        activeCount++;
        const endpoint = key.split(':')[1] || 'unknown';
        endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + 1;
      }
    }

    return {
      totalEntries: this.rateLimitStore.size,
      activeEntries: activeCount,
      endpoints: endpointCounts,
    };
  }
}

