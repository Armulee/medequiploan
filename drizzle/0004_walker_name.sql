-- The seeded equipment reads "ไทย (English)" — วีลแชร์ (Wheelchair),
-- ไม้ค้ำยัน (Crutches) — except this one, which shipped the other way round.
-- Renamed here as well as in scripts/seed.ts so databases that were already
-- seeded match, and only where it still has the original name: staff can
-- rename equipment, and a name they chose is not this migration's business.
UPDATE "equipment"
   SET "name" = 'โครงเหล็กช่วยเดิน (Walker)'
 WHERE "name" = 'Walker (โครงเหล็กช่วยเดิน)';
