export type Side = 'w' | 'b'
export type Kind = 'k' | 'q' | 'r' | 'b' | 'n' | 'p'
export type Piece = { side: Side; kind: Kind }
export type Promotion = Exclude<Kind, 'k' | 'p'>

export type Move = {
  from: number
  to: number
  promotion?: Promotion
}

export type Castling = { wk: boolean; wq: boolean; bk: boolean; bq: boolean }

export type Position = {
  squares: (Piece | null)[]
  turn: Side
  castling: Castling
  enPassant: number | null
  halfmove: number
  fullmove: number
}

export type Game = {
  position: Position
  seen: string[]
  log: string[]
  last: { from: number; to: number } | null
}

export type Ending = {
  kind: 'play' | 'check' | 'mate' | 'stalemate' | 'draw'
  reason: string
}

const FILES = 'abcdefgh'
const PROMO: Record<Exclude<Kind, 'p'>, string> = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N' }
const KNIGHTS: [number, number][] = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
]
const BISHOP: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]
const ROOK: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export function fileOf(index: number) {
  return index % 8
}

export function rankOf(index: number) {
  return Math.floor(index / 8)
}

export function squareName(index: number) {
  return `${FILES[fileOf(index)]}${rankOf(index) + 1}`
}

function onBoard(file: number, rank: number) {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8
}

function at(file: number, rank: number) {
  return rank * 8 + file
}

function piece(side: Side, kind: Kind): Piece {
  return { side, kind }
}

export function startPosition(): Position {
  const squares: (Piece | null)[] = Array.from({ length: 64 }, () => null)
  const back: Kind[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
  for (let file = 0; file < 8; file++) {
    squares[file] = piece('w', back[file])
    squares[8 + file] = piece('w', 'p')
    squares[48 + file] = piece('b', 'p')
    squares[56 + file] = piece('b', back[file])
  }
  return {
    squares,
    turn: 'w',
    castling: { wk: true, wq: true, bk: true, bq: true },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
  }
}

export function createGame(): Game {
  const position = startPosition()
  return { position, seen: [positionKey(position)], log: [], last: null }
}

export function positionKey(pos: Position) {
  let board = ''
  for (const square of pos.squares) board += square ? square.side + square.kind : '.'
  const castle = pos.castling
  const rights = `${castle.wk ? 'K' : ''}${castle.wq ? 'Q' : ''}${castle.bk ? 'k' : ''}${castle.bq ? 'q' : ''}`
  return `${board}${pos.turn}${rights}${pos.enPassant ?? '-'}`
}

export function opponent(side: Side): Side {
  return side === 'w' ? 'b' : 'w'
}

function rayHits(squares: (Piece | null)[], file: number, rank: number, by: Side, df: number, dr: number, kinds: Kind[]) {
  let nextFile = file + df
  let nextRank = rank + dr
  while (onBoard(nextFile, nextRank)) {
    const found = squares[at(nextFile, nextRank)]
    if (found) return found.side === by && kinds.includes(found.kind)
    nextFile += df
    nextRank += dr
  }
  return false
}

export function isAttacked(squares: (Piece | null)[], target: number, by: Side) {
  const file = fileOf(target)
  const rank = rankOf(target)
  const pawnRank = by === 'w' ? rank - 1 : rank + 1
  for (const df of [-1, 1]) {
    if (!onBoard(file + df, pawnRank)) continue
    const pawn = squares[at(file + df, pawnRank)]
    if (pawn?.side === by && pawn.kind === 'p') return true
  }
  for (const [df, dr] of KNIGHTS) {
    if (!onBoard(file + df, rank + dr)) continue
    const knight = squares[at(file + df, rank + dr)]
    if (knight?.side === by && knight.kind === 'n') return true
  }
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (!df && !dr) continue
      if (!onBoard(file + df, rank + dr)) continue
      const king = squares[at(file + df, rank + dr)]
      if (king?.side === by && king.kind === 'k') return true
    }
  }
  for (const [df, dr] of BISHOP) {
    if (rayHits(squares, file, rank, by, df, dr, ['b', 'q'])) return true
  }
  for (const [df, dr] of ROOK) {
    if (rayHits(squares, file, rank, by, df, dr, ['r', 'q'])) return true
  }
  return false
}

export function inCheck(pos: Position, side: Side) {
  const king = pos.squares.findIndex((square) => square?.kind === 'k' && square.side === side)
  if (king < 0) return true
  return isAttacked(pos.squares, king, opponent(side))
}

function addPawn(moves: Move[], from: number, to: number, side: Side) {
  const rank = rankOf(to)
  if ((side === 'w' && rank === 7) || (side === 'b' && rank === 0)) {
    const promotions: Promotion[] = ['q', 'r', 'b', 'n']
    for (const promotion of promotions) moves.push({ from, to, promotion })
    return
  }
  moves.push({ from, to })
}

