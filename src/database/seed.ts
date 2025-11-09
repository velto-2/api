import {
  PrismaClient,
  OrganizationType,
  UserStatus,
  RoleScope,
  PermissionResource,
  PermissionAction,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedPermissions() {
  console.log('   (Note: MongoDB unique constraints require replica set)');
  const permissions = [
    // Test Management
    {
      resource: PermissionResource.TEST,
      action: PermissionAction.CREATE,
      name: 'Create Test',
      description: 'Create new test configurations',
    },
    {
      resource: PermissionResource.TEST,
      action: PermissionAction.READ,
      name: 'Read Test',
      description: 'View test configurations',
    },
    {
      resource: PermissionResource.TEST,
      action: PermissionAction.UPDATE,
      name: 'Update Test',
      description: 'Edit test configurations',
    },
    {
      resource: PermissionResource.TEST,
      action: PermissionAction.DELETE,
      name: 'Delete Test',
      description: 'Delete test configurations',
    },
    // Test Run
    {
      resource: PermissionResource.TEST_RUN,
      action: PermissionAction.CREATE,
      name: 'Create Test Run',
      description: 'Create new test runs',
    },
    {
      resource: PermissionResource.TEST_RUN,
      action: PermissionAction.READ,
      name: 'Read Test Run',
      description: 'View test run results',
    },
    {
      resource: PermissionResource.TEST_RUN,
      action: PermissionAction.EXECUTE,
      name: 'Execute Test Run',
      description: 'Execute test runs',
    },
    {
      resource: PermissionResource.TEST_RUN,
      action: PermissionAction.CANCEL,
      name: 'Cancel Test Run',
      description: 'Cancel running test runs',
    },
    {
      resource: PermissionResource.TEST_RUN,
      action: PermissionAction.DELETE,
      name: 'Delete Test Run',
      description: 'Delete test runs',
    },
    // Imported Call
    {
      resource: PermissionResource.IMPORTED_CALL,
      action: PermissionAction.IMPORT,
      name: 'Import Call',
      description: 'Import call recordings',
    },
    {
      resource: PermissionResource.IMPORTED_CALL,
      action: PermissionAction.READ,
      name: 'Read Imported Call',
      description: 'View imported calls',
    },
    {
      resource: PermissionResource.IMPORTED_CALL,
      action: PermissionAction.ANALYZE,
      name: 'Analyze Call',
      description: 'Analyze imported calls',
    },
    {
      resource: PermissionResource.IMPORTED_CALL,
      action: PermissionAction.DELETE,
      name: 'Delete Imported Call',
      description: 'Delete imported calls',
    },
    // Speech
    {
      resource: PermissionResource.SPEECH,
      action: PermissionAction.TRANSCRIBE,
      name: 'Transcribe Speech',
      description: 'Transcribe audio to text',
    },
    {
      resource: PermissionResource.SPEECH,
      action: PermissionAction.SYNTHESIZE,
      name: 'Synthesize Speech',
      description: 'Generate speech from text',
    },
    {
      resource: PermissionResource.SPEECH,
      action: PermissionAction.READ,
      name: 'Read Speech',
      description: 'View speech service data',
    },
    // Digital Human
    {
      resource: PermissionResource.DIGITAL_HUMAN,
      action: PermissionAction.CONFIGURE,
      name: 'Configure Digital Human',
      description: 'Configure digital human settings',
    },
    {
      resource: PermissionResource.DIGITAL_HUMAN,
      action: PermissionAction.READ,
      name: 'Read Digital Human',
      description: 'View digital human configurations',
    },
    {
      resource: PermissionResource.DIGITAL_HUMAN,
      action: PermissionAction.UPDATE,
      name: 'Update Digital Human',
      description: 'Update digital human settings',
    },
    // Telephony
    {
      resource: PermissionResource.TELEPHONY,
      action: PermissionAction.INITIATE,
      name: 'Initiate Call',
      description: 'Initiate phone calls',
    },
    {
      resource: PermissionResource.TELEPHONY,
      action: PermissionAction.READ,
      name: 'Read Telephony',
      description: 'View call details',
    },
    {
      resource: PermissionResource.TELEPHONY,
      action: PermissionAction.CONFIGURE,
      name: 'Configure Telephony',
      description: 'Configure telephony settings',
    },
    // Organization
    {
      resource: PermissionResource.ORGANIZATION,
      action: PermissionAction.CREATE,
      name: 'Create Organization',
      description: 'Register new organizations',
    },
    {
      resource: PermissionResource.ORGANIZATION,
      action: PermissionAction.READ,
      name: 'Read Organization',
      description: 'View organization details',
    },
    {
      resource: PermissionResource.ORGANIZATION,
      action: PermissionAction.UPDATE,
      name: 'Update Organization',
      description: 'Edit organization information',
    },
    {
      resource: PermissionResource.ORGANIZATION,
      action: PermissionAction.DELETE,
      name: 'Delete Organization',
      description: 'Remove organizations',
    },
    // User
    {
      resource: PermissionResource.USER,
      action: PermissionAction.CREATE,
      name: 'Create User',
      description: 'Invite new users',
    },
    {
      resource: PermissionResource.USER,
      action: PermissionAction.READ,
      name: 'Read User',
      description: 'View user profiles',
    },
    {
      resource: PermissionResource.USER,
      action: PermissionAction.UPDATE,
      name: 'Update User',
      description: 'Edit user information and roles',
    },
    {
      resource: PermissionResource.USER,
      action: PermissionAction.DELETE,
      name: 'Delete User',
      description: 'Remove users',
    },
    // Role
    {
      resource: PermissionResource.ROLE,
      action: PermissionAction.CREATE,
      name: 'Create Role',
      description: 'Create custom roles',
    },
    {
      resource: PermissionResource.ROLE,
      action: PermissionAction.READ,
      name: 'Read Role',
      description: 'View roles and permissions',
    },
    {
      resource: PermissionResource.ROLE,
      action: PermissionAction.UPDATE,
      name: 'Update Role',
      description: 'Edit roles and assign permissions',
    },
    {
      resource: PermissionResource.ROLE,
      action: PermissionAction.DELETE,
      name: 'Delete Role',
      description: 'Remove custom roles',
    },
    // Permission
    {
      resource: PermissionResource.PERMISSION,
      action: PermissionAction.READ,
      name: 'Read Permission',
      description: 'View available permissions',
    },
    // Analytics
    {
      resource: PermissionResource.ANALYTICS,
      action: PermissionAction.READ,
      name: 'Read Analytics',
      description: 'View analytics and reports',
    },
    {
      resource: PermissionResource.ANALYTICS,
      action: PermissionAction.EXPORT,
      name: 'Export Analytics',
      description: 'Export analytics data',
    },
    // Settings
    {
      resource: PermissionResource.SETTINGS,
      action: PermissionAction.READ,
      name: 'Read Settings',
      description: 'View system settings',
    },
    {
      resource: PermissionResource.SETTINGS,
      action: PermissionAction.UPDATE,
      name: 'Update Settings',
      description: 'Modify system settings',
    },
    // Audit Log
    {
      resource: PermissionResource.AUDIT_LOG,
      action: PermissionAction.READ,
      name: 'Read Audit Log',
      description: 'View audit trails',
    },
    {
      resource: PermissionResource.AUDIT_LOG,
      action: PermissionAction.EXPORT,
      name: 'Export Audit Log',
      description: 'Export audit data',
    },
  ];

  for (const perm of permissions) {
    try {
      await prisma.permission.create({
        data: {
          ...perm,
          isSystem: true,
        },
      });
    } catch (error: any) {
      // Ignore duplicate errors (P2002) and transaction errors if permission already exists
      if (error.code === 'P2002' || error.code === 'P2031') {
        // Check if permission actually exists
        const exists = await prisma.permission.findUnique({
          where: {
            resource_action: {
              resource: perm.resource,
              action: perm.action,
            },
          },
        });
        if (!exists && error.code === 'P2031') {
          throw new Error(
            'MongoDB replica set required for unique constraints.\n' +
              'See SEED_README.md for setup instructions.\n' +
              'Or use MongoDB Atlas (free tier available).',
          );
        }
      } else {
        throw error;
      }
    }
  }
}

async function seedRoles() {
  const superAdminPerms = await prisma.permission.findMany({});
  const superAdminPermKeys = superAdminPerms.map(
    (p) => `${p.resource}.${p.action}`,
  );

  const roles = [
    {
      name: 'Super Admin',
      slug: 'super-admin',
      description: 'Full system access for Velto team',
      scope: RoleScope.GLOBAL,
      permissions: superAdminPermKeys,
      isSystem: true,
      color: '#DC2626',
    },
    {
      name: 'Client Admin',
      slug: 'client-admin',
      description: 'Full access for client organization',
      scope: RoleScope.ORGANIZATION,
      permissions: [
        'TEST.CREATE',
        'TEST.READ',
        'TEST.UPDATE',
        'TEST.DELETE',
        'TEST_RUN.CREATE',
        'TEST_RUN.READ',
        'TEST_RUN.EXECUTE',
        'TEST_RUN.CANCEL',
        'TEST_RUN.DELETE',
        'IMPORTED_CALL.IMPORT',
        'IMPORTED_CALL.READ',
        'IMPORTED_CALL.ANALYZE',
        'IMPORTED_CALL.DELETE',
        'SPEECH.TRANSCRIBE',
        'SPEECH.SYNTHESIZE',
        'SPEECH.READ',
        'DIGITAL_HUMAN.CONFIGURE',
        'DIGITAL_HUMAN.READ',
        'DIGITAL_HUMAN.UPDATE',
        'TELEPHONY.INITIATE',
        'TELEPHONY.READ',
        'ORGANIZATION.READ',
        'ORGANIZATION.UPDATE',
        'USER.CREATE',
        'USER.READ',
        'USER.UPDATE',
        'USER.DELETE',
        'ROLE.CREATE',
        'ROLE.READ',
        'ROLE.UPDATE',
        'ROLE.DELETE',
        'PERMISSION.READ',
        'ANALYTICS.READ',
        'SETTINGS.READ',
        'SETTINGS.UPDATE',
      ],
      isSystem: true,
      color: '#2563EB',
    },
    {
      name: 'Test Manager',
      slug: 'test-manager',
      description: 'Manage tests and test runs',
      scope: RoleScope.ORGANIZATION,
      permissions: [
        'TEST.CREATE',
        'TEST.READ',
        'TEST.UPDATE',
        'TEST.DELETE',
        'TEST_RUN.CREATE',
        'TEST_RUN.READ',
        'TEST_RUN.EXECUTE',
        'TEST_RUN.CANCEL',
        'TEST_RUN.DELETE',
        'IMPORTED_CALL.IMPORT',
        'IMPORTED_CALL.READ',
        'IMPORTED_CALL.ANALYZE',
        'SPEECH.TRANSCRIBE',
        'SPEECH.SYNTHESIZE',
        'SPEECH.READ',
        'DIGITAL_HUMAN.READ',
        'DIGITAL_HUMAN.UPDATE',
        'TELEPHONY.INITIATE',
        'TELEPHONY.READ',
        'ORGANIZATION.READ',
        'USER.READ',
        'ANALYTICS.READ',
      ],
      isSystem: true,
      color: '#7C3AED',
    },
    {
      name: 'Viewer',
      slug: 'viewer',
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
      isSystem: true,
      color: '#6B7280',
    },
  ];

  for (const roleData of roles) {
    const { permissions: permKeys, ...roleInfo } = roleData;

    // Find existing role or create new
    let role = await prisma.role.findFirst({
      where: {
        slug: roleInfo.slug,
        organizationId: null,
        scope: roleInfo.scope,
      },
    });

    if (!role) {
      role = await prisma.role.create({
        data: roleInfo,
      });
    } else {
      // Update existing role
      role = await prisma.role.update({
        where: { id: role.id },
        data: {
          name: roleInfo.name,
          description: roleInfo.description,
          color: roleInfo.color,
        },
      });
    }

    // Assign permissions
    for (const key of permKeys) {
      const [resource, action] = key.split('.');
      const permission = await prisma.permission.findUnique({
        where: {
          resource_action: {
            resource: resource as PermissionResource,
            action: action as PermissionAction,
          },
        },
      });

      if (permission) {
        try {
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permission.id,
            },
          });
        } catch (error: any) {
          // Ignore duplicate errors
          if (!error.code || error.code !== 'P2002') {
            throw error;
          }
        }
      }
    }
  }
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  // 1. Seed Permissions
  console.log('📋 Seeding permissions...');
  await seedPermissions();
  console.log('✅ Permissions seeded\n');

  // 2. Seed Roles
  console.log('👥 Seeding roles...');
  await seedRoles();
  console.log('✅ Roles seeded\n');

  // 3. Create Velto Internal Organization
  console.log('🏢 Creating Velto internal organization...');
  let veltoOrg = await prisma.organization.findUnique({
    where: { email: 'team@velto.ai' },
  });

  if (!veltoOrg) {
    veltoOrg = await prisma.organization.create({
      data: {
        type: OrganizationType.INTERNAL,
        status: 'ACTIVE',
        name: 'Velto',
        email: 'team@velto.ai',
        phone: '+1234567890',
        registrationNumber: 'VELTO-INTERNAL',
        address: {},
        industry: [],
        settings: {},
        metadata: {},
        verifiedAt: new Date(),
      },
    });
  }
  console.log(`✅ Velto organization: ${veltoOrg.id}\n`);

  // 4. Create Super Admin User
  console.log('👤 Creating super admin user...');
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@velto.ai';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  let adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        organizationId: veltoOrg.id,
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        status: UserStatus.ACTIVE,
        isActive: true,
        emailVerified: true,
      },
    });
  } else {
    adminUser = await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        password: hashedPassword,
        organizationId: veltoOrg.id,
      },
    });
  }
  console.log(`✅ Admin user: ${adminEmail}\n`);

  // 5. Assign Super Admin Role
  console.log('🔐 Assigning Super Admin role...');
  const superAdminRole = await prisma.role.findFirst({
    where: {
      name: 'Super Admin',
      scope: RoleScope.GLOBAL,
    },
  });

  if (superAdminRole) {
    const existing = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: superAdminRole.id,
        },
      },
    });

    try {
      await prisma.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: superAdminRole.id,
        },
      });
    } catch (error: any) {
      // Ignore duplicate errors
      if (!error.code || error.code !== 'P2002') {
        throw error;
      }
    }
    console.log('✅ Super Admin role assigned\n');
  } else {
    console.warn('⚠️  Super Admin role not found\n');
  }

  console.log('✨ Seed completed!\n');
  console.log('📧 Admin credentials:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log('\n⚠️  Change the password after first login!\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e.message);
    if (e.message?.includes('replica set')) {
      console.error('\n💡 Quick fix options:');
      console.error(
        '   1. Use MongoDB Atlas (free): https://www.mongodb.com/cloud/atlas',
      );
      console.error('   2. Set up local replica set (see SEED_README.md)');
      console.error(
        '   3. For dev only: Remove @unique constraints from schema\n',
      );
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
