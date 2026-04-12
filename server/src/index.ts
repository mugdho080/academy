import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDatabaseStatus, initializeDatabase, isDatabaseConfigError } from './db.js'
import { getStartupDiagnostics, MissingEnvError } from './env.js'
import auth from './routes/auth.js'
import learner from './routes/learner.js'
import admin from './routes/admin.js'
import ai from './routes/ai.js'

const app = new Hono()
const frontendOrigin = process.env.FRONTEND_URL
const startupDiagnostics = getStartupDiagnostics()
const serverDistDir = dirname(fileURLToPath(import.meta.url))
const frontendDistDir = resolve(serverDistDir, '../../dist')
const frontendIndexPath = resolve(frontendDistDir, 'index.html')

function getFrontendAssets() {
  if (!existsSync(frontendIndexPath)) {
    return { entryScript: null, entryStylesheet: null }
  }

  const html = readFileSync(frontendIndexPath, 'utf8')
  const entryScript = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/)?.[1] ?? null
  const entryStylesheet = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/)?.[1] ?? null

  return { entryScript, entryStylesheet }
}

const frontendAssets = getFrontendAssets()

function serveFrontendAsset(filePath: string, contentType: string): Response {
  return new Response(readFileSync(filePath), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

function resolveFrontendAssetPath(requestPath: string): string {
  return resolve(frontendDistDir, requestPath.replace(/^\//, ''))
}

console.log('Startup diagnostics:', startupDiagnostics)
console.log('Static asset diagnostics:', {
  cwd: process.cwd(),
  serverDistDir,
  frontendDistDir,
  frontendIndexExists: existsSync(frontendIndexPath),
  frontendEntryScript: frontendAssets.entryScript,
  frontendEntryStylesheet: frontendAssets.entryStylesheet,
})

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
  status: getDatabaseStatus() === 'ready' ? 'ok' : 'degraded',
  timestamp: new Date().toISOString(),
  diagnostics: startupDiagnostics,
  database: getDatabaseStatus(),
}))

if (process.env.NODE_ENV === 'production') {
  const serveFrontendIndex = serveStatic({ root: frontendDistDir, path: './index.html' })
  const serveFrontendAssets = serveStatic({ root: frontendDistDir })

  app.use('/assets/*', async (c, next) => {
    const requestedAssetPath = resolveFrontendAssetPath(c.req.path)

    if (requestedAssetPath.startsWith(frontendDistDir) && existsSync(requestedAssetPath)) {
      return serveFrontendAssets(c, next)
    }

    if (/^\/assets\/index-[^/]+\.js$/.test(c.req.path) && frontendAssets.entryScript) {
      const entryScriptPath = resolveFrontendAssetPath(frontendAssets.entryScript)
      if (existsSync(entryScriptPath)) {
        console.warn(`Serving current entry script for stale asset request: ${c.req.path}`)
        return serveFrontendAsset(entryScriptPath, 'text/javascript; charset=utf-8')
      }
    }

    if (/^\/assets\/index-[^/]+\.css$/.test(c.req.path) && frontendAssets.entryStylesheet) {
      const entryStylesheetPath = resolveFrontendAssetPath(frontendAssets.entryStylesheet)
      if (existsSync(entryStylesheetPath)) {
        console.warn(`Serving current entry stylesheet for stale asset request: ${c.req.path}`)
        return serveFrontendAsset(entryStylesheetPath, 'text/css; charset=utf-8')
      }
    }

    return c.json({ error: 'Not found' }, 404)
  })
  app.use('/ai_panda.png', serveStatic({ root: frontendDistDir }))
  app.use('/gemini-recorder.worklet.js', serveStatic({ root: frontendDistDir }))

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
