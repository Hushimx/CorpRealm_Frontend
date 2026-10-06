import { doorsBlocked } from './doors'
import { FURNITURE_FOOTPRINT } from './scale'

export const PLAN_SCALE = 1.25
export const plan = (value: number) => value * PLAN_SCALE

const SOLID = 0.22
const PANE = 0.08
export const DOOR = 2.6
const ENTRY = 3.4

export const BUILDING = { x: 0, z: plan(-5), w: plan(26), d: plan(26) }

export type Box = { x: number; z: number; w: number; d: number; glass?: boolean; top?: number }

export type Room = {
  id: string
  name: string
  short: string
  x: number
  z: number
  w: number
  d: number
  floor: string
}

export type Door = { x: number; z: number; axis: 'x' | 'z'; w: number; label?: string }

export type Prop =
  | { kind: 'desk'; x: number; z: number; rot?: number }
  | { kind: 'chair'; x: number; z: number; rot?: number }
  | { kind: 'meet'; x: number; z: number; rot?: number }
  | { kind: 'plant'; x: number; z: number; rot?: number }
  | { kind: 'sofa'; x: number; z: number; rot?: number }
  | { kind: 'bean'; x: number; z: number; rot?: number }
  | { kind: 'round'; x: number; z: number; rot?: number }
  | { kind: 'side'; x: number; z: number; rot?: number }
  | { kind: 'cooler'; x: number; z: number; rot?: number }
  | { kind: 'kitchen'; x: number; z: number; rot?: number }
  | { kind: 'fridge'; x: number; z: number; rot?: number }
  | { kind: 'books'; x: number; z: number; rot?: number }
  | { kind: 'crates'; x: number; z: number; rot?: number }
  | { kind: 'server'; x: number; z: number; rot?: number }
  | { kind: 'board'; x: number; z: number; rot?: number }
  | { kind: 'tasks'; x: number; z: number; rot?: number }
  | { kind: 'screen'; x: number; z: number; rot?: number }
  | { kind: 'mat'; x: number; z: number; rot?: number }
  | { kind: 'clock'; x: number; z: number; rot?: number }
  | { kind: 'bin'; x: number; z: number; rot?: number }
  | { kind: 'chess'; x: number; z: number; rot?: number }
  | { kind: 'xo'; x: number; z: number; rot?: number }

const OPEN = '#e6eeff'
const MEET = '#e6e8ee'
const PRIVATE = '#f3f6fc'
const LOUNGE = '#8fb8ff'
const STORE = '#c4c6ce'

function cut(start: number, end: number, gaps: { at: number; w: number }[]) {
  const a = Math.min(start, end)
  const b = Math.max(start, end)
  let segments: [number, number][] = [[a, b]]
  for (const gap of gaps) {
    const g0 = gap.at - gap.w / 2
    const g1 = gap.at + gap.w / 2
    const next: [number, number][] = []
    for (const [s, e] of segments) {
      if (g1 <= s || g0 >= e) {
        next.push([s, e])
        continue
      }
      if (g0 > s + 0.04) next.push([s, g0])
      if (g1 < e - 0.04) next.push([g1, e])
    }
    segments = next
  }
  return segments.filter(([s, e]) => e - s > 0.08)
}

function alongX(
  z: number,
  x0: number,
  x1: number,
  gaps: { at: number; w: number }[],
  glass: boolean,
  thick: number,
): Box[] {
  return cut(x0, x1, gaps).map(([a, b]) => ({ x: (a + b) / 2, z, w: b - a, d: thick, glass }))
}

function alongZ(
  x: number,
  z0: number,
  z1: number,
  gaps: { at: number; w: number }[],
  glass: boolean,
  thick: number,
): Box[] {
  return cut(z0, z1, gaps).map(([a, b]) => ({ x, z: (a + b) / 2, w: thick, d: b - a, glass }))
}

