import { Router, Response } from 'express';
import { Role } from '../constants';
import { authenticateToken, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { getAuthUrl, handleCallback, isConnected } from '../services/google';

const router = Router();

// GET /auth/google — redirect to Google consent screen
router.get('/', authenticateToken, requireRole(Role.EP, Role.PRODUCER, Role.ASSOC_PRODUCER), (req: AuthRequest, res: Response) => {
  const url = getAuthUrl() + `&state=${req.user!.userId}`;
  res.json({ url });
});

// GET /auth/google/callback — store tokens
router.get('/callback', async (req: AuthRequest, res: Response) => {
  const { code, state: userId } = req.query;
  if (!code || !userId) {
    res.status(400).json({ error: 'Missing code or state' });
    return;
  }

  try {
    await handleCallback(code as string, userId as string);
    // Redirect back to the app after successful auth
    res.redirect('http://localhost:3000/settings?google=connected');
  } catch (err) {
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

// GET /auth/google/status — check if user has connected Google
router.get('/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  const connected = await isConnected(req.user!.userId);
  res.json({ connected });
});

export default router;
