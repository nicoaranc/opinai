import { z } from 'zod';

const DEV_ORIGINS = ['http://localhost:5173'];

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
export const envSchema = z
  .object({
    // Obligatoria y sin valor por defecto: de ella dependen la cookie segura y
    // otras protecciones, así que olvidarla en producción debe impedir el arranque.
    NODE_ENV: z.enum(['development', 'production', 'test']),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    // Orígenes de confianza, separados por comas: se usan para CORS y para
    // rechazar peticiones que modifican datos desde otros sitios (CSRF).
    // Obligatoria en producción; en desarrollo, http://localhost:5173.
    CORS_ORIGINS: csv.optional(),
    // Cookie de sesión solo por HTTPS. Si no se define: true en producción.
    COOKIE_SECURE: z.stringbool().optional(),
    // Número de proxies delante de la app (Render: 1) para obtener la IP real
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.CORS_ORIGINS?.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'Es obligatoria en producción',
      });
    }
  })
  .transform((env) => ({
    ...env,
    CORS_ORIGINS: env.CORS_ORIGINS?.length ? env.CORS_ORIGINS : DEV_ORIGINS,
  }));

export type Env = z.output<typeof envSchema>;
