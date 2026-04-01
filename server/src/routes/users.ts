import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod/v4';
import { Role } from '../constants';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { param } from '../lib/params';

const router = Router();

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['EP', 'PRODUCER', 'ASSOC_PRODUCER', 'INTERN'] as const),
  name: z.string().min(1).optional(),
  title: z.string().optional(),
});

const updateUserSchema = z.object({
  role: z.enum(['EP', 'PRODUCER', 'ASSOC_PRODUCER', 'INTERN'] as const).optional(),
  name: z.string().min(1).optional(),
  title: z.string().nullable().optional(),
});

// GET /users — EP only
router.get('/', requireRole(Role.EP), async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      title: true,
      role: true,
      created_at: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

// POST /users/invite — EP only
router.post('/invite', requireRole(Role.EP), async (req: AuthRequest, res: Response) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid invite data');
  }

  const { email, role, name, title } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'User already exists');
  }

  // Stub: in production, send an email invite with a temp password or magic link
  const tempPassword = await bcrypt.hash('temppass123', 10);
  const user = await prisma.user.create({
    data: {
      email,
      password_hash: tempPassword,
      role,
      name: name ?? email.split('@')[0],
      ...(title ? { title } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      title: true,
      role: true,
      created_at: true,
    },
  });

  res.status(201).json({ message: 'Invite sent', user });
});

// PATCH /users/:id — EP only
router.patch('/:id', requireRole(Role.EP), async (req: AuthRequest, res: Response) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid update data');
  }

  const user = await prisma.user.update({
    where: { id: param(req.params.id) },
    data: parsed.data,
    select: {
      id: true,
      email: true,
      name: true,
      title: true,
      role: true,
      created_at: true,
    },
  });
  res.json(user);
});

// DELETE /users/:id — EP only
router.delete('/:id', requireRole(Role.EP), async (req: AuthRequest, res: Response) => {
  await prisma.user.delete({ where: { id: param(req.params.id) } });
  res.status(204).end();
});

export default router;
