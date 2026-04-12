import { Hono } from 'hono'
import { requireAuth } from '../middleware.js'
import type { JwtPayload } from '../middleware.js'
import { query, queryOne, withTransaction } from '../db.js'
import { isMissingEnvError } from '../env.js'
import type { PoolClient } from 'pg'

const learner = new Hono()
learner.use('*', requireAuth)

// ─── helpers ────────────────────────────────────────────────────────────────

function userId(c: { get(k: string): unknown }): number {
  return Number((c.get('user') as JwtPayload).sub)
}

function nowUtc(): string {
  return new Date().toISOString()
}

function dateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Cap delta to 120 s to prevent runaway accumulation */
function clampDelta(n: number): number {
  return Math.max(0, Math.min(n, 120))
}

function validateContext(body: Record<string, unknown>) {
  const validTypes = ['dashboard', 'chapter', 'level', 'lesson']
  const contextType = validTypes.includes(String(body.context_type ?? ''))
    ? String(body.context_type)
    : 'dashboard'
  return {
    context_type: contextType,
    chapter_id: body.chapter_id ? Number(body.chapter_id) : null,
    level_id: body.level_id ? Number(body.level_id) : null,
    lesson_id: body.lesson_id ? Number(body.lesson_id) : null,
  }
}

async function expireStaleSessions(client: PoolClient, uid: number, maxIdleMinutes = 60) {
  await client.query(
    `UPDATE sessions
     SET status = 'expired',
         logout_at = COALESCE(logout_at, last_ping_at)
     WHERE user_id = $1
       AND status = 'active'
       AND last_ping_at < NOW() - ($2 * INTERVAL '1 minute')`,
    [uid, maxIdleMinutes]
  )
}

async function bucketAddSeconds(
  client: PoolClient,
  sessionId: number,
  uid: number,
  ctx: ReturnType<typeof validateContext>,
  delta: number
) {
  // Find existing open entry for this bucket
  const existing = await client.query(
    `SELECT id FROM time_entries
     WHERE session_id = $1
       AND user_id = $2
       AND context_type = $3
       AND date_key = $4
       AND (chapter_id IS NOT DISTINCT FROM $5)
       AND (level_id   IS NOT DISTINCT FROM $6)
       AND (lesson_id  IS NOT DISTINCT FROM $7)
       AND end_at IS NULL
     LIMIT 1`,
    [sessionId, uid, ctx.context_type, dateKey(), ctx.chapter_id, ctx.level_id, ctx.lesson_id]
  )

  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE time_entries SET seconds_active = seconds_active + $1 WHERE id = $2`,
      [delta, existing.rows[0].id]
    )
  } else {
    await client.query(
      `INSERT INTO time_entries
         (session_id, user_id, context_type, chapter_id, level_id, lesson_id, start_at, date_key, seconds_active)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
      [sessionId, uid, ctx.context_type, ctx.chapter_id, ctx.level_id, ctx.lesson_id, dateKey(), delta]
    )
  }
}

// ─── POST /api/learner/start-session ────────────────────────────────────────
learner.post('/start-session', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({}))
  const ctx = validateContext(body)

  try {
    const result = await withTransaction(async (client) => {
      await expireStaleSessions(client, uid)

      // Close any lingering active sessions
      const activeSessions = await client.query(
        `SELECT id, COALESCE(last_ping_at, login_at) AS close_time
         FROM sessions WHERE user_id = $1 AND status = 'active' FOR UPDATE`,
        [uid]
      )
      for (const s of activeSessions.rows) {
        await client.query(
          `UPDATE sessions SET status = 'expired', logout_at = COALESCE(logout_at, $1)
           WHERE id = $2 AND status = 'active'`,
          [s.close_time, s.id]
        )
        await client.query(
          `UPDATE time_entries SET end_at = $1 WHERE session_id = $2 AND end_at IS NULL`,
          [s.close_time, s.id]
        )
      }

      // Create new session
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO sessions (user_id, login_at, last_ping_at, status, total_seconds_active)
         VALUES ($1, NOW(), NOW(), 'active', 0) RETURNING id`,
        [uid]
      )
      const sessionId = rows[0].id

      // Create initial time entry
      await client.query(
        `INSERT INTO time_entries
           (session_id, user_id, context_type, chapter_id, level_id, lesson_id, start_at, date_key)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
        [sessionId, uid, ctx.context_type, ctx.chapter_id, ctx.level_id, ctx.lesson_id, dateKey()]
      )

      const session = await client.query(
        `SELECT id, login_at, logout_at, total_seconds_active, status FROM sessions WHERE id = $1`,
        [sessionId]
      )

      return { sessionId, session: session.rows[0] }
    })

    return c.json({ success: true, session_id: result.sessionId, session: result.session, context: ctx })
  } catch (err) {
    if (isMissingEnvError(err)) {
      throw err
    }
    console.error('start-session error:', err)
    return c.json({ error: 'Failed to start session' }, 500)
  }
})

