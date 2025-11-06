import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsArray, IsPhoneNumber, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'User email address', example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User phone number', example: '+966501234567', required: false })
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'User password', example: 'SecurePass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

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

  @ApiProperty({ description: 'ID of user creating this user', required: false })
  @IsString()
  @IsOptional()
  createdBy?: string;
}