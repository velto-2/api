import { IsOptional, IsString, IsObject, IsDateString } from 'class-validator';

export class UploadCallDto {
  @IsOptional()
  @IsString()
  externalCallId?: string;

  @IsOptional()
  @IsDateString()
  callDate?: string;

  @IsOptional()
  @IsString()
  customerPhoneNumber?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  agentName?: string;

  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}

