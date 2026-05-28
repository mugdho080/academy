import { Hono } from 'hono'
import { requireAuth, requireAdmin } from '../middleware.js'
import { query, queryOne, withTransaction } from '../db.js'
import type { JwtPayload } from '../middleware.js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const admin = new Hono()
admin.use('*', requireAuth, requireAdmin)

const EMPTY_LAYOUT = {
  widgets: [],
  layouts: { lg: [], md: [], sm: [] },
  widget_settings: {},
}

const DEFAULT_PRESETS = [
  { preset_key: 'default_admin_view', preset_name: 'Default Admin View' },
]

const DEFAULT_WIDGETS = [
  {
    widget_key: 'total_learners',
    title: 'Total Learners',
    description: 'Current learner volume and approval mix.',
    category: 'Overview',
    default_w: 4,
    default_h: 4,
    min_w: 2,
    min_h: 2,
    component_name: 'total_learners',
    icon: 'Users',
    configurable: false,
    settings_schema: { fields: [] },
  },
  {
    widget_key: 'new_signups',
    title: 'New Signups',
    description: 'New learner registrations this week.',
    category: 'Overview',
    default_w: 4,
    default_h: 4,
    min_w: 2,
    min_h: 2,
    component_name: 'new_signups',
    icon: 'UserPlus',
    configurable: false,
    settings_schema: { fields: [] },
  },
  {
    widget_key: 'pending_service_agreements',
    title: 'Pending Agreements',
    description: 'Learners waiting on agreement review or activation.',
    category: 'Compliance',
    default_w: 4,
    default_h: 6,
    min_w: 2,
    min_h: 3,
    component_name: 'pending_service_agreements',
    icon: 'FileWarning',
    configurable: false,
    settings_schema: { fields: [] },
  },
  {
    widget_key: 'draft_invoices',
    title: 'Draft Invoices',
    description: 'Draft invoice count and value.',
    category: 'Finance',
    default_w: 3,
    default_h: 4,
    min_w: 2,
    min_h: 2,
    component_name: 'draft_invoices',
    icon: 'FileText',
    configurable: false,
    settings_schema: { fields: [] },
  },
  {
    widget_key: 'unpaid_invoices',
    title: 'Unpaid Invoices',
    description: 'Outstanding invoice count and overdue totals.',
    category: 'Finance',
    default_w: 3,
    default_h: 4,
    min_w: 2,
    min_h: 2,
    component_name: 'unpaid_invoices',
    icon: 'Wallet',
    configurable: false,
    settings_schema: { fields: [] },
  },
  {
    widget_key: 'paid_invoices',
    title: 'Paid Invoices',
    description: 'Invoices paid this month.',
    category: 'Finance',
    default_w: 3,
    default_h: 4,
    min_w: 2,
    min_h: 2,
    component_name: 'paid_invoices',
    icon: 'BadgeCheck',
    configurable: false,
    settings_schema: { fields: [] },
  },
  {
    widget_key: 'learner_quick_search',
    title: 'Learner Quick Search',
    description: 'Open learner records quickly by name or NDIS number.',
    category: 'Learners',
    default_w: 6,
    default_h: 6,
    min_w: 3,
    min_h: 3,
    component_name: 'learner_quick_search',
    icon: 'Search',
    configurable: false,
    settings_schema: { fields: [] },
  },
  {
    widget_key: 'recently_active_users',
    title: 'Recently Active Learners',
    description: 'Most recently active learners across the platform.',
    category: 'Engagement',
    default_w: 6,
    default_h: 6,
    min_w: 3,
    min_h: 3,
    component_name: 'recently_active_users',
    icon: 'Clock3',
    configurable: false,
    settings_schema: { fields: [] },
  },
  {
    widget_key: 'quick_actions',
    title: 'Quick Actions',
    description: 'Jump to common admin workflows.',
    category: 'Utilities',
    default_w: 6,
    default_h: 4,
    min_w: 3,
    min_h: 2,
    component_name: 'quick_actions',
    icon: 'Rocket',
    configurable: false,
    settings_schema: { fields: [] },
  },
  {
    widget_key: 'notes_reminders',
    title: 'Notes & Reminders',
    description: 'Private dashboard notes saved in your layout.',
    category: 'Utilities',
    default_w: 6,
    default_h: 5,
    min_w: 3,
    min_h: 3,
    component_name: 'notes_reminders',
    icon: 'NotebookTabs',
    configurable: true,
    settings_schema: {
      fields: [
        {
          key: 'note',
          label: 'Reminder Notes',
          type: 'textarea',
          default: '',
        },
      ],
    },
  },
]

