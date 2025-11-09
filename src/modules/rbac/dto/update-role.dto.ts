import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional } from 'class-validator';

export class UpdateRoleRequestDto {
  @ApiProperty({ 
    description: 'Role name', 
    example: 'Senior Project Manager',
    required: false 
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ 
    description: 'Role description', 
    example: 'Can manage multiple projects and supervise teams',
    required: false 
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ 
    description: 'List of permission keys', 
    example: ['TEST.CREATE', 'TEST.UPDATE', 'TEST_RUN.EXECUTE'],
    type: [String],
    required: false
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @ApiProperty({ 
    description: 'Role color for UI', 
    example: '#059669',
    required: false 
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ 
    description: 'Role icon for UI', 
    example: 'shield-check',
    required: false 
  })
  @IsString()
  @IsOptional()
  icon?: string;
}