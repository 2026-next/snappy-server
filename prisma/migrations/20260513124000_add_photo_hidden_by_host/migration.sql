-- Soft-hide marker used by host (event owner) deletions. When set, the photo
-- is excluded from every host-facing query, but remains in storage and stays
-- visible to the uploader guest via their own endpoints.

ALTER TABLE "Photo"
  ADD COLUMN "hiddenByHostAt" TIMESTAMP(3);

CREATE INDEX "Photo_eventId_hiddenByHostAt_idx"
  ON "Photo"("eventId", "hiddenByHostAt");
