import { useId, useState } from 'react'
import { Star } from './Stars'

interface Props {
  value: number | null // 1–10, null = sin nota
  onChange: (value: number | null) => void
}

// Selector de 0,5 a 5 estrellas. Cada estrella tiene dos mitades, que son
// radios ocultos: funciona con teclado (flechas) y lectores de pantalla.
export function StarRatingInput({ value, onChange }: Props) {
  const name = useId()
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0

  return (
    <fieldset className="rating-input">
      <legend>Nota</legend>
      <div className="rating-input-row">
        <div className="rating-stars" onMouseLeave={() => setHover(null)}>
          {[1, 2, 3, 4, 5].map((star) => {
            const fill = Math.min(1, Math.max(0, (shown - (star - 1) * 2) / 2))
            return (
              <span className="rating-star" key={star}>
                <Star fill={fill} />
                {[star * 2 - 1, star * 2].map((half) => (
                  <input
                    key={half}
                    type="radio"
                    name={name}
                    value={half}
                    className={half % 2 ? 'rating-half left' : 'rating-half right'}
                    aria-label={`${half / 2} ${half === 2 ? 'estrella' : 'estrellas'}`}
                    checked={value === half}
                    onChange={() => onChange(half)}
                    onMouseEnter={() => setHover(half)}
                  />
                ))}
              </span>
            )
          })}
        </div>
        <span className="rating-value" aria-hidden="true">
          {shown ? `${String(shown / 2).replace('.', ',')} / 5` : 'Sin nota'}
        </span>
        {value !== null && (
          <button
            type="button"
            className="link-button"
            onClick={() => onChange(null)}
          >
            Quitar nota
          </button>
        )}
      </div>
    </fieldset>
  )
}
