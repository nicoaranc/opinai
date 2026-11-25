# Arquitectura de opinai

> Documento vivo: se actualiza cada vez que se agrega o cambia una parte del sistema.
> Última actualización: 2026-11-25 (configuración, validación, errores y seed)

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
    F -->|HTTP / JSON| B["Backend<br/>NestJS<br/>(Render Web Service)"]
    B -->|Prisma + pg| D[("PostgreSQL<br/>(Supabase)")]
    B -.->|futuro| X["APIs externas<br/>TMDB, OMDb, MusicBrainz,<br/>IGDB, RAWG..."]
```

- El **frontend** es una SPA estática. No accede a la base de datos ni a APIs externas con credenciales.
- El **backend** expone una API REST, contiene la lógica de negocio y es el único que habla con la base de datos (y en el futuro con las APIs externas).
- La **base de datos** es PostgreSQL. Las obras importadas de APIs externas se guardarán localmente (ver [§9](#9-decisiones-de-diseño)).

## 2. Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | React + Vite + TypeScript | _pendiente_ |
| Backend | NestJS (ESM) + TypeScript | Nest 12, TS 6 |
| ORM | Prisma con driver adapter `@prisma/adapter-pg` | 7.10.1 |
| Base de datos | PostgreSQL | 17 (local) |
| Configuración | `@nestjs/config` + Zod | 12.1 / 4 |
| Validación | `StandardSchemaValidationPipe` (Nest) + Zod | |
| Health checks | `@nestjs/terminus` | 12.2 |
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
    ├── prisma.config.ts       ← config de la CLI de Prisma (schema, migraciones, URL)
    ├── prisma/
    │   ├── schema.prisma      ← modelos
    │   ├── seed.ts            ← datos de ejemplo (npm run db:seed)
    │   └── migrations/        ← migraciones SQL versionadas
    ├── src/
    │   ├── main.ts            ← arranque: CORS, validación global, PORT
    │   ├── app.module.ts      ← módulo raíz (config, filtro de errores)
    │   ├── config/env.ts      ← esquema Zod de las variables de entorno
    │   ├── common/filters/    ← AllExceptionsFilter (formato de errores)
    │   ├── prisma/            ← PrismaModule (global) + PrismaService
    │   ├── health/            ← GET /health
    │   └── generated/prisma/  ← cliente Prisma generado (no se versiona)
    └── test/                  ← tests e2e
```

El frontend irá en `frontend/` cuando se cree.

## 4. Entornos

### Local

| Pieza | Cómo corre | Dirección |
|---|---|---|
| PostgreSQL | Docker (`docker compose up -d`) | `localhost:5433` (el 5432 lo usa otro proyecto) |
| Backend | `npm run start:dev` en `backend/` (hot reload) | `http://localhost:3000` |
| Frontend | _pendiente_ (`npm run dev`) | `http://localhost:5173` |

Solo la base de datos está dockerizada. El back y el front corren con Node directamente para tener hot reload.

### Producción (planeado)

| Pieza | Servicio | Notas |
|---|---|---|
| Frontend | Render **Static Site** | `npm run build` y se sirve `dist/` |
| Backend | Render **Web Service** (runtime Node, sin Docker) | Health check en `/health`. En el plan gratis se duerme tras unos 15 minutos sin tráfico. |
| Base de datos | Supabase | La app usa el *Transaction pooler* (6543) y las migraciones el *Session pooler* (5432, compatible con IPv4). |

Build del backend en Render: `npm ci && npx prisma migrate deploy && npm run build` (el `postinstall` ya ejecuta `prisma generate`). Start: `npm run start:prod`.

## 5. Backend

NestJS en modo **ESM**: los imports relativos terminan en `.js`.

### Módulos

