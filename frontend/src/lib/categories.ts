import type { MediaType } from '../api/types'

export interface CategoryView {
  id: string
  label: string
  types: MediaType[]
}

export interface Category {
  slug: string // ruta: /peliculas, /musica...
  label: string
  description: string
  // Música tiene dos vistas: álbumes y canciones
  views: CategoryView[]
}

export const CATEGORIES: Category[] = [
  {
    slug: 'peliculas',
    label: 'Películas',
    description: 'Estrenos y clásicos del cine',
    views: [{ id: 'todas', label: 'Películas', types: ['MOVIE'] }],
  },
  {
    slug: 'series',
    label: 'Series',
    description: 'Temporadas completas y en emisión',
    views: [{ id: 'todas', label: 'Series', types: ['SERIES'] }],
  },
  {
    slug: 'musica',
    label: 'Música',
    description: 'Álbumes y canciones, por separado',
    views: [
      { id: 'albumes', label: 'Álbumes', types: ['ALBUM'] },
      { id: 'canciones', label: 'Canciones', types: ['TRACK'] },
    ],
  },
  {
    slug: 'videojuegos',
    label: 'Videojuegos',
    description: 'De indies a grandes producciones',
    views: [{ id: 'todos', label: 'Videojuegos', types: ['GAME'] }],
  },
]

export function categoryBySlug(slug: string | undefined) {
  return CATEGORIES.find((c) => c.slug === slug)
}

// Categoría a la que pertenece una obra (para el enlace "volver")
export function categoryForType(type: MediaType): Category {
  return (
    CATEGORIES.find((c) => c.views.some((v) => v.types.includes(type))) ??
    CATEGORIES[0]
  )
}
