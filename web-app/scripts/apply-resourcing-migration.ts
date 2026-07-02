#!/usr/bin/env tsx

/**
 * Apply the resourcing planner migration to the remote Supabase database.
 * Uses DATABASE_URL from .env.local (direct Postgres connection).
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { Client } from 'pg'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL in .env.local')
  process.exit(1)
}

async function main() {
  const migrationPath = path.join(
    __dirname,
    '../supabase/migrations/20260702000000_add_resourcing_planner.sql'
  )
  const sql = fs.readFileSync(migrationPath, 'utf-8')

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  console.log('🚀 Applying resourcing planner migration...')
  try {
    await client.query(sql)
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name LIKE 'resourcing_%' ORDER BY table_name`
    )
    console.log('✅ Done. Tables:', rows.map((r) => r.table_name).join(', '))
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('❌ Migration failed:', e.message)
  process.exit(1)
})
