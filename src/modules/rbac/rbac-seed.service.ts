import { Injectable, Logger } from '@nestjs/common';
import { RbacService, CreatePermissionDto, CreateRoleDto } from './rbac.service';
import { PermissionResource, PermissionAction, RoleScope } from '@prisma/client';

@Injectable()
export class RbacSeedService {
  private readonly logger = new Logger(RbacSeedService.name);

  constructor(private rbacService: RbacService) {}

  /**
   * Seed all default permissions and roles
   */
  async seedDefaultPermissions() {
    this.logger.log('Starting RBAC seeding process...');

    // Seed all permissions
    await this.seedPermissions();

    // Seed default system roles
    await this.seedSystemRoles();

    this.logger.log('RBAC seeding completed successfully');
  }

  /**
   * Create all system permissions
   */
  private async seedPermissions() {
    const permissions: CreatePermissionDto[] = [
      // Test Management
      { resource: PermissionResource.TEST, action: PermissionAction.CREATE, name: 'Create Test', description: 'Create new test configurations' },
      { resource: PermissionResource.TEST, action: PermissionAction.READ, name: 'Read Test', description: 'View test configurations' },
      { resource: PermissionResource.TEST, action: PermissionAction.UPDATE, name: 'Update Test', description: 'Edit test configurations' },
      { resource: PermissionResource.TEST, action: PermissionAction.DELETE, name: 'Delete Test', description: 'Delete test configurations' },

      // Test Run Management
      { resource: PermissionResource.TEST_RUN, action: PermissionAction.CREATE, name: 'Create Test Run', description: 'Create new test runs' },
      { resource: PermissionResource.TEST_RUN, action: PermissionAction.READ, name: 'Read Test Run', description: 'View test run results' },
      { resource: PermissionResource.TEST_RUN, action: PermissionAction.EXECUTE, name: 'Execute Test Run', description: 'Execute test runs' },
      { resource: PermissionResource.TEST_RUN, action: PermissionAction.CANCEL, name: 'Cancel Test Run', description: 'Cancel running test runs' },
      { resource: PermissionResource.TEST_RUN, action: PermissionAction.DELETE, name: 'Delete Test Run', description: 'Delete test runs' },

      // Imported Call Management
      { resource: PermissionResource.IMPORTED_CALL, action: PermissionAction.IMPORT, name: 'Import Call', description: 'Import call recordings' },
      { resource: PermissionResource.IMPORTED_CALL, action: PermissionAction.READ, name: 'Read Imported Call', description: 'View imported calls' },
      { resource: PermissionResource.IMPORTED_CALL, action: PermissionAction.ANALYZE, name: 'Analyze Call', description: 'Analyze imported calls' },
      { resource: PermissionResource.IMPORTED_CALL, action: PermissionAction.DELETE, name: 'Delete Imported Call', description: 'Delete imported calls' },

      // Speech Services
      { resource: PermissionResource.SPEECH, action: PermissionAction.TRANSCRIBE, name: 'Transcribe Speech', description: 'Transcribe audio to text' },
      { resource: PermissionResource.SPEECH, action: PermissionAction.SYNTHESIZE, name: 'Synthesize Speech', description: 'Generate speech from text' },
      { resource: PermissionResource.SPEECH, action: PermissionAction.READ, name: 'Read Speech', description: 'View speech service data' },

      // Digital Human
      { resource: PermissionResource.DIGITAL_HUMAN, action: PermissionAction.CONFIGURE, name: 'Configure Digital Human', description: 'Configure digital human settings' },
      { resource: PermissionResource.DIGITAL_HUMAN, action: PermissionAction.READ, name: 'Read Digital Human', description: 'View digital human configurations' },
      { resource: PermissionResource.DIGITAL_HUMAN, action: PermissionAction.UPDATE, name: 'Update Digital Human', description: 'Update digital human settings' },

      // Telephony
      { resource: PermissionResource.TELEPHONY, action: PermissionAction.INITIATE, name: 'Initiate Call', description: 'Initiate phone calls' },
      { resource: PermissionResource.TELEPHONY, action: PermissionAction.READ, name: 'Read Telephony', description: 'View call details' },
      { resource: PermissionResource.TELEPHONY, action: PermissionAction.CONFIGURE, name: 'Configure Telephony', description: 'Configure telephony settings' },

      // Organization Management
      { resource: PermissionResource.ORGANIZATION, action: PermissionAction.CREATE, name: 'Create Organization', description: 'Register new organizations' },
      { resource: PermissionResource.ORGANIZATION, action: PermissionAction.READ, name: 'Read Organization', description: 'View organization details' },
      { resource: PermissionResource.ORGANIZATION, action: PermissionAction.UPDATE, name: 'Update Organization', description: 'Edit organization information' },
      { resource: PermissionResource.ORGANIZATION, action: PermissionAction.DELETE, name: 'Delete Organization', description: 'Remove organizations' },

      // User Management
      { resource: PermissionResource.USER, action: PermissionAction.CREATE, name: 'Create User', description: 'Invite new users' },
      { resource: PermissionResource.USER, action: PermissionAction.READ, name: 'Read User', description: 'View user profiles' },
      { resource: PermissionResource.USER, action: PermissionAction.UPDATE, name: 'Update User', description: 'Edit user information and roles' },
      { resource: PermissionResource.USER, action: PermissionAction.DELETE, name: 'Delete User', description: 'Remove users' },

      // Role Management
      { resource: PermissionResource.ROLE, action: PermissionAction.CREATE, name: 'Create Role', description: 'Create custom roles' },
      { resource: PermissionResource.ROLE, action: PermissionAction.READ, name: 'Read Role', description: 'View roles and permissions' },
      { resource: PermissionResource.ROLE, action: PermissionAction.UPDATE, name: 'Update Role', description: 'Edit roles and assign permissions' },
      { resource: PermissionResource.ROLE, action: PermissionAction.DELETE, name: 'Delete Role', description: 'Remove custom roles' },

      // Permission Management
      { resource: PermissionResource.PERMISSION, action: PermissionAction.READ, name: 'Read Permission', description: 'View available permissions' },

      // Analytics
      { resource: PermissionResource.ANALYTICS, action: PermissionAction.READ, name: 'Read Analytics', description: 'View analytics and reports' },
      { resource: PermissionResource.ANALYTICS, action: PermissionAction.EXPORT, name: 'Export Analytics', description: 'Export analytics data' },

      // Settings
      { resource: PermissionResource.SETTINGS, action: PermissionAction.READ, name: 'Read Settings', description: 'View system settings' },
      { resource: PermissionResource.SETTINGS, action: PermissionAction.UPDATE, name: 'Update Settings', description: 'Modify system settings' },

      // Audit Logs
      { resource: PermissionResource.AUDIT_LOG, action: PermissionAction.READ, name: 'Read Audit Log', description: 'View audit trails' },
      { resource: PermissionResource.AUDIT_LOG, action: PermissionAction.EXPORT, name: 'Export Audit Log', description: 'Export audit data' },
    ];

    this.logger.log(`Creating ${permissions.length} system permissions...`);

    for (const permission of permissions) {
      try {
        await this.rbacService.createPermission(permission);
      } catch (error) {
        this.logger.warn(`Permission ${permission.resource}.${permission.action} already exists`);
      }
    }

    this.logger.log('System permissions created successfully');
  }

