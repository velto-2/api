import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DigitalHumanService } from './digital-human.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Digital Human')
@Controller('digital-human')
export class DigitalHumanController {
  constructor(private readonly digitalHumanService: DigitalHumanService) {}

  @Public()
  @Post('conversation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a conversation turn' })
  @ApiResponse({
    status: 200,
    description: 'Generated response',
  })
  async generateConversation(
    @Body()
    body: {
      languageCode: string;
      dialectCode: string;
      persona: string;
      scenario: string;
      history?: any[];
      agentUtterance?: string;
    },
  ) {
    const instance = this.digitalHumanService.create(
      body.languageCode || 'ar',
      body.dialectCode || 'egyptian',
      body.persona || 'polite_customer',
      body.scenario || 'Customer inquiry',
    );

    // Restore history if provided
    if (body.history) {
      // This would require adding a method to restore history
      // For now, we'll just generate a new response
    }

    const response = await instance.generateResponse(body.agentUtterance);

    return {
      response,
      turnCount: instance.getTurnCount(),
      shouldEnd: instance.shouldEnd(),
      history: instance.getHistory(),
    };
  }
}
