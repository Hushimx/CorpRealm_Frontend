import { useEffect, useState } from 'react'
import { seedBoard, useTaskStore } from '../store/tasks'
import { ChatDesk } from './ChatDesk'
import { FilesDesk } from './FilesDesk'
import { ProjectsDesk } from './ProjectsDesk'
import { ReportsDesk } from './ReportsDesk'
import { StatsDesk } from './StatsDesk'
import { ApiError, api } from '../net/api'
import { TaskBoard, type Assignable } from './TaskBoard'

export type DeskBoard = { id: string; title: string; projectId?: string | null; projectName?: string }

const PROGRAMS = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'chat', label: 'Chat' },
  { id: 'files', label: 'Files' },
  { id: 'reports', label: 'Reports' },
  { id: 'projects', label: 'Projects' },
  { id: 'stats', label: 'Stats' },
] as const

type ProgramId = (typeof PROGRAMS)[number]['id']

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
  const [app, setApp] = useState<ProgramId | null>(null)
  const [boardId, setBoardId] = useState<string | null>(null)
  const [custom, setCustom] = useState<DeskBoard[]>([])
  const [drafting, setDrafting] = useState(false)
  const [boardName, setBoardName] = useState('')
  const [boardProject, setBoardProject] = useState('')
  const [projectChoices, setProjectChoices] = useState<{ id: string; name: string }[]>([])
  const [boardError, setBoardError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const floorKey = boards.map((board) => board.id).join('\n')
  const catalog = [...boards, ...custom.filter((board) => !boards.some((floor) => floor.id === board.id))]

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let closed = false
    const floor = new Set(floorKey.split('\n').filter(Boolean))
    void api<{ boards: DeskBoard[] }>(`/offices/${officeId}/boards`)
      .then((next) => {
        if (!closed) setCustom(next.boards.filter((board) => !floor.has(board.id)))
      })
      .catch(() => undefined)
    return () => {
      closed = true
    }
  }, [officeId, floorKey])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select')) return
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

  const openBoard = catalog.find((board) => board.id === boardId) ?? null

  function openDeskBoard(board: DeskBoard) {
    setCustom((current) => (current.some((item) => item.id === board.id) || boards.some((item) => item.id === board.id) ? current : [...current, board]))
    setBoardId(board.id)
    setApp('tasks')
  }

  async function createBoard() {
    try {
      const created = await api<DeskBoard>(`/offices/${officeId}/boards`, {
        method: 'POST',
        body: JSON.stringify({ title: boardName, projectId: boardProject || undefined }),
      })
      setCustom((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setBoardName('')
      setBoardProject('')
      setDrafting(false)
      setBoardError('')
      setBoardId(created.id)
    } catch (reason) {
      setBoardError(reason instanceof ApiError ? reason.message : 'The board could not be created.')
    }
  }
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

        <nav className="absolute top-16 bottom-4 left-3 z-20 flex w-24 flex-col gap-3 overflow-y-auto sm:left-4" aria-label="Programs">
          {PROGRAMS.map((program) => {
            const active = app === program.id
            return (
              <button
                key={program.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setBoardId(null)
                  setApp((current) => (current === program.id ? null : program.id))
                }}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={[
                    'grid h-16 w-16 place-items-center rounded-[1.15rem] bg-paper text-ink shadow-pop',
                    active ? 'ring-2 ring-ink' : '',
                  ].join(' ')}
                >
                  <ProgramMark id={program.id} />
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
                <p className="mt-1 text-xs text-ink/60">Floor boards, plus any board you create. A new board can belong to a project.</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDrafting((value) => !value)
                    setBoardError('')
                    if (projectChoices.length === 0) {
                      void api<{ projects: { id: string; name: string }[] }>(`/offices/${officeId}/projects`)
                        .then((next) => setProjectChoices(next.projects))
                        .catch(() => undefined)
                    }
                  }}
                  className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper"
                >
                  New board
                </button>
                <button type="button" onClick={() => setApp(null)} className="rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink">
                  Close
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {drafting ? (
                <form
                  className="space-y-3 rounded-card bg-mist p-3 text-ink"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void createBoard()
                  }}
                >
                  <label className="block text-xs font-bold tracking-[0.14em] text-ink/50 uppercase">
                    Name
                    <input value={boardName} onChange={(event) => setBoardName(event.target.value)} placeholder="Launch checklist" className="mt-1 w-full rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm font-medium text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift" />
                  </label>
                  <label className="block text-xs font-bold tracking-[0.14em] text-ink/50 uppercase">
                    Project
                    <select value={boardProject} onChange={(event) => setBoardProject(event.target.value)} className="mt-1 w-full rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm font-medium text-ink outline-none">
                      <option value="">No project</option>
                      {projectChoices.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                  </label>
                  {boardError ? <p className="text-sm font-medium text-danger">{boardError}</p> : null}
                  <div className="flex gap-2">
                    <button type="submit" disabled={!boardName.trim()} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper disabled:opacity-60">
                      Create
                    </button>
                    <button type="button" onClick={() => setDrafting(false)} className="rounded-full bg-paper px-3 py-1.5 text-xs font-bold text-ink">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
              {catalog.length === 0 ? (
                <p className="rounded-card border border-line bg-mist px-4 py-6 text-sm text-ink">No boards on this floor yet.</p>
              ) : (
                catalog.map((board) => <BoardGlance key={board.id} board={board} onOpen={() => setBoardId(board.id)} />)
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

        {app === 'chat' ? <ChatDesk officeId={officeId} people={people} onClose={() => setApp(null)} /> : null}
        {app === 'files' ? <FilesDesk officeId={officeId} onClose={() => setApp(null)} /> : null}
        {app === 'reports' ? <ReportsDesk officeId={officeId} people={people} onClose={() => setApp(null)} /> : null}
        {app === 'projects' ? <ProjectsDesk officeId={officeId} onClose={() => setApp(null)} onOpenBoard={openDeskBoard} /> : null}
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
        <p className="mt-2 text-sm text-slate">The desk is on. Open a program on the left.</p>
      </div>
    </div>
  )
}

function ProgramMark({ id }: { id: ProgramId }) {
  if (id === 'stats') return <StatsMark />
  if (id === 'chat') return <ChatMark />
  if (id === 'files') return <FilesMark />
  if (id === 'reports') return <ReportsMark />
  if (id === 'projects') return <ProjectsMark />
  return <TasksMark />
}

function ChatMark() {
  return (
    <span className="relative h-9 w-9 text-ink" aria-hidden="true">
      <span className="absolute top-1 left-0 h-6 w-7 rounded-lg border-2 border-ink" />
      <span className="absolute right-0 bottom-1 h-5 w-6 rounded-md border-2 border-lift bg-paper" />
    </span>
  )
}

function FilesMark() {
  return (
    <span className="relative h-9 w-8" aria-hidden="true">
      <span className="absolute top-1 left-0 h-2.5 w-4 rounded-t-md bg-lift" />
      <span className="absolute top-3 left-0 h-5 w-8 rounded-md rounded-tl-none bg-ink" />
    </span>
  )
}

function ReportsMark() {
  return (
    <span className="relative h-9 w-7" aria-hidden="true">
      <span className="absolute inset-0 rounded-md border-2 border-ink bg-paper" />
      <span className="absolute top-2.5 right-1.5 left-1.5 h-0.5 rounded-full bg-lift" />
      <span className="absolute top-4 right-2 left-1.5 h-0.5 rounded-full bg-ink" />
      <span className="absolute top-[1.35rem] right-2.5 left-1.5 h-0.5 rounded-full bg-ink/40" />
    </span>
  )
}

function ProjectsMark() {
  return (
    <span className="grid h-8 w-8 grid-cols-2 gap-1" aria-hidden="true">
      <span className="rounded-sm bg-ink" />
      <span className="rounded-sm bg-lift" />
      <span className="rounded-sm bg-lift" />
      <span className="rounded-sm bg-ink" />
    </span>
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
        <div className="min-w-0">
          <h3 className="truncate font-bold text-2xl leading-none">{board.title}</h3>
          {board.projectName ? <p className="mt-1 truncate text-xs font-medium text-ink/60">{board.projectName}</p> : null}
        </div>
        <button type="button" onClick={onOpen} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
          Open
        </button>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {data.columns.map((column) => {
          const cards = column.cardIds.map((id) => data.cards[id]).filter((card) => card !== undefined && !card.archived)
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
