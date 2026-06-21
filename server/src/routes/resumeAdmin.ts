import { Hono } from 'hono';
import { query } from '../db.js';
import { requireAuth } from '../middleware.js';
import type { JwtPayload } from '../middleware.js';

const resumeAdmin = new Hono();
resumeAdmin.use('*', requireAuth);

function isAdmin(c: { get(k: string): unknown }): boolean {
  return String((c.get('user') as JwtPayload).role ?? '') === 'admin';
}

resumeAdmin.get('/:userId/resumes', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Unauthorized' }, 403);
  const userId = parseInt(c.req.param('userId'));
  const rows = await query('SELECT id, title, target_role, template_key, created_at, status FROM resumes WHERE user_id = $1', [userId]);
  return c.json({ resumes: rows });
});

resumeAdmin.get('/:userId/resumes/:resumeId', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Unauthorized' }, 403);
  const userId = parseInt(c.req.param('userId'));
  const resumeId = parseInt(c.req.param('resumeId'));
  const rows = await query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [resumeId, userId]);
  if (!rows.length) return c.json({ error: 'Resume not found' }, 404);
  return c.json({ resume: rows[0] });
});

resumeAdmin.get('/:userId/resumes/:resumeId/pdf', async (c) => {
  if (!isAdmin(c)) return new Response('Unauthorized', { status: 403 });
  const userId = parseInt(c.req.param('userId'));
  const resumeId = parseInt(c.req.param('resumeId'));
  const template = c.req.query('template') || 'simple';
  
  const rows = await query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [resumeId, userId]);
  if (!rows.length) return new Response('Resume not found', { status: 404 });
  
  const resume = rows[0] as any;
  const { renderResumePdf } = await import('../resume_builder/pdf.js');
  
  // parse JSON if it is a string
  const resumeData = typeof resume.resume_data === 'string' ? JSON.parse(resume.resume_data) : resume.resume_data;
  const pdfBytes = await renderResumePdf(resumeData, template);
  
  return c.body(pdfBytes as any, 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${resume.title}.pdf"`
  });
});

export default resumeAdmin;
