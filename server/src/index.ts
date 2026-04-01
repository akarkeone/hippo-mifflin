import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import prisma from './lib/prisma';
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import clientRoutes from './routes/clients';
import projectRoutes from './routes/projects';
import milestoneRoutes from './routes/milestones';
import budgetRoutes from './routes/budget';
import partnerRoutes from './routes/partners';
import scoutRoutes from './routes/scout';
import googleRoutes from './routes/google';
import categoryRoutes from './routes/categories';
import teamMemberRoutes from './routes/teamMembers';

const app = express();
const PORT = process.env.PORT ?? 3001;
const isProd = process.env.NODE_ENV === 'production';

// In development allow cross-origin requests from the Vite dev server
if (!isProd) {
  app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
}

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Public routes (no auth required)
app.use('/api/v1/auth', authRoutes);
app.use('/auth/google', googleRoutes);

// Protected routes (JWT required)
app.use('/api/v1/users', authenticateToken, userRoutes);
app.use('/api/v1/clients', authenticateToken, clientRoutes);
app.use('/api/v1/projects', authenticateToken, projectRoutes);
app.use('/api/v1/projects/:id/milestones', authenticateToken, milestoneRoutes);
app.use('/api/v1/projects/:id/budget', authenticateToken, budgetRoutes);
app.use('/api/v1/partners', authenticateToken, partnerRoutes);
app.use('/api/v1/scout', authenticateToken, scoutRoutes);
app.use('/api/v1/categories', authenticateToken, categoryRoutes);
app.use('/api/v1/team-members', authenticateToken, teamMemberRoutes);

// In production, serve the React build and handle SPA routing
if (isProd) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('/*path', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global error handler
app.use(errorHandler);

async function seedProd() {
  if (!isProd) return;
  try {
    const hash = await bcrypt.hash('hippo2026', 10);
    await prisma.user.upsert({
      where: { email: 'test@hippo.app' },
      update: {},
      create: { email: 'test@hippo.app', password_hash: hash, role: 'EP', name: 'Test User', title: 'Executive Producer' },
    });
    console.log('✔  Production seed complete — test@hippo.app ready');
  } catch (e) {
    console.error('Seed error (non-fatal):', e);
  }
}

seedProd().then(() => {
  app.listen(PORT, () => {
    console.log(`Hippo server running on http://localhost:${PORT}`);
  });
});

export default app;
