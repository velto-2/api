import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAgentDto {
  @ApiProperty({
    description: 'Customer/Organization ID',
    example: 'org-123',
  })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({
    description: 'Unique agent identifier',
    example: 'support-agent-1',
  })
  @IsString()
  @IsNotEmpty()
  agentId: string;

  @ApiProperty({
    description: 'Agent display name',
    example: 'Customer Support Agent',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Agent description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Agent type',
    example: 'phone',
    default: 'phone',
  })
  @IsString()
  @IsOptional()
  @IsIn(['phone', 'webhook', 'sip', 'other'])
  type?: string;

  @ApiPropertyOptional({
    description: 'Agent endpoint (phone number or URL)',
    example: '+1234567890',
  })
  @IsString()
  @IsOptional()
  endpoint?: string;

  @ApiPropertyOptional({
    description: 'Primary language',
    example: 'en',
    default: 'en',
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Whether the agent is active',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAgentDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @IsIn(['phone', 'webhook', 'sip', 'other'])
  type?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endpoint?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}


