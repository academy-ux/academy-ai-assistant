-- Remember the stage a candidate was in before an "accepted" decision moved
-- them to Client Interview, so changing/clearing the decision can move them back.
ALTER TABLE client_decisions ADD COLUMN IF NOT EXISTS moved_from_stage TEXT;
