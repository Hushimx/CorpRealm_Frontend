import { BODY, solidFor, type Box, type Door, type Prop } from './layout'

export const LIMITS = { rooms: 16, objects: 60 }
const THICK = 0.22
const HEX = /^#[0-9a-fA-F]{6}$/

export const OBJECT_KINDS = [
  ['desk', 'Desk'],
  ['chair', 'Chair'],
  ['meet', 'Meet table'],
  ['sofa', 'Sofa'],
  ['bean', 'Beanbag'],
  ['round', 'Round table'],
  ['chess', 'Chess table'],
  ['xo', 'XO table'],
  ['plant', 'Plant'],
  ['books', 'Shelf'],
  ['board', 'Board'],
  ['screen', 'Screen'],
  ['server', 'Server'],
  ['kitchen', 'Counter'],
  ['fridge', 'Fridge'],
  ['cooler', 'Cooler'],
  ['clock', 'Clock'],
  ['bin', 'Bin'],
  ['mat', 'Rug'],
] as const

export type ObjectKind = (typeof OBJECT_KINDS)[number][0]

const KIND_SET = new Set<string>(OBJECT_KINDS.map((item) => item[0]))

export type BuiltRoom = {
  id: string
  name: string
  x: number
  z: number
  w: number
  d: number
  floor: string
  walls: boolean
}

export type BuiltObject = {
  id: string
  kind: ObjectKind
  x: number
  z: number
  rot: number
  color: string
}

export type BuiltOffice = {
  id: string
  name: string
  width: number
  depth: number
  floor: string
  wall: string
  trim: string
  ceiling: string
  rooms: BuiltRoom[]
  objects: BuiltObject[]
}

export type Selection = { type: 'room' | 'object'; id: string }

export type BuildTool = 'select' | 'room' | 'paint' | ObjectKind

export function isObjectTool(tool: BuildTool): tool is ObjectKind {
  return tool !== 'select' && tool !== 'room' && tool !== 'paint'
}

export function roomRect(a: { x: number; z: number }, b: { x: number; z: number }) {
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(a.x, b.x)
  const z0 = Math.min(a.z, b.z)
  const z1 = Math.max(a.z, b.z)
  const w = Math.max(0.5, snap(x1 - x0))
  const d = Math.max(0.5, snap(z1 - z0))
  return { x: x0 + w / 2, z: z0 + d / 2, w, d }
}

export function objectLabel(kind: ObjectKind) {
  return OBJECT_KINDS.find((item) => item[0] === kind)?.[1] ?? kind
}

export function snap(value: number) {
  return Math.round(value * 2) / 2
}

function snapQuarter(value: number) {
  return Math.round(value * 4) / 4
}

export function paint(value: string, fallback: string) {
  return HEX.test(value) ? value.toLowerCase() : fallback
}

