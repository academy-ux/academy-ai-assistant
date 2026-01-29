#!/bin/bash
# Sync TypeScript types from Supabase schema
# Run this whenever you make schema changes to keep types up to date

set -e

echo "🔄 Syncing Supabase types from schema..."

# Check if SUPABASE_PROJECT_ID is set
if [ -z "$SUPABASE_PROJECT_ID" ]; then
  echo "⚠️  SUPABASE_PROJECT_ID not set in environment"
  echo "You can find your project ID in the Supabase dashboard URL:"
  echo "https://supabase.com/dashboard/project/YOUR_PROJECT_ID"
  echo ""
  echo "Usage: SUPABASE_PROJECT_ID=your-project-id ./scripts/sync-supabase-types.sh"
  exit 1
fi

# Generate types from Supabase
npx supabase gen types typescript \
  --project-id "$SUPABASE_PROJECT_ID" \
  > types/supabase.ts

echo "✅ Types synced successfully to types/supabase.ts"
echo "💡 Tip: Add SUPABASE_PROJECT_ID to your .env.local for convenience"
