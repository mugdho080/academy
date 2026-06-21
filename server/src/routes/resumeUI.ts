import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { resolve } from 'node:path';

const router = new Hono();

// Serve static assets for the Resume Builder UI under /resume/*
const resumePublicDir = resolve(import.meta.dir, '../../../public/modules/resume');
router.use('/*', serveStatic({ root: resumePublicDir }));

export default router;
