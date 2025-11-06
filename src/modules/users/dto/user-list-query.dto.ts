import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus } from '@prisma/client';

export class UserListQueryDto {
  @ApiProperty({ description: 'Page number', example: 1, minimum: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', example: 20, minimum: 1, maximum: 100, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ 
    description: 'Search term for name or email', 
    example: 'john',
    required: false 
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ 
    description: 'Filter by user status', 
    enum: UserStatus,
    required: false 
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiProperty({ 
    description: 'Filter by organization ID (admin only)', 
    example: 'org-id-123',
    required: false 
  })
  @IsOptional()
  @IsString()
  organizationId?: string;
}