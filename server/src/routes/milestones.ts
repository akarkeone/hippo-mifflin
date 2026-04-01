import { Router, Response } from 'express';
import { z } from 'zod/v4';
import { Role } from '../constants';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { param } from '../lib/params';
import { exportScheduleToSheets } from '../services/google';

const router = Router({ mergeParams: true });

const createMilestoneSchema = z.object({
  name: z.string().min(1).max(200),
  assignee_id: z.string().uuid().optional(),
  tm_assignee_id: z.string().uuid().optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  sort_order: z.number().int().optional(),
});

const updateMilestoneSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  tm_assignee_id: z.string().uuid().nullable().optional(),
  start_date: z.string().date().nullable().optional(),
  end_date: z.string().date().nullable().optional(),
  completed: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

// GET /projects/:id/milestones
router.get('/', async (req: AuthRequest, res: Response) => {
  const milestones = await prisma.milestone.findMany({
    where: { project_id: param(req.params.id) },
    orderBy: { sort_order: 'asc' },
    include: { assignee: { select: { id: true, name: true } }, tm_assignee: { select: { id: true, name: true } } },
  });
  res.json(milestones);
});

// POST /projects/:id/milestones — EP, Producer, Assoc Producer
router.post(
  '/',
  requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const parsed = createMilestoneSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid milestone data');
    }

    const data: any = { ...parsed.data, project_id: param(req.params.id) };
    if (data.start_date) data.start_date = new Date(data.start_date);
    if (data.end_date) data.end_date = new Date(data.end_date);

    const milestone = await prisma.milestone.create({
      data,
      include: { assignee: { select: { id: true, name: true } }, tm_assignee: { select: { id: true, name: true } } },
    });
    res.status(201).json(milestone);
  },
);

// PATCH /projects/:id/milestones/:milestoneId — EP, Producer, Assoc Producer
router.patch(
  '/:milestoneId',
  requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const parsed = updateMilestoneSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid update data');
    }

    const data: any = { ...parsed.data };
    if (data.start_date !== undefined) {
      data.start_date = data.start_date ? new Date(data.start_date) : null;
    }
    if (data.end_date !== undefined) {
      data.end_date = data.end_date ? new Date(data.end_date) : null;
    }

    const milestone = await prisma.milestone.update({
      where: { id: param(req.params.milestoneId) },
      data,
      include: { assignee: { select: { id: true, name: true } }, tm_assignee: { select: { id: true, name: true } } },
    });
    res.json(milestone);
  },
);

// DELETE /projects/:id/milestones/:milestoneId — EP, Producer
router.delete(
  '/:milestoneId',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    await prisma.milestone.delete({ where: { id: param(req.params.milestoneId) } });
    res.status(204).end();
  },
);

// GET /projects/:id/milestones/export — export to Google Sheets
router.get(
  '/export',
  requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const projectId = param(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        milestones: {
          orderBy: { sort_order: 'asc' },
          include: { assignee: { select: { name: true } } },
        },
      },
    });

    if (!project) throw new AppError(404, 'Project not found');

    try {
      const url = await exportScheduleToSheets(req.user!.userId, {
        clientName: project.client.name,
        projectName: project.name,
        milestones: project.milestones.map((m) => ({
          name: m.name,
          assignee: m.assignee?.name ?? 'Unassigned',
          start_date: m.start_date?.toISOString().split('T')[0] ?? null,
          end_date: m.end_date?.toISOString().split('T')[0] ?? null,
          completed: m.completed,
        })),
      });
      res.json({ url });
    } catch (err: any) {
      if (err.message?.includes('not connected')) {
        res.status(403).json({ error: 'Google account not connected', needsAuth: true });
      } else {
        throw err;
      }
    }
  },
);

export default router;