const DEFAULT_LAYOUT_JSON = {
  widgets: [
    'total_learners',
    'new_signups',
    'pending_service_agreements',
    'draft_invoices',
    'unpaid_invoices',
    'paid_invoices',
    'learner_quick_search',
    'recently_active_users',
    'quick_actions',
    'notes_reminders',
  ],
  layouts: {
    lg: [
      { i: 'total_learners', x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
      { i: 'new_signups', x: 4, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
      { i: 'pending_service_agreements', x: 8, y: 0, w: 4, h: 6, minW: 2, minH: 3 },
      { i: 'draft_invoices', x: 0, y: 4, w: 3, h: 4, minW: 2, minH: 2 },
      { i: 'unpaid_invoices', x: 3, y: 4, w: 3, h: 4, minW: 2, minH: 2 },
      { i: 'paid_invoices', x: 6, y: 4, w: 3, h: 4, minW: 2, minH: 2 },
      { i: 'learner_quick_search', x: 0, y: 8, w: 6, h: 6, minW: 3, minH: 3 },
      { i: 'recently_active_users', x: 6, y: 8, w: 6, h: 6, minW: 3, minH: 3 },
      { i: 'quick_actions', x: 0, y: 14, w: 6, h: 4, minW: 3, minH: 2 },
      { i: 'notes_reminders', x: 6, y: 14, w: 6, h: 5, minW: 3, minH: 3 },
    ],
    md: [
      { i: 'total_learners', x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
      { i: 'new_signups', x: 4, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
      { i: 'pending_service_agreements', x: 0, y: 4, w: 8, h: 6, minW: 2, minH: 3 },
      { i: 'draft_invoices', x: 0, y: 10, w: 4, h: 4, minW: 2, minH: 2 },
      { i: 'unpaid_invoices', x: 4, y: 10, w: 4, h: 4, minW: 2, minH: 2 },
      { i: 'paid_invoices', x: 0, y: 14, w: 4, h: 4, minW: 2, minH: 2 },
      { i: 'learner_quick_search', x: 0, y: 18, w: 8, h: 6, minW: 3, minH: 3 },
      { i: 'recently_active_users', x: 0, y: 24, w: 8, h: 6, minW: 3, minH: 3 },
      { i: 'quick_actions', x: 0, y: 30, w: 8, h: 4, minW: 3, minH: 2 },
      { i: 'notes_reminders', x: 0, y: 34, w: 8, h: 5, minW: 3, minH: 3 },
    ],
    sm: [
      { i: 'total_learners', x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
      { i: 'new_signups', x: 0, y: 4, w: 4, h: 4, minW: 2, minH: 2 },
      { i: 'pending_service_agreements', x: 0, y: 8, w: 4, h: 6, minW: 2, minH: 3 },
      { i: 'draft_invoices', x: 0, y: 14, w: 4, h: 4, minW: 2, minH: 2 },
      { i: 'unpaid_invoices', x: 0, y: 18, w: 4, h: 4, minW: 2, minH: 2 },
      { i: 'paid_invoices', x: 0, y: 22, w: 4, h: 4, minW: 2, minH: 2 },
      { i: 'learner_quick_search', x: 0, y: 26, w: 4, h: 6, minW: 3, minH: 3 },
      { i: 'recently_active_users', x: 0, y: 32, w: 4, h: 6, minW: 3, minH: 3 },
      { i: 'quick_actions', x: 0, y: 38, w: 4, h: 4, minW: 3, minH: 2 },
      { i: 'notes_reminders', x: 0, y: 42, w: 4, h: 5, minW: 3, minH: 3 },
    ],
  },
  widget_settings: {
    notes_reminders: {
      note: '',
    },
  },
}

const contentSeedPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../contents/final_v3_content.json')

async function buildLegacyTimeSummary(targetUserId: number, start: string, end: string) {
  const [sessions, dailyTotals, contextRows, chapterRows, levelRows, lessonRows] = await Promise.all([
    query<{
      id: number
      login_at: string
      logout_at: string | null
      status: string
      total_seconds_active: number
    }>(
      `SELECT id, login_at, logout_at, status, total_seconds_active
       FROM sessions
       WHERE user_id = $1
         AND login_at::date BETWEEN $2 AND $3
       ORDER BY login_at DESC`,
      [targetUserId, start, end]
    ),
    query<{ date_key: string; total_seconds: number }>(
      `SELECT date_key::text, COALESCE(SUM(seconds_active), 0) AS total_seconds
       FROM time_entries
       WHERE user_id = $1 AND date_key BETWEEN $2 AND $3
       GROUP BY date_key
       ORDER BY date_key DESC`,
      [targetUserId, start, end]
    ),
    query<{ context_type: string; total_seconds: number }>(
      `SELECT context_type, COALESCE(SUM(seconds_active), 0) AS total_seconds
       FROM time_entries
       WHERE user_id = $1 AND date_key BETWEEN $2 AND $3
       GROUP BY context_type`,
      [targetUserId, start, end]
    ),
    query<{ chapter_id: number; chapter_title: string; total_seconds: number }>(
      `SELECT te.chapter_id, c.title AS chapter_title, COALESCE(SUM(te.seconds_active), 0) AS total_seconds
       FROM time_entries te
       LEFT JOIN chapters c ON c.id = te.chapter_id
       WHERE te.user_id = $1 AND te.date_key BETWEEN $2 AND $3 AND te.chapter_id IS NOT NULL
       GROUP BY te.chapter_id, c.title
       ORDER BY total_seconds DESC`,
      [targetUserId, start, end]
    ),
    query<{ level_id: number; level_title: string; chapter_title: string; total_seconds: number }>(
      `SELECT te.level_id, l.title AS level_title, c.title AS chapter_title, COALESCE(SUM(te.seconds_active), 0) AS total_seconds
       FROM time_entries te
       LEFT JOIN levels l ON l.id = te.level_id
       LEFT JOIN chapters c ON c.id = te.chapter_id
       WHERE te.user_id = $1 AND te.date_key BETWEEN $2 AND $3 AND te.level_id IS NOT NULL
       GROUP BY te.level_id, l.title, c.title
       ORDER BY total_seconds DESC`,
      [targetUserId, start, end]
    ),
    query<{ lesson_id: number; lesson_title: string; level_title: string; total_seconds: number }>(
      `SELECT te.lesson_id, les.title AS lesson_title, l.title AS level_title, COALESCE(SUM(te.seconds_active), 0) AS total_seconds
       FROM time_entries te
       LEFT JOIN lessons les ON les.id = te.lesson_id
       LEFT JOIN levels l ON l.id = te.level_id
       WHERE te.user_id = $1 AND te.date_key BETWEEN $2 AND $3 AND te.lesson_id IS NOT NULL
       GROUP BY te.lesson_id, les.title, l.title
       ORDER BY total_seconds DESC`,
      [targetUserId, start, end]
    ),
  ])

  const contextTotals = {
    dashboard: 0,
    chapter: 0,
    level: 0,
    lesson: 0,
  }

  for (const row of contextRows) {
    if (row.context_type in contextTotals) {
      contextTotals[row.context_type as keyof typeof contextTotals] = Number(row.total_seconds ?? 0)
    }
  }

  return {
    sessions: sessions.map((session) => ({
      ...session,
      total_seconds_active: Number(session.total_seconds_active ?? 0),
      summary: `${Number(session.total_seconds_active ?? 0)} seconds active`,
    })),
    daily_totals: dailyTotals.map((day) => ({
      date_key: day.date_key,
      total_seconds: Number(day.total_seconds ?? 0),
    })),
    context_totals: contextTotals,
    breakdown: {
      chapters: chapterRows.map((row) => ({ ...row, total_seconds: Number(row.total_seconds ?? 0) })),
      levels: levelRows.map((row) => ({ ...row, total_seconds: Number(row.total_seconds ?? 0) })),
      lessons: lessonRows.map((row) => ({ ...row, total_seconds: Number(row.total_seconds ?? 0) })),
    },
    total_active_seconds: Object.values(contextTotals).reduce((sum, value) => sum + value, 0),
  }
}

function toLegacyStage(userStatus: string | null | undefined, hasAgreement: boolean) {
  if (userStatus === 'active') return 'active'
  if (userStatus === 'pending') return 'claim_ready'
  if (!hasAgreement) return 'lead'
  return 'blocked'
}

async function getCompanySettingsRecord() {
  return queryOne<Record<string, unknown>>('SELECT * FROM company_settings ORDER BY id LIMIT 1')
}

async function nextInvoiceNumber(prefix: string) {
  const periodKey = new Date().toISOString().slice(0, 7).replace('-', '')
  const sequence = await withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO invoice_sequences (invoice_prefix, period_key, last_serial)
       VALUES ($1, $2, 1)
       ON CONFLICT (invoice_prefix, period_key)
       DO UPDATE SET last_serial = invoice_sequences.last_serial + 1
       RETURNING last_serial`,
      [prefix, periodKey]
    )
    return res.rows[0].last_serial
  })
  return `${prefix}-${periodKey}-${String(sequence).padStart(4, '0')}`
}

async function buildInvoicePreview(userIds: number[], dateFrom: string, dateTo: string, hourlyRate: number) {
  if (userIds.length === 0) return []

  const users = await query<{ id: number; name: string; ndis_number: string }>(
    'SELECT id, name, ndis_number FROM users WHERE id = ANY($1::int[]) ORDER BY name',
    [userIds]
  )
  const totals = await query<{ user_id: number; total_seconds: number }>(
    `SELECT user_id, COALESCE(SUM(seconds_active), 0) AS total_seconds
     FROM time_entries
     WHERE user_id = ANY($1::int[]) AND date_key BETWEEN $2 AND $3
     GROUP BY user_id`,
    [userIds, dateFrom, dateTo]
  )
  const totalMap = Object.fromEntries(totals.map((row) => [row.user_id, Number(row.total_seconds ?? 0)]))

  return users.map((user) => {
    const totalSeconds = totalMap[user.id] ?? 0
    const totalHours = Number((totalSeconds / 3600).toFixed(2))
    const amount = Number((totalHours * hourlyRate).toFixed(2))
    return {
      user_id: user.id,
      participant_name: user.name,
      participant_ndis_number: user.ndis_number,
      total_seconds: totalSeconds,
      total_hours: totalHours,
      amount,
    }
  })
}

function parseJsonSafe<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

async function readUploadAsDataUrl(
  bodyValue: FormDataEntryValue | null,
  allowedTypes: string[],
  maxBytes: number
) {
  if (!(bodyValue instanceof File)) {
    return { error: 'No file uploaded' as const }
  }

  if (!allowedTypes.includes(bodyValue.type)) {
    return { error: 'Unsupported file type' as const }
  }

  const bytes = bodyValue.size ?? 0
  if (bytes <= 0 || bytes > maxBytes) {
    return { error: `File must be between 1 byte and ${Math.floor(maxBytes / 1024 / 1024)}MB` as const }
  }

  const buffer = Buffer.from(await bodyValue.arrayBuffer())
  return {
    dataUrl: `data:${bodyValue.type};base64,${buffer.toString('base64')}`,
  }
}

async function buildContentTree() {
  const [chapters, levels, lessons, quizzes] = await Promise.all([
    query<Record<string, unknown>>(
      'SELECT id, title, emoji, order_index FROM chapters ORDER BY order_index, id'
    ),
    query<Record<string, unknown>>(
      'SELECT id, chapter_id, title, video_url, is_free, order_index FROM levels ORDER BY chapter_id, order_index, id'
    ),
    query<Record<string, unknown>>(
      'SELECT id, level_id, title, content, order_index FROM lessons ORDER BY level_id, order_index, id'
    ),
    query<Record<string, unknown>>(
      'SELECT id, lesson_id, question, options, correct_answer FROM quizzes ORDER BY lesson_id, id'
    ),
  ])

  const quizzesByLesson = new Map<number, Array<Record<string, unknown>>>()
  for (const quiz of quizzes) {
    const lessonId = Number(quiz.lesson_id)
    const list = quizzesByLesson.get(lessonId) ?? []
    list.push({
      ...quiz,
      options: Array.isArray(quiz.options) ? quiz.options : parseJsonSafe<string[]>(quiz.options, []),
      correct_answer: Number(quiz.correct_answer ?? 0),
    })
    quizzesByLesson.set(lessonId, list)
  }

  const lessonsByLevel = new Map<number, Array<Record<string, unknown>>>()
  for (const lesson of lessons) {
    const levelId = Number(lesson.level_id)
    const list = lessonsByLevel.get(levelId) ?? []
    list.push({
      ...lesson,
      quizzes: quizzesByLesson.get(Number(lesson.id)) ?? [],
    })
    lessonsByLevel.set(levelId, list)
  }

  const levelsByChapter = new Map<number, Array<Record<string, unknown>>>()
  for (const level of levels) {
    const chapterId = Number(level.chapter_id)
    const list = levelsByChapter.get(chapterId) ?? []
    list.push({
      ...level,
      is_free: Boolean(level.is_free),
      lessons: lessonsByLevel.get(Number(level.id)) ?? [],
    })
    levelsByChapter.set(chapterId, list)
  }

  return chapters.map((chapter) => ({
    ...chapter,
    levels: levelsByChapter.get(Number(chapter.id)) ?? [],
  }))
}

function loadSeedContent() {
  if (!existsSync(contentSeedPath)) {
    throw new Error(`Seed content file not found at ${contentSeedPath}`)
  }
  return parseJsonSafe<Record<string, unknown>>(readFileSync(contentSeedPath, 'utf8'), {})
}

interface ImportCurriculumOptions {
  /**
   * When `true`, every learner progress / completion / quiz-attempt row and
   * the entire chapter / level / lesson / quiz tree is deleted before the
   * import runs. This wipes learner history and is destructive. Default is
   * `false` (additive import — see below).
   */
  reset?: boolean
}

async function importCurriculumDocument(
  document: Record<string, unknown>,
  options: ImportCurriculumOptions = {}
) {
  const chapters = Array.isArray(document.chapters) ? document.chapters : []
  const reset = Boolean(options.reset)

  return withTransaction(async (client) => {
    if (reset) {
      await client.query('DELETE FROM progress')
      await client.query('DELETE FROM completed_quizzes')
      await client.query('DELETE FROM completed_lessons')
      await client.query('DELETE FROM completed_levels')
      await client.query('DELETE FROM completed_chapters')
      await client.query('DELETE FROM chapter_mastery')
      await client.query('DELETE FROM quiz_attempts')
      await client.query('DELETE FROM quizzes')
      await client.query('DELETE FROM lessons')
      await client.query('DELETE FROM levels')
      await client.query('DELETE FROM chapters')
    }

    let importedChapters = 0
    let importedLevels = 0
    let importedLessons = 0
    let importedQuizzes = 0

    for (const chapterEntry of chapters as Array<Record<string, unknown>>) {
      const chapterRows = await client.query<{ id: number }>(
        `INSERT INTO chapters (title, emoji, order_index)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [
          String(chapterEntry.chapter_title ?? chapterEntry.title ?? `Chapter ${importedChapters + 1}`),
          String(chapterEntry.chapter_icon ?? chapterEntry.emoji ?? '📚'),
          Number(chapterEntry.module_number ?? chapterEntry.order_index ?? importedChapters),
        ]
      )
      importedChapters += 1
      const chapterId = chapterRows.rows[0].id
      const levelEntries = Array.isArray(chapterEntry.levels) ? chapterEntry.levels : []

      for (const levelEntry of levelEntries as Array<Record<string, unknown>>) {
        const levelRows = await client.query<{ id: number }>(
          `INSERT INTO levels (chapter_id, title, video_url, is_free, order_index)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            chapterId,
            String(levelEntry.level_title ?? levelEntry.title ?? `Level ${importedLevels + 1}`),
            levelEntry.youtube_url ?? levelEntry.video_url ?? null,
            Boolean(levelEntry.is_free ?? false),
            Number(levelEntry.level_number ?? levelEntry.order_index ?? importedLevels),
          ]
        )
        importedLevels += 1
        const levelId = levelRows.rows[0].id
        const lessonEntries = Array.isArray(levelEntry.lessons) ? levelEntry.lessons : []

        for (const lessonEntry of lessonEntries as Array<Record<string, unknown>>) {
          const lessonContent = lessonEntry.lesson_body ?? lessonEntry.structured_content ?? lessonEntry.content ?? ''
          const lessonRows = await client.query<{ id: number }>(
            `INSERT INTO lessons (level_id, title, content, order_index)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [
              levelId,
              String(lessonEntry.lesson_title ?? lessonEntry.title ?? `Lesson ${importedLessons + 1}`),
              typeof lessonContent === 'string' ? lessonContent : JSON.stringify(lessonContent),
              Number(lessonEntry.lesson_number ?? lessonEntry.order_index ?? importedLessons),
            ]
          )
          importedLessons += 1
          const lessonId = lessonRows.rows[0].id
          const quizGroups = Array.isArray(lessonEntry.quizzes) ? lessonEntry.quizzes : []

          for (const quizGroup of quizGroups as Array<Record<string, unknown>>) {
            const questions = Array.isArray(quizGroup.questions) ? quizGroup.questions : []
            for (const question of questions as Array<Record<string, unknown>>) {
              await client.query(
                `INSERT INTO quizzes (lesson_id, question, options, correct_answer)
                 VALUES ($1, $2, $3::jsonb, $4)`,
                [
                  lessonId,
                  String(question.prompt ?? question.question ?? 'Untitled question'),
                  JSON.stringify(Array.isArray(question.options) ? question.options : []),
                  Number(question.correct_index ?? question.correct_answer ?? 0),
                ]
              )
              importedQuizzes += 1
            }
          }
        }
      }
    }

    return {
      chapters: importedChapters,
      levels: importedLevels,
      lessons: importedLessons,
      quizzes: importedQuizzes,
    }
  })
}