// ─── POST /api/learner/log-delta ────────────────────────────────────────────
learner.post('/log-delta', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  if (!body.session_id) return c.json({ error: 'session_id required' }, 400)

  const sessionId = Number(body.session_id)
  const ctx = validateContext(body)
  const clientEvent = String(body.client_event ?? 'manual')
  const eventId = body.event_id ? String(body.event_id) : null
  const isActive = body.is_active !== false
  const deltaProvided = 'delta_seconds_active' in body
  let deltaSeconds = deltaProvided ? clampDelta(Number(body.delta_seconds_active)) : null

  try {
    const result = await withTransaction(async (client) => {
      await expireStaleSessions(client, uid)

      const { rows } = await client.query(
        `SELECT id, login_at, logout_at, total_seconds_active, status,
                GREATEST(0, EXTRACT(EPOCH FROM (NOW() - last_ping_at))::int) AS elapsed_since_ping
         FROM sessions WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [sessionId, uid]
      )

      const session = rows[0]
      if (!session) return { error: 'Session not found', status: 404 }
      if (session.status !== 'active') {
        return { error: 'Session is not active', session_closed: true, status: session.status, httpStatus: 409 }
      }

      if (deltaSeconds === null) {
        deltaSeconds = isActive ? Number(session.elapsed_since_ping) : 0
      }
      if (!isActive) deltaSeconds = 0
      deltaSeconds = clampDelta(deltaSeconds)

      // Idempotency check
      let duplicate = false
      if (eventId) {
        const ev = await client.query(
          `INSERT INTO activity_events (event_id, session_id, user_id, client_event, client_ts, processed_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (event_id) DO NOTHING`,
          [eventId, sessionId, uid, clientEvent, body.client_ts ?? null]
        )
        duplicate = ev.rowCount === 0
      }

      if (!duplicate) {
        await client.query(
          `UPDATE sessions SET total_seconds_active = total_seconds_active + $1, last_ping_at = NOW()
           WHERE id = $2`,
          [deltaSeconds, sessionId]
        )
        if (deltaSeconds > 0) {
          await bucketAddSeconds(client, sessionId, uid, ctx, deltaSeconds)
          await client.query(
            `INSERT INTO activity_log (user_id, activity_date, seconds_active)
             VALUES ($1, CURRENT_DATE, $2)
             ON CONFLICT (user_id, activity_date)
             DO UPDATE SET seconds_active = activity_log.seconds_active + $2`,
            [uid, deltaSeconds]
          )
        }
      }

      const fresh = await client.query(
        `SELECT id, login_at, logout_at, total_seconds_active, status FROM sessions WHERE id = $1`,
        [sessionId]
      )

      return {
        success: true,
        duplicate,
        session_id: sessionId,
        applied_seconds: duplicate ? 0 : deltaSeconds,
        total_seconds_active: Number(fresh.rows[0]?.total_seconds_active ?? 0),
        context: ctx,
      }
    })

    if ('httpStatus' in result) {
      return c.json(result, (result as { httpStatus: number }).httpStatus as 409)
    }
    return c.json(result)
  } catch (err) {
    if (isMissingEnvError(err)) {
      throw err
    }
    console.error('log-delta error:', err)
    return c.json({ error: 'Failed to log delta' }, 500)
  }
})

// ─── POST /api/learner/ping-active ──────────────────────────────────────────
learner.post('/ping-active', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const sessionId = body.session_id ? Number(body.session_id) : null
  if (!sessionId) return c.json({ error: 'session_id required' }, 400)

  await query(
    `UPDATE sessions SET last_ping_at = NOW() WHERE id = $1 AND user_id = $2 AND status = 'active'`,
    [sessionId, uid]
  )
  return c.json({ success: true })
})

// ─── POST /api/learner/end-session ──────────────────────────────────────────
learner.post('/end-session', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const sessionId = body.session_id ? Number(body.session_id) : null
  if (!sessionId) return c.json({ error: 'session_id required' }, 400)

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE sessions SET status = 'closed', logout_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [sessionId, uid]
    )
    await client.query(
      `UPDATE time_entries SET end_at = NOW() WHERE session_id = $1 AND end_at IS NULL`,
      [sessionId]
    )
  })
  return c.json({ success: true })
})

// ─── GET /api/learner/time-summary ──────────────────────────────────────────
learner.get('/time-summary', async (c) => {
  const uid = userId(c)
  const today = dateKey()
  const thirtyAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  const start = c.req.query('start') ?? thirtyAgo
  const end = c.req.query('end') ?? today

  const [totals, byDay, byContext] = await Promise.all([
    queryOne<{ total_seconds: number; days_active: number }>(
      `SELECT COALESCE(SUM(seconds_active), 0) AS total_seconds,
              COUNT(DISTINCT activity_date) AS days_active
       FROM activity_log
       WHERE user_id = $1 AND activity_date BETWEEN $2 AND $3`,
      [uid, start, end]
    ),
    query<{ activity_date: string; seconds_active: number }>(
      `SELECT activity_date, seconds_active
       FROM activity_log
       WHERE user_id = $1 AND activity_date BETWEEN $2 AND $3
       ORDER BY activity_date`,
      [uid, start, end]
    ),
    query<{ context_type: string; total_seconds: number }>(
      `SELECT context_type, SUM(seconds_active) AS total_seconds
       FROM time_entries
       WHERE user_id = $1 AND date_key BETWEEN $2 AND $3
       GROUP BY context_type`,
      [uid, start, end]
    ),
  ])

  return c.json({
    total_seconds: Number(totals?.total_seconds ?? 0),
    total_minutes: Math.round(Number(totals?.total_seconds ?? 0) / 60),
    days_active: Number(totals?.days_active ?? 0),
    by_day: byDay,
    by_context: byContext,
    range: { start, end },
  })
})

// ─── GET /api/learner/chapter-progress ──────────────────────────────────────
learner.get('/chapter-progress', async (c) => {
  const uid = userId(c)

  const [chapters, lessonCounts, completedCounts] = await Promise.all([
    query<{ id: number; title: string; emoji: string; order_index: number }>(
      'SELECT id, title, emoji, order_index FROM chapters ORDER BY order_index'
    ),
    query<{ chapter_id: number; total_lessons: number }>(
      `SELECT c.id AS chapter_id, COUNT(les.id) AS total_lessons
       FROM chapters c
       LEFT JOIN levels l ON l.chapter_id = c.id
       LEFT JOIN lessons les ON les.level_id = l.id
       GROUP BY c.id`
    ),
    query<{ chapter_id: number; completed_lessons: number }>(
      `SELECT c.id AS chapter_id, COUNT(DISTINCT cl.lesson_id) AS completed_lessons
       FROM completed_lessons cl
       JOIN lessons les ON les.id = cl.lesson_id
       JOIN levels l ON l.id = les.level_id
       JOIN chapters c ON c.id = l.chapter_id
       WHERE cl.user_id = $1
       GROUP BY c.id`,
      [uid]
    ),
  ])

  const lessonMap = Object.fromEntries(lessonCounts.map((r) => [r.chapter_id, Number(r.total_lessons)]))
  const completedMap = Object.fromEntries(completedCounts.map((r) => [r.chapter_id, Number(r.completed_lessons)]))

  const progress = chapters.map((ch) => {
    const total = lessonMap[ch.id] ?? 0
    const completed = completedMap[ch.id] ?? 0
    return {
      chapter_id: ch.id,
      title: ch.title,
      emoji: ch.emoji,
      order_index: ch.order_index,
      total_lessons: total,
      completed_lessons: completed,
      completion_percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  })

  return c.json({ success: true, progress })
})

// ─── POST /api/learner/mark-lesson-completed ────────────────────────────────
learner.post('/mark-lesson-completed', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const lessonId = Number(body.lesson_id)
  if (!lessonId) return c.json({ error: 'lesson_id required' }, 400)

  await query(
    `INSERT INTO completed_lessons (user_id, lesson_id) VALUES ($1, $2)
     ON CONFLICT (user_id, lesson_id) DO NOTHING`,
    [uid, lessonId]
  )
  await query(
    `INSERT INTO progress (user_id, lesson_id, is_completed) VALUES ($1, $2, true)
     ON CONFLICT (user_id, lesson_id) DO NOTHING`,
    [uid, lessonId]
  )

  return c.json({ success: true })
})

// ─── POST /api/learner/submit-quiz ──────────────────────────────────────────
learner.post('/submit-quiz', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const quizId = Number(body.quiz_id)
  const answer = Number(body.answer)
  if (!quizId) return c.json({ error: 'quiz_id required' }, 400)

  const quiz = await queryOne<{ correct_answer: number; lesson_id: number }>(
    'SELECT correct_answer, lesson_id FROM quizzes WHERE id = $1',
    [quizId]
  )
  if (!quiz) return c.json({ error: 'Quiz not found' }, 404)

  const isCorrect = answer === quiz.correct_answer

  await query(
    `INSERT INTO quiz_attempts (user_id, quiz_id, lesson_id, is_correct) VALUES ($1, $2, $3, $4)`,
    [uid, quizId, quiz.lesson_id, isCorrect]
  )

  if (isCorrect) {
    await query(
      `INSERT INTO completed_quizzes (user_id, quiz_id, lesson_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, quiz_id) DO NOTHING`,
      [uid, quizId, quiz.lesson_id]
    )
  }

  return c.json({ success: true, is_correct: isCorrect, correct_answer: quiz.correct_answer })
})

// ─── GET /api/learner/achievements ──────────────────────────────────────────
learner.get('/achievements', async (c) => {
  const uid = userId(c)

  const [earned, points, mastery] = await Promise.all([
    query(
      `SELECT ua.*, ad.code, ad.title, ad.description, ad.icon, ad.category, ad.points_reward
       FROM user_achievements ua
       JOIN achievement_definitions ad ON ad.id = ua.achievement_id
       WHERE ua.user_id = $1
       ORDER BY ua.unlocked_at DESC`,
      [uid]
    ),
    queryOne(
      'SELECT * FROM user_points WHERE user_id = $1',
      [uid]
    ),
    query(
      `SELECT cm.*, c.title AS chapter_title, c.emoji
       FROM chapter_mastery cm JOIN chapters c ON c.id = cm.chapter_id
       WHERE cm.user_id = $1`,
      [uid]
    ),
  ])

  return c.json({ success: true, achievements: earned, points, chapter_mastery: mastery })
})

// ─── GET /api/learner/recent-wins ───────────────────────────────────────────
learner.get('/recent-wins', async (c) => {
  const uid = userId(c)
  const wins = await query(
    `SELECT ua.unlocked_at, ad.title, ad.icon, ad.category, ad.points_reward
     FROM user_achievements ua
     JOIN achievement_definitions ad ON ad.id = ua.achievement_id
     WHERE ua.user_id = $1
     ORDER BY ua.unlocked_at DESC LIMIT 10`,
    [uid]
  )
  return c.json({ success: true, wins })
})

// ─── GET /api/learner/weekly-target ─────────────────────────────────────────
learner.get('/weekly-target', async (c) => {
  const uid = userId(c)
  const target = await queryOne(
    `SELECT * FROM weekly_targets
     WHERE user_id = $1 AND week_start <= CURRENT_DATE AND week_end >= CURRENT_DATE
     ORDER BY week_start DESC LIMIT 1`,
    [uid]
  )
  return c.json({ success: true, target })
})

// ─── GET /api/learner/invoices ───────────────────────────────────────────────
learner.get('/invoices', async (c) => {
  const uid = userId(c)
  const invoices = await query(
    `SELECT id, invoice_number, invoice_date, due_date, date_from, date_to,
            status, total_amount, total_hours, currency, pdf_path
     FROM invoices WHERE user_id = $1 ORDER BY invoice_date DESC`,
    [uid]
  )
  return c.json({ success: true, invoices })
})

// ─── GET /api/learner/profile ────────────────────────────────────────────────
learner.get('/profile', async (c) => {
  const uid = userId(c)
  const [user, profile] = await Promise.all([
    queryOne(
      'SELECT id, name, email, ndis_number, role, status, points, profile_image_url, about_me FROM users WHERE id = $1',
      [uid]
    ),
    queryOne('SELECT * FROM learner_profiles WHERE user_id = $1', [uid]),
  ])
  return c.json({ success: true, user, profile })
})

// ─── PATCH /api/learner/profile ──────────────────────────────────────────────
learner.patch('/profile', async (c) => {
  const uid = userId(c)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  if (body.about_me !== undefined) {
    await query('UPDATE users SET about_me = $1 WHERE id = $2', [body.about_me, uid])
  }

  const profileFields = ['age_band', 'sensory_mode', 'preferred_tone',
    'preferred_session_length_minutes', 'support_intensity', 'coach_enabled', 'voice_enabled']
  const updates = profileFields.filter((f) => f in body)

  if (updates.length > 0) {
    const setClauses = updates.map((f, i) => `${f} = $${i + 2}`).join(', ')
    const values = updates.map((f) => body[f])
    await query(
      `INSERT INTO learner_profiles (user_id, ${updates.join(', ')})
       VALUES ($1, ${updates.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (user_id) DO UPDATE SET ${setClauses}`,
      [uid, ...values]
    )
  }

  return c.json({ success: true })
})

// ─── GET /api/learner/chapters ───────────────────────────────────────────────
learner.get('/chapters', async (c) => {
  const uid = userId(c)
  const chapters = await query(
    `SELECT c.id, c.title, c.emoji, c.order_index,
            json_agg(
              json_build_object(
                'id', l.id,
                'title', l.title,
                'video_url', l.video_url,
                'is_free', l.is_free,
                'order_index', l.order_index
              ) ORDER BY l.order_index
            ) FILTER (WHERE l.id IS NOT NULL) AS levels
     FROM chapters c
     LEFT JOIN levels l ON l.chapter_id = c.id
     GROUP BY c.id ORDER BY c.order_index`
  )

  const completedLessons = await query<{ lesson_id: number }>(
    'SELECT lesson_id FROM completed_lessons WHERE user_id = $1',
    [uid]
  )
  const completedSet = new Set(completedLessons.map((r) => r.lesson_id))

  return c.json({ success: true, chapters, completed_lesson_ids: [...completedSet] })
})

// ─── GET /api/learner/level/:levelId ─────────────────────────────────────────
learner.get('/level/:levelId', async (c) => {
  const uid = userId(c)
  const levelId = Number(c.req.param('levelId'))

  const level = await queryOne(
    'SELECT * FROM levels WHERE id = $1',
    [levelId]
  )
  if (!level) return c.json({ error: 'Level not found' }, 404)

  const lessons = await query(
    `SELECT l.*,
            json_agg(q.* ORDER BY q.id) FILTER (WHERE q.id IS NOT NULL) AS quizzes
     FROM lessons l
     LEFT JOIN quizzes q ON q.lesson_id = l.id
     WHERE l.level_id = $1
     GROUP BY l.id ORDER BY l.order_index`,
    [levelId]
  )

  const completedLessons = await query<{ lesson_id: number }>(
    `SELECT lesson_id FROM completed_lessons
     WHERE user_id = $1 AND lesson_id = ANY($2::int[])`,
    [uid, lessons.map((l: Record<string, unknown>) => l.id)]
  )
  const completedSet = new Set(completedLessons.map((r) => r.lesson_id))

  return c.json({
    success: true,
    level,
    lessons: lessons.map((l: Record<string, unknown>) => ({
      ...l,
      completed: completedSet.has(Number(l.id)),
    })),
  })
})

export default learner
