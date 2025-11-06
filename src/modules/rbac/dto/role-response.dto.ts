import { ApiProperty } from '@nestjs/swagger';
import { RoleScope, PermissionResource, PermissionAction } from '@prisma/client';

export class PermissionSummaryDto {
  @ApiProperty({ description: 'Permission ID' })
  id: string;

  @ApiProperty({ description: 'Permission resource', enum: PermissionResource })
  resource: PermissionResource;

  @ApiProperty({ description: 'Permission action', enum: PermissionAction })
  action: PermissionAction;

  @ApiProperty({ description: 'Permission name' })
  name: string;

  @ApiProperty({ description: 'Permission description', required: false })
  description?: string;
}

export class UserSummaryDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User first name' })
  firstName: string;

  @ApiProperty({ description: 'User last name' })
  lastName: string;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiProperty({ description: 'Date role was assigned' })
  assignedAt: Date;

  @ApiProperty({ description: 'Role expiration date', required: false })
  expiresAt?: Date;
}

export class RoleResponseDto {
  @ApiProperty({ description: 'Role ID' })
  id: string;

  @ApiProperty({ description: 'Role name' })
  name: string;

  @ApiProperty({ description: 'Role slug' })
  slug: string;

  @ApiProperty({ description: 'Role description', required: false })
  description?: string;

  @ApiProperty({ description: 'Role scope', enum: RoleScope })
  scope: RoleScope;

  @ApiProperty({ description: 'Is system role' })
  isSystem: boolean;

  @ApiProperty({ description: 'Is role active' })
  isActive: boolean;

  @ApiProperty({ description: 'Role color', required: false })
  color?: string;

  @ApiProperty({ description: 'Role icon', required: false })
  icon?: string;

  @ApiProperty({ description: 'Number of users with this role' })
  userCount: number;

  @ApiProperty({ description: 'Role permissions', type: [PermissionSummaryDto] })
  permissions: PermissionSummaryDto[];

  @ApiProperty({ description: 'Users with this role', type: [UserSummaryDto], required: false })
  users?: UserSummaryDto[];

  @ApiProperty({ description: 'Role creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Role last update date' })
  updatedAt: Date;
}