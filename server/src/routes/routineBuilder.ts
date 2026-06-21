import { Hono } from 'hono';
import { query, queryOne, withTransaction } from '../db.js';
import { requireAuth } from '../middleware.js';
import type { JwtPayload } from '../middleware.js';
import { Type } from '@google/genai';
import { generatePandaStructuredResponse } from '../ai/gemini.js';
import { GamificationService } from '../services/GamificationService.js';

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

// Generate next step for routine builder using Gemini
async function generateRoutineDraft(currentStep: string, answer: any, state: any) {
  const schema = {
    type: Type.OBJECT,
    properties: {
      reply: { type: Type.STRING, description: "Panda's conversational reply to the user's answer." },
      next_question: { type: Type.STRING, description: "The next question Panda should ask, or null if ready." },
      quick_replies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suggested quick reply buttons." },
      current_step: { type: Type.STRING, description: "The internal state machine step (e.g. welcome, routine_type, wake_time, activity, preview)." },
      draft_patch: { type: Type.OBJECT, description: "Any new fields to merge into the draft routine." },
      is_ready_to_preview: { type: Type.BOOLEAN, description: "True if all necessary questions are answered and the routine is ready." }
    },
    required: ["reply", "current_step", "quick_replies", "draft_patch", "is_ready_to_preview"]
  };

  const systemPrompt = `You are Panda, a friendly Academy coach helping a learner build a daily routine.
Ask one simple question at a time. Use short sentences. Offer quick replies. Produce valid JSON only.
If the learner says 'I don't know', suggest a simple healthy routine.
Current step: ${currentStep}.
Current draft: ${JSON.stringify(state.draft_routine)}
Learner's previous answers: ${JSON.stringify(state.answers)}
Learner's latest message: "${answer}"
Output structured JSON containing your reply, the next question, quick replies, the next step name, and any updates to the draft routine (e.g. adding items with time_of_day, title, icon, etc).`;

  const res = await generatePandaStructuredResponse({
    systemPrompt, 
    userMessage: `Learner says: ${answer}`, 
    schema: schema as any
  });
  
  if (!res.success) {
    return {
      error: res.error,
      message: res.message,
      status: res.status,
      nextStep: currentStep,
      draftPatch: {},
      reply: "Oops, I got a bit confused! Could you tell me that again?",
      quickReplies: [],
      isReady: false
    };
  }

  const response = res.data!;
  return {
    success: true,
    nextStep: response.current_step,
    draftPatch: response.draft_patch,
    reply: response.reply + (response.next_question ? ' ' + response.next_question : ''),
    quickReplies: response.quickReplies,
    isReady: response.is_ready_to_preview
  };
  
}

routineBuilder.post('/start', async (c) => {
  const uid = userId(c);
  let session = await getSession(uid);
  if (!session) {
    session = { answers: {}, draft_routine: {}, current_step: 'welcome' };
    await upsertSession(uid, session);
  }
  return c.json({ 
    success: true,
    session,
    reply: "Hi! I'm Panda. I can help you build your daily routine.",
    next_question: "Are you ready to begin?",
    quickReplies: ["Yes, start", "What is a routine?"],
    next_step: session.current_step,
    draft: typeof session.draft_routine === 'string' ? JSON.parse(session.draft_routine) : session.draft_routine,
    is_ready_to_preview: false
  });
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
  
  if (!next.success && next.error) {
    return c.json({
      success: false,
      error: next.error,
      message: next.message || "Panda had trouble thinking. Please try again."
    }, (next.status as any) || 500);
  }
  
  const newDraft = { ...state.draft_routine, ...next.draftPatch };
  const newAnswers = { ...state.answers, [state.current_step]: answer };

  const updatedSession = { answers: newAnswers, draft_routine: newDraft, current_step: next.nextStep };
  await upsertSession(uid, updatedSession);

  return c.json({ 
    success: true,
    reply: next.reply, 
    next_step: next.nextStep, 
    quickReplies: next.quickReplies, 
    draft: newDraft,
    is_ready_to_preview: next.isReady 
  });
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
    
    // Wire Gamification XP
    await GamificationService.awardXpAndCoins(
      uid,
      'routine_saved',
      'routine',
      String(result),
      50,
      10,
      { title }
    );

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
