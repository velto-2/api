import { IsString, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ExpectedJobDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  completionIndicators?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredSteps?: string[];
}

export class CreateKnowledgeBaseDto {
  @IsString()
  agentId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpectedJobDto)
  @IsOptional()
  expectedJobs?: ExpectedJobDto[];

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

