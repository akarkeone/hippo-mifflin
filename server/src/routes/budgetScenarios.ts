import { Router } from 'express';
import { z } from 'zod/v4';
import prisma from '../lib/prisma';

const router = Router();

const rowSchema = z.object({
  id: z.number(),
  category: z.string(),
  desc: z.string(),
});

const budgetColSchema = z.object({
  id: z.string(),
  name: z.string(),
  values: z.record(z.string(), z.number()),
});

const scenarioSchema = z.object({
  name: z.string().min(1),
  project_name: z.string().min(1),
  client_name: z.string().min(1),
  client_color: z.string().optional(),
  rows: z.array(rowSchema),
  budgets: z.array(budgetColSchema),
  cad_rate: z.number().optional(),
});

// GET /api/v1/budget-scenarios
router.get('/', async (_req, res, next) => {
  try {
    const scenarios = await prisma.budgetScenario.findMany({
      orderBy: { updated_at: 'desc' },
    });
    res.json(scenarios);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/budget-scenarios
router.post('/', async (req, res, next) => {
  try {
    const data = scenarioSchema.parse(req.body);
    const scenario = await prisma.budgetScenario.create({
      data: {
        name: data.name,
        project_name: data.project_name,
        client_name: data.client_name,
        client_color: data.client_color ?? '888888',
        rows: data.rows,
        budgets: data.budgets,
        cad_rate: data.cad_rate ?? 1.38,
      },
    });
    res.status(201).json(scenario);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/budget-scenarios/:id
router.put('/:id', async (req, res, next) => {
  try {
    const data = scenarioSchema.parse(req.body);
    const scenario = await prisma.budgetScenario.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        project_name: data.project_name,
        client_name: data.client_name,
        client_color: data.client_color ?? '888888',
        rows: data.rows,
        budgets: data.budgets,
        cad_rate: data.cad_rate ?? 1.38,
      },
    });
    res.json(scenario);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/budget-scenarios/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.budgetScenario.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
