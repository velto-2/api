import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { SpeechService } from './services/speech.service';
import { TTSService } from './services/tts.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Speech')
@Controller('speech')
export class SpeechController {
  constructor(
    private readonly speechService: SpeechService,
    private readonly ttsService: TTSService,
  ) {}

  @Public()
  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Transcribe audio to text' })
  @ApiResponse({
    status: 200,
    description: 'Transcription result',
  })
  async transcribe(
    @UploadedFile() file: any,
    @Body('languageCode') languageCode: string,
  ) {
    if (!file) {
      throw new Error('Audio file is required');
    }

    return this.speechService.transcribe(
      file.buffer,
      languageCode || 'ar',
    );
  }

  @Public()
  @Post('synthesize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate speech from text' })
  @ApiResponse({
    status: 200,
    description: 'Generated audio file',
    headers: {
      'Content-Type': {
        description: 'audio/mpeg',
        schema: { type: 'string' },
      },
    },
  })
  async synthesize(
    @Body('text') text: string,
    @Body('languageCode') languageCode: string,
  ) {
    if (!text) {
      throw new Error('Text is required');
    }

    const result = await this.ttsService.synthesize(
      text,
      languageCode || 'ar',
    );

    return {
      audio: result.audio.toString('base64'),
      duration: result.duration,
    };
  }

  @Public()
  @Get('voices')
  @ApiOperation({ summary: 'Get available TTS voices' })
  @ApiResponse({
    status: 200,
    description: 'List of available voices',
  })
  async getVoices(@Query('languageCode') languageCode?: string) {
    return this.ttsService.getVoices(languageCode);
  }
}

