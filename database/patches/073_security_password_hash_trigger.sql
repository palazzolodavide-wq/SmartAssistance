-- Smart Assistance - Patch 73A
-- Prevent plaintext/default user password_hash values from remaining in DB.
-- Existing plaintext/default-like values are converted using PostgreSQL pgcrypto bcrypt.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION sa_hash_plain_user_password()
RETURNS trigger AS $$
BEGIN
  IF NEW.password_hash IS NOT NULL
     AND LENGTH(NEW.password_hash) > 0
     AND NEW.password_hash NOT LIKE '$2%'
     AND NEW.password_hash NOT LIKE '$argon2%'
  THEN
    NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf', 12));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sa_hash_plain_user_password ON users;

CREATE TRIGGER trg_sa_hash_plain_user_password
BEFORE INSERT OR UPDATE OF password_hash ON users
FOR EACH ROW
EXECUTE FUNCTION sa_hash_plain_user_password();

UPDATE users
SET password_hash = password_hash
WHERE password_hash IS NOT NULL
  AND LENGTH(password_hash) > 0
  AND password_hash NOT LIKE '$2%'
  AND password_hash NOT LIKE '$argon2%';
