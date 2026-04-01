import { Router, Response } from 'express';
import { z } from 'zod/v4';
import { Role } from '../constants';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { param } from '../lib/params';

const router = Router();

const createClientSchema = z.object({
  name: z.string().min(1).max(150),
  color_hex: z.string().length(6).regex(/^[0-9A-Fa-f]{6}$/),
  logo_url: z.string().url().optional(),
});

const updateClientSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  color_hex: z.string().length(6).regex(/^[0-9A-Fa-f]{6}$/).optional(),
  logo_url: z.string().url().nullable().optional(),
});

// GET /clients
router.get('/', async (_req: AuthRequest, res: Response) => {
  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' },
    include: { projects: { select: { id: true, name: true, status: true } } },
  });
  res.json(clients);
});

// POST /clients
router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid client data');
  }
  const client = await prisma.client.create({ data: parsed.data });
  res.status(201).json(client);
});

// PATCH /clients/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = updateClientSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid update data');
  }
  const client = await prisma.client.update({
    where: { id: param(req.params.id) },
    data: parsed.data,
  });
  res.json(client);
});

// DELETE /clients/:id — EP only
router.delete('/:id', requireRole(Role.EP), async (req: AuthRequest, res: Response) => {
  await prisma.client.delete({ where: { id: param(req.params.id) } });
  res.status(204).end();
});

export default router;
