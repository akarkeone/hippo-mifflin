/**
 * Production seed — runs on every Railway deploy (idempotent).
 * Only creates the test account; leaves all other data untouched.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('hippo2026', 10);

  await prisma.user.upsert({
    where: { email: 'test@hippo.app' },
    update: {},
    create: {
      email: 'test@hippo.app',
      password_hash: hash,
      role: 'EP',
      name: 'Test User',
      title: 'Executive Producer',
    },
  });

  console.log('✔  Production seed complete.');
  console.log('   Login: test@hippo.app  /  hippo2026');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
