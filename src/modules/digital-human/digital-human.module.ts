import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DigitalHumanService } from './digital-human.service';
import { LLMService } from './services/llm.service';
import { CloudflareLLMProvider } from './providers/cloudflare-llm.provider';
import { HuggingFaceLLMProvider } from './providers/huggingface-llm.provider';

@Module({
  imports: [HttpModule],
  providers: [
    DigitalHumanService,
    LLMService,
    CloudflareLLMProvider,
    HuggingFaceLLMProvider,
  ],
  exports: [DigitalHumanService, LLMService],
})
export class DigitalHumanModule {}
