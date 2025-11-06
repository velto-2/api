import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsBoolean, IsEnum, IsObject } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateUserDto {
  @ApiProperty({ description: 'User email address', example: 'john.doe@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'User phone number', example: '+966501234567', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'First name', example: 'John', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ description: 'Last name', example: 'Doe', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ description: 'First name in Arabic', example: 'جون', required: false })
  @IsString()
  @IsOptional()
  firstNameAr?: string;

  @ApiProperty({ description: 'Last name in Arabic', example: 'دو', required: false })
  @IsString()
  @IsOptional()
  lastNameAr?: string;

  @ApiProperty({ 
    description: 'User status', 
    enum: UserStatus,
    required: false 
  })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiProperty({ description: 'Whether user is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'User avatar URL', example: 'https://example.com/avatar.jpg', required: false })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiProperty({ 
    description: 'User preferences as JSON object', 
    example: { theme: 'dark', language: 'en', notifications: true },
    required: false 
  })
  @IsObject()
  @IsOptional()
  preferences?: any;
}