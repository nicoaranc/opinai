import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { AuthDialogProvider } from './components/AuthDialogProvider'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { CategoryPage } from './pages/CategoryPage'
import { HomePage } from './pages/HomePage'
import { ImportPage } from './pages/ImportPage'
import { MediaDetailPage } from './pages/media/MediaDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'

function Layout() {
  return (
    <>
      <Header />
      <div className="content">
        <Outlet />
      </div>
      <Footer />
      <ScrollRestoration />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/obra/:slug', element: <MediaDetailPage /> },
      // /peliculas, /series, /musica, /videojuegos
      { path: '/:category', element: <CategoryPage /> },
      // /peliculas/agregar, /series/agregar (búsqueda en TMDB)
      { path: '/:category/agregar', element: <ImportPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return (
    <AuthProvider>
      <AuthDialogProvider>
        <RouterProvider router={router} />
      </AuthDialogProvider>
    </AuthProvider>
  )
}
