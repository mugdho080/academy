import { Hono } from 'hono'
import { requireAuth } from '../middleware.js'
import type { JwtPayload } from '../middleware.js'
import { query, queryOne, withTransaction } from '../db.js'
import { isMissingEnvError } from '../env.js'

const ai = new Hono()
ai.use('*', requireAuth)

function userId(c: { get(k: string): unknown }): number {
  return Number((c.get('user') as JwtPayload).sub)
}

async function getCoachSnapshot(uid: number) {
  const [state, profile] = await Promise.all([
    queryOne<Record<string, unknown>>('SELECT * FROM coach_state WHERE user_id = $1', [uid]),
    queryOne<Record<string, unknown>>('SELECT * FROM learner_profiles WHERE user_id = $1', [uid]),
  ])

  return { state, profile }
}

// ─── POST /api/ai/coach-chat ──────────────────────────────────────────────────
// Proxies Gemini requests from the backend with server-side API key
ai.post('/coach-chat', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  if (!process.env.GEMINI_API_KEY) {
    return c.json({ error: 'AI not configured' }, 503)
  }

  const { GoogleGenAI } = await import('@google/genai')
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

  const profile = await queryOne(
    'SELECT * FROM learner_profiles WHERE user_id = $1',
    [uid]
  )
  const coachState = await queryOne(
    'SELECT * FROM coach_state WHERE user_id = $1',
    [uid]
  )

  const systemInstruction = buildSystemInstruction(profile, coachState)
  const messages = (body.messages as Array<{ role: string; content: string }>) ?? []

  try {
    const chat = genai.chats.create({
      model: 'gemini-2.0-flash',
      config: { systemInstruction },
      history: messages.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    })

    const lastMessage = messages[messages.length - 1]?.content ?? ''
    const result = await chat.sendMessage({ message: lastMessage })
    const text = result.text ?? ''

    // Log the coach event
    await query(
      `INSERT INTO coach_events (user_id, event_type, route, payload_json)
       VALUES ($1, 'chat_message', $2, $3)`,
      [uid, body.route ?? null, JSON.stringify({ message_preview: lastMessage.slice(0, 100) })]
    )

    // Update coach state
    await query(
      `INSERT INTO coach_state (user_id, last_message_type, last_message_text, last_seen_at)
       VALUES ($1, 'chat', $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         last_message_type = 'chat',
         last_message_text = $2,
         last_seen_at = NOW()`,
      [uid, text.slice(0, 500)]
    )

    return c.json({ success: true, response: text })
  } catch (err) {
    if (isMissingEnvError(err)) {
      throw err
    }
    console.error('Coach chat error:', err)
    return c.json({ error: 'AI request failed' }, 500)
  }
})

// ─── GET /api/ai/coach-state ─────────────────────────────────────────────────
ai.get('/coach-state', async (c) => {
  const uid = userId(c)
  const { state, profile } = await getCoachSnapshot(uid)
  return c.json({ success: true, state, profile })
})

// ─── POST /api/ai/coach-state ─────────────────────────────────────────────────
ai.post('/coach-state', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  const fields = [
    'last_route', 'last_chapter_id', 'last_level_id', 'last_lesson_id',
    'frustration_score', 'engagement_score', 'streak_days',
    'last_completed_lesson_id', 'last_intervention_level',
  ]
  const provided = fields.filter((f) => f in body)
  if (provided.length === 0) return c.json({ success: true })

  const setClauses = provided.map((f, i) => `${f} = $${i + 2}`).join(', ')
  await query(
    `INSERT INTO coach_state (user_id, ${provided.join(', ')})
     VALUES ($1, ${provided.map((_, i) => `$${i + 2}`).join(', ')})
     ON CONFLICT (user_id) DO UPDATE SET ${setClauses}, last_seen_at = NOW()`,
    [uid, ...provided.map((f) => body[f])]
  )
  return c.json({ success: true })
})

