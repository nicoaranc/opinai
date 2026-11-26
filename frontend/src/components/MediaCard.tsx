import { Link } from 'react-router'
import type { MediaSummary } from '../api/types'
import { mainCreators, starsText, year } from '../lib/format'
import { Cover } from './Cover'

export function MediaCard({ media }: { media: MediaSummary }) {
  const releaseYear = year(media.releaseDate)
  const creators = mainCreators(media)
  return (
    <li className="card">
      <Link to={`/obra/${media.slug}`} className="card-link">
        <Cover url={media.coverUrl} title={media.title} type={media.type} />
        <span className="card-title">{media.title}</span>
      </Link>
      <span className="card-meta">
        {[creators, releaseYear].filter(Boolean).join(' · ')}
      </span>
      <span className="card-rating">
        {media.ratingAvg !== null ? (
          <>
            <span aria-hidden="true">★</span> {starsText(media.ratingAvg)}
            <span className="sr-only"> de 5 estrellas</span>
          </>
        ) : (
          <span className="muted">Sin notas</span>
        )}
      </span>
    </li>
  )
}
