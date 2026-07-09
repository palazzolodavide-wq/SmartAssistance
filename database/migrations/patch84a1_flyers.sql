-- PATCH_84A1_FLYER_TABLES
CREATE TABLE IF NOT EXISTS flyers (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual_pdf',
  source_email_from TEXT,
  source_email_subject TEXT,
  source_message_id TEXT,
  original_filename TEXT,
  stored_pdf_path TEXT,
  file_hash TEXT UNIQUE,
  page_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS flyer_pages (
  id SERIAL PRIMARY KEY,
  flyer_id INTEGER NOT NULL REFERENCES flyers(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  image_filename TEXT NOT NULL,
  image_path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(flyer_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_flyers_status_published
  ON flyers(status, published_at DESC, imported_at DESC);

CREATE INDEX IF NOT EXISTS idx_flyer_pages_flyer_page
  ON flyer_pages(flyer_id, page_number);