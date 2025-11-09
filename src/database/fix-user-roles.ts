import { PrismaClient, RoleScope } from '@prisma/client';

const prisma = new PrismaClient();

async function fixUserRoles() {
  console.log('🔧 Fixing user roles...\n');

  // Find all CLIENT organizations
  const clientOrgs = await prisma.organization.findMany({
    where: { type: 'CLIENT' },
    include: {
      users: true,
    },
  });

  for (const org of clientOrgs) {
    console.log(`\n📋 Processing organization: ${org.name} (${org.id})`);

    // Seed organization roles
    const systemRoles = await prisma.role.findMany({
      where: {
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

    for (const systemRole of systemRoles) {
      // Check if org role exists
      let orgRole = await prisma.role.findFirst({
        where: {
          name: systemRole.name,
          scope: RoleScope.ORGANIZATION,
          organizationId: org.id,
        },
      });

      if (!orgRole) {
        // Create org copy
        orgRole = await prisma.role.create({
          data: {
            name: systemRole.name,
            slug: systemRole.slug,
            description: systemRole.description,
            scope: RoleScope.ORGANIZATION,
            organizationId: org.id,
            isSystem: false,
            color: systemRole.color,
            icon: systemRole.icon,
          },
        });

        // Assign permissions
        for (const rp of systemRole.permissions) {
          try {
            await prisma.rolePermission.create({
              data: {
                roleId: orgRole.id,
                permissionId: rp.permission.id,
              },
            });
          } catch (error: any) {
            if (error.code !== 'P2002') {
              throw error;
            }
          }
        }

        console.log(`  ✅ Created role: ${systemRole.name}`);
      }
    }

    // Assign Client Admin role to users without roles
    const clientAdminRole = await prisma.role.findFirst({
      where: {
        name: 'Client Admin',
        scope: RoleScope.ORGANIZATION,
        organizationId: org.id,
      },
    });

    if (clientAdminRole) {
      for (const user of org.users) {
        const hasRoles = await prisma.userRole.findFirst({
          where: { userId: user.id },
        });

        if (!hasRoles) {
          try {
            await prisma.userRole.create({
              data: {
                userId: user.id,
                roleId: clientAdminRole.id,
              },
            });
            console.log(`  ✅ Assigned Client Admin role to: ${user.email}`);
          } catch (error: any) {
            if (error.code !== 'P2002') {
              console.error(
                `  ❌ Failed to assign role to ${user.email}:`,
                error.message,
              );
            }
          }
        }
      }
    }
  }

  console.log('\n✨ User roles fixed!\n');
}

fixUserRoles()
  .catch((e) => {
    console.error('\n❌ Fix failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



