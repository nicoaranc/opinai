# Arquitectura de opinai

> Documento vivo: se actualiza cada vez que se agrega o cambia una parte del sistema.
> Última actualización: 2026-11-26 (API REST de catálogo, reseñas y usuarios; nota opcional)

opinai es una plataforma de reseñas y valoraciones de **películas, series, música (álbumes y canciones) y videojuegos**.

## Índice

1. [Visión general](#1-visión-general)
2. [Stack](#2-stack)
3. [Estructura del repositorio](#3-estructura-del-repositorio)
4. [Entornos](#4-entornos)
5. [Backend](#5-backend)
6. [Modelo de datos](#6-modelo-de-datos)
7. [API](#7-api)
8. [Variables de entorno](#8-variables-de-entorno)
9. [Decisiones de diseño](#9-decisiones-de-diseño)
10. [Estado y próximos pasos](#10-estado-y-próximos-pasos)

---

## 1. Visión general

```mermaid
flowchart LR
    U[Usuario] --> F["Frontend<br/>React + Vite<br/>(Render Static Site)"]
    F -->|"/api/* (rewrite, mismo origen)<br/>cookie de sesión"| B["Backend<br/>NestJS<br/>(Render Web Service)"]
    B -->|Prisma + pg| D[("PostgreSQL<br/>(Supabase)")]
    B -.->|futuro| X["APIs externas<br/>TMDB, OMDb, MusicBrainz,<br/>IGDB, RAWG..."]
```

- El **frontend** es una SPA estática. No accede a la base de datos ni a APIs externas con credenciales.
- El **backend** expone una API REST bajo `/api`, contiene la lógica de negocio y es el único que habla con la base de datos (y en el futuro con las APIs externas).
- El front llama al back **desde su mismo origen**: en local, Vite redirige `/api` a `localhost:3000`; en producción, una regla *rewrite* del Static Site envía `/api/*` al Web Service. Así la cookie de sesión funciona sin cookies de terceros (ver [§9](#9-decisiones-de-diseño)).
- La **base de datos** es PostgreSQL. Las obras importadas de APIs externas se guardarán localmente.

## 2. Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React + Vite + TypeScript | _pendiente_ |
| Backend | NestJS (ESM, Express) + TypeScript | Nest 12, TS 6 |
| ORM | Prisma con driver adapter `@prisma/adapter-pg` | 7.10.1 |
| Base de datos | PostgreSQL | 17 (local) |
| Configuración | `@nestjs/config` + Zod | 12.1 / 4 |
| Validación | `StandardSchemaValidationPipe` (Nest) + Zod, mensajes en español | |
| Contraseñas | `argon2` (argon2id) | 0.45 |
| Rate limiting | `@nestjs/throttler` | 6.8 |
| Cookies | `cookie-parser` | 1.4 |
| Health checks | `@nestjs/terminus` | 12.2 |
| Documentación API | `@nestjs/swagger` (OpenAPI desde los esquemas Zod) | 12.1 |
| Tests | Vitest | 4 |
| Scripts TS (seed) | tsx | 4 |
| Lint / formato | oxlint / Prettier | |
| Runtime | Node.js | 22 |

## 3. Estructura del repositorio

```
opinai/
├── architecture.md            ← este documento
├── docker-compose.yml         ← Postgres para desarrollo local
├── .gitignore
└── backend/
    ├── prisma.config.ts       ← config de la CLI de Prisma (schema, migraciones, seed, URL)
    ├── prisma/
    │   ├── schema.prisma      ← modelos
    │   ├── seed.ts            ← datos de ejemplo (npm run db:seed)
    │   └── migrations/        ← migraciones SQL versionadas
    ├── src/
    │   ├── main.ts            ← arranque: prefijo /api, cookies, CORS, validación, proxy
    │   ├── app.module.ts      ← módulo raíz: config, rate limit, guards y filtro globales
    │   ├── config/env.ts      ← esquema Zod de las variables de entorno
    │   ├── common/            ← filtro de errores, paginación, params, slugs, selects compartidos
    │   ├── prisma/            ← PrismaModule (global) + PrismaService
    │   ├── auth/              ← registro, login, sesiones, guards y decoradores
    │   ├── media/             ← obras (catálogo), listas de canciones, estadísticas
    │   ├── creators/          ← creadores y su obra
    │   ├── genres/            ← géneros
    │   ├── reviews/           ← reseñas y valoraciones
    │   ├── users/             ← perfiles públicos y edición del propio
    │   ├── health/            ← GET /api/health
    │   └── generated/prisma/  ← cliente Prisma generado (no se versiona)
    └── test/                  ← tests e2e
```

El frontend irá en `frontend/` cuando se cree.

## 4. Entornos

### Local

| Pieza | Cómo corre | Dirección |
|---|---|---|
| PostgreSQL | Docker (`docker compose up -d`) | `localhost:5433` (el 5432 lo usa otro proyecto) |
| Backend | `npm run start:dev` en `backend/` (hot reload) | `http://localhost:3000/api` |
| Frontend | _pendiente_ (`npm run dev`, con proxy de `/api` a `:3000`) | `http://localhost:5173` |

Solo la base de datos está dockerizada. El back y el front corren con Node directamente para tener hot reload.

### Producción (planeado)

| Pieza | Servicio | Notas |
|---|---|---|
| Frontend | Render **Static Site** | `npm run build` y se sirve `dist/`. Regla *rewrite*: `/api/*` → URL del Web Service + `/api/*`. |
| Backend | Render **Web Service** (runtime Node, sin Docker) | Health check en `/api/health`. En el plan gratis se duerme tras unos 15 minutos sin tráfico. |
| Base de datos | Supabase | La app usa el *Transaction pooler* (6543) y las migraciones el *Session pooler* (5432, compatible con IPv4). |

Build del backend en Render: `npm ci && npx prisma migrate deploy && npm run build` (el `postinstall` ya ejecuta `prisma generate`). Start: `npm run start:prod`. Variables: `NODE_ENV=production`, `TRUST_PROXY` y `CORS_ORIGINS` con la URL del front.

## 5. Backend

NestJS en modo **ESM**: los imports relativos terminan en `.js`. Todas las rutas llevan el prefijo global **`/api`**.

### Módulos

| Módulo | Responsabilidad |
|---|---|
| `AppModule` | Raíz. Importa el resto y registra el filtro de errores y los guards globales. Incluye `AppController` de ejemplo (`GET /api`). |
| `ConfigModule` | **Global**. Carga `.env` y valida las variables con el esquema Zod de `src/config/env.ts`. Si falta una obligatoria o es inválida, la app no arranca. Se lee con `ConfigService<Env, true>`. |
| `ThrottlerModule` | Rate limiting en memoria por IP: 100 peticiones por minuto en general, y más estricto en autenticación. |
| `PrismaModule` | **Global**. Expone `PrismaService` (un `PrismaClient` con el adapter `pg`, que conecta usando `DATABASE_URL` desde `ConfigService`). |
| `AuthModule` | Registro, login, logout y usuario actual. Exporta `SessionService` y `PasswordService`. Detalles en [Autenticación](#autenticación). |
| `MediaModule` | Catálogo: listar, buscar, filtrar y ordenar obras; detalle con los datos del tipo, géneros, créditos, canciones o álbumes, distribución de notas y la reseña propia. Alta, edición y baja (ADMIN). |
| `CreatorsModule` | Creadores: lista, perfil (con los roles en que aparece) y su obra paginada. Alta, edición y baja (ADMIN). |
| `GenresModule` | Géneros con cuántas obras tiene cada uno. Alta, edición y baja (ADMIN). |
| `ReviewsModule` | Reseñas: listar las de una obra, crear la propia, editarla y borrarla. Mantiene las estadísticas de cada obra. Exporta `ReviewsService`. |
| `UsersModule` | Perfil público de un usuario con estadísticas, sus reseñas y edición del perfil propio. |
| `HealthModule` | `GET /api/health` con Terminus: hace ping a la base de datos (`SELECT 1`, timeout de 3 s). Público y sin rate limit. |
| `ObserveModule` | Telemetría de NestJS Observe, incluida en la plantilla. Inactiva hasta que se vincule con `npx @nestjs/observe link`. |

### Transversal (configurado en `main.ts` y `AppModule`)

- **Validación**: `StandardSchemaValidationPipe` global. Solo valida los parámetros que declaran un esquema, por ejemplo `@Body({ schema: registerSchema })`. Los esquemas son de Zod y el tipo del DTO se infiere con `z.infer`. Zod está configurado en español (`z.locales.es()`). Si la validación falla, responde `400` con un mensaje por campo (`"email: Email inválido"`).
- **Errores**: `AllExceptionsFilter` (`APP_FILTER`) da a todas las respuestas de error la misma forma (ver [§7](#7-api)). Traduce errores de Prisma: `P2002` (único duplicado) → `409`, `P2003` (FK inválida) → `409`, `P2025` (no encontrado) → `404`. Cualquier otro error responde `500` con un mensaje genérico y se registra en el log, sin exponer detalles.
- **Guards globales**, en este orden:
  1. `ThrottlerGuard`: rate limiting.
  2. `OriginGuard`: CSRF. Rechaza con `403` las peticiones `POST`, `PUT`, `PATCH` y `DELETE` cuyo `Origin` no esté en `CORS_ORIGINS`.
  3. `SessionGuard`: carga el usuario desde la cookie y **exige sesión en todas las rutas** salvo las marcadas con `@Public()`. Aplica `@Roles(...)`.
- **CORS**: solo se aceptan los orígenes de `CORS_ORIGINS`, con `credentials: true`.
- **Proxy**: `trust proxy` = `TRUST_PROXY`, para que `req.ip` (rate limit y sesiones) sea la IP real detrás de Render.
- **Shutdown hooks** activados, para que Prisma cierre conexiones cuando Render detiene el servicio.
- **Swagger** en `/api/docs` (JSON en `/api/docs-json`), **solo fuera de producción**. Los cuerpos y parámetros salen de los mismos esquemas Zod que validan, así que la documentación no se desactualiza.

### Convenciones de la API REST

- **Recursos en plural** (`/media`, `/creators`, `/genres`, `/reviews`, `/users`) y verbos HTTP: `GET` lee, `POST` crea (`201`), `PATCH` edita parcialmente, `PUT` reemplaza (lista de canciones), `DELETE` borra (`204`).
- **Lecturas por ID o slug** (`/media/parasite-2019` o `/media/<uuid>`); **escrituras solo por ID**. Los IDs se validan como UUID (`400` si no lo son).
- **Listas paginadas**: `?page=1&pageSize=20` (máximo 50). Respuesta: `{ items, page, pageSize, total, totalPages }`. Géneros es la excepción: devuelve todos.
- **Filtros y orden** por query string, por ejemplo `?type=MOVIE,SERIES&genre=drama&sort=rating`.
- **Campos desconocidos** en el body se rechazan con `400` (`z.strictObject`). En `PATCH`, `null` (o `""` en textos) borra un campo opcional.
- **Anidación de un nivel**, solo cuando el recurso pertenece a otro: `/media/:id/reviews`, `/creators/:slug/media`, `/users/:username/reviews`.
- **Sin HATEOAS** (REST pragmático): las respuestas no incluyen enlaces de navegación.
- **Lo que aparece dentro de otro recurso usa un resumen** (`src/common/selects.ts`): `userSummary` (sin email), `creatorSummary` y `mediaSummary` (con sus créditos principales: director, artista o desarrolladora).

### Estadísticas de las obras

`Media` guarda `ratingAvg` (promedio de 1 a 10 con 2 decimales, `null` si nadie puntuó), `ratingCount` (reseñas con nota) y `reviewCount` (todas las reseñas). Se recalculan en la misma transacción en que se crea, edita o borra una reseña (`src/media/media-stats.ts`). Antes de escribir, la transacción **bloquea la fila de la obra** (`SELECT … FOR UPDATE`), así que dos reseñas simultáneas de la misma obra no dejan el promedio desactualizado. Así se puede ordenar el catálogo por nota o popularidad sin agregar en cada consulta.

### Autenticación

Autenticación propia con **sesiones en base de datos y cookie `httpOnly`** (no JWT).

**Flujo**
1. `POST /api/auth/register` o `/login` valida los datos, verifica o crea al usuario y crea una sesión.
2. La sesión se identifica con un **token aleatorio de 256 bits** que va en la cookie. En la tabla `sessions` solo se guarda su **hash SHA-256**, así que una copia de la base no permite suplantar a nadie.
3. En cada petición, `SessionGuard` busca la sesión por el hash, comprueba que no haya caducado y deja el usuario en `req.user`.
4. `POST /api/auth/logout` borra la sesión de la base y la cookie.

**Detalles**
- **Contraseñas** con argon2id y los parámetros de OWASP: 19 MiB, 2 iteraciones y 1 hilo (`ARGON2_OPTIONS` en `password.service.ts`). En el login, si el email no existe, igual se verifica contra un hash falso, para que el tiempo de respuesta no revele qué emails están registrados. El mensaje de error es el mismo en ambos casos. Si cambian los parámetros, el hash se actualiza en el siguiente login.
- **Límite de cálculos de argon2**: como mucho 4 a la vez (~76 MiB) y 50 en cola. Si la cola se llena, se responde `503`. Evita que muchos logins simultáneos agoten la RAM del servidor.
- **Caducidad**: 30 días como máximo, o 7 días sin actividad. `lastActiveAt` se actualiza como mucho una vez por hora. Las sesiones caducadas se borran al usarse y al iniciar una nueva sesión el mismo usuario.
- **Cookie**: `HttpOnly`, `SameSite=Lax` y `Path=/`. Con `secure` (por defecto en producción) se llama `__Host-opinai_sid` y exige HTTPS; en local se llama `opinai_sid`.
- **Rate limit por IP**: registro y login, 10 intentos cada 15 minutos (cada ruta por separado).
- **Bloqueo por cuenta** (`LoginAttemptsService`): tras 5 logins fallidos en 15 minutos para un mismo email, ese email recibe `429` durante el resto de la ventana, desde cualquier IP e incluso con la contraseña correcta. Frena el ataque a una cuenta desde muchas IPs. Un login correcto reinicia el contador. También cuenta emails inexistentes, para no revelar cuáles existen. Se guarda en memoria (hasta 10.000 emails), así que se reinicia si el servidor se reinicia. Contrapartida: alguien puede bloquear temporalmente el login de otra persona si conoce su email.
- **Normalización**: email y username se guardan en minúsculas y sin espacios. El username solo admite `a-z`, `0-9` y `_` (3–30 caracteres). La contraseña debe tener entre 8 y 128 caracteres.

**Uso en controladores**

```ts
@Get('algo')          // exige sesión (por defecto)
@Public()             // abierta; si hay sesión, igual se carga req.user
@Roles(UserRole.ADMIN) // exige sesión y rol ADMIN (403 si no lo tiene)
handler(@CurrentUser() user: PublicUser) {}
```

`publicUserSelect` (`src/users/public-user.ts`) define los campos de un usuario que se pueden devolver. Nunca incluye `passwordHash`.

### Prisma 7

- `schema.prisma` no lleva URL. La CLI la toma de `prisma.config.ts` (`DIRECT_URL`) y la app la pasa al adapter en `PrismaService` (`DATABASE_URL`).
- El cliente se genera en `src/generated/prisma` con el generator `prisma-client` (ESM). Se importa desde `../generated/prisma/client.js`.
- `migrate dev` no regenera el cliente. Después de migrar hay que ejecutar `npm run db:generate`.
- **Seed** (`prisma/seed.ts`, se ejecuta con tsx): **borra todos los datos** y crea 3 usuarios (`admin@opinai.local` con rol ADMIN, `ana@opinai.local` y `bruno@opinai.local`, todos con la contraseña **`opinai123`**), 7 géneros, 5 creadores, 11 obras (2 películas, 1 serie, 1 álbum con 6 canciones, 1 juego) y 9 reseñas (una sin nota), y calcula las estadísticas de cada obra. Se puede repetir sin problemas. **Solo corre contra una base local** (`localhost`, `127.0.0.1` o `::1`) y nunca con `NODE_ENV=production` (`prisma/seed-guard.ts`). Así, aunque el `.env` local apunte a Supabase, no puede borrar producción ni crear un ADMIN con contraseña conocida.

### Scripts

| Script | Qué hace |
|---|---|
| `start:dev` | Back con hot reload |
| `build` / `start:prod` | Compila a `dist/` y lo ejecuta |
| `test` / `test:e2e` | Tests unitarios y e2e (Vitest) |
| `lint` / `format` | oxlint / Prettier |
| `db:migrate` | Crea y aplica una migración (desarrollo) |
| `db:deploy` | Aplica las migraciones pendientes (producción) |
| `db:generate` | Regenera el cliente Prisma |
| `db:seed` | Reinicia la base con los datos de ejemplo |
| `db:studio` | Interfaz web para ver y editar datos |

## 6. Modelo de datos

Fuente de verdad: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). Los IDs son UUID v7, salvo el de `Session`, que es el hash del token. Las columnas usan los mismos nombres que en Prisma (camelCase, por ejemplo `"passwordHash"`).

```mermaid
erDiagram
    User ||--o{ Review : escribe
    User ||--o{ Session : "inicia"
    Media ||--o{ Review : recibe
    Media ||--o| MovieDetails : "si MOVIE"
    Media ||--o| SeriesDetails : "si SERIES"
    Media ||--o| AlbumDetails : "si ALBUM"
    Media ||--o| TrackDetails : "si TRACK"
    Media ||--o| GameDetails : "si GAME"
    Media ||--o{ AlbumTrack : "álbum contiene"
    Media ||--o{ AlbumTrack : "canción aparece en"
    Media ||--o{ Credit : tiene
    Creator ||--o{ Credit : participa
    Media }o--o{ Genre : clasifica
    Media ||--o{ ExternalId : "se identifica en"
```

| Modelo | Tabla | Propósito |
|---|---|---|
| `User` | `users` | Quien reseña y valora. Rol `USER` o `ADMIN`. Email y username únicos (en minúsculas). |
| `Session` | `sessions` | Sesión iniciada. `id` = hash SHA-256 del token de la cookie. Guarda caducidad, última actividad, user agent e IP. Se borra en cascada con el usuario. |
| `Media` | `media` | Todo lo reseñable. `type`: `MOVIE`, `SERIES`, `ALBUM`, `TRACK`, `GAME`. Campos comunes: título, sinopsis, fecha, portada, idioma, país. Guarda además las estadísticas de reseñas (`ratingAvg`, `ratingCount`, `reviewCount`). |
| `MovieDetails` … `GameDetails` | `*_details` | Datos propios de cada tipo, en relación 1:1 con `Media`. |
| `AlbumTrack` | `album_tracks` | Lista de canciones de un álbum (disco y número de pista). Una canción puede estar en varios álbumes. |
| `Creator` | `creators` | Personas, grupos o empresas (`PERSON`, `GROUP`, `COMPANY`). |
| `Credit` | `credits` | Une `Media` con `Creator` y un rol: `DIRECTOR`, `SHOWRUNNER`, `WRITER`, `PRIMARY_ARTIST`, `FEATURED_ARTIST`, `PRODUCER`, `DEVELOPER`, `PUBLISHER`. |
| `Genre` | `genres` | Géneros (relación muchos a muchos con `Media`). |
| `Review` | `reviews` | Una por usuario y obra. Tiene **nota, texto o ambos**: `rating` (1–10, equivale a 0,5–5 estrellas) y `body` son opcionales, pero no pueden faltar los dos. Un `title` exige `body`. Las reseñas sin nota no cuentan en el promedio. La base lo garantiza con dos `CHECK` (`reviews_rating_range`, `reviews_rating_or_body`). |
| `ExternalId` | `external_ids` | IDs de la obra en servicios externos (`tmdb`, `igdb`…). Todavía no se usa. |

## 7. API

Base: `/api`. 🔓 = pública, 🔒 = requiere sesión.

| Método | Ruta | Acceso | Descripción | Respuesta |
|---|---|---|---|---|
| `GET` | `/api` | 🔓 | Ejemplo de la plantilla | `Hello World!` |
| `GET` | `/api/health` | 🔓 | Estado del servicio y de la base de datos | `200` `{ status: "ok", info: { database: { status: "up" } } }` · `503` si la base no responde |
| `POST` | `/api/auth/register` | 🔓 | Crea la cuenta e inicia sesión. Body: `{ email, username, password, displayName? }` | `201` `{ user }` + cookie · `400` datos inválidos · `409` email o username en uso |
| `POST` | `/api/auth/login` | 🔓 | Inicia sesión (reemplaza la sesión anterior del navegador). Body: `{ email, password }` | `200` `{ user }` + cookie · `401` credenciales incorrectas |
| `POST` | `/api/auth/logout` | 🔒 | Cierra la sesión actual | `204` y borra la cookie |
| `GET` | `/api/auth/me` | 🔒 | Usuario de la sesión actual | `200` `{ user }` · `401` sin sesión |

### Catálogo

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/media` | 🔓 | Lista paginada. Filtros: `type` (uno o varios separados por comas; **sin indicarlo, todos menos `TRACK`**), `q` (título u original, sin distinguir mayúsculas), `genre` (slug), `creator` (slug), `year`. `sort`: `recent` (por defecto), `oldest`, `title`, `rating`, `popular`, `added`. |
| `GET` | `/api/media/:idOrSlug` | 🔓 | Detalle: campos comunes, `details` del tipo, `genres`, `credits`, `ratingDistribution` (cuántas notas hay de cada valor del 1 al 10), `tracks` (si es álbum), `albums` (si es canción) y `myReview` (la reseña propia si hay sesión, si no `null`). |
| `POST` | `/api/media` | 🔒 ADMIN | Crea una obra. Body: `type`, `title` y opcionales (`slug`, `originalTitle`, `synopsis`, `releaseDate` `AAAA-MM-DD`, `coverUrl`, `backdropUrl`, `language`, `country`, `genres` (slugs), `credits` (`[{ creatorId, role, position? }]`), `details` del tipo). Sin `slug` se genera a partir del título y el año (`dune-parte-dos-2024`, con `-2` si se repite). Los roles deben corresponder al tipo (p. ej. `DEVELOPER` solo en juegos). |
| `PATCH` | `/api/media/:id` | 🔒 ADMIN | Edita. `genres` y `credits` reemplazan la lista completa. `details` solo cambia los campos enviados. El `type` no se puede cambiar. |
| `DELETE` | `/api/media/:id` | 🔒 ADMIN | Borra la obra con sus reseñas, créditos y detalles. |
| `PUT` | `/api/media/:id/tracks` | 🔒 ADMIN | Reemplaza la lista de canciones de un álbum: `{ tracks: [{ trackId, discNumber?, trackNumber }] }`. Las canciones deben existir como `TRACK`. |
| `GET` | `/api/creators` | 🔓 | Lista paginada. Filtros: `q`, `kind`. |
| `GET` | `/api/creators/:idOrSlug` | 🔓 | Perfil con `creditsCount` y `roles` (en qué roles aparece y cuántas veces). |
| `GET` | `/api/creators/:idOrSlug/media` | 🔓 | Su obra paginada, más reciente primero. Filtros: `role`, `type`. |
| `POST` · `PATCH` · `DELETE` | `/api/creators[/:id]` | 🔒 ADMIN | Alta (`kind`, `name`, `slug?`, `bio?`, `imageUrl?`, `country?`), edición y baja (borra sus créditos, no las obras). |
| `GET` | `/api/genres` | 🔓 | Todos los géneros con `mediaCount`. |
| `POST` · `PATCH` · `DELETE` | `/api/genres[/:id]` | 🔒 ADMIN | Alta (`name`, `slug?`), edición y baja. |

### Reseñas

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/media/:idOrSlug/reviews` | 🔓 | Reseñas de una obra, con su autor. `sort`: `recent` (por defecto), `oldest`, `rating_desc`, `rating_asc` (las sin nota van al final). `withText=true`: solo las que tienen texto. |
| `POST` | `/api/media/:id/reviews` | 🔒 | Crea la reseña propia: `{ rating?, title?, body?, containsSpoilers? }`, con nota, texto o ambos. `409` si ya existe (el mensaje indica su ID). |
| `GET` | `/api/reviews/:id` | 🔓 | Una reseña con su autor y su obra. |
| `PATCH` | `/api/reviews/:id` | 🔒 autor | Edita. `null` quita la nota o el texto, siempre que quede uno de los dos. `403` si no es tuya. |
| `DELETE` | `/api/reviews/:id` | 🔒 autor o ADMIN | Borra (un ADMIN puede moderar reseñas ajenas). |

### Usuarios

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/users/:username` | 🔓 | Perfil público (**sin email**) con `stats`: `reviewCount`, `writtenCount` (con texto), `ratingCount` y `ratingAvg`. |
| `GET` | `/api/users/:username/reviews` | 🔓 | Sus reseñas con la obra. Mismos `sort` y `withText` que arriba, más `type`. |
| `PATCH` | `/api/users/me` | 🔒 | Edita el perfil propio: `displayName`, `bio`, `avatarUrl` (`""` o `null` los borra). |

### Formas de las respuestas

- `user` (auth) = `{ id, email, username, displayName, avatarUrl, bio, role, createdAt }`. Solo se devuelve al propio usuario.
- `userSummary` = `{ id, username, displayName, avatarUrl }`.
- `mediaSummary` = `{ id, type, slug, title, originalTitle, releaseDate, coverUrl, ratingAvg, ratingCount, reviewCount, credits: [{ role, creator }] }` (hasta 3 créditos principales).
- `review` = `{ id, rating, title, body, containsSpoilers, createdAt, updatedAt }`, más `user` y/o `media` según el endpoint.
- Las fechas van en ISO 8601. `releaseDate` y `endDate` son fechas sin hora (`2019-05-30T00:00:00.000Z`).

Respuestas comunes: `401` sin sesión en una ruta 🔒, `403` rol insuficiente u `Origin` no permitido, `429` demasiadas peticiones.

### Formato de errores

Todas las respuestas de error tienen esta forma:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Debes iniciar sesión",
  "path": "/api/auth/me",
  "timestamp": "2026-11-25T23:27:55.350Z"
}
```

`message` es un string, o un array de strings cuando son errores de validación (uno por campo).

## 8. Variables de entorno

Backend (`backend/.env`, plantilla en `backend/.env.example`). Se validan al arrancar (`src/config/env.ts`), excepto `DIRECT_URL`, que solo usa la CLI de Prisma.

| Variable | Uso | Local | Producción |
|---|---|---|---|
| `DATABASE_URL` | Conexión de la app | `postgresql://opinai:opinai@localhost:5433/opinai` | Supabase, Transaction pooler (6543) |
| `DIRECT_URL` | Migraciones (CLI de Prisma) | la misma | Supabase, Session pooler (5432) |
| `NODE_ENV` | `development`, `production` o `test`. **Obligatoria**, sin valor por defecto | `development` | `production` |
| `PORT` | Puerto HTTP (por defecto `3000`) | `3000` | lo asigna Render |
| `CORS_ORIGINS` | Orígenes de confianza, separados por comas: CORS y protección CSRF. **Obligatoria en producción**; fuera de ella vale `http://localhost:5173` por defecto | `http://localhost:5173` | URL del front en Render |
| `COOKIE_SECURE` | Cookie de sesión solo por HTTPS (`true`/`false`). Si no se define: `true` en producción | — | — |
| `TRUST_PROXY` | Número de proxies delante de la app, para obtener la IP real (por defecto `0`). Con `0` en producción se muestra un aviso al arrancar | — | `1` (**verificar al desplegar** cuántos saltos hay) |
| `OBSERVE_APP_KEY` / `OBSERVE_APP_SECRET` | NestJS Observe (opcional) | — | — |

## 9. Decisiones de diseño

- **Una tabla `Media` y detalles por tipo.** Reseñas, géneros y créditos apuntan a una sola tabla. Los campos propios de cada tipo quedan tipados en tablas 1:1 en vez de un JSON.
- **Álbumes y canciones son `Media` independientes**, así que cada uno tiene sus propias reseñas. `AlbumTrack` los relaciona.
- **Reseña y valoración en un solo modelo, con nota opcional.** Una reseña puede ser solo nota, solo texto o ambas, como en los sitios que publican reseñas sin puntuar. Las que no tienen nota no afectan al promedio. Hay una por usuario y obra (`@@unique([userId, mediaId])`).
- **Créditos con rol** en vez de un campo "director" o "artista". Permite varios creadores y roles por obra.
- **Sin Docker para back y front en producción.** Render los ejecuta de forma nativa; Docker solo se usa para la base de datos local.
- **APIs externas (futuro): importar bajo demanda y guardar en la base**, identificando cada obra por `ExternalId`, en vez de consultar la API en cada petición.
- **Las reglas de la reseña se validan en la app y en la base.** Zod da mensajes claros, y dos `CHECK` añadidos a mano en una migración (Prisma no los declara) protegen ante escrituras directas.
- **API REST pragmática** en vez de GraphQL o tRPC: el dominio son recursos con CRUD, la caché HTTP sirve para un catálogo de mucha lectura y encaja con las cookies, los guards y el rate limit por ruta. Sin HATEOAS.
- **Estadísticas desnormalizadas en `Media`** en vez de calcularlas en cada consulta, para poder ordenar y paginar por nota o popularidad. Se recalculan con la fila bloqueada.
- **Las canciones no aparecen en el catálogo general** salvo que se pidan (`type=TRACK`), porque un solo álbum añade decenas.
- **Los roles de crédito se validan según el tipo de obra** (`ALLOWED_ROLES` en `media.schemas.ts`).
- **Validación con Zod (Standard Schema) en vez de `class-validator`.** Es el enfoque nativo de Nest 12: sin clases ni decoradores, y el mismo esquema da el tipo TypeScript. También se usa para las variables de entorno.
- **Los errores 500 nunca exponen detalles al cliente.** Se registran en el log del servidor.
- **Autenticación propia** (no Supabase Auth): sin dependencia de un proveedor, usuarios en nuestra propia tabla y desarrollo local solo con Postgres.
- **Sesiones en base de datos en vez de JWT.** Se pueden revocar al instante (logout real, cerrar sesiones robadas) y no hacen falta refresh tokens. El costo es una consulta por petición autenticada, aceptable a esta escala.
- **Sesiones hechas a mano con piezas maduras** (argon2, cookie-parser, throttler) en vez de `@nestjs/authentication`, porque ese paquete está en versión 0.1.x y su API aún puede cambiar. Si se estabiliza, se puede evaluar migrar.
- **El front y el back comparten origen** (proxy de Vite en local, rewrite de Render en producción). Los subdominios de `onrender.com` cuentan como sitios distintos, así que sin esto la cookie `SameSite=Lax` no se enviaría.
- **Seguro por defecto**: toda ruta nueva exige sesión salvo que se marque `@Public()`.
- **Fallar al arrancar antes que arrancar inseguro.** `NODE_ENV` es obligatoria porque de ella dependen la cookie segura y otras protecciones, y `CORS_ORIGINS` es obligatoria en producción.

### Riesgos conocidos (aceptados por ahora)

- **El registro revela si un email existe** ("Ese email ya está registrado"). Se resuelve con verificación por correo.
- **No se verifica el email**: alguien puede registrarse con un email ajeno.
- **No se comprueban contraseñas filtradas**: solo se exige un largo mínimo de 8.
- **Los rate limits y el bloqueo por cuenta viven en memoria**: se reinician con el servidor y no sirven con varias instancias.
- **No existe "cerrar sesión en todos los dispositivos"** ni se invalidan las sesiones al cambiar la contraseña (todavía no hay endpoint para cambiarla).
- **No hay cabeceras de seguridad** (`helmet`) ni limpieza periódica de sesiones caducadas.
- **La búsqueda usa `ILIKE`** (`contains` sin distinguir mayúsculas) sin índice de texto: no ignora tildes ("parasitos" no encuentra "Parásitos") y se volverá lenta con un catálogo grande. Mejora futura: `pg_trgm` o búsqueda de texto completo con `unaccent`.
- **Borrar una obra borra sus reseñas** (cascada), sin papelera.

## 10. Estado y próximos pasos

**Hecho**
- [x] Back NestJS con Prisma y Postgres local en Docker
- [x] Modelos de datos y migración inicial
- [x] `GET /api/health`
- [x] Configuración validada, validación global con Zod, CORS y formato uniforme de errores
- [x] Seed con datos de ejemplo
- [x] Autenticación: registro, login, logout, sesión actual, roles, rate limit y protección CSRF
- [x] API REST: catálogo (obras, creadores, géneros), reseñas con nota opcional, perfiles de usuario y Swagger
- [x] Endurecimiento: `NODE_ENV` obligatoria, seed solo en local, argon2 con límite de memoria, bloqueo por cuenta y `CORS_ORIGINS` obligatoria en producción

**Pendiente**
- [ ] Frontend (React + Vite)
- [ ] Recuperar contraseña y verificar email (requiere servicio de correo)
- [ ] Login con Google o GitHub
- [ ] Integración con APIs externas
- [ ] Despliegue en Render y Supabase
