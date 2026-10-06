import { setDoorOccupants } from '../../office/doors'
import { OFFICE_AVATAR_SCALE } from '../../office/scale'
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PCFShadowMap, PerspectiveCamera, type Group } from 'three'
import type { AvatarParts } from '../../avatar/parts'
import { clearHeld, holdKey, isHeld, queueJump, takeJump, takeSit } from '../../office/input'
import { boardInReach } from '../../office/boards'
import { BUILDING, PLAN_SCALE, blocked, plan, props, roomAt, wallBlocked } from '../../office/layout'
import { OFFICE_DESKS, deskInFront } from '../../office/desks'
import { glide, OFFICE_SEATS, resolveSeat, type Seat } from '../../office/seats'
import { BlockyCharacter } from './BlockyAvatar'
import { ScreenFeeds } from './feeds'
import { RemotePeople, type RemoteBody } from './RemotePeople'
import type { SharedPicture } from '../../net/media'
import { OfficeShell } from './OfficeSet'
import { usePlaySettings } from '../../store/play'

const SPAWN = { x: plan(-4.2), z: plan(5.4) }
const PULL = PLAN_SCALE / 1.25
const OVERVIEW_CAMERA: [number, number, number] = [31 * PULL, 37 * PULL, BUILDING.z + 42.25 * PULL]

export type Presence = {
  x: number
  z: number
  yaw: number
  room: string
  roomId: string
  nearSeat: boolean
  sitting: boolean
  atDesk: boolean
  seatId: string
}

export type SpawnShift = { dx: number; dz: number; yaw: number }

export type Gait = 'idle' | 'walk' | 'sprint' | 'sit'

export type Motion = {
  x: number
  z: number
  y: number
  yaw: number
  gait: Gait
  roomId: string
  sitting: boolean
}

const staff: { parts: AvatarParts; position: [number, number, number]; rotationY: number }[] = [
  { parts: { face: 'b', outfit: 'k', pants: 'e' }, position: [-8.4, 0, 0.8], rotationY: Math.PI },
  { parts: { face: 'g', outfit: 'd', pants: 'h' }, position: [3.55, 0, -6.95], rotationY: -Math.PI / 2 },
  { parts: { face: 'l', outfit: 'n', pants: 'c' }, position: [5.15, 0, 2.45], rotationY: Math.PI },
]

export function OfficeStage({
  parts,
  onPresence,
  others = [],
  overview = false,
  paused = false,
  place = null,
  onPlace,
  onMotion,
  screens = [],
}: {
  parts: AvatarParts
  others?: RemoteBody[]
  overview?: boolean
  paused?: boolean
  place?: SpawnShift | null
  onPlace?: (presence: Presence) => void
  onMotion?: (motion: Motion) => void
  screens?: SharedPicture[]
  onPresence: (presence: Presence) => void
}) {
  const spots = props.flatMap((prop) => (prop.kind === 'screen' ? [{ x: prop.x, z: prop.z }] : []))
  return (
    <Canvas
      key={overview ? 'overview' : 'walk'}
      className="h-full w-full touch-none"
      shadows={{ type: PCFShadowMap }}
      dpr={[1, 1.5]}
      camera={{ position: overview ? OVERVIEW_CAMERA : [-3.15, 2.55, 12.1], fov: overview ? 42 : 52, near: 0.08, far: 240 }}
    >
      <color attach="background" args={['#e6eeff']} />
      <hemisphereLight args={['#ffffff', '#c4d8ff', 1.8]} />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[-16 * PULL, 22 * PULL, 8 * PULL]}
        intensity={2.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={2}
        shadow-camera-far={90 * PULL}
        shadow-camera-left={-23 * PULL}
        shadow-camera-right={23 * PULL}
        shadow-camera-top={32 * PULL}
        shadow-camera-bottom={-32 * PULL}
        shadow-bias={-0.0002}
        shadow-normalBias={0.08}
      />
      <Suspense fallback={null}>
        <ScreenFeeds.Provider value={{ pictures: screens, spots }}>
        <OfficeShell overview={overview} />
        <Staff />
        <RemotePeople people={others} />
        {overview ? <OrbitControls makeDefault target={[BUILDING.x, 0, BUILDING.z]} minDistance={18 * PULL} maxDistance={75 * PULL} maxPolarAngle={Math.PI / 2.15} /> : (
          <>
            <ViewFov />
            <Player parts={parts} onPresence={onPresence} paused={paused} place={place} onPlace={onPlace} onMotion={onMotion} others={others} />
          </>
        )}
        </ScreenFeeds.Provider>
      </Suspense>
    </Canvas>
  )
}

