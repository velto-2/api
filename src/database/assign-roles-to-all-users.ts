import {
  PrismaClient,
  RoleScope,
} from '@prisma/client';

const prisma = new PrismaClient();

async function assignRolesToAllUsers() {
  console.log('🔧 Assigning roles to all users...\n');

  // Get all organizations
  const orgs = await prisma.organization.findMany({
    include: {
      users: {
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      },
    },
  });

  for (const org of orgs) {
    console.log(`\n📋 Processing organization: ${org.name} (${org.type})`);

    // Determine which role to assign based on organization type
    let roleToAssign;
    if (org.type === 'INTERNAL') {
      // For internal orgs, assign Super Admin
      roleToAssign = await prisma.role.findFirst({
        where: {
          name: 'Super Admin',
          scope: RoleScope.GLOBAL,
        },
      });
    } else if (org.type === 'CLIENT') {
      // For client orgs, create org roles if needed, then assign Client Admin
      // First, seed organization roles
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
        let orgRole = await prisma.role.findFirst({
          where: {
            name: systemRole.name,
            scope: RoleScope.ORGANIZATION,
            organizationId: org.id,
          },
        });

        if (!orgRole) {
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

          // Copy permissions
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

        // Set Client Admin as the role to assign
        if (systemRole.name === 'Client Admin') {
          roleToAssign = orgRole;
        }
      }
    }

    // Assign role to users without roles
    if (roleToAssign) {
      for (const user of org.users) {
        const hasRoles = user.userRoles.length > 0;

        if (!hasRoles) {
          try {
            await prisma.userRole.create({
              data: {
                userId: user.id,
                roleId: roleToAssign.id,
              },
            });
            console.log(`  ✅ Assigned ${roleToAssign.name} role to: ${user.email}`);
          } catch (error: any) {
            if (error.code !== 'P2002') {
              console.error(`  ❌ Failed to assign role to ${user.email}:`, error.message);
            }
          }
        } else {
          console.log(`  ℹ️  User ${user.email} already has roles: ${user.userRoles.map(ur => ur.role.name).join(', ')}`);
        }
      }
    } else {
      console.log(`  ⚠️  No role found to assign for organization type: ${org.type}`);
    }
  }

  console.log('\n✨ Role assignment completed!\n');
}

assignRolesToAllUsers()
  .catch((e) => {
    console.error('\n❌ Assignment failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




