import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SpeechService } from './services/speech.service';
import { TTSService } from './services/tts.service';
import { CloudflareWhisperProvider } from './providers/cloudflare-whisper.provider';
import { SpeechController } from './speech.controller';

@Module({
  imports: [
    HttpModule.register({
      // Don't add any default headers - let each service set exactly what it needs
      timeout: 30000,
    }),
  ],
  providers: [SpeechService, TTSService, CloudflareWhisperProvider],
  controllers: [SpeechController],
  exports: [SpeechService, TTSService],
})
export class SpeechModule {}


