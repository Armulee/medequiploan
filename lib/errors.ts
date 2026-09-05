/**
 * The two error shapes every layer needs, in a file that imports nothing.
 *
 * They used to live in lib/api.ts, which meant lib/db imported lib/api just to
 * throw a config error — and once requireAuth had to read the users table,
 * lib/api would have had to import lib/db back. Keeping the types here breaks
 * that cycle rather than relying on ESM to tolerate it.
 */

export class ApiError extends Error {
  status: number;
  /** Seconds until the caller may retry; sent as the Retry-After header. */
  retryAfterSeconds?: number;
  constructor(message: string, status = 400, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * A required environment variable is missing or malformed.
 *
 * Separated from ApiError because it is an operator problem, not a caller
 * problem, and because hiding it behind the generic 500 made a misconfigured
 * deployment nearly impossible to diagnose from the outside — the symptom was
 * an unexplained 500 on the public form. The variable's name is safe to
 * surface; its value is never included.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
