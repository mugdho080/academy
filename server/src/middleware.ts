import { createMiddleware } from 'hono/factory'
import { SignJWT, jwtVerify } from 'jose'
import { requireEnv } from './env.js'

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(requireEnv('JWT_SECRET'))
}

export interface JwtPayload {
  sub: string       // user id as string
  role: string
  name: string
  email: string
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret())
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret())
  return payload as unknown as JwtPayload
}

/**
 * Endpoints where the access token may be supplied as a `?token=` query param.
 *
 * This fallback exists only because two browser APIs cannot send custom
 * headers: `navigator.sendBeacon` (for fire-and-forget telemetry on
 * page-hide) and `window.open` (for file downloads that need to render in
 * a new browser tab).
 *
 * Restricting the allowlist keeps the access token out of access logs,
 * browser history, and `Referer` headers for every other endpoint. This is
 * a transitional control — Sprint 2 will replace the query-token fallback
 * with short-lived one-time nonces.
 *
 * `startsWith` matches are used for download endpoints that take a
 * resource id in the path/query.
 */
const QUERY_TOKEN_EXACT_PATHS = new Set<string>([
  '/api/learner/log-delta',
  '/api/index.php/learner/log-delta',
])

const QUERY_TOKEN_PREFIX_PATHS: ReadonlyArray<string> = [
  '/api/ai/log_coach_event.php',
  '/api/index.php/learner/ping_session',
  '/api/learner/ping_session',
  '/api/learner/download_invoice.php',
  '/api/index.php/learner/download_invoice.php',
  '/api/admin/download_invoice.php',
  '/api/index.php/admin/download_invoice.php',
]

function isQueryTokenAllowed(path: string): boolean {
  if (QUERY_TOKEN_EXACT_PATHS.has(path)) {
    return true
  }
  return QUERY_TOKEN_PREFIX_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}/`))
}

/** Middleware: require valid JWT. Attaches user to c.var.user */
export const requireAuth = createMiddleware(async (c, next) => {
  const auth = c.req.header('Authorization')
  const headerToken = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const queryToken = isQueryTokenAllowed(c.req.path) ? c.req.query('token') ?? null : null
  const token = headerToken ?? queryToken

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const user = await verifyToken(token)
    c.set('user', user)
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
})

/** Middleware: require admin role */
export const requireAdmin = createMiddleware(async (c, next) => {
  const user = c.get('user') as JwtPayload | undefined
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})