// ─── POST /api/ai/log-coach-event ────────────────────────────────────────────
ai.post('/log-coach-event', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  if (!body.event_type) return c.json({ error: 'event_type required' }, 400)

  await query(
    `INSERT INTO coach_events (user_id, session_id, event_type, route, chapter_id, level_id, lesson_id, payload_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      uid,
      body.session_id ?? null,
      body.event_type,
      body.route ?? null,
      body.chapter_id ?? null,
      body.level_id ?? null,
      body.lesson_id ?? null,
      body.payload ? JSON.stringify(body.payload) : null,
    ]
  )
  return c.json({ success: true })
})

// ─── GET /api/ai/coach-recommendation ────────────────────────────────────────
ai.get('/coach-recommendation', async (c) => {
  const uid = userId(c)
  const route = c.req.query('route')
  const type = c.req.query('type')

  const filter = route ? 'AND route = $2' : ''
  const params: unknown[] = [uid]
  if (route) params.push(route)
  if (type) {
    params.push(type)
  }

  const rec = await queryOne(
    `SELECT * FROM coach_recommendations
     WHERE user_id = $1 ${filter} AND was_shown = false
     ORDER BY created_at DESC LIMIT 1`,
    params
  )

  if (rec) {
    await query(
      'UPDATE coach_recommendations SET was_shown = true WHERE id = $1',
      [(rec as Record<string, unknown>).id]
    )
  }

  return c.json({ success: true, recommendation: rec })
})

// ─── POST /api/ai/coach-recommendation ───────────────────────────────────────
ai.post('/coach-recommendation', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  if (!process.env.GEMINI_API_KEY) {
    return c.json({ error: 'AI not configured' }, 503)
  }

  const [state, profile, recentProgress] = await Promise.all([
    queryOne('SELECT * FROM coach_state WHERE user_id = $1', [uid]),
    queryOne('SELECT * FROM learner_profiles WHERE user_id = $1', [uid]),
    query(
      `SELECT cl.lesson_id, l.title, cl.completed_at
       FROM completed_lessons cl JOIN lessons l ON l.id = cl.lesson_id
       WHERE cl.user_id = $1 ORDER BY cl.completed_at DESC LIMIT 5`,
      [uid]
    ),
  ])

  const prompt = buildRecommendationPrompt(state, profile, recentProgress, body.route as string)

  try {
    const { GoogleGenAI } = await import('@google/genai')
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const result = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })
    const text = result.text ?? ''

    let parsed: unknown
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { message: text }
    } catch {
      parsed = { message: text }
    }

    const recId = await query<{ id: number }>(
      `INSERT INTO coach_recommendations (user_id, route, recommendation_type, recommendation_json)
       VALUES ($1, $2, 'ai_generated', $3) RETURNING id`,
      [uid, body.route ?? null, JSON.stringify(parsed)]
    )

    // Update last_recommendation_json in coach_state
    await query(
      `INSERT INTO coach_state (user_id, last_recommendation_json)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET last_recommendation_json = $2`,
      [uid, JSON.stringify(parsed)]
    )

    return c.json({ success: true, recommendation: parsed, id: recId[0]?.id })
  } catch (err) {
    if (isMissingEnvError(err)) {
      throw err
    }
    console.error('Recommendation error:', err)
    return c.json({ error: 'Failed to generate recommendation' }, 500)
  }
})

// ─── helpers ─────────────────────────────────────────────────────────────────

ai.get('/get_coach_state.php', async (c) => {
  const uid = userId(c)
  return c.json(await getCoachSnapshot(uid))
})

ai.post('/update_coach_state.php', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const fields = [
    'last_route', 'last_chapter_id', 'last_level_id', 'last_lesson_id',
    'frustration_score', 'engagement_score', 'streak_days',
    'last_completed_lesson_id', 'last_intervention_level',
  ]
  const provided = fields.filter((field) => field in body)

  if (provided.length > 0) {
    const setClauses = provided.map((field, index) => `${field} = $${index + 2}`).join(', ')
    await query(
      `INSERT INTO coach_state (user_id, ${provided.join(', ')})
       VALUES ($1, ${provided.map((_, index) => `$${index + 2}`).join(', ')})
       ON CONFLICT (user_id) DO UPDATE SET ${setClauses}, last_seen_at = NOW()`,
      [uid, ...provided.map((field) => body[field])]
    )
  }

  return c.json(await getCoachSnapshot(uid))
})

ai.post('/log_coach_event.php', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  if (!body.event_type) {
    return c.json({ error: 'event_type required' }, 400)
  }

  const payload = body.payload_json ?? body.payload ?? null
  await query(
    `INSERT INTO coach_events (user_id, session_id, event_type, route, chapter_id, level_id, lesson_id, payload_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      uid,
      body.session_id ?? null,
      body.event_type,
      body.route ?? null,
      body.chapter_id ?? null,
      body.level_id ?? null,
      body.lesson_id ?? null,
      payload ? JSON.stringify(payload) : null,
    ]
  )

  const snapshot = await getCoachSnapshot(uid)
  const frustrationScore = Number(snapshot.state?.frustration_score ?? 0)
  const frustrationBand = frustrationScore >= 8 ? 'high' : frustrationScore >= 5 ? 'elevated' : 'normal'

  return c.json({
    success: true,
    state: snapshot.state,
    frustration_band: frustrationBand,
  })
})

