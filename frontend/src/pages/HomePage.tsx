import { Link } from 'react-router'
import { useAuth } from '../auth/auth-context'
import { CategoryIcon } from '../components/CategoryIcon'
import { CATEGORIES } from '../lib/categories'

export function HomePage() {
  const { state } = useAuth()
  const name =
    state.status === 'authenticated'
      ? (state.user.displayName ?? state.user.username)
      : null

  return (
    <main className="page">
      <section className="hero">
        <h1>{name ? `Hola, ${name}` : 'Opina de lo que ves, escuchas y juegas'}</h1>
        <p className="lead">
          Reseñas y valoraciones de películas, series, música y videojuegos.
        </p>
      </section>

      <section aria-labelledby="categories-title">
        <h2 id="categories-title" className="section-title">
          Explora por categoría
        </h2>
        <ul className="categories">
          {CATEGORIES.map((category) => (
            <li key={category.slug}>
              <Link
                to={`/${category.slug}`}
                className={`category-tile category-${category.slug}`}
              >
                <CategoryIcon slug={category.slug} />
                <span className="category-name">{category.label}</span>
                <span className="category-description">
                  {category.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
