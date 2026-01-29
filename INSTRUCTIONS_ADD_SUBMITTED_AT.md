# Instructions: Add submitted_at Column and Mark Interviews

## Problem
The `submitted_at` column doesn't exist in the database yet, so we need to add it before marking interviews as submitted.

## Solution

### Step 1: Add the submitted_at Column to Database

You need to run the following SQL in your Supabase database. Choose one of these methods:

#### Method A: Supabase Dashboard (Recommended - Easiest)

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Paste the following SQL:

```sql
-- Add submitted_at column to interviews table
ALTER TABLE interviews
ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_interviews_submitted_at
  ON interviews(submitted_at DESC NULLS LAST);
```

5. Click "Run" or press Cmd/Ctrl + Enter
6. You should see "Success. No rows returned"

#### Method B: Using psql Command Line

If you have your database connection string:

```bash
cd web-app
psql 'your-postgres-connection-string' < scripts/add-submitted-at-column.sql
```

### Step 2: Mark Interviews as Submitted

Once the column is added, run this command:

```bash
cd web-app
npx tsx scripts/mark-interviews-before-date-submitted.ts
```

This will:
- Find all interviews before Rachel Xie's meeting (2026-01-28)
- Mark them as submitted by setting `submitted_at` to their `meeting_date`
- Only update interviews with `meeting_type = 'Interview'`
- Skip interviews that already have `submitted_at` set

## What This Does

After running these steps, all interviews before Rachel Xie will show a "Submitted" badge in the UI with the date being their meeting date.
