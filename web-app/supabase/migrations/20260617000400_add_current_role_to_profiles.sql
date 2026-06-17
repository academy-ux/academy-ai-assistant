-- Cache the candidate's current title/company parsed from their Lever resume,
-- so the report can show their present role without re-parsing on every load.
alter table candidate_profiles
  add column if not exists current_title text,
  add column if not exists current_company text;
