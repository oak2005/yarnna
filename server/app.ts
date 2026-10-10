import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth.js';
import postsRoutes from './routes/posts.js';
import chatsRoutes from './routes/chats.js';
import usersRoutes from './routes/users.js';
import translateRoutes from './routes/translate.js';
import reportsRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/upload.js';

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Ensure upload directory exists
const isVercel = !!process.env.VERCEL;
const UPLOAD_DIR = isVercel ? '/tmp/uploads' : path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.warn('[Upload] Could not create UPLOAD_DIR:', err);
  }
}
app.use('/uploads', express.static(UPLOAD_DIR));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// Duplicate mounts to guarantee serverless compatibility if path prefix is rewritten
app.use('/auth', authRoutes);
app.use('/posts', postsRoutes);
app.use('/chats', chatsRoutes);
app.use('/users', usersRoutes);
app.use('/translate', translateRoutes);
app.use('/reports', reportsRoutes);
app.use('/admin', adminRoutes);
app.use('/upload', uploadRoutes);

// Health check endpoint
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({
    status: 'online',
    phase: 'testnet',
    service: 'Yarnna Nigeria-First Social Network API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend build if exists
const clientDist = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export default app;
