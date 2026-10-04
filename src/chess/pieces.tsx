import type { Kind, Side } from './rules'

const WHITE: Record<Kind, string> = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }
const BLACK: Record<Kind, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }

export function PieceMark({ side, kind, className = 'h-8 w-8' }: { side: Side; kind: Kind; className?: string }) {
  const light = side === 'w'
  return (
    <span
      className={`inline-flex items-center justify-center leading-none select-none ${className}`}
      style={{
        color: light ? '#ffffff' : '#000000',
        WebkitTextStroke: light ? '1px #000000' : '1px #ffffff',
        paintOrder: 'stroke fill',
        fontSize: '70cqmin',
      }}
      aria-hidden
    >
      {light ? WHITE[kind] : BLACK[kind]}
    </span>
  )
}
