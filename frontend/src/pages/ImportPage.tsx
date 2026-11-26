import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  importItem,
  normalizePage,
  searchPath,
  type ImportOption,
  type ImportSource,
  type SearchItem,
} from '../api/importers'
import { useApi } from '../api/use-api'
import { useAuth } from '../auth/auth-context'
import { useOpenAuthDialog } from '../auth/auth-dialog'
import { Cover } from '../components/Cover'
import { Pagination } from '../components/Pagination'
import { ErrorState, Loading } from '../components/Status'
import { categoryBySlug } from '../lib/categories'
import { NotFoundPage } from './NotFoundPage'

const PLACEHOLDERS: Record<string, string> = {
  MOVIE: 'Ej.: Parásitos',
  SERIES: 'Ej.: Breaking Bad',
  ALBUM: 'Ej.: OK Computer',
  TRACK: 'Ej.: Karma Police',
}

// Buscar en una fuente externa (TMDB, Deezer) y agregar al catálogo:
// /peliculas/agregar, /series/agregar, /musica/agregar?tipo=canciones
export function ImportPage() {
  const { category: slug } = useParams()
  const category = categoryBySlug(slug)
  const { state } = useAuth()
  const openAuth = useOpenAuthDialog()
  const [params, setParams] = useSearchParams()

  const source = category?.importer
  if (!category || !source) return <NotFoundPage />
  const option = source.options.find((o) => o.id === params.get('tipo')) ?? source.options[0]
  const q = params.get('q') ?? ''
  const noun = option.label.toLowerCase()

  return (
    <main className="page">
      <nav className="breadcrumb" aria-label="Ruta">
        <Link to={`/${category.slug}`}>← {category.label}</Link>
      </nav>
      <h1>Agregar {category.label.toLowerCase()}</h1>
      <p className="lead">
        Busca en {source.name} y agrega al catálogo lo que quieras reseñar. Si
        ya está, te llevamos a su página.
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
          {source.options.length > 1 && (
            <div className="tabs import-tabs" role="group" aria-label="Qué agregar">
              {source.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="tab"
                  aria-pressed={o.id === option.id}
                  // Se conserva la búsqueda al cambiar de pestaña
                  onClick={() => setParams(q ? { tipo: o.id, q } : { tipo: o.id })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          <SearchForm
            // key: el campo se reinicia al cambiar de pestaña o de búsqueda
            key={`${option.id}:${q}`}
            initial={q}
            label={`Buscar ${noun}`}
            placeholder={PLACEHOLDERS[option.type]}
            onSearch={(value) => {
              const next: Record<string, string> = {}
              if (source.options.length > 1) next.tipo = option.id
              if (value) next.q = value
              setParams(next)
            }}
          />
          {q && (
            <SearchResults
              // key: una búsqueda nueva empieza en la página 1
              key={`${option.id}:${q}`}
              source={source}
              option={option}
              q={q}
            />
          )}
        </>
      )}
    </main>
  )
}

function SearchForm({
  initial,
  label,
  placeholder,
  onSearch,
}: {
  initial: string
  label: string
  placeholder: string
  onSearch: (value: string) => void
}) {
  const [draft, setDraft] = useState(initial)
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch(draft.trim())
  }
  return (
    <form className="search-form" role="search" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="import-q">
        {label}
      </label>
      <input
        id="import-q"
        type="search"
        placeholder={placeholder}
        maxLength={100}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="submit" className="button button-primary">
        Buscar
      </button>
    </form>
  )
}

function SearchResults({
  source,
  option,
  q,
}: {
  source: ImportSource
  option: ImportOption
  q: string
}) {
  const [page, setPage] = useState(1)
  const { data: raw, error, loading, reload } = useApi<Parameters<typeof normalizePage>[1]>(
    searchPath(source.provider, option.type, q, page),
  )
  const data = useMemo(
    () => (raw ? normalizePage(source.provider, raw) : undefined),
    [raw, source.provider],
  )

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!data) return <Loading label={`Buscando en ${source.name}…`} />
  if (data.items.length === 0) {
    return <p className="status">No encontramos resultados para “{q}”.</p>
  }
  return (
    <>
      <p className="muted small">
        {data.total} resultados en {source.name}
      </p>
      <ul className={`result-list ${loading ? 'is-refreshing' : ''}`}>
        {data.items.map((item) => (
          <ResultItem key={item.id} item={item} source={source} />
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

function ResultItem({ item, source }: { item: SearchItem; source: ImportSource }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleImport() {
    setBusy(true)
    setError(null)
    try {
      const { media } = await importItem(source.provider, item.type, item.id)
      navigate(`/obra/${media.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal')
      setBusy(false)
    }
  }

  return (
    <li className="result">
      <Cover url={item.coverUrl} title={item.title} type={item.type} size="small" />
      <div className="result-main">
        <span className="card-title">{item.title}</span>
        {item.subtitle && <span className="muted small">{item.subtitle}</span>}
        {item.detail && <span className="muted small">{item.detail}</span>}
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
