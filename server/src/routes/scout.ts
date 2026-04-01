import { Router, Response } from 'express';
import { z } from 'zod/v4';
import { Role } from '../constants';
import { requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { searchPartners } from '../services/scout';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const searchSchema = z.object({
  service_type: z.string().min(1),
  categories: z.array(z.string()).min(1),
  budget_range: z.string().min(1),
  location: z.string().min(1),
  specialities: z.string().optional(),
});

// POST /scout/search — EP, Producer, Assoc Producer
router.post(
  '/search',
  requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER),
  async (req: AuthRequest, res: Response) => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid search parameters');
    }

    const results = await searchPartners(parsed.data);
    res.json({ results });
  },
);

export default router;
