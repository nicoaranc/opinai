import { z } from 'zod';

const csv = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()));

// Variables que necesita la app. Si falta una obligatoria, Nest no arranca.
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Orígenes permitidos por CORS, separados por comas
  CORS_ORIGINS: csv.default(['http://localhost:5173']),
});

export type Env = z.infer<typeof envSchema>;
