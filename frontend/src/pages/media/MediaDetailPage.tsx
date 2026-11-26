import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import type { MediaDetail } from '../../api/types'
import { useApi } from '../../api/use-api'
import { useAuth } from '../../auth/auth-context'
import { useOpenAuthDialog } from '../../auth/auth-dialog'
import { Cover } from '../../components/Cover'
import { Stars } from '../../components/Stars'
import { ErrorState, Loading } from '../../components/Status'
import { categoryForType } from '../../lib/categories'
import {
  ALBUM_TYPE_LABELS,
  ROLE_LABELS,
  SERIES_STATUS_LABELS,
  TYPE_LABELS,
  duration,
  longDate,
  plural,
  runtime,
  starsText,
  year,
} from '../../lib/format'
import { NotFoundPage } from '../NotFoundPage'
import { ReviewForm } from './ReviewForm'
import { ReviewList } from './ReviewList'

export function MediaDetailPage() {
  const { slug = '' } = useParams()
  const { state } = useAuth()
  const userId = state.status === 'authenticated' ? state.user.id : null
  // Se vuelve a pedir al iniciar o cerrar sesión, para traer `myReview`
  const { data: media, error, loading, reload } = useApi<MediaDetail>(
    `/media/${slug}`,
    userId,
  )
  const [reviewsKey, setReviewsKey] = useState(0)

  if (error?.status === 404) {
    return <NotFoundPage message="No encontramos esta obra." />
  }
  if (error) {
    return (
      <main className="page">
        <ErrorState error={error} onRetry={reload} />
      </main>
    )
  }
  if (!media || (loading && media.slug !== slug)) {
    return (
      <main className="page">
        <Loading />
      </main>
    )
  }

  const category = categoryForType(media.type)
  function handleSaved() {
    reload() // nota promedio y myReview
    setReviewsKey((k) => k + 1) // lista de reseñas
  }

  return (
    <main className="page">
      <nav className="breadcrumb" aria-label="Ruta">
        <Link to={`/${category.slug}`}>← {category.label}</Link>
      </nav>

      <article className="detail">
        <Cover url={media.coverUrl} title={media.title} type={media.type} size="large" />

        <div className="detail-main">
          <p className="eyebrow">{TYPE_LABELS[media.type]}</p>
          <h1>{media.title}</h1>
          {media.originalTitle && media.originalTitle !== media.title && (
            <p className="muted">{media.originalTitle}</p>
          )}

          <RatingSummary media={media} />

          {media.synopsis && <p className="synopsis">{media.synopsis}</p>}

          {media.details?.trailerUrl && (
            <p>
              <a href={media.details.trailerUrl} target="_blank" rel="noreferrer">
                Ver tráiler ↗
              </a>
            </p>
          )}

          <dl className="facts">
            {media.releaseDate && (
              <Fact label="Estreno">{longDate(media.releaseDate)}</Fact>
            )}
            {groupCredits(media).map(([role, names]) => (
              <Fact key={role} label={ROLE_LABELS[role]}>
                {names}
              </Fact>
            ))}
            {media.genres.length > 0 && (
              <Fact label="Géneros">{media.genres.map((g) => g.name).join(', ')}</Fact>
            )}
            <TypeFacts media={media} />
          </dl>
        </div>
      </article>

      {media.tracks && media.tracks.length > 0 && (
        <section aria-labelledby="tracks-title">
          <h2 id="tracks-title" className="section-title">
            Canciones
          </h2>
          <ol className="tracklist">
            {media.tracks.map(({ discNumber, trackNumber, track }) => (
              <li key={track.id}>
                <span className="track-number">
                  {media.tracks!.some((t) => t.discNumber > 1)
                    ? `${discNumber}-${trackNumber}`
                    : trackNumber}
                </span>
                <Link to={`/obra/${track.slug}`}>{track.title}</Link>
                <span className="muted">
                  {track.ratingAvg !== null && `★ ${starsText(track.ratingAvg)}`}
                </span>
                <span className="muted">
                  {track.track?.durationSeconds
                    ? duration(track.track.durationSeconds)
                    : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {media.albums && media.albums.length > 0 && (
        <section aria-labelledby="albums-title">
          <h2 id="albums-title" className="section-title">
            Aparece en
          </h2>
          <ul className="plain-list">
            {media.albums.map(({ album, trackNumber }) => (
              <li key={album.id}>
                <Link to={`/obra/${album.slug}`}>{album.title}</Link>{' '}
                <span className="muted">
                  {[year(album.releaseDate), `pista ${trackNumber}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="detail-reviews">
        <MyReview media={media} onSaved={handleSaved} />
        <ReviewList mediaSlug={media.slug} refreshKey={reviewsKey} />
      </div>
    </main>
  )
}

function MyReview({ media, onSaved }: { media: MediaDetail; onSaved: () => void }) {
  const { state } = useAuth()
  const openAuth = useOpenAuthDialog()

  if (state.status === 'loading') return null
  if (state.status === 'anonymous') {
    return (
      <div className="review-form review-cta">
        <h2 className="section-title">¿Qué te pareció?</h2>
        <p className="muted">Inicia sesión para dejar tu nota o tu reseña.</p>
        <div className="form-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => openAuth('login')}
          >
            Iniciar sesión
          </button>
          <button type="button" className="button" onClick={() => openAuth('register')}>
            Crear cuenta
          </button>
        </div>
      </div>
    )
  }
  return (
    <ReviewForm
      // Se reinicia el formulario al crear o borrar la reseña (al editar se
      // conserva, para mostrar "Reseña guardada")
      key={media.myReview?.id ?? 'new'}
      mediaId={media.id}
      review={media.myReview}
      onSaved={onSaved}
    />
  )
}

function RatingSummary({ media }: { media: MediaDetail }) {
  if (media.ratingAvg === null) {
    return (
      <p className="rating-summary muted">
        Sin notas todavía
        {media.reviewCount > 0 && ` · ${plural(media.reviewCount, 'reseña', 'reseñas')}`}
      </p>
    )
  }
  return (
    <div className="rating-summary">
      <span className="rating-big">{starsText(media.ratingAvg)}</span>
      <Stars rating={media.ratingAvg} />
      <span className="muted">
        {plural(media.ratingCount, 'nota', 'notas')} ·{' '}
        {plural(media.reviewCount, 'reseña', 'reseñas')}
      </span>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

// Datos propios de cada tipo (duración, temporadas, plataformas...)
function TypeFacts({ media }: { media: MediaDetail }) {
  const d = media.details
  if (!d) return null
  switch (media.type) {
    case 'MOVIE':
      return (
        <>
          {d.runtimeMinutes && <Fact label="Duración">{runtime(d.runtimeMinutes)}</Fact>}
          {d.ageRating && <Fact label="Clasificación">{d.ageRating}</Fact>}
        </>
      )
    case 'SERIES':
      return (
        <>
          {d.status && <Fact label="Estado">{SERIES_STATUS_LABELS[d.status]}</Fact>}
          {d.seasonsCount && (
            <Fact label="Temporadas">
              {d.seasonsCount}
              {d.episodesCount ? ` (${d.episodesCount} episodios)` : ''}
            </Fact>
          )}
          {d.network && <Fact label="Cadena">{d.network}</Fact>}
          {d.endDate && <Fact label="Finalizó">{longDate(d.endDate)}</Fact>}
          {d.ageRating && <Fact label="Clasificación">{d.ageRating}</Fact>}
        </>
      )
    case 'ALBUM':
      return (
        <>
          {d.albumType && <Fact label="Formato">{ALBUM_TYPE_LABELS[d.albumType]}</Fact>}
          {d.label && <Fact label="Sello">{d.label}</Fact>}
          {media.tracks && media.tracks.length > 0 && (
            <Fact label="Canciones">{media.tracks.length}</Fact>
          )}
        </>
      )
    case 'TRACK':
      return (
        <>
          {d.durationSeconds && <Fact label="Duración">{duration(d.durationSeconds)}</Fact>}
          {d.explicit && <Fact label="Contenido">Explícito</Fact>}
        </>
      )
    case 'GAME':
      return (
        <>
          {d.platforms && d.platforms.length > 0 && (
            <Fact label="Plataformas">{d.platforms.join(', ')}</Fact>
          )}
          {d.gameModes && d.gameModes.length > 0 && (
            <Fact label="Modos">{d.gameModes.join(', ')}</Fact>
          )}
        </>
      )
  }
}

// [["DIRECTOR", "Bong Joon-ho"], ["WRITER", "Bong Joon-ho"]]
function groupCredits(media: MediaDetail) {
  const groups = new Map<MediaDetail['credits'][number]['role'], string[]>()
  for (const credit of media.credits) {
    groups.set(credit.role, [...(groups.get(credit.role) ?? []), credit.creator.name])
  }
  return [...groups].map(([role, names]) => [role, names.join(', ')] as const)
}
