import { useEffect, useState } from 'react'
import { seedBoard, useTaskStore } from '../store/tasks'
import { StatsDesk } from './StatsDesk'
import { TaskBoard, type Assignable } from './TaskBoard'

export type DeskBoard = { id: string; title: string }

const PROGRAMS = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'stats', label: 'Stats' },
] as const

export function useDeskSession(sitting: boolean, atDesk: boolean) {
  const [open, setOpen] = useState(false)
  const [armed, setArmed] = useState(false)

  if (sitting && atDesk && !armed) {
    setArmed(true)
    setOpen(true)
  }
  if ((!sitting || !atDesk) && (armed || open)) {
    setArmed(false)
    setOpen(false)
  }

  return {
    open,
    dismiss: () => setOpen(false),
    show: () => {
      if (sitting && atDesk) setOpen(true)
    },
  }
}

export function ComputerDesktop({
  officeId,
  boards,
  people,
  onStand,
  onLeave,
}: {
  officeId: string
  boards: DeskBoard[]
  people: Assignable[]
  onStand: () => void
  onLeave: () => void
}) {
  const [app, setApp] = useState<(typeof PROGRAMS)[number]['id'] | null>('tasks')
  const [boardId, setBoardId] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea')) return
      if (boardId) return
      event.preventDefault()
      if (app) {
        setApp(null)
        return
      }
      onLeave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [app, boardId, onLeave])

  const openBoard = boards.find((board) => board.id === boardId) ?? null
  const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="absolute inset-0 z-30 flex bg-ink p-2 text-ink sm:p-3">
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-[1.35rem] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]">
        <Wallpaper />
        <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-paper/90 px-4 py-2.5 text-ink backdrop-blur-md">
          <p className="text-xs font-bold tracking-[0.16em] text-ink/70 uppercase">CORP Realm</p>
          <p className="text-sm font-medium text-ink tabular-nums">{clock}</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onLeave} className="rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink">
              Leave screen
            </button>
            <button type="button" onClick={onStand} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
              Stand up
            </button>
          </div>
        </header>

        <nav className="absolute top-16 bottom-4 left-3 z-20 flex w-24 flex-col gap-3 sm:left-4" aria-label="Programs">
          {PROGRAMS.map((program) => {
            const active = app === program.id
            return (
              <button
                key={program.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setBoardId(null)
                  setApp(program.id)
                }}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={[
                    'grid h-16 w-16 place-items-center rounded-[1.15rem] bg-paper text-ink shadow-pop',
                    active ? 'ring-2 ring-ink' : '',
                  ].join(' ')}
                >
                  {program.id === 'stats' ? <StatsMark /> : <TasksMark />}
                </span>
                <span className="rounded-full bg-paper/95 px-2 py-0.5 text-xs font-bold text-ink">{program.label}</span>
              </button>
            )
          })}
        </nav>

        {app === 'tasks' && !openBoard ? (
          <section className="absolute top-16 right-3 bottom-4 left-28 z-10 flex flex-col overflow-hidden rounded-card bg-paper text-ink shadow-card sm:right-4 sm:left-32">
            <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-4 py-3">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">Tasks</p>
                <h2 className="font-bold text-3xl leading-none">All boards</h2>
                <p className="mt-1 text-xs text-ink/60">Every kanban on this floor. Open one to move cards.</p>
              </div>
              <button type="button" onClick={() => setApp(null)} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {boards.length === 0 ? (
                <p className="rounded-card border border-line bg-mist px-4 py-6 text-sm text-ink">No boards on this floor yet.</p>
              ) : (
                boards.map((board) => <BoardGlance key={board.id} board={board} onOpen={() => setBoardId(board.id)} />)
              )}
            </div>
          </section>
        ) : null}

        {app === 'tasks' && openBoard ? (
          <div className="absolute top-16 right-3 bottom-4 left-28 z-10 overflow-hidden rounded-card sm:right-4 sm:left-32">
            <div className="relative h-full">
              <TaskBoard boardId={openBoard.id} title={openBoard.title} people={people} onClose={() => setBoardId(null)} />
            </div>
          </div>
        ) : null}

        {app === 'stats' ? <StatsDesk officeId={officeId} onClose={() => setApp(null)} /> : null}
      </div>
    </div>
  )
}

function Wallpaper() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `
          radial-gradient(circle at 18% 24%, rgba(143,184,255,0.35), transparent 28%),
          radial-gradient(circle at 82% 16%, rgba(39,101,237,0.16), transparent 30%),
          radial-gradient(circle at 72% 82%, rgba(59,130,246,0.24), transparent 30%),
          linear-gradient(165deg, #ffffff 0%, #f3f6fc 46%, #e6eeff 100%)
        `,
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-ink">
        <img src="/branding/corplift-logo.svg" alt="CorpLift" className="w-56 max-w-[70%] sm:w-72" />
        <p className="mt-6 text-4xl leading-tight font-black text-ink sm:text-6xl">CORP Realm</p>
        <p className="mt-2 text-sm text-slate">The desk is on. Tasks and Stats are on the left.</p>
      </div>
    </div>
  )
}

function StatsMark() {
  return (
    <span className="relative grid h-9 w-9 place-items-center" aria-hidden="true">
      <span className="absolute h-8 w-8 rounded-full border-2 border-ink" />
      <span className="absolute top-1.5 h-3 w-0.5 rounded-full bg-lift" />
      <span className="absolute left-4 top-4 h-0.5 w-2.5 rounded-full bg-ink" />
    </span>
  )
}

function TasksMark() {
  return (
    <span className="flex h-9 items-end gap-1" aria-hidden="true">
      <span className="h-5 w-2 rounded-sm bg-sky" />
      <span className="h-8 w-2 rounded-sm bg-ink" />
      <span className="h-6 w-2 rounded-sm bg-lift" />
    </span>
  )
}

function BoardGlance({ board, onOpen }: { board: DeskBoard; onOpen: () => void }) {
  const saved = useTaskStore((state) => state.boards[board.id])
  const ensure = useTaskStore((state) => state.ensure)
  const data = saved ?? seedBoard(board.id)

  useEffect(() => {
    ensure(board.id)
  }, [board.id, ensure])

  return (
    <article className="rounded-card border border-line bg-mist p-3 text-ink">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate font-bold text-2xl leading-none">{board.title}</h3>
        <button type="button" onClick={onOpen} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
          Open
        </button>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {data.columns.map((column) => {
          const cards = column.cardIds.map((id) => data.cards[id]).filter((card) => card !== undefined)
          return (
            <div key={column.id} className="w-40 shrink-0 rounded-2xl bg-paper p-2 text-ink">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-bold text-ink">{column.title}</p>
                <span className="rounded-full bg-frost px-1.5 text-[11px] font-medium text-ink">{cards.length}</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {cards.length === 0 ? <p className="text-[11px] text-ink/60">Nothing here yet.</p> : null}
                {cards.slice(0, 3).map((card) => (
                  <p key={card.id} className="truncate rounded-xl bg-frost px-2 py-1 text-xs text-ink">
                    {card.title}
                  </p>
                ))}
                {cards.length > 3 ? <p className="text-[11px] font-medium text-ink/70">+{cards.length - 3} more</p> : null}
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}
