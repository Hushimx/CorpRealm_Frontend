import type { BuiltOffice } from './build'
import { props, roomAt, type Prop } from './layout'

export type OfficeBoard = {
  id: string
  title: string
  x: number
  z: number
  rot: number
}

const seenBoards = new Set<string>()

export const OFFICE_BOARDS: OfficeBoard[] = props.flatMap((prop) => {
  if (!isBoard(prop)) return []
  const room = roomAt(prop.x, prop.z)
  const id = seenBoards.has(room.id) ? `${room.id}-${prop.kind}` : room.id
  seenBoards.add(id)
  return [{ id, title: room.name, x: prop.x, z: prop.z, rot: prop.rot ?? 0 }]
})

function isBoard(prop: Prop): prop is Extract<Prop, { kind: 'board' | 'tasks' }> {
  return prop.kind === 'board' || prop.kind === 'tasks'
}

export function officeBoardAt(x: number, z: number) {
  return OFFICE_BOARDS.find((board) => Math.abs(board.x - x) < 0.05 && Math.abs(board.z - z) < 0.05) ?? null
}

export function builtBoardId(objectId: string) {
  return `built-${objectId}`
}

export function builtBoards(office: BuiltOffice) {
  const placed = office.objects.flatMap((object) => {
    if (object.kind !== 'board') return []
    const room = office.rooms.find((item) => Math.abs(object.x - item.x) <= item.w / 2 && Math.abs(object.z - item.z) <= item.d / 2)
    return [{ id: builtBoardId(object.id), base: room?.name.trim() || 'Board' }]
  })
  const totals = new Map<string, number>()
  for (const board of placed) totals.set(board.base, (totals.get(board.base) ?? 0) + 1)
  const seen = new Map<string, number>()
  return placed.map((board) => {
    const index = (seen.get(board.base) ?? 0) + 1
    seen.set(board.base, index)
    const shared = (totals.get(board.base) ?? 0) > 1
    return { id: board.id, title: shared ? `${board.base} ${index}` : board.base }
  })
}

export function boardInReach(x: number, z: number) {
  let best: { board: OfficeBoard; score: number } | null = null
  for (const board of OFFICE_BOARDS) {
    const faceX = Math.sin(board.rot)
    const faceZ = Math.cos(board.rot)
    const dx = x - board.x
    const dz = z - board.z
    const ahead = dx * faceX + dz * faceZ
    const aside = dx * faceZ - dz * faceX
    if (ahead < 0.25 || ahead > 2.55) continue
    if (Math.abs(aside) > 1.4) continue
    const score = ahead + Math.abs(aside) * 0.35
    if (!best || score < best.score) best = { board, score }
  }
  return best?.board ?? null
}
