import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RbacService, CreateRoleDto, AssignRoleDto } from './rbac.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import {
  CreateRoleRequestDto,
  UpdateRoleRequestDto,
  AssignRoleRequestDto,
  AssignPermissionRequestDto,
  RoleResponseDto,
  PermissionResponseDto,
  UserRoleResponseDto,
} from './dto';

@ApiTags('RBAC')
@ApiBearerAuth()
@Controller('rbac')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  // ============================================================================
  // ROLES MANAGEMENT
  // ============================================================================

  @Get('roles')
  @RequirePermissions('ROLE.READ')
  @ApiOperation({ summary: 'List all roles for organization' })
  @ApiResponse({ status: 200, description: 'Roles retrieved successfully' })
  async getRoles(
    @CurrentOrganization() organizationId: string,
  ): Promise<RoleResponseDto[]> {
    const roles = await this.rbacService.getRoles(organizationId);
    return roles.map(role => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description ?? undefined,
      scope: role.scope,
      isSystem: role.isSystem,
      isActive: role.isActive,
      color: role.color ?? undefined,
      icon: role.icon ?? undefined,
      userCount: role._count.userRoles,
      permissions: role.permissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        name: rp.permission.name,
        description: rp.permission.description ?? undefined,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  }

  @Get('roles/:id')
  @RequirePermissions('ROLE.READ')
  @ApiOperation({ summary: 'Get role by ID with details' })
  @ApiResponse({ status: 200, description: 'Role retrieved successfully' })
  async getRoleById(@Param('id') roleId: string): Promise<RoleResponseDto> {
    const role = await this.rbacService.getRoleById(roleId);
    
    if (!role) {
      throw new Error('Role not found');
    }

    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description ?? undefined,
      scope: role.scope,
      isSystem: role.isSystem,
      isActive: role.isActive,
      color: role.color ?? undefined,
      icon: role.icon ?? undefined,
      userCount: role.userRoles.length,
      permissions: role.permissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        name: rp.permission.name,
        description: rp.permission.description ?? undefined,
      })),
      users: role.userRoles.map(ur => ({
        id: ur.user.id,
        firstName: ur.user.firstName,
        lastName: ur.user.lastName,
        email: ur.user.email,
        assignedAt: ur.createdAt,
        expiresAt: ur.expiresAt ?? undefined,
      })),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  @Post('roles')
  @RequirePermissions('ROLE.CREATE')
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  async createRole(
    @Body() createRoleDto: CreateRoleRequestDto,
    @CurrentOrganization() organizationId: string,
  ): Promise<RoleResponseDto> {
    const roleData: CreateRoleDto = {
      ...createRoleDto,
      organizationId,
    };

    const role = await this.rbacService.createRole(roleData);
    const fullRole = await this.rbacService.getRoleById(role.id);

    if (!fullRole) {
      throw new Error('Failed to retrieve created role');
    }

    return {
      id: fullRole.id,
      name: fullRole.name,
      slug: fullRole.slug,
      description: fullRole.description ?? undefined,
      scope: fullRole.scope,
      isSystem: fullRole.isSystem,
      isActive: fullRole.isActive,
      color: fullRole.color ?? undefined,
      icon: fullRole.icon ?? undefined,
      userCount: 0,
      permissions: fullRole.permissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        name: rp.permission.name,
        description: rp.permission.description ?? undefined,
      })),
      createdAt: fullRole.createdAt,
      updatedAt: fullRole.updatedAt,
    };
  }

  @Put('roles/:id')
  @RequirePermissions('ROLE.UPDATE')
  @ApiOperation({ summary: 'Update an existing role' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  async updateRole(
    @Param('id') roleId: string,
    @Body() updateRoleDto: UpdateRoleRequestDto,
  ): Promise<RoleResponseDto> {
    const role = await this.rbacService.updateRole(roleId, updateRoleDto);
    const fullRole = await this.rbacService.getRoleById(role.id);

    if (!fullRole) {
      throw new Error('Failed to retrieve updated role');
    }

    return {
      id: fullRole.id,
      name: fullRole.name,
      slug: fullRole.slug,
      description: fullRole.description ?? undefined,
      scope: fullRole.scope,
      isSystem: fullRole.isSystem,
      isActive: fullRole.isActive,
      color: fullRole.color ?? undefined,
      icon: fullRole.icon ?? undefined,
      userCount: fullRole.userRoles.length,
      permissions: fullRole.permissions.map(rp => ({
        id: rp.permission.id,
        resource: rp.permission.resource,
        action: rp.permission.action,
        name: rp.permission.name,
        description: rp.permission.description ?? undefined,
      })),
      createdAt: fullRole.createdAt,
      updatedAt: fullRole.updatedAt,
    };
  }

  @Delete('roles/:id')
  @RequirePermissions('ROLE.DELETE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a role' })
  @ApiResponse({ status: 204, description: 'Role deleted successfully' })
  async deleteRole(@Param('id') roleId: string): Promise<void> {
    await this.rbacService.deleteRole(roleId);
  }

  // ============================================================================
  // PERMISSIONS MANAGEMENT
  // ============================================================================

  @Get('permissions')
  @RequirePermissions('PERMISSION.READ')
  @ApiOperation({ summary: 'List all available permissions' })
  @ApiResponse({ status: 200, description: 'Permissions retrieved successfully' })
  async getPermissions(): Promise<PermissionResponseDto[]> {
    const permissions = await this.rbacService.getPermissions();
    return permissions.map(permission => ({
      id: permission.id,
      resource: permission.resource,
      action: permission.action,
      name: permission.name,
      description: permission.description ?? undefined,
      isSystem: permission.isSystem,
      isActive: permission.isActive,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    }));
  }

  @Post('roles/:roleId/permissions')
  @RequirePermissions('ROLE.UPDATE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Assign permissions to role' })
  @ApiResponse({ status: 204, description: 'Permissions assigned successfully' })
  async assignPermissionsToRole(
    @Param('roleId') roleId: string,
    @Body() body: { permissions: string[] },
  ): Promise<void> {
    await this.rbacService.assignPermissionsToRole(roleId, body.permissions);
  }

  @Delete('roles/:roleId/permissions')
  @RequirePermissions('ROLE.UPDATE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove permissions from role' })
  @ApiResponse({ status: 204, description: 'Permissions removed successfully' })
  async removePermissionsFromRole(
    @Param('roleId') roleId: string,
    @Body() body: { permissions: string[] },
  ): Promise<void> {
    await this.rbacService.removePermissionsFromRole(roleId, body.permissions);
  }

  // ============================================================================
  // USER ROLE ASSIGNMENTS
  // ============================================================================

  @Post('users/:userId/roles')
  @RequirePermissions('USER.UPDATE')
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiResponse({ status: 201, description: 'Role assigned successfully' })
  async assignRoleToUser(
    @Param('userId') userId: string,
    @Body() assignRoleDto: AssignRoleRequestDto,
    @CurrentUser() currentUser: any,
  ): Promise<UserRoleResponseDto> {
    const assignData: AssignRoleDto = {
      userId,
      roleId: assignRoleDto.roleId,
      assignedBy: currentUser.userId,
      expiresAt: assignRoleDto.expiresAt,
    };

    const userRole = await this.rbacService.assignRoleToUser(assignData);
    const fullUserRole = await this.rbacService.getUserRoles(userId);
    const assignedRole = fullUserRole.find(ur => ur.id === userRole.id);

    if (!assignedRole) {
      throw new Error('Failed to retrieve assigned role');
    }

    return {
      id: assignedRole.id,
      userId: assignedRole.userId,
      roleId: assignedRole.roleId,
      roleName: assignedRole.role.name,
      assignedBy: assignedRole.assignedBy ?? undefined,
      assignedAt: assignedRole.createdAt,
      expiresAt: assignedRole.expiresAt ?? undefined,
    };
  }

  @Delete('users/:userId/roles/:roleId')
  @RequirePermissions('USER.UPDATE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove role from user' })
  @ApiResponse({ status: 204, description: 'Role removed successfully' })
  async removeRoleFromUser(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ): Promise<void> {
    await this.rbacService.removeRoleFromUser(userId, roleId);
  }

  @Get('users/:userId/roles')
  @RequirePermissions('USER.READ')
  @ApiOperation({ summary: 'Get user roles' })
  @ApiResponse({ status: 200, description: 'User roles retrieved successfully' })
  async getUserRoles(@Param('userId') userId: string): Promise<UserRoleResponseDto[]> {
    const userRoles = await this.rbacService.getUserRoles(userId);
    return userRoles.map(ur => ({
      id: ur.id,
      userId: ur.userId,
      roleId: ur.roleId,
      roleName: ur.role.name,
      assignedBy: ur.assignedBy ?? undefined,
      assignedAt: ur.createdAt,
      expiresAt: ur.expiresAt ?? undefined,
    }));
  }

  @Get('users/:userId/permissions')
  @RequirePermissions('USER.READ')
  @ApiOperation({ summary: 'Get user effective permissions' })
  @ApiResponse({ status: 200, description: 'User permissions retrieved successfully' })
  async getUserPermissions(@Param('userId') userId: string): Promise<{ permissions: string[] }> {
    const permissions = await this.rbacService.getUserPermissions(userId);
    return { permissions };
  }

  // ============================================================================
  // DIRECT PERMISSION ASSIGNMENTS
  // ============================================================================

  @Post('users/:userId/permissions')
  @RequirePermissions('USER.UPDATE')
  @ApiOperation({ summary: 'Assign direct permission to user' })
  @ApiResponse({ status: 201, description: 'Permission assigned successfully' })
  async assignPermissionToUser(
    @Param('userId') userId: string,
    @Body() assignPermissionDto: AssignPermissionRequestDto,
    @CurrentUser() currentUser: any,
  ): Promise<{ message: string }> {
    await this.rbacService.assignPermissionToUser(
      userId,
      assignPermissionDto.permission,
      {
        assignedBy: currentUser.userId,
        expiresAt: assignPermissionDto.expiresAt,
        conditions: assignPermissionDto.conditions,
      },
    );

    return { message: 'Permission assigned successfully' };
  }

  @Delete('users/:userId/permissions/:permission')
  @RequirePermissions('USER.UPDATE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove direct permission from user' })
  @ApiResponse({ status: 204, description: 'Permission removed successfully' })
  async removePermissionFromUser(
    @Param('userId') userId: string,
    @Param('permission') permission: string,
  ): Promise<void> {
    await this.rbacService.removePermissionFromUser(userId, permission);
  }
}