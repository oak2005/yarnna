import { Router, Response } from 'express';
import { db, Report, Appeal } from '../db.js';
import { requireAuth, AuthRequest } from '../auth.js';

const router = Router();

// POST /api/reports - Submit a report
router.post('/', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { target_type, target_id, category, reason } = req.body;

  if (!target_type || !target_id || !category || !reason) {
    res.status(400).json({ error: 'target_type, target_id, category, and reason are required.' });
    return;
  }

  const validCategories = [
    'harassment', 'hate_speech', 'scam_fraud', 'impersonation',
    'spam', 'violence_threat', 'illegal_goods', 'csam_grooming', 'other'
  ];

  if (!validCategories.includes(category)) {
    res.status(400).json({ error: 'Invalid report category.' });
    return;
  }

  const newReport: Report = {
    id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    reporter_id: currentUserId,
    target_type,
    target_id,
    category,
    reason: reason.trim().slice(0, 500),
    status: 'pending',
    assigned_to: null,
    resolution_notes: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
  };

  db.data.reports.push(newReport);
  db.save();

  res.status(201).json({
    success: true,
    message: 'Report received. Our community safety team will review it according to our Community Guidelines.',
    report_id: newReport.id,
  });
});

// POST /api/reports/appeal - Submit an appeal
router.post('/appeal', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const { action_id, appeal_reason } = req.body;

  if (!appeal_reason || !appeal_reason.trim()) {
    res.status(400).json({ error: 'Appeal reason is required.' });
    return;
  }

  const newAppeal: Appeal = {
    id: `app_${Date.now()}`,
    user_id: currentUserId,
    action_id: action_id || 'general',
    appeal_reason: appeal_reason.trim(),
    status: 'pending',
    reviewed_by: null,
    resolution_notes: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
  };

  db.data.appeals.push(newAppeal);
  db.save();

  res.status(201).json({
    success: true,
    message: 'Appeal submitted. An independent reviewer will assess your submission within 72 hours.',
    appeal_id: newAppeal.id,
  });
});

export default router;
