import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storagePath: string;

  constructor(private configService: ConfigService) {
    this.storagePath = this.configService.get<string>('STORAGE_PATH') || './storage';
  }

  async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create storage directory', error);
    }
  }

  async saveFile(
    customerId: string,
    callId: string,
    file: Buffer,
    extension: string,
  ): Promise<string> {
    await this.ensureStorageDir();
    const dir = path.join(this.storagePath, customerId, callId);
    await fs.mkdir(dir, { recursive: true });
    const fileName = `audio.${extension}`;
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, file);
    return filePath;
  }

  async getFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  generateR2Key(customerId: string, callId: string, extension: string): string {
    return `customers/${customerId}/calls/${callId}/audio.${extension}`;
  }

  generateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      // Also try to remove parent directory if empty
      const dir = path.dirname(filePath);
      try {
        const files = await fs.readdir(dir);
        if (files.length === 0) {
          await fs.rmdir(dir);
        }
      } catch {
        // Ignore if directory not empty or doesn't exist
      }
    } catch (error) {
      this.logger.warn(`Failed to delete file ${filePath}`, error);
      // Don't throw - file might already be deleted
    }
  }
}

