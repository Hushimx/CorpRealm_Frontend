import { props } from './layout'

export const OFFICE_DESKS = props.flatMap((prop) => (prop.kind === 'desk' ? [{ x: prop.x, z: prop.z }] : []))

export function deskInFront(seat: { x: number; z: number; rot: number }, desks: { x: number; z: number }[]) {
  const forwardX = Math.sin(seat.rot)
  const forwardZ = Math.cos(seat.rot)
  const rightX = Math.cos(seat.rot)
  const rightZ = -Math.sin(seat.rot)
  return desks.some((desk) => {
    const dx = desk.x - seat.x
    const dz = desk.z - seat.z
    const ahead = dx * forwardX + dz * forwardZ
    const aside = dx * rightX + dz * rightZ
    return ahead > 0.45 && ahead < 2.75 && Math.abs(aside) < 1.5
  })
}