function slide(moves: Move[], squares: (Piece | null)[], from: number, side: Side, df: number, dr: number) {
  let file = fileOf(from) + df
  let rank = rankOf(from) + dr
  while (onBoard(file, rank)) {
    const index = at(file, rank)
    const occupant = squares[index]
    if (!occupant) moves.push({ from, to: index })
    else {
      if (occupant.side !== side) moves.push({ from, to: index })
      break
    }
    file += df
    rank += dr
  }
}

function addCastles(pos: Position, moves: Move[], side: Side) {
  const home = side === 'w' ? 4 : 60
  const king = pos.squares[home]
  if (!king || king.kind !== 'k' || king.side !== side || inCheck(pos, side)) return
  const rank = side === 'w' ? 0 : 7
  const enemy = opponent(side)
  const kingside = side === 'w' ? pos.castling.wk : pos.castling.bk
  const queenside = side === 'w' ? pos.castling.wq : pos.castling.bq
  const rook = (file: number) => {
    const found = pos.squares[at(file, rank)]
    return found?.kind === 'r' && found.side === side
  }
  if (kingside && !pos.squares[at(5, rank)] && !pos.squares[at(6, rank)] && rook(7)) {
    if (!isAttacked(pos.squares, at(5, rank), enemy) && !isAttacked(pos.squares, at(6, rank), enemy)) {
      moves.push({ from: home, to: at(6, rank) })
    }
  }
  if (queenside && !pos.squares[at(1, rank)] && !pos.squares[at(2, rank)] && !pos.squares[at(3, rank)] && rook(0)) {
    if (!isAttacked(pos.squares, at(2, rank), enemy) && !isAttacked(pos.squares, at(3, rank), enemy)) {
      moves.push({ from: home, to: at(2, rank) })
    }
  }
}

function pseudo(pos: Position) {
  const moves: Move[] = []
  const side = pos.turn
  for (let from = 0; from < 64; from++) {
    const current = pos.squares[from]
    if (!current || current.side !== side) continue
    const file = fileOf(from)
    const rank = rankOf(from)
    if (current.kind === 'p') {
      const dir = side === 'w' ? 1 : -1
      const start = side === 'w' ? 1 : 6
      const ahead = rank + dir
      if (onBoard(file, ahead) && !pos.squares[at(file, ahead)]) {
        addPawn(moves, from, at(file, ahead), side)
        const skip = rank + dir * 2
        if (rank === start && !pos.squares[at(file, skip)]) addPawn(moves, from, at(file, skip), side)
      }
      for (const df of [-1, 1]) {
        if (!onBoard(file + df, ahead)) continue
        const to = at(file + df, ahead)
        const occupant = pos.squares[to]
        if (occupant && occupant.side !== side) addPawn(moves, from, to, side)
        if (pos.enPassant === to) {
          const victim = pos.squares[at(file + df, rank)]
          if (victim?.kind === 'p' && victim.side !== side) moves.push({ from, to })
        }
      }
      continue
    }
    if (current.kind === 'n') {
      for (const [df, dr] of KNIGHTS) {
        if (!onBoard(file + df, rank + dr)) continue
        const to = at(file + df, rank + dr)
        const occupant = pos.squares[to]
        if (!occupant || occupant.side !== side) moves.push({ from, to })
      }
      continue
    }
    if (current.kind === 'k') {
      for (let df = -1; df <= 1; df++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (!df && !dr) continue
          if (!onBoard(file + df, rank + dr)) continue
          const to = at(file + df, rank + dr)
          const occupant = pos.squares[to]
          if (!occupant || occupant.side !== side) moves.push({ from, to })
        }
      }
      continue
    }
    const steps = current.kind === 'b' ? BISHOP : current.kind === 'r' ? ROOK : [...BISHOP, ...ROOK]
    for (const [df, dr] of steps) slide(moves, pos.squares, from, side, df, dr)
  }
  addCastles(pos, moves, side)
  return moves
}

export function applyMove(pos: Position, move: Move): Position {
  const moving = pos.squares[move.from]
  if (!moving) return pos
  const captured = pos.squares[move.to]
  const squares = pos.squares.slice()
  squares[move.from] = null
  const ep = moving.kind === 'p' && move.to === pos.enPassant
  if (ep) squares[move.to + (moving.side === 'w' ? -8 : 8)] = null
  squares[move.to] = move.promotion ? { side: moving.side, kind: move.promotion } : moving
  if (moving.kind === 'k' && Math.abs(fileOf(move.to) - fileOf(move.from)) === 2) {
    const rank = rankOf(move.from)
    if (fileOf(move.to) === 6) {
      squares[at(5, rank)] = squares[at(7, rank)]
      squares[at(7, rank)] = null
    } else {
      squares[at(3, rank)] = squares[at(0, rank)]
      squares[at(0, rank)] = null
    }
  }
  const castling = { ...pos.castling }
  if (moving.kind === 'k') {
    if (moving.side === 'w') {
      castling.wk = false
      castling.wq = false
    } else {
      castling.bk = false
      castling.bq = false
    }
  }
  const dropRook = (square: number) => {
    if (square === 0) castling.wq = false
    if (square === 7) castling.wk = false
    if (square === 56) castling.bq = false
    if (square === 63) castling.bk = false
  }
  if (moving.kind === 'r') dropRook(move.from)
  if (captured?.kind === 'r') dropRook(move.to)
  let enPassant: number | null = null
  if (moving.kind === 'p' && Math.abs(rankOf(move.to) - rankOf(move.from)) === 2) {
    enPassant = at(fileOf(move.from), (rankOf(move.from) + rankOf(move.to)) / 2)
  }
  return {
    squares,
    turn: opponent(moving.side),
    castling,
    enPassant,
    halfmove: moving.kind === 'p' || captured || ep ? 0 : pos.halfmove + 1,
    fullmove: pos.fullmove + (moving.side === 'b' ? 1 : 0),
  }
}

