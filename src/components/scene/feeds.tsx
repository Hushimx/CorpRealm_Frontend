import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useEffect, useMemo } from 'react'
import { SRGBColorSpace, VideoTexture } from 'three'
import type { SharedPicture } from '../../net/media'

type Spot = { x: number; z: number }

export const ScreenFeeds = createContext<{ pictures: SharedPicture[]; spots: Spot[] }>({ pictures: [], spots: [] })

export function useScreenPicture(x: number, z: number) {
  const { pictures, spots } = useContext(ScreenFeeds)
  const orderedSpots = [...spots].sort((a, b) => a.x - b.x || a.z - b.z)
  const index = orderedSpots.findIndex((spot) => Math.abs(spot.x - x) < 0.05 && Math.abs(spot.z - z) < 0.05)
  if (index < 0 || pictures.length === 0) return null
  const ordered = [...pictures].sort((a, b) => a.userId.localeCompare(b.userId))
  return ordered[index % ordered.length] ?? null
}

export function FeedPlane({
  track,
  width,
  height,
  position = [0, 0, 0.02],
}: {
  track: SharedPicture['track']
  width: number
  height: number
  position?: [number, number, number]
}) {
  const video = useMemo(() => {
    const element = document.createElement('video')
    element.muted = true
    element.playsInline = true
    element.autoplay = true
    return element
  }, [])
  const texture = useMemo(() => {
    const map = new VideoTexture(video)
    map.colorSpace = SRGBColorSpace
    return map
  }, [video])

  useEffect(() => {
    track.attach(video)
    void video.play().catch(() => undefined)
    return () => {
      track.detach(video)
      texture.dispose()
    }
  }, [track, texture, video])

  useFrame(() => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) texture.needsUpdate = true
  })

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}
