-- Recurring time off: weekdays is a CSV of 0-4 (Mon..Fri). When set, the row
-- repeats weekly on those days from start_day until end_day (NULL = forever).
ALTER TABLE resourcing_timeoff ALTER COLUMN end_day DROP NOT NULL;
ALTER TABLE resourcing_timeoff ADD COLUMN IF NOT EXISTS weekdays TEXT;