| Módulo | Responsabilidad |
|---|---|
| `AppModule` | Raíz. Importa el resto, registra el filtro global de errores e incluye `AppController` de ejemplo (`GET /`). |
| `ConfigModule` | **Global**. Carga `.env` y valida las variables con el esquema Zod de `src/config/env.ts`. Si falta una obligatoria o es inválida, la app no arranca. Se lee con `ConfigService<Env, true>`. |
| `PrismaModule` | **Global**. Expone `PrismaService` (un `PrismaClient` con el adapter `pg`, que conecta usando `DATABASE_URL` desde `ConfigService`). |
| `HealthModule` | `GET /health` con Terminus: hace ping a la base de datos (`SELECT 1`, timeout de 3 s). |
| `ObserveModule` | Telemetría de NestJS Observe, incluida en la plantilla. Inactiva hasta que se vincule con `npx @nestjs/observe link`. |

### Transversal (configurado en `main.ts` y `AppModule`)

- **Validación**: `StandardSchemaValidationPipe` global. Solo valida los parámetros que declaran un esquema, por ejemplo `@Body({ schema: createReviewSchema })`. Los esquemas son de Zod y el tipo del DTO se infiere con `z.infer`. Si la validación falla, responde `400` con un mensaje por campo (`"rating: Too big..."`).
- **Errores**: `AllExceptionsFilter` (`APP_FILTER`) da a todas las respuestas de error la misma forma (ver [§7](#7-api)). Traduce errores de Prisma: `P2002` (único duplicado) → `409`, `P2003` (FK inválida) → `409`, `P2025` (no encontrado) → `404`. Cualquier otro error responde `500` con un mensaje genérico y se registra en el log, sin exponer detalles.
- **CORS**: solo se aceptan los orígenes de `CORS_ORIGINS`, con `credentials: true`.
- **Shutdown hooks** activados, para que Prisma cierre conexiones cuando Render detiene el servicio.

### Prisma 7

- `schema.prisma` no lleva URL. La CLI la toma de `prisma.config.ts` (`DIRECT_URL`) y la app la pasa al adapter en `PrismaService` (`DATABASE_URL`).
- El cliente se genera en `src/generated/prisma` con el generator `prisma-client` (ESM). Se importa desde `../generated/prisma/client.js`.
- `migrate dev` no regenera el cliente. Después de migrar hay que ejecutar `npm run db:generate`.
- **Seed** (`prisma/seed.ts`, se ejecuta con tsx): **borra todos los datos** y crea 3 usuarios (`admin`, `ana`, `bruno`), 7 géneros, 5 creadores, 11 obras (2 películas, 1 serie, 1 álbum con 6 canciones, 1 juego) y 8 reseñas. Se puede repetir sin problemas y se niega a correr con `NODE_ENV=production`. Los usuarios del seed tienen un `passwordHash` de relleno y no pueden iniciar sesión.

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

Fuente de verdad: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). Todos los IDs son UUID v7.

```mermaid
erDiagram
    User ||--o{ Review : escribe
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
| `User` | `users` | Quien reseña y valora. Rol `USER` o `ADMIN`. |
| `Media` | `media` | Todo lo reseñable. `type`: `MOVIE`, `SERIES`, `ALBUM`, `TRACK`, `GAME`. Campos comunes: título, sinopsis, fecha, portada, idioma, país. |
| `MovieDetails` … `GameDetails` | `*_details` | Datos propios de cada tipo, en relación 1:1 con `Media`. |
| `AlbumTrack` | `album_tracks` | Lista de canciones de un álbum (disco y número de pista). Una canción puede estar en varios álbumes. |
| `Creator` | `creators` | Personas, grupos o empresas (`PERSON`, `GROUP`, `COMPANY`). |
| `Credit` | `credits` | Une `Media` con `Creator` y un rol: `DIRECTOR`, `SHOWRUNNER`, `WRITER`, `PRIMARY_ARTIST`, `FEATURED_ARTIST`, `PRODUCER`, `DEVELOPER`, `PUBLISHER`. |
| `Genre` | `genres` | Géneros (relación muchos a muchos con `Media`). |
| `Review` | `reviews` | Una por usuario y obra. Puntuación de 1 a 10 (0,5–5 estrellas). Si no tiene `body`, es solo una valoración. |
| `ExternalId` | `external_ids` | IDs de la obra en servicios externos (`tmdb`, `igdb`…). Todavía no se usa. |

## 7. API

| Método | Ruta | Descripción | Respuesta |
|---|---|---|---|
| `GET` | `/` | Ejemplo de la plantilla | `Hello World!` |
| `GET` | `/health` | Estado del servicio y de la base de datos | `200` `{ status: "ok", info: { database: { status: "up" } } }` · `503` si la base no responde |

### Formato de errores

Todas las respuestas de error tienen esta forma:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Recurso no encontrado",
  "path": "/media/abc",
  "timestamp": "2026-11-25T23:05:14.569Z"
}
```

`message` es un string, o un array de strings cuando son errores de validación (uno por campo).

## 8. Variables de entorno

Backend (`backend/.env`, plantilla en `backend/.env.example`). Se validan al arrancar (`src/config/env.ts`), excepto `DIRECT_URL`, que solo usa la CLI de Prisma.

| Variable | Uso | Local | Supabase |
|---|---|---|---|
| `DATABASE_URL` | Conexión de la app | `postgresql://opinai:opinai@localhost:5433/opinai` | Transaction pooler (6543) |
| `DIRECT_URL` | Migraciones (CLI de Prisma) | la misma | Session pooler (5432) |
| `NODE_ENV` | `development`, `production` o `test` (por defecto `development`) | — | `production` |
| `PORT` | Puerto HTTP (por defecto `3000`) | `3000` | lo asigna Render |
| `CORS_ORIGINS` | Orígenes permitidos, separados por comas (por defecto `http://localhost:5173`) | `http://localhost:5173` | URL del front en Render |
| `OBSERVE_APP_KEY` / `OBSERVE_APP_SECRET` | NestJS Observe (opcional) | — | — |

## 9. Decisiones de diseño

- **Una tabla `Media` y detalles por tipo.** Reseñas, géneros y créditos apuntan a una sola tabla. Los campos propios de cada tipo quedan tipados en tablas 1:1 en vez de un JSON.
- **Álbumes y canciones son `Media` independientes**, así que cada uno tiene sus propias reseñas. `AlbumTrack` los relaciona.
- **Reseña y valoración en un solo modelo.** Si `body` está vacío, es solo una puntuación. Hay una por usuario y obra (`@@unique([userId, mediaId])`).
- **Créditos con rol** en vez de un campo "director" o "artista". Permite varios creadores y roles por obra.
- **Sin Docker para back y front en producción.** Render los ejecuta de forma nativa; Docker solo se usa para la base de datos local.
- **APIs externas (futuro): importar bajo demanda y guardar en la base**, identificando cada obra por `ExternalId`, en vez de consultar la API en cada petición.
- **El rango de `rating` (1–10) se valida en la aplicación.** Prisma no declara restricciones `CHECK`.
- **Validación con Zod (Standard Schema) en vez de `class-validator`.** Es el enfoque nativo de Nest 12: sin clases ni decoradores, y el mismo esquema da el tipo TypeScript. También se usa para las variables de entorno.
- **Los errores 500 nunca exponen detalles al cliente.** Se registran en el log del servidor.

## 10. Estado y próximos pasos

**Hecho**
- [x] Back NestJS con Prisma y Postgres local en Docker
- [x] Modelos de datos y migración inicial
- [x] `GET /health`
- [x] Configuración validada, validación global con Zod, CORS y formato uniforme de errores
- [x] Seed con datos de ejemplo

**Pendiente**
- [ ] Frontend (React + Vite)
- [ ] Autenticación de usuarios
- [ ] CRUD de obras, creadores y reseñas
- [ ] Integración con APIs externas
- [ ] Despliegue en Render y Supabase
