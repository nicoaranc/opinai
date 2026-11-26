import { useParams, useSearchParams } from 'react-router'
import type { MediaSummary, Page } from '../api/types'
import { useApi } from '../api/use-api'
import { MediaCard } from '../components/MediaCard'
import { Pagination } from '../components/Pagination'
import { ErrorState, Loading } from '../components/Status'
import { categoryBySlug, type Category } from '../lib/categories'
import { NotFoundPage } from './NotFoundPage'

const PAGE_SIZE = 24

const SORTS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'rating', label: 'Mejor valoradas' },
  { value: 'popular', label: 'Más reseñadas' },
  { value: 'title', label: 'Alfabético' },
] as const

export function CategoryPage() {
  const { category: slug } = useParams()
  const category = categoryBySlug(slug)
  if (!category) return <NotFoundPage />
  // key: al cambiar de categoría se reinicia el estado de la página
  return <CategoryListing key={category.slug} category={category} />
}

function CategoryListing({ category }: { category: Category }) {
  const [params, setParams] = useSearchParams()
  const view =
    category.views.find((v) => v.id === params.get('ver')) ?? category.views[0]
  const sort = SORTS.some((s) => s.value === params.get('orden'))
    ? (params.get('orden') as string)
    : 'recent'
  const page = Math.max(1, Number(params.get('pagina')) || 1)

  const query = new URLSearchParams({
    type: view.types.join(','),
    sort,
    page: String(page),
    pageSize: String(PAGE_SIZE),
  })
  const { data, error, loading, reload } = useApi<Page<MediaSummary>>(
    `/media?${query}`,
  )

  // Cambia un parámetro de la URL; cualquier cambio salvo la página vuelve a la 1
  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    if (!('pagina' in changes)) next.delete('pagina')
    setParams(next)
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1>{category.label}</h1>
        <label className="select-field">
          <span>Ordenar por</span>
          <select
            value={sort}
            onChange={(event) => update({ orden: event.target.value })}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {category.views.length > 1 && (
        <div className="tabs" role="group" aria-label="Ver">
          {category.views.map((v) => (
            <button
              key={v.id}
              type="button"
              className="tab"
              aria-pressed={v.id === view.id}
              onClick={() => update({ ver: v.id })}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {error && <ErrorState error={error} onRetry={reload} />}
      {!data && loading && <Loading />}
      {data && data.items.length === 0 && (
        <p className="status">Todavía no hay nada en esta sección.</p>
      )}
      {data && data.items.length > 0 && (
        <>
          <ul className={`grid ${loading ? 'is-refreshing' : ''}`}>
            {data.items.map((media) => (
              <MediaCard key={media.id} media={media} />
            ))}
          </ul>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(p) => {
              update({ pagina: String(p) })
              window.scrollTo({ top: 0 })
            }}
          />
        </>
      )}
    </main>
  )
}
