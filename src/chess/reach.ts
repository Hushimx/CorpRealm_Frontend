export type ChessSpot = { id: string; x: number; z: number }

const REACH = 2.45

export function chessInReach(x: number, z: number, tables: ChessSpot[]) {
  let best: { spot: ChessSpot; score: number } | null = null
  for (const spot of tables) {
    const dist = Math.hypot(x - spot.x, z - spot.z)
    if (dist > REACH) continue
    if (!best || dist < best.score) best = { spot, score: dist }
  }
  return best?.spot ?? null
}
