import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import auth from './routes/auth.js'
import learner from './routes/learner.js'
import admin from './routes/admin.js'
import ai from './routes/ai.js'

const app = new Hono()

// ─── Global middleware ────────────────────────────────────────────────────────
app.use('*', cors({
  origin: process.env.FRONTEND_URL ?? '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

app.use('*', logger())

// ─── Routes ──────────────────────────────────────────────────────────────────
app.route('/api/auth', auth)
app.route('/api/learner', learner)
app.route('/api/admin', admin)
app.route('/api/ai', ai)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Serve React frontend in production (built to ../dist)
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }))
  // SPA fallback — serve index.html for all non-API routes
  app.get('/*', serveStatic({ path: './dist/index.html' }))
}

// 404 fallback (dev only)
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

// ─── Start ───────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 3001)

serve({ fetch: app.fetch, port }, () => {
  console.log(`🚀 Academy API running on port ${port}`)
})

export default app
