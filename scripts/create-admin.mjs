// Build plan P1: creates a Platform Admin user. There is no public admin
// signup — this script is the only way to make one.
//
//   node scripts/create-admin.mjs --email admin@example.com --password "Secret123"
//   (or set ADMIN_EMAIL / ADMIN_PASSWORD in the environment)
//
// Add --reset-password to change the password of an existing admin.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { emailSchema, passwordSchema } from '../src/shared/schemas/auth.schema.js';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const email = (arg('email') || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = arg('password') || process.env.ADMIN_PASSWORD || '';
const resetPassword = process.argv.includes('--reset-password');

const emailCheck = emailSchema.safeParse(email);
const passwordCheck = passwordSchema.safeParse(password);
if (!emailCheck.success || !passwordCheck.success) {
  console.error('Usage: node scripts/create-admin.mjs --email <email> --password <password> [--reset-password]');
  if (!emailCheck.success) console.error(' - email:', emailCheck.error.issues[0].message);
  if (!passwordCheck.success) console.error(' - password:', passwordCheck.error.issues[0].message);
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && existing.role !== 'ADMIN') {
    console.error(`${email} already belongs to a ${existing.role} account — use a different email for the admin.`);
    process.exitCode = 1;
  } else if (existing && !resetPassword) {
    console.log(`Admin ${email} already exists. Pass --reset-password to change its password.`);
  } else if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, isActive: true } });
    console.log(`Password updated for admin ${email}.`);
  } else {
    await prisma.user.create({ data: { email, passwordHash, role: 'ADMIN' } });
    console.log(`Admin ${email} created. Log in at /auth/login — you'll land on /admin/companies.`);
  }
} finally {
  await prisma.$disconnect();
}
