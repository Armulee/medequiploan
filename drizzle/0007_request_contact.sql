-- A public request keeps what it said, instead of writing it over the
-- borrower's record. Knowing someone's national ID was enough to change their
-- phone number and ID photograph on file, in their name.
ALTER TABLE requests ADD COLUMN IF NOT EXISTS contact_name varchar(256) NOT NULL DEFAULT '';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS contact_phone varchar(20) NOT NULL DEFAULT '';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS contact_line_id varchar(64) NOT NULL DEFAULT '';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS contact_email varchar(254) NOT NULL DEFAULT '';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS contact_address text NOT NULL DEFAULT '';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS id_card_photo_id varchar(64);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS illness_photo_id varchar(64);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS consent_version varchar(16);
