// "Parásitos (2019)!" → "parasitos-2019"
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
}

// Devuelve el primer slug libre: base, base-2, base-3...
// Si el título no deja nada usable (p. ej. "기생충"), usa el fallback.
export async function uniqueSlug(
  text: string,
  isTaken: (slug: string) => Promise<boolean>,
  fallback = 'item',
): Promise<string> {
  const base = slugify(text) || fallback;
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
}
