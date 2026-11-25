-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'SERIES', 'ALBUM', 'TRACK', 'GAME');

-- CreateEnum
CREATE TYPE "CreatorKind" AS ENUM ('PERSON', 'GROUP', 'COMPANY');

-- CreateEnum
CREATE TYPE "CreditRole" AS ENUM ('DIRECTOR', 'SHOWRUNNER', 'WRITER', 'PRIMARY_ARTIST', 'FEATURED_ARTIST', 'PRODUCER', 'DEVELOPER', 'PUBLISHER');

-- CreateEnum
CREATE TYPE "SeriesStatus" AS ENUM ('RETURNING', 'ENDED', 'CANCELED', 'IN_PRODUCTION');

-- CreateEnum
CREATE TYPE "AlbumType" AS ENUM ('ALBUM', 'EP', 'SINGLE', 'COMPILATION', 'LIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "type" "MediaType" NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT,
    "synopsis" TEXT,
    "releaseDate" DATE,
    "coverUrl" TEXT,
    "backdropUrl" TEXT,
    "language" VARCHAR(8),
    "country" VARCHAR(2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movie_details" (
    "mediaId" UUID NOT NULL,
    "runtimeMinutes" INTEGER,
    "ageRating" TEXT,
    "trailerUrl" TEXT,

    CONSTRAINT "movie_details_pkey" PRIMARY KEY ("mediaId")
);

-- CreateTable
CREATE TABLE "series_details" (
    "mediaId" UUID NOT NULL,
    "status" "SeriesStatus",
    "seasonsCount" INTEGER,
    "episodesCount" INTEGER,
    "endDate" DATE,
    "network" TEXT,
    "ageRating" TEXT,
    "trailerUrl" TEXT,

    CONSTRAINT "series_details_pkey" PRIMARY KEY ("mediaId")
);

-- CreateTable
CREATE TABLE "album_details" (
    "mediaId" UUID NOT NULL,
    "albumType" "AlbumType" NOT NULL DEFAULT 'ALBUM',
    "label" TEXT,

    CONSTRAINT "album_details_pkey" PRIMARY KEY ("mediaId")
);

-- CreateTable
CREATE TABLE "track_details" (
    "mediaId" UUID NOT NULL,
    "durationSeconds" INTEGER,
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "previewUrl" TEXT,

    CONSTRAINT "track_details_pkey" PRIMARY KEY ("mediaId")
);

-- CreateTable
CREATE TABLE "game_details" (
    "mediaId" UUID NOT NULL,
    "platforms" TEXT[],
    "gameModes" TEXT[],
    "trailerUrl" TEXT,

    CONSTRAINT "game_details_pkey" PRIMARY KEY ("mediaId")
);

-- CreateTable
CREATE TABLE "album_tracks" (
    "albumId" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "discNumber" INTEGER NOT NULL DEFAULT 1,
    "trackNumber" INTEGER NOT NULL,

    CONSTRAINT "album_tracks_pkey" PRIMARY KEY ("albumId","trackId")
);

-- CreateTable
CREATE TABLE "creators" (
    "id" UUID NOT NULL,
    "kind" "CreatorKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "imageUrl" TEXT,
    "country" VARCHAR(2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credits" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "role" "CreditRole" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genres" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "containsSpoilers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_ids" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "external_ids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GenreToMedia" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_GenreToMedia_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "media_slug_key" ON "media"("slug");

-- CreateIndex
CREATE INDEX "media_type_releaseDate_idx" ON "media"("type", "releaseDate");

-- CreateIndex
CREATE INDEX "media_title_idx" ON "media"("title");

-- CreateIndex
CREATE INDEX "album_tracks_trackId_idx" ON "album_tracks"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "album_tracks_albumId_discNumber_trackNumber_key" ON "album_tracks"("albumId", "discNumber", "trackNumber");

-- CreateIndex
CREATE UNIQUE INDEX "creators_slug_key" ON "creators"("slug");

-- CreateIndex
CREATE INDEX "creators_name_idx" ON "creators"("name");

-- CreateIndex
CREATE INDEX "credits_creatorId_role_idx" ON "credits"("creatorId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "credits_mediaId_creatorId_role_key" ON "credits"("mediaId", "creatorId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "genres_slug_key" ON "genres"("slug");

-- CreateIndex
CREATE INDEX "reviews_mediaId_createdAt_idx" ON "reviews"("mediaId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_userId_mediaId_key" ON "reviews"("userId", "mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "external_ids_provider_externalId_key" ON "external_ids"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "external_ids_mediaId_provider_key" ON "external_ids"("mediaId", "provider");

-- CreateIndex
CREATE INDEX "_GenreToMedia_B_index" ON "_GenreToMedia"("B");

-- AddForeignKey
ALTER TABLE "movie_details" ADD CONSTRAINT "movie_details_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series_details" ADD CONSTRAINT "series_details_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_details" ADD CONSTRAINT "album_details_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_details" ADD CONSTRAINT "track_details_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_details" ADD CONSTRAINT "game_details_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_tracks" ADD CONSTRAINT "album_tracks_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_tracks" ADD CONSTRAINT "album_tracks_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_ids" ADD CONSTRAINT "external_ids_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GenreToMedia" ADD CONSTRAINT "_GenreToMedia_A_fkey" FOREIGN KEY ("A") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GenreToMedia" ADD CONSTRAINT "_GenreToMedia_B_fkey" FOREIGN KEY ("B") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
