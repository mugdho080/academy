import { Hono } from 'hono';
import { query, queryOne, withTransaction } from '../db.js';
import { requireAuth } from '../middleware.js';
import type { JwtPayload } from '../middleware.js';
import { generateResumeDraft } from '../ai/resume.js';
import { GamificationService } from '../services/GamificationService.js';

const resumeBuilder = new Hono();
resumeBuilder.use('*', requireAuth);

function userId(c: { get(k: string): unknown }): number {
  return Number((c.get('user') as JwtPayload).sub);
}

// Session helper functions (using jsonb columns in postgres)
async function getSession(uid: number) {
  const session = await queryOne('SELECT * FROM resume_builder_sessions WHERE user_id = $1', [uid]);
  return session || null;
}

async function upsertSession(uid: number, session: any) {
  const existing = await getSession(uid);
  if (existing) {
    await query('UPDATE resume_builder_sessions SET answers = $1, draft_resume = $2, current_step = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4', [
      JSON.stringify(session.answers),
      JSON.stringify(session.draft_resume),
      session.current_step,
      uid,
    ]);
  } else {
    await query('INSERT INTO resume_builder_sessions (user_id, answers, draft_resume, current_step) VALUES ($1,$2,$3,$4)', [
      uid,
      JSON.stringify(session.answers),
      JSON.stringify(session.draft_resume),
      session.current_step,
    ]);
  }
}

// 1. Start a new session (or resume existing)
resumeBuilder.post('/start', async (c) => {
  const uid = userId(c);
  let session = await getSession(uid);
  if (!session) {
    session = {
      answers: {},
      draft_resume: {},
      current_step: 'welcome',
    };
    await upsertSession(uid, session);
  }
  
  // Return the session AND an initial message if they are just starting
  return c.json({ 
    success: true,
    session,
    reply: "Hi! I'm Panda. I can help you build your resume.",
    next_question: "Would you like to start?",
    quickReplies: ["Yes, start", "What is a resume?"],
    next_step: session.current_step,
    draft: typeof session.draft_resume === 'string' ? JSON.parse(session.draft_resume) : session.draft_resume,
    is_ready_to_preview: false
  });
});

// 2. Send a message/answer to the current step
resumeBuilder.post('/message', async (c) => {
  const uid = userId(c);
  const body = await c.req.json().catch(() => ({})) as any;
  const answer = body.answer;
  const session = await getSession(uid) as any;
  if (!session) {
    return c.json({ error: 'No active session' }, 400);
  }
  
  // postgres node driver parses jsonb automatically if column type is jsonb.
  // but if it's text, we need JSON.parse
  const parseJson = (val: any) => typeof val === 'string' ? JSON.parse(val) : val;

  const state = {
    answers: parseJson(session.answers) || {},
    draft_resume: parseJson(session.draft_resume) || {},
    current_step: session.current_step,
  };

  const next = await generateResumeDraft(state.current_step, answer, state);
  
  if (!next.success && next.error) {
    return c.json({
      success: false,
      error: next.error,
      message: next.message || "Panda had trouble thinking. Please try again."
    }, (next.status as any) || 500);
  }
  
  const newDraft = { ...state.draft_resume, ...next.draftPatch };
  const newAnswers = { ...state.answers, [state.current_step]: answer };

  const updatedSession = {
    answers: newAnswers,
    draft_resume: newDraft,
    current_step: next.nextStep,
  };
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

// 3. Get current session data
resumeBuilder.get('/session', async (c) => {
  const uid = userId(c);
  const session = await getSession(uid) as any;
  if (!session) return c.json({ error: 'No session' }, 404);
  
  const parseJson = (val: any) => typeof val === 'string' ? JSON.parse(val) : val;
  return c.json({ session: {
    answers: parseJson(session.answers) || {},
    draft_resume: parseJson(session.draft_resume) || {},
    current_step: session.current_step,
  }});
});

// 4. Save final resume
resumeBuilder.post('/', async (c) => {
  const uid = userId(c);
  const body = await c.req.json().catch(() => ({})) as any;
  const { title, target_role, template_key, resume_data } = body;
  
  if (!title || !resume_data) {
     return c.json({ error: 'title and resume_data required' }, 400);
  }

  try {
    const result = await withTransaction(async (client) => {
      const res = await client.query('INSERT INTO resumes (user_id, title, target_role, template_key, resume_data) VALUES ($1,$2,$3,$4,$5) RETURNING id', [
        uid, title, target_role, template_key ?? 'simple', JSON.stringify(resume_data)
      ]);
      return res.rows[0].id;
    });
    
    // Wire Gamification XP
    await GamificationService.awardXpAndCoins(
      uid,
      'resume_saved',
      'resume',
      String(result),
      50,
      10,
      { template_key }
    );

    return c.json({ message: 'Resume saved', resumeId: result });
  } catch (e) {
    console.error(e);
    return c.json({ error: 'Unable to save resume' }, 500);
  }
});

// 5. List learner resumes
resumeBuilder.get('/', async (c) => {
  const uid = userId(c);
  const rows = await query('SELECT id, title, target_role, template_key, created_at FROM resumes WHERE user_id = $1', [uid]);
  return c.json({ resumes: rows });
});

// 6. Get a specific resume
resumeBuilder.get('/:id', async (c) => {
  const uid = userId(c);
  const resumeId = parseInt(c.req.param('id'));
  const rows = await query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [resumeId, uid]);
  if (!rows.length) return c.json({ error: 'Resume not found' }, 404);
  return c.json({ resume: rows[0] });
});

// 7. Generate PDF (server‑side)
resumeBuilder.get('/:id/pdf', async (c) => {
  const uid = userId(c);
  const resumeId = parseInt(c.req.param('id'));
  const template = c.req.query('template') || 'simple';
  const rows = await query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [resumeId, uid]);
  if (!rows.length) return new Response('Resume not found', { status: 404 });
  
  const resume = rows[0] as any;
  const { renderResumePdf } = await import('../resume_builder/pdf.js');
  
  const resumeData = typeof resume.resume_data === 'string' ? JSON.parse(resume.resume_data) : resume.resume_data;
  const pdfBytes = await renderResumePdf(resumeData, template);
  
  await query('INSERT INTO resume_downloads (resume_id, user_id, template_key) VALUES ($1,$2,$3)', [resumeId, uid, template]);
  
  return c.body(pdfBytes as any, 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${resume.title}.pdf"`
  });
});

export default resumeBuilder;
