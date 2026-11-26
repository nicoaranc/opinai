// Las portadas de TMDB se guardan en tamaño w500. Para la rejilla se pide una
// más pequeña cambiando ese segmento de la URL (ahorra datos en móvil).
// Las URLs de otros orígenes se devuelven tal cual.
const TMDB_IMAGE = /^(https:\/\/image\.tmdb\.org\/t\/p\/)[^/]+(\/.+)$/

export type ImageSize = 'small' | 'medium' | 'large'

const TMDB_SIZES: Record<ImageSize, string> = {
  small: 'w185',
  medium: 'w342',
  large: 'w500',
}

export function imageSrc(url: string, size: ImageSize): string {
  const match = TMDB_IMAGE.exec(url)
  return match ? `${match[1]}${TMDB_SIZES[size]}${match[2]}` : url
}