export function labelInk(color: string) {
  const hex = paint(color, '#f3f6fc').slice(1)
  const value = Number.parseInt(hex, 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  const luma = (red * 299 + green * 587 + blue * 114) / 1000
  return luma > 150 ? '#000000' : '#ffffff'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function cleanRot(value: unknown) {
  const rot = Number(value)
  if (!Number.isFinite(rot)) return 0
  const wrapped = rot % (Math.PI * 2)
  return wrapped < 0 ? wrapped + Math.PI * 2 : wrapped
}

export function clampRoom(office: Pick<BuiltOffice, 'width' | 'depth'>, room: BuiltRoom): BuiltRoom {
  const w = clamp(snap(room.w), 3, office.width)
  const d = clamp(snap(room.d), 3, office.depth)
  const halfW = office.width / 2
  const halfD = office.depth / 2
  return {
    ...room,
    name: room.name.slice(0, 24),
    floor: paint(room.floor, '#e6eeff'),
    walls: Boolean(room.walls),
    w,
    d,
    x: clamp(snapQuarter(room.x), -halfW + w / 2, halfW - w / 2),
    z: clamp(snapQuarter(room.z), -halfD + d / 2, halfD - d / 2),
  }
}

export function clampObject(office: Pick<BuiltOffice, 'width' | 'depth'>, object: BuiltObject): BuiltObject {
  const inset = 0.8
  return {
    ...object,
    x: clamp(snap(object.x), -office.width / 2 + inset, office.width / 2 - inset),
    z: clamp(snap(object.z), -office.depth / 2 + inset, office.depth / 2 - inset),
    rot: cleanRot(object.rot),
    color: object.color ? paint(object.color, '') : '',
  }
}

export function roomsOverlap(rooms: BuiltRoom[], room: BuiltRoom, ignoreId?: string) {
  return rooms.some((other) => {
    if (other.id === ignoreId || other.id === room.id) return false
    const penetrationX = (other.w + room.w) / 2 - Math.abs(other.x - room.x)
    const penetrationZ = (other.d + room.d) / 2 - Math.abs(other.z - room.z)
    return penetrationX > 0.04 && penetrationZ > 0.04
  })
}

export function fitOffice(office: BuiltOffice): BuiltOffice {
  const rooms: BuiltRoom[] = []
  for (const room of office.rooms) {
    const next = clampRoom(office, room)
    if (roomsOverlap(rooms, next)) continue
    rooms.push(next)
  }
  return {
    ...office,
    rooms,
    objects: office.objects.map((object) => clampObject(office, object)),
  }
}

export function createOffice(name = 'New office'): BuiltOffice {
  const office: BuiltOffice = {
    id: crypto.randomUUID(),
    name,
    width: 18,
    depth: 14,
    floor: '#f3f6fc',
    wall: '#e6eeff',
    trim: '#8fb8ff',
    ceiling: '#ffffff',
    rooms: [],
    objects: [],
  }
  office.rooms = [
    clampRoom(office, {
      id: crypto.randomUUID(),
      name: 'Workspace',
      x: -3.5,
      z: -1,
      w: 8,
      d: 8,
      floor: '#e6eeff',
      walls: true,
    }),
    clampRoom(office, {
      id: crypto.randomUUID(),
      name: 'Meeting',
      x: 4.5,
      z: -1,
      w: 6,
      d: 8,
      floor: '#e6e8ee',
      walls: true,
    }),
  ]
  const objects: BuiltObject[] = [
    { id: crypto.randomUUID(), kind: 'desk', x: -5, z: -2, rot: 0, color: '' },
    { id: crypto.randomUUID(), kind: 'chair', x: -5, z: 0.2, rot: Math.PI, color: '' },
    { id: crypto.randomUUID(), kind: 'plant', x: -6.5, z: -4, rot: 0, color: '' },
    { id: crypto.randomUUID(), kind: 'meet', x: 4.5, z: -1.5, rot: 0, color: '' },
    { id: crypto.randomUUID(), kind: 'screen', x: 4.5, z: -4.5, rot: 0, color: '' },
    { id: crypto.randomUUID(), kind: 'chess', x: -2, z: 1.5, rot: 0, color: '' },
    { id: crypto.randomUUID(), kind: 'xo', x: 2, z: 2, rot: 0, color: '' },
  ]
  office.objects = objects.map((object) => clampObject(office, object))
  return office
}

function normalizeRoom(value: unknown): BuiltRoom | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<BuiltRoom>
  if (typeof raw.id !== 'string') return null
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : 'Room',
    x: Number(raw.x) || 0,
    z: Number(raw.z) || 0,
    w: Number(raw.w) || 6,
    d: Number(raw.d) || 6,
    floor: typeof raw.floor === 'string' ? raw.floor : '#e6eeff',
    walls: raw.walls !== false,
  }
}

function normalizeObject(value: unknown): BuiltObject | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<BuiltObject>
  if (typeof raw.id !== 'string' || typeof raw.kind !== 'string' || !KIND_SET.has(raw.kind)) return null
  return {
    id: raw.id,
    kind: raw.kind as ObjectKind,
    x: Number(raw.x) || 0,
    z: Number(raw.z) || 0,
    rot: cleanRot(raw.rot),
    color: typeof raw.color === 'string' ? raw.color : '',
  }
}

