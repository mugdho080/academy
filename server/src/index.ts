import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { getDatabaseStatus, initializeDatabase, isDatabaseConfigError } from './db.js'
import { getStartupDiagnostics, MissingEnvError } from './env.js'
import auth from './routes/auth.js'
import learner from './routes/learner.js'
import admin from './routes/admin.js'
import ai from './routes/ai.js'

const app = new Hono()
const frontendOrigin = process.env.FRONTEND_URL
const startupDiagnostics = getStartupDiagnostics()

console.log('Startup diagnostics:', startupDiagnostics)

app.use('*', cors({
  origin: frontendOrigin ?? '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: Boolean(frontendOrigin),
}))

app.use('*', logger())

app.route('/api/auth', auth)
app.route('/api/learner', learner)
app.route('/api/admin', admin)
app.route('/api/ai', ai)

app.get('/api/health', (c) => c.json({
  status: getDatabaseStatus() === 'configured' ? 'ok' : 'degraded',
  timestamp: new Date().toISOString(),
  diagnostics: startupDiagnostics,
}))

if (process.env.NODE_ENV === 'production') {
  const serveFrontendIndex = serveStatic({ path: './dist/index.html' })
  app.use('/assets/*', serveStatic({ root: './dist' }))
  app.use('/ai_panda.png', serveStatic({ root: './dist' }))
  app.use('/gemini-recorder.worklet.js', serveStatic({ root: './dist' }))

  app.get('/*', (c, next) => {
    if (c.req.path.startsWith('/api/') || c.req.path.includes('.')) {
      return next()
    }
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate')
    return serveFrontendIndex(c, next)
  })
}

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  if (err instanceof MissingEnvError) {
    console.error(`Configuration error: missing ${err.variable}`, {
      nodeEnv: startupDiagnostics.nodeEnv,
      runningInRailway: startupDiagnostics.runningInRailway,
    })
    return c.json({
      error: 'Server configuration error',
      missing_env: err.variable,
    }, 503)
  }

  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

const port = Number(process.env.PORT ?? 3001)

async function startServer() {
  try {
    await initializeDatabase()
    console.log('Database connection established')
  } catch (err) {
    if (isDatabaseConfigError(err)) {
      console.error('Database configuration missing at startup', {
        missingEnv: 'DATABASE_URL',
        nodeEnv: startupDiagnostics.nodeEnv,
        runningInRailway: startupDiagnostics.runningInRailway,
      })
    } else {
      console.error('Database initialization failed; starting in degraded mode', err)
    }
  }

  serve({ fetch: app.fetch, port }, () => {
    console.log(`Academy API running on port ${port}`)
  })
}

void startServer()

export default app