function normalizeWidgetRecord(row: Record<string, unknown>) {
  return {
    widget_key: String(row.widget_key),
    title: String(row.title),
    description: row.description ? String(row.description) : '',
    category: String(row.category),
    default_w: Number(row.default_w ?? 3),
    default_h: Number(row.default_h ?? 4),
    min_w: Number(row.min_w ?? 2),
    min_h: Number(row.min_h ?? 2),
    component_name: String(row.component_name ?? row.widget_key),
    icon: row.icon ? String(row.icon) : null,
    configurable: Boolean(parseJsonSafe(row.settings_schema_json, { fields: [] })?.fields?.length),
    settings_schema: parseJsonSafe(row.settings_schema_json, { fields: [] }),
  }
}

// Legacy PHP compatibility routes used by older admin screens.
admin.get('/fetch_users', async (c) => {
  const users = await query(
    `SELECT u.id, u.name, u.email, u.ndis_number, u.status, u.points, u.created_at,
            COALESCE(up.total_active_minutes, 0) * 60 AS total_active_seconds
     FROM users u
     LEFT JOIN user_points up ON up.user_id = u.id
     WHERE u.role = 'learner'
     ORDER BY u.created_at DESC`
  )
  return c.json(users)
})

admin.get('/fetch_content', async (c) => {
  const content = await buildContentTree()
  return c.json(content)
})

admin.post('/save_content', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const type = String(body.type ?? '')

  if (!['chapter', 'level', 'lesson', 'quiz'].includes(type)) {
    return c.json({ error: 'Invalid content type' }, 400)
  }

  if (type === 'chapter') {
    const id = Number(body.id ?? 0)
    const title = String(body.title ?? '').trim()
    if (!title) return c.json({ error: 'Chapter title required' }, 400)
    const emoji = String(body.emoji ?? '📚')
    const orderIndex = Number(body.order_index ?? 0)

    const sql = id
      ? `UPDATE chapters SET title = $1, emoji = $2, order_index = $3 WHERE id = $4 RETURNING *`
      : `INSERT INTO chapters (title, emoji, order_index) VALUES ($1, $2, $3) RETURNING *`
    const params = id ? [title, emoji, orderIndex, id] : [title, emoji, orderIndex]
    const rows = await query<Record<string, unknown>>(sql, params)
    return c.json({ success: true, item: rows[0] ?? null })
  }

  if (type === 'level') {
    const id = Number(body.id ?? 0)
    const chapterId = Number(body.chapter_id ?? 0)
    const title = String(body.title ?? '').trim()
    if (!chapterId || !title) {
      return c.json({ error: 'chapter_id and title required' }, 400)
    }
    const videoUrl = body.video_url ? String(body.video_url) : null
    const isFree = body.is_free === true || body.is_free === 1 || body.is_free === '1'
    const orderIndex = Number(body.order_index ?? 0)

    const sql = id
      ? `UPDATE levels SET chapter_id = $1, title = $2, video_url = $3, is_free = $4, order_index = $5 WHERE id = $6 RETURNING *`
      : `INSERT INTO levels (chapter_id, title, video_url, is_free, order_index) VALUES ($1, $2, $3, $4, $5) RETURNING *`
    const params = id
      ? [chapterId, title, videoUrl, isFree, orderIndex, id]
      : [chapterId, title, videoUrl, isFree, orderIndex]
    const rows = await query<Record<string, unknown>>(sql, params)
    return c.json({ success: true, item: rows[0] ?? null })
  }

  if (type === 'lesson') {
    const id = Number(body.id ?? 0)
    const levelId = Number(body.level_id ?? 0)
    const title = String(body.title ?? '').trim()
    if (!levelId || !title) {
      return c.json({ error: 'level_id and title required' }, 400)
    }
    const content = String(body.content ?? '')
    const orderIndex = Number(body.order_index ?? 0)

    const sql = id
      ? `UPDATE lessons SET level_id = $1, title = $2, content = $3, order_index = $4 WHERE id = $5 RETURNING *`
      : `INSERT INTO lessons (level_id, title, content, order_index) VALUES ($1, $2, $3, $4) RETURNING *`
    const params = id
      ? [levelId, title, content, orderIndex, id]
      : [levelId, title, content, orderIndex]
    const rows = await query<Record<string, unknown>>(sql, params)
    return c.json({ success: true, item: rows[0] ?? null })
  }

  const lessonId = Number(body.lesson_id ?? 0)
  const question = String(body.question ?? '').trim()
  const options = Array.isArray(body.options) ? body.options.map(String) : []
  const correctAnswer = Number(body.correct_answer ?? 0)
  if (!lessonId || !question || options.length === 0) {
    return c.json({ error: 'lesson_id, question and options required' }, 400)
  }

  const id = Number(body.id ?? 0)
  const sql = id
    ? `UPDATE quizzes SET lesson_id = $1, question = $2, options = $3::jsonb, correct_answer = $4 WHERE id = $5 RETURNING *`
    : `INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES ($1, $2, $3::jsonb, $4) RETURNING *`
  const params = id
    ? [lessonId, question, JSON.stringify(options), correctAnswer, id]
    : [lessonId, question, JSON.stringify(options), correctAnswer]
  const rows = await query<Record<string, unknown>>(sql, params)
  return c.json({ success: true, item: rows[0] ?? null })
})

