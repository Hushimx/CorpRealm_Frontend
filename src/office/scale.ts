// character.glb is 2.7 units tall before the office avatar scale.
export const OFFICE_AVATAR_SCALE = 0.92
export const OFFICE_AVATAR_HEIGHT = 2.7 * OFFICE_AVATAR_SCALE

// Keep the desktop near waist height and leave room for the blocky torso.
export const FURNITURE_SCALE = {
  desk: [1.15, 1.4, 1.4],
  chair: [1.65, 1.4, 1.4],
  meet: [1.15, 1.54, 1.4],
  round: [1.4, 1.4, 1.4],
  chess: [1.22, 1.38, 1.22],
  xo: [1.15, 1.32, 1.15],
} satisfies Record<string, [number, number, number]>

export const FURNITURE_FOOTPRINT = {
  desk: { w: 2.4 * FURNITURE_SCALE.desk[0], d: 0.96 * FURNITURE_SCALE.desk[2] },
  chair: { w: 0.77 * FURNITURE_SCALE.chair[0], d: 0.8 * FURNITURE_SCALE.chair[2] },
  meet: { w: 3.8 * FURNITURE_SCALE.meet[0], d: 1.5 * FURNITURE_SCALE.meet[2] },
  round: { w: 0.85 * FURNITURE_SCALE.round[0], d: 0.85 * FURNITURE_SCALE.round[2] },
  chess: { w: 1.24 * FURNITURE_SCALE.chess[0], d: 1.24 * FURNITURE_SCALE.chess[2] },
  xo: { w: 1.2 * FURNITURE_SCALE.xo[0], d: 1.2 * FURNITURE_SCALE.xo[2] },
}
