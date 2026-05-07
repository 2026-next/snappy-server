ALTER TABLE "Photo" DROP COLUMN "uploadedByName";

ALTER TABLE "Photo" RENAME COLUMN "isDownloadedByCouple" TO "isDownloaded";
