import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, User } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'yarnna_super_secret_jwt_key_testnet_2026_dev_only';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role: string };
    const user = db.data.users.find(u => u.id === decoded.id);

    if (!user) {
      res.status(401).json({ error: 'User account not found or deactivated.' });
      return;
    }

    if (user.status === 'banned') {
      res.status(403).json({ error: 'This account has been permanently suspended for terms violation.' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ error: 'This account is temporarily suspended. Contact support.' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
    return;
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin' && req.user.role !== 'moderator')) {
      res.status(403).json({ error: 'Administrative privileges required.' });
      return;
    }
    next();
  });
}

// In-memory rate limiter per IP / User
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(limit: number, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}_${req.baseUrl || ''}${req.path}`;
    const now = Date.now();

    let record = rateLimitMap.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      rateLimitMap.set(key, record);
      return next();
    }

    record.count += 1;
    if (record.count > limit) {
      res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfterMs: record.resetAt - now,
      });
      return;
    }

    next();
  };
}
