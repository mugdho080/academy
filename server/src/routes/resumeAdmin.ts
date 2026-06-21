import { Router, Request, Response } from 'express';
import db from '../db';
import { ensureAdmin } from '../middleware';

const router = Router();

// 1. List resumes for a specific user (admin view)
router.get('/:userId/resumes', ensureAdmin, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId);
  const [rows] = await db.query('SELECT id, title, target_role, template_key, created_at, status FROM resumes WHERE user_id = ?', [userId]);
  res.json({ resumes: rows });
});

// 2. View specific resume
router.get('/:userId/resumes/:resumeId', ensureAdmin, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId);
  const resumeId = parseInt(req.params.resumeId);
  const [rows] = await db.query('SELECT * FROM resumes WHERE id = ? AND user_id = ?', [resumeId, userId]);
  if (!rows.length) return res.status(404).json({ error: 'Resume not found' });
  res.json({ resume: rows[0] });
});

// 3. Admin PDF Download
router.get('/:userId/resumes/:resumeId/pdf', ensureAdmin, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId);
  const resumeId = parseInt(req.params.resumeId);
  const template = req.query.template as string || 'simple';
  
  const [rows] = await db.query('SELECT * FROM resumes WHERE id = ? AND user_id = ?', [resumeId, userId]);
  if (!rows.length) return res.status(404).json({ error: 'Resume not found' });
  
  const resume = rows[0];
  const { renderResumePdf } = await import('../resume_builder/pdf.js');
  const pdfBytes = await renderResumePdf(resume.resume_data, template);
  
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${resume.title}.pdf"`);
  res.send(Buffer.from(pdfBytes));
});

export default router;
