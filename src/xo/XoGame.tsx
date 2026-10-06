import { useEffect, useState } from 'react'
import { chooseXo, createXo, playXo, type Mark, type XoMatch } from '@corprealm/xo'
import { useT } from '../i18n'

type Mode = 'cpu' | 'hotseat'

export function XoGame({
  onClose,
  shared,
}: {
  onClose: () => void
  shared?: { game: XoMatch; side: Mark | null; full: boolean; onMove: (index: number) => void; onReset: () => void }
}) {
  const t = useT()
  const [localGame, setGame] = useState(createXo)
  const [mode, setMode] = useState<Mode>('cpu')
  const game = shared?.game ?? localGame
  const cpuTurn = !shared && mode === 'cpu' && game.turn === 'o' && !game.winner

  useEffect(() => {
    if (!cpuTurn) return
    let cancel = false
    const timer = window.setTimeout(() => {
      if (cancel) return
      const index = chooseXo(game)
      if (index === null) return
      setGame((current) => (current.turn === 'o' && !current.winner ? (playXo(current, index) ?? current) : current))
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
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function play(index: number) {
    if (game.winner || cpuTurn) return
    if (shared) {
      if (shared.side !== game.turn) return
      shared.onMove(index)
      return
    }
    setGame((current) => playXo(current, index) ?? current)
  }

  function reset() {
    if (shared) shared.onReset()
    else setGame(createXo())
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/55 p-3 sm:p-5">
      <section className="flex w-full max-w-xl flex-col gap-4 overflow-hidden rounded-[1.6rem] bg-paper p-4 text-ink shadow-card sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">{t('xoTable')}</p>
            <h2 className="font-bold text-4xl leading-none">{t('xo')}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {shared ? null : (
              <>
                <button type="button" aria-pressed={mode === 'cpu'} onClick={() => setMode('cpu')} className={chip(mode === 'cpu')}>
                  {t('vsComputer')}
                </button>
                <button type="button" aria-pressed={mode === 'hotseat'} onClick={() => setMode('hotseat')} className={chip(mode === 'hotseat')}>
                  {t('twoPlayers')}
                </button>
              </>
            )}
            {shared && !shared.side ? null : (
              <button type="button" onClick={reset} className="rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink">
                {t('newGame')}
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
              {t('leaveTable')}
            </button>
          </div>
        </header>
        <p className="text-sm font-medium text-ink">
          {shared && !shared.side ? (shared.full ? t('bothSeats') : t('takingSeat')) : cpuTurn ? t('oThinking') : xoLine(game, t)}
        </p>
        <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2" role="grid" aria-label={t('xoBoard')} dir="ltr">
          {game.cells.map((cell, index) => (
            <button
              key={index}
              type="button"
              aria-label={cell ? t('xoMark', { mark: cell.toUpperCase(), n: index + 1 }) : t('xoEmpty', { n: index + 1 })}
              onClick={() => play(index)}
              className="flex aspect-square items-center justify-center rounded-2xl bg-frost text-5xl font-bold"
              style={{ color: cell === 'x' ? '#2765ed' : '#000000' }}
            >
              {cell === 'x' ? 'X' : cell === 'o' ? 'O' : ''}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-ink/60">
          {shared ? t('xoShared') : t('xoLocal')}
        </p>
      </section>
    </div>
  )
}

function xoLine(game: XoMatch, t: (key: 'xoDraw' | 'xoXWins' | 'xoOWins' | 'xoXMove' | 'xoOMove') => string) {
  if (game.winner === 'draw') return t('xoDraw')
  if (game.winner === 'x') return t('xoXWins')
  if (game.winner === 'o') return t('xoOWins')
  return game.turn === 'x' ? t('xoXMove') : t('xoOMove')
}

function chip(selected: boolean) {
  return ['rounded-full px-3 py-1.5 text-xs font-bold', selected ? 'bg-ink text-paper' : 'bg-frost text-ink'].join(' ')
}
