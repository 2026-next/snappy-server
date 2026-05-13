-- Trigram extension and indexes to accelerate ILIKE-based search across uploader
-- names and guest messages used by GET /photo/views/search.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Guest_name_trgm_idx"
  ON "Guest"
  USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Message_content_trgm_idx"
  ON "Message"
  USING GIN ("content" gin_trgm_ops);
