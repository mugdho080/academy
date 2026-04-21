import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '../db.js'
import { isMissingEnvError } from '../env.js'
import { signToken } from '../middleware.js'

const auth = new Hono()

let userProfileColumnsPromise: Promise<{ hasProfileImageUrl: boolean; hasAboutMe: boolean }> | null = null

async function getUserProfileColumns() {
  if (!userProfileColumnsPromise) {
    userProfileColumnsPromise = (async () => {
      const rows = await query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'users'
           AND column_name IN ('profile_image_url', 'about_me')`
      ).catch(() => [])

      const names = new Set(rows.map((row) => String(row.column_name)))
      return {
        hasProfileImageUrl: names.has('profile_image_url'),
        hasAboutMe: names.has('about_me'),
      }
    })()
  }

  return userProfileColumnsPromise
}

async function selectUserForSession(id: number) {
  const columns = await getUserProfileColumns()
  const optionalFields = [
    columns.hasProfileImageUrl ? 'profile_image_url' : 'NULL::text AS profile_image_url',
    columns.hasAboutMe ? 'about_me' : 'NULL::text AS about_me',
  ]

  return queryOne(
    `SELECT id, name, email, ndis_number, role, status, points, ${optionalFields.join(', ')}
     FROM users
     WHERE id = $1`,
    [id]
  )
}

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.identifier || !body?.password) {
    return c.json({ error: 'Email/NDIS and password required' }, 400)
  }

  const user = await queryOne<{
    id: number; name: string; email: string; ndis_number: string;
    password_hash: string; role: string; status: string; points: number;
    profile_image_url?: string; about_me?: string;
  }>(
    'SELECT * FROM users WHERE email = $1 OR ndis_number = $1',
    [body.identifier]
  )

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  // PHP used $2y$ prefix, Node bcryptjs treats it as $2b$ — both valid
  const hash = user.password_hash.replace(/^\$2y\$/, '$2b$')
  const valid = await bcrypt.compare(body.password, hash)
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const token = await signToken({
    sub: String(user.id),
    role: user.role,
    name: user.name,
    email: user.email,
  })

  return c.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      ndis_number: user.ndis_number,
      role: user.role,
      status: user.status,
      points: user.points ?? 0,
      profile_image_url: user.profile_image_url ?? null,
      about_me: user.about_me ?? null,
    },
  })
})

// POST /api/auth/signup
auth.post('/signup', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body?.name || !body?.email || !body?.ndis_number || !body?.password) {
    return c.json({ error: 'All fields are required' }, 400)
  }

  const passwordHash = await bcrypt.hash(body.password, 12)

  try {
    const rows = await query<{ id: number }>(
      `INSERT INTO users (name, email, ndis_number, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'learner', 'locked')
       RETURNING id`,
      [body.name, body.email, body.ndis_number, passwordHash]
    )
    const userId = rows[0].id

    // Create learner profile defaults
    await query(
      `INSERT INTO learner_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    )
    await query(
      `INSERT INTO user_points (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    )

    return c.json({ success: true, message: 'Account created. Please wait for approval.' })
  } catch (err: unknown) {
    if (isMissingEnvError(err)) {
      throw err
    }
    const pg = err as { code?: string }
    if (pg.code === '23505') {
      return c.json({ error: 'Email or NDIS number already exists' }, 409)
    }
    console.error('Signup error:', err)
    return c.json({ error: 'Registration failed' }, 500)
  }
})

// GET /api/auth/me  (validate existing token)
auth.get('/me', async (c) => {
  const auth = c.req.header('Authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return c.json({ error: 'No token' }, 401)

  try {
    const { verifyToken } = await import('../middleware.js')
    const payload = await verifyToken(token)
    const user = await selectUserForSession(Number(payload.sub))
    if (!user) return c.json({ error: 'User not found' }, 404)
    return c.json({ success: true, user })
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }
})

auth.post('/logout', async (c) => {
  return c.json({ success: true })
})

export default auth
