import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { resolve } from 'node:path';

const router = new Hono();

// Serve static assets for the Resume Builder UI under /resume/*
router.use('/*', serveStatic({ root: './public/modules/resume' }));

export default router;
