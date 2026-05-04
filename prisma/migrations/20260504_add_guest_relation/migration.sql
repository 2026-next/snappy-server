-- Migration: add GuestRelation enum and relation column to Guest
-- Creates enum type and adds a non-nullable column with default OTHER

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GuestRelation') THEN
    CREATE TYPE "GuestRelation" AS ENUM (
      'PARENT', 'FRIEND', 'SIBLING', 'RELATIVE', 'COWORKER', 'ACQUAINTANCE', 'OTHER'
    );
  END IF;
END$$;

ALTER TABLE IF EXISTS "Guest" ADD COLUMN IF NOT EXISTS "relation" "GuestRelation" NOT NULL DEFAULT 'OTHER';
