import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, AuthRequest } from '../auth.js';

const router = Router();

const isVercel = !!process.env.VERCEL;
const UPLOAD_DIR = isVercel ? '/tmp/uploads' : path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.warn('[Upload] Could not create UPLOAD_DIR:', err);
  }
}

// Multer storage engine
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

// File filter: photo & audio only, strictly rejecting all video formats
const upload = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3 MB max payload ceiling
  },
  fileFilter: (_req, file, cb) => {
    // Explicit rejection of video formats
    if (file.mimetype.startsWith('video/') || /\.(mp4|m4v|mov|avi|wmv|flv|mkv|webm)$/i.test(file.originalname)) {
      return cb(new Error('VIDEO_NOT_SUPPORTED'));
    }

    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/webp',
      'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav',
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('INVALID_FILE_TYPE'));
    }

    cb(null, true);
  },
});

// POST /api/upload/photo - Upload photo with validation
router.post('/photo', requireAuth, (req: AuthRequest, res: Response) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      if (err.message === 'VIDEO_NOT_SUPPORTED') {
        res.status(415).json({ error: 'Video uploads and hosting are not supported on Yarnna in this testnet phase.' });
        return;
      }
      if (err.message === 'INVALID_FILE_TYPE') {
        res.status(400).json({ error: 'Only JPG, PNG, and WebP photo formats are supported.' });
        return;
      }
      res.status(400).json({ error: 'Upload failed: ' + (err.message || 'File size exceeds limit.') });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No photo file provided.' });
      return;
    }

    // Verify file size limit for photos (2.5 MB)
    if (req.file.size > 2.5 * 1024 * 1024) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Photo exceeds the 2.5 MB maximum allowed file size.' });
      return;
    }

    const publicUrl = `/uploads/${req.file.filename}`;
    res.json({
      url: publicUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  });
});

// POST /api/upload/voice - Upload voice note with validation
router.post('/voice', requireAuth, (req: AuthRequest, res: Response) => {
  upload.single('voice')(req, res, (err) => {
    if (err) {
      if (err.message === 'VIDEO_NOT_SUPPORTED') {
        res.status(415).json({ error: 'Video recordings are not supported.' });
        return;
      }
      res.status(400).json({ error: 'Upload failed: ' + (err.message || 'Audio size exceeds limit.') });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No voice note audio file provided.' });
      return;
    }

    // Verify voice note limit (2.0 MB)
    if (req.file.size > 2.0 * 1024 * 1024) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Voice note exceeds the 2.0 MB maximum file size limit.' });
      return;
    }

    const durationSeconds = parseFloat(req.body.duration || '0');
    if (durationSeconds > 120) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Voice note exceeds maximum allowable duration of 120 seconds.' });
      return;
    }

    const publicUrl = `/uploads/${req.file.filename}`;
    res.json({
      url: publicUrl,
      filename: req.file.filename,
      size: req.file.size,
      duration_seconds: durationSeconds,
      mimetype: req.file.mimetype,
    });
  });
});

export default router;
