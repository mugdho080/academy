import { createMiddleware } from 'hono/factory'
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'change-me-in-production'
)

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
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET)
  return payload as unknown as JwtPayload
}

/** Middleware: require valid JWT. Attaches user to c.var.user */
export const requireAuth = createMiddleware(async (c, next) => {
  const auth = c.req.header('Authorization')
  // Also support ?token= query param for sendBeacon compatibility
  const token = auth?.startsWith('Bearer ')
    ? auth.slice(7)
    : (c.req.query('token') ?? null)

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
