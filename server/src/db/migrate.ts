import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import * as schema from './schema';
import { env } from '../config/env';

async function runMigrations() {
  console.log('Running migrations...');

  const sql = neon(env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('Migrations complete.');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
