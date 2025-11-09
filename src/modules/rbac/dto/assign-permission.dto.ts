import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsObject } from 'class-validator';

export class AssignPermissionRequestDto {
  @ApiProperty({ 
    description: 'Permission key to assign', 
    example: 'TEST.CREATE' 
  })
  @IsString()
  permission: string;

  @ApiProperty({ 
    description: 'Permission expiration date (optional)', 
    example: '2024-12-31T23:59:59.000Z',
    required: false 
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: Date;

  @ApiProperty({ 
    description: 'Additional conditions for permission (optional)', 
    example: { department: 'IT', maxAmount: 10000 },
    required: false 
  })
  @IsObject()
  @IsOptional()
  conditions?: any;
}