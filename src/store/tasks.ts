import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_COLUMNS = [
  { id: 'todo', title: 'To do' },
  { id: 'doing', title: 'Doing' },
  { id: 'done', title: 'Done' },
] as const

const DEFAULT_TITLES: Record<string, string> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
}

export const COLUMN_LIMIT = 8

export const LABEL_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'sky'] as const
export type LabelColor = (typeof LABEL_COLORS)[number]
export type BoardLabel = { id: string; name: string; color: LabelColor }
export type CheckItem = { id: string; text: string; done: boolean }
export type Checklist = { id: string; title: string; items: CheckItem[] }
export type CardComment = { id: string; authorId: string; authorName: string; text: string; at: number }
export type Priority = '' | 'low' | 'medium' | 'high'

export const LABEL_HEX: Record<LabelColor, string> = {
  red: '#c0392b',
  orange: '#e07a2f',
  yellow: '#f2c14e',
  green: '#2f9e6b',
  blue: '#2765ed',
  purple: '#6d4aff',
  pink: '#e36aa2',
  sky: '#8fb8ff',
}

export const STARTER_LABELS: BoardLabel[] = [
  { id: 'label-urgent', name: 'Urgent', color: 'red' },
  { id: 'label-design', name: 'Design', color: 'purple' },
  { id: 'label-review', name: 'Review', color: 'yellow' },
  { id: 'label-blocked', name: 'Blocked', color: 'orange' },
  { id: 'label-ready', name: 'Ready', color: 'green' },
]

export function asLabelColor(value: string | undefined): LabelColor | '' {
  return value && (LABEL_COLORS as readonly string[]).includes(value) ? (value as LabelColor) : ''
}

export type TaskCard = {
  id: string
  title: string
  detail: string
  assigneeId?: string
  assigneeName?: string
  doneAt?: number
  labelIds?: string[]
  dueOn?: string
  checklists?: Checklist[]
  comments?: CardComment[]
  cover?: string
  priority?: Priority | string
  archived?: boolean
}

export type CardPatch = {
  title?: string
  detail?: string
  assigneeId?: string
  assigneeName?: string
  dueOn?: string
  cover?: string
  priority?: Priority
  archived?: boolean
  labelIds?: string[]
  checklists?: Checklist[]
}

export function isDoneColumn(column: { id: string; title: string }) {
  return column.id === 'done' || column.title.trim().toLowerCase() === 'done'
}

export type TaskColumn = {
  id: string
  title: string
  cardIds: string[]
}

export type TaskBoardData = {
  columns: TaskColumn[]
  cards: Record<string, TaskCard>
  labels?: BoardLabel[]
}

type TaskState = {
  boards: Record<string, TaskBoardData>
  ensure: (boardId: string) => void
  addColumn: (boardId: string, title: string) => void
  renameColumn: (boardId: string, columnId: string, title: string) => void
  removeColumn: (boardId: string, columnId: string) => void
  moveColumn: (boardId: string, columnId: string, index: number) => void
  addCard: (boardId: string, columnId: string, title: string) => string | null
  patchCard: (boardId: string, cardId: string, patch: CardPatch) => void
  removeCard: (boardId: string, cardId: string) => void
  moveCard: (boardId: string, cardId: string, columnId: string, index: number) => void
  addLabel: (boardId: string, name: string, color: LabelColor, id?: string) => string | null
  renameLabel: (boardId: string, labelId: string, name: string) => void
  removeLabel: (boardId: string, labelId: string) => void
  addComment: (boardId: string, cardId: string, text: string, authorId: string, authorName: string) => void
  removeComment: (boardId: string, cardId: string, commentId: string) => void
}

