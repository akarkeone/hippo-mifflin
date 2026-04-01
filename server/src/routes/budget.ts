import { Router, Response } from 'express';
import { z } from 'zod/v4';
import { Role } from '../constants';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { param } from '../lib/params';
import { exportBudgetToSheets } from '../services/google';

const router = Router({ mergeParams: true });

const createLineItemSchema = z.object({
  label: z.string().min(1).max(150),
  description: z.string().optional(),
  amount_cents: z.number().int(),
  actuals_cents: z.number().int().optional(),
  is_agency_fee: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

const updateLineItemSchema = z.object({
  label: z.string().min(1).max(150).optional(),
  description: z.string().nullable().optional(),
  amount_cents: z.number().int().optional(),
  actuals_cents: z.number().int().optional(),
  is_agency_fee: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

// GET /projects/:id/budget — EP, Producer, Assoc Producer (not Intern)
router.get(
  '/',
  requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const items = await prisma.budgetLineItem.findMany({
      where: { project_id: param(req.params.id) },
      orderBy: { sort_order: 'asc' },
    });
    res.json(items);
  },
);

// POST /projects/:id/budget — EP, Producer only
router.post(
  '/',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const parsed = createLineItemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid budget line item data');
    }

    const item = await prisma.budgetLineItem.create({
      data: { ...parsed.data, project_id: param(req.params.id) },
    });
    res.status(201).json(item);
  },
);

// PATCH /projects/:id/budget/:lineItemId — EP, Producer only
router.patch(
  '/:lineItemId',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const parsed = updateLineItemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid update data');
    }

    const item = await prisma.budgetLineItem.update({
      where: { id: param(req.params.lineItemId) },
      data: parsed.data,
    });
    res.json(item);
  },
);

// DELETE /projects/:id/budget/:lineItemId — EP, Producer only
router.delete(
  '/:lineItemId',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    await prisma.budgetLineItem.delete({ where: { id: param(req.params.lineItemId) } });
    res.status(204).end();
  },
);

// GET /projects/:id/budget/export — export to Google Sheets
router.get(
  '/export',
  requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const projectId = param(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: true,
        budget_items: { orderBy: { sort_order: 'asc' } },
      },
    });

    if (!project) throw new AppError(404, 'Project not found');

    try {
      const url = await exportBudgetToSheets(req.user!.userId, {
        clientName: project.client.name,
        projectName: project.name,
        lineItems: project.budget_items,
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
