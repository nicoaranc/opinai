import { useId, useState, type FormEvent } from 'react'
import { createReview, deleteReview, updateReview } from '../../api/reviews'
import type { ReviewFields } from '../../api/types'
import { StarRatingInput } from '../../components/StarRatingInput'

interface Props {
  mediaId: string
  // La reseña propia, si ya existe: el formulario pasa a ser de edición
  review: ReviewFields | null
  onSaved: () => void
}

// Crear, editar o borrar la reseña propia. Se puede dejar solo una nota,
// solo un texto o ambos (mismas reglas que el back).
export function ReviewForm({ mediaId, review, onSaved }: Props) {
  const [rating, setRating] = useState<number | null>(review?.rating ?? null)
  const [title, setTitle] = useState(review?.title ?? '')
  const [body, setBody] = useState(review?.body ?? '')
  const [spoilers, setSpoilers] = useState(review?.containsSpoilers ?? false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const titleId = useId()

  function validate(): string | null {
    if (rating === null && !body.trim()) {
      return 'Pon una nota, escribe una reseña o ambas cosas.'
    }
    if (title.trim() && !body.trim()) {
      return 'Para usar un título, escribe también la reseña.'
    }
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    const input = {
      rating,
      title: title.trim() || null,
      body: body.trim() || null,
      containsSpoilers: spoilers,
    }
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      if (review) await updateReview(review.id, input)
      else await createReview(mediaId, input)
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!review || !confirm('¿Borrar tu reseña? No se puede deshacer.')) return
    setBusy(true)
    setError(null)
    try {
      await deleteReview(review.id)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal')
      setBusy(false)
    }
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} aria-labelledby={titleId}>
      <h2 id={titleId} className="section-title">
        {review ? 'Tu reseña' : 'Escribe tu reseña'}
      </h2>

      <StarRatingInput
        value={rating}
        onChange={(value) => {
          setRating(value)
          setSaved(false)
        }}
      />

      <label className="field">
        <span>
          Título <span className="optional">(opcional)</span>
        </span>
        <input
          type="text"
          maxLength={150}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <label className="field">
        <span>
          Reseña <span className="optional">(opcional si pones nota)</span>
        </span>
        <textarea
          rows={6}
          maxLength={10_000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={spoilers}
          onChange={(event) => setSpoilers(event.target.checked)}
        />
        Contiene spoilers
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="form-success" role="status">
          Reseña guardada.
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={busy}>
          {busy ? 'Guardando…' : review ? 'Guardar cambios' : 'Publicar'}
        </button>
        {review && (
          <button
            type="button"
            className="button button-danger"
            onClick={handleDelete}
            disabled={busy}
          >
            Borrar
          </button>
        )}
      </div>
    </form>
  )
}
