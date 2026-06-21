import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './db.js'

const serverSrcDir = dirname(fileURLToPath(import.meta.url))
// Works both in dev (server/src/) and production (server/dist/)
const migrationsDir = resolve(serverSrcDir, '../../db/migrations')

export async function runMigrations(): Promise<void> {
  const client = await getPool().connect()
  try {
    // Ensure the tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    if (!existsSync(migrationsDir)) {
      console.warn(`[migrate] migrations dir not found: ${migrationsDir}`)
      return
    }

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [file]
      )
      if (rows.length > 0) continue

      const sql = readFileSync(resolve(migrationsDir, file), 'utf8')
      console.log(`[migrate] applying ${file}`)
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        )
        await client.query('COMMIT')
        console.log(`[migrate] applied  ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`[migrate] failed   ${file}`, err)
        // Non-fatal: log and continue so a bad old migration doesn't block the server
      }
    }
  } finally {
    client.release()
  }
}
