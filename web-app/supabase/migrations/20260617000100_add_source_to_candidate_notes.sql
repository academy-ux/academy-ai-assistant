-- Distinguish internal recruiter notes from client-submitted notes so the public
-- shared report only ever exposes notes the client wrote themselves.
alter table candidate_notes
  add column if not exists source text not null default 'internal';

create index if not exists idx_candidate_notes_source on candidate_notes(source);
