-- Session revocation. Without this a cookie stays valid for its full eight
-- hours after the account is closed or its password is changed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;