  /**
   * Create default system roles
   */
  private async seedSystemRoles() {
    const systemRoles = [
      {
        name: 'Super Admin',
        description: 'Full system access for Velto team',
        scope: RoleScope.GLOBAL,
        permissions: [
          // All permissions - super admin has everything
          'TEST.CREATE', 'TEST.READ', 'TEST.UPDATE', 'TEST.DELETE',
          'TEST_RUN.CREATE', 'TEST_RUN.READ', 'TEST_RUN.EXECUTE', 'TEST_RUN.CANCEL', 'TEST_RUN.DELETE',
          'IMPORTED_CALL.IMPORT', 'IMPORTED_CALL.READ', 'IMPORTED_CALL.ANALYZE', 'IMPORTED_CALL.DELETE',
          'SPEECH.TRANSCRIBE', 'SPEECH.SYNTHESIZE', 'SPEECH.READ',
          'DIGITAL_HUMAN.CONFIGURE', 'DIGITAL_HUMAN.READ', 'DIGITAL_HUMAN.UPDATE',
          'TELEPHONY.INITIATE', 'TELEPHONY.READ', 'TELEPHONY.CONFIGURE',
          'ORGANIZATION.CREATE', 'ORGANIZATION.READ', 'ORGANIZATION.UPDATE', 'ORGANIZATION.DELETE',
          'USER.CREATE', 'USER.READ', 'USER.UPDATE', 'USER.DELETE',
          'ROLE.CREATE', 'ROLE.READ', 'ROLE.UPDATE', 'ROLE.DELETE',
          'PERMISSION.READ',
          'ANALYTICS.READ', 'ANALYTICS.EXPORT',
          'SETTINGS.READ', 'SETTINGS.UPDATE',
          'AUDIT_LOG.READ', 'AUDIT_LOG.EXPORT',
        ],
        color: '#DC2626',
        icon: 'shield-exclamation',
      },
      {
        name: 'Client Admin',
        description: 'Full access for client organization',
        scope: RoleScope.ORGANIZATION,
        permissions: [
          'TEST.CREATE', 'TEST.READ', 'TEST.UPDATE', 'TEST.DELETE',
          'TEST_RUN.CREATE', 'TEST_RUN.READ', 'TEST_RUN.EXECUTE', 'TEST_RUN.CANCEL', 'TEST_RUN.DELETE',
          'IMPORTED_CALL.IMPORT', 'IMPORTED_CALL.READ', 'IMPORTED_CALL.ANALYZE', 'IMPORTED_CALL.DELETE',
          'SPEECH.TRANSCRIBE', 'SPEECH.SYNTHESIZE', 'SPEECH.READ',
          'DIGITAL_HUMAN.CONFIGURE', 'DIGITAL_HUMAN.READ', 'DIGITAL_HUMAN.UPDATE',
          'TELEPHONY.INITIATE', 'TELEPHONY.READ',
          'ORGANIZATION.READ', 'ORGANIZATION.UPDATE',
          'USER.CREATE', 'USER.READ', 'USER.UPDATE', 'USER.DELETE',
          'ROLE.CREATE', 'ROLE.READ', 'ROLE.UPDATE', 'ROLE.DELETE',
          'PERMISSION.READ',
          'ANALYTICS.READ',
          'SETTINGS.READ', 'SETTINGS.UPDATE',
        ],
        color: '#2563EB',
        icon: 'building-office',
      },
      {
        name: 'Test Manager',
        description: 'Manage tests and test runs',
        scope: RoleScope.ORGANIZATION,
        permissions: [
          'TEST.CREATE', 'TEST.READ', 'TEST.UPDATE', 'TEST.DELETE',
          'TEST_RUN.CREATE', 'TEST_RUN.READ', 'TEST_RUN.EXECUTE', 'TEST_RUN.CANCEL', 'TEST_RUN.DELETE',
          'IMPORTED_CALL.IMPORT', 'IMPORTED_CALL.READ', 'IMPORTED_CALL.ANALYZE',
          'SPEECH.TRANSCRIBE', 'SPEECH.SYNTHESIZE', 'SPEECH.READ',
          'DIGITAL_HUMAN.READ', 'DIGITAL_HUMAN.UPDATE',
          'TELEPHONY.INITIATE', 'TELEPHONY.READ',
          'ORGANIZATION.READ',
          'USER.READ',
          'ANALYTICS.READ',
        ],
        color: '#7C3AED',
        icon: 'briefcase',
      },
      {
        name: 'Viewer',
        description: 'Read-only access',
        scope: RoleScope.ORGANIZATION,
        permissions: [
          'TEST.READ',
          'TEST_RUN.READ',
          'IMPORTED_CALL.READ',
          'SPEECH.READ',
          'DIGITAL_HUMAN.READ',
          'TELEPHONY.READ',
          'ORGANIZATION.READ',
          'USER.READ',
          'ROLE.READ',
          'PERMISSION.READ',
          'ANALYTICS.READ',
        ],
        color: '#6B7280',
        icon: 'eye',
      },
    ];

    this.logger.log(`Creating ${systemRoles.length} system roles...`);

    for (const roleData of systemRoles) {
      try {
        const createRoleDto: CreateRoleDto = {
          name: roleData.name,
          description: roleData.description,
          scope: roleData.scope,
          permissions: roleData.permissions,
          color: roleData.color,
          icon: roleData.icon,
          organizationId: roleData.scope === RoleScope.GLOBAL ? undefined : undefined,
        };

        const role = await this.rbacService.createRole(createRoleDto);
        
        // Mark as system role
        await this.rbacService['prisma'].role.update({
          where: { id: role.id },
          data: { isSystem: true },
        });

        this.logger.log(`Created system role: ${roleData.name}`);
      } catch (error) {
        this.logger.warn(`System role ${roleData.name} creation failed: ${error.message}`);
      }
    }

    this.logger.log('System roles created successfully');
  }

  /**
   * Create default roles for a new organization
   */
  async seedOrganizationRoles(organizationId: string) {
    const defaultRoles = ['Client Admin', 'Test Manager', 'Viewer'];

    this.logger.log(`Creating default roles for organization: ${organizationId}`);

    for (const roleName of defaultRoles) {
      try {
        // Find the system role template
        const systemRole = await this.rbacService['prisma'].role.findFirst({
          where: {
            name: roleName,
            scope: RoleScope.ORGANIZATION,
            isSystem: true,
            organizationId: null,
          },
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        });

        if (systemRole) {
          // Create organization-specific copy
          const createRoleDto: CreateRoleDto = {
            name: systemRole.name,
            description: systemRole.description ?? undefined,
            scope: RoleScope.ORGANIZATION,
            organizationId,
            permissions: systemRole.permissions.map(rp => 
              `${rp.permission.resource}.${rp.permission.action}`
            ),
            color: systemRole.color ?? undefined,
            icon: systemRole.icon ?? undefined,
          };

          await this.rbacService.createRole(createRoleDto);
          this.logger.log(`Created role: ${roleName} for organization ${organizationId}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to create role ${roleName} for organization: ${error.message}`);
      }
    }
  }
}