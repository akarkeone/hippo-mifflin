import { Router, Response } from 'express';
import { z } from 'zod/v4';
import { Role } from '../constants';
import prisma from '../lib/prisma';
import { requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { param } from '../lib/params';

const router = Router();

const createPartnerSchema = z.object({
  company_name: z.string().min(1).max(200),
  type: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  notes: z.string().optional(),
  specialities: z.array(z.string()).optional(),
  category_ids: z.array(z.string().uuid()).optional(),
  contacts: z.array(z.object({
    name: z.string().min(1),
    title: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })).optional(),
});

const updatePartnerSchema = z.object({
  company_name: z.string().min(1).max(200).optional(),
  type: z.string().max(100).nullable().optional(),
  location: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
});

const ratingSchema = z.object({
  project_id: z.string().uuid(),
  speed_efficiency: z.number().min(0).max(5),
  budget_flexibility: z.number().min(0).max(5),
  creativity: z.number().min(0).max(5),
  onset_performance: z.number().min(0).max(5),
});

// GET /partners — list, with ?speciality, ?category filters
router.get('/', async (req: AuthRequest, res: Response) => {
  const { speciality, category } = req.query;

  const where: any = {};
  if (speciality) {
    where.specialities = { some: { name: speciality as string } };
  }
  if (category) {
    where.categories = { some: { category: { name: category as string } } };
  }

  const partners = await prisma.partner.findMany({
    where,
    orderBy: { company_name: 'asc' },
    include: {
      contacts: true,
      specialities: true,
      categories: { include: { category: true } },
      projects: { select: { project_id: true } },
    },
  });

  // Compute average rating for EP/Producer, exclude for others
  const isRatingViewer = req.user &&
    (req.user.role === Role.EP || req.user.role === Role.PRODUCER);

  const result = await Promise.all(
    partners.map(async (partner) => {
      let avg_rating = null;
      if (isRatingViewer) {
        const agg = await prisma.partnerRating.aggregate({
          where: { partner_id: partner.id },
          _avg: {
            speed_efficiency: true,
            budget_flexibility: true,
            creativity: true,
            onset_performance: true,
          },
        });
        const avgs = agg._avg;
        const values = [
          avgs.speed_efficiency,
          avgs.budget_flexibility,
          avgs.creativity,
          avgs.onset_performance,
        ].filter((v): v is NonNullable<typeof v> => v != null);

        if (values.length > 0) {
          avg_rating =
            values.reduce((a, b) => Number(a) + Number(b), 0) / values.length;
        }
      }

      return {
        ...partner,
        project_count: partner.projects.length,
        avg_rating,
        projects: undefined,
      };
    }),
  );

  res.json(result);
});

// GET /partners/:id — full profile (ratings never included; avg_rating only for EP/Producer)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const partner = await prisma.partner.findUnique({
    where: { id: param(req.params.id) },
    include: {
      contacts: true,
      specialities: true,
      categories: { include: { category: true } },
      projects: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
              categories: { include: { category: true } },
              client: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!partner) {
    throw new AppError(404, 'Partner not found');
  }

  // Compute avg_rating for EP/Producer only
  const isRatingViewer = req.user &&
    (req.user.role === Role.EP || req.user.role === Role.PRODUCER);

  let avg_rating = null;
  if (isRatingViewer) {
    const agg = await prisma.partnerRating.aggregate({
      where: { partner_id: partner.id },
      _avg: {
        speed_efficiency: true,
        budget_flexibility: true,
        creativity: true,
        onset_performance: true,
      },
    });
    const avgs = agg._avg;
    const values = [
      avgs.speed_efficiency,
      avgs.budget_flexibility,
      avgs.creativity,
      avgs.onset_performance,
    ].filter((v): v is NonNullable<typeof v> => v != null);

    if (values.length > 0) {
      avg_rating =
        values.reduce((a, b) => Number(a) + Number(b), 0) / values.length;
    }
  }

  res.json({ ...partner, avg_rating });
});

