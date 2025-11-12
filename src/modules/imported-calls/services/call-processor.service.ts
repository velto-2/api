import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ImportedCallsService } from '../imported-calls.service';
import { AgentKnowledgeBaseService } from './agent-knowledge-base.service';
import { StorageService } from './storage.service';
import { SpeechService } from '../../speech/services/speech.service';
import { WebhookService } from './webhook.service';
import { ErrorHandlerService } from './error-handler.service';
import { PerformanceMonitorService } from './performance-monitor.service';
import { CacheService } from './cache.service';
import { ImportedCallDocument } from '../schemas';
import { getLanguageConfig } from '../../../common/constants/languages.constant';
import { LLMService } from '../../digital-human/services/llm.service';
import { AgentsService } from '../../agents/agents.service';

@Injectable()
export class CallProcessorService {
  private readonly logger = new Logger(CallProcessorService.name);

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      flac: 'audio/flac',
      ogg: 'audio/ogg',
      webm: 'audio/webm',
      m4a: 'audio/mp4',
    };
    return mimeTypes[extension] || 'audio/mpeg';
  }

  constructor(
    private importedCallsService: ImportedCallsService,
    private knowledgeBaseService: AgentKnowledgeBaseService,
    private storageService: StorageService,
    private speechService: SpeechService,
    private webhookService: WebhookService,
    private errorHandler: ErrorHandlerService,
    private performanceMonitor: PerformanceMonitorService,
    private cacheService: CacheService,
    private httpService: HttpService,
    private configService: ConfigService,
    private llmService: LLMService,
    private agentsService: AgentsService,
  ) {}

  async processCall(callId: string): Promise<void> {
    const call = await this.importedCallsService.findById(callId);
    this.logger.log(`Processing call ${callId}`);

    const overallStartTime = Date.now();
    this.performanceMonitor.startStage(callId, 'overall');

    try {
      await this.updateStatus(call, 'processing', 'Starting processing');

      // Stage 1: Transcription
      this.performanceMonitor.startStage(callId, 'transcription');
      await this.updateStatus(call, 'transcribing', 'Transcribing audio');
      await this.transcribe(call);
      const transcriptionDuration = this.performanceMonitor.endStage(
        callId,
        'transcription',
        {
          fileName: call.fileName,
          fileSize: call.fileSize,
        },
      );

      // Stage 2: Evaluation (basic for now)
      // Refetch call to get updated transcripts
      this.performanceMonitor.startStage(callId, 'evaluation');
      const updatedCall = await this.importedCallsService.findById(callId);
      await this.updateStatus(updatedCall, 'evaluating', 'Evaluating call');
      await this.evaluate(updatedCall);
      const evaluationDuration = this.performanceMonitor.endStage(
        callId,
        'evaluation',
      );

      // Refetch again to get final state
      const finalCall = await this.importedCallsService.findById(callId);
      const overallDuration = this.performanceMonitor.endStage(
        callId,
        'overall',
      );

      // Store performance metrics
      const metrics = this.performanceMonitor.finalizeCall(callId);
      if (metrics) {
        await this.importedCallsService.update(callId, {
          processingDuration: overallDuration,
          processingStartedAt: new Date(overallStartTime),
          processingCompletedAt: new Date(),
        });
      }

      await this.updateStatus(finalCall, 'completed', 'Processing complete');
      this.logger.log(
        `Call ${callId} processing completed successfully in ${overallDuration}ms ` +
          `(transcription: ${transcriptionDuration}ms, evaluation: ${evaluationDuration}ms)`,
      );

      // Send webhook notification
      await this.webhookService.sendWebhook(
        finalCall.customerId,
        'call.completed',
        callId,
        {
          overallScore: finalCall.evaluation?.overallScore,
          grade: finalCall.evaluation?.grade,
          criticalIssues: finalCall.evaluation?.criticalIssues || [],
          evaluation: finalCall.evaluation,
        },
      );
    } catch (error) {
      const processedError = this.errorHandler.processError(error);
      this.logger.error(
        `Processing failed for call ${callId}: ${processedError.type}`,
        error,
      );

      const errorDetails = {
        type: processedError.type,
        message: processedError.userMessage,
        technicalMessage: processedError.message,
        retryable: processedError.retryable,
        retryAfter: processedError.retryAfter,
        retryCount: call.retryCount || 0,
        details: processedError.details,
      };

      await this.updateStatus(call, 'failed', processedError.userMessage);

      // Update call with detailed error information
      await this.importedCallsService.update(callId, {
        error: JSON.stringify(errorDetails),
      });

      // Send webhook notification for failure
      await this.webhookService.sendWebhook(
        call.customerId,
        'call.failed',
        callId,
        {
          error: processedError.userMessage,
          errorType: processedError.type,
          retryable: processedError.retryable,
          status: 'failed',
        },
      );
    }
  }

  private async transcribe(call: ImportedCallDocument): Promise<void> {
    if (!call.r2Key) throw new Error('No file path available');

    const filePath = call.r2Key;

    // Track storage operation
    const storageStart = Date.now();
    const audioBuffer = await this.storageService.getFile(filePath);
    this.performanceMonitor.recordDatabaseQuery(
      (call._id as any).toString(),
      Date.now() - storageStart,
    );

    // Log audio file details for debugging
    const audioSizeMB = audioBuffer.length / (1024 * 1024);
    this.logger.log(
      `Audio file loaded: ${audioSizeMB.toFixed(2)} MB (${audioBuffer.length} bytes), expected size: ${call.fileSize} bytes`,
    );
    
    // Verify we got the full file
    if (call.fileSize && Math.abs(audioBuffer.length - call.fileSize) > 1000) {
      this.logger.warn(
        `Audio buffer size mismatch: loaded ${audioBuffer.length} bytes, expected ${call.fileSize} bytes`,
      );
    }

    // Check cache for existing transcript
    const cacheKey = this.cacheService.generateTranscriptKey(audioBuffer);
    const cachedTranscript = this.cacheService.get<{
      text: string;
      language: string;
      transcripts: any[];
    }>(cacheKey);

    if (cachedTranscript) {
      this.logger.log(`Using cached transcript for call ${call._id}`);
      await this.importedCallsService.update((call._id as any).toString(), {
        transcripts: cachedTranscript.transcripts,
        metadata: {
          ...call.metadata,
          language: cachedTranscript.language,
        },
      });
      return;
    }

    // Extract file extension from fileName to determine MIME type
    const extension = call.fileName?.split('.').pop()?.toLowerCase() || 'mp3';
    const mimeType = this.getMimeType(extension);

    // Determine language: use agent's language if available, otherwise auto-detect
    let languageCode = 'auto';
    if (call.metadata?.agentId) {
      try {
        let agent;
        // Try to find agent - if customerId is available, use it; otherwise search by agentId
        if (call.customerId && call.customerId !== 'default-customer') {
          agent = await this.agentsService.findOne(
            call.customerId,
            call.metadata.agentId,
          );
        } else {
          // If no customerId, search by agentId alone (should be unique per organization)
          const agents = await this.agentsService.findAll({
            agentId: call.metadata.agentId,
            isActive: true,
          });
          agent = agents.length > 0 ? agents[0] : null;
        }

        if (agent?.language) {
          languageCode = agent.language;
          this.logger.log(
            `Using agent language: ${languageCode} for call ${call._id}`,
          );
        }
      } catch (error: any) {
        this.logger.warn(
          `Could not fetch agent ${call.metadata.agentId}, using auto-detect: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Starting transcription for call ${call._id}${languageCode !== 'auto' ? ` (language: ${languageCode})` : ' (auto-detect)'}`,
    );
    const apiStart = Date.now();
    const result = await this.speechService.transcribe(
      audioBuffer,
      languageCode,
      {
        mimeType,
      },
    );
    this.performanceMonitor.recordApiCall(
      (call._id as any).toString(),
      Date.now() - apiStart,
    );

    // Simple language detection from text if Cloudflare didn't return it
    let detectedLanguage = result.language || 'unknown';
    if (detectedLanguage === 'unknown' && result.text) {
      detectedLanguage = this.detectLanguageFromText(result.text);
    }

    // Log transcription details
    const transcriptionLength = result.text?.length || 0;
    const estimatedWords = transcriptionLength / 5; // Rough estimate: 5 chars per word
    this.logger.log(
      `Transcription completed: ${transcriptionLength} chars (~${Math.round(estimatedWords)} words), language: ${detectedLanguage}`,
    );
    
    // Log duration if available
    if (result.duration) {
      this.logger.log(`Transcribed duration: ${result.duration}s`);
    }
    
    // Warn if transcription seems short for the file size
    if (call.fileSize && audioSizeMB > 1 && transcriptionLength < 100) {
      this.logger.warn(
        `Transcription seems short (${transcriptionLength} chars) for a ${audioSizeMB.toFixed(2)} MB file. This might indicate incomplete transcription.`,
      );
    }

    // Basic speaker diarization: split text into sentences and alternate speakers
    const transcripts = this.performBasicDiarization(
      result.text,
      result.duration ? result.duration * 1000 : 0,
      result.confidence || 0.9,
      detectedLanguage,
    );

    // Cache transcript result (never expires - permanent cache)
    this.cacheService.set(
      cacheKey,
      {
        text: result.text,
        language: detectedLanguage,
        transcripts,
      },
      0, // 0 = never expire
    );

    await this.importedCallsService.update((call._id as any).toString(), {
      transcripts,
      metadata: {
        ...call.metadata,
        language: detectedLanguage,
      },
    });
  }

  private async evaluate(call: ImportedCallDocument): Promise<void> {
    this.logger.log(`Starting evaluation for call ${call._id}`);
    this.logger.log(`Transcripts available: ${call.transcripts?.length || 0}`);
    if (call.transcripts?.length > 0) {
      this.logger.log(
        `First transcript message length: ${call.transcripts[0]?.message?.length || 0}`,
      );
    }

    const evaluation: any = {
      overallScore: 0,
      grade: 'F',
      processedAt: new Date(),
      evaluationVersion: '1.0',
    };

    // Basic latency calculation
    if (call.transcripts && call.transcripts.length > 0) {
      const latency = this.calculateLatency(call.transcripts);
      evaluation.latency = latency;
      this.logger.log(`Latency calculated: score ${latency.score}`);
    }

    // Basic disconnection analysis
    const disconnection = this.analyzeDisconnection(call.transcripts || []);
    evaluation.disconnection = disconnection;
    this.logger.log(`Disconnection analyzed: score ${disconnection.score}`);

    // Basic jobs-to-be-done (with knowledge base if available)
    const agentId = call.metadata?.agentId;
    const jobsToBeDone = agentId
      ? await this.analyzeJobsToBeDone(call.transcripts || [], agentId)
      : await this.analyzeJobsToBeDone(call.transcripts || []);
    evaluation.jobsToBeDone = jobsToBeDone;
    this.logger.log(`Jobs-to-be-done analyzed: score ${jobsToBeDone.score}`);

    // Interruption analysis
    const interruption = this.analyzeInterruption(call.transcripts || []);
    evaluation.interruption = interruption;
    this.logger.log(`Interruption analyzed: score ${interruption.score}`);

    // Pronunciation analysis
    const pronunciation = this.analyzePronunciation(call.transcripts || []);
    evaluation.pronunciation = pronunciation;
    this.logger.log(`Pronunciation analyzed: score ${pronunciation.score}`);

    // Repetition analysis
    const repetition = this.analyzeRepetition(call.transcripts || []);
    evaluation.repetition = repetition;
    this.logger.log(`Repetition analyzed: score ${repetition.score}`);

    // Calculate overall score (all 6 metrics)
    const scores = [
      evaluation.latency?.score || 0,
      evaluation.disconnection?.score || 0,
      evaluation.jobsToBeDone?.score || 0,
      evaluation.interruption?.score || 0,
      evaluation.pronunciation?.score || 0,
      evaluation.repetition?.score || 0,
    ].filter((s) => s > 0);

    evaluation.overallScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

    evaluation.grade = this.getGrade(evaluation.overallScore);

    // Generate critical issues and recommendations
    evaluation.criticalIssues = this.identifyCriticalIssues(evaluation);
    evaluation.recommendations = this.generateRecommendations(evaluation);

    this.logger.log(
      `Evaluation completed: overall score ${evaluation.overallScore}, grade ${evaluation.grade}`,
    );

    // Cache evaluation result (7 days TTL)
    const evaluationCacheKey = this.cacheService.generateEvaluationKey(
      (call._id as any).toString(),
    );
    this.cacheService.set(
      evaluationCacheKey,
      evaluation,
      7 * 24 * 60 * 60 * 1000,
    );

    await this.importedCallsService.update((call._id as any).toString(), {
      evaluation,
    });
  }

  private calculateLatency(transcripts: any[]): any {
    const gaps: number[] = [];

    for (let i = 1; i < transcripts.length; i++) {
      const prev = transcripts[i - 1];
      const curr = transcripts[i];

      if (prev.speaker !== curr.speaker) {
        const gap = curr.timestamp - (prev.timestamp + (prev.duration || 0));
        if (gap > 100 && gap < 10000) {
          gaps.push(gap);
        }
      }
    }

    if (gaps.length === 0) {
      return { score: 100, averageResponseTime: 0 };
    }

    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sorted = [...gaps].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    let score = 100;
    if (p95 > 2500) score = 50;
    else if (p95 > 2000) score = 60;
    else if (p95 > 1500) score = 75;
    else if (p95 > 800) score = 90;

    return {
      averageResponseTime: Math.round(avg),
      medianResponseTime: sorted[Math.floor(sorted.length / 2)],
      p95ResponseTime: p95,
      score,
    };
  }

  private analyzeDisconnection(transcripts: any[]): any {
    if (transcripts.length === 0 || !transcripts[0]?.message) {
      this.logger.warn('No transcripts available for disconnection analysis');
      return { score: 0, wasNaturalEnding: false };
    }

    const last = transcripts[transcripts.length - 1];
    const lastText = (last.message || '').toLowerCase();

    if (!lastText) {
      this.logger.warn('Empty transcript message for disconnection analysis');
      return { score: 0, wasNaturalEnding: false };
    }

    const naturalEndings = [
      'goodbye',
      'thank you',
      'thanks',
      'bye',
      'have a nice day',
      'مع السلامة',
      'باي',
      'شكرا',
    ];
    const wasNatural = naturalEndings.some((ending) =>
      lastText.includes(ending),
    );

    return {
      wasNaturalEnding: wasNatural,
      disconnectionType: wasNatural ? 'natural' : 'abrupt',
      score: wasNatural ? 90 : 50,
    };
  }

  private async analyzeJobsToBeDone(
    transcripts: any[],
    agentId?: string,
  ): Promise<any> {
    if (transcripts.length === 0 || !transcripts[0]?.message) {
      this.logger.warn('No transcripts available for jobs-to-be-done analysis');
      return { score: 0, wasTaskCompleted: false };
    }

    // Try to use knowledge base if agentId is provided
    if (agentId) {
      try {
        const knowledgeBase =
          await this.knowledgeBaseService.findByAgentId(agentId);
        if (knowledgeBase && knowledgeBase.expectedJobs.length > 0) {
          return await this.analyzeJobsToBeDoneWithKnowledgeBase(
            transcripts,
            knowledgeBase,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to use knowledge base for agent ${agentId}, falling back to generic analysis: ${error.message}`,
        );
      }
    }

    // Fallback to generic analysis
    return this.analyzeJobsToBeDoneGeneric(transcripts);
  }

  private async analyzeJobsToBeDoneWithKnowledgeBase(
    transcripts: any[],
    knowledgeBase: any,
  ): Promise<any> {
    const conversationText = transcripts
      .map((t) => `${t.speaker}: ${t.message}`)
      .join('\n');

    const jobsDescription = knowledgeBase.expectedJobs
      .map(
        (job: any) =>
          `- ${job.name}: ${job.description || ''}\n  Required steps: ${(job.requiredSteps || []).join(', ')}`,
      )
      .join('\n');

    const prompt = `Analyze this customer service conversation against the agent's expected jobs.

Agent's Expected Jobs:
${jobsDescription}

Conversation:
${conversationText}

Determine:
1. Which expected job(s) were attempted?
2. Were the required steps completed?
3. Was the job successfully completed?
4. Rate completion on a scale of 0-100.

Respond in JSON format only:
{
  "attemptedJobs": ["job-id-1"],
  "completedJobs": ["job-id-1"],
  "missingSteps": [],
  "score": 85,
  "reason": "Job was completed successfully"
}`;

    try {
      // Determine language from transcripts or default to Arabic
      const detectedLanguage = transcripts[0]?.language || 'ar';
      const languageCode = detectedLanguage.split('-')[0].toLowerCase(); // en-US -> en

      this.logger.log(
        `Analyzing jobs-to-be-done using LLM for language: ${languageCode}`,
      );

      const response = await this.llmService.generate(
        [{ role: 'user', content: prompt }],
        languageCode,
        {
          maxTokens: 300,
          temperature: 0.3,
        },
      );

      const responseText = response.text;

      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          wasTaskCompleted: (parsed.completedJobs || []).length > 0,
          attemptedJobs: parsed.attemptedJobs || [],
          completedJobs: parsed.completedJobs || [],
          missingSteps: parsed.missingSteps || [],
          score: parsed.score || 0,
          reason: parsed.reason || '',
          analysisMethod: 'knowledge-base',
        };
      }
    } catch (error) {
      this.logger.warn(
        `Failed to analyze with knowledge base: ${error.message}, falling back to generic`,
      );
    }

    return this.analyzeJobsToBeDoneGeneric(transcripts);
  }

  private analyzeJobsToBeDoneGeneric(transcripts: any[]): any {
    const allText = transcripts
      .map((t) => t.message || '')
      .join(' ')
      .toLowerCase();

    if (!allText.trim()) {
      this.logger.warn('Empty transcript text for jobs-to-be-done analysis');
      return { score: 0, wasTaskCompleted: false };
    }

    const completionKeywords = [
      'done',
      'completed',
      'finished',
      'resolved',
      'fixed',
      'updated',
      'تم',
      'انتهى',
      'اكتمل',
    ];
    const hasCompletion = completionKeywords.some((kw) => allText.includes(kw));

    const taskKeywords = [
      'inform',
      'help',
      'assist',
      'support',
      'service',
      'مساعد',
      'مساعدة',
    ];
    const hasTaskContext = taskKeywords.some((kw) => allText.includes(kw));

    let score = 40;
    if (hasCompletion) {
      score = 80;
    } else if (hasTaskContext) {
      score = 60;
    }

    return {
      wasTaskCompleted: hasCompletion,
      completionScore: score,
      score,
      analysisMethod: 'generic',
    };
  }

  private getGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private async updateStatus(
    call: ImportedCallDocument,
    status: string,
    stage: string,
  ): Promise<void> {
    await this.importedCallsService.update((call._id as any).toString(), {
      status,
      processingStage: stage,
      progressPercentage: this.getProgress(status),
      ...(status === 'processing' && !call.processingStartedAt
        ? { processingStartedAt: new Date() }
        : {}),
      ...(status === 'completed' || status === 'failed'
        ? { processingCompletedAt: new Date() }
        : {}),
    });
  }

  private getProgress(status: string): number {
    const map: Record<string, number> = {
      pending: 0,
      uploading: 10,
      processing: 20,
      transcribing: 60,
      evaluating: 90,
      completed: 100,
      failed: 0,
    };
    return map[status] || 0;
  }

  private detectLanguageFromText(text: string): string {
    // Simple heuristic: check for Arabic characters
    const arabicPattern = /[\u0600-\u06FF]/;
    if (arabicPattern.test(text)) {
      return 'ar';
    }
    // Default to English for Latin script
    return 'en';
  }

  private performBasicDiarization(
    text: string,
    totalDuration: number,
    confidence: number,
    language: string,
  ): any[] {
    if (!text || text.trim().length === 0) {
      return [
        {
          speaker: 'unknown',
          message: text,
          timestamp: 0,
          duration: totalDuration,
          confidence,
          language,
        },
      ];
    }

    // Split by sentence endings
    const sentences = text
      .split(/[.!?]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (sentences.length === 0) {
      return [
        {
          speaker: 'unknown',
          message: text,
          timestamp: 0,
          duration: totalDuration,
          confidence,
          language,
        },
      ];
    }

    const transcripts: any[] = [];
    const durationPerSentence = totalDuration / sentences.length;
    let currentTimestamp = 0;

    // Simple heuristic: first speaker is usually customer, then alternate
    // Also detect common agent phrases
    const agentPhrases = [
      'how can i help',
      'how may i assist',
      'thank you for calling',
      'is there anything else',
      'have a nice day',
      'goodbye',
      'كيف يمكنني المساعدة',
      'شكرا لاتصالك',
    ];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const lowerSentence = sentence.toLowerCase();

      // Determine speaker
      let speaker = 'unknown';
      if (i === 0) {
        // First sentence is usually customer
        speaker = 'customer';
      } else {
        // Check if it looks like an agent phrase
        const isAgentPhrase = agentPhrases.some((phrase) =>
          lowerSentence.includes(phrase),
        );
        if (isAgentPhrase) {
          speaker = 'agent';
        } else {
          // Alternate between customer and agent
          const prevSpeaker = transcripts[transcripts.length - 1]?.speaker;
          speaker = prevSpeaker === 'customer' ? 'agent' : 'customer';
        }
      }

      transcripts.push({
        speaker,
        message: sentence,
        timestamp: Math.round(currentTimestamp),
        duration: Math.round(durationPerSentence),
        confidence,
        language,
      });

      currentTimestamp += durationPerSentence;
    }

    return transcripts;
  }

  private analyzeInterruption(transcripts: any[]): any {
    if (transcripts.length < 2) {
      return { score: 100, totalInterruptions: 0, interruptionRate: 0 };
    }

    let totalInterruptions = 0;
    let agentInterruptions = 0;
    let customerInterruptions = 0;
    const interruptionTimestamps: number[] = [];

    for (let i = 1; i < transcripts.length; i++) {
      const prev = transcripts[i - 1];
      const curr = transcripts[i];

      if (prev.speaker && curr.speaker && prev.speaker !== curr.speaker) {
        const prevEnd = prev.timestamp + (prev.duration || 0);
        const currStart = curr.timestamp;
        const overlap = prevEnd - currStart;

        // Only count if overlap > 500ms (ignore brief overlaps)
        if (overlap > 500) {
          totalInterruptions++;
          interruptionTimestamps.push(curr.timestamp);

          if (curr.speaker === 'agent' || curr.speaker === 'unknown') {
            agentInterruptions++;
          } else {
            customerInterruptions++;
          }
        }
      }
    }

    // Calculate interruption rate per minute
    const callDurationMinutes =
      transcripts.length > 0
        ? (transcripts[transcripts.length - 1].timestamp +
            (transcripts[transcripts.length - 1].duration || 0)) /
          60000
        : 1;
    const interruptionRate =
      callDurationMinutes > 0 ? totalInterruptions / callDurationMinutes : 0;

    // Simple scoring
    let score = 100;
    if (interruptionRate > 4) score = 50;
    else if (interruptionRate > 2) score = 65;
    else if (interruptionRate > 1) score = 80;
    else if (totalInterruptions > 0) score = 90;

    return {
      totalInterruptions,
      agentInterruptionsOnCustomer: agentInterruptions,
      customerInterruptionsOnAgent: customerInterruptions,
      interruptionRate: Math.round(interruptionRate * 100) / 100,
      interruptionTimestamps,
      score,
    };
  }

  private analyzePronunciation(transcripts: any[]): any {
    if (transcripts.length === 0) {
      return { score: 0, overallClarityScore: 0, wordsPerMinute: 0 };
    }

    // Calculate average confidence
    const confidences = transcripts
      .map((t) => t.confidence || 0.9)
      .filter((c) => c > 0);
    const avgConfidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0.9;
    const overallClarityScore = Math.round(avgConfidence * 100);

    // Calculate words per minute
    const allText = transcripts.map((t) => t.message || '').join(' ');
    const wordCount = allText.split(/\s+/).filter((w) => w.length > 0).length;
    const callDurationMinutes =
      transcripts.length > 0
        ? (transcripts[transcripts.length - 1].timestamp +
            (transcripts[transcripts.length - 1].duration || 0)) /
          60000
        : 1;
    const wordsPerMinute =
      callDurationMinutes > 0 ? Math.round(wordCount / callDurationMinutes) : 0;

    // Simple scoring based on confidence and speech rate
    let score = Math.round(avgConfidence * 100);

    // Adjust for speech rate (optimal: 140-160 WPM)
    if (wordsPerMinute > 180 || wordsPerMinute < 120) {
      score = Math.max(0, score - 10);
    }

    return {
      overallClarityScore,
      wordsPerMinute,
      score: Math.min(100, score),
    };
  }

  private analyzeRepetition(transcripts: any[]): any {
    if (transcripts.length < 2) {
      return {
        score: 100,
        exactRepetitions: 0,
        semanticSimilarRepetitions: 0,
        loopDetected: false,
      };
    }

    const messages = transcripts
      .map((t) => (t.message || '').toLowerCase().trim())
      .filter((m) => m.length > 0);
    let exactRepetitions = 0;
    const repeatedPhrases: Array<{ phrase: string; occurrences: number }> = [];

    // Check for exact phrase repetitions (3+ words)
    for (let i = 0; i < messages.length; i++) {
      const words = messages[i].split(/\s+/);
      if (words.length < 3) continue;

      // Check 3-5 word phrases
      for (
        let phraseLen = 3;
        phraseLen <= Math.min(5, words.length);
        phraseLen++
      ) {
        for (let start = 0; start <= words.length - phraseLen; start++) {
          const phrase = words.slice(start, start + phraseLen).join(' ');

          // Count occurrences of this phrase
          let occurrences = 0;
          for (const msg of messages) {
            if (msg.includes(phrase)) {
              occurrences++;
            }
          }

          if (occurrences > 1) {
            exactRepetitions++;
            repeatedPhrases.push({ phrase, occurrences });
            break; // Count each message only once
          }
        }
        if (exactRepetitions > 0) break;
      }
    }

    // Simple loop detection: same message appears 3+ times
    const messageCounts: Record<string, number> = {};
    for (const msg of messages) {
      messageCounts[msg] = (messageCounts[msg] || 0) + 1;
    }
    const loopDetected = Object.values(messageCounts).some(
      (count) => count >= 3,
    );

    // Simple scoring
    let score = 100;
    if (loopDetected) score = 40;
    else if (exactRepetitions > 5) score = 50;
    else if (exactRepetitions > 3) score = 70;
    else if (exactRepetitions > 0) score = 85;

    return {
      exactRepetitions,
      semanticSimilarRepetitions: 0, // Skip for simplicity
      loopDetected,
      repeatedPhrases: repeatedPhrases.slice(0, 5), // Limit to top 5
      score,
    };
  }

  private identifyCriticalIssues(evaluation: any): any[] {
    const issues: any[] = [];

    // Latency issues
    if (evaluation.latency?.p95ResponseTime > 3000) {
      issues.push({
        category: 'latency',
        description: 'Unacceptable response delays detected',
        severity: 'critical',
        affectedMetric: 'latency',
      });
    }

    // Interruption issues
    if (evaluation.interruption?.interruptionRate > 4) {
      issues.push({
        category: 'interruption',
        description: 'Excessive interruptions detected',
        severity: 'critical',
        affectedMetric: 'interruption',
      });
    }

    // Pronunciation issues
    if (evaluation.pronunciation?.overallClarityScore < 60) {
      issues.push({
        category: 'pronunciation',
        description: 'Poor speech clarity',
        severity: 'critical',
        affectedMetric: 'pronunciation',
      });
    }

    // Repetition issues
    if (evaluation.repetition?.loopDetected) {
      issues.push({
        category: 'repetition',
        description: 'Agent stuck in repetition loop',
        severity: 'critical',
        affectedMetric: 'repetition',
      });
    }

    // Disconnection issues
    if (
      evaluation.disconnection?.disconnectionType === 'abrupt' &&
      !evaluation.jobsToBeDone?.wasTaskCompleted
    ) {
      issues.push({
        category: 'disconnection',
        description: 'Customer hung up without resolution',
        severity: 'critical',
        affectedMetric: 'disconnection',
      });
    }

    // Job completion issues
    if (evaluation.jobsToBeDone?.score < 50) {
      issues.push({
        category: 'jobsToBeDone',
        description: 'Failed to complete customer request',
        severity: 'critical',
        affectedMetric: 'jobsToBeDone',
      });
    }

    return issues.slice(0, 5); // Limit to top 5
  }

  private generateRecommendations(evaluation: any): any[] {
    const recommendations: any[] = [];

    if (evaluation.latency?.p95ResponseTime > 2000) {
      recommendations.push({
        title: 'Optimize response latency',
        description:
          'Agent response times are high. Consider optimizing the response generation pipeline.',
        priority: 'high',
        relatedMetrics: ['latency'],
      });
    }

    if (evaluation.interruption?.interruptionRate > 2) {
      recommendations.push({
        title: 'Reduce interruptions',
        description:
          'High interruption rate detected. Adjust agent turn-taking sensitivity.',
        priority: 'high',
        relatedMetrics: ['interruption'],
      });
    }

    if (evaluation.pronunciation?.overallClarityScore < 80) {
      recommendations.push({
        title: 'Improve speech clarity',
        description:
          'Review TTS voice quality settings and pronunciation accuracy.',
        priority: 'medium',
        relatedMetrics: ['pronunciation'],
      });
    }

    if (evaluation.repetition?.exactRepetitions > 3) {
      recommendations.push({
        title: 'Reduce repetition',
        description:
          'Agent is repeating information. Improve context awareness.',
        priority: 'medium',
        relatedMetrics: ['repetition'],
      });
    }

    if (
      evaluation.disconnection?.disconnectionType === 'abrupt' &&
      evaluation.disconnection?.score < 70
    ) {
      recommendations.push({
        title: 'Improve call endings',
        description:
          'Add confirmation steps before ending calls to ensure natural conclusions.',
        priority: 'medium',
        relatedMetrics: ['disconnection'],
      });
    }

    if (evaluation.jobsToBeDone?.score < 70) {
      recommendations.push({
        title: 'Expand agent capabilities',
        description:
          'Agent failed to complete tasks. Consider expanding capability coverage.',
        priority: 'high',
        relatedMetrics: ['jobsToBeDone'],
      });
    }

    return recommendations;
  }
}
