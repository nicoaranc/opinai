// Iconos de las categorías (trazo, heredan el color del texto)
const PATHS: Record<string, string> = {
  peliculas:
    'M4 5h16v14H4zM4 9h16M4 15h16M8 5v4M12 5v4M16 5v4M8 15v4M12 15v4M16 15v4',
  series: 'M3 6h18v11H3zM8 21h8M12 17v4',
  musica: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  videojuegos:
    'M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7.2 2.4L14 14h-4l-.8 1.4A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4zM7 10.5v3M5.5 12h3M16 11h.01M18 13h.01',
}

export function CategoryIcon({ slug }: { slug: string }) {
  return (
    <svg
      className="category-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[slug]} />
    </svg>
  )
}
