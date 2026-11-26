import type { MediaType } from '../api/types'

// Portada de una obra. Si no tiene imagen, muestra la inicial del título
// sobre un fondo de color según el tipo.
export function Cover({
  url,
  title,
  type,
  size = 'card',
}: {
  url: string | null
  title: string
  type: MediaType
  size?: 'card' | 'large' | 'small'
}) {
  const square = type === 'ALBUM' || type === 'TRACK'
  const className = `cover cover-${size} ${square ? 'cover-square' : ''}`
  if (url) {
    return <img className={className} src={url} alt="" loading="lazy" />
  }
  return (
    <div className={`${className} cover-placeholder cover-${type.toLowerCase()}`} aria-hidden="true">
      {title.trim().charAt(0).toUpperCase()}
    </div>
  )
}
