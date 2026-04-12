export class MissingEnvError extends Error {
  readonly code = 'MISSING_ENV'
  readonly variable: string

  constructor(variable: string) {
    super(`${variable} environment variable is required`)
    this.name = 'MissingEnvError'
    this.variable = variable
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new MissingEnvError(name)
  }
  return value
}

export function isMissingEnvError(err: unknown): err is MissingEnvError {
  return err instanceof MissingEnvError
}

export function isRailwayRuntime(): boolean {
  return Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID)
}

export function getStartupDiagnostics() {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    runningInRailway: isRailwayRuntime(),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    hasJwtSecret: Boolean(process.env.JWT_SECRET?.trim()),
    hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
    frontendUrlConfigured: Boolean(process.env.FRONTEND_URL?.trim()),
  }
}