export function legalMoves(pos: Position) {
  return pseudo(pos).filter((move) => !inCheck(applyMove(pos, move), pos.turn))
}

export function insufficient(squares: (Piece | null)[]) {
  let minors = 0
  const bishops: { side: Side; dark: boolean }[] = []
  for (let index = 0; index < 64; index++) {
    const found = squares[index]
    if (!found || found.kind === 'k') continue
    if (found.kind === 'n') {
      minors++
      continue
    }
    if (found.kind === 'b') {
      minors++
      bishops.push({ side: found.side, dark: (fileOf(index) + rankOf(index)) % 2 === 1 })
      continue
    }
    return false
  }
  if (minors <= 1) return true
  return minors === 2 && bishops.length === 2 && bishops[0].side !== bishops[1].side && bishops[0].dark === bishops[1].dark
}

export function classify(game: Game): Ending {
  const moves = legalMoves(game.position)
  const check = inCheck(game.position, game.position.turn)
  if (!moves.length) return check ? { kind: 'mate', reason: 'Checkmate' } : { kind: 'stalemate', reason: 'Stalemate' }
  if (game.position.halfmove >= 100) return { kind: 'draw', reason: 'Fifty-move rule' }
  const key = positionKey(game.position)
  let repeats = 0
  for (const item of game.seen) if (item === key) repeats++
  if (repeats >= 3) return { kind: 'draw', reason: 'Threefold repetition' }
  if (insufficient(game.position.squares)) return { kind: 'draw', reason: 'Not enough material' }
  return check ? { kind: 'check', reason: 'Check' } : { kind: 'play', reason: '' }
}

function san(pos: Position, move: Move, legal: Move[]) {
  const moving = pos.squares[move.from]
  if (!moving) return squareName(move.to)
  if (moving.kind === 'k' && Math.abs(fileOf(move.to) - fileOf(move.from)) === 2) {
    return fileOf(move.to) === 6 ? 'O-O' : 'O-O-O'
  }
  const capture = Boolean(pos.squares[move.to]) || (moving.kind === 'p' && move.to === pos.enPassant)
  const dest = squareName(move.to)
  const mark = move.promotion ? `=${PROMO[move.promotion]}` : ''
  if (moving.kind === 'p') return `${capture ? `${FILES[fileOf(move.from)]}x` : ''}${dest}${mark}`
  const peers = legal.filter((item) => {
    if (item.from === move.from || item.to !== move.to || item.promotion !== move.promotion) return false
    const other = pos.squares[item.from]
    return other?.kind === moving.kind && other.side === moving.side
  })
  let hint = ''
  if (peers.length) {
    const fileClash = peers.some((item) => fileOf(item.from) === fileOf(move.from))
    const rankClash = peers.some((item) => rankOf(item.from) === rankOf(move.from))
    if (!fileClash) hint = FILES[fileOf(move.from)]
    else if (!rankClash) hint = String(rankOf(move.from) + 1)
    else hint = squareName(move.from)
  }
  return `${PROMO[moving.kind]}${hint}${capture ? 'x' : ''}${dest}${mark}`
}

export function playMove(game: Game, move: Move): Game | null {
  const legal = legalMoves(game.position)
  const chosen = legal.find((item) => item.from === move.from && item.to === move.to && item.promotion === move.promotion)
  if (!chosen) return null
  const text = san(game.position, chosen, legal)
  const position = applyMove(game.position, chosen)
  const seen = [...game.seen, positionKey(position)]
  const next: Game = { position, seen, log: [...game.log, text], last: { from: chosen.from, to: chosen.to } }
  const ending = classify(next)
  if (ending.kind === 'mate') next.log[next.log.length - 1] += '#'
  else if (ending.kind === 'check') next.log[next.log.length - 1] += '+'
  return next
}

export function statusLine(game: Game, ending: Ending) {
  if (ending.kind === 'mate') return game.position.turn === 'b' ? 'Checkmate. White wins.' : 'Checkmate. Black wins.'
  if (ending.kind === 'stalemate') return 'Stalemate.'
  if (ending.kind === 'draw') return `Draw. ${ending.reason}.`
  if (ending.kind === 'check') return `${game.position.turn === 'w' ? 'White' : 'Black'} is in check.`
  return `${game.position.turn === 'w' ? 'White' : 'Black'} to move.`
}
