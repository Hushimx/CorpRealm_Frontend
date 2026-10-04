import { props } from './layout'
import { FURNITURE_SCALE, OFFICE_AVATAR_SCALE } from './scale'

export type Seat = {
  id: string
  x: number
  z: number
  rot: number
}

// Cushion top from the chair seat block. The sit clip swings the legs forward
// and leaves the hips at the model's unit height, so the body drops by the difference.
const SEAT_TOP = (0.51 + 0.13 / 2) * FURNITURE_SCALE.chair[1]
const SIT_HEIGHT = SEAT_TOP - OFFICE_AVATAR_SCALE - 0.04
const SIT_BACK = 0.06
const REACH = 2

export const OFFICE_SEATS: Seat[] = props.flatMap((prop, index) => {
  if (prop.kind !== 'chair') return []
  return [{ id: `office-chair-${index}`, x: prop.x, z: prop.z, rot: prop.rot ?? 0 }]
})

export function chairSeats(items: { id: string; kind: string; x: number; z: number; rot?: number }[]): Seat[] {
  const seats: Seat[] = []
  for (const item of items) {
    if (item.kind !== 'chair') continue
    seats.push({ id: item.id, x: item.x, z: item.z, rot: item.rot ?? 0 })
  }
  return seats
}

export type SeatStep = {
  occupied: Seat | null
  sitting: boolean
  near: boolean
  x: number
  z: number
  y: number
  facing: number | null
}

export function resolveSeat(input: {
  x: number
  z: number
  occupied: Seat | null
  seats: Seat[]
  toggle: boolean
  blocked: (x: number, z: number) => boolean
}): SeatStep {
  const occupied = input.occupied && input.seats.some((seat) => seat.id === input.occupied?.id) ? input.occupied : null
  if (input.occupied && !occupied) {
    const stand = standSpot(input.occupied, input.blocked)
    return { occupied: null, sitting: false, near: false, ...stand, y: 0, facing: null }
  }
  if (occupied) {
    if (input.toggle) {
      const stand = standSpot(occupied, input.blocked)
      return {
        occupied: null,
        sitting: false,
        near: seatInReach(stand.x, stand.z, input.seats) !== null,
        ...stand,
        y: 0,
        facing: null,
      }
    }
    const pose = sitPose(occupied)
    return { occupied, sitting: true, near: false, ...pose, facing: pose.facing }
  }
  const near = seatInReach(input.x, input.z, input.seats)
  if (input.toggle && near) {
    const pose = sitPose(near)
    return { occupied: near, sitting: true, near: false, ...pose, facing: pose.facing }
  }
  return { occupied: null, sitting: false, near: near !== null, x: input.x, z: input.z, y: 0, facing: null }
}

export function glide(current: number, target: number, dt: number) {
  const next = current + (target - current) * (1 - Math.exp(-12 * dt))
  return Math.abs(next - target) < 0.008 ? target : next
}

function sitPose(seat: Seat) {
  const forwardX = Math.sin(seat.rot)
  const forwardZ = Math.cos(seat.rot)
  return {
    x: seat.x - forwardX * SIT_BACK,
    z: seat.z - forwardZ * SIT_BACK,
    y: SIT_HEIGHT,
    facing: seat.rot,
  }
}

function standSpot(seat: Seat, blocked: (x: number, z: number) => boolean) {
  const forwardX = Math.sin(seat.rot)
  const forwardZ = Math.cos(seat.rot)
  const rightX = Math.cos(seat.rot)
  const rightZ = -Math.sin(seat.rot)
  const spots: [number, number][] = [
    [-1.5, 0],
    [-1.85, 0],
    [-1.2, 0.75],
    [-1.2, -0.75],
    [0.2, 1.6],
    [0.2, -1.6],
    [1.55, 0],
  ]
  for (const [ahead, side] of spots) {
    const x = seat.x + forwardX * ahead + rightX * side
    const z = seat.z + forwardZ * ahead + rightZ * side
    if (!blocked(x, z)) return { x, z }
  }
  return { x: seat.x - forwardX * 1.85, z: seat.z - forwardZ * 1.85 }
}

function seatInReach(x: number, z: number, seats: Seat[]) {
  let best: { seat: Seat; score: number } | null = null
  for (const seat of seats) {
    const dist = Math.hypot(x - seat.x, z - seat.z)
    if (dist > REACH) continue
    if (!best || dist < best.score) best = { seat, score: dist }
  }
  return best?.seat ?? null
}
