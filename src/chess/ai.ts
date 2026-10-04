import { applyMove, inCheck, insufficient, legalMoves, type Move, type Piece, type Position } from './rules'

const VALUE: Record<Piece['kind'], number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

function place(piece: Piece, index: number) {
  const file = index % 8
  const rank = Math.floor(index / 8)
  const forward = piece.side === 'w' ? rank : 7 - rank
  if (piece.kind === 'p') return forward * 6 + (file > 1 && file < 6 ? 8 : 0)
  if (piece.kind === 'n' || piece.kind === 'b') {
    const filePull = 3 - Math.abs(file - 3.5)
    const rankPull = 3 - Math.abs(rank - 3.5)
    return (filePull + rankPull) * 3
  }
  return 0
}

function evaluate(pos: Position) {
  let score = 0
  for (let index = 0; index < 64; index++) {
    const found = pos.squares[index]
    if (!found) continue
    const sign = found.side === 'w' ? 1 : -1
    score += sign * (VALUE[found.kind] + place(found, index))
  }
  return score
}

function gain(pos: Position, move: Move) {
  const victim = pos.squares[move.to]
  const attacker = pos.squares[move.from]
  let score = move.promotion === 'q' ? 800 : 0
  if (victim && attacker) score += VALUE[victim.kind] * 10 - VALUE[attacker.kind]
  return score
}

function ordered(pos: Position) {
  return legalMoves(pos)
    .filter((move) => !move.promotion || move.promotion === 'q')
    .sort((a, b) => gain(pos, b) - gain(pos, a))
}

function minimax(pos: Position, depth: number, alpha: number, beta: number): number {
  if (pos.halfmove >= 100 || insufficient(pos.squares)) return 0
  const moves = ordered(pos)
  if (!moves.length) {
    if (!inCheck(pos, pos.turn)) return 0
    return pos.turn === 'w' ? -20000 - depth : 20000 + depth
  }
  if (depth === 0) return evaluate(pos)
  if (pos.turn === 'w') {
    let best = -Infinity
    for (const move of moves) {
      const score = minimax(applyMove(pos, move), depth - 1, alpha, beta)
      if (score > best) best = score
      if (score > alpha) alpha = score
      if (alpha >= beta) break
    }
    return best
  }
  let best = Infinity
  for (const move of moves) {
    const score = minimax(applyMove(pos, move), depth - 1, alpha, beta)
    if (score < best) best = score
    if (score < beta) beta = score
    if (alpha >= beta) break
  }
  return best
}

export function chooseMove(pos: Position, depth = 2): Move | null {
  const moves = ordered(pos)
  if (!moves.length) return null
  const maximize = pos.turn === 'w'
  let bestScore = maximize ? -Infinity : Infinity
  let pool: Move[] = []
  for (const move of moves) {
    const score = minimax(applyMove(pos, move), depth - 1, -Infinity, Infinity)
    const better = maximize ? score > bestScore : score < bestScore
    if (!pool.length || better) {
      bestScore = score
      pool = [move]
    } else if (score === bestScore) pool.push(move)
  }
  return pool[Math.floor(Math.random() * pool.length)] ?? null
}
