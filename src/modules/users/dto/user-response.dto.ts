import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

export class UserRoleDto {
  @ApiProperty({ description: 'Role assignment ID' })
  id: string;

  @ApiProperty({ description: 'Role ID' })
  roleId: string;

  @ApiProperty({ description: 'Role name' })
  name: string;

  @ApiProperty({ description: 'Role slug' })
  slug: string;

  @ApiProperty({ description: 'Role color', required: false })
  color?: string;

  @ApiProperty({ description: 'Role icon', required: false })
  icon?: string;

  @ApiProperty({ description: 'Date assigned' })
  assignedAt: Date;

  @ApiProperty({ description: 'Assignment expiry date', required: false })
  expiresAt?: Date;
}

export class UserOrganizationDto {
  @ApiProperty({ description: 'Organization ID' })
  id: string;

  @ApiProperty({ description: 'Organization name' })
  name: string;

  @ApiProperty({ description: 'Organization type' })
  type: string;
}

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'Organization ID' })
  organizationId: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ description: 'Phone number', required: false })
  phone?: string;

  @ApiProperty({ description: 'First name' })
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  lastName: string;

  @ApiProperty({ description: 'First name in Arabic', required: false })
  firstNameAr?: string;

  @ApiProperty({ description: 'Last name in Arabic', required: false })
  lastNameAr?: string;

  @ApiProperty({ description: 'User status', enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ description: 'Is user active' })
  isActive: boolean;

  @ApiProperty({ description: 'Is email verified' })
  emailVerified: boolean;

  @ApiProperty({ description: 'Is phone verified' })
  phoneVerified: boolean;

  @ApiProperty({ description: 'Avatar URL', required: false })
  avatar?: string;

  @ApiProperty({ description: 'Last login timestamp', required: false })
  lastLoginAt?: Date;

  @ApiProperty({ description: 'User preferences', required: false })
  preferences?: any;

  @ApiProperty({ description: 'Account creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'User organization', type: UserOrganizationDto })
  organization: UserOrganizationDto;

  @ApiProperty({ description: 'User roles', type: [UserRoleDto] })
  userRoles: UserRoleDto[];

  @ApiProperty({ description: 'User permissions (for detailed view)', type: [String], required: false })
  permissions?: string[];
}

export class UserListResponseDto {
  @ApiProperty({ description: 'List of users', type: [UserResponseDto] })
  users: UserResponseDto[];

  @ApiProperty({ 
    description: 'Pagination information',
    example: { page: 1, limit: 20, total: 100, pages: 5 }
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class UserStatsResponseDto {
  @ApiProperty({ description: 'Total number of users' })
  totalUsers: number;

  @ApiProperty({ description: 'Number of active users' })
  activeUsers: number;

  @ApiProperty({ description: 'Number of pending invitations' })
  pendingInvitations: number;

  @ApiProperty({ description: 'Number of inactive users' })
  inactiveUsers: number;
}

export class InviteUserResponseDto {
  @ApiProperty({ description: 'Invited user information', type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty({ description: 'Temporary password (for testing only)' })
  tempPassword: string;
}