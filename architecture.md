# Arquitectura de opinai

> Documento vivo: se actualiza cada vez que se agrega o cambia una parte del sistema.
> Última actualización: 2026-11-26 (integración con IGDB: búsqueda e importación de videojuegos)

opinai es una plataforma de reseñas y valoraciones de **películas, series, música (álbumes y canciones) y videojuegos**.

## Índice

1. [Visión general](#1-visión-general)
2. [Stack](#2-stack)
3. [Estructura del repositorio](#3-estructura-del-repositorio)
4. [Entornos](#4-entornos)
5. [Backend](#5-backend) · [Frontend](#5b-frontend)
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
    B -->|HTTPS + token| T["TMDB<br/>(películas y series)"]
    B -->|HTTPS, sin clave| DZ["Deezer<br/>(música)"]
    B -->|"token de Twitch"| IG["IGDB<br/>(videojuegos)"]
    F -.->|imágenes directas| CDN["CDN de imágenes<br/>image.tmdb.org<br/>cdn-images.dzcdn.net<br/>images.igdb.com"]
```

- El **frontend** es una SPA estática. No accede a la base de datos ni a APIs externas con credenciales.
- El **backend** expone una API REST bajo `/api`, contiene la lógica de negocio y es el único que habla con la base de datos (y en el futuro con las APIs externas).
- El front llama al back **desde su mismo origen**: en local, Vite redirige `/api` a `localhost:3000`; en producción, una regla *rewrite* del Static Site envía `/api/*` al Web Service. Así la cookie de sesión funciona sin cookies de terceros (ver [§9](#9-decisiones-de-diseño)).
- La **base de datos** es PostgreSQL. Las obras importadas de APIs externas se guardan en ella; **las imágenes no**: se guarda su URL y el navegador las carga directo del CDN del proveedor.

## 2. Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React + Vite + TypeScript, React Router (sin librería de UI ni de estado) | React 19, Vite 8, TS 7, React Router 8 |
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
├── frontend/
│   ├── vite.config.ts         ← puerto 5173 fijo y proxy de /api al back
│   ├── index.html
│   ├── public/favicon.svg
│   └── src/
│       ├── main.tsx / App.tsx ← entrada: providers y rutas
│       ├── index.css          ← estilos globales y variables de color (claro/oscuro)
│       ├── api/               ← client (fetch a /api), useApi, reviews, importers (TMDB, Deezer e IGDB), types
│       ├── auth/              ← sesión (useAuth, AuthProvider) y apertura del login (useOpenAuthDialog)
│       ├── lib/               ← categorías y formato (fechas, notas, etiquetas en español)
│       ├── lib/               ← (también images.ts: tamaños de las portadas de TMDB)
│       ├── components/        ← Header, Footer, AuthDialog, MediaCard, Cover, Stars, StarRatingInput...
│       └── pages/             ← HomePage, CategoryPage, ImportPage, NotFoundPage, media/ (detalle y reseñas)
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
    │   ├── integrations/      ← APIs externas: MediaImporter (común), tmdb/, deezer/ e igdb/
    │   ├── health/            ← GET /api/health
    │   └── generated/prisma/  ← cliente Prisma generado (no se versiona)
    └── test/                  ← tests e2e
```


## 4. Entornos

### Local

| Pieza | Cómo corre | Dirección |
|---|---|---|
| PostgreSQL | Docker (`docker compose up -d`) | `localhost:5433` (el 5432 lo usa otro proyecto) |
| Backend | `npm run start:dev` en `backend/` (hot reload) | `http://localhost:3000/api` |
| Frontend | `npm run dev` en `frontend/` (hot reload, proxy de `/api` a `:3000`) | `http://localhost:5173` |

Solo la base de datos está dockerizada. El back y el front corren con Node directamente para tener hot reload.

### Producción (planeado)

| Pieza | Servicio | Notas |
|---|---|---|
| Frontend | Render **Static Site** | `npm run build` y se sirve `dist/`. Reglas *rewrite*, en este orden: `/api/*` → URL del Web Service + `/api/*`, y `/*` → `/index.html` (para que `/peliculas` u `/obra/...` funcionen al recargar). |
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
| `IntegrationsModule` | APIs externas: TMDB (películas y series), Deezer (álbumes y canciones) e IGDB (videojuegos). Búsqueda e importación. Detalles en [Integraciones](#integraciones-con-apis-externas). |
| `HealthModule` | `GET /api/health` con Terminus: hace ping a la base de datos (`SELECT 1`, timeout de 3 s). Público y sin rate limit. |
| `ObserveModule` | Telemetría de NestJS Observe, incluida en la plantilla. Inactiva hasta que se vincule con `npx @nestjs/observe link`. |

### Transversal (configurado en `main.ts` y `AppModule`)

- **Validación**: `StandardSchemaValidationPipe` global. Solo valida los parámetros que declaran un esquema, por ejemplo `@Body({ schema: registerSchema })`. Los esquemas son de Zod y el tipo del DTO se infiere con `z.infer`. Zod está configurado en español (`z.locales.es()`). Si la validación falla, responde `400` con un mensaje por campo (`"email: Email inválido"`).
- **Errores**: `AllExceptionsFilter` (`APP_FILTER`) da a todas las respuestas de error la misma forma (ver [§7](#7-api)). Traduce errores de Prisma: `P2002` (único duplicado) → `409`, `P2003` (FK inválida) → `409`, `P2025` (no encontrado) → `404`. Cualquier otro error responde `500` con un mensaje genérico y se registra en el log, sin exponer detalles.
- **Guards globales**, en este orden:
  1. `ThrottlerGuard`: rate limiting.
  2. `OriginGuard`: CSRF. Rechaza con `403` las peticiones `POST`, `PUT`, `PATCH` y `DELETE` cuyo `Origin` no esté en `CORS_ORIGINS` ni sea el de la propia API (así Swagger puede hacer login).
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

### Integraciones con APIs externas

**Flujo: importar bajo demanda.** El usuario busca en el proveedor, elige un resultado y la app lo guarda en la base con su ID externo. Desde ahí es una obra más del catálogo: se lista, se reseña y se muestra sin volver a llamar al proveedor.

**Piezas** (`src/integrations/`):
- `ImportedMedia` (`imported-media.ts`): formato común al que cada proveedor traduce sus datos (campos de la obra, detalles del tipo, nombres de géneros, créditos con su ID externo, IDs externos de la obra).
- `MediaImporter` (`media-importer.service.ts`): guarda un `ImportedMedia`, sin saber de qué proveedor viene.
  - **Es idempotente**: si el ID externo ya existe, devuelve la obra existente sin llamar al proveedor.
  - **Géneros**: los busca por nombre (sin distinguir mayúsculas) o por slug, y crea los que falten. "Ciencia ficción" de TMDB coincide con el género del seed; "Suspense" o "Aventura" se crean nuevos.
  - **Creadores**: los busca por su ID externo (`CreatorExternalId`) y crea los que falten, así un director no se duplica entre películas.
  - **Valida** los datos con `createMediaSchema`, los mismos esquemas que la API. Si el proveedor manda algo inválido, responde `502` y lo registra en el log.
  - **Concurrencia**: la obra y su ID externo se crean en la misma sentencia; si dos personas importan lo mismo a la vez, la segunda choca con la restricción única y recibe la obra ya creada (probado con 3 importaciones simultáneas).
- Cada proveedor tiene su carpeta con cliente HTTP, tipos de sus respuestas, *mapper* (funciones puras, probadas sin red) y servicio.

**TMDB** (`src/integrations/tmdb/`):
- Autenticación con el *API Read Access Token* en la cabecera `Authorization: Bearer` (`TMDB_ACCESS_TOKEN`). El token nunca sale del back. Sin token, sus endpoints responden `503` y el resto de la app funciona igual.
- Idioma `es-CL`. Si no hay sinopsis en español, se usa la de inglés.
- IDs externos: la obra se guarda como `tmdb` / `movie:<id>` o `tv:<id>` (películas y series tienen numeraciones distintas en TMDB) y, si existe, `imdb` / `tt...`. Las personas como `tmdb` / `person:<id>`.
- Datos que se toman:
  - Películas: título, título original, sinopsis, estreno, póster, fondo, idioma, país, géneros, duración, clasificación por edad (Chile, o EE. UU. si Chile no tiene), tráiler de YouTube (en español si hay), dirección y hasta 3 guionistas.
  - Series: lo mismo, más estado, temporadas, episodios, cadena, fecha de fin (solo si terminó) y creadores (`SHOWRUNNER`).
- Imágenes: se guarda la URL de TMDB con el póster en `w500`, el fondo en `w1280` y las fotos de personas en `w185`. El front cambia el tamaño en la URL según dónde la muestre (ver [Frontend](#5b-frontend)).
- Errores: `404` si el ID no existe en TMDB; `503` si TMDB no responde (8 s de espera), limita las peticiones o rechaza el token (esto último se registra en el log).

**Deezer** (`src/integrations/deezer/`):
- API pública: **no necesita clave ni registro**. Límite de ~50 peticiones cada 5 s por IP. Deezer responde `200` incluso con errores, con `{ "error": { code } }` en el cuerpo: el cliente lo traduce (`800` → `404`, `4` → `503` por límite).
- IDs externos: `deezer` / `album:<id>`, `track:<id>`, `artist:<id>`. Además, `upc` para álbumes e **`isrc` para canciones**: el ISRC identifica la grabación, así que la misma canción en dos álbumes (el original y un recopilatorio) es **una sola obra** con sus reseñas. Las versiones remasterizadas tienen otro ISRC y quedan como obras distintas.
- **Importar un álbum** crea el álbum, cada una de sus canciones (o reutiliza las que ya existan por ID de Deezer o ISRC) y su lista de canciones con disco y número de pista. Si una canción falla, se importan las demás y se registra en el log.
- **Importar una canción importa su álbum completo**, para que tenga "Aparece en" y el álbum quede con su lista. Si el álbum ya existía sin esa canción (p. ej. el del seed, que tiene solo 6), la canción se importa sola y se agrega al álbum en su posición.
- Datos que se toman: título, fecha, portada (500×500), géneros, tipo (álbum, EP, sencillo o recopilatorio), sello, artista principal y colaboradores (`PRIMARY_ARTIST`, `FEATURED_ARTIST`); en canciones, duración, si es explícita y su artista principal. Las canciones heredan la fecha, la portada y los géneros del álbum.
- **No se guarda la preview de 30 s**: Deezer firma esas URLs y caducan.
- Deezer no distingue personas de grupos: los artistas se crean como `PERSON` (un ADMIN puede corregirlo).

**IGDB** (`src/integrations/igdb/`):
- Autenticación con una app de Twitch (`IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`) mediante *client credentials*: el back pide un token a Twitch (dura ~60 días), lo guarda en memoria y lo renueva un día antes de que caduque o si IGDB responde `401`. Si varias peticiones necesitan token a la vez, comparten la misma solicitud. El secret va en el cuerpo de la petición, no en la URL, para que no quede en logs. Sin credenciales, `/api/igdb/*` responde `503`.
- Las consultas usan el lenguaje de IGDB (Apicalypse). **El texto de búsqueda se escapa** (`quote()`), para que comillas o barras no alteren la consulta.
- La búsqueda solo incluye juegos principales, expansiones, expansiones independientes, remakes, remasters, juegos ampliados y ports (`IMPORTABLE_GAME_TYPES`): quedan fuera mods, DLC sueltos, paquetes, episodios, temporadas, forks y actualizaciones. IGDB responde `200` con `[]` cuando un ID no existe: se traduce a `404`.
- IDs externos: `igdb` / `game:<id>` y `company:<id>`.
- Datos que se toman: título, sinopsis (**solo existe en inglés**), fecha, portada (`t_cover_big_2x`), fondo (primer *artwork* o captura, `t_1080p`), géneros, plataformas, modos de juego, tráiler de YouTube, desarrolladoras (`DEVELOPER`) y distribuidoras (`PUBLISHER`) como `COMPANY`, con su logo.
- **Géneros, modos y plataformas se traducen** con tablas (`igdb.mapper.ts`): "Adventure" → "Aventura" (coincide con TMDB), "Platform" → "Plataformas", "Single player" → "Un jugador", "PC (Microsoft Windows)" → "PC". Los que no están en la tabla se guardan en inglés.

### Prisma 7

- `schema.prisma` no lleva URL. La CLI la toma de `prisma.config.ts` (`DIRECT_URL`) y la app la pasa al adapter en `PrismaService` (`DATABASE_URL`).
- El cliente se genera en `src/generated/prisma` con el generator `prisma-client` (ESM). Se importa desde `../generated/prisma/client.js`.
- `migrate dev` no regenera el cliente. Después de migrar hay que ejecutar `npm run db:generate`.
- **Seed** (`prisma/seed.ts`, se ejecuta con tsx): **borra todos los datos** y crea 3 usuarios (`admin@opinai.local` con rol ADMIN, `ana@opinai.local` y `bruno@opinai.local`, todos con la contraseña **`opinai123`**), 7 géneros, 5 creadores, 11 obras (2 películas, 1 serie, 1 álbum con 6 canciones, 1 juego) y 9 reseñas (una sin nota), y calcula las estadísticas de cada obra. *Parásitos*, *La llegada*, *Breaking Bad* y sus directores o creadores llevan su **ID real de TMDB**; Radiohead, *OK Computer* y sus 6 canciones, su **ID de Deezer** (y el ISRC de cada canción); *Hollow Knight* y Team Cherry, su **ID de IGDB**. Así, importarlos devuelve la obra del seed en vez de duplicarla. Se puede repetir sin problemas. **Solo corre contra una base local** (`localhost`, `127.0.0.1` o `::1`) y nunca con `NODE_ENV=production` (`prisma/seed-guard.ts`). Así, aunque el `.env` local apunte a Supabase, no puede borrar producción ni crear un ADMIN con contraseña conocida.

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

## 5b. Frontend

SPA de React con Vite y React Router. Permite explorar el catálogo por categoría, ver cada obra y escribir reseñas y valoraciones, además del registro, el inicio y el cierre de sesión. Todavía no hay búsqueda, perfiles de usuario, páginas de creadores ni administración.

### Rutas

| Ruta | Página | Qué muestra |
|---|---|---|
| `/` | `HomePage` | Titular y las 4 categorías: Películas, Series, Música y Videojuegos. |
| `/peliculas`, `/series`, `/musica`, `/videojuegos` | `CategoryPage` | Rejilla de obras del tipo, con orden (`?orden=recent\|rating\|popular\|title`) y paginación (`?pagina=`, 24 por página). Música tiene dos pestañas, Álbumes y Canciones (`?ver=albumes\|canciones`). Las categorías se definen en `src/lib/categories.ts`. |
| `/peliculas/agregar`, `/series/agregar`, `/musica/agregar`, `/videojuegos/agregar` | `ImportPage` | Buscador de la fuente de la categoría (con sesión): TMDB para películas y series, IGDB para videojuegos, Deezer para música, con pestañas Álbumes y Canciones (`?tipo=albumes\|canciones`). Cada resultado tiene "Agregar", que importa la obra y lleva a su página, o "Ver" si ya está en el catálogo. La categoría enlaza aquí con "+ Agregar desde TMDB/Deezer/IGDB". Las fuentes se configuran en `importer` de cada categoría (`src/lib/categories.ts`) y `src/api/importers.ts` unifica sus respuestas. |
| `/obra/:slug` | `MediaDetailPage` | Portada, nota promedio, sinopsis, créditos, géneros y datos del tipo (duración, temporadas, plataformas...). Canciones del álbum o álbumes de la canción, con enlaces. Tu reseña y la lista de reseñas. |
| cualquier otra | `NotFoundPage` | "No encontrado". |

La cabecera tiene enlaces a las 4 categorías en todas las páginas.

### Reseñas en el front

- **Con sesión**, el detalle muestra un formulario (`ReviewForm`) con nota de 0,5 a 5 estrellas (`StarRatingInput`: 1–10 en la API), título, texto y "contiene spoilers". Se puede dejar solo nota, solo texto o ambos; el front valida las mismas reglas que el back antes de enviar. Si ya existe `myReview`, el formulario es de edición y permite borrarla.
- **Sin sesión**, en su lugar aparecen botones para iniciar sesión o crear cuenta, que abren la misma ventana de la cabecera.
- Al guardar o borrar, se vuelve a pedir el detalle (nota promedio y `myReview`) y la lista de reseñas.
- **La lista** (`ReviewList`) se ordena por fecha o nota, filtra "solo con texto" y pagina de 10 en 10. Las reseñas con spoilers ocultan el texto hasta pulsar "Mostrar".
- Las notas se muestran como estrellas (redondeo a media estrella) y como número de 0 a 5 con un decimal ("4,8").
- Las obras sin portada muestran la inicial del título sobre un color según el tipo (`Cover`). Lo mismo si la imagen no carga (por ejemplo, si el proveedor la borró).
- **Tamaño de las portadas**: `imageSrc()` (`src/lib/images.ts`) cambia el tamaño en las URLs de TMDB (`w185` en resultados de búsqueda, `w342` en la rejilla, `w500` en el detalle) de Deezer (`250x250` en resultados, `500x500` en rejilla y detalle) y de IGDB (`t_cover_small_2x`, `t_cover_big`, `t_cover_big_2x`). Las URLs de otros orígenes se usan tal cual.
- El detalle enlaza al tráiler si la obra lo tiene.
- **Pie de página** con la atribución que exige TMDB ("Este producto usa la API de TMDB, pero no está avalado ni certificado por TMDB") y las de Deezer e IGDB.

### Datos

`useApi(path, key?)` (`src/api/use-api.ts`) hace el `GET` y devuelve `{ data, error, loading, reload }`. Mientras carga una página nueva conserva los datos anteriores (la rejilla se atenúa en vez de vaciarse). `key` fuerza a volver a pedir: el detalle usa el ID del usuario, para traer `myReview` al iniciar o cerrar sesión. No hay caché entre páginas.

### Cómo habla con el back

- `api()` (`src/api/client.ts`) hace `fetch` a `/api/...` **en el mismo origen** con `credentials: 'same-origin'`, así que la cookie de sesión viaja sola. Nunca se usa la URL del back directamente.
- En local, el proxy de Vite reenvía `/api` a `http://localhost:3000`. El puerto 5173 es fijo (`strictPort`) porque el back solo acepta escrituras desde los orígenes de `CORS_ORIGINS`.
- Si la respuesta no es correcta, lanza `ApiError` con el `status` y el `message` del back (los errores de validación se unen en líneas). Si no hay conexión, `status` 0 y "No se pudo conectar con el servidor".

### Sesión

- `AuthProvider` (`src/auth/AuthProvider.tsx`) llama a `GET /api/auth/me` al cargar: `200` → `authenticated`, `401` → `anonymous`. Mientras tanto el estado es `loading` y la cabecera no muestra botones, para evitar un parpadeo.
- `useAuth()` da `{ state, login, register, logout }`. `login` llama a `POST /api/auth/login` y `register` a `POST /api/auth/register` (que deja la sesión iniciada); ambos guardan el usuario. `logout` llama a `POST /api/auth/logout` (si la sesión ya había caducado, igual sale).
- La cookie es `httpOnly`: el front nunca ve el token, solo sabe quién es el usuario por `/auth/me`.

### Interfaz

- `Header`: marca, enlaces a las categorías, y "Iniciar sesión" y "Crear cuenta", o el nombre del usuario con "Cerrar sesión".
- `AuthDialogProvider` monta la ventana de login una sola vez; cualquier componente la abre con `useOpenAuthDialog()('login' | 'register')`.
- `AuthDialog`: `<dialog>` nativo con dos modos, login y registro, que se alternan desde la misma ventana (el email se conserva). Gestiona el foco y se cierra con Escape o clic fuera. El registro pide email, nombre de usuario, contraseña y nombre visible opcional; el navegador valida las mismas reglas que el back (usuario de 3 a 30 caracteres `A-Z a-z 0-9 _`, contraseña de 8 a 128). Muestra el mensaje de error del back (`400` por campo, `401`, `409` email o usuario en uso, `429`).
- Estilos en `index.css` con variables de color para tema claro y oscuro (`prefers-color-scheme`).

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
    Creator ||--o{ CreatorExternalId : "se identifica en"
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
| `ExternalId` | `external_ids` | IDs de la obra en servicios externos: `tmdb` (`movie:496243`, `tv:1396`), `imdb` (`tt6751668`), `deezer` (`album:14879699`, `track:138539981`), `upc`, `isrc` e `igdb` (`game:14593`). Único por proveedor e ID, y una obra tiene como mucho uno por proveedor. |
| `CreatorExternalId` | `creator_external_ids` | Lo mismo para creadores (`tmdb` / `person:21684`, `deezer` / `artist:399`, `igdb` / `company:7263`), para no duplicarlos entre importaciones. |

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

### Integraciones

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/tmdb/search` | 🔒 | Busca en TMDB. Query: `type` (`MOVIE` o `SERIES`), `q`, `page` (TMDB devuelve 20 por página). Cada resultado: `{ tmdbId, type, title, originalTitle, year, overview, posterUrl, importedSlug }`; `importedSlug` indica si ya está en el catálogo. Límite: 60 por minuto. |
| `POST` | `/api/tmdb/imports` | 🔒 | Importa `{ type, tmdbId }`. `201` `{ created: true, media }` si se agregó ahora, `200` `{ created: false, media }` si ya estaba. `media` tiene la forma del detalle. Límite: 30 cada 10 minutos. `404` si no existe en TMDB, `503` si TMDB no está disponible o falta el token. |

| `GET` | `/api/deezer/search` | 🔒 | Busca en Deezer. Query: `type` (`ALBUM` o `TRACK`), `q`, `page` (20 por página, hasta 50 páginas). Cada resultado: `{ deezerId, type, title, artist, albumTitle, detail, coverUrl, explicit, importedSlug }` (`detail`: "Álbum · 12 canciones" o la duración). Límite: 60 por minuto. |
| `POST` | `/api/deezer/imports` | 🔒 | Importa `{ type, deezerId }`. Un álbum se importa con sus canciones; una canción, con su álbum. `201` si se agregó ahora, `200` si ya estaba. Límite: 30 cada 10 minutos. `404` si no existe en Deezer. |

| `GET` | `/api/igdb/search` | 🔒 | Busca juegos en IGDB. Query: `q`, `page` (20 por página, hasta 50 páginas). Cada resultado: `{ igdbId, type, title, developer, year, platforms, overview, coverUrl, importedSlug }`. Límite: 60 por minuto. |
| `POST` | `/api/igdb/imports` | 🔒 | Importa `{ igdbId }`. `201` si se agregó ahora, `200` si ya estaba. Límite: 30 cada 10 minutos. `404` si no existe en IGDB, `503` si IGDB no está disponible o faltan las credenciales. |

Requieren sesión para no gastar la cuota de los proveedores con visitas anónimas, pero **cualquier usuario** puede importar, no solo los ADMIN. Las respuestas de búsqueda de ambos tienen la misma paginación: `{ items, page, totalPages, total }`.

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
| `TMDB_ACCESS_TOKEN` | *API Read Access Token* de TMDB (themoviedb.org → Settings → API). Opcional: sin él, `/api/tmdb/*` responde `503`. Vacío cuenta como no definido. **No se sube al repo.** | el tuyo | el mismo, como variable de Render |
| `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` | Credenciales de una app de Twitch (dev.twitch.tv/console/apps, tipo *Confidential*, redirect `http://localhost`) para IGDB. Opcionales, pero **van juntas**: si solo hay una, la app no arranca. Sin ellas, `/api/igdb/*` responde `503`. **No se suben al repo.** | las tuyas | las mismas, como variables de Render |
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
- **El front tiene pocas dependencias**: React Router para las rutas y nada más. Los datos se piden con un hook propio (`useApi`) en vez de React Query, y los estilos son CSS plano con variables. Si aparecen necesidades como caché entre páginas, se puede pasar a React Query.
- **Las imágenes de los proveedores no se descargan ni se guardan**: se guarda su URL y el navegador las pide directo a su CDN, igual en local y en producción. Solo se usaría almacenamiento propio (Supabase Storage) para imágenes que suban los usuarios.
- **Una API principal por tipo de medio**: TMDB para películas y series, Deezer para música e IGDB para videojuegos. Para videojuegos se eligió IGDB frente a RAWG (más simple, solo una clave, pero con datos menos completos y sin modos de juego fiables). Todas pasan por el mismo `MediaImporter`. Para música se eligió Deezer frente a MusicBrainz (más rigurosa pero compleja y con 1 petición/s), Apple iTunes Search (alternativa si Deezer falla) y Spotify (restringe apps nuevas y guardar sus datos).
- **Las canciones se identifican por ISRC** además de por su ID en Deezer, para que una misma grabación en varios álbumes sea una sola obra.
- **Cualquier usuario con sesión puede importar**, para que el catálogo crezca con lo que la gente quiere reseñar. Los datos vienen de TMDB, así que el riesgo de abuso es bajo; hay rate limit.
- **Las rutas del front están en español** (`/peliculas`, `/obra/:slug`), las de la API en inglés (`/api/media`).
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
- **Las obras importadas no se actualizan**: si en TMDB cambia algo (una serie suma temporadas), la copia local queda igual. Falta un refresco periódico o manual.
- **Géneros duplicados por nombre**: TMDB llama "Suspense" a lo que el seed llama "Thriller", y quedan como dos géneros distintos.
- **Atribución en texto**: el pie de página cita a TMDB con texto y enlace, pero sus guías piden además su logo.
- **Términos de uso de TMDB**: guardamos sus datos en nuestra base; hay que confirmar en sus términos que está permitido y por cuánto tiempo.
- **Deezer no tiene un acuerdo formal de uso** para su API pública: podría cambiar o cerrarse sin aviso. El reemplazo previsto es Apple iTunes Search o MusicBrainz, con otro *mapper*.
- **Los artistas de Deezer se crean como `PERSON`**, aunque sean grupos.
- **Las sinopsis de los videojuegos están en inglés**: IGDB no tiene traducciones. Steam podría complementarlas para juegos de PC.
- **IGDB incluye algunos juegos de fans clasificados como "principales"** (p. ej. un "Hollow Knight Silksong" de 2021 que no es de Team Cherry); no se pueden filtrar.
- **Las canciones solo guardan su artista principal**; los colaboradores de cada canción requerirían una petición por canción.

## 10. Estado y próximos pasos

**Hecho**
- [x] Back NestJS con Prisma y Postgres local en Docker
- [x] Modelos de datos y migración inicial
- [x] `GET /api/health`
- [x] Configuración validada, validación global con Zod, CORS y formato uniforme de errores
- [x] Seed con datos de ejemplo
- [x] Autenticación: registro, login, logout, sesión actual, roles, rate limit y protección CSRF
- [x] API REST: catálogo (obras, creadores, géneros), reseñas con nota opcional, perfiles de usuario y Swagger
- [x] Frontend: categorías, listados con orden y paginación, detalle de obras y reseñas (crear, editar, borrar), registro e inicio de sesión
- [x] Integración con TMDB: búsqueda e importación de películas y series, desde la API y desde el front
- [x] Integración con Deezer: búsqueda e importación de álbumes (con sus canciones) y canciones (con su álbum), desde la API y desde el front
- [x] Integración con IGDB: búsqueda e importación de videojuegos, desde la API y desde el front
- [x] Endurecimiento: `NODE_ENV` obligatoria, seed solo en local, argon2 con límite de memoria, bloqueo por cuenta y `CORS_ORIGINS` obligatoria en producción

**Pendiente**
- [ ] Frontend: búsqueda, perfiles de usuario, páginas de creadores y sección de administración
- [ ] Script para dar rol ADMIN a un usuario (necesario antes de desplegar)
- [ ] Recuperar contraseña y verificar email (requiere servicio de correo)
- [ ] Login con Google o GitHub
- [ ] Despliegue en Render y Supabase
