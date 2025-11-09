import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Test configuration ID' })
  @IsString()
  @IsNotEmpty()
  testConfigId: string;

  @ApiProperty({ description: 'Schedule name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Schedule description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Cron expression (e.g., "0 9 * * *" for daily at 9 AM)', example: '0 9 * * *' })
  @IsString()
  @IsNotEmpty()
  schedule: string;

  @ApiProperty({ description: 'Timezone', default: 'UTC', required: false })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({ description: 'Is schedule active', default: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Additional settings', required: false })
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}

