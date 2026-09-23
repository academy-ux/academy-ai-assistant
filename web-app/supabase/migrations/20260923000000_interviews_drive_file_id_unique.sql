-- One interview per Drive file (or per Meet code for extension uploads, which
-- store "meet-<code>" here). Import dedup previously used maybeSingle(), which
-- treats >1 matching row as "not found" — so a single duplicate snowballed into
-- hundreds. This makes the database reject the second copy outright; importers
-- treat the resulting 23505 as "already imported".
create unique index if not exists interviews_drive_file_id_key
  on public.interviews (drive_file_id)
  where drive_file_id is not null;
