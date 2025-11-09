import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Resetting database...');

  // Delete in order to respect foreign key constraints
  await prisma.userPermission.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.organization.deleteMany({});

  console.log('✅ Database reset complete');
  console.log('💡 Run "npm run seed" to populate with initial data');
}

main()
  .catch((e) => {
    console.error('❌ Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

