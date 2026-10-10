import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, User } from '../db.js';
import { generateToken, requireAuth, AuthRequest, rateLimit } from '../auth.js';

const router = Router();

// Register new user
router.post('/register', rateLimit(10, 60000), (req: Request, res: Response) => {
  const { username, email, password, display_name } = req.body;

  if (!username || !email || !password || !display_name) {
    res.status(400).json({ error: 'All fields (username, email, password, display name) are required.' });
    return;
  }

  const cleanUsername = username.trim().toLowerCase().replace(/^@+/, '');
  if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
    res.status(400).json({ error: 'Username must be 3-30 characters (letters only, or letters with numbers or underscores).' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const existing = db.data.users.find(u => u.username === cleanUsername || u.email.toLowerCase() === email.trim().toLowerCase());
  if (existing) {
    res.status(409).json({ error: 'Username or email already registered on Yarnna.' });
    return;
  }

  const now = new Date().toISOString();
  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    email: email.trim().toLowerCase(),
    password_hash: bcrypt.hashSync(password, 10),
    display_name: display_name.trim(),
    avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
    bio: '',
    location: 'Nigeria',
    role: 'user',
    status: 'active',
    posting_restricted_until: null,
    messaging_restricted_until: null,
    acknowledged_testnet_notice_at: null,
    preferred_language: 'en',
    created_at: now,
    updated_at: now,
  };

  db.data.users.push(newUser);
  db.save();

  const token = generateToken(newUser);
  const { password_hash, ...safeUser } = newUser;
  res.status(201).json({ user: safeUser, token });
});

// Login
router.post('/login', rateLimit(10, 60000), (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    res.status(400).json({ error: 'Please enter your username/email and password.' });
    return;
  }

  const rawClean = identifier.trim().toLowerCase();
  const clean = rawClean.replace(/^@+/, '');
  const user = db.data.users.find(u => u.username === clean || u.email.toLowerCase() === rawClean);

  if (!user) {
    res.status(401).json({ error: 'Invalid username/email or password.' });
    return;
  }

  if (user.status === 'banned') {
    res.status(403).json({ error: 'This account has been permanently banned from Yarnna.' });
    return;
  }

  if (user.status === 'suspended') {
    res.status(403).json({ error: 'This account is temporarily suspended.' });
    return;
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    res.status(401).json({ error: 'Invalid username/email or password.' });
    return;
  }

  const token = generateToken(user);
  const { password_hash, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

// Acknowledge Testnet Notice
router.post('/acknowledge-testnet', requireAuth, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const user = db.data.users.find(u => u.id === req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  user.acknowledged_testnet_notice_at = new Date().toISOString();
  db.save();

  const { password_hash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// Get current user profile
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const { password_hash, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

export default router;