/**
 * POST /api/admin/import_content
 *
 * Default behaviour is now an **additive** upsert: chapters / levels /
 * lessons / quizzes are appended; learner progress, completions, and quiz
 * attempts are preserved.
 *
 * Destructive reset is opt-in. To wipe and re-seed the entire curriculum
 * the body must include BOTH:
 *
 *     { "mode": "reset", "confirm": "RESET_CURRICULUM" }
 *
 * Missing or mistyped `confirm` is rejected with HTTP 400 so an admin
 * cannot accidentally wipe learner history via a stale client.
 */
admin.post('/import_content', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const document = body.document && typeof body.document === 'object'
    ? body.document as Record<string, unknown>
    : loadSeedContent()

  const mode = typeof body.mode === 'string' ? body.mode : 'append'
  const confirm = typeof body.confirm === 'string' ? body.confirm : ''

  let reset = false
  if (mode === 'reset') {
    if (confirm !== 'RESET_CURRICULUM') {
      return c.json({
        error: 'Destructive curriculum reset requires confirm = "RESET_CURRICULUM".',
        hint: 'Send { mode: "reset", confirm: "RESET_CURRICULUM" } or omit mode for additive import.',
      }, 400)
    }
    reset = true
  } else if (mode !== 'append') {
    return c.json({
      error: `Unknown mode "${mode}". Use "append" (default) or "reset".`,
    }, 400)
  }

  const imported = await importCurriculumDocument(document, { reset })
  return c.json({ success: true, mode: reset ? 'reset' : 'append', imported })
})

admin.post('/add_level_json', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const chapterId = Number(body.chapter_id ?? 0)
  const level = body.level as Record<string, unknown> | undefined
  if (!chapterId || !level) {
    return c.json({ error: 'chapter_id and level required' }, 400)
  }

  const result = await withTransaction(async (client) => {
    const levelRows = await client.query<{ id: number }>(
      `INSERT INTO levels (chapter_id, title, video_url, is_free, order_index)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        chapterId,
        String(level.level_title ?? level.title ?? 'New Level'),
        level.youtube_url ?? level.video_url ?? null,
        Boolean(level.is_free ?? false),
        Number(level.level_number ?? level.order_index ?? 0),
      ]
    )
    const levelId = levelRows.rows[0].id
    let lessons = 0
    let quizzes = 0
    for (const lesson of (Array.isArray(level.lessons) ? level.lessons : []) as Array<Record<string, unknown>>) {
      const lessonRows = await client.query<{ id: number }>(
        `INSERT INTO lessons (level_id, title, content, order_index)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          levelId,
          String(lesson.lesson_title ?? lesson.title ?? 'Untitled Lesson'),
          typeof lesson.lesson_body === 'string' ? lesson.lesson_body : JSON.stringify(lesson.lesson_body ?? lesson.content ?? ''),
          Number(lesson.lesson_number ?? lesson.order_index ?? lessons),
        ]
      )
      lessons += 1
      const lessonId = lessonRows.rows[0].id
      for (const quizGroup of (Array.isArray(lesson.quizzes) ? lesson.quizzes : []) as Array<Record<string, unknown>>) {
        for (const question of (Array.isArray(quizGroup.questions) ? quizGroup.questions : []) as Array<Record<string, unknown>>) {
          await client.query(
            `INSERT INTO quizzes (lesson_id, question, options, correct_answer)
             VALUES ($1, $2, $3::jsonb, $4)`,
            [
              lessonId,
              String(question.prompt ?? question.question ?? 'Untitled question'),
              JSON.stringify(Array.isArray(question.options) ? question.options : []),
              Number(question.correct_index ?? question.correct_answer ?? 0),
            ]
          )
          quizzes += 1
        }
      }
    }
    return { chapters: 0, levels: 1, lessons, quizzes, level_id: levelId }
  })

  return c.json({ success: true, imported: result })
})

admin.post('/update_status', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const id = Number(body.user_id)
  const status = String(body.status ?? '')
  if (!id || !['locked', 'pending', 'active'].includes(status)) {
    return c.json({ error: 'Invalid user_id or status' }, 400)
  }
  await query('UPDATE users SET status = $1 WHERE id = $2', [status, id])
  return c.json({ success: true })
})

admin.post('/update_status.php', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const id = Number(body.user_id)
  const status = String(body.status ?? '')
  if (!id || !['locked', 'pending', 'active'].includes(status)) {
    return c.json({ error: 'Invalid user_id or status' }, 400)
  }
  await query('UPDATE users SET status = $1 WHERE id = $2', [status, id])
  return c.json({ success: true })
})

admin.get('/fetch_agreement.php', async (c) => {
  const userId = Number(c.req.query('user_id'))
  if (!userId) {
    return c.json({ error: 'user_id required' }, 400)
  }

  const agreement = await queryOne<Record<string, unknown>>(
    'SELECT * FROM service_agreements WHERE user_id = $1 ORDER BY signed_at DESC LIMIT 1',
    [userId]
  )

  if (!agreement) {
    return c.json({ error: 'Agreement not found' }, 404)
  }

  return c.json({
    ...agreement,
    signature_url: agreement.signature_data ?? null,
  })
})

admin.get('/get_widget_library.php', async (c) => {
  const widgets = await query(
    `SELECT widget_key, title, description, category, default_w, default_h, min_w, min_h,
            permissions_json, settings_schema_json, component_name, icon, is_active
     FROM widget_definitions
     WHERE is_active = TRUE
     ORDER BY category, title`
  ).catch(() => [])

  return c.json({
    widgets: widgets.length > 0 ? widgets.map(normalizeWidgetRecord) : DEFAULT_WIDGETS,
  })
})

admin.get('/get_dashboard_presets.php', async (c) => {
  const presets = await query<{ preset_name: string; description: string }>(
    `SELECT preset_name, COALESCE(description, preset_name) AS description
     FROM dashboard_presets
     ORDER BY preset_name`
  ).catch(() => [])

  return c.json({
    presets: presets.length > 0
      ? presets.map((preset) => ({ preset_key: preset.preset_name, preset_name: preset.description }))
      : DEFAULT_PRESETS,
  })
})

admin.get('/get_dashboard_layout.php', async (c) => {
  const dashboardName = c.req.query('dashboard_name') ?? 'default_admin_view'
  const userId = Number(((c as { get(key: string): unknown }).get('user') as JwtPayload).sub)
  const layout = await queryOne<{ layout_json: string }>(
    `SELECT layout_json
     FROM dashboard_layouts
     WHERE user_id = $1 AND dashboard_name = $2
     LIMIT 1`,
    [userId, dashboardName]
  )

  return c.json({
    layout_json: layout?.layout_json ? JSON.parse(layout.layout_json) : DEFAULT_LAYOUT_JSON,
  })
})

