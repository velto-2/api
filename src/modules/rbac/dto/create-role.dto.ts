import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsEnum } from 'class-validator';
import { RoleScope } from '@prisma/client';

export class CreateRoleRequestDto {
  @ApiProperty({ description: 'Role name', example: 'Project Manager' })
  @IsString()
  name: string;

  @ApiProperty({ 
    description: 'Role description', 
    example: 'Can manage projects and assign workers',
    required: false 
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ 
    description: 'List of permission keys', 
    example: ['JOB_REQUEST.CREATE', 'JOB_REQUEST.READ', 'OFFER.READ'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @ApiProperty({ 
    description: 'Role scope', 
    enum: RoleScope,
    default: RoleScope.ORGANIZATION,
    required: false 
  })
  @IsEnum(RoleScope)
  @IsOptional()
  scope?: RoleScope;

  @ApiProperty({ 
    description: 'Role color for UI', 
    example: '#3B82F6',
    required: false 
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ 
    description: 'Role icon for UI', 
    example: 'user-shield',
    required: false 
  })
  @IsString()
  @IsOptional()
  icon?: string;
}