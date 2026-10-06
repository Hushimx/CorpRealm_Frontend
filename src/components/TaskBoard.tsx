import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { knownCopy, useLocale, useT } from '../i18n'
import { useSession } from '../net/session'
import {
  COLUMN_LIMIT,
  LABEL_COLORS,
  LABEL_HEX,
  STARTER_LABELS,
  asLabelColor,
  isDoneColumn,
  seedBoard,
  useTaskStore,
  type Checklist,
  type LabelColor,
  type Priority,
  type TaskCard,
  type TaskColumn,
} from '../store/tasks'

type Drag = { cardId: string; title: string; x: number; y: number }
type Drop = { columnId: string; beforeId: string | null }
type FilterMode = 'all' | 'mine' | 'due' | 'archived'
type Panel = 'labels' | 'dates' | 'checklist' | 'priority' | 'cover' | 'move' | null

export type Assignable = { id: string; name: string }

export function TaskBoard({ boardId, title, people = [], onClose }: { boardId: string; title: string; people?: Assignable[]; onClose: () => void }) {
  const t = useT()
  const me = useSession((state) => state.user)
  const saved = useTaskStore((state) => state.boards[boardId])
  const ensure = useTaskStore((state) => state.ensure)
  const addColumn = useTaskStore((state) => state.addColumn)
  const renameColumn = useTaskStore((state) => state.renameColumn)
  const removeColumn = useTaskStore((state) => state.removeColumn)
  const moveColumn = useTaskStore((state) => state.moveColumn)
  const addCard = useTaskStore((state) => state.addCard)
  const patchCard = useTaskStore((state) => state.patchCard)
  const moveCard = useTaskStore((state) => state.moveCard)
  const data = saved ?? seedBoard(boardId)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [creating, setCreating] = useState(false)
  const [naming, setNaming] = useState<string | null>(null)
  const [columnName, setColumnName] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
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
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select')) return
      event.preventDefault()
      if (editing) setEditing(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, onClose])

  const editingCard = editing ? data.cards[editing] : undefined

  function place(cardId: string, hit: Drop) {
    moveCard(boardId, cardId, hit.columnId, indexBefore(data.columns, hit.columnId, hit.beforeId, cardId))
  }

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
      if (hit) place(current.cardId, hit)
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
    <div className="absolute inset-0 z-20 flex flex-col bg-frost text-ink">
      <div className="flex flex-col gap-2 border-b border-ink/10 bg-paper px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">{t('tasks')}</p>
          <h2 className="truncate font-bold text-2xl leading-none sm:text-3xl">{knownCopy(title, t)}</h2>
        </div>
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto sm:flex-1 sm:flex-wrap sm:justify-end">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchCards')}
            className="w-36 shrink-0 rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift sm:w-52"
          />
          {(['all', 'mine', 'due', 'archived'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={filter === mode}
              onClick={() => setFilter(mode)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${filter === mode ? 'bg-ink text-paper' : 'bg-frost text-ink'}`}
            >
              {mode === 'all' ? t('all') : mode === 'mine' ? t('mine') : mode === 'due' ? t('due') : t('archive')}
            </button>
          ))}
          <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-bold text-paper">
            {t('close')}
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
        {data.columns.map((column, columnIndex) => {
          const visible = column.cardIds
            .map((id) => data.cards[id])
            .filter((card): card is TaskCard => card !== undefined && shows(card, filter, query, me?.id ?? '', isDoneColumn(column)) && card.id !== drag?.cardId)
          const count = column.cardIds.filter((id) => data.cards[id] && (filter === 'archived' ? data.cards[id].archived : !data.cards[id].archived)).length
          return (
            <section
              key={column.id}
              data-column={column.id}
              className="flex h-full w-[78vw] shrink-0 flex-col rounded-card bg-mist p-3 sm:w-72"
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
                if (hit) place(cardId, hit)
                setOver(null)
              }}
            >
              <div className="flex items-center gap-1">
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
                      className="w-full rounded-xl bg-paper px-2 py-1 text-sm font-bold text-ink outline-none"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setNaming(column.id)
                      setColumnName(column.title)
                    }}
                    className="min-w-0 flex-1 truncate text-start text-sm font-bold text-ink"
                  >
                    {knownCopy(column.title, t)}
                  </button>
                )}
                <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-ink">{count}</span>
                <button type="button" aria-label={t('moveListLeft')} disabled={columnIndex === 0} onClick={() => moveColumn(boardId, column.id, columnIndex - 1)} className="rounded-full px-1 text-sm font-bold text-ink disabled:text-ink/25">
                  ‹
                </button>
                <button type="button" aria-label={t('moveListRight')} disabled={columnIndex === data.columns.length - 1} onClick={() => moveColumn(boardId, column.id, columnIndex + 1)} className="rounded-full px-1 text-sm font-bold text-ink disabled:text-ink/25">
                  ›
                </button>
              </div>
              <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {visible.map((card) => (
                  <div key={card.id}>
                    {over?.columnId === column.id && over.beforeId === card.id ? <div className="mb-2 h-1 rounded-full bg-ink" /> : null}
                    <article data-card={card.id} className="overflow-hidden rounded-2xl border border-line bg-paper text-ink" onPointerDown={(event) => beginDrag(event, card)}>
                      {asLabelColor(card.cover) ? <div className="h-2" style={{ background: LABEL_HEX[asLabelColor(card.cover) as LabelColor] }} /> : null}
                      <div className="flex">
                        <button type="button" data-grip="" aria-label={t('dragCard', { title: card.title })} className="touch-none cursor-grab px-2 text-lg leading-none text-ink/70 active:cursor-grabbing">
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
                            setEditing(card.id)
                          }}
                          onDragStart={(event) => {
                            htmlDrag.current = card.id
                            event.dataTransfer.setData('text/plain', card.id)
                            event.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            htmlDrag.current = null
                            setOver(null)
                          }}
                          className="min-w-0 flex-1 cursor-grab px-1 py-2.5 pe-3 text-start active:cursor-grabbing"
                        >
                          <LabelRow labels={labelsFor(data.labels, card)} />
                          <span className="block text-sm font-medium text-ink">{card.title}</span>
                          {card.detail ? <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-ink/60">{card.detail}</span> : null}
                          <CardMeta card={card} done={isDoneColumn(column)} />
                        </button>
                      </div>
                      {card.archived ? (
                        <button type="button" onClick={() => patchCard(boardId, card.id, { archived: false })} className="mx-3 mb-3 rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">
                          {t('restore')}
                        </button>
                      ) : null}
                    </article>
                  </div>
                ))}
                {over?.columnId === column.id && over.beforeId === null ? <div className="h-1 rounded-full bg-ink" /> : null}
                {visible.length === 0 && over?.columnId !== column.id ? <p className="px-1 py-3 text-xs text-ink/60">{filter === 'all' && !query ? t('nothingYet') : t('noMatch')}</p> : null}
              </div>
              {filter === 'archived' ? null : adding === column.id ? (
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
                    placeholder={t('cardTitle')}
                    className="w-full rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button type="submit" className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
                      {t('addCard')}
                    </button>
                    <button type="button" onClick={() => { setAdding(null); setDraft('') }} className="text-xs font-medium text-ink">
                      {t('cancel')}
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => { setAdding(column.id); setDraft('') }} className="mt-2 rounded-2xl bg-paper px-3 py-2 text-start text-sm font-medium text-ink">
                  {t('addACard')}
                </button>
              )}
              {data.columns.length > 1 ? (
                <button type="button" onClick={() => removeColumn(boardId, column.id)} className="mt-2 text-start text-xs font-medium text-danger">
                  {t('removeList')}
                </button>
              ) : null}
            </section>
          )
        })}
        {data.columns.length < COLUMN_LIMIT ? (
          <section className="flex h-fit w-[78vw] shrink-0 flex-col rounded-card bg-paper p-3 sm:w-72">
            {creating ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  addColumn(boardId, columnName)
                  setColumnName('')
                  setCreating(false)
                }}
              >
                <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">{t('newList')}</p>
                <input
                  autoFocus
                  value={columnName}
                  onChange={(event) => setColumnName(event.target.value)}
                  placeholder={t('listName')}
                  className="mt-3 w-full rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button type="submit" className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
                    {t('addList')}
                  </button>
                  <button type="button" onClick={() => { setCreating(false); setColumnName('') }} className="text-xs font-medium text-ink">
                    {t('cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => { setCreating(true); setColumnName(''); setNaming(null) }} className="rounded-2xl bg-frost px-3 py-3 text-start text-sm font-bold text-ink">
                {t('addAList')}
              </button>
            )}
          </section>
        ) : null}
      </div>
      {drag ? (
        <div className="pointer-events-none fixed z-30 w-56 rounded-2xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink shadow-card" style={{ left: drag.x + 14, top: drag.y + 10 }}>
          {drag.title}
        </div>
      ) : null}
      {editingCard ? (
        <CardDialog
          key={editingCard.id}
          card={editingCard}
          boardId={boardId}
          people={people}
          me={me ? { id: me.id, name: me.name } : null}
          columns={data.columns}
          labels={data.labels ?? []}
          columnId={columnOf(data.columns, editingCard.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

function CardDialog({
  card,
  boardId,
  people,
  me,
  columns,
  labels,
  columnId,
  onClose,
}: {
  card: TaskCard
  boardId: string
  people: Assignable[]
  me: Assignable | null
  columns: TaskColumn[]
  labels: { id: string; name: string; color: LabelColor }[]
  columnId: string
  onClose: () => void
}) {
  const patchCard = useTaskStore((state) => state.patchCard)
  const removeCard = useTaskStore((state) => state.removeCard)
  const moveCard = useTaskStore((state) => state.moveCard)
  const addCard = useTaskStore((state) => state.addCard)
  const addLabel = useTaskStore((state) => state.addLabel)
  const renameLabel = useTaskStore((state) => state.renameLabel)
  const removeLabel = useTaskStore((state) => state.removeLabel)
  const addComment = useTaskStore((state) => state.addComment)
  const removeComment = useTaskStore((state) => state.removeComment)
  const [title, setTitle] = useState(card.title)
  const [detail, setDetail] = useState(card.detail)
  const [assigneeId, setAssigneeId] = useState(card.assigneeId ?? '')
  const [dueOn, setDueOn] = useState(card.dueOn ?? '')
  const [priority, setPriority] = useState<Priority>(card.priority === 'low' || card.priority === 'medium' || card.priority === 'high' ? card.priority : '')
  const [cover, setCover] = useState(asLabelColor(card.cover))
  const [panel, setPanel] = useState<Panel>(null)
  const [labelName, setLabelName] = useState('')
  const [labelColor, setLabelColor] = useState<LabelColor>('blue')
  const [listTitle, setListTitle] = useState('')
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({})
  const [comment, setComment] = useState('')
  const roster = people.some((person) => person.id === me?.id) || !me ? people : [...people, me]
  const t = useT()
  const locale = useLocale()
  const choices = roster.some((person) => person.id === card.assigneeId) || !card.assigneeId ? roster : [...roster, { id: card.assigneeId, name: card.assigneeName || t('assigned') }]
  const column = columns.find((item) => item.id === columnId)

  function save() {
    const person = choices.find((item) => item.id === assigneeId)
    patchCard(boardId, card.id, {
      title,
      detail,
      assigneeId,
      assigneeName: person?.name ?? '',
      dueOn,
      priority,
      cover,
    })
  }

  function toggleLabel(labelId: string) {
    const current = card.labelIds ?? []
    const labelIds = current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId]
    patchCard(boardId, card.id, { labelIds })
  }

  function setLists(checklists: Checklist[]) {
    patchCard(boardId, card.id, { checklists })
  }

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink/25 p-3 sm:p-5" onClick={onClose}>
      <form
        className="my-auto w-full max-w-3xl rounded-card bg-paper p-4 text-ink shadow-card"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          save()
          onClose()
        }}
      >
        {cover ? <div className="-mx-4 -mt-4 mb-4 h-8 rounded-t-[28px]" style={{ background: LABEL_HEX[cover] }} /> : null}
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">{t('card')}{column ? ` · ${knownCopy(column.title, t)}` : ''}</p>
            <LabelRow labels={labelsFor(labels, card)} />
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full bg-transparent font-bold text-3xl leading-none text-ink outline-none"
            />
            <label className="mt-4 block text-xs font-bold tracking-[0.14em] text-ink/60 uppercase">
              {t('description')}
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                rows={4}
                maxLength={2000}
                placeholder={t('descriptionHint')}
                className="mt-2 w-full resize-none rounded-2xl border border-ink/10 bg-mist px-3 py-2 text-sm font-medium text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
              />
            </label>
            <div className="mt-4 space-y-3">
              {(card.checklists ?? []).map((list) => {
                const done = list.items.filter((item) => item.done).length
                const progress = list.items.length === 0 ? 0 : Math.round((done / list.items.length) * 100)
                return (
                  <section key={list.id} className="rounded-2xl bg-mist p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="min-w-0 truncate text-sm font-bold text-ink">{list.title}</h3>
                      <button type="button" onClick={() => setLists((card.checklists ?? []).filter((item) => item.id !== list.id))} className="text-xs font-medium text-danger">
                        {t('delete')}
                      </button>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
                      <div className="h-full rounded-full bg-lift" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-ink/60">{done}/{list.items.length}</p>
                    <div className="mt-2 space-y-1.5">
                      {list.items.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 text-sm text-ink">
                          <label className="flex min-w-0 flex-1 items-start gap-2">
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={() => setLists((card.checklists ?? []).map((entry) => entry.id === list.id ? { ...entry, items: entry.items.map((row) => row.id === item.id ? { ...row, done: !row.done } : row) } : entry))}
                              className="mt-1"
                            />
                            <span className={item.done ? 'text-ink/50 line-through' : ''}>{item.text}</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setLists((card.checklists ?? []).map((entry) => entry.id === list.id ? { ...entry, items: entry.items.filter((row) => row.id !== item.id) } : entry))}
                            className="text-xs text-ink/50"
                            aria-label={t('removeItem')}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={itemDrafts[list.id] ?? ''}
                        onChange={(event) => setItemDrafts((current) => ({ ...current, [list.id]: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return
                          event.preventDefault()
                          const text = (itemDrafts[list.id] ?? '').trim()
                          if (!text) return
                          setLists((card.checklists ?? []).map((entry) => entry.id === list.id ? { ...entry, items: [...entry.items, { id: crypto.randomUUID(), text, done: false }] } : entry))
                          setItemDrafts((current) => ({ ...current, [list.id]: '' }))
                        }}
                        placeholder={t('addItem')}
                        className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-paper px-2 py-1.5 text-sm text-ink outline-none placeholder:text-ink/40"
                      />
                    </div>
                  </section>
                )
              })}
            </div>
            <section className="mt-4">
              <h3 className="text-xs font-bold tracking-[0.14em] text-ink/60 uppercase">{t('comments')}</h3>
              <div className="mt-2 space-y-2">
                {(card.comments ?? []).map((entry) => (
                  <article key={entry.id} className="rounded-2xl bg-mist px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-ink">{entry.authorName} <span className="font-medium text-ink/50">{new Date(entry.at).toLocaleString(locale)}</span></p>
                      {entry.authorId === me?.id ? (
                        <button type="button" onClick={() => removeComment(boardId, card.id, entry.id)} className="text-xs font-medium text-danger">
                          {t('delete')}
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-ink">{entry.text}</p>
                  </article>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    if (!me || !comment.trim()) return
                    addComment(boardId, card.id, comment, me.id, me.name)
                    setComment('')
                  }}
                  placeholder={me ? t('writeComment') : t('signInComment')}
                  disabled={!me}
                  className="min-w-0 flex-1 rounded-2xl border border-ink/10 bg-mist px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 disabled:text-ink/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!me || !comment.trim()) return
                    addComment(boardId, card.id, comment, me.id, me.name)
                    setComment('')
                  }}
                  className="rounded-full bg-ink px-3 py-2 text-xs font-bold text-paper"
                >
                  {t('comment')}
                </button>
              </div>
            </section>
          </div>
          <aside className="w-full shrink-0 space-y-2 lg:w-52">
            <p className="text-xs font-bold tracking-[0.14em] text-ink/60 uppercase">{t('addToCard')}</p>
            <label className="block text-xs text-ink/70">
              {t('members')}
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-lift"
              >
                <option value="">{t('unassigned')}</option>
                {choices.map((person) => (
                  <option key={person.id} value={person.id}>{person.name.trim() || t('unnamed')}</option>
                ))}
              </select>
            </label>
            <PanelButton label={t('labels')} open={panel === 'labels'} onClick={() => setPanel(panel === 'labels' ? null : 'labels')} />
            {panel === 'labels' ? (
              <div className="space-y-2 rounded-2xl bg-mist p-2">
                {labels.length === 0 ? (
                  <button type="button" onClick={() => { for (const label of STARTER_LABELS) addLabel(boardId, label.name, label.color, label.id) }} className="w-full rounded-xl bg-paper px-2 py-2 text-start text-xs font-bold text-ink">
                    {t('addStarter')}
                  </button>
                ) : null}
                {labels.map((label) => {
                  const on = (card.labelIds ?? []).includes(label.id)
                  return (
                    <div key={label.id} className="flex items-center gap-1">
                      <button type="button" onClick={() => toggleLabel(label.id)} className={`min-w-0 flex-1 rounded-xl px-2 py-1.5 text-start text-xs font-bold ${labelText(label.color)}`} style={{ background: LABEL_HEX[label.color] }}>
                        {on ? '✓ ' : ''}{knownCopy(label.name, t)}
                      </button>
                      <input
                        defaultValue={label.name}
                        aria-label={t('renameLabel', { name: knownCopy(label.name, t) })}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return
                          event.preventDefault()
                          renameLabel(boardId, label.id, event.currentTarget.value)
                        }}
                        onBlur={(event) => renameLabel(boardId, label.id, event.target.value)}
                        className="w-16 rounded-lg bg-paper px-1 py-1 text-[11px] text-ink outline-none"
                      />
                      <button type="button" aria-label={t('removeLabel', { name: knownCopy(label.name, t) })} onClick={() => removeLabel(boardId, label.id)} className="px-1 text-sm text-danger">×</button>
                    </div>
                  )
                })}
                <input
                  value={labelName}
                  onChange={(event) => setLabelName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    const id = addLabel(boardId, labelName, labelColor)
                    if (!id) return
                    patchCard(boardId, card.id, { labelIds: [...(card.labelIds ?? []), id] })
                    setLabelName('')
                  }}
                  placeholder={t('newLabel')}
                  className="w-full rounded-xl border border-ink/10 bg-paper px-2 py-1.5 text-xs text-ink outline-none placeholder:text-ink/40"
                />
                <div className="flex flex-wrap gap-1">
                  {LABEL_COLORS.map((color) => (
                    <button key={color} type="button" aria-label={t(color)} aria-pressed={labelColor === color} onClick={() => setLabelColor(color)} className={`h-5 w-5 rounded-full ${labelColor === color ? 'ring-2 ring-ink ring-offset-2 ring-offset-mist' : ''}`} style={{ background: LABEL_HEX[color] }} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const id = addLabel(boardId, labelName, labelColor)
                    if (!id) return
                    patchCard(boardId, card.id, { labelIds: [...(card.labelIds ?? []), id] })
                    setLabelName('')
                  }}
                  className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper"
                >
                  {t('createLabel')}
                </button>
              </div>
            ) : null}
            <PanelButton label={t('dates')} open={panel === 'dates'} onClick={() => setPanel(panel === 'dates' ? null : 'dates')} />
            {panel === 'dates' ? (
              <div className="rounded-2xl bg-mist p-2">
                <input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} className="w-full rounded-xl border border-ink/10 bg-paper px-2 py-1.5 text-sm text-ink outline-none [color-scheme:light]" />
                <button type="button" onClick={() => setDueOn('')} className="mt-2 text-xs font-medium text-ink">{t('clearDate')}</button>
              </div>
            ) : null}
            <PanelButton label={t('checklist')} open={panel === 'checklist'} onClick={() => setPanel(panel === 'checklist' ? null : 'checklist')} />
            {panel === 'checklist' ? (
              <div className="rounded-2xl bg-mist p-2">
                <input
                  value={listTitle}
                  onChange={(event) => setListTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    const name = listTitle.trim()
                    if (!name) return
                    setLists([...(card.checklists ?? []), { id: crypto.randomUUID(), title: name, items: [] }])
                    setListTitle('')
                    setPanel(null)
                  }}
                  placeholder={t('checklistName')}
                  className="w-full rounded-xl border border-ink/10 bg-paper px-2 py-1.5 text-xs text-ink outline-none placeholder:text-ink/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = listTitle.trim()
                    if (!name) return
                    setLists([...(card.checklists ?? []), { id: crypto.randomUUID(), title: name, items: [] }])
                    setListTitle('')
                    setPanel(null)
                  }}
                  className="mt-2 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper"
                >
                  {t('addChecklist')}
                </button>
              </div>
            ) : null}
            <PanelButton label={t('priority')} open={panel === 'priority'} onClick={() => setPanel(panel === 'priority' ? null : 'priority')} />
            {panel === 'priority' ? (
              <div className="flex flex-wrap gap-1 rounded-2xl bg-mist p-2">
                {(['', 'low', 'medium', 'high'] as const).map((level) => (
                  <button key={level || 'none'} type="button" aria-pressed={priority === level} onClick={() => setPriority(level)} className={`rounded-full px-2 py-1 text-xs font-bold ${priority === level ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
                    {level === 'low' ? t('priorityLow') : level === 'medium' ? t('priorityMedium') : level === 'high' ? t('priorityHigh') : t('none')}
                  </button>
                ))}
              </div>
            ) : null}
            <PanelButton label={t('cover')} open={panel === 'cover'} onClick={() => setPanel(panel === 'cover' ? null : 'cover')} />
            {panel === 'cover' ? (
              <div className="flex flex-wrap gap-1 rounded-2xl bg-mist p-2">
                <button type="button" onClick={() => setCover('')} className="rounded-full bg-paper px-2 py-1 text-xs font-bold text-ink">{t('none')}</button>
                {LABEL_COLORS.map((color) => (
                  <button key={color} type="button" aria-label={t(color)} aria-pressed={cover === color} onClick={() => setCover(color)} className={`h-6 w-6 rounded-full ${cover === color ? 'ring-2 ring-ink' : ''}`} style={{ background: LABEL_HEX[color] }} />
                ))}
              </div>
            ) : null}
            <PanelButton label={t('move')} open={panel === 'move'} onClick={() => setPanel(panel === 'move' ? null : 'move')} />
            {panel === 'move' ? (
              <div className="flex flex-col gap-1 rounded-2xl bg-mist p-2">
                {columns.map((item) => (
                  <button key={item.id} type="button" aria-pressed={item.id === columnId} onClick={() => moveCard(boardId, card.id, item.id, 999)} className={`rounded-xl px-2 py-1.5 text-start text-xs font-bold ${item.id === columnId ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
                    {knownCopy(item.title, t)}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const copyId = addCard(boardId, columnId, `${card.title} ${t('copySuffix')}`.slice(0, 80))
                if (!copyId) return
                patchCard(boardId, copyId, {
                  detail: card.detail,
                  assigneeId: card.assigneeId ?? '',
                  assigneeName: card.assigneeName ?? '',
                  dueOn: card.dueOn ?? '',
                  cover: asLabelColor(card.cover),
                  priority: card.priority === 'low' || card.priority === 'medium' || card.priority === 'high' ? card.priority : '',
                  labelIds: [...(card.labelIds ?? [])],
                  checklists: (card.checklists ?? []).map((list) => ({
                    id: crypto.randomUUID(),
                    title: list.title,
                    items: list.items.map((item) => ({ id: crypto.randomUUID(), text: item.text, done: item.done })),
                  })),
                })
                onClose()
              }}
              className="w-full rounded-2xl bg-frost px-3 py-2 text-start text-sm font-medium text-ink"
            >
              {t('copyCard')}
            </button>
            <button type="button" onClick={() => { patchCard(boardId, card.id, { archived: !card.archived }); onClose() }} className="w-full rounded-2xl bg-frost px-3 py-2 text-start text-sm font-medium text-ink">
              {card.archived ? t('sendBack') : t('archive')}
            </button>
            <button type="button" onClick={() => { removeCard(boardId, card.id); onClose() }} className="w-full rounded-2xl px-3 py-2 text-start text-sm font-medium text-danger">
              {t('deleteCard')}
            </button>
            <button type="submit" className="w-full rounded-full bg-ink px-3 py-2 text-xs font-bold text-paper">
              {t('save')}
            </button>
          </aside>
        </div>
      </form>
    </div>
  )
}

function PanelButton({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onClick} className={`w-full rounded-2xl px-3 py-2 text-start text-sm font-medium ${open ? 'bg-ink text-paper' : 'bg-frost text-ink'}`}>
      {label}
    </button>
  )
}

function LabelRow({ labels }: { labels: { id: string; name: string; color: LabelColor }[] }) {
  if (labels.length === 0) return null
  return (
    <div className="mb-1.5 flex flex-wrap gap-1">
      {labels.map((label) => (
        <LabelChip key={label.id} name={label.name} color={label.color} />
      ))}
    </div>
  )
}

function LabelChip({ name, color }: { name: string; color: LabelColor }) {
  const t = useT()
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${labelText(color)}`} style={{ background: LABEL_HEX[color] }}>
      {knownCopy(name, t)}
    </span>
  )
}

function CardMeta({ card, done }: { card: TaskCard; done: boolean }) {
  const t = useT()
  const locale = useLocale()
  const stats = checklistStats(card)
  const tone = dueTone(card.dueOn, done)
  const comments = card.comments?.length ?? 0
  const priority = card.priority === 'low' || card.priority === 'medium' || card.priority === 'high' ? card.priority : ''
  if (!card.dueOn && stats.total === 0 && comments === 0 && !priority && !card.assigneeName) return null
  return (
    <span className="mt-2 flex flex-wrap items-center gap-1.5">
      {card.dueOn ? (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tone === 'overdue' ? 'bg-paper text-danger ring-1 ring-danger/40' : tone === 'today' ? 'bg-frost text-ink' : 'bg-mist text-ink'}`}>
          {dueText(card.dueOn, locale)}
        </span>
      ) : null}
      {stats.total > 0 ? <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] font-medium text-ink">{stats.done}/{stats.total}</span> : null}
      {comments > 0 ? <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] font-medium text-ink">{comments === 1 ? t('oneComment') : t('nComments', { n: comments })}</span> : null}
      {priority ? <span className={`text-[11px] font-bold ${priority === 'high' ? 'text-danger' : priority === 'medium' ? 'text-lift' : 'text-ink/60'}`}>{priority === 'high' ? t('priorityHigh') : priority === 'medium' ? t('priorityMedium') : t('priorityLow')}</span> : null}
      {card.assigneeName ? <span className="ms-auto grid h-6 min-w-6 place-items-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper">{initials(card.assigneeName)}</span> : null}
    </span>
  )
}

function labelsFor(labels: { id: string; name: string; color: LabelColor }[] | undefined, card: TaskCard) {
  const ids = new Set(card.labelIds ?? [])
  return (labels ?? []).filter((label) => ids.has(label.id))
}

function checklistStats(card: TaskCard) {
  let total = 0
  let done = 0
  for (const list of card.checklists ?? []) {
    for (const item of list.items) {
      total += 1
      if (item.done) done += 1
    }
  }
  return { total, done }
}

function shows(card: TaskCard, filter: FilterMode, query: string, meId: string, done: boolean) {
  if (filter === 'archived') {
    if (!card.archived) return false
  } else if (card.archived) return false
  if (filter === 'mine' && (!meId || card.assigneeId !== meId)) return false
  if (filter === 'due' && (!card.dueOn || done)) return false
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const hay = [
    card.title,
    card.detail,
    card.assigneeName ?? '',
    ...(card.comments ?? []).map((entry) => entry.text),
    ...(card.checklists ?? []).flatMap((list) => [list.title, ...list.items.map((item) => item.text)]),
  ].join(' ').toLowerCase()
  return hay.includes(needle)
}

function dueTone(dueOn: string | undefined, done: boolean) {
  if (!dueOn) return ''
  if (done) return 'done'
  const today = dayKey()
  if (dueOn < today) return 'overdue'
  if (dueOn === today) return 'today'
  return 'later'
}

function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dueText(dueOn: string, locale: string) {
  const [year, month, day] = dueOn.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

function labelText(color: LabelColor) {
  return color === 'yellow' || color === 'sky' ? 'text-ink' : 'text-paper'
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

function columnOf(columns: { id: string; cardIds: string[] }[], cardId: string) {
  return columns.find((column) => column.cardIds.includes(cardId))?.id ?? columns[0]?.id ?? ''
}

function indexBefore(columns: TaskColumn[], columnId: string, beforeId: string | null, cardId: string) {
  const column = columns.find((item) => item.id === columnId)
  if (!column) return 0
  const ids = column.cardIds.filter((id) => id !== cardId)
  if (!beforeId) return ids.length
  const index = ids.indexOf(beforeId)
  return index < 0 ? ids.length : index
}

function dropAt(x: number, y: number, cardId: string): Drop | null {
  const column = document.elementsFromPoint(x, y).map((node) => (node instanceof HTMLElement ? node.closest('[data-column]') : null)).find((node) => node instanceof HTMLElement)
  if (!(column instanceof HTMLElement)) return null
  const columnId = column.dataset.column
  if (!columnId) return null
  const cards = [...column.querySelectorAll<HTMLElement>('[data-card]')].filter((node) => node.dataset.card !== cardId)
  for (const node of cards) {
    const rect = node.getBoundingClientRect()
    if (y < rect.top + rect.height / 2) return { columnId, beforeId: node.dataset.card || null }
  }
  return { columnId, beforeId: null }
}