admin.post('/save_dashboard_layout.php', async (c) => {
  const userId = Number(((c as { get(key: string): unknown }).get('user') as JwtPayload).sub)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const dashboardName = String(body.dashboard_name ?? 'default_admin_view')
  const layoutJson = body.layout_json ?? EMPTY_LAYOUT

  await query(
    `INSERT INTO dashboard_layouts (user_id, dashboard_name, layout_json)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, dashboard_name)
     DO UPDATE SET layout_json = $3`,
    [userId, dashboardName, JSON.stringify(layoutJson)]
  )

  return c.json({ success: true, layout_json: layoutJson })
})

admin.post('/reset_dashboard_layout.php', async (c) => {
  const userId = Number(((c as { get(key: string): unknown }).get('user') as JwtPayload).sub)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const dashboardName = String(body.dashboard_name ?? 'default_admin_view')

  await query(
    'DELETE FROM dashboard_layouts WHERE user_id = $1 AND dashboard_name = $2',
    [userId, dashboardName]
  )

  return c.json({ layout_json: EMPTY_LAYOUT })
})

admin.post('/load_dashboard_preset.php', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const presetName = String(body.preset_name ?? body.dashboard_name ?? 'default_admin_view')
  const preset = await queryOne<{ layout_json: string }>(
    'SELECT layout_json FROM dashboard_presets WHERE preset_name = $1 LIMIT 1',
    [presetName]
  )

  return c.json({
    layout_json: preset?.layout_json ? JSON.parse(preset.layout_json) : DEFAULT_LAYOUT_JSON,
  })
})

admin.post('/get_dashboard_data.php', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const widgetKeys = Array.isArray(body.widget_keys) ? body.widget_keys.map(String) : []
  const payload: Record<string, unknown> = {}

  if (widgetKeys.includes('total_learners')) {
    payload.total_learners = {
      metrics: await query(
        `SELECT * FROM (
           VALUES
             ('Total', (SELECT COUNT(*)::int FROM users WHERE role = 'learner')),
             ('Active', (SELECT COUNT(*)::int FROM users WHERE role = 'learner' AND status = 'active')),
             ('Pending', (SELECT COUNT(*)::int FROM users WHERE role = 'learner' AND status = 'pending')),
             ('Locked', (SELECT COUNT(*)::int FROM users WHERE role = 'learner' AND status = 'locked'))
         ) AS metrics(label, value)`
      ),
    }
  }
  if (widgetKeys.includes('new_signups')) {
    payload.new_signups = await queryOne(
      `SELECT
         COUNT(*) FILTER (WHERE role = 'learner' AND created_at >= NOW() - INTERVAL '7 days') AS current,
         COUNT(*) FILTER (WHERE role = 'learner' AND created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') AS previous,
         CASE
           WHEN COUNT(*) FILTER (WHERE role = 'learner' AND created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') = 0 THEN
             CASE WHEN COUNT(*) FILTER (WHERE role = 'learner' AND created_at >= NOW() - INTERVAL '7 days') > 0 THEN 100 ELSE 0 END
           ELSE
             (
               (
                 COUNT(*) FILTER (WHERE role = 'learner' AND created_at >= NOW() - INTERVAL '7 days')::numeric
                 - COUNT(*) FILTER (WHERE role = 'learner' AND created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::numeric
               )
               / COUNT(*) FILTER (WHERE role = 'learner' AND created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::numeric
             ) * 100
         END AS delta_pct
       FROM users`
    )
  }
  if (widgetKeys.includes('pending_service_agreements')) {
    payload.pending_service_agreements = {
      items: await query(
        `SELECT u.id AS user_id, u.name, u.ndis_number, u.status
         FROM users u
         WHERE u.role = 'learner' AND u.status IN ('pending', 'locked')
         ORDER BY u.created_at DESC
         LIMIT 8`
      ),
    }
  }
  if (widgetKeys.includes('learner_quick_search')) {
    payload.learner_quick_search = {
      items: await query(
        `SELECT id AS user_id, name, ndis_number
         FROM users
         WHERE role = 'learner'
         ORDER BY name
         LIMIT 200`
      ),
    }
  }
  if (widgetKeys.includes('recently_active_users')) {
    payload.recently_active_users = {
      items: await query(
        `SELECT u.id AS user_id, u.name, u.ndis_number,
                COALESCE(MAX(s.last_ping_at), MAX(s.login_at), u.created_at) AS last_active_at,
                COALESCE('/dashboard', '/dashboard') AS last_visited_page,
                CASE
                  WHEN COALESCE(MAX(s.last_ping_at), MAX(s.login_at)) IS NULL THEN 'No tracked activity'
                  ELSE CONCAT(
                    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(MAX(s.last_ping_at), MAX(s.login_at)))) / 3600))::int,
                    'h ago'
                  )
                END AS last_active_label
         FROM users u
         LEFT JOIN sessions s ON s.user_id = u.id
         WHERE u.role = 'learner'
         GROUP BY u.id, u.name, u.ndis_number, u.created_at
         ORDER BY COALESCE(MAX(s.last_ping_at), MAX(s.login_at), u.created_at) DESC
         LIMIT 8`
      ),
    }
  }
  if (widgetKeys.includes('draft_invoices')) {
    payload.draft_invoices = await queryOne(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_amount
       FROM invoices
       WHERE status = 'draft'`
    )
  }
  if (widgetKeys.includes('unpaid_invoices')) {
    payload.unpaid_invoices = await queryOne(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('unpaid', 'sent', 'overdue')) AS count,
         COUNT(*) FILTER (WHERE status = 'overdue' OR due_date < CURRENT_DATE) AS overdue_count,
         COALESCE(SUM(total_amount) FILTER (WHERE status IN ('unpaid', 'sent', 'overdue')), 0) AS total_amount
       FROM invoices`
    )
  }
  if (widgetKeys.includes('paid_invoices')) {
    payload.paid_invoices = await queryOne(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_amount
       FROM invoices
       WHERE status = 'paid'
         AND COALESCE(payment_date::date, paid_at::date, invoice_date) >= date_trunc('month', CURRENT_DATE)::date`
    )
  }
  if (widgetKeys.includes('quick_actions')) {
    payload.quick_actions = {
      actions: [
        { label: 'Review learners', route: '/admin', type: 'secondary' },
        { label: 'Open invoicing', route: '/admin/invoicing', type: 'secondary' },
        { label: 'Open dashboard', route: '/admin/dashboard', type: 'primary' },
      ],
    }
  }
  if (widgetKeys.includes('notes_reminders')) {
    payload.notes_reminders = {
      note: String(((body.widget_settings as Record<string, unknown> | undefined)?.notes_reminders as Record<string, unknown> | undefined)?.note ?? ''),
    }
  }

  if (widgetKeys.includes('learner_stats')) {
    payload.learner_stats = await queryOne(
      `SELECT
         COUNT(*) FILTER (WHERE role = 'learner') AS total_learners,
         COUNT(*) FILTER (WHERE role = 'learner' AND status = 'active') AS active_learners,
         COUNT(*) FILTER (WHERE role = 'learner' AND status = 'pending') AS pending_learners
       FROM users`
    )
  }
  if (widgetKeys.includes('invoice_summary')) {
    payload.invoice_summary = await queryOne(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
         COUNT(*) FILTER (WHERE status = 'unpaid') AS unpaid_count,
         COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) AS total_paid
       FROM invoices`
    )
  }

  return c.json({ data: payload })
})

// ─── GET /api/admin/participants ─────────────────────────────────────────────
admin.get('/participants', async (c) => {
  const users = await query(
    `SELECT u.id, u.name, u.email, u.ndis_number, u.status, u.points, u.created_at,
            up.total_points, up.current_rank, up.current_streak_days,
            up.total_lessons_completed, up.total_active_minutes,
            lp.sensory_mode, lp.coach_enabled
     FROM users u
     LEFT JOIN user_points up ON up.user_id = u.id
     LEFT JOIN learner_profiles lp ON lp.user_id = u.id
     WHERE u.role = 'learner'
     ORDER BY u.created_at DESC`
  )
  return c.json({ success: true, participants: users })
})

// ─── GET /api/admin/participants/:id ─────────────────────────────────────────
admin.get('/participants/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [user, points, profile, mastery] = await Promise.all([
    queryOne(
      'SELECT id, name, email, ndis_number, status, points, created_at, profile_image_url, about_me FROM users WHERE id = $1',
      [id]
    ),
    queryOne('SELECT * FROM user_points WHERE user_id = $1', [id]),
    queryOne('SELECT * FROM learner_profiles WHERE user_id = $1', [id]),
    query(
      `SELECT cm.*, c.title AS chapter_title, c.emoji
       FROM chapter_mastery cm JOIN chapters c ON c.id = cm.chapter_id
       WHERE cm.user_id = $1`,
      [id]
    ),
  ])
  if (!user) return c.json({ error: 'User not found' }, 404)
  return c.json({ success: true, user, points, profile, chapter_mastery: mastery })
})

