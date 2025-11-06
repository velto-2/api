import { ApiProperty } from '@nestjs/swagger';

export class UserRoleResponseDto {
  @ApiProperty({ description: 'User role assignment ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Role ID' })
  roleId: string;

  @ApiProperty({ description: 'Role name' })
  roleName: string;

  @ApiProperty({ description: 'ID of user who assigned this role', required: false })
  assignedBy?: string;

  @ApiProperty({ description: 'Date role was assigned' })
  assignedAt: Date;

  @ApiProperty({ description: 'Role expiration date', required: false })
  expiresAt?: Date;
}