// Créditos de las fuentes de datos (TMDB exige este aviso)
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p>
          Datos e imágenes de películas y series:{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
            TMDB
          </a>
          . Este producto usa la API de TMDB, pero no está avalado ni
          certificado por TMDB.
        </p>
        <p>opinai es un proyecto personal sin fines comerciales.</p>
      </div>
    </footer>
  )
}
