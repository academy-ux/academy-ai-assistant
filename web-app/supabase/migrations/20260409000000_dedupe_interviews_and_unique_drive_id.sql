-- Remove duplicate interviews and enforce uniqueness on drive_file_id going forward.
--
-- Background: multiple ingestion pathways (cron poll, manual Drive import, Chrome
-- extension upload) can race and insert the same underlying transcript twice. On top
-- of that, subfolder traversal in the poller can yield the same file under multiple
-- parents. We now dedupe files before insert in application code, but we also need to
-- clean up existing duplicate rows and add a DB-level guard so new duplicates can't
-- slip in regardless of the ingestion pathway.

-- 1. Keep only the newest row per drive_file_id (matches the behavior of the admin
--    /api/interviews/dedupe endpoint). NULL drive_file_ids are left alone here.
delete from interviews a
using interviews b
where a.drive_file_id is not null
  and a.drive_file_id = b.drive_file_id
  and a.id <> b.id
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id > b.id)
  );

-- 2. Keep only the newest row per (transcript_file_name, owner_email) for rows that
--    share a file name but don't have a drive_file_id yet. This cleans up legacy
--    cross-pathway duplicates (e.g., extension upload + manual import) before we
--    enforce the unique index on drive_file_id.
delete from interviews a
using interviews b
where a.drive_file_id is null
  and a.transcript_file_name is not null
  and a.transcript_file_name = b.transcript_file_name
  and coalesce(a.owner_email, '') = coalesce(b.owner_email, '')
  and a.id <> b.id
  and (
    a.created_at < b.created_at
    or (a.created_at = b.created_at and a.id > b.id)
  );

-- 3. Drop any prior non-unique index on drive_file_id so we can replace it with the
--    unique one below.
drop index if exists idx_interviews_drive_file_id;

-- 4. Add a unique index so concurrent inserts can never produce a second row for the
--    same Drive file id. Postgres allows multiple NULLs in a unique index, so legacy
--    rows without a drive_file_id are still permitted. This also lets Supabase's
--    upsert with { onConflict: 'drive_file_id' } run a proper ON CONFLICT DO NOTHING.
create unique index if not exists uniq_interviews_drive_file_id
  on interviews(drive_file_id);
