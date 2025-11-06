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
      // Job Management
      { resource: PermissionResource.JOB_REQUEST, action: PermissionAction.CREATE, name: 'Create Job Request', description: 'Create new job requests' },
      { resource: PermissionResource.JOB_REQUEST, action: PermissionAction.READ, name: 'Read Job Request', description: 'View job requests' },
      { resource: PermissionResource.JOB_REQUEST, action: PermissionAction.UPDATE, name: 'Update Job Request', description: 'Edit job requests' },
      { resource: PermissionResource.JOB_REQUEST, action: PermissionAction.DELETE, name: 'Delete Job Request', description: 'Delete job requests' },

      // Offer Management
      { resource: PermissionResource.OFFER, action: PermissionAction.CREATE, name: 'Create Offer', description: 'Submit offers for job requests' },
      { resource: PermissionResource.OFFER, action: PermissionAction.READ, name: 'Read Offer', description: 'View offers' },
      { resource: PermissionResource.OFFER, action: PermissionAction.UPDATE, name: 'Update Offer', description: 'Edit offers' },
      { resource: PermissionResource.OFFER, action: PermissionAction.DELETE, name: 'Delete Offer', description: 'Delete offers' },
      { resource: PermissionResource.OFFER, action: PermissionAction.APPROVE, name: 'Approve Offer', description: 'Accept or reject offers' },

      // Contract Management
      { resource: PermissionResource.CONTRACT, action: PermissionAction.CREATE, name: 'Create Contract', description: 'Generate contracts from offers' },
      { resource: PermissionResource.CONTRACT, action: PermissionAction.READ, name: 'Read Contract', description: 'View contracts' },
      { resource: PermissionResource.CONTRACT, action: PermissionAction.UPDATE, name: 'Update Contract', description: 'Edit contract details' },
      { resource: PermissionResource.CONTRACT, action: PermissionAction.DELETE, name: 'Delete Contract', description: 'Cancel contracts' },
      { resource: PermissionResource.CONTRACT, action: PermissionAction.SIGN, name: 'Sign Contract', description: 'Digitally sign contracts' },

      // Worker Management
      { resource: PermissionResource.WORKER, action: PermissionAction.CREATE, name: 'Create Worker', description: 'Add new workers' },
      { resource: PermissionResource.WORKER, action: PermissionAction.READ, name: 'Read Worker', description: 'View worker profiles' },
      { resource: PermissionResource.WORKER, action: PermissionAction.UPDATE, name: 'Update Worker', description: 'Edit worker information' },
      { resource: PermissionResource.WORKER, action: PermissionAction.DELETE, name: 'Delete Worker', description: 'Remove workers' },
      { resource: PermissionResource.WORKER, action: PermissionAction.ASSIGN, name: 'Assign Worker', description: 'Assign workers to contracts' },

      // Timesheet Management
      { resource: PermissionResource.TIMESHEET, action: PermissionAction.CREATE, name: 'Create Timesheet', description: 'Submit timesheets' },
      { resource: PermissionResource.TIMESHEET, action: PermissionAction.READ, name: 'Read Timesheet', description: 'View timesheets' },
      { resource: PermissionResource.TIMESHEET, action: PermissionAction.UPDATE, name: 'Update Timesheet', description: 'Edit timesheets' },
      { resource: PermissionResource.TIMESHEET, action: PermissionAction.DELETE, name: 'Delete Timesheet', description: 'Delete timesheets' },
      { resource: PermissionResource.TIMESHEET, action: PermissionAction.APPROVE, name: 'Approve Timesheet', description: 'Approve or reject timesheets' },

      // Invoice Management
      { resource: PermissionResource.INVOICE, action: PermissionAction.CREATE, name: 'Create Invoice', description: 'Generate invoices' },
      { resource: PermissionResource.INVOICE, action: PermissionAction.READ, name: 'Read Invoice', description: 'View invoices' },
      { resource: PermissionResource.INVOICE, action: PermissionAction.UPDATE, name: 'Update Invoice', description: 'Edit invoices' },
      { resource: PermissionResource.INVOICE, action: PermissionAction.DELETE, name: 'Delete Invoice', description: 'Cancel invoices' },
      { resource: PermissionResource.INVOICE, action: PermissionAction.APPROVE, name: 'Approve Invoice', description: 'Approve invoices for payment' },

      // Payment Management
      { resource: PermissionResource.PAYMENT, action: PermissionAction.CREATE, name: 'Create Payment', description: 'Process payments' },
      { resource: PermissionResource.PAYMENT, action: PermissionAction.READ, name: 'Read Payment', description: 'View payment records' },
      { resource: PermissionResource.PAYMENT, action: PermissionAction.UPDATE, name: 'Update Payment', description: 'Edit payment details' },
      { resource: PermissionResource.PAYMENT, action: PermissionAction.DELETE, name: 'Delete Payment', description: 'Cancel payments' },

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
        description: 'Full system access',
        scope: RoleScope.GLOBAL,
        permissions: [
          // All permissions - super admin has everything
          'JOB_REQUEST.CREATE', 'JOB_REQUEST.READ', 'JOB_REQUEST.UPDATE', 'JOB_REQUEST.DELETE',
          'OFFER.CREATE', 'OFFER.READ', 'OFFER.UPDATE', 'OFFER.DELETE', 'OFFER.APPROVE',
          'CONTRACT.CREATE', 'CONTRACT.READ', 'CONTRACT.UPDATE', 'CONTRACT.DELETE', 'CONTRACT.SIGN',
          'WORKER.CREATE', 'WORKER.READ', 'WORKER.UPDATE', 'WORKER.DELETE', 'WORKER.ASSIGN',
          'TIMESHEET.CREATE', 'TIMESHEET.READ', 'TIMESHEET.UPDATE', 'TIMESHEET.DELETE', 'TIMESHEET.APPROVE',
          'INVOICE.CREATE', 'INVOICE.READ', 'INVOICE.UPDATE', 'INVOICE.DELETE', 'INVOICE.APPROVE',
          'PAYMENT.CREATE', 'PAYMENT.READ', 'PAYMENT.UPDATE', 'PAYMENT.DELETE',
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
        name: 'Employer Admin',
        description: 'Full access for employer organization',
        scope: RoleScope.ORGANIZATION,
        permissions: [
          'JOB_REQUEST.CREATE', 'JOB_REQUEST.READ', 'JOB_REQUEST.UPDATE', 'JOB_REQUEST.DELETE',
          'OFFER.READ', 'OFFER.APPROVE',
          'CONTRACT.READ', 'CONTRACT.SIGN',
          'TIMESHEET.READ', 'TIMESHEET.APPROVE',
          'INVOICE.READ', 'INVOICE.APPROVE',
          'PAYMENT.CREATE', 'PAYMENT.READ',
          'ORGANIZATION.READ', 'ORGANIZATION.UPDATE',
          'USER.CREATE', 'USER.READ', 'USER.UPDATE', 'USER.DELETE',
          'ROLE.CREATE', 'ROLE.READ', 'ROLE.UPDATE', 'ROLE.DELETE',
          'PERMISSION.READ',
          'ANALYTICS.READ',
        ],
        color: '#2563EB',
        icon: 'building-office',
      },
      {
        name: 'Agency Admin',
        description: 'Full access for agency organization',
        scope: RoleScope.ORGANIZATION,
        permissions: [
          'JOB_REQUEST.READ',
          'OFFER.CREATE', 'OFFER.READ', 'OFFER.UPDATE', 'OFFER.DELETE',
          'CONTRACT.READ', 'CONTRACT.SIGN',
          'WORKER.CREATE', 'WORKER.READ', 'WORKER.UPDATE', 'WORKER.DELETE', 'WORKER.ASSIGN',
          'TIMESHEET.CREATE', 'TIMESHEET.READ', 'TIMESHEET.UPDATE',
          'INVOICE.CREATE', 'INVOICE.READ',
          'PAYMENT.READ',
          'ORGANIZATION.READ', 'ORGANIZATION.UPDATE',
          'USER.CREATE', 'USER.READ', 'USER.UPDATE', 'USER.DELETE',
          'ROLE.CREATE', 'ROLE.READ', 'ROLE.UPDATE', 'ROLE.DELETE',
          'PERMISSION.READ',
          'ANALYTICS.READ',
        ],
        color: '#059669',
        icon: 'user-group',
      },
      {
        name: 'Employer Manager',
        description: 'Job and contract management for employers',
        scope: RoleScope.ORGANIZATION,
        permissions: [
          'JOB_REQUEST.CREATE', 'JOB_REQUEST.READ', 'JOB_REQUEST.UPDATE',
          'OFFER.READ', 'OFFER.APPROVE',
          'CONTRACT.READ', 'CONTRACT.SIGN',
          'TIMESHEET.READ', 'TIMESHEET.APPROVE',
          'INVOICE.READ',
          'PAYMENT.READ',
          'ORGANIZATION.READ',
          'USER.READ',
        ],
        color: '#7C3AED',
        icon: 'briefcase',
      },
      {
        name: 'Agency Manager',
        description: 'Worker and offer management for agencies',
        scope: RoleScope.ORGANIZATION,
        permissions: [
          'JOB_REQUEST.READ',
          'OFFER.CREATE', 'OFFER.READ', 'OFFER.UPDATE',
          'CONTRACT.READ',
          'WORKER.CREATE', 'WORKER.READ', 'WORKER.UPDATE', 'WORKER.ASSIGN',
          'TIMESHEET.CREATE', 'TIMESHEET.READ', 'TIMESHEET.UPDATE',
          'INVOICE.READ',
          'PAYMENT.READ',
          'ORGANIZATION.READ',
          'USER.READ',
        ],
        color: '#EA580C',
        icon: 'users',
      },
      {
        name: 'Viewer',
        description: 'Read-only access',
        scope: RoleScope.ORGANIZATION,
        permissions: [
          'JOB_REQUEST.READ',
          'OFFER.READ',
          'CONTRACT.READ',
          'WORKER.READ',
          'TIMESHEET.READ',
          'INVOICE.READ',
          'PAYMENT.READ',
          'ORGANIZATION.READ',
          'USER.READ',
          'ROLE.READ',
          'PERMISSION.READ',
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
  async seedOrganizationRoles(organizationId: string, organizationType: 'EMPLOYER' | 'AGENCY') {
    const defaultRoles = organizationType === 'EMPLOYER' 
      ? ['Employer Admin', 'Employer Manager', 'Viewer']
      : ['Agency Admin', 'Agency Manager', 'Viewer'];

    this.logger.log(`Creating default roles for ${organizationType} organization: ${organizationId}`);

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