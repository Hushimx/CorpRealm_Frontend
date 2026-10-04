export type Mark = 'x' | 'o'
export type Cell = Mark | null

export type XoMatch = {
  cells: Cell[]
  turn: Mark
  winner: Mark | 'draw' | null
}

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

export function createXo(): XoMatch {
  return { cells: Array.from({ length: 9 }, () => null), turn: 'x', winner: null }
}

export function lineWinner(cells: Cell[]): Mark | null {
  for (const [a, b, c] of LINES) {
    const mark = cells[a]
    if (mark && mark === cells[b] && mark === cells[c]) return mark
  }
  return null
}

export function playXo(game: XoMatch, index: number): XoMatch | null {
  if (game.winner || !Number.isInteger(index) || index < 0 || index > 8 || game.cells[index]) return null
  const cells = game.cells.slice()
  cells[index] = game.turn
  const winner = lineWinner(cells)
  const full = cells.every((cell) => cell !== null)
  return { cells, turn: game.turn === 'x' ? 'o' : 'x', winner: winner ?? (full ? 'draw' : null) }
}

export function xoStatus(game: XoMatch) {
  if (game.winner === 'draw') return 'Draw.'
  if (game.winner === 'x') return 'X wins.'
  if (game.winner === 'o') return 'O wins.'
  return `${game.turn === 'x' ? 'X' : 'O'} to move.`
}

export function chooseXo(game: XoMatch): number | null {
  if (game.winner) return null
  let best = game.turn === 'x' ? -Infinity : Infinity
  let pick: number | null = null
  for (let index = 0; index < 9; index++) {
    if (game.cells[index]) continue
    const next = playXo(game, index)
    if (!next) continue
    const score = rate(next, 1)
    const better = game.turn === 'x' ? score > best : score < best
    if (pick === null || better) {
      best = score
      pick = index
    }
  }
  return pick
}

function rate(game: XoMatch, depth: number): number {
  if (game.winner === 'x') return 10 - depth
  if (game.winner === 'o') return depth - 10
  if (game.winner === 'draw') return 0
  let best = game.turn === 'x' ? -Infinity : Infinity
  for (let index = 0; index < 9; index++) {
    if (game.cells[index]) continue
    const next = playXo(game, index)
    if (!next) continue
    const score = rate(next, depth + 1)
    best = game.turn === 'x' ? Math.max(best, score) : Math.min(best, score)
  }
  return best
}
