import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { resolve } from 'node:path';

const router = new Hono();

// Serve static assets for the Panda Routine Builder UI
const routinePublicDir = resolve(import.meta.dir, '../../../public/modules/routine');
router.use('/*', serveStatic({ root: routinePublicDir }));

export default router;
