import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class AssignRoleRequestDto {
  @ApiProperty({ description: 'Role ID to assign', example: 'clm123...' })
  @IsString()
  roleId: string;

  @ApiProperty({ 
    description: 'Role expiration date (optional)', 
    example: '2024-12-31T23:59:59.000Z',
    required: false 
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: Date;
}