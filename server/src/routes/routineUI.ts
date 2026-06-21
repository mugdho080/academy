import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { resolve } from 'node:path';

const router = new Hono();

// Serve static assets for the Panda Routine Builder UI
router.use('/*', serveStatic({ root: './public/modules/routine' }));

export default router;
