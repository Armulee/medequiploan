-- Data retention. The PDPA notice promises deletion two years after the last
-- loan; this column records when that actually happened for a given borrower,
-- which is both the "already swept" flag and the evidence that the promise was
-- kept. Rows are anonymised in place rather than deleted, because every loan,
-- return and audit entry refers to the borrower id.
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS anonymised_at timestamptz;
CREATE INDEX IF NOT EXISTS borrowers_anonymised_idx ON borrowers(anonymised_at);
