import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'
import { SKINS, type PoseId, type SkinId } from '../../avatar/parts'
import { OFFICE_AVATAR_SCALE } from '../../office/scale'
import { BlockyCharacter } from './BlockyAvatar'

export type RemoteBody = {
  sessionId: string
  userId: string
  name: string
  face: string
  outfit: string
  pants: string
  x: number
  z: number
  yaw: number
  y: number
  gait: string
  sitting: boolean
  joinedAt: number
}

const SIT_Y = -0.15

function clip(body: RemoteBody): PoseId | 'sprint' {
  if (body.sitting) return 'sit'
  if (body.gait === 'sprint') return 'sprint'
  if (body.gait === 'walk') return 'walk'
  return 'idle'
}

function skin(value: string): SkinId {
  return (SKINS as readonly string[]).includes(value) ? (value as SkinId) : 'a'
}

function RemotePerson({ body }: { body: RemoteBody }) {
  const group = useRef<Group>(null)
  const target = useRef(body)
  target.current = body

  useFrame((_, delta) => {
    const node = group.current
    if (!node) return
    const blend = 1 - Math.exp(-12 * Math.min(delta, 0.05))
    const next = target.current
    node.position.x += (next.x - node.position.x) * blend
    node.position.z += (next.z - node.position.z) * blend
    const lift = 1 - Math.exp(-22 * Math.min(delta, 0.05))
    node.position.y += ((next.sitting ? SIT_Y : next.y) - node.position.y) * lift
    const facing = next.yaw + Math.PI
    const turn = Math.atan2(Math.sin(facing - node.rotation.y), Math.cos(facing - node.rotation.y))
    node.rotation.y += turn * blend
  })

  return (
    <group ref={group} position={[body.x, body.sitting ? SIT_Y : body.y, body.z]} rotation={[0, body.yaw + Math.PI, 0]}>
      <BlockyCharacter
        parts={{ face: skin(body.face), outfit: skin(body.outfit), pants: skin(body.pants) }}
        pose={clip(body)}
        rotationY={0}
        scale={OFFICE_AVATAR_SCALE}
      />
      <Html position={[0, 2.75, 0]} center distanceFactor={9} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <span className="block whitespace-nowrap rounded-full bg-paper px-2 py-0.5 text-[11px] font-bold text-ink shadow-pop">
          {body.name.trim() || 'Guest'}
        </span>
      </Html>
    </group>
  )
}

export function RemotePeople({ people }: { people: RemoteBody[] }) {
  return (
    <group>
      {people.map((body) => (
        <RemotePerson key={body.sessionId} body={body} />
      ))}
    </group>
  )
}