export function normalizeOffice(value: unknown): BuiltOffice | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<BuiltOffice>
  if (typeof raw.id !== 'string') return null
  const draft: BuiltOffice = {
    id: raw.id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 32) : 'Office',
    width: clamp(Math.round(Number(raw.width) || 18), 10, 36),
    depth: clamp(Math.round(Number(raw.depth) || 14), 8, 28),
    floor: paint(String(raw.floor ?? ''), '#f3f6fc'),
    wall: paint(String(raw.wall ?? ''), '#e6eeff'),
    trim: paint(String(raw.trim ?? ''), '#8fb8ff'),
    ceiling: paint(String(raw.ceiling ?? ''), '#ffffff'),
    rooms: [],
    objects: [],
  }
  if (Array.isArray(raw.rooms)) {
    for (const room of raw.rooms.slice(0, LIMITS.rooms)) {
      const next = normalizeRoom(room)
      if (!next) continue
      const fitted = clampRoom(draft, next)
      if (roomsOverlap(draft.rooms, fitted)) continue
      draft.rooms.push(fitted)
    }
  }
  if (Array.isArray(raw.objects)) {
    for (const object of raw.objects.slice(0, LIMITS.objects)) {
      const next = normalizeObject(object)
      if (next) draft.objects.push(clampObject(draft, next))
    }
  }
  return draft
}

export function toProp(object: BuiltObject): Prop {
  return { kind: object.kind, x: object.x, z: object.z, rot: object.rot }
}

type Edge = {
  axis: 'x' | 'z'
  x: number
  z: number
  x0: number
  x1: number
  z0: number
  z1: number
}

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

function roomEdges(room: BuiltRoom): Edge[] {
  const x0 = room.x - room.w / 2
  const x1 = room.x + room.w / 2
  const z0 = room.z - room.d / 2
  const z1 = room.z + room.d / 2
  return [
    { axis: 'x', x: room.x, z: z0, x0, x1, z0, z1 },
    { axis: 'x', x: room.x, z: z1, x0, x1, z0, z1 },
    { axis: 'z', x: x0, z: room.z, x0, x1, z0, z1 },
    { axis: 'z', x: x1, z: room.z, x0, x1, z0, z1 },
  ]
}

function edgeKey(edge: Edge) {
  if (edge.axis === 'x') {
    const a = Math.min(edge.x0, edge.x1)
    const b = Math.max(edge.x0, edge.x1)
    return `x:${edge.z.toFixed(2)}:${a.toFixed(2)}:${b.toFixed(2)}`
  }
  const a = Math.min(edge.z0, edge.z1)
  const b = Math.max(edge.z0, edge.z1)
  return `z:${edge.x.toFixed(2)}:${a.toFixed(2)}:${b.toFixed(2)}`
}

function onShell(edge: Edge, halfW: number, halfD: number) {
  if (edge.axis === 'x') return Math.abs(Math.abs(edge.z) - halfD) < 0.12
  return Math.abs(Math.abs(edge.x) - halfW) < 0.12
}

function midpoint(edge: Edge) {
  if (edge.axis === 'x') {
    return { x: (Math.min(edge.x0, edge.x1) + Math.max(edge.x0, edge.x1)) / 2, z: edge.z }
  }
  return { x: edge.x, z: (Math.min(edge.z0, edge.z1) + Math.max(edge.z0, edge.z1)) / 2 }
}

function gapFor(length: number, at: number) {
  if (length < 2.2) return []
  const w = Math.min(3.2, Math.max(1.9, length - 0.45))
  if (w >= length - 0.2) return []
  return [{ at, w }]
}

