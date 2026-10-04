import type { ObjectKind } from './build'

export const CATALOG = [
  { id: 'seating', label: 'Seating', kinds: ['chair', 'sofa', 'bean'] },
  { id: 'tables', label: 'Tables', kinds: ['desk', 'meet', 'round', 'chess', 'xo'] },
  { id: 'decor', label: 'Decor', kinds: ['plant', 'books', 'board', 'clock', 'mat'] },
  { id: 'tech', label: 'Tech', kinds: ['screen', 'server'] },
  { id: 'kitchen', label: 'Kitchen', kinds: ['kitchen', 'fridge', 'cooler', 'bin'] },
] as const

export type CatalogId = (typeof CATALOG)[number]['id']

export function catalogThumb(kind: ObjectKind) {
  if (kind === 'chess') return '/catalog/chess.svg'
  if (kind === 'xo') return '/catalog/xo.svg'
  return `/catalog/${kind}.png`
}
