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

export type TaskCard = {
  id: string
  title: string
  detail: string
  assigneeId?: string
  assigneeName?: string
  doneAt?: number
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
}

type TaskState = {
  boards: Record<string, TaskBoardData>
  ensure: (boardId: string) => void
  addColumn: (boardId: string, title: string) => void
  renameColumn: (boardId: string, columnId: string, title: string) => void
  removeColumn: (boardId: string, columnId: string) => void
  addCard: (boardId: string, columnId: string, title: string) => void
  patchCard: (boardId: string, cardId: string, patch: Partial<Pick<TaskCard, 'title' | 'detail' | 'assigneeId' | 'assigneeName'>>) => void
  removeCard: (boardId: string, cardId: string) => void
  moveCard: (boardId: string, cardId: string, columnId: string, index: number) => void
}

export type BoardEvent =
  | { boardId: string; op: 'addColumn'; title: string; id: string }
  | { boardId: string; op: 'renameColumn'; columnId: string; title: string }
  | { boardId: string; op: 'removeColumn'; columnId: string }
  | { boardId: string; op: 'addCard'; columnId: string; title: string; id: string }
  | { boardId: string; op: 'patchCard'; cardId: string; title?: string; detail?: string; assigneeId?: string; assigneeName?: string }
  | { boardId: string; op: 'removeCard'; cardId: string }
  | { boardId: string; op: 'moveCard'; cardId: string; columnId: string; index: number }

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
  return { columns, cards }
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
      },
      patchCard: (boardId, cardId, patch) => {
        let changed = false
        let title = ''
        let detail = ''
        let assigneeId = ''
        let assigneeName = ''
        set((state) => {
          const board = state.boards[boardId]
          const card = board?.cards[cardId]
          if (!board || !card) return state
          title = patch.title === undefined ? card.title : patch.title.trim().slice(0, 80)
          if (!title) return state
          detail = patch.detail === undefined ? card.detail : patch.detail.slice(0, 400)
          assigneeId = patch.assigneeId === undefined ? (card.assigneeId ?? '') : patch.assigneeId.trim().slice(0, 80)
          assigneeName = assigneeId ? (patch.assigneeName === undefined ? (card.assigneeName ?? '') : patch.assigneeName.trim().slice(0, 40)) : ''
          changed = true
          return {
            boards: {
              ...state.boards,
              [boardId]: { ...board, cards: { ...board.cards, [cardId]: { ...card, title, detail, assigneeId, assigneeName } } },
            },
          }
        })
        if (changed) emitBoard({ boardId, op: 'patchCard', cardId, title, detail, assigneeId, assigneeName })
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
    }),
    {
      name: 'corprealm-tasks',
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { boards?: Record<string, { columns?: { id: string; title?: string; cardIds?: string[] }[]; cards?: Record<string, TaskCard> }> }
        const boards: Record<string, TaskBoardData> = {}
        for (const [id, board] of Object.entries(state.boards ?? {})) {
          boards[id] = {
            cards: board.cards ?? {},
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