const baseRooms: Room[] = [
  { id: 'hall', name: 'CorpLift Gallery', short: 'Gallery', x: 0, z: -9.5, w: 26, d: 3, floor: '#ffffff' },
  { id: 'focus', name: 'Focus Room', short: 'Focus', x: -9, z: -14.5, w: 8, d: 7, floor: '#e6e8ee' },
  { id: 'team', name: 'Collaboration Room', short: 'Team', x: -0.5, z: -14.5, w: 9, d: 7, floor: '#e6eeff' },
  { id: 'studio', name: 'Creative Studio', short: 'Studio', x: 8.5, z: -14.5, w: 9, d: 7, floor: '#f3f6fc' },
  { id: 'open', name: 'Open Workspace', short: 'Open', x: -6.3, z: 0, w: 13.4, d: 16, floor: OPEN },
  { id: 'meet', name: 'Meeting Room', short: 'Meet', x: 3.55, z: -4, w: 6.3, d: 8, floor: MEET },
  { id: 'private', name: 'Private Office', short: 'Office', x: 9.85, z: -4, w: 6.3, d: 8, floor: PRIVATE },
  { id: 'lounge', name: 'Lounge', short: 'Lounge', x: 3.55, z: 4, w: 6.3, d: 8, floor: LOUNGE },
  { id: 'storage', name: 'Storage', short: 'Servers', x: 9.85, z: 4, w: 6.3, d: 8, floor: STORE },
]

const baseDoors: Door[] = [
  { x: -1.8, z: -8, axis: 'x', w: 3.2, label: 'GALLERY' },
  ...[-9, -0.5, 8.5].map((x, i) => ({ x, z: -11, axis: 'x' as const, w: 3, label: ['FOCUS', 'COLLABORATION', 'CREATIVE STUDIO'][i] })),
  { x: -4.2, z: 8, axis: 'x', w: ENTRY, label: 'CORPLIFT HQ' },
  { x: 0.4, z: -4, axis: 'z', w: DOOR, label: 'MEETING ROOM' },
  { x: 6.7, z: -4, axis: 'z', w: DOOR, label: 'PRIVATE OFFICE' },
  { x: 6.7, z: 4, axis: 'z', w: DOOR, label: 'SERVER ROOM' },
]

const baseWalls: Box[] = [
  ...alongX(-18, -13, 13, [], false, SOLID),
  ...alongZ(-13, -18, -8, [], false, SOLID),
  ...alongZ(13, -18, -8, [], false, SOLID),
  ...alongZ(-5, -18, -11, [], false, SOLID),
  ...alongZ(4, -18, -11, [], false, SOLID),
  ...alongX(-11, -13, -5, [{ at: -9, w: 3 }], true, PANE),
  ...alongX(-11, -5, 4, [{ at: -0.5, w: 3 }], true, PANE),
  ...alongX(-11, 4, 13, [{ at: 8.5, w: 3 }], true, PANE),
  ...alongX(-8, -13, 13, [{ at: -1.8, w: 3.2 }], false, SOLID),
  ...alongX(8, -13, 13, [{ at: -4.2, w: ENTRY }], false, SOLID),
  ...alongZ(-13, -8, 8, [], false, SOLID),
  ...alongZ(13, -8, 8, [], false, SOLID),
  ...alongZ(0.4, -8, 0, [{ at: -4, w: DOOR }], true, PANE),
  ...alongZ(6.7, -8, 0, [{ at: -4, w: DOOR }], true, PANE),
  ...alongX(0, 0.4, 6.7, [], true, PANE),
  ...alongX(0, 6.7, 13, [], true, PANE),
  ...alongZ(6.7, 0, 8, [{ at: 4, w: DOOR }], true, PANE),
]

const deskX = [-10.2, -6.6, -3]
const chairs = deskX.flatMap((x) => [
  { kind: 'chair' as const, x, z: 3.7, rot: Math.PI },
  { kind: 'chair' as const, x, z: -0.2, rot: Math.PI },
])

