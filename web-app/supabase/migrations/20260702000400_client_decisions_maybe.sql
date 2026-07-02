-- Allow the 'maybe' client decision alongside accepted/rejected.
ALTER TABLE client_decisions DROP CONSTRAINT IF EXISTS client_decisions_decision_check;
ALTER TABLE client_decisions ADD CONSTRAINT client_decisions_decision_check
  CHECK (decision IN ('accepted', 'rejected', 'maybe'));