// ─── PATCH /api/admin/participants/:id/status ────────────────────────────────
admin.patch('/participants/:id/status', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const status = String(body.status ?? '')
  if (!['locked', 'pending', 'active'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }
  await query('UPDATE users SET status = $1 WHERE id = $2', [status, id])
  return c.json({ success: true })
})

// ─── GET /api/admin/time-summary ─────────────────────────────────────────────
admin.get('/time-summary', async (c) => {
  const userId = c.req.query('user_id') ? Number(c.req.query('user_id')) : null
  const start = c.req.query('start') ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  const end = c.req.query('end') ?? new Date().toISOString().slice(0, 10)

  const filter = userId ? 'AND al.user_id = $3' : ''
  const params = userId ? [start, end, userId] : [start, end]

  const [totals, byUser] = await Promise.all([
    queryOne(
      `SELECT COALESCE(SUM(seconds_active), 0) AS total_seconds,
              COUNT(DISTINCT user_id) AS users_active
       FROM activity_log al
       WHERE activity_date BETWEEN $1 AND $2 ${filter}`,
      params
    ),
    query(
      `SELECT al.user_id, u.name, u.ndis_number,
              SUM(al.seconds_active) AS total_seconds,
              COUNT(DISTINCT al.activity_date) AS days_active
       FROM activity_log al JOIN users u ON u.id = al.user_id
       WHERE al.activity_date BETWEEN $1 AND $2 ${filter}
       GROUP BY al.user_id, u.name, u.ndis_number
       ORDER BY total_seconds DESC`,
      params
    ),
  ])

  return c.json({ success: true, totals, by_user: byUser, range: { start, end } })
})

// ─── GET /api/admin/invoices ──────────────────────────────────────────────────
admin.get('/invoices', async (c) => {
  const status = c.req.query('status')
  const filter = status ? 'WHERE status = $1' : ''
  const params = status ? [status] : []
  const invoices = await query(
    `SELECT i.*, u.name AS participant_name_from_user
     FROM invoices i LEFT JOIN users u ON u.id = i.user_id
     ${filter} ORDER BY i.created_at DESC`,
    params
  )
  return c.json({ success: true, invoices })
})

// ─── GET /api/admin/invoices/:id ─────────────────────────────────────────────
admin.get('/invoices/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [invoice, items, logSources] = await Promise.all([
    queryOne('SELECT * FROM invoices WHERE id = $1', [id]),
    query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id', [id]),
    query('SELECT * FROM invoice_log_sources WHERE invoice_id = $1', [id]),
  ])
  if (!invoice) return c.json({ error: 'Invoice not found' }, 404)
  return c.json({ success: true, invoice, items, log_sources: logSources })
})

// ─── POST /api/admin/invoices/generate-draft ─────────────────────────────────
admin.post('/invoices/generate-draft', async (c) => {
  const adminId = Number(((c as { get(key: string): unknown }).get('user') as JwtPayload).sub)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const userId = Number(body.user_id)
  const dateFrom = String(body.date_from ?? '')
  const dateTo = String(body.date_to ?? '')
  if (!userId || !dateFrom || !dateTo) {
    return c.json({ error: 'user_id, date_from, date_to required' }, 400)
  }

  const participant = await queryOne<{ name: string; ndis_number: string }>(
    'SELECT name, ndis_number FROM users WHERE id = $1',
    [userId]
  )
  if (!participant) return c.json({ error: 'Participant not found' }, 404)

  const settings = await queryOne<{
    id: number; company_name: string; abn: string; address: string; phone: string;
    email: string; bsb: string; bank_account_number: string; account_name: string;
    invoice_prefix: string; default_due_days: number; default_hourly_rate: number;
    default_line_item_code: string; default_line_item_description: string;
    payment_instruction_code: string;
  }>('SELECT * FROM company_settings ORDER BY id LIMIT 1')
  if (!settings) return c.json({ error: 'Company settings not configured' }, 400)

  // Calculate total time
  const timeSummary = await queryOne<{ total_seconds: number }>(
    `SELECT COALESCE(SUM(te.seconds_active), 0) AS total_seconds
     FROM time_entries te
     WHERE te.user_id = $1 AND te.date_key BETWEEN $2 AND $3`,
    [userId, dateFrom, dateTo]
  )
  const totalSeconds = Number(timeSummary?.total_seconds ?? 0)
  const totalHours = Math.round((totalSeconds / 3600) * 100) / 100
  const amount = Math.round(totalHours * Number(settings.default_hourly_rate) * 100) / 100

  // Generate invoice number
  const periodKey = new Date().toISOString().slice(0, 7).replace('-', '')
  const sequence = await withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO invoice_sequences (invoice_prefix, period_key, last_serial)
       VALUES ($1, $2, 1)
       ON CONFLICT (invoice_prefix, period_key)
       DO UPDATE SET last_serial = invoice_sequences.last_serial + 1
       RETURNING last_serial`,
      [settings.invoice_prefix, periodKey]
    )
    return res.rows[0].last_serial
  })
  const invoiceNumber = `${settings.invoice_prefix}-${periodKey}-${String(sequence).padStart(4, '0')}`

  const today = new Date().toISOString().slice(0, 10)
  const dueDate = new Date(Date.now() + settings.default_due_days * 864e5).toISOString().slice(0, 10)

  const invoiceRows = await query<{ id: number }>(
    `INSERT INTO invoices (
       invoice_number, user_id, participant_name, participant_ndis_number,
       company_settings_id, invoice_date, due_date, date_from, date_to,
       status, total_hours, total_seconds_raw, subtotal, total, total_amount,
       created_by_admin_id,
       company_name_snapshot, company_abn_snapshot, company_address_snapshot,
       company_phone_snapshot, company_email_snapshot, company_bsb_snapshot,
       company_bank_account_snapshot, company_account_name_snapshot,
       payment_instruction_code
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     RETURNING id`,
    [
      invoiceNumber, userId, participant.name, participant.ndis_number,
      settings.id, today, dueDate, dateFrom, dateTo,
      totalHours, totalSeconds, amount, amount, amount,
      adminId,
      settings.company_name, settings.abn, settings.address,
      settings.phone, settings.email, settings.bsb,
      settings.bank_account_number, settings.account_name,
      settings.payment_instruction_code,
    ]
  )
  const invoiceId = invoiceRows[0].id

  // Create line item
  await query(
    `INSERT INTO invoice_items
       (invoice_id, service_date_from, service_date_to, line_item_code, line_item_description, quantity_hours, rate, amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [invoiceId, dateFrom, dateTo, settings.default_line_item_code,
      settings.default_line_item_description, totalHours, settings.default_hourly_rate, amount]
  )

  // Log sources
  await query(
    `INSERT INTO invoice_log_sources (invoice_id, user_id, source_start_date, source_end_date, total_seconds_included)
     VALUES ($1, $2, $3, $4, $5)`,
    [invoiceId, userId, dateFrom, dateTo, totalSeconds]
  )

  return c.json({ success: true, invoice_id: invoiceId, invoice_number: invoiceNumber })
})

// ─── PATCH /api/admin/invoices/:id/status ────────────────────────────────────
admin.patch('/invoices/:id/status', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const status = String(body.status ?? '')
  if (!['draft', 'unpaid', 'paid', 'sent', 'overdue'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }
  const extra = status === 'paid'
    ? ', paid_at = NOW(), payment_date = NOW(), payment_reference = $3'
    : ''
  const params = status === 'paid'
    ? [status, id, body.payment_reference ?? null]
    : [status, id]
  await query(`UPDATE invoices SET status = $1 ${extra} WHERE id = $2`, params)
  return c.json({ success: true })
})

// ─── GET /api/admin/company-settings ─────────────────────────────────────────
admin.get('/company-settings', async (c) => {
  const settings = await queryOne('SELECT * FROM company_settings ORDER BY id LIMIT 1')
  return c.json({ success: true, settings })
})

// ─── POST /api/admin/company-settings ────────────────────────────────────────
admin.post('/company-settings', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const existing = await queryOne<{ id: number }>('SELECT id FROM company_settings LIMIT 1')

  const fields = [
    'company_name', 'abn', 'address', 'phone', 'email', 'bsb', 'bank_account_number',
    'account_name', 'invoice_prefix', 'default_due_days', 'default_hourly_rate',
    'default_line_item_code', 'default_line_item_description', 'payment_instruction_code',
  ]
  const provided = fields.filter((f) => f in body)

  if (existing) {
    const setClauses = provided.map((f, i) => `${f} = $${i + 2}`).join(', ')
    await query(
      `UPDATE company_settings SET ${setClauses} WHERE id = $1`,
      [existing.id, ...provided.map((f) => body[f])]
    )
  } else {
    const cols = provided.join(', ')
    const placeholders = provided.map((_, i) => `$${i + 1}`).join(', ')
    await query(
      `INSERT INTO company_settings (${cols}) VALUES (${placeholders})`,
      provided.map((f) => body[f])
    )
  }

  return c.json({ success: true })
})

