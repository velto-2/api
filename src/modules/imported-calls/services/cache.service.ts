import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private readonly defaultTTL = 60 * 60 * 1000; // 1 hour in milliseconds

  /**
   * Generate cache key for transcript based on audio file hash
   */
  generateTranscriptKey(audioBuffer: Buffer): string {
    const hash = crypto.createHash('sha256').update(audioBuffer).digest('hex');
    return `transcript:${hash}`;
  }

  /**
   * Generate cache key for evaluation result
   */
  generateEvaluationKey(callId: string): string {
    return `evaluation:${callId}`;
  }

  /**
   * Generate cache key for customer config
   */
  generateCustomerConfigKey(customerId: string): string {
    return `customer:${customerId}:config`;
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };
    this.memoryCache.set(key, entry);
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
  }

  /**
   * Clear all cache entries matching a pattern
   */
  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];
    
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach((key) => this.memoryCache.delete(key));
    this.logger.log(`Cleared ${keysToDelete.length} cache entries matching pattern: ${pattern}`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    expiredEntries: number;
    activeEntries: number;
    memoryUsage: number;
  } {
    const now = Date.now();
    let expiredCount = 0;
    let activeCount = 0;

    for (const entry of this.memoryCache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredCount++;
      } else {
        activeCount++;
      }
    }

    // Estimate memory usage (rough calculation)
    let memoryUsage = 0;
    for (const entry of this.memoryCache.values()) {
      memoryUsage += JSON.stringify(entry.data).length * 2; // Rough estimate (2 bytes per char)
    }

    return {
      totalEntries: this.memoryCache.size,
      expiredEntries: expiredCount,
      activeEntries: activeCount,
      memoryUsage,
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.memoryCache.delete(key));
    
    if (keysToDelete.length > 0) {
      this.logger.log(`Cleaned ${keysToDelete.length} expired cache entries`);
    }

    return keysToDelete.length;
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    const count = this.memoryCache.size;
    this.memoryCache.clear();
    this.logger.log(`Cleared all ${count} cache entries`);
  }
}

