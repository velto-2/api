import { Injectable, Logger } from '@nestjs/common';

export interface PerformanceMetrics {
  stage: string;
  duration: number; // milliseconds
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface CallPerformanceMetrics {
  callId: string;
  totalDuration: number;
  stages: PerformanceMetrics[];
  transcriptionDuration?: number;
  evaluationDuration?: number;
  storageDuration?: number;
  apiCalls: {
    count: number;
    totalDuration: number;
    averageDuration: number;
  };
  databaseQueries: {
    count: number;
    totalDuration: number;
    averageDuration: number;
  };
}

@Injectable()
export class PerformanceMonitorService {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  private metrics: Map<string, CallPerformanceMetrics> = new Map();
  private stageTimers: Map<string, Map<string, number>> = new Map();

  startStage(callId: string, stage: string): void {
    if (!this.stageTimers.has(callId)) {
      this.stageTimers.set(callId, new Map());
    }
    const timers = this.stageTimers.get(callId)!;
    timers.set(stage, Date.now());
  }

  endStage(callId: string, stage: string, metadata?: Record<string, any>): number {
    const timers = this.stageTimers.get(callId);
    if (!timers || !timers.has(stage)) {
      this.logger.warn(`No start time found for stage ${stage} in call ${callId}`);
      return 0;
    }

    const startTime = timers.get(stage)!;
    const duration = Date.now() - startTime;
    timers.delete(stage);

    this.recordMetric(callId, stage, duration, metadata);
    return duration;
  }

  recordMetric(
    callId: string,
    stage: string,
    duration: number,
    metadata?: Record<string, any>,
  ): void {
    if (!this.metrics.has(callId)) {
      this.metrics.set(callId, {
        callId,
        totalDuration: 0,
        stages: [],
        apiCalls: { count: 0, totalDuration: 0, averageDuration: 0 },
        databaseQueries: { count: 0, totalDuration: 0, averageDuration: 0 },
      });
    }

    const metrics = this.metrics.get(callId)!;
    metrics.stages.push({
      stage,
      duration,
      timestamp: new Date(),
      metadata,
    });

    // Update stage-specific durations
    if (stage === 'transcription') {
      metrics.transcriptionDuration = duration;
    } else if (stage === 'evaluation') {
      metrics.evaluationDuration = duration;
    } else if (stage === 'storage') {
      metrics.storageDuration = duration;
    }

    // Update totals
    metrics.totalDuration = metrics.stages.reduce((sum, s) => sum + s.duration, 0);
  }

  recordApiCall(callId: string, duration: number): void {
    if (!this.metrics.has(callId)) {
      this.metrics.set(callId, {
        callId,
        totalDuration: 0,
        stages: [],
        apiCalls: { count: 0, totalDuration: 0, averageDuration: 0 },
        databaseQueries: { count: 0, totalDuration: 0, averageDuration: 0 },
      });
    }

    const metrics = this.metrics.get(callId)!;
    metrics.apiCalls.count++;
    metrics.apiCalls.totalDuration += duration;
    metrics.apiCalls.averageDuration =
      metrics.apiCalls.totalDuration / metrics.apiCalls.count;
  }

  recordDatabaseQuery(callId: string, duration: number): void {
    if (!this.metrics.has(callId)) {
      this.metrics.set(callId, {
        callId,
        totalDuration: 0,
        stages: [],
        apiCalls: { count: 0, totalDuration: 0, averageDuration: 0 },
        databaseQueries: { count: 0, totalDuration: 0, averageDuration: 0 },
      });
    }

    const metrics = this.metrics.get(callId)!;
    metrics.databaseQueries.count++;
    metrics.databaseQueries.totalDuration += duration;
    metrics.databaseQueries.averageDuration =
      metrics.databaseQueries.totalDuration / metrics.databaseQueries.count;
  }

  getMetrics(callId: string): CallPerformanceMetrics | null {
    return this.metrics.get(callId) || null;
  }

  finalizeCall(callId: string): CallPerformanceMetrics | null {
    const metrics = this.metrics.get(callId);
    if (!metrics) return null;

    // Log performance summary
    this.logger.log(
      `Performance metrics for call ${callId}: ` +
        `Total: ${metrics.totalDuration}ms, ` +
        `Transcription: ${metrics.transcriptionDuration || 0}ms, ` +
        `Evaluation: ${metrics.evaluationDuration || 0}ms, ` +
        `API Calls: ${metrics.apiCalls.count} (avg: ${metrics.apiCalls.averageDuration.toFixed(2)}ms), ` +
        `DB Queries: ${metrics.databaseQueries.count} (avg: ${metrics.databaseQueries.averageDuration.toFixed(2)}ms)`,
    );

    // Clean up timers
    this.stageTimers.delete(callId);

    return metrics;
  }

  getAggregateMetrics(
    customerId?: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): {
    averageProcessingTime: number;
    averageTranscriptionTime: number;
    averageEvaluationTime: number;
    totalCalls: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const allMetrics = Array.from(this.metrics.values());
    const durations = allMetrics.map((m) => m.totalDuration);

    if (durations.length === 0) {
      return {
        averageProcessingTime: 0,
        averageTranscriptionTime: 0,
        averageEvaluationTime: 0,
        totalCalls: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    const transcriptionTimes = allMetrics
      .map((m) => m.transcriptionDuration || 0)
      .filter((t) => t > 0);
    const evaluationTimes = allMetrics
      .map((m) => m.evaluationDuration || 0)
      .filter((t) => t > 0);

    return {
      averageProcessingTime:
        durations.reduce((sum, d) => sum + d, 0) / durations.length,
      averageTranscriptionTime:
        transcriptionTimes.length > 0
          ? transcriptionTimes.reduce((sum, t) => sum + t, 0) / transcriptionTimes.length
          : 0,
      averageEvaluationTime:
        evaluationTimes.length > 0
          ? evaluationTimes.reduce((sum, t) => sum + t, 0) / evaluationTimes.length
          : 0,
      totalCalls: durations.length,
      p50,
      p95,
      p99,
    };
  }

  clearMetrics(callId: string): void {
    this.metrics.delete(callId);
    this.stageTimers.delete(callId);
  }
}