// ─── GET /api/admin/dashboard-data ───────────────────────────────────────────
admin.get('/dashboard-data', async (c) => {
  const [userStats, recentActivity, invoiceSummary] = await Promise.all([
    queryOne(
      `SELECT
         COUNT(*) FILTER (WHERE role = 'learner') AS total_learners,
         COUNT(*) FILTER (WHERE role = 'learner' AND status = 'active') AS active_learners,
         COUNT(*) FILTER (WHERE role = 'learner' AND status = 'pending') AS pending_learners,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_this_week
       FROM users`
    ),
    query(
      `SELECT u.name, al.activity_date, al.seconds_active
       FROM activity_log al JOIN users u ON u.id = al.user_id
       WHERE al.activity_date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY al.activity_date DESC, al.seconds_active DESC LIMIT 20`
    ),
    queryOne(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
         COUNT(*) FILTER (WHERE status = 'unpaid') AS unpaid_count,
         COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) AS total_paid
       FROM invoices`
    ),
  ])

  return c.json({ success: true, user_stats: userStats, recent_activity: recentActivity, invoice_summary: invoiceSummary })
})

// ─── GET /api/admin/coach-events ─────────────────────────────────────────────
admin.get('/coach-events', async (c) => {
  const userId = c.req.query('user_id') ? Number(c.req.query('user_id')) : null
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)
  const filter = userId ? 'WHERE ce.user_id = $2' : ''
  const params = userId ? [limit, userId] : [limit]

  const events = await query(
    `SELECT ce.*, u.name AS user_name
     FROM coach_events ce JOIN users u ON u.id = ce.user_id
     ${filter}
     ORDER BY ce.created_at DESC LIMIT $1`,
    params
  )
  return c.json({ success: true, events })
})

admin.get('/get_time_summary.php', async (c) => {
  const userId = Number(c.req.query('user_id'))
  if (!userId) {
    return c.json({ error: 'user_id required' }, 400)
  }

  const start = c.req.query('start') ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  const end = c.req.query('end') ?? new Date().toISOString().slice(0, 10)
  return c.json(await buildLegacyTimeSummary(userId, start, end))
})

admin.get('/participant_stage.php', async (c) => {
  const userId = Number(c.req.query('id'))
  if (!userId) {
    return c.json({ error: 'id required' }, 400)
  }

  const [user, agreement] = await Promise.all([
    queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [userId]),
    queryOne<Record<string, unknown>>(
      'SELECT * FROM service_agreements WHERE user_id = $1 ORDER BY signed_at DESC LIMIT 1',
      [userId]
    ),
  ])

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  const blockers: string[] = []
  if (!agreement) blockers.push('Service agreement not signed')
  if (user.status !== 'active' && user.status !== 'pending') blockers.push('Account approval still required')

  return c.json({
    id: user.id,
    name: user.name,
    full_name: user.name,
    ndis_number: user.ndis_number,
    stage: toLegacyStage(String(user.status ?? ''), Boolean(agreement)),
    blockers,
  })
})

admin.get('/crm/master_edit.php', async (c) => {
  const action = c.req.query('action')
  if (action !== 'read') {
    return c.json({ error: 'Unsupported action' }, 400)
  }

  const participantId = Number(c.req.query('participant_id'))
  if (!participantId) {
    return c.json({ error: 'participant_id required' }, 400)
  }

  const [user, agreement, sessions] = await Promise.all([
    queryOne<Record<string, unknown>>('SELECT * FROM users WHERE id = $1', [participantId]),
    queryOne<Record<string, unknown>>(
      'SELECT * FROM service_agreements WHERE user_id = $1 ORDER BY signed_at DESC LIMIT 1',
      [participantId]
    ),
    query(
      `SELECT id, login_at, logout_at, total_seconds_active, status
       FROM sessions
       WHERE user_id = $1
       ORDER BY login_at DESC
       LIMIT 20`,
      [participantId]
    ),
  ])

  if (!user) {
    return c.json({ success: false, error: 'Participant not found' }, 404)
  }

  return c.json({
    success: true,
    participant: {
      id: user.id,
      user_id: user.id,
      full_name: agreement?.full_name ?? user.name,
      name: user.name,
      email: user.email,
      ndis_number: agreement?.ndis_number ?? user.ndis_number,
      stage: toLegacyStage(String(user.status ?? ''), Boolean(agreement)),
      risk_flag: 0,
    },
    plans: agreement ? [{
      id: agreement.id,
      participant_id: user.id,
      start_date: agreement.plan_start_date,
      end_date: agreement.plan_end_date,
      line_items: [],
    }] : [],
    login_sessions: sessions,
  })
})

admin.post('/crm/master_edit.php', async (c) => {
  const action = c.req.query('action')
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  if (action === 'update_participant') {
    const id = Number(body.id)
    if (!id) return c.json({ error: 'id required' }, 400)

    if (body.full_name || body.name) {
      await query('UPDATE users SET name = $1 WHERE id = $2', [body.full_name ?? body.name, id])
    }
    if (body.stage) {
      const stage = String(body.stage)
      const status = stage === 'active' ? 'active' : stage === 'claim_ready' ? 'pending' : 'locked'
      await query('UPDATE users SET status = $1 WHERE id = $2', [status, id])
    }

    return c.json({ success: true })
  }

  if (action === 'save_plan') {
    const participantId = Number(body.participant_id)
    if (!participantId) return c.json({ error: 'participant_id required' }, 400)

    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM service_agreements WHERE user_id = $1 ORDER BY signed_at DESC LIMIT 1',
      [participantId]
    )

    if (existing) {
      await query(
        'UPDATE service_agreements SET plan_start_date = $1, plan_end_date = $2 WHERE id = $3',
        [body.start_date ?? null, body.end_date ?? null, existing.id]
      )
    } else {
      await query(
        `INSERT INTO service_agreements (user_id, plan_start_date, plan_end_date)
         VALUES ($1, $2, $3)`,
        [participantId, body.start_date ?? null, body.end_date ?? null]
      )
    }

    return c.json({ success: true })
  }

  return c.json({ error: 'Unsupported action' }, 400)
})

admin.get('/company_settings.php', async (c) => {
  const settings = await getCompanySettingsRecord()
  return c.json({ success: true, settings })
})

admin.post('/company_settings.php', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const existing = await queryOne<{ id: number }>('SELECT id FROM company_settings LIMIT 1')
  const fields = [
    'company_name', 'logo_path', 'abn', 'address', 'phone', 'email', 'bsb', 'bank_account_number',
    'account_name', 'invoice_prefix', 'default_due_days', 'default_hourly_rate',
    'default_line_item_code', 'default_line_item_description', 'payment_instruction_code',
  ]
  const provided = fields.filter((field) => field in body)

  if (existing && provided.length > 0) {
    const setClauses = provided.map((field, index) => `${field} = $${index + 2}`).join(', ')
    await query(
      `UPDATE company_settings SET ${setClauses} WHERE id = $1`,
      [existing.id, ...provided.map((field) => body[field])]
    )
  } else if (!existing && provided.length > 0) {
    await query(
      `INSERT INTO company_settings (${provided.join(', ')})
       VALUES (${provided.map((_, index) => `$${index + 1}`).join(', ')})`,
      provided.map((field) => body[field])
    )
  }

  return c.json({ success: true, settings: await getCompanySettingsRecord() })
})

admin.post('/upload_company_logo.php', async (c) => {
  const body = await c.req.parseBody().catch(() => null)
  const upload = await readUploadAsDataUrl(
    body?.logo instanceof File ? body.logo : null,
    ['image/png', 'image/jpeg', 'image/webp'],
    2 * 1024 * 1024
  )
  if ('error' in upload) {
    return c.json({ error: upload.error }, 400)
  }

  const existing = await queryOne<{ id: number }>('SELECT id FROM company_settings LIMIT 1')
  if (existing) {
    await query('UPDATE company_settings SET logo_path = $1 WHERE id = $2', [upload.dataUrl, existing.id])
  } else {
    await query(
      `INSERT INTO company_settings (
         company_name, logo_path, abn, bsb, bank_account_number
       ) VALUES ($1, $2, $3, $4, $5)`,
      ['Goodwill Care Academy', upload.dataUrl, '00000000000', '000-000', '00000000']
    )
  }

  return c.json({ success: true, settings: await getCompanySettingsRecord() })
})

admin.get('/invoice_eligible_users.php', async (c) => {
  const users = await query(
    `SELECT id, name, ndis_number, status
     FROM users
     WHERE role = 'learner'
     ORDER BY name`
  )
  return c.json({ success: true, users })
})

admin.get('/get_invoices.php', async (c) => {
  const status = String(c.req.query('status') ?? 'all')
  const filter = status !== 'all' ? 'WHERE status = $1' : ''
  const params = status !== 'all' ? [status] : []
  const invoices = await query(
    `SELECT id, invoice_number, participant_name, invoice_date, due_date, status,
            total, total_amount, paid_at
     FROM invoices
     ${filter}
     ORDER BY invoice_date DESC`,
    params
  )
  return c.json({ success: true, invoices })
})

admin.get('/get_invoice_detail.php', async (c) => {
  const id = Number(c.req.query('id'))
  if (!id) return c.json({ error: 'id required' }, 400)

  const [invoice, items] = await Promise.all([
    queryOne('SELECT * FROM invoices WHERE id = $1', [id]),
    query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id', [id]),
  ])
  if (!invoice) return c.json({ error: 'Invoice not found' }, 404)
  return c.json({ success: true, invoice, items })
})

admin.post('/generate_draft_invoices.php', async (c) => {
  const adminId = Number(((c as { get(key: string): unknown }).get('user') as JwtPayload).sub)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const userIds = Array.isArray(body.user_ids) ? body.user_ids.map(Number).filter(Boolean) : []
  const dateFrom = String(body.date_from ?? '')
  const dateTo = String(body.date_to ?? '')
  const previewOnly = body.preview_only === true

  if (userIds.length === 0 || !dateFrom || !dateTo) {
    return c.json({ error: 'user_ids, date_from and date_to required' }, 400)
  }

  const settings = await getCompanySettingsRecord()
  if (!settings) {
    return c.json({ error: 'Company settings not configured' }, 400)
  }

  const preview = await buildInvoicePreview(userIds, dateFrom, dateTo, Number(settings.default_hourly_rate ?? 50))
  if (previewOnly) {
    return c.json({ success: true, preview })
  }

  const created: Array<{ invoice_id: number; invoice_number: string; user_id: number }> = []
  const today = new Date().toISOString().slice(0, 10)
  const dueDate = new Date(Date.now() + Number(settings.default_due_days ?? 7) * 864e5).toISOString().slice(0, 10)

  for (const row of preview) {
    const invoiceNumber = await nextInvoiceNumber(String(settings.invoice_prefix ?? 'INV'))
    const invoiceRows = await query<{ id: number }>(
      `INSERT INTO invoices (
         invoice_number, user_id, participant_name, participant_ndis_number,
         company_settings_id, invoice_date, due_date, date_from, date_to,
         status, total_hours, total_seconds_raw, subtotal, total, total_amount,
         created_by_admin_id,
         company_name_snapshot, company_abn_snapshot, company_address_snapshot,
         company_phone_snapshot, company_email_snapshot, company_bsb_snapshot,
         company_bank_account_snapshot, company_account_name_snapshot,
         payment_instruction_code
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING id`,
      [
        invoiceNumber, row.user_id, row.participant_name, row.participant_ndis_number,
        settings.id, today, dueDate, dateFrom, dateTo,
        row.total_hours, row.total_seconds, row.amount, row.amount, row.amount,
        adminId,
        settings.company_name, settings.abn, settings.address,
        settings.phone, settings.email, settings.bsb,
        settings.bank_account_number, settings.account_name,
        settings.payment_instruction_code,
      ]
    )
    const invoiceId = invoiceRows[0].id

    await query(
      `INSERT INTO invoice_items
         (invoice_id, service_date_from, service_date_to, line_item_code, line_item_description, quantity_hours, rate, amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        invoiceId,
        dateFrom,
        dateTo,
        settings.default_line_item_code,
        settings.default_line_item_description,
        row.total_hours,
        settings.default_hourly_rate,
        row.amount,
      ]
    )

    created.push({ invoice_id: invoiceId, invoice_number: invoiceNumber, user_id: row.user_id })
  }

  return c.json({ success: true, preview, created })
})

admin.post('/update_invoice.php', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const invoiceId = Number(body.invoice_id)
  if (!invoiceId) return c.json({ error: 'invoice_id required' }, 400)

  const invoice = body
  await query(
    `UPDATE invoices
     SET invoice_number = $1, invoice_date = $2, due_date = $3, participant_name = $4, notes = $5
     WHERE id = $6`,
    [
      invoice.invoice_number ?? null,
      invoice.invoice_date ?? null,
      invoice.due_date ?? null,
      invoice.participant_name ?? null,
      invoice.notes ?? null,
      invoiceId,
    ]
  )

  if (Array.isArray(body.items)) {
    for (const item of body.items as Array<Record<string, unknown>>) {
      if (!item.id) continue
      await query(
        `UPDATE invoice_items
         SET line_item_code = $1, line_item_description = $2, quantity_hours = $3, rate = $4, amount = $5
         WHERE id = $6 AND invoice_id = $7`,
        [
          item.line_item_code ?? null,
          item.line_item_description ?? null,
          item.quantity_hours ?? 0,
          item.rate ?? 0,
          item.amount ?? 0,
          item.id,
          invoiceId,
        ]
      )
    }
  }

  return c.json({ success: true })
})

