-- Restricciones que Prisma no puede declarar en schema.prisma.
-- La app ya valida lo mismo; esto protege ante escrituras directas a la base.
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 10),
  ADD CONSTRAINT "reviews_rating_or_body" CHECK ("rating" IS NOT NULL OR "body" IS NOT NULL);
