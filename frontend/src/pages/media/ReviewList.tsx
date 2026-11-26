import { useState } from 'react'
import type { MediaReview, Page } from '../../api/types'
import { useApi } from '../../api/use-api'
import { Pagination } from '../../components/Pagination'
import { Stars } from '../../components/Stars'
import { ErrorState, Loading } from '../../components/Status'
import { shortDate } from '../../lib/format'

const SORTS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'rating_desc', label: 'Mejor nota' },
  { value: 'rating_asc', label: 'Peor nota' },
] as const

// `refreshKey` cambia cuando el usuario guarda o borra su reseña
export function ReviewList({
  mediaSlug,
  refreshKey,
}: {
  mediaSlug: string
  refreshKey: number
}) {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<string>('recent')
  const [withText, setWithText] = useState(false)

  const query = new URLSearchParams({
    page: String(page),
    pageSize: '10',
    sort,
    ...(withText && { withText: 'true' }),
  })
  const { data, error, loading, reload } = useApi<Page<MediaReview>>(
    `/media/${mediaSlug}/reviews?${query}`,
    refreshKey,
  )

  return (
    <section className="reviews" aria-labelledby="reviews-title">
      <div className="reviews-header">
        <h2 id="reviews-title" className="section-title">
          Reseñas {data ? `(${data.total})` : ''}
        </h2>
        <div className="reviews-filters">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={withText}
              onChange={(event) => {
                setWithText(event.target.checked)
                setPage(1)
              }}
            />
            Solo con texto
          </label>
          <label className="select-field">
            <span className="sr-only">Ordenar reseñas</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value)
                setPage(1)
              }}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={reload} />}
      {!data && loading && <Loading label="Cargando reseñas…" />}
      {data && data.items.length === 0 && (
        <p className="status">Todavía no hay reseñas. ¡Sé el primero!</p>
      )}
      {data && data.items.length > 0 && (
        <>
          <ul className="review-list">
            {data.items.map((review) => (
              <ReviewItem key={review.id} review={review} />
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}
    </section>
  )
}

function ReviewItem({ review }: { review: MediaReview }) {
  const [revealed, setRevealed] = useState(false)
  const author = review.user.displayName ?? review.user.username
  const hidden = review.containsSpoilers && !revealed

  return (
    <li className="review">
      <div className="review-meta">
        <span className="review-author">{author}</span>
        <span className="muted">@{review.user.username}</span>
        <span className="muted">· {shortDate(review.createdAt)}</span>
      </div>
      {review.rating !== null ? (
        <Stars rating={review.rating} />
      ) : (
        <span className="muted small">Sin nota</span>
      )}
      {review.title && <h3 className="review-title">{review.title}</h3>}
      {review.body &&
        (hidden ? (
          <button
            type="button"
            className="spoiler-button"
            onClick={() => setRevealed(true)}
          >
            Esta reseña contiene spoilers. Mostrar
          </button>
        ) : (
          <p className="review-body">{review.body}</p>
        ))}
    </li>
  )
}