const baseProps: Prop[] = [
  // The rear gallery stays clear; rooms are furnished around central routes.
  { kind: 'desk', x: -10.8, z: -15.5 },
  { kind: 'desk', x: -7.2, z: -15.5 },
  { kind: 'chair', x: -10.8, z: -14.1, rot: Math.PI },
  { kind: 'chair', x: -7.2, z: -14.1, rot: Math.PI },
  { kind: 'books', x: -12.25, z: -17.3 },
  { kind: 'plant', x: -5.8, z: -17.1 },
  { kind: 'board', x: -9, z: -17.88 },
  { kind: 'meet', x: -0.5, z: -14.5 },
  ...[-1.9, -0.5, 0.9].flatMap(x => [
    { kind: 'chair' as const, x, z: -12.7, rot: Math.PI },
    { kind: 'chair' as const, x, z: -16.3, rot: 0 },
  ]),
  { kind: 'screen', x: -0.5, z: -17.85 },
  { kind: 'plant', x: -4.2, z: -17.2 },
  { kind: 'books', x: 3.25, z: -17.3 },
  { kind: 'sofa', x: 6.1, z: -16.4 },
  { kind: 'round', x: 6.1, z: -14.9 },
  { kind: 'bean', x: 7.8, z: -15 },
  { kind: 'desk', x: 10.6, z: -15.5 },
  { kind: 'chair', x: 10.6, z: -14.1, rot: Math.PI },
  { kind: 'tasks', x: 6.2, z: -17.88 },
  { kind: 'books', x: 12.3, z: -17.3 },
  { kind: 'plant', x: 4.8, z: -12 },
  ...deskX.flatMap((x) => [
    { kind: 'desk' as const, x, z: 2.35 },
    { kind: 'desk' as const, x, z: -1.55 },
  ]),
  ...chairs,
  { kind: 'sofa', x: -8.8, z: -6.8 },
  { kind: 'round', x: -8.5, z: -5.45 },
  { kind: 'bean', x: -6.9, z: -5.6 },
  { kind: 'cooler', x: -11.3, z: -6.9 },
  { kind: 'books', x: -4.2, z: -7.6 },
  { kind: 'plant', x: -6.5, z: -7.2 },
  { kind: 'board', x: -10.5, z: -7.88, rot: 0 },
  { kind: 'plant', x: -12.15, z: 7.15 },
  { kind: 'plant', x: -12.15, z: -7.15 },
  { kind: 'plant', x: -1.15, z: 7.15 },
  { kind: 'plant', x: -7.4, z: 7.2 },
  { kind: 'chess', x: -8.8, z: 4.8 },
  { kind: 'xo', x: -2.2, z: 5.4 },
  { kind: 'mat', x: -4.2, z: 6.55 },

  { kind: 'meet', x: 3.55, z: -4 },
  { kind: 'chair', x: 2.15, z: -2.15, rot: Math.PI },
  { kind: 'chair', x: 3.55, z: -2.15, rot: Math.PI },
  { kind: 'chair', x: 4.75, z: -2.15, rot: Math.PI },
  { kind: 'chair', x: 2.15, z: -5.85, rot: 0 },
  { kind: 'chair', x: 3.55, z: -5.85, rot: 0 },
  { kind: 'chair', x: 4.75, z: -5.85, rot: 0 },
  { kind: 'screen', x: 3.55, z: -7.78, rot: 0 },
  { kind: 'tasks', x: 6.62, z: -6.4, rot: -Math.PI / 2 },
  { kind: 'books', x: 5.7, z: -7.65, rot: 0 },
  { kind: 'plant', x: 1.15, z: -7.15 },

  { kind: 'desk', x: 10.1, z: -5.1 },
  { kind: 'chair', x: 10.1, z: -3.75, rot: Math.PI },
  { kind: 'books', x: 12.35, z: -7.15, rot: 0 },
  { kind: 'plant', x: 12.2, z: -2.4 },
  { kind: 'plant', x: 7.5, z: -7.15 },

  { kind: 'sofa', x: 2.1, z: 5.6, rot: Math.PI },
  { kind: 'bean', x: 4.35, z: 3.15 },
  { kind: 'round', x: 3.45, z: 4.15 },
  { kind: 'side', x: 4.85, z: 5.15, rot: -Math.PI / 2 },
  { kind: 'cooler', x: 1.15, z: 6.85 },
  { kind: 'kitchen', x: 3.3, z: 7.45, rot: Math.PI },
  { kind: 'fridge', x: 5.15, z: 7.4, rot: Math.PI },
  { kind: 'clock', x: 1.3, z: 7.88, rot: Math.PI },
  { kind: 'bin', x: 5.7, z: 6.55 },
  { kind: 'plant', x: 1.2, z: 2.3 },

  { kind: 'server', x: 10.6, z: 2.15 },
  { kind: 'server', x: 12, z: 2.15 },
  { kind: 'crates', x: 11.3, z: 6.35, rot: Math.PI / 2 },
  { kind: 'plant', x: 7.55, z: 7.15 },
  { kind: 'plant', x: 12.2, z: 7.15 },
]

