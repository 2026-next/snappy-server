/*
  Warnings:

  - You are about to drop the column `authorUserId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `uploadedByUserId` on the `Photo` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_authorUserId_fkey";

-- DropForeignKey
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_uploadedByUserId_fkey";

-- DropIndex
DROP INDEX "Message_eventId_authorUserId_idx";

-- DropIndex
DROP INDEX "Photo_eventId_uploadedByUserId_uploadedAt_idx";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "authorUserId";

-- AlterTable
ALTER TABLE "Photo" DROP COLUMN "uploadedByUserId";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";

-- DropEnum
DROP TYPE "UserRole";
