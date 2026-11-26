import { api } from './client'
import type { ReviewFields, ReviewInput } from './types'

export function createReview(mediaId: string, input: ReviewInput) {
  return api<ReviewFields>(`/media/${mediaId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateReview(id: string, input: ReviewInput) {
  return api<ReviewFields>(`/reviews/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteReview(id: string) {
  return api<void>(`/reviews/${id}`, { method: 'DELETE' })
}
