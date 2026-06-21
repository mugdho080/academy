import { Hono } from 'hono';
import { query, queryOne, withTransaction } from '../db.js';
import { requireAuth } from '../middleware.js';
import type { JwtPayload } from '../middleware.js';

const routineBuilder = new Hono();
routineBuilder.use('*', requireAuth);

function userId(c: { get(k: string): unknown }): number {
  return Number((c.get('user') as JwtPayload).sub);
}

// Session helper functions
async function getSession(uid: number) {
  const session = await queryOne('SELECT * FROM routine_builder_sessions WHERE user_id = $1', [uid]);
  return session || null;
}

async function upsertSession(uid: number, session: any) {
  const existing = await getSession(uid);
  if (existing) {
    await query('UPDATE routine_builder_sessions SET answers = $1, draft_routine = $2, current_step = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4', [
      JSON.stringify(session.answers),
      JSON.stringify(session.draft_routine),
      session.current_step,
      uid,
    ]);
  } else {
    await query('INSERT INTO routine_builder_sessions (user_id, answers, draft_routine, current_step) VALUES ($1,$2,$3,$4)', [
      uid,
      JSON.stringify(session.answers),
      JSON.stringify(session.draft_routine),
      session.current_step,
    ]);
  }
}

// Generate next step for routine builder (Placeholder)
async function generateRoutineDraft(currentStep: string, answer: any, state: any) {
  const steps = ['welcome', 'wake_up', 'activity', 'reminders', 'review', 'final'];
  const idx = steps.indexOf(currentStep);
  const nextIdx = Math.min(idx + 1, steps.length - 1);
  const nextStep = steps[nextIdx];

  const draftPatch: any = {};
  draftPatch[currentStep] = answer;

  const replies: { [key: string]: string } = {
    welcome: 'Hi! Let’s build your routine. What time do you usually wake up?',
    wake_up: 'Got it. Do you go to school, work, or a day program?',
    activity: 'Would you like help remembering breakfast, brushing teeth, medicine, or bedtime?',
    reminders: 'Would you like me to suggest a healthy routine for you based on this?',
    review: 'Here is your routine preview.',
    final: 'Your routine is saved and ready!',
  };

  const reply = replies[currentStep] ?? 'Thanks.';
  return { nextStep, draftPatch, reply, quickReplies: [] };
}

routineBuilder.post('/start', async (c) => {
  const uid = userId(c);
  let session = await getSession(uid);
  if (!session) {
    session = { answers: {}, draft_routine: {}, current_step: 'welcome' };
    await upsertSession(uid, session);
  }
  return c.json({ message: 'Routine builder session ready', session });
});

routineBuilder.post('/message', async (c) => {
  const uid = userId(c);
  const body = await c.req.json().catch(() => ({})) as any;
  const answer = body.answer;
  const session = await getSession(uid) as any;
  if (!session) return c.json({ error: 'No active session' }, 400);

  const parseJson = (val: any) => typeof val === 'string' ? JSON.parse(val) : val;
  const state = {
    answers: parseJson(session.answers) || {},
    draft_routine: parseJson(session.draft_routine) || {},
    current_step: session.current_step,
  };

  const next = await generateRoutineDraft(state.current_step, answer, state);
  
  const newDraft = { ...state.draft_routine, ...next.draftPatch };
  const newAnswers = { ...state.answers, [state.current_step]: answer };

  const updatedSession = { answers: newAnswers, draft_routine: newDraft, current_step: next.nextStep };
  await upsertSession(uid, updatedSession);

  return c.json({ reply: next.reply, next_step: next.nextStep, quickReplies: next.quickReplies, draft: newDraft });
});

routineBuilder.get('/session', async (c) => {
  const uid = userId(c);
  const session = await getSession(uid) as any;
  if (!session) return c.json({ error: 'No session' }, 404);
  const parseJson = (val: any) => typeof val === 'string' ? JSON.parse(val) : val;
  return c.json({ session: {
    answers: parseJson(session.answers) || {},
    draft_routine: parseJson(session.draft_routine) || {},
    current_step: session.current_step,
  }});
});

routineBuilder.post('/', async (c) => {
  const uid = userId(c);
  const body = await c.req.json().catch(() => ({})) as any;
  const { title, routine_data } = body;
  if (!title || !routine_data) return c.json({ error: 'title and routine_data required' }, 400);

  try {
    const result = await withTransaction(async (client) => {
      const res = await client.query('INSERT INTO routines (user_id, title, routine_data) VALUES ($1,$2,$3) RETURNING id', [
        uid, title, JSON.stringify(routine_data)
      ]);
      return res.rows[0].id;
    });
    return c.json({ message: 'Routine saved', routineId: result });
  } catch (e) {
    console.error(e);
    return c.json({ error: 'Unable to save routine' }, 500);
  }
});

routineBuilder.get('/', async (c) => {
  const uid = userId(c);
  const rows = await query('SELECT id, title, created_at, is_active FROM routines WHERE user_id = $1', [uid]);
  return c.json({ routines: rows });
});

routineBuilder.get('/:id', async (c) => {
  const uid = userId(c);
  const routineId = parseInt(c.req.param('id'));
  const rows = await query('SELECT * FROM routines WHERE id = $1 AND user_id = $2', [routineId, uid]);
  if (!rows.length) return c.json({ error: 'Routine not found' }, 404);
  return c.json({ routine: rows[0] });
});

export default routineBuilder;
