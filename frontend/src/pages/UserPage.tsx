import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import type { MediaType, Page, UserProfile, UserReview } from '../api/types'
import { useApi } from '../api/use-api'
import { useAuth } from '../auth/auth-context'
import { Cover } from '../components/Cover'
import { Pagination } from '../components/Pagination'
import { Stars } from '../components/Stars'
import { ErrorState, Loading } from '../components/Status'
import {
  longDate,
  mainCreators,
  shortDate,
  starsText,
  TYPE_LABELS,
  year,
} from '../lib/format'
import { NotFoundPage } from './NotFoundPage'

const PAGE_SIZE = 20

const TYPES: { value: MediaType | ''; label: string }[] = [
  { value: '', label: 'Todo' },
  { value: 'MOVIE', label: 'Películas' },
  { value: 'SERIES', label: 'Series' },
  { value: 'ALBUM', label: 'Álbumes' },
  { value: 'TRACK', label: 'Canciones' },
  { value: 'GAME', label: 'Videojuegos' },
]

// "texto" en la URL → withText en la API
const CONTENT = [
  { value: '', label: 'Reseñas y valoraciones', withText: undefined },
  { value: 'resenas', label: 'Solo reseñas con texto', withText: 'true' },
  { value: 'valoraciones', label: 'Solo valoraciones (sin texto)', withText: 'false' },
] as const

const SORTS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguas' },
  { value: 'rating_desc', label: 'Mejor nota' },
  { value: 'rating_asc', label: 'Peor nota' },
] as const

// Perfil de un usuario con todas sus reseñas y valoraciones: /usuario/:username
export function UserPage() {
  const { username = '' } = useParams()
  const { data: profile, error, loading, reload } = useApi<UserProfile>(
    `/users/${encodeURIComponent(username)}`,
  )

  if (error?.status === 404) {
    return <NotFoundPage message="No encontramos a este usuario." />
  }
  if (error) {
    return (
      <main className="page">
        <ErrorState error={error} onRetry={reload} />
      </main>
    )
  }
  if (!profile || (loading && profile.username !== username.toLowerCase())) {
    return (
      <main className="page">
        <Loading />
      </main>
    )
  }
  // key: al pasar a otro perfil se reinician los filtros
  return <Profile key={profile.id} profile={profile} />
}

