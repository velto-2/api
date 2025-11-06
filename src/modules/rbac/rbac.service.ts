import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  PermissionResource,
  PermissionAction,
  RoleScope,
  Prisma,
} from '@prisma/client';

export interface CreateRoleDto {
  name: string;
  description?: string;
  permissions: string[];
  organizationId?: string;
  scope?: RoleScope;
  color?: string;
  icon?: string;
}

export interface AssignRoleDto {
  userId: string;
  roleId: string;
  assignedBy?: string;
  expiresAt?: Date;
}

export interface CreatePermissionDto {
  resource: PermissionResource;
  action: PermissionAction;
  name: string;
  description?: string;
  conditions?: any;
}

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Check if user has specific permissions
   */
  async userHasPermissions(
    userId: string,
    requiredPermissions: string[],
    context?: {
      resourceId?: string;
      organizationId?: string;
    },
  ): Promise<boolean> {
    try {
      // Get user's permissions from cache or database
      const userPermissions = await this.getUserPermissions(userId);

      // Check if user has all required permissions
      const hasAllPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );

      this.logger.debug(
        `Permission check for user ${userId}: ${
          hasAllPermissions ? 'GRANTED' : 'DENIED'
        }`,
        {
          userId,
          requiredPermissions,
          userPermissions,
          context,
        },
      );

      return hasAllPermissions;
    } catch (error) {
      this.logger.error('Error checking user permissions', error);
      return false;
    }
  }

  /**
   * Check if user has specific permission (single permission variant)
   */
  async userHasPermission(
    userId: string,
    permission: string,
    context?: {
      resourceId?: string;
      organizationId?: string;
    },
  ): Promise<boolean> {
    return this.userHasPermissions(userId, [permission], context);
  }

  /**
   * Get all permissions for a user (combines role-based and direct permissions)
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      // Get user with organization info
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          organization: true,
        },
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found`);
        return [];
      }

      // Get permissions from roles
      const rolePermissions = await this.getUserRolePermissions(
        userId,
        user.organizationId,
      );

      // Get direct user permissions
      const directPermissions = await this.getUserDirectPermissions(userId);

      // Combine and deduplicate permissions
      const allPermissions = new Set([
        ...rolePermissions,
        ...directPermissions,
      ]);

      const permissionsArray = Array.from(allPermissions);

      this.logger.debug(`Retrieved ${permissionsArray.length} permissions for user ${userId}`);

      return permissionsArray;
    } catch (error) {
      this.logger.error('Error getting user permissions', error);
      return [];
    }
  }

  /**
   * Get permissions from user's roles
   */
  private async getUserRolePermissions(
    userId: string,
    organizationId: string,
  ): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        OR: [
          // Unexpired roles or roles without expiration
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();

    userRoles.forEach((userRole) => {
      if (userRole.role && userRole.role.isActive && 
          (userRole.role.scope === RoleScope.GLOBAL || 
           userRole.role.organizationId === organizationId)) {
        userRole.role.permissions.forEach((rolePermission) => {
          if (rolePermission.permission.isActive) {
            const permissionKey = `${rolePermission.permission.resource}.${rolePermission.permission.action}`;
            permissions.add(permissionKey);
          }
        });
      }
    });

    return Array.from(permissions);
  }

  /**
   * Get direct user permissions (bypassing roles)
   */
  private async getUserDirectPermissions(userId: string): Promise<string[]> {
    const userPermissions = await this.prisma.userPermission.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        permission: true,
      },
    });

    const permissions = userPermissions
      .filter((up) => up.permission.isActive)
      .map((up) => {
        return `${up.permission.resource}.${up.permission.action}`;
      });

    return permissions;
  }

  /**
   * Create a new role for an organization
   */
  async createRole(data: CreateRoleDto) {
    const slug = data.name.toLowerCase().replace(/\s+/g, '-');

    // Create role
    const role = await this.prisma.role.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        slug,
        description: data.description,
        scope: data.scope || RoleScope.ORGANIZATION,
        color: data.color,
        icon: data.icon,
      },
    });

    // Assign permissions to role
    if (data.permissions.length > 0) {
      await this.assignPermissionsToRole(role.id, data.permissions);
    }

    this.logger.log(`Created role: ${role.name} (${role.id})`);

    return role;
  }

  /**
   * Update an existing role
   */
  async updateRole(
    roleId: string,
    data: Partial<CreateRoleDto>,
  ) {
    // Update role basic info
    const role = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
      },
    });

    // Update permissions if provided
    if (data.permissions) {
      // Remove existing permissions
      await this.prisma.rolePermission.deleteMany({
        where: { roleId },
      });

      // Add new permissions
      await this.assignPermissionsToRole(roleId, data.permissions);
    }

    this.logger.log(`Updated role: ${role.name} (${role.id})`);

    return role;
  }

  /**
   * Delete a role (only non-system roles)
   */
  async deleteRole(roleId: string) {
    // Check if role is system role
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    if (role.isSystem) {
      throw new Error('Cannot delete system role');
    }

    // Remove role (cascade will handle related records)
    await this.prisma.role.delete({
      where: { id: roleId },
    });

    this.logger.log(`Deleted role: ${role.name} (${role.id})`);
  }

  /**
   * Assign permissions to a role
   */
  async assignPermissionsToRole(
    roleId: string,
    permissionKeys: string[],
  ) {
    // Parse permission keys (e.g., "JOB_REQUEST.CREATE")
    const permissions = await Promise.all(
      permissionKeys.map(async (key) => {
        const [resource, action] = key.split('.');
        return this.prisma.permission.findUnique({
          where: {
            resource_action: {
              resource: resource as PermissionResource,
              action: action as PermissionAction,
            },
          },
        });
      }),
    );

    // Create role-permission associations
    const validPermissions = permissions.filter((p) => p !== null);

    if (validPermissions.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: validPermissions.map((permission) => ({
          roleId,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });

      this.logger.log(
        `Assigned ${validPermissions.length} permissions to role ${roleId}`,
      );
    }
  }

  /**
   * Remove permissions from a role
   */
  async removePermissionsFromRole(
    roleId: string,
    permissionKeys: string[],
  ) {
    // Parse permission keys and get permission IDs
    const permissions = await Promise.all(
      permissionKeys.map(async (key) => {
        const [resource, action] = key.split('.');
        return this.prisma.permission.findUnique({
          where: {
            resource_action: {
              resource: resource as PermissionResource,
              action: action as PermissionAction,
            },
          },
        });
      }),
    );

    const validPermissionIds = permissions
      .filter((p) => p !== null)
      .map((p) => p.id);

    if (validPermissionIds.length > 0) {
      await this.prisma.rolePermission.deleteMany({
        where: {
          roleId,
          permissionId: {
            in: validPermissionIds,
          },
        },
      });

      this.logger.log(
        `Removed ${validPermissionIds.length} permissions from role ${roleId}`,
      );
    }
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(data: AssignRoleDto) {
    const existingAssignment = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: data.userId,
          roleId: data.roleId,
        },
      },
    });

    if (existingAssignment) {
      throw new Error('User already has this role');
    }

    const userRole = await this.prisma.userRole.create({
      data: {
        userId: data.userId,
        roleId: data.roleId,
        assignedBy: data.assignedBy,
        expiresAt: data.expiresAt,
      },
    });

    this.logger.log(
      `Assigned role ${data.roleId} to user ${data.userId}`,
    );

    return userRole;
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(userId: string, roleId: string) {
    await this.prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    this.logger.log(`Removed role ${roleId} from user ${userId}`);
  }

  /**
   * Assign direct permission to user (bypassing roles)
   */
  async assignPermissionToUser(
    userId: string,
    permissionKey: string,
    options?: {
      assignedBy?: string;
      expiresAt?: Date;
      conditions?: any;
    },
  ) {
    const [resource, action] = permissionKey.split('.');
    const permission = await this.prisma.permission.findUnique({
      where: {
        resource_action: {
          resource: resource as PermissionResource,
          action: action as PermissionAction,
        },
      },
    });

    if (!permission) {
      throw new Error(`Permission ${permissionKey} not found`);
    }

    const userPermission = await this.prisma.userPermission.create({
      data: {
        userId,
        permissionId: permission.id,
        assignedBy: options?.assignedBy,
        expiresAt: options?.expiresAt,
        conditions: options?.conditions,
      },
    });

    this.logger.log(
      `Assigned direct permission ${permissionKey} to user ${userId}`,
    );

    return userPermission;
  }

  /**
   * Remove direct permission from user
   */
  async removePermissionFromUser(userId: string, permissionKey: string) {
    const [resource, action] = permissionKey.split('.');
    const permission = await this.prisma.permission.findUnique({
      where: {
        resource_action: {
          resource: resource as PermissionResource,
          action: action as PermissionAction,
        },
      },
    });

    if (!permission) {
      throw new Error(`Permission ${permissionKey} not found`);
    }

    await this.prisma.userPermission.delete({
      where: {
        userId_permissionId: {
          userId,
          permissionId: permission.id,
        },
      },
    });

    this.logger.log(
      `Removed direct permission ${permissionKey} from user ${userId}`,
    );
  }

  /**
   * List all roles for an organization
   */
  async getRoles(organizationId?: string) {
    return this.prisma.role.findMany({
      where: {
        isActive: true,
        OR: [
          { scope: RoleScope.GLOBAL },
          {
            scope: RoleScope.ORGANIZATION,
            organizationId,
          },
        ],
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * List all available permissions
   */
  async getPermissions() {
    return this.prisma.permission.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  /**
   * Get role by ID with permissions
   */
  async getRoleById(roleId: string) {
    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        userRoles: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get user's roles
   */
  async getUserRoles(userId: string) {
    return this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Create a system permission (for seeding)
   */
  async createPermission(data: CreatePermissionDto) {
    const existingPermission = await this.prisma.permission.findUnique({
      where: {
        resource_action: {
          resource: data.resource,
          action: data.action,
        },
      },
    });

    if (existingPermission) {
      return existingPermission;
    }

    const permission = await this.prisma.permission.create({
      data: {
        resource: data.resource,
        action: data.action,
        name: data.name,
        description: data.description,
        conditions: data.conditions,
        isSystem: true,
      },
    });

    this.logger.log(`Created permission: ${permission.name}`);

    return permission;
  }
}