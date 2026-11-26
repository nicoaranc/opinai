-- AlterTable
ALTER TABLE "media" ADD COLUMN     "ratingAvg" DOUBLE PRECISION,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reviews" ALTER COLUMN "rating" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "media_ratingAvg_idx" ON "media"("ratingAvg");

-- CreateIndex
CREATE INDEX "media_reviewCount_idx" ON "media"("reviewCount");

-- CreateIndex
CREATE INDEX "reviews_userId_createdAt_idx" ON "reviews"("userId", "createdAt");
