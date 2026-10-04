import { skinUrl, type SkinId } from '../avatar/parts'

const ATLAS = 1024
const FACE = { x: 145, y: 158, size: 125 }

export function WalkerMark({
  x,
  z,
  yaw = 0,
  face,
  size = 1.6,
}: {
  x: number
  z: number
  yaw?: number
  face: SkinId
  size?: number
}) {
  const scale = size / FACE.size
  const turn = (Math.atan2(-Math.sin(yaw), Math.cos(yaw)) * 180) / Math.PI
  const reach = size * 0.74
  return (
    <g aria-hidden>
      <polygon
        points={`${x},${z - reach} ${x + size * 0.16},${z - reach + size * 0.28} ${x - size * 0.16},${z - reach + size * 0.28}`}
        fill="#000000"
        transform={`rotate(${turn} ${x} ${z})`}
      />
      <circle cx={x} cy={z} r={size / 2 + size * 0.08} fill="#ffffff" stroke="#000000" strokeWidth={size * 0.055} />
      <clipPath id="walker-face">
        <circle cx={x} cy={z} r={size / 2} />
      </clipPath>
      <image
        href={skinUrl(face)}
        x={x - FACE.x * scale}
        y={z - FACE.y * scale}
        width={ATLAS * scale}
        height={ATLAS * scale}
        clipPath="url(#walker-face)"
        preserveAspectRatio="none"
      />
    </g>
  )
}