export const rooms: Room[] = baseRooms.map(room => ({ ...room, x: plan(room.x), z: plan(room.z), w: plan(room.w), d: plan(room.d) }))
export const doors: Door[] = baseDoors.map(door => ({ ...door, x: plan(door.x), z: plan(door.z), w: plan(door.w) }))
export const walls: Box[] = baseWalls.map(wall => ({ ...wall, x: plan(wall.x), z: plan(wall.z), w: wall.w > wall.d ? plan(wall.w) : wall.w, d: wall.d > wall.w ? plan(wall.d) : wall.d }))
export const props: Prop[] = baseProps.map(prop => ({ ...prop, x: plan(prop.x), z: plan(prop.z) }))

// One post per partition junction; doorway jambs own their endpoints.
export const glassPosts = [...new Map(walls.filter(wall => wall.glass).flatMap(wall => {
  const horizontal = wall.w > wall.d
  const length = horizontal ? wall.w : wall.d
  const count = Math.ceil(length / 1.8)
  return Array.from({ length: count + 1 }, (_, i) => {
    const offset = -length / 2 + i * length / count
    return { x: wall.x + (horizontal ? offset : 0), z: wall.z + (horizontal ? 0 : offset) }
  })
}).filter(post => !doors.some(door => {
  const across = door.axis === 'x' ? post.x - door.x : post.z - door.z
  const depth = door.axis === 'x' ? post.z - door.z : post.x - door.x
  return Math.abs(depth) < 0.001 && Math.abs(Math.abs(across) - door.w / 2) < 0.001
})).map(post => [`${post.x.toFixed(4)},${post.z.toFixed(4)}`, post])).values()]

function oriented(width: number, depth: number, rot = 0) {
  return Math.abs(Math.sin(rot)) > 0.5 ? { w: depth, d: width } : { w: width, d: depth }
}

const CLEARANCE: Partial<Record<Prop['kind'], number>> = {
  desk: 1.28,
  chair: 1.05,
  side: 1.05,
  meet: 1.28,
  sofa: 0.95,
  bean: 0.75,
  plant: 1.25,
  round: 0.8,
  chess: 1.2,
  xo: 1.15,
  cooler: 1.12,
  kitchen: 1.16,
  fridge: 1.72,
  books: 2.15,
  crates: 2.05,
  server: 1.82,
  bin: 0.5,
}

export function solidFor(prop: Prop): Box | null {
  const top = CLEARANCE[prop.kind]
  switch (prop.kind) {
    case 'desk':
      return { x: prop.x, z: prop.z, top, ...oriented(FURNITURE_FOOTPRINT.desk.w, FURNITURE_FOOTPRINT.desk.d, prop.rot ?? 0) }
    case 'chair':
    case 'side':
      return { x: prop.x, z: prop.z, top, ...oriented(FURNITURE_FOOTPRINT.chair.w, FURNITURE_FOOTPRINT.chair.d, prop.rot ?? 0) }
    case 'meet':
      return { x: prop.x, z: prop.z, top, ...oriented(FURNITURE_FOOTPRINT.meet.w, FURNITURE_FOOTPRINT.meet.d, prop.rot ?? 0) }
    case 'sofa':
      return { x: prop.x, z: prop.z, top, ...oriented(2.05, 0.85, prop.rot ?? 0) }
    case 'bean':
      return { x: prop.x, z: prop.z, top, w: 1.04, d: 1.04 }
    case 'plant':
      return { x: prop.x, z: prop.z, top, w: 0.54, d: 0.54 }
    case 'round':
      return { x: prop.x, z: prop.z, top, ...FURNITURE_FOOTPRINT.round }
    case 'chess':
      return { x: prop.x, z: prop.z, top, ...FURNITURE_FOOTPRINT.chess }
    case 'xo':
      return { x: prop.x, z: prop.z, top, ...FURNITURE_FOOTPRINT.xo }
    case 'cooler':
      return { x: prop.x, z: prop.z, top, w: 0.42, d: 0.42 }
    case 'kitchen':
      return { x: prop.x, z: prop.z, top, ...oriented(2.4, 0.55, prop.rot ?? 0) }
    case 'fridge':
      return { x: prop.x, z: prop.z, top, ...oriented(0.62, 0.55, prop.rot ?? 0) }
    case 'books':
      return { x: prop.x, z: prop.z, top, ...oriented(1.15, 0.38, prop.rot ?? 0) }
    case 'crates':
      return { x: prop.x, z: prop.z, top, ...oriented(1.45, 0.42, prop.rot ?? 0) }
    case 'server':
      return { x: prop.x, z: prop.z, top, ...oriented(0.62, 0.48, prop.rot ?? 0) }
    case 'bin':
      return { x: prop.x, z: prop.z, top, w: 0.36, d: 0.36 }
    default:
      return null
  }
}

