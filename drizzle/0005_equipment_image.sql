-- Catalogue photographs for the landing page carousel. Holds the storage id
-- rather than a URL, so the same row works whether the file is in Vercel Blob
-- or on local disk during development.
ALTER TABLE "equipment" ADD COLUMN IF NOT EXISTS "image_id" varchar(256) DEFAULT '' NOT NULL;
