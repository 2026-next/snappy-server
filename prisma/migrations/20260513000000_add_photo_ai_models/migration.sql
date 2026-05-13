-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "PhotoVersion" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "prompt" TEXT,
    "isOriginal" BOOLEAN NOT NULL DEFAULT false,
    "sourceJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoAnalysisJob" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "resultJson" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnhancementJob" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnhancementJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoVersion_sourceJobId_key" ON "PhotoVersion"("sourceJobId");

-- CreateIndex
CREATE INDEX "PhotoVersion_photoId_createdAt_idx" ON "PhotoVersion"("photoId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoAnalysisJob_photoId_key" ON "PhotoAnalysisJob"("photoId");

-- CreateIndex
CREATE INDEX "EnhancementJob_photoId_createdAt_idx" ON "EnhancementJob"("photoId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "EnhancementJob_status_idx" ON "EnhancementJob"("status");

-- AddForeignKey
ALTER TABLE "PhotoVersion" ADD CONSTRAINT "PhotoVersion_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoVersion" ADD CONSTRAINT "PhotoVersion_sourceJobId_fkey" FOREIGN KEY ("sourceJobId") REFERENCES "EnhancementJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAnalysisJob" ADD CONSTRAINT "PhotoAnalysisJob_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnhancementJob" ADD CONSTRAINT "EnhancementJob_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
