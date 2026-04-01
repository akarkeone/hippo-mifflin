import { Router, Response } from 'express';
import { z } from 'zod/v4';
import { Role } from '../constants';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { param } from '../lib/params';

const router = Router();

// GET /categories — all authenticated users
router.get('/', async (_req: AuthRequest, res: Response) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  res.json(categories);
});

// POST /categories — EP only
router.post('/', requireRole(Role.EP), async (req: AuthRequest, res: Response) => {
  const schema = z.object({ name: z.string().min(1).max(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Invalid category data');
  const category = await prisma.category.create({ data: { name: parsed.data.name } });
  res.status(201).json(category);
});

// DELETE /categories/:id — EP only
router.delete('/:id', requireRole(Role.EP), async (req: AuthRequest, res: Response) => {
  await prisma.category.delete({ where: { id: param(req.params.id) } });
  res.status(204).end();
});

export default router;
