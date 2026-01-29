# Supabase TypeScript Types

This project uses **type-safe Supabase queries** to catch schema mismatches at compile time.

## How It Works

1. **Database Schema** (`supabase/schema.sql`) - Source of truth for your database structure
2. **TypeScript Types** (`types/supabase.ts`) - Auto-generated types from your schema
3. **Typed Client** (`lib/supabase.ts`) - Type-safe Supabase client using the generated types

## When to Sync Types

Sync types whenever you:
- Add/remove/modify columns in your database
- Add/remove tables
- Change column types or constraints
- See TypeScript errors about missing fields

## How to Sync Types

### Option 1: Using the Sync Script (Recommended)

```bash
# Set your Supabase project ID (find it in your dashboard URL)
export SUPABASE_PROJECT_ID="your-project-id"

# Run the sync script
cd web-app
./scripts/sync-supabase-types.sh
```

### Option 2: Manual Sync

```bash
cd web-app
npx supabase gen types typescript \
  --project-id YOUR_PROJECT_ID \
  > types/supabase.ts
```

### Option 3: From Local Schema File

If you're developing locally and want to generate types from `schema.sql`:

```bash
# Start local Supabase
npx supabase start

# Generate types
npx supabase gen types typescript --local > types/supabase.ts
```

## Type-Safe Queries

With proper types, you get:

### ✅ Autocomplete for columns
```typescript
const { data } = await supabase
  .from('interviews')
  .select('candidate_id, candidate_name') // ← Autocomplete!
  .single()
```

### ✅ Type checking for inserts/updates
```typescript
await supabase.from('interviews').insert({
  candidate_id: '123',   // ✅ Valid
  invalid_column: 'foo'  // ❌ TypeScript error!
})
```

### ✅ Correct return types
```typescript
const { data } = await supabase
  .from('interviews')
  .select('*')
  .single()

// data.candidate_id is typed as string | null
// data.transcript is typed as string
```

## Troubleshooting

### "Could not find column in schema cache"

This means your TypeScript types are out of sync with your database. Run the sync script!

### "Cannot find module '@/types/supabase'"

The types file doesn't exist yet. Either:
1. Run the sync script to generate it
2. Use the manually created `types/supabase.ts` that's already in the repo

### Schema changes not reflected

1. Make sure you applied the schema changes to your Supabase database
2. Wait ~30 seconds for Supabase to update
3. Run the sync script again

## CI/CD Integration

You can add type syncing to your deployment workflow:

```yaml
# .github/workflows/deploy.yml
- name: Sync Supabase Types
  env:
    SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
  run: |
    cd web-app
    ./scripts/sync-supabase-types.sh
```

## References

- [Supabase TypeScript Support](https://supabase.com/docs/guides/api/generating-types)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
