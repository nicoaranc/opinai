// Créditos de las fuentes de datos (TMDB exige su aviso; Deezer e IGDB piden atribución)
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
        <p>
          Datos e imágenes de música:{' '}
          <a href="https://www.deezer.com/" target="_blank" rel="noreferrer">
            Deezer
          </a>
          .
        </p>
        <p>
          Datos e imágenes de videojuegos:{' '}
          <a href="https://www.igdb.com/" target="_blank" rel="noreferrer">
            IGDB
          </a>
          .
        </p>
        <p>opinai es un proyecto personal sin fines comerciales.</p>
      </div>
    </footer>
  )
}