admin.post('/change_invoice_status.php', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const invoiceId = Number(body.invoice_id)
  const targetStatus = String(body.target_status ?? '')
  if (!invoiceId || !['draft', 'unpaid', 'paid', 'sent', 'overdue'].includes(targetStatus)) {
    return c.json({ error: 'Invalid invoice_id or target_status' }, 400)
  }

  await query(
    `UPDATE invoices
     SET status = $1,
         paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END,
         payment_date = CASE WHEN $1 = 'paid' THEN NOW() ELSE payment_date END
     WHERE id = $2`,
    [targetStatus, invoiceId]
  )

  return c.json({ success: true })
})

admin.post('/generate_invoice_pdf.php', async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const invoiceId = Number(body.invoice_id)
  if (!invoiceId) return c.json({ error: 'invoice_id required' }, 400)

  const pdfPath = `/api/admin/download_invoice.php?id=${invoiceId}`
  await query('UPDATE invoices SET pdf_path = $1 WHERE id = $2', [pdfPath, invoiceId])
  return c.json({ success: true, pdf_path: pdfPath })
})

admin.get('/download_invoice.php', async (c) => {
  const invoiceId = Number(c.req.query('id'))
  if (!invoiceId) {
    return c.text('Missing invoice id', 400)
  }

  const invoice = await queryOne<Record<string, unknown>>('SELECT * FROM invoices WHERE id = $1', [invoiceId])
  if (!invoice) {
    return c.text('Invoice not found', 404)
  }

  return c.text(
    `Invoice ${invoice.invoice_number}\nParticipant: ${invoice.participant_name}\nStatus: ${invoice.status}\nTotal: ${invoice.total_amount}\n`,
    200,
    { 'Content-Type': 'text/plain; charset=utf-8' }
  )
})

admin.get('/get_user_invoices.php', async (c) => {
  const userId = Number(c.req.query('user_id'))
  const status = String(c.req.query('status') ?? 'all')
  if (!userId) return c.json({ error: 'user_id required' }, 400)

  const filter = status !== 'all' ? 'AND status = $2' : ''
  const params = status !== 'all' ? [userId, status] : [userId]
  const invoices = await query(
    `SELECT id, invoice_number, invoice_date, status, total, total_amount
     FROM invoices
     WHERE user_id = $1 ${filter}
     ORDER BY invoice_date DESC`,
    params
  )
  return c.json({ success: true, invoices })
})

admin.get('/get_coach_events.php', async (c) => {
  const userId = Number(c.req.query('user_id'))
  const limit = Math.min(Number(c.req.query('limit') ?? 30), 200)
  if (!userId) return c.json({ error: 'user_id required' }, 400)

  const [state, events] = await Promise.all([
    queryOne('SELECT * FROM coach_state WHERE user_id = $1', [userId]),
    query(
      `SELECT * FROM coach_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    ),
  ])
  return c.json({ state, events })
})

export default admin