export type BoardEvent =
  | { boardId: string; op: 'addColumn'; title: string; id: string }
  | { boardId: string; op: 'renameColumn'; columnId: string; title: string }
  | { boardId: string; op: 'removeColumn'; columnId: string }
  | { boardId: string; op: 'moveColumn'; columnId: string; index: number }
  | { boardId: string; op: 'addCard'; columnId: string; title: string; id: string }
  | ({ boardId: string; op: 'patchCard'; cardId: string } & CardPatch)
  | { boardId: string; op: 'removeCard'; cardId: string }
  | { boardId: string; op: 'moveCard'; cardId: string; columnId: string; index: number }
  | { boardId: string; op: 'addLabel'; id: string; name: string; color: LabelColor }
  | { boardId: string; op: 'renameLabel'; labelId: string; name: string }
  | { boardId: string; op: 'removeLabel'; labelId: string }
  | { boardId: string; op: 'addComment'; cardId: string; id: string; text: string; authorId: string; authorName: string; at: number }
  | { boardId: string; op: 'removeComment'; cardId: string; commentId: string }

const boardListeners = new Set<(event: BoardEvent) => void>()

export function subscribeBoards(listener: (event: BoardEvent) => void) {
  boardListeners.add(listener)
  return () => boardListeners.delete(listener)
}

function emitBoard(event: BoardEvent) {
  for (const listener of boardListeners) listener(event)
}

export function mergeBoards(incoming: Record<string, TaskBoardData>) {
  useTaskStore.setState((state) => ({ boards: { ...state.boards, ...incoming } }))
}

const SEEDS: Record<string, { column: string; title: string; detail: string }[]> = {
  focus: [
    { column: 'doing', title: 'Deep work block', detail: 'Two quiet hours on the brief.' },
    { column: 'todo', title: 'File the notes', detail: 'Leave the desk clearer than you found it.' },
    { column: 'done', title: 'Close the door', detail: 'The room stays booked until noon.' },
  ],
  studio: [
    { column: 'todo', title: 'Pin the references', detail: 'Three looks for the lobby wall.' },
    { column: 'doing', title: 'Sketch the mark', detail: 'Keep it blocky and warm.' },
    { column: 'todo', title: 'Pick a paper stock', detail: 'Cream, not bright white.' },
  ],
  open: [
    { column: 'todo', title: 'Morning standup', detail: 'What moved, and what is stuck.' },
    { column: 'doing', title: 'Welcome the new desk', detail: 'A chair, a plant, and a name.' },
    { column: 'done', title: 'Water the plants', detail: 'The ones along the gallery.' },
  ],
  meet: [
    { column: 'todo', title: 'Write the agenda', detail: 'Decisions only. Twenty minutes.' },
    { column: 'doing', title: 'Share the screen', detail: 'The notes stay on this board.' },
    { column: 'done', title: 'Book the room', detail: 'Thursday, after lunch.' },
  ],
}

export function seedBoard(boardId: string): TaskBoardData {
  const cards: Record<string, TaskCard> = {}
  const columns: TaskColumn[] = DEFAULT_COLUMNS.map((column) => ({ id: column.id, title: column.title, cardIds: [] }))
  for (const item of SEEDS[boardId] ?? []) {
    const id = `${boardId}-${item.column}-${cardsKey(item.title)}`
    cards[id] = { id, title: item.title, detail: item.detail }
    columns.find((column) => column.id === item.column)?.cardIds.push(id)
  }
  return { columns, cards, labels: STARTER_LABELS.map((label) => ({ ...label })) }
}