function Profile({ profile }: { profile: UserProfile }) {
  const { state } = useAuth()
  const isMe = state.status === 'authenticated' && state.user.id === profile.id
  const name = profile.displayName ?? profile.username
  const { stats } = profile

  return (
    <main className="page">
      <header className="profile-header">
        <div className="avatar" aria-hidden="true">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="profile-main">
          <p className="eyebrow">{isMe ? 'Tu perfil' : 'Perfil'}</p>
          <h1>{name}</h1>
          <p className="muted">
            @{profile.username} · Miembro desde {longDate(profile.createdAt)}
          </p>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        </div>
      </header>

      <dl className="profile-stats">
        <Stat label={stats.reviewCount === 1 ? 'Reseña' : 'Reseñas'} value={stats.reviewCount} />
        <Stat label="Con texto" value={stats.writtenCount} />
        <Stat label={stats.ratingCount === 1 ? 'Nota' : 'Notas'} value={stats.ratingCount} />
        <Stat
          label="Nota media"
          value={stats.ratingAvg !== null ? `★ ${starsText(stats.ratingAvg)}` : '—'}
        />
      </dl>

      <ReviewHistory profile={profile} isMe={isMe} />
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="profile-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function ReviewHistory({ profile, isMe }: { profile: UserProfile; isMe: boolean }) {
  const [params, setParams] = useSearchParams()
  const type = TYPES.find((t) => t.value === params.get('tipo'))?.value ?? ''
  const content = CONTENT.find((c) => c.value === params.get('texto')) ?? CONTENT[0]
  const sort = SORTS.find((s) => s.value === params.get('orden'))?.value ?? 'recent'
  const page = Math.max(1, Number(params.get('pagina')) || 1)

  const query = new URLSearchParams({ sort, page: String(page), pageSize: String(PAGE_SIZE) })
  if (type) query.set('type', type)
  if (content.withText) query.set('withText', content.withText)
  const { data, error, loading, reload } = useApi<Page<UserReview>>(
    `/users/${profile.username}/reviews?${query}`,
  )

  // Cambia un filtro en la URL; cualquier cambio salvo la página vuelve a la 1
  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'pagina') next.delete('pagina')
    setParams(next)
  }

  const filtered = Boolean(type || content.value)
  return (
    <section aria-labelledby="history-title">
      <div className="reviews-header">
        <h2 id="history-title" className="section-title">
          {isMe ? 'Tus reseñas y valoraciones' : 'Reseñas y valoraciones'}
          {data ? ` (${data.total})` : ''}
        </h2>
        <div className="reviews-filters">
          <label className="select-field">
            <span className="sr-only">Qué mostrar</span>
            <select value={content.value} onChange={(e) => update('texto', e.target.value)}>
              {CONTENT.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="select-field">
            <span className="sr-only">Ordenar</span>
            <select value={sort} onChange={(e) => update('orden', e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="tabs" role="group" aria-label="Tipo de obra">
        {TYPES.map((t) => (
          <button
            key={t.value || 'todo'}
            type="button"
            className="tab"
            aria-pressed={t.value === type}
            onClick={() => update('tipo', t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {!data && loading && <Loading label="Cargando reseñas…" />}
      {data && data.items.length === 0 && (
        <p className="status">
          {filtered
            ? 'No hay reseñas con estos filtros.'
            : isMe
              ? 'Todavía no has reseñado nada. Explora una categoría y deja tu primera nota.'
              : 'Todavía no ha reseñado nada.'}
        </p>
      )}
      {data && data.items.length > 0 && (
        <>
          <ul className={`history ${loading ? 'is-refreshing' : ''}`}>
            {data.items.map((review) => (
              <HistoryItem key={review.id} review={review} isMe={isMe} />
            ))}
          </ul>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(p) => {
              update('pagina', String(p))
              window.scrollTo({ top: 0 })
            }}
          />
        </>
      )}
    </section>
  )
}

function HistoryItem({ review, isMe }: { review: UserReview; isMe: boolean }) {
  const [revealed, setRevealed] = useState(false)
  const { media } = review
  const hidden = review.containsSpoilers && !revealed
  const meta = [TYPE_LABELS[media.type], mainCreators(media), year(media.releaseDate)]
    .filter(Boolean)
    .join(' · ')
  const edited = review.updatedAt !== review.createdAt

  return (
    <li className="history-item">
      <Link to={`/obra/${media.slug}`} className="history-cover" tabIndex={-1} aria-hidden="true">
        <Cover url={media.coverUrl} title={media.title} type={media.type} size="small" />
      </Link>
      <div className="history-main">
        <div className="history-top">
          <div>
            <Link to={`/obra/${media.slug}`} className="history-title">
              {media.title}
            </Link>
            <p className="muted small">{meta}</p>
          </div>
          {isMe && (
            <Link to={`/obra/${media.slug}`} className="button button-small">
              Editar
            </Link>
          )}
        </div>
        <div className="history-rating">
          {review.rating !== null ? (
            <>
              <Stars rating={review.rating} />
              <span className="muted small">{starsText(review.rating)}</span>
            </>
          ) : (
            <span className="muted small">Sin nota</span>
          )}
          <span className="muted small">
            · {shortDate(review.createdAt)}
            {edited && ' (editada)'}
          </span>
        </div>
        {review.title && <h3 className="review-title">{review.title}</h3>}
        {review.body &&
          (hidden ? (
            <button type="button" className="spoiler-button" onClick={() => setRevealed(true)}>
              Esta reseña contiene spoilers. Mostrar
            </button>
          ) : (
            <p className="review-body">{review.body}</p>
          ))}
        {!review.body && <p className="muted small">Solo valoración, sin texto</p>}
      </div>
    </li>
  )
}
