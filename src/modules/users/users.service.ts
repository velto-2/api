import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { CreateUserDto, UpdateUserDto, InviteUserDto, ChangePasswordDto } from './dto';
import { UserStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  organizationId?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private rbacService: RbacService,
  ) {}

  /**
   * Create a new user (for admin use)
   */
  async createUser(data: CreateUserDto, organizationId: string) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        organizationId,
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        firstNameAr: data.firstNameAr,
        lastNameAr: data.lastNameAr,
        status: UserStatus.ACTIVE,
        emailVerified: false,
        phoneVerified: false,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    // Assign default role if specified
    if (data.roleIds && data.roleIds.length > 0) {
      for (const roleId of data.roleIds) {
        try {
          await this.rbacService.assignRoleToUser({
            userId: user.id,
            roleId,
            assignedBy: data.createdBy,
          });
        } catch (error) {
          this.logger.warn(`Failed to assign role ${roleId} to user ${user.id}: ${error.message}`);
        }
      }
    }

    this.logger.log(`Created user: ${user.email} for organization: ${organizationId}`);

    return this.sanitizeUser(user);
  }

  /**
   * Invite a user to join the organization
   */
  async inviteUser(data: InviteUserDto, organizationId: string, invitedBy: string) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Generate temporary password
    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create user with pending invitation status
    const user = await this.prisma.user.create({
      data: {
        organizationId,
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        firstNameAr: data.firstNameAr,
        lastNameAr: data.lastNameAr,
        status: UserStatus.PENDING_INVITATION,
        emailVerified: false,
        phoneVerified: false,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    // Assign roles if specified
    if (data.roleIds && data.roleIds.length > 0) {
      for (const roleId of data.roleIds) {
        try {
          await this.rbacService.assignRoleToUser({
            userId: user.id,
            roleId,
            assignedBy: invitedBy,
          });
        } catch (error) {
          this.logger.warn(`Failed to assign role ${roleId} to user ${user.id}: ${error.message}`);
        }
      }
    }

    // TODO: Send invitation email with temporary password
    this.logger.log(`Invited user: ${user.email} to organization: ${organizationId}`);

    return {
      user: this.sanitizeUser(user),
      tempPassword, // In production, this should be sent via email only
    };
  }

  /**
   * Get users with pagination and filters
   */
  async getUsers(query: UserListQuery, currentUserOrgId: string) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      organizationId = currentUserOrgId,
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {
      organizationId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          userRoles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true,
                },
              },
            },
          },
        },
        orderBy: [
          { status: 'asc' },
          { firstName: 'asc' },
          { lastName: 'asc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map(user => this.sanitizeUser(user)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string, currentUserOrgId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: currentUserOrgId,
        deletedAt: null,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
                icon: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get user permissions
    const permissions = await this.rbacService.getUserPermissions(userId);

    return {
      ...this.sanitizeUser(user),
      permissions,
    };
  }

  /**
   * Update user information
   */
  async updateUser(userId: string, data: UpdateUserDto, currentUserOrgId: string) {
    // Check if user exists and belongs to organization
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: currentUserOrgId,
        deletedAt: null,
      },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if email is being changed
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new BadRequestException('Email already in use');
      }
    }

    // Update user
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        firstNameAr: data.firstNameAr,
        lastNameAr: data.lastNameAr,
        status: data.status,
        isActive: data.isActive,
        avatar: data.avatar,
        preferences: data.preferences,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                color: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Updated user: ${user.email}`);

    return this.sanitizeUser(user);
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, data: ChangePasswordDto, currentUserOrgId: string) {
    // Get user
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: currentUserOrgId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(data.newPassword, 12);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
      },
    });

    this.logger.log(`Password changed for user: ${user.email}`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string, currentUserOrgId: string) {
    // Check if user exists and belongs to organization
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: currentUserOrgId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete user
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        status: UserStatus.INACTIVE,
        deletedAt: new Date(),
      },
    });

    this.logger.log(`Deactivated user: ${user.email}`);

    return { message: 'User deactivated successfully' };
  }

  /**
   * Activate user
   */
  async activateUser(userId: string, currentUserOrgId: string) {
    // Check if user exists
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: currentUserOrgId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Activate user
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Activated user: ${user.email}`);

    return this.sanitizeUser(updatedUser);
  }

  /**
   * Get user statistics for dashboard
   */
  async getUserStats(organizationId: string) {
    const [
      totalUsers,
      activeUsers,
      pendingInvitations,
      inactiveUsers,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          organizationId,
          deletedAt: null,
        },
      }),
      this.prisma.user.count({
        where: {
          organizationId,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      }),
      this.prisma.user.count({
        where: {
          organizationId,
          status: UserStatus.PENDING_INVITATION,
          deletedAt: null,
        },
      }),
      this.prisma.user.count({
        where: {
          organizationId,
          status: UserStatus.INACTIVE,
          deletedAt: null,
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      pendingInvitations,
      inactiveUsers,
    };
  }

  /**
   * Remove sensitive information from user object
   */
  private sanitizeUser(user: any) {
    const { password, refreshToken, resetToken, resetTokenExpiry, twoFactorSecret, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Generate temporary password for invitations
   */
  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}