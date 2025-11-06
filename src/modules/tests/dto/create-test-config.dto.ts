import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LanguageDto {
  @ApiProperty({
    description: 'ISO 639-1 language code (e.g., ar, en, es)',
    example: 'ar',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Dialect code (e.g., egyptian, gulf)',
    example: 'egyptian',
  })
  @IsString()
  @IsNotEmpty()
  dialect: string;

  @ApiProperty({
    description: 'Human-readable language name',
    example: 'Arabic',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateTestConfigDto {
  @ApiProperty({
    description: 'Test configuration name',
    example: 'Customer Support Test - Egyptian Arabic',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Agent phone number or endpoint to call',
    example: '+1234567890',
  })
  @IsString()
  @IsNotEmpty()
  agentEndpoint: string;

  @ApiPropertyOptional({
    description: 'Agent type',
    example: 'phone',
    default: 'phone',
  })
  @IsString()
  @IsOptional()
  @IsIn(['phone', 'webhook', 'sip'])
  agentType?: string;

  @ApiProperty({
    description: 'Language configuration',
    type: LanguageDto,
  })
  @ValidateNested()
  @Type(() => LanguageDto)
  language: LanguageDto;

  @ApiProperty({
    description: 'Persona identifier',
    example: 'polite_customer',
  })
  @IsString()
  @IsNotEmpty()
  persona: string;

  @ApiProperty({
    description: 'Scenario template or description',
    example: 'I need to book an appointment for a doctor visit',
  })
  @IsString()
  @IsNotEmpty()
  scenarioTemplate: string;

  @ApiPropertyOptional({
    description: 'Whether the test config is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}


