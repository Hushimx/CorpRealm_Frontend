import { useEffect, useMemo, useState } from 'react'
import { chooseMove } from './ai'
import { PieceMark } from './pieces'
import { classify, createGame, legalMoves, playMove, squareName, statusLine, type Game, type Kind, type Move, type Promotion, type Side } from './rules'

type Mode = 'cpu' | 'hotseat'

const PROMOTIONS: Promotion[] = ['q', 'r', 'b', 'n']

export function ChessGame({
  onClose,
  shared,
}: {
  onClose: () => void
  shared?: { game: Game; side: Side | null; onMove: (move: Move) => void }
}) {
  const [localGame, setGame] = useState(createGame)
  const game = shared?.game ?? localGame
  const [mode, setMode] = useState<Mode>('cpu')
  const [selected, setSelected] = useState<number | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  const ending = useMemo(() => classify(game), [game])
  const live = ending.kind === 'play' || ending.kind === 'check'
  const legal = useMemo(() => (live ? legalMoves(game.position) : []), [game, live])
  const cpuTurn = !shared && mode === 'cpu' && game.position.turn === 'b' && live
  const flip = mode === 'hotseat' && game.position.turn === 'b'
  const ranks = flip ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  const files = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]

  useEffect(() => {
    if (!cpuTurn) return
    let cancel = false
    const timer = window.setTimeout(() => {
      if (cancel) return
      const move = chooseMove(game.position)
      if (!move || cancel) return
      setGame((current) => (current.position.turn === 'b' ? (playMove(current, move) ?? current) : current))
      setSelected(null)
      setPending(null)
    }, 180)
    return () => {
      cancel = true
      window.clearTimeout(timer)
    }
  }, [cpuTurn, game])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.code !== 'KeyE') return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea')) return
      event.preventDefault()
      if (event.key === 'Escape' && pending !== null) {
        setPending(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, pending])

  function commit(move: Move) {
    if (shared) shared.onMove(move)
    else setGame((current) => playMove(current, move) ?? current)
    setSelected(null)
    setPending(null)
  }

  function chooseSquare(index: number) {
    if (!live || cpuTurn) return
    if (shared && shared.side !== game.position.turn) return
    if (selected !== null) {
      const options = legal.filter((move) => move.from === selected && move.to === index)
      if (options.length) {
        if (options.some((move) => move.promotion)) {
          setPending(index)
          return
        }
        commit(options[0])
        return
      }
    }
    const occupant = game.position.squares[index]
    if (occupant && occupant.side === game.position.turn) {
      setSelected(index)
      setPending(null)
      return
    }
    setSelected(null)
    setPending(null)
  }

  function promote(kind: Promotion) {
    if (selected === null || pending === null) return
    const move = legal.find((item) => item.from === selected && item.to === pending && item.promotion === kind)
    if (move) commit(move)
  }

  const king = live && ending.kind === 'check' ? game.position.squares.findIndex((square) => square?.kind === 'k' && square.side === game.position.turn) : -1
  const rows: { n: number; white: string; black: string }[] = []
  for (let index = 0; index < game.log.length; index += 2) {
    rows.push({ n: index / 2 + 1, white: game.log[index], black: game.log[index + 1] ?? '' })
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/55 p-3 sm:p-5">
      <section className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-[1.6rem] bg-paper text-ink shadow-card md:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-3 overflow-y-auto p-4 sm:p-5">
          <header className="flex w-full flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">Chess table</p>
              <h2 className="font-bold text-4xl leading-none">Chess</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {shared ? null : (
                <>
                  <button type="button" aria-pressed={mode === 'cpu'} onClick={() => setMode('cpu')} className={chip(mode === 'cpu')}>
                    Vs computer
                  </button>
                  <button type="button" aria-pressed={mode === 'hotseat'} onClick={() => setMode('hotseat')} className={chip(mode === 'hotseat')}>
                    Two players
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGame(createGame())
                      setSelected(null)
                      setPending(null)
                    }}
                    className="rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink"
                  >
                    New game
                  </button>
                </>
              )}
              <button type="button" onClick={onClose} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
                Leave table
              </button>
            </div>
          </header>
          <p className="w-full text-sm font-medium text-ink">{cpuTurn ? 'Black is thinking.' : statusLine(game, ending)}</p>
          {pending !== null && selected !== null ? (
            <div className="flex items-center gap-2 rounded-full bg-frost px-3 py-2 text-ink">
              <span className="text-sm font-medium">Promote to</span>
              {PROMOTIONS.map((kind) => (
                <button key={kind} type="button" aria-label={kindName(kind)} onClick={() => promote(kind)} className="@container flex h-11 w-11 items-center justify-center rounded-xl bg-paper">
                  <PieceMark side={game.position.turn} kind={kind} />
                </button>
              ))}
            </div>
          ) : null}
          <div className="w-full max-w-[min(32rem,max(20rem,calc(100svh-14rem)))]">
            <div className="grid grid-cols-[1.1rem_minmax(0,1fr)] gap-1">
              <div className="grid grid-rows-8">
                {ranks.map((rank) => (
                  <span key={rank} className="flex items-center justify-center text-[10px] font-bold text-ink/55">
                    {rank + 1}
                  </span>
                ))}
              </div>
              <div className="grid aspect-square grid-cols-8 grid-rows-8 overflow-hidden rounded-xl border-2 border-ink" role="grid" aria-label="Chessboard">
                {ranks.flatMap((rank) =>
                  files.map((file) => {
                    const index = rank * 8 + file
                    const occupant = game.position.squares[index]
                    const dark = (file + rank) % 2 === 0
                    const options = selected === null ? [] : legal.filter((move) => move.from === selected && move.to === index)
                    const last = game.last?.from === index || game.last?.to === index
                    const ring = index === selected ? '#2765ed' : index === king ? '#c0392b' : last ? '#8fb8ff' : ''
                    return (
                      <button
                        key={index}
                        type="button"
                        aria-label={labelFor(index, occupant)}
                        onClick={() => chooseSquare(index)}
                        className="@container relative flex min-h-0 min-w-0 items-center justify-center"
                        style={{
                          backgroundColor: dark ? '#8fb8ff' : '#f3f6fc',
                          boxShadow: ring ? `inset 0 0 0 3px ${ring}` : undefined,
                        }}
                      >
                        {options.length && occupant ? <span className="absolute inset-[7%] rounded-full border-[3px] border-ink/45" /> : null}
                        {occupant ? <PieceMark side={occupant.side} kind={occupant.kind} className="h-[82%] w-[82%]" /> : null}
                        {options.length && !occupant ? <span className="h-[18%] w-[18%] rounded-full bg-ink/40" /> : null}
                      </button>
                    )
                  }),
                )}
              </div>
            </div>
            <div className="mt-1 grid grid-cols-[1.1rem_minmax(0,1fr)] gap-1">
              <span />
              <div className="grid grid-cols-8">
                {files.map((file) => (
                  <span key={file} className="text-center text-[10px] font-bold text-ink/55">
                    {'abcdefgh'[file]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <aside className="max-h-40 overflow-y-auto border-t border-ink/10 bg-frost p-4 text-ink md:max-h-none md:w-60 md:border-t-0 md:border-l">
          <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">Moves</p>
          {rows.length ? (
            <ol className="mt-3 space-y-1 text-sm">
              {rows.map((row) => (
                <li key={row.n} className="grid grid-cols-[1.5rem_1fr_1fr] gap-2">
                  <span className="text-ink/50">{row.n}.</span>
                  <span>{row.white}</span>
                  <span>{row.black}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-ink/70">No moves yet. White plays from the near side.</p>
          )}
          {shared ? (
            <p className="mt-4 text-sm text-ink">
              {shared.side === 'w' ? 'You play white.' : shared.side === 'b' ? 'You play black.' : 'Waiting for a seat at this table.'}
            </p>
          ) : null}
          <p className="mt-4 text-xs leading-relaxed text-ink/60">Click a piece, then a marked square. Esc leaves the table. Against the computer you play white.</p>
        </aside>
      </section>
    </div>
  )
}

function chip(selected: boolean) {
  return ['rounded-full px-3 py-1.5 text-xs font-bold', selected ? 'bg-ink text-paper' : 'bg-frost text-ink'].join(' ')
}

function kindName(kind: Kind) {
  const names: Record<Kind, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }
  return names[kind]
}

function labelFor(index: number, occupant: { side: 'w' | 'b'; kind: Kind } | null) {
  const name = squareName(index)
  if (!occupant) return name
  const side = occupant.side === 'w' ? 'white' : 'black'
  return `${name} ${side} ${kindName(occupant.kind)}`
}
