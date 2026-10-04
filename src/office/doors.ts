import { create } from 'zustand'
import type { Box, Door } from './layout'

// Sliding leaves sit inside a deep reveal attached to the existing wall.
// Keep visual geometry and collision bounds on the same track plane.
export const DOOR_GEOMETRY = {
  trackZ: 0.24,
  frameZ: 0.12,
  frameDepth: 0.5,
  jambWidth: 0.1,
  sideGap: 0.015,
  centerGap: 0.016,
  bottom: 0.03,
  top: 3.1,
  openingHeight: 3.12,
  leafDepth: 0.09,
  border: 0.06,
} as const
export const doorId = (door: Door) => `${door.axis}:${door.x}:${door.z}`
export const useDoors = create<{ open: Record<string, boolean>; moving: Record<string, boolean>; obstructed: Record<string, boolean> }>(() => ({ open: {}, moving: {}, obstructed: {} }))
const progress = new Map<string, number>()
const velocities = new Map<string, number>()
let occupants: { x: number; z: number }[] = []
export function setDoorOccupants(people: { x: number; z: number }[]) { occupants = people }
export function doorProgress(door: Door) { return progress.get(doorId(door)) ?? 0 }
function local(door: Door, x: number, z: number) {
  return door.axis === 'x' ? { along: x-door.x, depth: z-door.z-DOOR_GEOMETRY.trackZ } : { along: door.z-z, depth: x-door.x-DOOR_GEOMETRY.trackZ }
}
export function doorwayOccupied(door: Door) {
  return occupants.some(person => {
    const point = local(door, person.x, person.z)
    return Math.abs(point.along) < door.w/2 + 0.8 && Math.abs(point.depth) < 0.95
  })
}
export function toggleDoor(door: Door) {
  const id = doorId(door)
  const open = Boolean(useDoors.getState().open[id])
  if (open && doorwayOccupied(door)) return false
  useDoors.setState(state => ({ open: { ...state.open, [id]: !open } }))
  return true
}
export function advanceDoor(door: Door, delta: number) {
  const id = doorId(door)
  let open = Boolean(useDoors.getState().open[id])
  const current = doorProgress(door)
  // Reopen during closing if someone steps into the moving panel's path.
  if (!open && current > 0 && doorwayOccupied(door)) {
    open = true
    useDoors.setState(state => ({ open: { ...state.open, [id]: true } }))
  }
  const occupied = doorwayOccupied(door)
  const target = open ? 1 : 0
  const dt = Math.min(Math.max(delta, 0), 0.05)
  const omega = 9
  const offset = current - target
  const velocity = open && occupied ? Math.max(0, velocities.get(id) ?? 0) : velocities.get(id) ?? 0
  const spring = velocity + omega * offset
  const decay = Math.exp(-omega * dt)
  let next = Math.max(0, Math.min(1, target + (offset + spring * dt) * decay))
  let nextVelocity = (velocity - omega * spring * dt) * decay
  if (Math.abs(next-target) < 0.001 && Math.abs(nextVelocity) < 0.01) { next = target; nextVelocity = 0 }
  progress.set(id, next)
  velocities.set(id, nextVelocity)
  const moving = next !== target
  const state = useDoors.getState()
  if (Boolean(state.moving[id]) !== moving || Boolean(state.obstructed[id]) !== occupied) {
    useDoors.setState({ moving: { ...state.moving, [id]: moving }, obstructed: { ...state.obstructed, [id]: occupied } })
  }
  return next
}
export const leafWidth = (door: Door) => (door.w - DOOR_GEOMETRY.jambWidth - 2*DOOR_GEOMETRY.sideGap - DOOR_GEOMETRY.centerGap) / 2
export const leafOffset = (door: Door, sign: number, amount = doorProgress(door)) => sign * (leafWidth(door)/2 + DOOR_GEOMETRY.centerGap/2 + amount*(door.w/2 + 0.12))
export function doorBoxes(door: Door): Box[] {
  return [-1,1].map(sign => {
    const offset = leafOffset(door, sign)
    return door.axis === 'x'
      ? { x: door.x+offset, z: door.z+DOOR_GEOMETRY.trackZ, w: leafWidth(door), d: DOOR_GEOMETRY.leafDepth }
      : { x: door.x+DOOR_GEOMETRY.trackZ, z: door.z-offset, w: DOOR_GEOMETRY.leafDepth, d: leafWidth(door) }
  })
}
export function doorsBlocked(doors: Door[], x: number, z: number, radius: number) {
  return doors.some(door => doorBoxes(door).some(box => Math.abs(x-box.x) <= box.w/2+radius && Math.abs(z-box.z) <= box.d/2+radius))
}
export function doorInReach(doors: Door[], x: number, z: number) {
  return doors.map(door => ({ door, point: local(door,x,z) }))
    .filter(({door,point}) => Math.abs(point.depth) < 2.3 && Math.abs(point.along) < door.w/2+0.35)
    .sort((a,b) => Math.hypot(a.point.along,a.point.depth)-Math.hypot(b.point.along,b.point.depth))[0]?.door ?? null
}
