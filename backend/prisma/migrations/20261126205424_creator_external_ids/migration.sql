-- CreateTable
CREATE TABLE "creator_external_ids" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "creator_external_ids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creator_external_ids_provider_externalId_key" ON "creator_external_ids"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "creator_external_ids_creatorId_provider_key" ON "creator_external_ids"("creatorId", "provider");

-- AddForeignKey
ALTER TABLE "creator_external_ids" ADD CONSTRAINT "creator_external_ids_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
