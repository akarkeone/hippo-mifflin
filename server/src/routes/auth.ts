import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod/v4';
import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'changeme';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, 'Invalid email or password format');
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new AppError(401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError(401, 'Invalid credentials');
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' },
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

// POST /auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  // Stateless JWT — client discards the token
  res.json({ message: 'Logged out' });
});

// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    throw new AppError(400, 'Email is required');
  }
  // Stub — always return success to prevent email enumeration
  res.json({ message: 'If that email exists, a reset link has been sent.' });
});

export default router;
