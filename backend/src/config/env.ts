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

// Texto opcional; vacío cuenta como no definido (p. ej. `TMDB_ACCESS_TOKEN=`
// copiado tal cual de .env.example)
const optionalSecret = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

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
    // Token de lectura de TMDB (películas y series). Sin él, la búsqueda y la
    // importación desde TMDB responden 503; el resto de la app funciona igual.
    TMDB_ACCESS_TOKEN: optionalSecret,
    // Credenciales de una app de Twitch para IGDB (videojuegos). Opcionales,
    // pero van juntas: sin ellas, /api/igdb/* responde 503.
    IGDB_CLIENT_ID: optionalSecret,
    IGDB_CLIENT_SECRET: optionalSecret,
  })
  .superRefine((env, ctx) => {
    if (Boolean(env.IGDB_CLIENT_ID) !== Boolean(env.IGDB_CLIENT_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: [env.IGDB_CLIENT_ID ? 'IGDB_CLIENT_SECRET' : 'IGDB_CLIENT_ID'],
        message: 'IGDB_CLIENT_ID e IGDB_CLIENT_SECRET deben definirse juntas',
      });
    }
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
