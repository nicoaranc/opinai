import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { importFromTmdb, type TmdbSearchItem, type TmdbSearchPage } from '../api/tmdb'
import { useApi } from '../api/use-api'
import { useAuth } from '../auth/auth-context'
import { useOpenAuthDialog } from '../auth/auth-dialog'
import { Cover } from '../components/Cover'
import { Pagination } from '../components/Pagination'
import { ErrorState, Loading } from '../components/Status'
import { categoryBySlug } from '../lib/categories'
import { NotFoundPage } from './NotFoundPage'

// Buscar en TMDB y agregar películas o series al catálogo
// (/peliculas/agregar, /series/agregar)
export function ImportPage() {
  const { category: slug } = useParams()
  const category = categoryBySlug(slug)
  const { state } = useAuth()
  const openAuth = useOpenAuthDialog()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [draft, setDraft] = useState(q)

  if (!category?.tmdbType) return <NotFoundPage />
  const noun = category.tmdbType === 'MOVIE' ? 'películas' : 'series'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = draft.trim()
    setParams(value ? { q: value } : {})
  }

  return (
    <main className="page">
      <nav className="breadcrumb" aria-label="Ruta">
        <Link to={`/${category.slug}`}>← {category.label}</Link>
      </nav>
      <h1>Agregar {noun}</h1>
      <p className="lead">
        Busca en TMDB y agrega al catálogo lo que quieras reseñar. Si ya está,
        te llevamos a su página.
      </p>

      {state.status === 'anonymous' && (
        <div className="review-form review-cta import-cta">
          <p className="muted">Inicia sesión para buscar y agregar {noun}.</p>
          <div className="form-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => openAuth('login')}
            >
              Iniciar sesión
            </button>
            <button type="button" className="button" onClick={() => openAuth('register')}>
              Crear cuenta
            </button>
          </div>
        </div>
      )}

      {state.status === 'authenticated' && (
        <>
          <form className="search-form" role="search" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="tmdb-q">
              Buscar {noun}
            </label>
            <input
              id="tmdb-q"
              type="search"
              placeholder={category.tmdbType === 'MOVIE' ? 'Ej.: Parásitos' : 'Ej.: Breaking Bad'}
              maxLength={100}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="button button-primary">
              Buscar
            </button>
          </form>
          {/* key: una búsqueda nueva empieza en la página 1 */}
          {q && <SearchResults key={q} type={category.tmdbType} q={q} />}
        </>
      )}
    </main>
  )
}

function SearchResults({ type, q }: { type: 'MOVIE' | 'SERIES'; q: string }) {
  const [page, setPage] = useState(1)
  const query = new URLSearchParams({ type, q, page: String(page) })
  const { data, error, loading, reload } = useApi<TmdbSearchPage>(
    `/tmdb/search?${query}`,
  )

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!data || (loading && data.items.length === 0)) return <Loading label="Buscando en TMDB…" />
  if (data.items.length === 0) {
    return <p className="status">No encontramos resultados para “{q}”.</p>
  }
  return (
    <>
      <p className="muted small">{data.total} resultados en TMDB</p>
      <ul className={`result-list ${loading ? 'is-refreshing' : ''}`}>
        {data.items.map((item) => (
          <ResultItem key={item.tmdbId} item={item} />
        ))}
      </ul>
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        onChange={(p) => {
          setPage(p)
          window.scrollTo({ top: 0 })
        }}
      />
    </>
  )
}

function ResultItem({ item }: { item: TmdbSearchItem }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleImport() {
    setBusy(true)
    setError(null)
    try {
      const { media } = await importFromTmdb(item.type, item.tmdbId)
      navigate(`/obra/${media.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal')
      setBusy(false)
    }
  }

  return (
    <li className="result">
      <Cover url={item.posterUrl} title={item.title} type={item.type} size="small" />
      <div className="result-main">
        <span className="card-title">
          {item.title} {item.year && <span className="muted">({item.year})</span>}
        </span>
        {item.originalTitle && <span className="muted small">{item.originalTitle}</span>}
        {item.overview && <p className="result-overview">{item.overview}</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="result-action">
        {item.importedSlug ? (
          <Link to={`/obra/${item.importedSlug}`} className="button">
            Ver
          </Link>
        ) : (
          <button
            type="button"
            className="button button-primary"
            onClick={handleImport}
            disabled={busy}
          >
            {busy ? 'Agregando…' : 'Agregar'}
          </button>
        )}
      </div>
    </li>
  )
}
