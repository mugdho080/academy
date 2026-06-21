import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDatabaseStatus, initializeDatabase, isDatabaseConfigError } from './db.js'
import { getStartupDiagnostics, MissingEnvError } from './env.js'
import auth from './routes/auth.js'
import learner from './routes/learner.js'
import admin from './routes/admin.js'
import ai from './routes/ai.js'
import routineBuilder from './routes/routineBuilder.js'
import routineUI from './routes/routineUI.js'
import resumeBuilder from './routes/resumeBuilder.js'
import resumeUI from './routes/resumeUI.js'
import resumeAdmin from './routes/resumeAdmin.js'
import gamification from './routes/gamification.js'

const app = new Hono()
const frontendOrigin = process.env.FRONTEND_URL
const startupDiagnostics = getStartupDiagnostics()
const serverDistDir = dirname(fileURLToPath(import.meta.url))
const frontendDistDir = resolve(serverDistDir, '../../dist')
const frontendIndexPath = resolve(frontendDistDir, 'index.html')
const frontendAssetsDir = resolve(frontendDistDir, 'assets')

function pickLargestAsset(pattern: RegExp): string | null {
  if (!existsSync(frontendAssetsDir)) {
    return null
  }

  const matches = readdirSync(frontendAssetsDir)
    .filter((name) => pattern.test(name))
    .map((name) => ({
      name,
      size: statSync(resolve(frontendAssetsDir, name)).size,
    }))
    .sort((a, b) => b.size - a.size)

  return matches[0] ? `/assets/${matches[0].name}` : null
}

function getFrontendAssets() {
  if (!existsSync(frontendIndexPath)) {
    return {
      html: null,
      entryScript: pickLargestAsset(/^index-.*\.js$/),
      entryStylesheet: pickLargestAsset(/^index-.*\.css$/),
    }
  }

  const html = readFileSync(frontendIndexPath, 'utf8')
  const htmlEntryScript = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/)?.[1] ?? null
  const htmlEntryStylesheet = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/)?.[1] ?? null

  const entryScriptPath = htmlEntryScript ? resolveFrontendAssetPath(htmlEntryScript) : null
  const entryStylesheetPath = htmlEntryStylesheet ? resolveFrontendAssetPath(htmlEntryStylesheet) : null

  const entryScript = entryScriptPath && existsSync(entryScriptPath)
    ? htmlEntryScript
    : pickLargestAsset(/^index-.*\.js$/)
  const entryStylesheet = entryStylesheetPath && existsSync(entryStylesheetPath)
    ? htmlEntryStylesheet
    : pickLargestAsset(/^index-.*\.css$/)

  return { html, entryScript, entryStylesheet }
}

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

function buildFrontendHtml(frontendAssets: ReturnType<typeof getFrontendAssets>): string | null {
  if (!frontendAssets.html) {
    return null
  }

  let html = frontendAssets.html

  html = html.replace('href="/vite.svg"', 'href="/ai_panda.png"')

  if (frontendAssets.entryScript) {
    html = html.replace(
      /<script type="module" crossorigin src="[^"]+"><\/script>/,
      `<script type="module" crossorigin src="${frontendAssets.entryScript}"></script>`
    )
  }

  if (frontendAssets.entryStylesheet) {
    html = html.replace(
      /<link rel="stylesheet" crossorigin href="[^"]+">/,
      `<link rel="stylesheet" crossorigin href="${frontendAssets.entryStylesheet}">`
    )
  }

  return html
}

const frontendAssets = getFrontendAssets()
const frontendHtml = buildFrontendHtml(frontendAssets)

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
app.route('/api/index.php/learner', learner)
app.route('/api/index.php/admin', admin)
app.route('/api/index.php/ai', ai)
app.route('/api/learner/resume-builder', resumeBuilder)
app.route('/api/learner/gamification', gamification)
app.route('/api/admin/users', resumeAdmin)
app.route('/resume', resumeUI)

app.get('/api/health', (c) => c.json({
  status: getDatabaseStatus() === 'ready' ? 'ok' : 'degraded',
  timestamp: new Date().toISOString(),
  diagnostics: startupDiagnostics,
  database: getDatabaseStatus(),
}))

if (process.env.NODE_ENV === 'production') {
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
    if (!frontendHtml) {
      return c.json({ error: 'Frontend build not found' }, 500)
    }
    return new Response(frontendHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
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