export function compileOffice(office: BuiltOffice) {
  const halfW = office.width / 2
  const halfD = office.depth / 2
  const walls: Box[] = []
  const doors: Door[] = []

  const pushX = (z: number, x0: number, x1: number, gaps: { at: number; w: number }[], record: boolean) => {
    for (const [a, b] of cut(x0, x1, gaps)) walls.push({ x: (a + b) / 2, z, w: b - a, d: THICK })
    if (record) for (const gap of gaps) doors.push({ x: gap.at, z, axis: 'x', w: gap.w })
  }
  const pushZ = (x: number, z0: number, z1: number, gaps: { at: number; w: number }[], record: boolean) => {
    for (const [a, b] of cut(z0, z1, gaps)) walls.push({ x, z: (a + b) / 2, w: THICK, d: b - a })
    if (record) for (const gap of gaps) doors.push({ x, z: gap.at, axis: 'z', w: gap.w })
  }

  pushX(halfD, -halfW, halfW, [{ at: 0, w: 3.2 }], true)
  pushX(-halfD, -halfW, halfW, [], false)
  pushZ(-halfW, -halfD, halfD, [], false)
  pushZ(halfW, -halfD, halfD, [], false)

  const unique = new Map<string, Edge>()
  const doorKeys = new Set<string>()
  for (const room of office.rooms) {
    if (!room.walls) continue
    const internal = roomEdges(room).filter((edge) => !onShell(edge, halfW, halfD))
    for (const edge of internal) unique.set(edgeKey(edge), edge)
    if (!internal.length) continue
    internal.sort((a, b) => {
      const pa = midpoint(a)
      const pb = midpoint(b)
      const da = pa.x ** 2 + (pa.z - halfD) ** 2
      const db = pb.x ** 2 + (pb.z - halfD) ** 2
      return da - db
    })
    doorKeys.add(edgeKey(internal[0]))
  }

  for (const [key, edge] of unique) {
    const point = midpoint(edge)
    const length = edge.axis === 'x' ? Math.abs(edge.x1 - edge.x0) : Math.abs(edge.z1 - edge.z0)
    const gaps = doorKeys.has(key) ? gapFor(length, edge.axis === 'x' ? point.x : point.z) : []
    if (edge.axis === 'x') pushX(edge.z, edge.x0, edge.x1, gaps, true)
    else pushZ(edge.x, edge.z0, edge.z1, gaps, true)
  }

  return { walls, doors }
}

function hits(boxes: Box[], x: number, z: number, radius: number, feet = 0) {
  for (const box of boxes) {
    if (box.top !== undefined && feet > box.top) continue
    if (Math.abs(x - box.x) <= box.w / 2 + radius && Math.abs(z - box.z) <= box.d / 2 + radius) return true
  }
  return false
}

export function roomLabel(office: BuiltOffice, x: number, z: number) {
  const room = office.rooms.find((item) => Math.abs(x - item.x) <= item.w / 2 && Math.abs(z - item.z) <= item.d / 2)
  if (room) return { id: room.id, name: room.name.trim() || 'Room' }
  if (Math.abs(x) <= office.width / 2 && Math.abs(z) <= office.depth / 2) {
    return { id: 'floor', name: 'Open floor' }
  }
  return { id: 'out', name: 'Outside' }
}

export function collisionFor(office: BuiltOffice) {
  const compiled = compileOffice(office)
  const solids = [...compiled.walls]
  for (const object of office.objects) {
    const box = solidFor(toProp(object))
    if (box) solids.push(box)
  }
  const halfW = office.width / 2
  const halfD = office.depth / 2
  let spawn = { x: 0, z: halfD - 1.6 }
  for (let z = halfD - 1.4; z >= -halfD + 1; z -= 0.5) {
    let found = false
    for (let x = 0; x <= halfW - 1; x += 0.5) {
      for (const sx of x === 0 ? [0] : [x, -x]) {
        if (!hits(solids, sx, z, BODY)) {
          spawn = { x: sx, z }
          found = true
          break
        }
      }
      if (found) break
    }
    if (found) break
  }
  return {
    ...compiled,
    spawn,
    blocked(x: number, z: number, feet = 0) {
      return hits(solids, x, z, BODY, feet)
    },
    wallBlocked(x: number, z: number, radius = 0.22) {
      return hits(compiled.walls, x, z, radius)
    },
    roomAt(x: number, z: number) {
      return roomLabel(office, x, z)
    },
  }
}

export function hitTest(office: BuiltOffice, x: number, z: number): Selection | null {
  for (let index = office.objects.length - 1; index >= 0; index -= 1) {
    const object = office.objects[index]
    if (Math.hypot(object.x - x, object.z - z) <= 0.9) return { type: 'object', id: object.id }
  }
  for (let index = office.rooms.length - 1; index >= 0; index -= 1) {
    const room = office.rooms[index]
    if (Math.abs(room.x - x) <= room.w / 2 && Math.abs(room.z - z) <= room.d / 2) return { type: 'room', id: room.id }
  }
  return null
}
