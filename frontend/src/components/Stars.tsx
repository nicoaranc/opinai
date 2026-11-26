import { useId } from 'react'

const STAR_PATH =
  'M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96z'

// Una estrella rellena en una fracción (0, 0.5 o 1)
export function Star({ fill }: { fill: number }) {
  const clipId = useId()
  return (
    <svg className="star" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={24 * fill} height="24" />
        </clipPath>
      </defs>
      <path d={STAR_PATH} className="star-empty" />
      <path d={STAR_PATH} className="star-full" clipPath={`url(#${clipId})`} />
    </svg>
  )
}

// Nota 1–10 mostrada como 5 estrellas (redondeo a media estrella)
export function Stars({
  rating,
  label,
}: {
  rating: number
  label?: string
}) {
  const halves = Math.round(rating) // 1–10
  return (
    <span
      className="stars"
      role="img"
      aria-label={label ?? `${halves / 2} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} fill={Math.min(1, Math.max(0, (halves - (i - 1) * 2) / 2))} />
      ))}
    </span>
  )
}
