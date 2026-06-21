import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import db from '../db'; // assume a MySQL pool wrapper
import { ensureLearner, ensureAdmin } from '../middleware';

const router = Router();

// Helper to get session state
async function getSession(userId: number) {
  const [rows] = await db.query('SELECT * FROM routine_builder_sessions WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

async function upsertSession(userId: number, state: any) {
  const existing = await getSession(userId);
  if (existing) {
    await db.query('UPDATE routine_builder_sessions SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [JSON.stringify(state), userId]);
  } else {
    await db.query('INSERT INTO routine_builder_sessions (user_id, state) VALUES (?, ?)', [userId, JSON.stringify(state)]);
  }
}

// ---------- 1. Start routine builder ----------
router.post('/ai/start', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const initialState = {
    mode: 'routine_builder',
    step: 'routine_type',
    answers: {}
  };
  await upsertSession(userId, initialState);
  res.json({ message: 'Routine builder started', next: 'routine_type' });
});

// ---------- 2. Process learner message ----------
router.post('/ai/message', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const { answer } = req.body; // plain text answer
  const session = await getSession(userId);
  if (!session) {
    return res.status(400).json({ error: 'No active routine builder session' });
  }
  const state = JSON.parse(session.state as any);

  // Simple deterministic state machine
  switch (state.step) {
    case 'routine_type':
      state.answers.routine_type = answer;
      state.step = 'wake_time';
      break;
    case 'wake_time':
      state.answers.wake_time = answer;
      state.step = 'important_tasks';
      break;
    case 'important_tasks':
      // expect comma‑separated list or array from UI
      state.answers.important_tasks = Array.isArray(answer) ? answer : answer.split(',').map((s: string) => s.trim());
      state.step = 'suggestion';
      break;
    case 'suggestion':
      state.answers.want_suggestion = answer.toLowerCase() === 'yes';
      state.step = 'draft_ready';
      break;
    default:
      break;
  }

  await upsertSession(userId, state);

  if (state.step === 'draft_ready') {
    // Call existing Gemini Panda service – placeholder function
    const draft = await generateRoutineDraft(state.answers);
    return res.json({ draft });
  }

  // Return next question prompt (simple text for now)
  const prompts: any = {
    routine_type: 'What kind of routine would you like to build? (morning, full, bedtime, school, healthy)',
    wake_time: 'What time do you usually wake up?',
    important_tasks: 'What important things should we include? (list)',
    suggestion: 'Would you like me to suggest a healthy routine for you? (yes/no)'
  };
  res.json({ next: state.step, prompt: prompts[state.step] });
});

// ---------- 3. Save final routine ----------
router.post('/', ensureLearner, [
  query('title').isString(),
  query('type').isString()
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const userId = (req as any).user.id;
  const { title, type, items } = req.body; // items is array of objects
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [routineResult] = await conn.query('INSERT INTO routines (user_id, title, type, created_by) VALUES (?,?,?,?)', [userId, title, type, 'learner']);
    const routineId = (routineResult as any).insertId;
    const itemValues = (items as any[]).map((it, idx) => [routineId, idx, it.title, it.description, it.time_of_day, it.icon, it.category, it.is_required ? 1 : 0]);
    await conn.query('INSERT INTO routine_items (routine_id, order_index, title, description, time_of_day, icon, category, is_required) VALUES ?', [itemValues]);
    await conn.commit();
    res.json({ message: 'Routine saved', routineId });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Failed to save routine' });
  } finally {
    conn.release();
  }
});

// ---------- 4. Check‑in endpoints (simplified) ----------
router.post('/:id/checkins', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const routineId = parseInt(req.params.id);
  const { date, mood, self_rating, reflection } = req.body;
  const [result] = await db.query('INSERT INTO routine_checkins (routine_id, user_id, checkin_date, mood, self_rating, reflection) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE mood = VALUES(mood), self_rating = VALUES(self_rating), reflection = VALUES(reflection)', [routineId, userId, date, mood, self_rating, reflection]);
  res.json({ message: 'Check‑in saved' });
});

// ---------- 5. Item completion toggle ----------
router.patch('/:id/items/:itemId/completion', ensureLearner, async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const routineId = parseInt(req.params.id);
  const itemId = parseInt(req.params.itemId);
  const { date, completed } = req.body;
  // Find or create checkin for the date
  const [rows] = await db.query('SELECT id FROM routine_checkins WHERE routine_id = ? AND checkin_date = ?', [routineId, date]);
  let checkinId: number;
  if (rows.length > 0) {
    checkinId = (rows[0] as any).id;
  } else {
    const [ins] = await db.query('INSERT INTO routine_checkins (routine_id, user_id, checkin_date) VALUES (?,?,?)', [routineId, userId, date]);
    checkinId = (ins as any).insertId;
  }
  await db.query('INSERT INTO routine_item_completions (checkin_id, routine_item_id, is_completed) VALUES (?,?,?) ON DUPLICATE KEY UPDATE is_completed = VALUES(is_completed)', [checkinId, itemId, completed ? 1 : 0]);
  res.json({ message: 'Item completion updated' });
});

// ---------- 6. Admin view (client profile) ----------
router.get('/admin/clients/:clientId/routines', ensureAdmin, async (req: Request, res: Response) => {
  const clientId = parseInt(req.params.clientId);
  const [routines] = await db.query('SELECT * FROM routines WHERE user_id = ?', [clientId]);
  res.json({ routines });
});

router.get('/admin/clients/:clientId/routines/summary', ensureAdmin, async (req: Request, res: Response) => {
  const clientId = parseInt(req.params.clientId);
  // Simplified summary: completion % for last 7 days
  const [summary] = await db.query(`
    SELECT r.id, r.title,
      ROUND(100 * SUM(ci.completed_items) / (7 * COUNT(ri.id)), 2) AS completion_pct
    FROM routines r
    JOIN routine_items ri ON ri.routine_id = r.id
    LEFT JOIN (
      SELECT rc.routine_id, rc.checkin_date, COUNT(ric.id) AS completed_items
      FROM routine_checkins rc
      JOIN routine_item_completions ric ON ric.checkin_id = rc.id AND ric.is_completed = 1
      WHERE rc.checkin_date >= CURDATE() - INTERVAL 7 DAY
      GROUP BY rc.routine_id, rc.checkin_date
    ) ci ON ci.routine_id = r.id
    WHERE r.user_id = ?
    GROUP BY r.id;
  `, [clientId]);
  res.json({ summary });
});

export default router;