function Staff() {
  return (
    <group>
      {staff.map((person) => (
        <BlockyCharacter
          key={`${person.position[0]}-${person.position[2]}`}
          parts={person.parts}
          pose="idle"
          position={[plan(person.position[0]), person.position[1], plan(person.position[2])]}
          rotationY={person.rotationY}
          scale={OFFICE_AVATAR_SCALE}
        />
      ))}
    </group>
  )
}

function Player({
  parts,
  onPresence,
  paused,
  place,
  onPlace,
  onMotion,
  others,
}: {
  others: RemoteBody[]
  parts: AvatarParts
  paused: boolean
  place: SpawnShift | null
  onPlace?: (presence: Presence) => void
  onMotion?: (motion: Motion) => void
  onPresence: (presence: Presence) => void
}) {
  const body = useRef<Group>(null)
  const spot = useRef({ x: SPAWN.x, z: SPAWN.z })
  const velocity = useRef({ x: 0, z: 0 })
  const height = useRef(0)
  const vertical = useRef(0)
  const facing = useRef(Math.PI)
  const yaw = useRef(0)
  const pitch = useRef(0.22)
  const gait = useRef<Gait>('idle')
  const occupied = useRef<Seat | null>(null)
  const reported = useRef({ x: 99, z: 99, room: '', yaw: 99, reach: '', sitting: false, nearSeat: false, atDesk: false })
  const shifted = useRef<SpawnShift | null>(null)
  const [pose, setPose] = useState<Gait>('idle')
  const { camera, gl } = useThree()

  useEffect(() => () => setDoorOccupants([]), [])

  useLayoutEffect(() => {
    const group = body.current
    if (!group) return
    group.position.set(SPAWN.x, 0, SPAWN.z)
    group.rotation.y = Math.PI
  }, [])

  useEffect(() => {
    if (paused) {
      clearHeld()
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock()
      return
    }
    const element = gl.domElement
    let drag = false
    let touchId: number | null = null
    let lastX = 0
    let lastY = 0
    const look = (dx: number, dy: number) => {
      const sensitivity = usePlaySettings.getState().sensitivity
      yaw.current -= dx * 0.0022 * sensitivity
      pitch.current = clamp(pitch.current + dy * 0.0016 * sensitivity, -0.55, 0.85)
    }
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== element) return
      look(event.movementX, event.movementY)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        if (touchId !== null) return
        touchId = event.pointerId
        lastX = event.clientX
        lastY = event.clientY
        return
      }
      if (event.button !== 0) return
      drag = true
      lastX = event.clientX
      lastY = event.clientY
      lockLook(element)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (document.pointerLockElement === element) return
      if (event.pointerType === 'touch') {
        if (touchId === null || event.pointerId !== touchId) return
      } else if (!drag) return
      look(event.clientX - lastX, event.clientY - lastY)
      lastX = event.clientX
      lastY = event.clientY
    }
    const endTouch = (event: PointerEvent) => {
      if (event.pointerId === touchId) touchId = null
      if (event.pointerType !== 'touch') drag = false
    }
    const showCursor = () => {
      element.style.cursor = 'auto'
    }
    const syncCursor = () => {
      element.style.cursor = document.pointerLockElement === element ? 'none' : 'auto'
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        clearHeld()
        showCursor()
        document.exitPointerLock()
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        if (event.type === 'keydown' && !event.repeat) queueJump()
        if (event.type === 'keydown') lockLook(element)
        return
      }
      const control = CONTROL_CODES[event.code]
      if (!control) return
      event.preventDefault()
      if (event.repeat) return
      holdKey(control, event.type === 'keydown')
      if (event.type === 'keydown') lockLook(element)
    }
    showCursor()
    element.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('pointerlockchange', syncCursor)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endTouch)
    window.addEventListener('pointercancel', endTouch)
    document.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    const clear = () => clearHeld()
    window.addEventListener('blur', clear)
    return () => {
      document.removeEventListener('pointerlockchange', syncCursor)
      showCursor()
      element.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endTouch)
      window.removeEventListener('pointercancel', endTouch)
      document.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', clear)
      if (document.pointerLockElement === element) document.exitPointerLock()
      clearHeld()
    }
  }, [gl, paused])

  useFrame((_, delta) => {
    setDoorOccupants([{ x: spot.current.x, z: spot.current.z }, ...others.map(person => ({ x: person.x, z: person.z }))])
    if (place && shifted.current !== place) {
      shifted.current = place
      spot.current.x = SPAWN.x + place.dx
      spot.current.z = SPAWN.z + place.dz
      yaw.current = place.yaw
      facing.current = place.yaw + Math.PI
      velocity.current.x = 0
      velocity.current.z = 0
      const room = roomAt(spot.current.x, spot.current.z)
      onPlace?.({
        x: spot.current.x,
        z: spot.current.z,
        yaw: yaw.current,
        room: room.name,
        roomId: room.id,
        nearSeat: false,
        sitting: false,
        atDesk: false,
        seatId: '',
      })
    }
    if (paused) {
      velocity.current.x = 0
      velocity.current.z = 0
    }
    const dt = Math.min(delta, 0.033)
    let forward = 0
    let strafe = 0
    if (isHeld('w')) forward += 1
    if (isHeld('s')) forward -= 1
    if (isHeld('d')) strafe += 1
    if (isHeld('a')) strafe -= 1
    const length = Math.hypot(forward, strafe)
    const sin = Math.sin(yaw.current)
    const cos = Math.cos(yaw.current)
    let wishX = 0
    let wishZ = 0
    if (length > 0) {
      wishX = (strafe / length) * cos - (forward / length) * sin
      wishZ = -(strafe / length) * sin - (forward / length) * cos
    }
    const sprint = isHeld('shift') && length > 0
    const wasSitting = occupied.current !== null
    const jump = takeJump()
    const step = resolveSeat({
      x: spot.current.x,
      z: spot.current.z,
      occupied: occupied.current,
      seats: OFFICE_SEATS,
      toggle: takeSit() || (wasSitting && jump),
      blocked,
    })
    occupied.current = step.occupied
    let nextGait: Gait
    if (step.sitting && step.facing !== null) {
      if (!wasSitting) yaw.current = step.facing + Math.PI + 1.55
      velocity.current.x = 0
      velocity.current.z = 0
      vertical.current = 0
      spot.current.x = glide(spot.current.x, step.x, dt)
      spot.current.z = glide(spot.current.z, step.z, dt)
      height.current = glide(height.current, step.y, dt)
      facing.current = turnToward(facing.current, step.facing, dt)
      nextGait = 'sit'
    } else {
      if (wasSitting) {
        spot.current.x = step.x
        spot.current.z = step.z
        height.current = 0
        vertical.current = 0
        velocity.current.x = 0
        velocity.current.z = 0
      }
      const rate = length > 0 ? (sprint ? 14 : 9) : 16
      const topSpeed = sprint ? 5.7 : 3.35
      velocity.current.x = approach(velocity.current.x, wishX * topSpeed, rate, dt)
      velocity.current.z = approach(velocity.current.z, wishZ * topSpeed, rate, dt)
      const nextX = spot.current.x + velocity.current.x * dt
      const nextZ = spot.current.z + velocity.current.z * dt
      if (!blocked(nextX, spot.current.z)) spot.current.x = nextX
      else velocity.current.x = 0
      if (!blocked(spot.current.x, nextZ)) spot.current.z = nextZ
      else velocity.current.z = 0
      const grounded = height.current <= 0.001 && vertical.current <= 0
      if (jump && !wasSitting && grounded) vertical.current = 7.4
      vertical.current -= 26 * dt
      height.current += vertical.current * dt
      if (height.current <= 0) {
        height.current = 0
        vertical.current = 0
      }
      const speed = Math.hypot(velocity.current.x, velocity.current.z)
      facing.current = turnToward(facing.current, yaw.current + Math.PI, dt)
      nextGait = speed > 0.55 ? (isHeld('shift') ? 'sprint' : 'walk') : 'idle'
    }
    const group = body.current
    if (group) {
      group.position.set(spot.current.x, height.current, spot.current.z)
      group.rotation.y = facing.current
    }
    if (nextGait !== gait.current) {
      gait.current = nextGait
      setPose(nextGait)
    }
    const aim = frameCamera(spot.current.x, height.current, spot.current.z, yaw.current, pitch.current, step.sitting ? 0.45 : 0)
    glideCamera(camera as PerspectiveCamera, aim.x, aim.y, aim.z, aim.lookX, aim.lookY, aim.lookZ, dt)
    const room = roomAt(spot.current.x, spot.current.z)
    const moved = Math.hypot(spot.current.x - reported.current.x, spot.current.z - reported.current.z)
    const turned = Math.abs(Math.atan2(Math.sin(yaw.current - reported.current.yaw), Math.cos(yaw.current - reported.current.yaw)))
    const reach = boardInReach(spot.current.x, spot.current.z)?.id ?? ''
    const atDesk = step.occupied ? deskInFront(step.occupied, OFFICE_DESKS) : false
    if (
      moved > 0.18 ||
      room.id !== reported.current.room ||
      turned > 0.2 ||
      reach !== reported.current.reach ||
      step.sitting !== reported.current.sitting ||
      step.near !== reported.current.nearSeat ||
      atDesk !== reported.current.atDesk
    ) {
      reported.current = {
        x: spot.current.x,
        z: spot.current.z,
        room: room.id,
        yaw: yaw.current,
        reach,
        sitting: step.sitting,
        nearSeat: step.near,
        atDesk,
      }
      onPresence({
        x: spot.current.x,
        z: spot.current.z,
        yaw: yaw.current,
        room: room.name,
        roomId: room.id,
        nearSeat: step.near,
        sitting: step.sitting,
        atDesk,
        seatId: step.occupied?.id ?? '',
      })
    }
    onMotion?.({
      x: spot.current.x,
      z: spot.current.z,
      y: Math.max(0, height.current),
      yaw: yaw.current,
      gait: nextGait,
      roomId: room.id,
      sitting: step.sitting,
    })
  })

  return (
    <group ref={body}>
      <BlockyCharacter parts={parts} pose={pose} rotationY={0} scale={OFFICE_AVATAR_SCALE} />
    </group>
  )
}

