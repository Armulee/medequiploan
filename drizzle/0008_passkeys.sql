-- Passkeys: phishing-resistant sign-in for staff. Only public keys are stored,
-- so a copy of this table cannot be used to sign in as anyone.
CREATE SEQUENCE IF NOT EXISTS passkey_seq;

CREATE TABLE IF NOT EXISTS passkeys (
  passkey_id     varchar(16) PRIMARY KEY DEFAULT ('K' || lpad(nextval('passkey_seq')::text, 4, '0')),
  user_id        varchar(16) NOT NULL REFERENCES users(user_id),
  credential_id  text NOT NULL UNIQUE,
  public_key     text NOT NULL,
  counter        integer NOT NULL DEFAULT 0,
  device_type    varchar(32) NOT NULL DEFAULT '',
  backed_up      boolean NOT NULL DEFAULT false,
  label          varchar(64) NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz
);
CREATE INDEX IF NOT EXISTS passkeys_user_idx ON passkeys(user_id);

-- Challenges live in the database because serverless invocations do not share
-- memory: the one that issues a challenge is rarely the one that verifies it.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  challenge_id varchar(64) PRIMARY KEY,
  challenge    text NOT NULL,
  user_id      varchar(16),
  purpose      varchar(16) NOT NULL,
  expires_at   timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS webauthn_challenges_expiry_idx ON webauthn_challenges(expires_at);
