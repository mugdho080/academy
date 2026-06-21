import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import db from '../db'; // MySQL pool wrapper
import { ensureLearner, ensureAdmin } from '../middleware';
import { generateResumeDraft } from '../ai/resume'; // placeholder AI function

// Session helper functions (simplified, using JSON columns)
async function getSession(userId: number) {
  const [rows] = await db.query('SELECT * FROM resume_builder_sessions WHERE user_id = ?', [userId]);
  return rows[0] || null;
}
async function upsertSession(userId: number, session: any) {
  const existing = await getSession(userId);
  if (existing) {
    await db.query('UPDATE resume_builder_sessions SET answers = ?, draft_resume = ?, current_step = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [
      JSON.stringify(session.answers),
      JSON.stringify(session.draft_resume),
      session.current_step,
      userId,
    ]);
  } else {
    await db.query('INSERT INTO resume_builder_sessions (user_id, answers, draft_resume, current_step) VALUES (?,?,?,?)', [
      userId,
      JSON.stringify(session.answers),
      JSON.stringify(session.draft_resume),
      session.current_step,
    ]);
  }
}

const router = Router();

// 1. Start a new session (or resume existing)
router.post('/start', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  let session = await getSession(userId);
  if (!session) {
    session = {
      answers: {},
      draft_resume: {},
      current_step: 'welcome',
    };
    await upsertSession(userId, session);
  }
  res.json({ message: 'Resume builder session ready', session });
});

// 2. Send a message/answer to the current step
router.post('/message', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { answer } = req.body; // plain text or array
  const session = await getSession(userId);
  if (!session) {
    return res.status(400).json({ error: 'No active session' });
  }
  const state = {
    answers: JSON.parse(session.answers as any),
    draft_resume: JSON.parse(session.draft_resume as any),
    current_step: session.current_step,
  };

  // deterministic state machine (simplified)
  const next = await generateResumeDraft(state.current_step, answer, state);
  // generateResumeDraft returns { nextStep, draftPatch, reply, quickReplies }
  // Apply patch
  const newDraft = { ...state.draft_resume, ...next.draftPatch };
  const newAnswers = { ...state.answers, [state.current_step]: answer };

  const updatedSession = {
    answers: newAnswers,
    draft_resume: newDraft,
    current_step: next.nextStep,
  };
  await upsertSession(userId, updatedSession);

  res.json({ reply: next.reply, next_step: next.nextStep, quickReplies: next.quickReplies, draft: newDraft });
});

// 3. Get current session data
router.get('/session', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const session = await getSession(userId);
  if (!session) return res.status(404).json({ error: 'No session' });
  res.json({ session: {
    answers: JSON.parse(session.answers as any),
    draft_resume: JSON.parse(session.draft_resume as any),
    current_step: session.current_step,
  }});
});

// 4. Save final resume
router.post('/', ensureLearner, [
  body('title').isString(),
  body('target_role').optional().isString(),
  body('template_key').optional().isIn(['simple','modern']),
  body('resume_data').isObject(),
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const userId = (req as any).user.id;
  const { title, target_role, template_key, resume_data } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query('INSERT INTO resumes (user_id, title, target_role, template_key, resume_data) VALUES (?,?,?,?,?)', [
      userId, title, target_role, template_key ?? 'simple', JSON.stringify(resume_data)
    ]);
    await conn.commit();
    res.json({ message: 'Resume saved', resumeId: (result as any).insertId });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Unable to save resume' });
  } finally { conn.release(); }
});

// 5. List learner resumes
router.get('/', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const [rows] = await db.query('SELECT id, title, target_role, template_key, created_at FROM resumes WHERE user_id = ?', [userId]);
  res.json({ resumes: rows });
});

// 6. Get a specific resume
router.get('/:id', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const resumeId = parseInt(req.params.id);
  const [rows] = await db.query('SELECT * FROM resumes WHERE id = ? AND user_id = ?', [resumeId, userId]);
  if (!rows.length) return res.status(404).json({ error: 'Resume not found' });
  res.json({ resume: rows[0] });
});

// 7. Generate PDF (server‑side)
router.get('/:id/pdf', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const resumeId = parseInt(req.params.id);
  const template = req.query.template as string || 'simple';
  const [rows] = await db.query('SELECT * FROM resumes WHERE id = ? AND user_id = ?', [resumeId, userId]);
  if (!rows.length) return res.status(404).json({ error: 'Resume not found' });
  const resume = rows[0];
  // Lazy‑load PDF helper to avoid circular deps
  const { renderResumePdf } = await import('../resume_builder/pdf.js');
  const pdfBytes = await renderResumePdf(resume.resume_data, template);
  // Record download
  await db.query('INSERT INTO resume_downloads (resume_id, user_id, template_key) VALUES (?,?,?)', [resumeId, userId, template]);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${resume.title}.pdf"`);
  res.send(Buffer.from(pdfBytes));
});

export default router;
