import { IsEmail, IsNotEmpty, IsString, IsEnum, IsOptional, IsPhoneNumber, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
// import { OrganizationType } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'CLIENT', enum: ['CLIENT'], description: 'Organization type - only CLIENT allowed for registration' })
  @IsEnum(['CLIENT'])
  @IsNotEmpty()
  organizationType: 'CLIENT';

  // Organization Details
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @IsNotEmpty()
  organizationName: string;

  @ApiProperty({ example: 'أكمي للشركات', required: false })
  @IsOptional()
  @IsString()
  organizationNameAr?: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  registrationNumber: string;

  @ApiProperty({ example: 'contact@acme.com' })
  @IsEmail()
  @IsNotEmpty()
  organizationEmail: string;

  @ApiProperty({ example: '+966501234567' })
  @IsPhoneNumber('SA')
  @IsNotEmpty()
  organizationPhone: string;

  // User Details
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'john.doe@acme.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: '+966501234567', required: false })
  @IsOptional()
  @IsPhoneNumber('SA')
  phone?: string;
}