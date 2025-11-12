import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AgentQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by customer/organization ID',
  })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by agent ID',
  })
  @IsString()
  @IsOptional()
  agentId?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Search by name or agentId',
  })
  @IsString()
  @IsOptional()
  search?: string;
}


