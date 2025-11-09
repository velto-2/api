import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

interface WebhookConfig {
  url: string;
  secret?: string;
  events: string[];
}

interface WebhookPayload {
  event: string;
  callId: string;
  timestamp: string;
  data: any;
  signature?: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly defaultWebhooks: Map<string, WebhookConfig[]> = new Map();

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    // Load webhook configs from environment or database
    this.loadWebhookConfigs();
  }

  private loadWebhookConfigs(): void {
    // For now, load from environment variables
    // In production, this would come from database
    const webhookUrl = this.configService.get<string>('WEBHOOK_URL');
    const webhookSecret = this.configService.get<string>('WEBHOOK_SECRET');
    
    if (webhookUrl) {
      this.defaultWebhooks.set('default-customer', [{
        url: webhookUrl,
        secret: webhookSecret,
        events: ['call.completed', 'call.failed'],
      }]);
    }
  }

  async sendWebhook(
    customerId: string,
    event: 'call.completed' | 'call.failed',
    callId: string,
    data: any,
  ): Promise<void> {
    const webhooks = this.defaultWebhooks.get(customerId) || [];
    
    if (webhooks.length === 0) {
      this.logger.debug(`No webhooks configured for customer ${customerId}`);
      return;
    }

    const payload: WebhookPayload = {
      event,
      callId,
      timestamp: new Date().toISOString(),
      data,
    };

    // Send to all configured webhooks for this customer
    const promises = webhooks
      .filter((config) => config.events.includes(event))
      .map((config) => this.sendWebhookRequest(config, payload));

    await Promise.allSettled(promises);
  }

  private async sendWebhookRequest(
    config: WebhookConfig,
    payload: WebhookPayload,
    retryCount = 0,
  ): Promise<void> {
    const maxRetries = 3;
    
    try {
      // Generate signature if secret is provided
      if (config.secret) {
        const signature = this.generateSignature(JSON.stringify(payload), config.secret);
        payload.signature = `sha256=${signature}`;
      }

      const response = await firstValueFrom(
        this.httpService.post(config.url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Velto-Webhook/1.0',
          },
          timeout: 10000, // 10 second timeout
        }),
      );

      this.logger.log(
        `Webhook sent successfully to ${config.url} for event ${payload.event}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Webhook delivery failed to ${config.url}: ${error.message}`,
      );

      // Retry with exponential backoff
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        this.logger.log(
          `Retrying webhook delivery in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`,
        );
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendWebhookRequest(config, payload, retryCount + 1);
      }

      this.logger.error(
        `Webhook delivery failed after ${maxRetries} retries to ${config.url}`,
      );
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  async addWebhookConfig(
    customerId: string,
    config: WebhookConfig,
  ): Promise<void> {
    const existing = this.defaultWebhooks.get(customerId) || [];
    existing.push(config);
    this.defaultWebhooks.set(customerId, existing);
    this.logger.log(`Added webhook config for customer ${customerId}`);
  }

  async removeWebhookConfig(
    customerId: string,
    url: string,
  ): Promise<void> {
    const existing = this.defaultWebhooks.get(customerId) || [];
    const filtered = existing.filter((config) => config.url !== url);
    this.defaultWebhooks.set(customerId, filtered);
    this.logger.log(`Removed webhook config for customer ${customerId}`);
  }
}

