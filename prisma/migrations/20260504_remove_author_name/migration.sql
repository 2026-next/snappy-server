-- Migration: remove authorName column from Message
-- Run this SQL against your Postgres database to remove the denormalized authorName

-- Try quoted CamelCase table (if Prisma used quoted identifiers)
ALTER TABLE IF EXISTS "Message" DROP COLUMN IF EXISTS "authorName";

-- Also try unquoted lowercase table name (typical Postgres default)
ALTER TABLE IF EXISTS message DROP COLUMN IF EXISTS "authorName";