export const solids: Box[] = [
  ...walls,
  ...props.flatMap((prop) => {
    const box = solidFor(prop)
    return box ? [box] : []
  }),
]

export const BODY = 0.74

export function blocked(x: number, z: number, feet = 0) {
  return hits(solids, x, z, BODY, feet) || doorsBlocked(doors, x, z, BODY)
}

export function meetingTableNear(x: number, z: number) {
  return props.some((prop) => prop.kind === 'meet' && Math.hypot(prop.x - x, prop.z - z) <= 3.4)
}

export function landPast(x: number, z: number, peak: number, vx: number, vz: number) {
  let nextX = x
  let nextZ = z
  const moving = Math.hypot(vx, vz) > 0.35
  for (let pass = 0; pass < 6; pass += 1) {
    const box = solids.find(
      (item) =>
        item.top !== undefined &&
        peak > item.top &&
        Math.abs(nextX - item.x) <= item.w / 2 + BODY &&
        Math.abs(nextZ - item.z) <= item.d / 2 + BODY,
    )
    if (!box) break
    const left = nextX - (box.x - box.w / 2 - BODY)
    const right = box.x + box.w / 2 + BODY - nextX
    const down = nextZ - (box.z - box.d / 2 - BODY)
    const up = box.z + box.d / 2 + BODY - nextZ
    let side: 'left' | 'right' | 'down' | 'up'
    if (moving && Math.abs(vx) > Math.abs(vz)) side = vx >= 0 ? 'right' : 'left'
    else if (moving) side = vz >= 0 ? 'up' : 'down'
    else {
      const nearest = Math.min(left, right, down, up)
      side = nearest === left ? 'left' : nearest === right ? 'right' : nearest === down ? 'down' : 'up'
    }
    if (side === 'left') nextX = box.x - box.w / 2 - BODY - 0.05
    else if (side === 'right') nextX = box.x + box.w / 2 + BODY + 0.05
    else if (side === 'down') nextZ = box.z - box.d / 2 - BODY - 0.05
    else nextZ = box.z + box.d / 2 + BODY + 0.05
  }
  if (blocked(nextX, nextZ) || wallBlocked(nextX, nextZ, BODY)) return null
  return { x: nextX, z: nextZ }
}

export function wallBlocked(x: number, z: number, radius = 0.22) {
  return hits(walls, x, z, radius) || doorsBlocked(doors, x, z, radius)
}

function hits(boxes: Box[], x: number, z: number, radius: number, feet = 0) {
  for (const box of boxes) {
    if (box.top !== undefined && feet > box.top) continue
    if (Math.abs(x - box.x) <= box.w / 2 + radius && Math.abs(z - box.z) <= box.d / 2 + radius) return true
  }
  return false
}

export function roomAt(x: number, z: number) {
  const specific = rooms.find(
    (room) => room.id !== 'open' && Math.abs(x - room.x) <= room.w / 2 && Math.abs(z - room.z) <= room.d / 2,
  )
  if (specific) return specific
  return rooms.find((room) => Math.abs(x - room.x) <= room.w / 2 && Math.abs(z - room.z) <= room.d / 2) ?? rooms.find(room => room.id === 'open')!
}