function cardsKey(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function freshId() {
  return crypto.randomUUID()
}

function withBoard(state: TaskState, boardId: string) {
  return state.boards[boardId] ?? seedBoard(boardId)
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set) => ({
      boards: {},
      ensure: (boardId) =>
        set((state) => (state.boards[boardId] ? state : { boards: { ...state.boards, [boardId]: seedBoard(boardId) } })),
      addColumn: (boardId, title) => {
        const id = freshId()
        const trimmed = title.trim().slice(0, 32)
        let changed = false
        set((state) => {
          const board = withBoard(state, boardId)
          if (!trimmed || board.columns.length >= COLUMN_LIMIT) return state
          changed = true
          const column: TaskColumn = { id, title: trimmed, cardIds: [] }
          return { boards: { ...state.boards, [boardId]: { ...board, columns: [...board.columns, column] } } }
        })
        if (changed) emitBoard({ boardId, op: 'addColumn', title: trimmed, id })
      },
      renameColumn: (boardId, columnId, title) => {
        const trimmed = title.trim().slice(0, 32)
        let changed = false
        set((state) => {
          const board = state.boards[boardId]
          if (!board || !trimmed) return state
          changed = true
          return {
            boards: {
              ...state.boards,
              [boardId]: {
                ...board,
                columns: board.columns.map((column) => (column.id === columnId ? { ...column, title: trimmed } : column)),
              },
            },
          }
        })
        if (changed) emitBoard({ boardId, op: 'renameColumn', columnId, title: trimmed })
      },
      removeColumn: (boardId, columnId) => {
        let changed = false
        set((state) => {
          const board = state.boards[boardId]
          if (!board || board.columns.length < 2) return state
          const removed = board.columns.find((column) => column.id === columnId)
          if (!removed) return state
          changed = true
          const columns = board.columns
            .filter((column) => column.id !== columnId)
            .map((column) => ({ ...column, cardIds: [...column.cardIds] }))
          const host = columns[0]
          if (host) {
            for (const id of removed.cardIds) {
              if (board.cards[id] && !host.cardIds.includes(id)) host.cardIds.push(id)
            }
          }
          return { boards: { ...state.boards, [boardId]: { ...board, columns } } }
        })
        if (changed) emitBoard({ boardId, op: 'removeColumn', columnId })
      },
      moveColumn: (boardId, columnId, index) => {
        let changed = false
        set((state) => {
          const board = state.boards[boardId]
          if (!board) return state
          const from = board.columns.findIndex((column) => column.id === columnId)
          if (from < 0) return state
          const columns = board.columns.map((column) => ({ ...column, cardIds: [...column.cardIds] }))
          const [column] = columns.splice(from, 1)
          const at = Math.max(0, Math.min(index, columns.length))
          if (!column || at === from) return state
          changed = true
          columns.splice(at, 0, column)
          return { boards: { ...state.boards, [boardId]: { ...board, columns } } }
        })
        if (changed) emitBoard({ boardId, op: 'moveColumn', columnId, index })
      },
      addCard: (boardId, columnId, title) => {
        const id = freshId()
        const trimmed = title.trim().slice(0, 80)
        let changed = false
        set((state) => {
          const board = withBoard(state, boardId)
          if (!trimmed || !board.columns.some((column) => column.id === columnId)) return state
          changed = true
          const card = { id, title: trimmed, detail: '', assigneeId: '', assigneeName: '', doneAt: 0 }
          return {
            boards: {
              ...state.boards,
              [boardId]: {
                cards: { ...board.cards, [card.id]: card },
                columns: board.columns.map((column) =>
                  column.id === columnId ? { ...column, cardIds: [...column.cardIds, card.id] } : column,
                ),
              },
            },
          }
        })
        if (changed) emitBoard({ boardId, op: 'addCard', columnId, title: trimmed, id })
        return changed ? id : null
      },
      patchCard: (boardId, cardId, patch) => {
        let changed = false
        let nextPatch: CardPatch = {}
        set((state) => {
          const board = state.boards[boardId]
          const card = board?.cards[cardId]
          if (!board || !card) return state
          const next: TaskCard = { ...card }
          const sent: CardPatch = {}
          if (patch.title !== undefined) {
            const title = patch.title.trim().slice(0, 80)
            if (!title) return state
            next.title = title
            sent.title = title
          }
          if (patch.detail !== undefined) {
            next.detail = patch.detail.slice(0, 2000)
            sent.detail = next.detail
          }
          if (patch.assigneeId !== undefined) {
            const assigneeId = patch.assigneeId.trim().slice(0, 80)
            next.assigneeId = assigneeId
            next.assigneeName = assigneeId ? (patch.assigneeName ?? '').trim().slice(0, 40) : ''
            sent.assigneeId = next.assigneeId
            sent.assigneeName = next.assigneeName
          }
          if (patch.dueOn !== undefined) {
            next.dueOn = /^\d{4}-\d{2}-\d{2}$/.test(patch.dueOn) ? patch.dueOn : ''
            sent.dueOn = next.dueOn
          }
          if (patch.cover !== undefined) {
            next.cover = asLabelColor(patch.cover)
            sent.cover = next.cover
          }
          if (patch.priority !== undefined) {
            next.priority = patch.priority
            sent.priority = patch.priority
          }
          if (patch.archived !== undefined) {
            next.archived = patch.archived
            sent.archived = patch.archived
          }
          if (patch.labelIds !== undefined) {
            const known = new Set((board.labels ?? []).map((label) => label.id))
            next.labelIds = patch.labelIds.filter((id) => known.has(id)).slice(0, 8)
            sent.labelIds = next.labelIds
          }
          if (patch.checklists !== undefined) {
            next.checklists = patch.checklists.slice(0, 8).map((list) => ({
              ...list,
              title: list.title.trim().slice(0, 80),
              items: list.items.slice(0, 40).map((item) => ({ ...item, text: item.text.trim().slice(0, 160) })),
            })).filter((list) => list.title && list.id)
            sent.checklists = next.checklists
          }
          if (Object.keys(sent).length === 0) return state
          changed = true
          nextPatch = sent
          return { boards: { ...state.boards, [boardId]: { ...board, cards: { ...board.cards, [cardId]: next } } } }
        })
        if (changed) emitBoard({ boardId, op: 'patchCard', cardId, ...nextPatch })
      },
      removeCard: (boardId, cardId) => {
        let changed = false
        set((state) => {
          const board = state.boards[boardId]
          if (!board || !board.cards[cardId]) return state
          changed = true
          const cards = { ...board.cards }
          delete cards[cardId]
          return {
            boards: {
              ...state.boards,
              [boardId]: {
                cards,
                columns: board.columns.map((column) => ({ ...column, cardIds: column.cardIds.filter((id) => id !== cardId) })),
              },
            },
          }
        })
        if (changed) emitBoard({ boardId, op: 'removeCard', cardId })
      },
      moveCard: (boardId, cardId, columnId, index) => {
        let changed = false
        set((state) => {
          const board = state.boards[boardId]
          const card = board?.cards[cardId]
          if (!board || !card) return state
          const from = board.columns.find((column) => column.cardIds.includes(cardId))
          const columns = board.columns.map((column) => ({ ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }))
          const target = columns.find((column) => column.id === columnId)
          if (!target) return state
          changed = true
          const at = Math.max(0, Math.min(index, target.cardIds.length))
          target.cardIds = [...target.cardIds.slice(0, at), cardId, ...target.cardIds.slice(at)]
          const wasDone = from ? isDoneColumn(from) : false
          const nowDone = isDoneColumn(target)
          let doneAt = card.doneAt ?? 0
          if (nowDone && !wasDone) doneAt = Date.now()
          else if (!nowDone && wasDone) doneAt = 0
          return { boards: { ...state.boards, [boardId]: { ...board, columns, cards: { ...board.cards, [cardId]: { ...card, doneAt } } } } }
        })
        if (changed) emitBoard({ boardId, op: 'moveCard', cardId, columnId, index })
      },
      addLabel: (boardId, name, color, id = freshId()) => {
        const trimmed = name.trim().slice(0, 24)
        let changed = false
        set((state) => {
          const board = withBoard(state, boardId)
          const labels = board.labels ?? []
          if (!trimmed || !asLabelColor(color) || labels.length >= 12 || labels.some((label) => label.id === id)) return state
          changed = true
          return { boards: { ...state.boards, [boardId]: { ...board, labels: [...labels, { id, name: trimmed, color }] } } }
        })
        if (changed) emitBoard({ boardId, op: 'addLabel', id, name: trimmed, color })
        return changed ? id : null
      },
      renameLabel: (boardId, labelId, name) => {
        const trimmed = name.trim().slice(0, 24)
        let changed = false
        set((state) => {
          const board = state.boards[boardId]
          if (!board || !trimmed || !(board.labels ?? []).some((label) => label.id === labelId)) return state
          changed = true
          return {
            boards: {
              ...state.boards,
              [boardId]: { ...board, labels: (board.labels ?? []).map((label) => (label.id === labelId ? { ...label, name: trimmed } : label)) },
            },
          }
        })
        if (changed) emitBoard({ boardId, op: 'renameLabel', labelId, name: trimmed })
      },
      removeLabel: (boardId, labelId) => {
        let changed = false
        set((state) => {
          const board = state.boards[boardId]
          if (!board || !(board.labels ?? []).some((label) => label.id === labelId)) return state
          changed = true
          const cards = { ...board.cards }
          for (const [cardId, card] of Object.entries(cards)) {
            if (!card.labelIds?.includes(labelId)) continue
            cards[cardId] = { ...card, labelIds: card.labelIds.filter((id) => id !== labelId) }
          }
          return {
            boards: {
              ...state.boards,
              [boardId]: { ...board, cards, labels: (board.labels ?? []).filter((label) => label.id !== labelId) },
            },
          }
        })
        if (changed) emitBoard({ boardId, op: 'removeLabel', labelId })
      },
      addComment: (boardId, cardId, text, authorId, authorName) => {
        const id = freshId()
        const trimmed = text.trim().slice(0, 1000)
        const at = Date.now()
        let changed = false
        set((state) => {
          const board = state.boards[boardId]
          const card = board?.cards[cardId]
          if (!board || !card || !trimmed || !authorId) return state
          const comments = card.comments ?? []
          if (comments.length >= 100) return state
          changed = true
          return {
            boards: {
              ...state.boards,
              [boardId]: {
                ...board,
                cards: {
                  ...board.cards,
                  [cardId]: { ...card, comments: [...comments, { id, authorId, authorName: authorName.trim().slice(0, 40) || 'Someone', text: trimmed, at }] },
                },
              },
            },
          }
        })
        if (changed) emitBoard({ boardId, op: 'addComment', cardId, id, text: trimmed, authorId, authorName: authorName.trim().slice(0, 40) || 'Someone', at })
      },
      removeComment: (boardId, cardId, commentId) => {
        let changed = false
        set((state) => {
          const board = state.boards[boardId]
          const card = board?.cards[cardId]
          if (!board || !card?.comments?.some((item) => item.id === commentId)) return state
          changed = true
          return {
            boards: {
              ...state.boards,
              [boardId]: {
                ...board,
                cards: { ...board.cards, [cardId]: { ...card, comments: card.comments.filter((item) => item.id !== commentId) } },
              },
            },
          }
        })
        if (changed) emitBoard({ boardId, op: 'removeComment', cardId, commentId })
      },
    }),
    {
      name: 'corprealm-tasks',
      version: 3,
      migrate: (persisted) => {
        const state = persisted as { boards?: Record<string, { columns?: { id: string; title?: string; cardIds?: string[] }[]; cards?: Record<string, TaskCard>; labels?: BoardLabel[] }> }
        const boards: Record<string, TaskBoardData> = {}
        for (const [id, board] of Object.entries(state.boards ?? {})) {
          boards[id] = {
            cards: board.cards ?? {},
            labels: board.labels ?? [],
            columns: (board.columns ?? []).map((column) => ({
              id: column.id,
              title: column.title?.trim() || DEFAULT_TITLES[column.id] || 'Column',
              cardIds: column.cardIds ?? [],
            })),
          }
        }
        return { boards }
      },
    },
  ),
)
