import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsArray } from 'class-validator';

export class InviteUserDto {
  @ApiProperty({ description: 'User email address', example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User phone number', example: '+966501234567', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ description: 'First name in Arabic', example: 'جون', required: false })
  @IsString()
  @IsOptional()
  firstNameAr?: string;

  @ApiProperty({ description: 'Last name in Arabic', example: 'دو', required: false })
  @IsString()
  @IsOptional()
  lastNameAr?: string;

  @ApiProperty({ 
    description: 'Role IDs to assign to user', 
    example: ['role-id-1', 'role-id-2'],
    type: [String],
    required: false 
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roleIds?: string[];

  @ApiProperty({ 
    description: 'Personal message to include in invitation email', 
    example: 'Welcome to our team!',
    required: false 
  })
  @IsString()
  @IsOptional()
  message?: string;
}