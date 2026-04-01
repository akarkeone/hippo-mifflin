import { Router, Response } from 'express';
import { z } from 'zod/v4';
import { Role, ProjectStatus } from '../constants';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { param } from '../lib/params';

const router = Router();

const createProjectSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED'] as const),
  due_date: z.string().date().optional(),
  notes: z.string().optional(),
  category_ids: z.array(z.string().uuid()).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED'] as const).optional(),
  due_date: z.string().date().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// GET /projects — list all, with ?client_id, ?status, ?category filters
router.get('/', async (req: AuthRequest, res: Response) => {
  const { client_id, status, category } = req.query;

  const where: any = {};
  if (client_id) where.client_id = client_id as string;
  if (status) where.status = (status as string).toUpperCase() as ProjectStatus;
  if (category) {
    where.categories = {
      some: { category: { name: category as string } },
    };
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { created_at: 'desc' },
    include: {
      client: true,
      categories: { include: { category: true } },
      team_members: { include: { user: { select: { id: true, name: true } } } },
      members: { include: { team_member: { select: { id: true, name: true, title: true, post: true } } } },
      budget_items: { select: { amount_cents: true } },
      milestones: {
        select: {
          id: true,
          name: true,
          completed: true,
          start_date: true,
          end_date: true,
          assignee_id: true,
          tm_assignee_id: true,
          tm_assignee: { select: { id: true, name: true } },
        },
      },
    },
  });

  res.json(projects);
});

// GET /projects/:id — full detail with milestones, budget, team, partner
// IMPORTANT: does NOT include partner rating data
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: param(req.params.id) },
    include: {
      client: true,
      categories: { include: { category: true } },
      team_members: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
      members: {
        include: { team_member: { select: { id: true, name: true, title: true } } },
      },
      budget_items: { orderBy: { sort_order: 'asc' } },
      milestones: {
        orderBy: { sort_order: 'asc' },
        include: {
          assignee: { select: { id: true, name: true } },
          tm_assignee: { select: { id: true, name: true } },
        },
      },
      partners: {
        include: {
          partner: {
            include: {
              contacts: true,
              specialities: true,
            },
          },
        },
      },
      assets: true,
    },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  res.json(project);
});

// POST /projects — EP, Producer, Assoc Producer can create
router.post(
  '/',
  requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid project data');
    }

    const { category_ids, ...data } = parsed.data;

    const project = await prisma.project.create({
      data: {
        ...data,
        due_date: data.due_date ? new Date(data.due_date) : undefined,
        categories: category_ids
          ? { create: category_ids.map((id) => ({ category_id: id })) }
          : undefined,
      },
      include: { client: true, categories: { include: { category: true } } },
    });

    res.status(201).json(project);
  },
);

// PATCH /projects/:id — EP, Producer, Assoc Producer can edit
router.patch(
  '/:id',
  requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid update data');
    }

    const data: any = { ...parsed.data };
    if (data.due_date !== undefined) {
      data.due_date = data.due_date ? new Date(data.due_date) : null;
    }

    const project = await prisma.project.update({
      where: { id: param(req.params.id) },
      data,
      include: { client: true },
    });
    res.json(project);
  },
);

// DELETE /projects/:id — EP & Producer only
router.delete(
  '/:id',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    await prisma.project.delete({ where: { id: param(req.params.id) } });
    res.status(204).end();
  },
);

// ── Team members ──────────────────────────────────────────────────────────

// POST /projects/:id/team
router.post(
  '/:id/team',
  requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const { user_id, role_label } = req.body;
    if (!user_id) throw new AppError(400, 'user_id is required');

    const member = await prisma.projectTeamMember.create({
      data: {
        project_id: param(req.params.id),
        user_id,
        role_label: role_label || null,
      },
      include: { user: { select: { id: true, name: true } } },
    });
    res.status(201).json(member);
  },
);

// DELETE /projects/:id/team/:userId
router.delete(
  '/:id/team/:userId',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    await prisma.projectTeamMember.delete({
      where: {
        project_id_user_id: {
          project_id: param(req.params.id),
          user_id: param(req.params.userId),
        },
      },
    });
    res.status(204).end();
  },
);

// ── Project members (TeamMember-based) ───────────────────────────────────

// POST /projects/:id/members
router.post(
  '/:id/members',
  requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const { team_member_id, role_label } = req.body;
    if (!team_member_id) throw new AppError(400, 'team_member_id is required');
    const member = await prisma.projectMember.create({
      data: { project_id: param(req.params.id), team_member_id, role_label: role_label || null },
      include: { team_member: { select: { id: true, name: true, title: true } } },
    });
    res.status(201).json(member);
  },
);

// DELETE /projects/:id/members/:memberId
router.delete(
  '/:id/members/:memberId',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    await prisma.projectMember.delete({ where: { id: param(req.params.memberId) } });
    res.status(204).end();
  },
);

// ── Project categories ────────────────────────────────────────────────────

// POST /projects/:id/categories
router.post(
  '/:id/categories',
  requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const { category_id } = req.body;
    if (!category_id) throw new AppError(400, 'category_id is required');

    const link = await prisma.projectCategory.create({
      data: { project_id: param(req.params.id), category_id },
      include: { category: true },
    });
    res.status(201).json(link);
  },
);

// DELETE /projects/:id/categories/:categoryId
router.delete(
  '/:id/categories/:categoryId',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    await prisma.projectCategory.delete({
      where: {
        project_id_category_id: {
          project_id: param(req.params.id),
          category_id: param(req.params.categoryId),
        },
      },
    });
    res.status(204).end();
  },
);

// ── Project partners ──────────────────────────────────────────────────────

// POST /projects/:id/partners
router.post(
  '/:id/partners',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const { partner_id } = req.body;
    if (!partner_id) throw new AppError(400, 'partner_id is required');

    const link = await prisma.projectPartner.create({
      data: { project_id: param(req.params.id), partner_id },
      include: { partner: true },
    });
    res.status(201).json(link);
  },
);

// DELETE /projects/:id/partners/:partnerId
router.delete(
  '/:id/partners/:partnerId',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    await prisma.projectPartner.delete({
      where: {
        project_id_partner_id: {
          project_id: param(req.params.id),
          partner_id: param(req.params.partnerId),
        },
      },
    });
    res.status(204).end();
  },
);

// ── Assets ────────────────────────────────────────────────────────────────

// POST /projects/:id/assets
router.post(
  '/:id/assets',
  requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const { label, url } = req.body;
    if (!label || !url) throw new AppError(400, 'label and url are required');

    const asset = await prisma.asset.create({
      data: { project_id: param(req.params.id), label, url },
    });
    res.status(201).json(asset);
  },
);

// DELETE /projects/:id/assets/:assetId
router.delete(
  '/:id/assets/:assetId',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    await prisma.asset.delete({ where: { id: param(req.params.assetId) } });
    res.status(204).end();
  },
);

export default router;
