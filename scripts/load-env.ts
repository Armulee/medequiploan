/**
 * Loads .env.local then .env into process.env for scripts run under plain Node.
 *
 * Next.js does this itself for `next dev` and `next build`, but a standalone
 * `tsx scripts/*.ts` gets nothing — which is why seeding failed with
 * "DATABASE_URL not found" on a checkout that had a perfectly good .env.local.
 *
 * Node's --env-file-if-exists would also work but prints a notice for every
 * file that is absent, which reads like an error when it isn't. Import this
 * module FIRST so it runs before anything that reads process.env at load time.
 */
import fs from 'fs';
import path from 'path';

for (const file of ['.env.local', '.env']) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;

  for (const rawLine of fs.readFileSync(full, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Strip one layer of matching quotes, so a connection string wrapped in
    // quotes doesn't arrive with them attached.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // A value already exported in the shell wins, so a one-off
    // `DATABASE_URL=... npm run seed` overrides the file as expected.
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
