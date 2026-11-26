import { AuthProvider } from './auth/AuthProvider'
import { Header } from './components/Header'
import { HomePage } from './pages/HomePage'

export default function App() {
  return (
    <AuthProvider>
      <Header />
      <HomePage />
    </AuthProvider>
  )
}