const CONTROL_CODES: Record<string, string> = {
  KeyW: 'w',
  KeyA: 'a',
  KeyS: 's',
  KeyD: 'd',
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
}

function ViewFov() {
  const fov = usePlaySettings((state) => state.fov)
  const camera = useThree((state) => state.camera)
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    camera.fov = fov
    camera.updateProjectionMatrix()
  }, [camera, fov])
  return null
}

function lockLook(element: HTMLElement) {
  if (document.pointerLockElement === element) return
  element.style.cursor = 'none'
  const locked = element.requestPointerLock()
  void Promise.resolve(locked).catch(() => undefined)
}

function approach(current: number, target: number, rate: number, dt: number) {
  const diff = target - current
  const step = rate * dt
  if (Math.abs(diff) <= step) return target
  return current + Math.sign(diff) * step
}

function turnToward(current: number, target: number, dt: number) {
  let diff = target - current
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return current + diff * (1 - Math.exp(-10 * dt))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function frameCamera(x: number, lift: number, z: number, yaw: number, pitch: number, lookLift = 0) {
  const forwardX = -Math.sin(yaw)
  const forwardZ = -Math.cos(yaw)
  const rightX = Math.cos(yaw)
  const rightZ = -Math.sin(yaw)
  const distance = 6.8
  const shoulder = 1.05
  const farX = x - forwardX * distance + rightX * shoulder
  const farZ = z - forwardZ * distance + rightZ * shoulder
  let bestX = x + rightX * 0.28
  let bestZ = z + rightZ * 0.28
  for (let step = 1; step <= 24; step += 1) {
    const t = step / 24
    const sampleX = x + (farX - x) * t
    const sampleZ = z + (farZ - z) * t
    if (wallBlocked(sampleX, sampleZ, 0.15)) break
    bestX = sampleX
    bestZ = sampleZ
  }
  const reach = Math.hypot(bestX - x, bestZ - z)
  const liftCamera = Math.max(0, 4.6 - reach) * 0.38 + Math.max(0, 2.4 - reach) * 0.85
  const y = Math.min(2.92, Math.max(0.85, 2.28 + pitch * 1.25 + liftCamera + lift * 0.45))
  return {
    x: bestX,
    y,
    z: bestZ,
    lookX: x + forwardX * 3.6 + rightX * 0.15,
    lookY: 1.4 + lookLift + lift - pitch * 1.35,
    lookZ: z + forwardZ * 3.6 + rightZ * 0.15,
  }
}

function glideCamera(
  camera: PerspectiveCamera,
  x: number,
  y: number,
  z: number,
  lookX: number,
  lookY: number,
  lookZ: number,
  dt: number,
) {
  const blend = 1 - Math.exp(-12 * dt)
  const lookBlend = 1 - Math.exp(-14 * dt)
  camera.position.x += (x - camera.position.x) * blend
  camera.position.y += (y - camera.position.y) * blend
  camera.position.z += (z - camera.position.z) * blend
  aimed.x += (lookX - aimed.x) * lookBlend
  aimed.y += (lookY - aimed.y) * lookBlend
  aimed.z += (lookZ - aimed.z) * lookBlend
  camera.lookAt(aimed.x, aimed.y, aimed.z)
}

const aimed = { x: -4.2, y: 1.15, z: 1.8 }
