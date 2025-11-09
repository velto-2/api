import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsString } from 'class-validator';

export class AnalyticsQueryDto {
  @ApiProperty({ required: false, description: 'Start date (ISO string)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({ required: false, description: 'End date (ISO string)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({ required: false, description: 'Filter by test config ID' })
  @IsOptional()
  @IsString()
  testConfigId?: string;
}

