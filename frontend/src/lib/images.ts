// Las portadas de TMDB, Deezer e IGDB se guardan en un tamaño intermedio. Según
// dónde se muestren se pide otro tamaño cambiando ese segmento de la URL
// (ahorra datos en móvil). Las URLs de otros orígenes se devuelven tal cual.
const TMDB_IMAGE = /^(https:\/\/image\.tmdb\.org\/t\/p\/)[^/]+(\/.+)$/
// https://images.igdb.com/igdb/image/upload/t_cover_big_2x/<id>.jpg
const IGDB_IMAGE = /^(https:\/\/images\.igdb\.com\/igdb\/image\/upload\/)t_[a-z0-9_]+(\/.+)$/
// https://cdn-images.dzcdn.net/images/cover/<hash>/500x500-000000-80-0-0.jpg
const DEEZER_IMAGE = /^(https:\/\/cdn-images\.dzcdn\.net\/images\/[a-z]+\/[0-9a-f]+\/)\d+x\d+(-.+)$/

export type ImageSize = 'small' | 'medium' | 'large'

const TMDB_SIZES: Record<ImageSize, string> = {
  small: 'w185',
  medium: 'w342',
  large: 'w500',
}

// Cuadradas (álbumes y canciones)
const DEEZER_SIZES: Record<ImageSize, string> = {
  small: '250x250',
  medium: '500x500',
  large: '500x500',
}

const IGDB_SIZES: Record<ImageSize, string> = {
  small: 't_cover_small_2x',
  medium: 't_cover_big',
  large: 't_cover_big_2x',
}

export function imageSrc(url: string, size: ImageSize): string {
  const igdb = IGDB_IMAGE.exec(url)
  if (igdb) return `${igdb[1]}${IGDB_SIZES[size]}${igdb[2]}`
  const tmdb = TMDB_IMAGE.exec(url)
  if (tmdb) return `${tmdb[1]}${TMDB_SIZES[size]}${tmdb[2]}`
  const deezer = DEEZER_IMAGE.exec(url)
  if (deezer) return `${deezer[1]}${DEEZER_SIZES[size]}${deezer[2]}`
  return url
}
