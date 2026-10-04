import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshBasicMaterial, SRGBColorSpace, VideoTexture, type Group, type Mesh } from 'three'
import type { SharedPicture } from '../../net/media'

export type ScreenPoint = { x: number; z: number; rot: number }

const PANEL_W = 1.42 * 1.35
const PANEL_H = 0.78 * 1.35

function useVideoTexture(track: SharedPicture['track']) {
  const mesh = useRef<Mesh>(null)
  useEffect(() => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.autoplay = true
    track.attach(video)
    const texture = new VideoTexture(video)
    texture.colorSpace = SRGBColorSpace
    const material = mesh.current?.material
    if (material instanceof MeshBasicMaterial) {
      material.map = texture
      material.needsUpdate = true
    }
    void video.play().catch(() => undefined)
    return () => {
      track.detach(video)
      texture.dispose()
      video.srcObject = null
    }
  }, [track])
  return mesh
}

function VideoPlane({ track, args }: { track: SharedPicture['track']; args: [number, number] }) {
  const mesh = useVideoTexture(track)
  return (
    <mesh ref={mesh}>
      <planeGeometry args={args} />
      <meshBasicMaterial toneMapped={false} />
    </mesh>
  )
}

export function ScreenSurfaces({ points, shares }: { points: ScreenPoint[]; shares: SharedPicture[] }) {
  if (!shares.length || !points.length) return null
  return (
    <group>
      {points.map((point, index) => {
        const share = shares[index % shares.length]
        const ox = Math.sin(point.rot) * 0.07
        const oz = Math.cos(point.rot) * 0.07
        return (
          <group key={`${point.x}-${point.z}-${index}`} position={[point.x + ox, 2.05, point.z + oz]} rotation={[0, point.rot, 0]}>
            <VideoPlane track={share.track} args={[PANEL_W, PANEL_H]} />
          </group>
        )
      })}
    </group>
  )
}

export function FaceCamera({ track }: { track: SharedPicture['track'] }) {
  const group = useRef<Group>(null)
  const { camera } = useThree()
  useFrame(() => {
    group.current?.lookAt(camera.position)
  })
  return (
    <group ref={group} position={[0, 2.15, 0]}>
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[0.62, 0.4]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <VideoPlane track={track} args={[0.56, 0.34]} />
    </group>
  )
}
