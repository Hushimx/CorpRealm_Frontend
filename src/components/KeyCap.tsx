const LABELS: Record<string, string> = {
  w: 'W',
  a: 'A',
  s: 'S',
  d: 'D',
  shift: 'Shift',
  e: 'E',
  esc: 'Esc',
}

const WIDE = new Set([' ', 'shift', 'esc'])

export function KeyCap({ name, alt = '', className = 'h-10' }: { name: string; alt?: string; className?: string }) {
  const wide = WIDE.has(name)
  return (
    <kbd
      aria-label={alt || undefined}
      className={[
        'pointer-events-none inline-flex select-none items-center justify-center rounded-lg border border-ink/20 bg-frost font-sans text-xs font-bold tracking-wide text-ink shadow-[0_3px_0_0_#c4c6ce]',
        'group-active:translate-y-[2px] group-active:shadow-none',
        wide ? 'min-w-12 px-2.5' : 'aspect-square',
        name === ' ' ? 'min-w-16' : '',
        className,
      ].join(' ')}
    >
      {name === 'click' ? <ClickMark /> : name === ' ' ? <span className="h-1 w-7 rounded-full bg-ink" /> : (LABELS[name] ?? name)}
    </kbd>
  )
}

function ClickMark() {
  return (
    <svg viewBox="0 0 16 22" className="h-[68%] w-auto text-ink" aria-hidden="true">
      <rect x="1.2" y="1.2" width="13.6" height="19.6" rx="6.2" fill="#ffffff" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 1.8v7.4M1.8 9.2H8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.1 3.4h4.2a2.2 2.2 0 0 1 2.2 2.2v3.2H3.1a1.6 1.6 0 0 1-1.6-1.6V5a1.6 1.6 0 0 1 1.6-1.6Z" fill="currentColor" />
    </svg>
  )
}
