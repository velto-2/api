import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TestConfigQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by customer/organization ID',
    example: 'org-123',
  })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by agent ID',
    example: 'agent-456',
  })
  @IsString()
  @IsOptional()
  agentId?: string;

  @ApiPropertyOptional({
    description: 'Filter by language code',
    example: 'ar',
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Search by name',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
