import { Router } from 'express';
import { z } from 'zod/v4';
import prisma from '../lib/prisma';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  email: z.email().optional().or(z.literal('')),
  post: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  title: z.string().optional(),
  email: z.email().optional().or(z.literal('')),
  post: z.boolean().optional(),
});

// GET /api/v1/team-members
router.get('/', async (_req, res, next) => {
  try {
    const members = await prisma.teamMember.findMany({ orderBy: { name: 'asc' } });
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/team-members
router.post('/', async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const member = await prisma.teamMember.create({
      data: {
        name: data.name,
        title: data.title ?? null,
        email: data.email || null,
        post: data.post ?? false,
      },
    });
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/team-members/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const member = await prisma.teamMember.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.title !== undefined && { title: data.title || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.post !== undefined && { post: data.post }),
      },
    });
    res.json(member);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/team-members/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.teamMember.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
