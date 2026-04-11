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

app.use('*', cors({
  origin: process.env.FRONTEND_URL ?? '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

app.use('*', logger())

app.route('/api/auth', auth)
app.route('/api/learner', learner)
app.route('/api/admin', admin)
app.route('/api/ai', ai)

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

if (process.env.NODE_ENV === 'production') {
  const serveFrontendAsset = serveStatic({ root: './dist' })
  const serveFrontendIndex = serveStatic({ path: './dist/index.html' })

  app.use('/*', serveFrontendAsset)
  app.get('/*', async (c, next) => {
    const path = c.req.path
    if (path.startsWith('/api/') || path.includes('.')) {
      await next()
      return
    }
    return serveFrontendIndex(c, next)
  })
}

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

const port = Number(process.env.PORT ?? 3001)

serve({ fetch: app.fetch, port }, () => {
  console.log(`Academy API running on port ${port}`)
})

export default app
