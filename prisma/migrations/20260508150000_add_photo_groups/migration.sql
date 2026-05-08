-- CreateTable
CREATE TABLE "PhotoGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "PhotoGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoGroupPhoto" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,

    CONSTRAINT "PhotoGroupPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoGroup_eventId_createdAt_idx" ON "PhotoGroup"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "PhotoGroup_createdByUserId_createdAt_idx" ON "PhotoGroup"("createdByUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoGroup_eventId_name_key" ON "PhotoGroup"("eventId", "name");

-- CreateIndex
CREATE INDEX "PhotoGroupPhoto_photoId_idx" ON "PhotoGroupPhoto"("photoId");

-- CreateIndex
CREATE INDEX "PhotoGroupPhoto_groupId_createdAt_idx" ON "PhotoGroupPhoto"("groupId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoGroupPhoto_groupId_photoId_key" ON "PhotoGroupPhoto"("groupId", "photoId");

-- AddForeignKey
ALTER TABLE "PhotoGroup" ADD CONSTRAINT "PhotoGroup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoGroup" ADD CONSTRAINT "PhotoGroup_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoGroupPhoto" ADD CONSTRAINT "PhotoGroupPhoto_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PhotoGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoGroupPhoto" ADD CONSTRAINT "PhotoGroupPhoto_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
