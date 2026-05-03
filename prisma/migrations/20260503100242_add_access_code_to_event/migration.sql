/*
  Warnings:

  - A unique constraint covering the columns `[accessCode]` on the table `Event` will be added. If there are existing duplicate values, this will fail.
  - The required column `accessCode` was added to the `Event` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "accessCode" TEXT;

-- Update existing rows with unique values
UPDATE "Event" SET "accessCode" = concat('access_', "id") WHERE "accessCode" IS NULL;

-- Make column NOT NULL and add unique constraint
ALTER TABLE "Event" ALTER COLUMN "accessCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Event_accessCode_key" ON "Event"("accessCode");
