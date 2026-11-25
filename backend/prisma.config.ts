import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // La CLI (migrate, studio) usa la conexión directa.
  // En Supabase: el "Session pooler" (puerto 5432), no el de transacciones.
  datasource: {
    url: env('DIRECT_URL'),
  },
});
