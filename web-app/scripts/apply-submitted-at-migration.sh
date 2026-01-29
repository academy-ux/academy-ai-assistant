#!/bin/bash
# Script to apply the submitted_at column migration

set -e

echo "🚀 Applying submitted_at column migration..."
echo ""

# Check if we're in the right directory
if [ ! -f "scripts/add-submitted-at-column.sql" ]; then
  echo "❌ Error: Must run from web-app directory"
  exit 1
fi

# Load environment variables
if [ ! -f ".env.local" ]; then
  echo "❌ Error: .env.local not found"
  exit 1
fi

source .env.local

# Check if SUPABASE_URL is set
if [ -z "$SUPABASE_URL" ]; then
  echo "❌ Error: SUPABASE_URL not set in .env.local"
  exit 1
fi

echo "📋 This migration will add the submitted_at column to the interviews table."
echo ""
echo "To apply this migration, you have two options:"
echo ""
echo "Option 1: Use Supabase Dashboard SQL Editor"
echo "  1. Go to your Supabase project dashboard"
echo "  2. Navigate to SQL Editor"
echo "  3. Run the SQL from scripts/add-submitted-at-column.sql"
echo ""
echo "Option 2: Use psql with direct database connection"
echo "  1. Get your database connection string from Supabase project settings"
echo "  2. Run: psql 'your-connection-string' < scripts/add-submitted-at-column.sql"
echo ""
echo "Option 3: Use Supabase CLI (if you have it linked)"
echo "  1. Run: supabase db push"
echo ""
echo "After applying the migration, run: npx tsx scripts/mark-interviews-before-date-submitted.ts"
