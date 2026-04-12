import pg from 'pg'
import { MissingEnvError, requireEnv } from './env.js'

const { Pool } = pg

let pool: pg.Pool | null = null

function createPool(): pg.Pool {
  const connectionString = requireEnv('DATABASE_URL')
  const nextPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })

  nextPool.on('error', (err) => {
    console.error('Unexpected error on idle Postgres client', err)
  })

  return nextPool
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = createPool()
  }
  return pool
}

export async function initializeDatabase(): Promise<void> {
  const client = await getPool().connect()
  try {
    await client.query('SELECT 1')
  } finally {
    client.release()
  }
}

export function getDatabaseStatus(): 'configured' | 'missing' {
  return process.env.DATABASE_URL?.trim() ? 'configured' : 'missing'
}

/** Run a query and return rows */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await getPool().query(sql, params)
  return rows as T[]
}

/** Run a query and return first row or null */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

/** Run inside a transaction, auto rollback on error */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export function isDatabaseConfigError(err: unknown): err is MissingEnvError {
  return err instanceof MissingEnvError && err.variable === 'DATABASE_URL'
}