ai.get('/get_coach_recommendation.php', async (c) => {
  const uid = userId(c)
  const route = c.req.query('route')
  const type = c.req.query('type')
  const params: unknown[] = [uid]
  let where = 'WHERE user_id = $1 AND was_shown = false'

  if (route) {
    params.push(route)
    where += ` AND route = $${params.length}`
  }
  if (type) {
    params.push(type)
    where += ` AND recommendation_type = $${params.length}`
  }

  const rec = await queryOne<Record<string, unknown>>(
    `SELECT * FROM coach_recommendations ${where}
     ORDER BY created_at DESC
     LIMIT 1`,
    params
  )

  if (!rec) {
    return c.json(null)
  }

  await query('UPDATE coach_recommendations SET was_shown = true WHERE id = $1', [rec.id])

  const parsed = typeof rec.recommendation_json === 'string'
    ? JSON.parse(rec.recommendation_json)
    : (rec.recommendation_json as Record<string, unknown> | null)

  return c.json({
    ...(parsed ?? {}),
    id: rec.id,
    route: rec.route,
    recommended_route: parsed?.recommended_route ?? route ?? '/dashboard',
  })
})

ai.post('/coach_chat.php', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const snapshot = await getCoachSnapshot(uid)
  const frustrationScore = Number(body.frustration_score ?? snapshot.state?.frustration_score ?? 0)
  const frustrationBand = frustrationScore >= 8 ? 'high' : frustrationScore >= 5 ? 'elevated' : 'normal'
  const interventionLevel = frustrationScore >= 8 ? 3 : frustrationScore >= 5 ? 2 : 1

  if (!process.env.GEMINI_API_KEY) {
    return c.json({
      intent: body.intent ?? 'support',
      message: 'Panda Coach is not configured yet, but you can keep learning one step at a time.',
      frustration_score: frustrationScore,
      frustration_band: frustrationBand,
      intervention_level: interventionLevel,
      recommended_action: null,
    })
  }

  try {
    const { GoogleGenAI } = await import('@google/genai')
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const result = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      config: { systemInstruction: buildSystemInstruction(snapshot.profile, snapshot.state) },
      contents: [
        `Intent: ${String(body.intent ?? 'support')}`,
        `Route: ${String(body.route ?? '/dashboard')}`,
        `Chapter title: ${String(body.chapter_title ?? '')}`,
        `Level title: ${String(body.level_title ?? '')}`,
        `Lesson title: ${String(body.lesson_title ?? '')}`,
        `Frustration score: ${frustrationScore}`,
      ].join('\n'),
    })

    return c.json({
      intent: body.intent ?? 'support',
      message: result.text ?? 'Let’s take the next step together.',
      frustration_score: frustrationScore,
      frustration_band: frustrationBand,
      intervention_level: interventionLevel,
      recommended_action: null,
    })
  } catch (err) {
    if (isMissingEnvError(err)) {
      throw err
    }
    console.error('Legacy coach chat error:', err)
    return c.json({
      intent: body.intent ?? 'support',
      message: 'Panda Coach had trouble responding just now. Please try again.',
      frustration_score: frustrationScore,
      frustration_band: frustrationBand,
      intervention_level: interventionLevel,
      recommended_action: null,
    })
  }
})

function buildSystemInstruction(
  profile: Record<string, unknown> | null,
  state: Record<string, unknown> | null
): string {
  const tone = profile?.preferred_tone ?? 'supportive'
  const intensity = profile?.support_intensity ?? 'medium'
  const sensory = profile?.sensory_mode ?? 'calm'
  const frustration = Number(state?.frustration_score ?? 0)

  let persona = `You are Panda Coach, a warm and supportive learning companion for NDIS participants learning through Goodwill Care Academy. `
  persona += `Your communication style is ${tone} and ${sensory}. `
  persona += `Provide ${intensity} support. `

  if (frustration > 7) {
    persona += `The learner seems frustrated — be extra gentle, validate their feelings, and offer encouragement. `
  } else if (frustration > 4) {
    persona += `The learner may be finding things challenging — be patient and offer clear, simple guidance. `
  }

  persona += `Keep responses concise (under 150 words), friendly, and practical. `
  persona += `Never mention NDIS funding amounts or make promises about services. `
  persona += `If someone is in distress, remind them to reach out to their support coordinator.`

  return persona
}

function buildRecommendationPrompt(
  state: Record<string, unknown> | null,
  profile: Record<string, unknown> | null,
  recentProgress: unknown[],
  route?: string
): string {
  return `You are an AI learning coach for an NDIS education platform.

Based on this learner data, generate a personalized recommendation JSON:

Current route: ${route ?? 'unknown'}
Frustration score: ${state?.frustration_score ?? 0}/10
Engagement score: ${state?.engagement_score ?? 5}/10
Streak days: ${state?.streak_days ?? 0}
Support intensity: ${profile?.support_intensity ?? 'medium'}
Preferred tone: ${profile?.preferred_tone ?? 'supportive'}
Recent completions: ${JSON.stringify(recentProgress)}

Return a JSON object with:
- "type": one of "encouragement" | "next_step" | "break_suggestion" | "celebration"
- "message": a short supportive message (max 100 words)
- "action": optional CTA text
- "priority": 1-5 (5 = most urgent)

Return ONLY valid JSON, no markdown.`
}

export default ai
