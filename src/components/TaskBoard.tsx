import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { COLUMN_LIMIT, seedBoard, useTaskStore, type TaskCard, type TaskColumn } from '../store/tasks'

type Drag = { cardId: string; title: string; x: number; y: number }
type Drop = { columnId: string; index: number }

export type Assignable = { id: string; name: string }

export function TaskBoard({ boardId, title, people = [], onClose }: { boardId: string; title: string; people?: Assignable[]; onClose: () => void }) {
  const saved = useTaskStore((state) => state.boards[boardId])
  const ensure = useTaskStore((state) => state.ensure)
  const addColumn = useTaskStore((state) => state.addColumn)
  const renameColumn = useTaskStore((state) => state.renameColumn)
  const removeColumn = useTaskStore((state) => state.removeColumn)
  const addCard = useTaskStore((state) => state.addCard)
  const patchCard = useTaskStore((state) => state.patchCard)
  const removeCard = useTaskStore((state) => state.removeCard)
  const moveCard = useTaskStore((state) => state.moveCard)
  const data = saved ?? seedBoard(boardId)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [creating, setCreating] = useState(false)
  const [naming, setNaming] = useState<string | null>(null)
  const [columnName, setColumnName] = useState('')
  const [drag, setDrag] = useState<Drag | null>(null)
  const [over, setOver] = useState<Drop | null>(null)
  const gesture = useRef<{ cardId: string; title: string; x: number; y: number; pointerId: number; active: boolean } | null>(null)
  const htmlDrag = useRef<string | null>(null)
  const suppressClick = useRef(false)
  const releaseDrag = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!saved) ensure(boardId)
  }, [boardId, ensure, saved])

  useEffect(() => () => releaseDrag.current?.(), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (editing) setEditing(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, onClose])

  const editingCard = editing ? data.cards[editing] : undefined

  function beginDrag(event: ReactPointerEvent<HTMLElement>, card: TaskCard) {
    if (event.button !== 0 || event.pointerType === 'mouse') return
    const grip = (event.target as HTMLElement).closest('[data-grip]')
    if (!grip) return
    event.stopPropagation()
    const current = { cardId: card.id, title: card.title, x: event.clientX, y: event.clientY, pointerId: event.pointerId, active: false }
    gesture.current = current
    const track = (move: PointerEvent) => {
      if (move.pointerId !== current.pointerId) return
      const distance = Math.hypot(move.clientX - current.x, move.clientY - current.y)
      if (!current.active && distance < 8) return
      current.active = true
      suppressClick.current = true
      setDrag({ cardId: current.cardId, title: current.title, x: move.clientX, y: move.clientY })
      setOver(dropAt(move.clientX, move.clientY, current.cardId))
    }
    const stop = () => {
      window.removeEventListener('pointermove', track)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      releaseDrag.current = null
    }
    const finish = (end: PointerEvent) => {
      if (end.pointerId !== current.pointerId) return
      stop()
      if (gesture.current === current) gesture.current = null
      if (!current.active) return
      const hit = dropAt(end.clientX, end.clientY, current.cardId)
      if (hit) moveCard(boardId, current.cardId, hit.columnId, hit.index)
      setDrag(null)
      setOver(null)
      window.setTimeout(() => {
        suppressClick.current = false
      }, 0)
    }
    releaseDrag.current = stop
    window.addEventListener('pointermove', track)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-ink/20 p-3 text-ink backdrop-blur-[2px] sm:p-5">
      <div className="flex items-center justify-between gap-3 rounded-card bg-paper/80 px-4 py-3 shadow-card backdrop-blur-md">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">Tasks</p>
          <h2 className="truncate font-bold text-3xl leading-none">{title}</h2>
          <p className="mt-1 text-xs text-ink/60">Drag a card between lists. The wall shows the same tasks. Esc steps back.</p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-bold text-paper">
          Close
        </button>
      </div>
      <div className="mt-3 flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
        {data.columns.map((column) => {
          const ids = column.cardIds
          const count = ids.filter((id) => data.cards[id]).length
          const visible = ids.filter((id) => id !== drag?.cardId && data.cards[id])
          return (
            <section
              key={column.id}
              data-column={column.id}
              className="flex h-full w-[78vw] shrink-0 flex-col rounded-card bg-paper/75 p-3 shadow-card backdrop-blur-md sm:w-72"
              onDragOver={(event) => {
                if (!htmlDrag.current) return
                event.preventDefault()
                setOver(dropAt(event.clientX, event.clientY, htmlDrag.current))
              }}
              onDrop={(event) => {
                event.preventDefault()
                const cardId = htmlDrag.current
                htmlDrag.current = null
                if (!cardId) return
                const hit = dropAt(event.clientX, event.clientY, cardId)
                if (hit) moveCard(boardId, cardId, hit.columnId, hit.index)
                setOver(null)
              }}
            >
              <div className="flex items-center justify-between gap-2">
                {naming === column.id ? (
                  <form
                    className="min-w-0 flex-1"
                    onSubmit={(event) => {
                      event.preventDefault()
                      renameColumn(boardId, column.id, columnName)
                      setNaming(null)
                    }}
                  >
                    <input
                      autoFocus
                      value={columnName}
                      onChange={(event) => setColumnName(event.target.value)}
                      onBlur={() => {
                        renameColumn(boardId, column.id, columnName)
                        setNaming(null)
                      }}
                      className="w-full bg-transparent text-sm font-bold text-ink outline-none"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setNaming(column.id)
                      setColumnName(column.title)
                    }}
                    className="min-w-0 truncate text-left text-sm font-bold text-ink"
                  >
                    {column.title}
                  </button>
                )}
                <span className="rounded-full bg-frost px-2 py-0.5 text-xs font-medium text-ink">{count}</span>
              </div>
              <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {visible.map((id, index) => {
                  const card = data.cards[id]
                  return (
                    <div key={id}>
                      {over?.columnId === column.id && over.index === index ? <div className="mb-2 h-1 rounded-full bg-ink" /> : null}
                      <div
                        data-card={id}
                        className="flex rounded-2xl bg-frost text-ink"
                        onPointerDown={(event) => beginDrag(event, card)}
                      >
                        <button
                          type="button"
                          data-grip=""
                          aria-label={`Drag ${card.title}`}
                          className="touch-none cursor-grab px-2 text-lg leading-none text-ink/70 active:cursor-grabbing"
                        >
                          ⋮
                        </button>
                        <button
                          type="button"
                          draggable
                          onClick={() => {
                            if (suppressClick.current) {
                              suppressClick.current = false
                              return
                            }
                            setEditing(id)
                          }}
                          onDragStart={(event) => {
                            htmlDrag.current = id
                            event.dataTransfer.setData('text/plain', id)
                            event.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            htmlDrag.current = null
                            setOver(null)
                          }}
                          className="min-w-0 flex-1 cursor-grab px-1 py-2.5 pr-3 text-left active:cursor-grabbing"
                        >
                          <span className="block text-sm font-medium">{card.title}</span>
                          {card.assigneeName ? <span className="mt-1 block text-xs font-medium text-lift">{card.assigneeName}</span> : null}
                          {card.detail ? <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-ink/60">{card.detail}</span> : null}
                        </button>
                      </div>
                    </div>
                  )
                })}
                {over?.columnId === column.id && over.index === visible.length ? <div className="h-1 rounded-full bg-ink" /> : null}
                {visible.length === 0 && over?.columnId !== column.id ? <p className="px-1 py-3 text-xs text-ink/60">Nothing here yet.</p> : null}
              </div>
              {adding === column.id ? (
                <form
                  className="mt-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    addCard(boardId, column.id, draft)
                    setDraft('')
                    setAdding(null)
                  }}
                >
                  <input
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Card title"
                    className="w-full rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button type="submit" className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
                      Add card
                    </button>
                    <button type="button" onClick={() => { setAdding(null); setDraft('') }} className="text-xs font-medium text-ink">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => { setAdding(column.id); setDraft('') }} className="mt-2 rounded-2xl bg-frost px-3 py-2 text-left text-sm font-medium text-ink">
                  Add a card
                </button>
              )}
              {data.columns.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeColumn(boardId, column.id)}
                  className="mt-2 text-left text-xs font-medium text-danger"
                >
                  Remove list
                </button>
              ) : null}
            </section>
          )
        })}
        {data.columns.length < COLUMN_LIMIT ? (
          <section className="flex h-full w-[78vw] shrink-0 flex-col rounded-card border border-dashed border-ink/25 bg-paper/55 p-3 sm:w-72">
            {creating ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  addColumn(boardId, columnName)
                  setColumnName('')
                  setCreating(false)
                }}
              >
                <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">New list</p>
                <input
                  autoFocus
                  value={columnName}
                  onChange={(event) => setColumnName(event.target.value)}
                  placeholder="Column name"
                  className="mt-3 w-full rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button type="submit" className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
                    Create column
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false)
                      setColumnName('')
                    }}
                    className="text-xs font-medium text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCreating(true)
                  setColumnName('')
                  setNaming(null)
                }}
                className="rounded-2xl bg-frost px-3 py-3 text-left text-sm font-bold text-ink"
              >
                Create column
              </button>
            )}
          </section>
        ) : null}
      </div>
      {drag ? (
        <div className="pointer-events-none fixed z-30 w-56 rounded-2xl bg-frost px-3 py-2 text-sm font-medium text-ink shadow-card" style={{ left: drag.x + 14, top: drag.y + 10 }}>
          {drag.title}
        </div>
      ) : null}
      {editingCard ? (
        <CardEditor
          card={editingCard}
          people={people}
          columns={data.columns}
          columnId={columnOf(data.columns, editingCard.id)}
          onClose={() => setEditing(null)}
          onSave={(patch) => patchCard(boardId, editingCard.id, patch)}
          onMove={(columnId) => moveCard(boardId, editingCard.id, columnId, 999)}
          onDelete={() => {
            removeCard(boardId, editingCard.id)
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}

function columnOf(columns: { id: string; cardIds: string[] }[], cardId: string) {
  return columns.find((column) => column.cardIds.includes(cardId))?.id ?? columns[0]?.id ?? ''
}

function dropAt(x: number, y: number, cardId: string): Drop | null {
  const column = document.elementsFromPoint(x, y).map((node) => (node instanceof HTMLElement ? node.closest('[data-column]') : null)).find((node) => node instanceof HTMLElement)
  if (!(column instanceof HTMLElement)) return null
  const columnId = column.dataset.column
  if (!columnId) return null
  const cards = [...column.querySelectorAll<HTMLElement>('[data-card]')].filter((node) => node.dataset.card !== cardId)
  let index = cards.length
  for (let i = 0; i < cards.length; i += 1) {
    const rect = cards[i].getBoundingClientRect()
    if (y < rect.top + rect.height / 2) {
      index = i
      break
    }
  }
  return { columnId, index }
}

function CardEditor({
  card,
  people,
  columns,
  columnId,
  onClose,
  onSave,
  onMove,
  onDelete,
}: {
  card: TaskCard
  people: Assignable[]
  columns: TaskColumn[]
  columnId: string
  onClose: () => void
  onSave: (patch: Partial<Pick<TaskCard, 'title' | 'detail' | 'assigneeId' | 'assigneeName'>>) => void
  onMove: (columnId: string) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(card.title)
  const [detail, setDetail] = useState(card.detail)
  const [assigneeId, setAssigneeId] = useState(card.assigneeId ?? '')
  const choices = people.some((person) => person.id === card.assigneeId) || !card.assigneeId
    ? people
    : [...people, { id: card.assigneeId, name: card.assigneeName || 'Assigned' }]
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/25 p-4" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-card bg-paper/90 p-4 text-ink shadow-card backdrop-blur-md"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          const person = choices.find((item) => item.id === assigneeId)
          onSave({ title, detail, assigneeId, assigneeName: person?.name ?? '' })
          onClose()
        }}
      >
        <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">Card</p>
        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 w-full bg-transparent font-bold text-3xl leading-none text-ink outline-none"
        />
        <textarea
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          rows={4}
          placeholder="Notes"
          className="mt-4 w-full resize-none rounded-2xl bg-frost px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40"
        />
        <label className="mt-3 block text-xs text-ink/70">
          Assign to
          <select
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-lift"
          >
            <option value="">Unassigned</option>
            {choices.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name.trim() || 'Unnamed'}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {columns.map((column) => (
            <button
              key={column.id}
              type="button"
              aria-pressed={column.id === columnId}
              onClick={() => onMove(column.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${column.id === columnId ? 'bg-ink text-paper' : 'bg-frost text-ink'}`}
            >
              {column.title}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={onDelete} className="text-sm font-medium text-danger">
            Delete card
          </button>
          <button type="submit" className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-paper">
            Save
          </button>
        </div>
      </form>
    </div>
  )
}
