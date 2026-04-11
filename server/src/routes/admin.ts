import { Hono } from 'hono'
import { requireAuth, requireAdmin } from '../middleware.js'
import { query, queryOne, withTransaction } from '../db.js'
import type { JwtPayload } from '../middleware.js'

const admin = new Hono()
admin.use('*', requireAuth, requireAdmin)

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
  const adminId = Number((c.get('user') as JwtPayload).sub)
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

export default admin