// POST /partners — EP, Producer only
router.post(
  '/',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const parsed = createPartnerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid partner data');
    }

    const { specialities, category_ids, contacts, ...data } = parsed.data;

    const partner = await prisma.partner.create({
      data: {
        ...data,
        specialities: specialities
          ? { create: specialities.map((name) => ({ name })) }
          : undefined,
        categories: category_ids
          ? { create: category_ids.map((id) => ({ category_id: id })) }
          : undefined,
        contacts: contacts
          ? { create: contacts }
          : undefined,
      },
      include: {
        contacts: true,
        specialities: true,
        categories: { include: { category: true } },
      },
    });

    res.status(201).json(partner);
  },
);

// PATCH /partners/:id — EP, Producer only
router.patch(
  '/:id',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const parsed = updatePartnerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid update data');
    }

    const partner = await prisma.partner.update({
      where: { id: param(req.params.id) },
      data: parsed.data,
      include: { contacts: true, specialities: true },
    });
    res.json(partner);
  },
);

// DELETE /partners/:id — EP only
router.delete(
  '/:id',
  requireRole(Role.EP),
  async (req: AuthRequest, res: Response) => {
    await prisma.partner.delete({ where: { id: param(req.params.id) } });
    res.status(204).end();
  },
);

// ── Ratings — EP & Producer only ──────────────────────────────────────────

// POST /partners/:id/ratings
router.post(
  '/:id/ratings',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const parsed = ratingSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid rating data');
    }

    const rating = await prisma.partnerRating.create({
      data: {
        partner_id: param(req.params.id),
        rated_by: req.user!.userId,
        ...parsed.data,
      },
    });
    res.status(201).json(rating);
  },
);

// GET /partners/:id/ratings — EP & Producer only, NEVER return to other roles
router.get(
  '/:id/ratings',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const ratings = await prisma.partnerRating.findMany({
      where: { partner_id: param(req.params.id) },
      include: {
        project: { select: { id: true, name: true } },
        rater: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(ratings);
  },
);

// POST /partners/:id/contacts — EP, Producer only
router.post(
  '/:id/contacts',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const schema = z.object({
      name: z.string().min(1),
      title: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'Invalid contact data');
    const contact = await prisma.partnerContact.create({
      data: { partner_id: param(req.params.id), ...parsed.data },
    });
    res.status(201).json(contact);
  },
);

// POST /partners/:id/categories — EP, Producer only
router.post(
  '/:id/categories',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const { category_id } = req.body;
    if (!category_id) throw new AppError(400, 'category_id is required');
    const link = await prisma.partnerCategory.create({
      data: { partner_id: param(req.params.id), category_id },
      include: { category: true },
    });
    res.status(201).json(link);
  },
);

// DELETE /partners/:id/categories/:categoryId — EP, Producer only
router.delete(
  '/:id/categories/:categoryId',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    await prisma.partnerCategory.delete({
      where: {
        partner_id_category_id: {
          partner_id: param(req.params.id),
          category_id: param(req.params.categoryId),
        },
      },
    });
    res.status(204).end();
  },
);

// POST /partners/:id/specialities — EP, Producer only
router.post(
  '/:id/specialities',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const schema = z.object({ name: z.string().min(1).max(100) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'Invalid speciality data');
    const speciality = await prisma.partnerSpeciality.create({
      data: { partner_id: param(req.params.id), name: parsed.data.name },
    });
    res.status(201).json(speciality);
  },
);

// DELETE /partners/:id/specialities/:specialityId — EP, Producer only
router.delete(
  '/:id/specialities/:specialityId',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    await prisma.partnerSpeciality.delete({
      where: { id: param(req.params.specialityId) },
    });
    res.status(204).end();
  },
);

// PATCH /partners/:id/contacts/:contactId — EP, Producer only
router.patch(
  '/:id/contacts/:contactId',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      title: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      phone: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'Invalid contact data');
    const contact = await prisma.partnerContact.update({
      where: { id: param(req.params.contactId) },
      data: parsed.data,
    });
    res.json(contact);
  },
);

// DELETE /partners/:id/contacts/:contactId — EP, Producer only
router.delete(
  '/:id/contacts/:contactId',
  requireRole(Role.EP, Role.PRODUCER),
  async (req: AuthRequest, res: Response) => {
    await prisma.partnerContact.delete({
      where: { id: param(req.params.contactId) },
    });
    res.status(204).end();
  },
);

export default router;
