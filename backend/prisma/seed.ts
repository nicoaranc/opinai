// Datos de ejemplo para desarrollo: `npm run db:seed`.
// Borra todo y lo vuelve a crear, así que se puede ejecutar varias veces.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AlbumType,
  CreatorKind,
  CreditRole,
  MediaType,
  PrismaClient,
  SeriesStatus,
  UserRole,
} from '../src/generated/prisma/client.js';
import { PasswordService } from '../src/auth/password.service.js';
import { recomputeMediaStats } from '../src/media/media-stats.js';
import { assertSafeToSeed } from './seed-guard.js';

// Solo contra una base local y nunca en producción (ver seed-guard.ts)
assertSafeToSeed(process.env);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Contraseña de todos los usuarios de prueba (solo para desarrollo local)
export const SEED_PASSWORD = 'opinai123';
const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

const GENRES = {
  drama: 'Drama',
  thriller: 'Thriller',
  crime: 'Crimen',
  'sci-fi': 'Ciencia ficción',
  'alt-rock': 'Rock alternativo',
  metroidvania: 'Metroidvania',
  indie: 'Indie',
} as const;
type GenreSlug = keyof typeof GENRES;

async function reset() {
  // Las reseñas primero; detalles, créditos y listas de canciones caen en cascada desde media
  await prisma.review.deleteMany();
  await prisma.media.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.genre.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await reset();

  // ── Usuarios ────────────────────────────────
  // Mismos parámetros de argon2 que la app
  const passwordHash = await new PasswordService().hash(SEED_PASSWORD);
  const user = (
    username: string,
    displayName: string,
    bio?: string,
    role: UserRole = UserRole.USER,
  ) =>
    prisma.user.create({
      data: {
        email: `${username}@opinai.local`,
        username,
        displayName,
        bio,
        role,
        passwordHash,
      },
    });
  const admin = await user('admin', 'Admin', undefined, UserRole.ADMIN);
  const ana = await user('ana', 'Ana', 'Cine coreano y rock de los 90.');
  const bruno = await user('bruno', 'Bruno', 'Metroidvanias y series largas.');

  // ── Géneros ─────────────────────────────────
  const genreIds = {} as Record<GenreSlug, string>;
  for (const [slug, name] of Object.entries(GENRES) as [GenreSlug, string][]) {
    genreIds[slug] = (await prisma.genre.create({ data: { slug, name } })).id;
  }
  const withGenres = (...slugs: GenreSlug[]) => ({
    connect: slugs.map((slug) => ({ id: genreIds[slug] })),
  });

  // ── Creadores ───────────────────────────────
  const creator = (
    slug: string,
    name: string,
    kind: CreatorKind,
    country: string,
  ) => prisma.creator.create({ data: { slug, name, kind, country } });
  const bong = await creator(
    'bong-joon-ho',
    'Bong Joon-ho',
    CreatorKind.PERSON,
    'KR',
  );
  const gilligan = await creator(
    'vince-gilligan',
    'Vince Gilligan',
    CreatorKind.PERSON,
    'US',
  );
  const villeneuve = await creator(
    'denis-villeneuve',
    'Denis Villeneuve',
    CreatorKind.PERSON,
    'CA',
  );
  const radiohead = await creator(
    'radiohead',
    'Radiohead',
    CreatorKind.GROUP,
    'GB',
  );
  const teamCherry = await creator(
    'team-cherry',
    'Team Cherry',
    CreatorKind.COMPANY,
    'AU',
  );

  // ── Películas ───────────────────────────────
  const parasite = await prisma.media.create({
    data: {
      type: MediaType.MOVIE,
      slug: 'parasite-2019',
      title: 'Parásitos',
      originalTitle: '기생충',
      synopsis:
        'Una familia sin recursos se infiltra, uno a uno, en la casa de una familia adinerada.',
      releaseDate: date('2019-05-30'),
      language: 'ko',
      country: 'KR',
      movie: { create: { runtimeMinutes: 132, ageRating: '+14' } },
      genres: withGenres('drama', 'thriller'),
      credits: {
        create: [
          { creatorId: bong.id, role: CreditRole.DIRECTOR },
          { creatorId: bong.id, role: CreditRole.WRITER, position: 1 },
        ],
      },
    },
  });

  const arrival = await prisma.media.create({
    data: {
      type: MediaType.MOVIE,
      slug: 'arrival-2016',
      title: 'La llegada',
      originalTitle: 'Arrival',
      synopsis:
        'Una lingüista intenta comunicarse con los visitantes de unas naves que aterrizan en la Tierra.',
      releaseDate: date('2016-11-11'),
      language: 'en',
      country: 'US',
      movie: { create: { runtimeMinutes: 116, ageRating: 'PG-13' } },
      genres: withGenres('drama', 'sci-fi'),
      credits: {
        create: [{ creatorId: villeneuve.id, role: CreditRole.DIRECTOR }],
      },
    },
  });

  // ── Series ──────────────────────────────────
  const breakingBad = await prisma.media.create({
    data: {
      type: MediaType.SERIES,
      slug: 'breaking-bad',
      title: 'Breaking Bad',
      synopsis:
        'Un profesor de química con un diagnóstico terminal empieza a fabricar metanfetamina.',
      releaseDate: date('2008-01-20'),
      language: 'en',
      country: 'US',
      series: {
        create: {
          status: SeriesStatus.ENDED,
          seasonsCount: 5,
          episodesCount: 62,
          endDate: date('2013-09-29'),
          network: 'AMC',
          ageRating: '+18',
        },
      },
      genres: withGenres('drama', 'crime', 'thriller'),
      credits: {
        create: [{ creatorId: gilligan.id, role: CreditRole.SHOWRUNNER }],
      },
    },
  });

  // ── Música: álbum y sus canciones ───────────
  const okComputer = await prisma.media.create({
    data: {
      type: MediaType.ALBUM,
      slug: 'radiohead-ok-computer',
      title: 'OK Computer',
      releaseDate: date('1997-05-21'),
      language: 'en',
      country: 'GB',
      album: { create: { albumType: AlbumType.ALBUM, label: 'Parlophone' } },
      genres: withGenres('alt-rock'),
      credits: {
        create: [{ creatorId: radiohead.id, role: CreditRole.PRIMARY_ARTIST }],
      },
    },
  });

  const trackList: [slug: string, title: string, seconds: number][] = [
    ['airbag', 'Airbag', 284],
    ['paranoid-android', 'Paranoid Android', 383],
    ['subterranean-homesick-alien', 'Subterranean Homesick Alien', 267],
    ['exit-music-for-a-film', 'Exit Music (For a Film)', 264],
    ['let-down', 'Let Down', 299],
    ['karma-police', 'Karma Police', 261],
  ];
  const trackIds: string[] = [];
  for (const [index, [slug, title, seconds]] of trackList.entries()) {
    const track = await prisma.media.create({
      data: {
        type: MediaType.TRACK,
        slug: `radiohead-${slug}`,
        title,
        releaseDate: okComputer.releaseDate,
        language: 'en',
        track: { create: { durationSeconds: seconds } },
        genres: withGenres('alt-rock'),
        credits: {
          create: [
            { creatorId: radiohead.id, role: CreditRole.PRIMARY_ARTIST },
          ],
        },
        appearsOnAlbums: {
          create: { albumId: okComputer.id, trackNumber: index + 1 },
        },
      },
    });
    trackIds.push(track.id);
  }
  const paranoidAndroidId = trackIds[1];

  // ── Videojuegos ─────────────────────────────
  const hollowKnight = await prisma.media.create({
    data: {
      type: MediaType.GAME,
      slug: 'hollow-knight',
      title: 'Hollow Knight',
      synopsis:
        'Explora Hallownest, un reino de insectos en ruinas bajo la tierra.',
      releaseDate: date('2017-02-24'),
      country: 'AU',
      game: {
        create: {
          platforms: ['PC', 'Switch', 'PS4', 'Xbox One'],
          gameModes: ['Un jugador'],
        },
      },
      genres: withGenres('metroidvania', 'indie'),
      credits: {
        create: [
          { creatorId: teamCherry.id, role: CreditRole.DEVELOPER },
          { creatorId: teamCherry.id, role: CreditRole.PUBLISHER, position: 1 },
        ],
      },
    },
  });

  // ── Reseñas y valoraciones (sin body = solo valoración) ──
  await prisma.review.createMany({
    data: [
      {
        userId: ana.id,
        mediaId: parasite.id,
        rating: 10,
        title: 'Una obra maestra de tensión',
        body: 'Cambia de género tres veces y funciona en todas. El final no se olvida.',
      },
      { userId: bruno.id, mediaId: parasite.id, rating: 9 },
      {
        userId: bruno.id,
        mediaId: breakingBad.id,
        rating: 10,
        body: 'La transformación de Walter White es de lo mejor que se ha escrito para televisión.',
        containsSpoilers: true,
      },
      { userId: ana.id, mediaId: arrival.id, rating: 8 },
      {
        userId: ana.id,
        mediaId: okComputer.id,
        rating: 10,
        title: 'Sigue sonando a futuro',
        body: 'Un disco sobre la ansiedad tecnológica que envejeció demasiado bien.',
      },
      {
        userId: ana.id,
        mediaId: paranoidAndroidId,
        rating: 10,
        body: 'Seis minutos y medio, cuatro canciones en una.',
      },
      {
        userId: bruno.id,
        mediaId: hollowKnight.id,
        rating: 9,
        title: 'Difícil y precioso',
        body: 'El mapa más satisfactorio del género. Algunos jefes opcionales son crueles.',
      },
      { userId: admin.id, mediaId: hollowKnight.id, rating: 8 },
      // Reseña sin nota
      {
        userId: bruno.id,
        mediaId: arrival.id,
        body: 'No sé qué nota ponerle: la vi una sola vez y me dejó pensando días.',
      },
    ],
  });

  // Estadísticas de cada obra (en la app las recalcula cada alta de reseña)
  for (const { id } of await prisma.media.findMany({ select: { id: true } })) {
    await prisma.$transaction((tx) => recomputeMediaStats(tx, id));
  }

  console.log('Seed completado:', {
    users: await prisma.user.count(),
    media: await prisma.media.count(),
    creators: await prisma.creator.count(),
    genres: await prisma.genre.count(),
    reviews: await prisma.review.count(),
  });
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
