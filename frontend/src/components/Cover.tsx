import { useState } from 'react'
import type { MediaType } from '../api/types'
import { imageSrc } from '../lib/images'

const IMAGE_SIZE = { small: 'small', card: 'medium', large: 'large' } as const

// Portada de una obra. Si no tiene imagen, o la imagen no carga (p. ej. el
// proveedor la borró), muestra la inicial del título sobre un fondo de color
// según el tipo.
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
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const square = type === 'ALBUM' || type === 'TRACK'
  const className = `cover cover-${size} ${square ? 'cover-square' : ''}`

  if (url && failedUrl !== url) {
    return (
      <img
        className={className}
        src={imageSrc(url, IMAGE_SIZE[size])}
        alt=""
        loading="lazy"
        onError={() => setFailedUrl(url)}
      />
    )
  }
  return (
    <div
      className={`${className} cover-placeholder cover-${type.toLowerCase()}`}
      aria-hidden="true"
    >
      {title.trim().charAt(0).toUpperCase()}
    </div>
  )
}
