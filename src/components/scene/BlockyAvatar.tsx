import { ContactShadows, OrbitControls, useAnimations, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react'
import {
  AnimationClip,
  CanvasTexture,
  LinearFilter,
  Mesh,
  RepeatWrapping,
  SRGBColorSpace,
  type Group,
  type Material,
} from 'three'
import { paintAvatar } from '../../avatar/composeTexture'
import type { AvatarParts, PoseId } from '../../avatar/parts'

const MODEL = '/avatars/character.glb'

export function AvatarStage({ parts, pose }: { parts: AvatarParts; pose: PoseId }) {
  return (
    <Canvas className="h-full w-full" camera={{ position: [0.9, 1.7, -6.6], fov: 24 }} dpr={[1, 2]}>
      <color attach="background" args={['#0b0b0e']} />
      <ambientLight intensity={1.1} />
      <Suspense fallback={null}>
        <BlockyCharacter parts={parts} pose={pose} position={[0.45, 0, 0]} rotationY={Math.PI} scale={0.78} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <circleGeometry args={[1.15, 48]} />
          <meshStandardMaterial color="#14161c" roughness={0.9} />
        </mesh>
        <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={3} blur={2.2} far={1.4} />
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={4.5}
        maxDistance={9}
        target={[0.4, 1.2, 0]}
        maxPolarAngle={Math.PI / 1.9}
      />
    </Canvas>
  )
}

export function BlockyCharacter({
  parts,
  pose,
  position = [0, 0, 0],
  rotationY = Math.PI,
  scale = 0.78,
  groupRef,
}: {
  parts: AvatarParts
  pose: PoseId | 'sprint'
  position?: [number, number, number]
  rotationY?: number
  scale?: number
  groupRef?: RefObject<Group | null>
}) {
  const { face, outfit, pants } = parts
  const localRef = useRef<Group>(null)
  const group = groupRef ?? localRef
  const canvas = useMemo(() => {
    const surface = document.createElement('canvas')
    surface.width = 1024
    surface.height = 1024
    return surface
  }, [])
  const { scene, animations } = useGLTF(MODEL)
  const avatar = useMemo(() => cloneAvatar(scene), [scene])
  const clips = useMemo(() => stationaryClips(animations), [animations])
  const { actions } = useAnimations(clips, group)

  useEffect(() => {
    const texture = new CanvasTexture(canvas)
    texture.flipY = false
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.generateMipmaps = false
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    let active = true
    void paintAvatar(canvas, { face, outfit, pants }).then(() => {
      if (!active) {
        texture.dispose()
        return
      }
      texture.needsUpdate = true
      applyTexture(avatar, texture)
    })
    return () => {
      active = false
      texture.dispose()
    }
  }, [avatar, canvas, face, outfit, pants])

  useEffect(() => {
    const action = actions[pose]
    if (!action) return
    action.reset().fadeIn(0.35).play()
    return () => {
      action.fadeOut(0.28)
    }
  }, [actions, pose])

  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={avatar} />
    </group>
  )
}

function stationaryClips(clips: AnimationClip[]) {
  return clips.map((clip) => {
    const next = clip.clone()
    next.tracks = next.tracks.filter((track) => !track.name.startsWith('root.'))
    return next
  })
}

function cloneAvatar(scene: Group) {
  const cloned = scene.clone(true)
  cloned.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.material = cloneMaterial(mesh.material)
  })
  return cloned
}

function cloneMaterial(material: Material | Material[]) {
  return Array.isArray(material) ? material.map((entry) => entry.clone()) : material.clone()
}

function applyTexture(root: Group, texture: CanvasTexture) {
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if ('map' in material) {
        material.map = texture
        material.needsUpdate = true
      }
    }
  })
}

useGLTF.preload(MODEL)
