import { OFFICE_AVATAR_SCALE } from '../../office/scale'
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BufferGeometry,
  Float32BufferAttribute,
  MOUSE,
  PCFShadowMap,
  Plane,
  Raycaster,
  TOUCH,
  Vector2,
  Vector3,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type PerspectiveCamera,
} from 'three'
import type { AvatarParts } from '../../avatar/parts'
import {
  clampRoom,
  collisionFor,
  hitTest,
  isObjectTool,
  roomRect,
  roomsOverlap,
  snap,
  toProp,
  type BuildTool,
  type BuiltOffice,
  type Selection,
} from '../../office/build'
import type { Door } from '../../office/layout'
import { clearHeld, holdKey, isHeld, queueJump, takeJump, takeSit } from '../../office/input'
import { deskInFront } from '../../office/desks'
import { builtBoardId } from '../../office/boards'
import { chairSeats, glide, resolveSeat, type Seat } from '../../office/seats'
import { BlockyCharacter } from './BlockyAvatar'
import type { Motion, Presence, SpawnShift } from './OfficeWorld'
import { ScreenFeeds } from './feeds'
import { RemotePeople, type RemoteBody } from './RemotePeople'
import type { SharedPicture } from '../../net/media'
import { Furnish, isFurnitureAccent } from './OfficeSet'

const WALL = 3.5
const OPENING = 2.75

export function BuiltStage({
  office,
  parts,
  walking,
  enclosed,
  selected,
  tool,
  onPresence,
  others = [],
  onSelect,
  onMove,
  onDrawRoom,
  onPlaceObject,
  onPaint,
  placementRot,
  onTurn,
  paused = false,
  place = null,
  onStand,
  onMotion,
  screens = [],
}: {
  office: BuiltOffice
  parts: AvatarParts
  walking: boolean
  enclosed: boolean
  selected: Selection | null
  tool: BuildTool
  placementRot: number
  onPresence: (presence: Presence) => void
  others?: RemoteBody[]
  onSelect: (selection: Selection | null) => void
  onMove: (selection: Selection, x: number, z: number) => void
  onDrawRoom: (room: { x: number; z: number; w: number; d: number }) => void
  onPlaceObject: (x: number, z: number, rot: number) => void
  onPaint: (selection: Selection | null) => void
  onTurn: (direction: 1 | -1) => void
  paused?: boolean
  place?: SpawnShift | null
  onStand?: (presence: Presence) => void
  onMotion?: (motion: Motion) => void
  screens?: SharedPicture[]
}) {
  const spots = office.objects.flatMap((object) => (object.kind === 'screen' ? [{ x: object.x, z: object.z }] : []))
  const collision = useMemo(() => collisionFor(office), [office])
  const seats = useMemo(() => chairSeats(office.objects), [office.objects])
  const desks = useMemo(() => office.objects.flatMap((object) => (object.kind === 'desk' ? [{ x: object.x, z: object.z }] : [])), [office.objects])
  const span = Math.max(office.width, office.depth)
  return (
    <Canvas
      key={`${office.id}-${walking ? 'walk' : 'edit'}`}
      className="h-full w-full touch-none"
      shadows={{ type: PCFShadowMap }}
      dpr={[1, 1.5]}
      camera={
        walking
          ? { position: [collision.spawn.x, 2.4, collision.spawn.z + 4], fov: 52, near: 0.08, far: 140 }
          : { position: [span * 0.42, span * 0.7, span * 0.72], fov: 40, near: 0.08, far: 180 }
      }
    >
      <color attach="background" args={['#e6eeff']} />
      <hemisphereLight args={['#ffffff', '#c4d8ff', 1.8]} />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[-12, 18, 8]}
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={2}
        shadow-camera-far={90}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-bias={-0.0002}
        shadow-normalBias={0.08}
      />
      <Suspense fallback={null}>
        <ScreenFeeds.Provider value={{ pictures: screens, spots }}>
        <BuiltShell office={office} enclosed={enclosed} selected={selected} doors={collision.doors} walls={collision.walls} showGrid={!walking} />
        {walking ? (
          <Walker
            parts={parts}
            spawn={collision.spawn}
            blocked={collision.blocked}
            wallBlocked={collision.wallBlocked}
            roomAt={collision.roomAt}
            seats={seats}
            desks={desks}
            paused={paused}
            onPresence={onPresence}
            place={place}
            onStand={onStand}
            onMotion={onMotion}
          />
        ) : null}
        {walking ? <RemotePeople people={others} /> : null}
        {walking ? null : (
          <>
            <OrbitControls
              makeDefault
              target={[0, 0.4, 0]}
              minDistance={8}
              maxDistance={span * 2.4}
              maxPolarAngle={Math.PI / 2.08}
              mouseButtons={{ LEFT: null as unknown as MOUSE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE }}
              touches={{ ONE: null as unknown as TOUCH, TWO: TOUCH.DOLLY_ROTATE }}
            />
            <BuildCursor
              office={office}
              tool={tool}
              placementRot={placementRot}
              onTurn={onTurn}
              onSelect={onSelect}
              onMove={onMove}
              onDrawRoom={onDrawRoom}
              onPlaceObject={onPlaceObject}
              onPaint={onPaint}
            />
          </>
        )}
        </ScreenFeeds.Provider>
      </Suspense>
    </Canvas>
  )
}

function BuiltShell({
  office,
  enclosed,
  selected,
  walls,
  doors,
  showGrid,
}: {
  office: BuiltOffice
  enclosed: boolean
  selected: Selection | null
  walls: { x: number; z: number; w: number; d: number }[]
  doors: Door[]
  showGrid: boolean
}) {
  const height = enclosed ? WALL : 1.15
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.33, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#e6eeff" roughness={1} />
      </mesh>
      <mesh position={[0, -0.18, 0]} receiveShadow>
        <boxGeometry args={[office.width + 0.7, 0.28, office.depth + 0.7]} />
        <meshStandardMaterial color={office.trim} roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[office.width - 0.16, 0.04, office.depth - 0.16]} />
        <meshStandardMaterial color={office.floor} roughness={1} flatShading />
      </mesh>
      {showGrid ? <FloorGrid width={office.width} depth={office.depth} /> : null}
      {office.rooms.map((room, index) => (
        <mesh key={room.id} position={[room.x, -0.005 + index * 0.001, room.z]} receiveShadow>
          <boxGeometry args={[Math.max(room.w - (room.walls ? 0.2 : 0.06), 0.2), 0.05, Math.max(room.d - (room.walls ? 0.2 : 0.06), 0.2)]} />
          <meshStandardMaterial color={room.floor} roughness={1} flatShading />
        </mesh>
      ))}
      <mesh position={[0, WALL + 0.06, 0]}>
        <boxGeometry args={[office.width + 0.3, 0.12, office.depth + 0.3]} />
        <meshStandardMaterial color={office.ceiling} roughness={1} flatShading transparent={!enclosed} opacity={enclosed ? 1 : 0.28} depthWrite={enclosed} />
      </mesh>
      {walls.map((wall, index) => (
        <group key={`${index}-${wall.x}-${wall.z}`} position={[wall.x, 0, wall.z]}>
          <mesh position={[0, (height - 0.08) / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[wall.w, height - 0.08, wall.d]} />
            <meshStandardMaterial color={office.wall} roughness={0.92} flatShading />
          </mesh>
          <mesh position={[0, height - 0.04, 0]}>
            <boxGeometry args={[wall.w + 0.03, 0.08, wall.d + 0.03]} />
            <meshStandardMaterial color={office.trim} roughness={0.8} flatShading />
          </mesh>
        </group>
      ))}
      {enclosed && doors.map((door) => <DoorFrame key={`${door.axis}-${door.x}-${door.z}`} door={door} wall={office.wall} trim={office.trim} />)}
      {enclosed &&
        [...office.rooms.map((room) => [room.x, room.z] as const), [0, office.depth * 0.28] as const].map(([x, z]) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh position={[0, 3.15, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.7, 5]} />
              <meshStandardMaterial color="#14161c" roughness={0.5} />
            </mesh>
            <mesh position={[0, 2.76, 0]}>
              <cylinderGeometry args={[0.16, 0.08, 0.12, 6]} />
              <meshStandardMaterial color="#fff4d8" emissive="#ffe3a3" emissiveIntensity={0.75} roughness={0.4} />
            </mesh>
          </group>
        ))}
      {office.objects.map((object) => (
        <Accent key={`${object.id}-${object.color}`} color={object.color}>
          <Furnish prop={toProp(object)} boardId={object.kind === 'board' ? builtBoardId(object.id) : undefined} />
        </Accent>
      ))}
      {selected?.type === 'room' && office.rooms.filter((room) => room.id === selected.id).map((room) => (
        <mesh key={room.id} position={[room.x, 0.25, room.z]}>
          <boxGeometry args={[room.w + 0.08, 0.5, room.d + 0.08]} />
          <meshBasicMaterial color="#2765ed" wireframe />
        </mesh>
      ))}
      {selected?.type === 'object' && office.objects.filter((object) => object.id === selected.id).map((object) => (
        <mesh key={object.id} position={[object.x, 0.08, object.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.55, 20]} />
          <meshBasicMaterial color="#2765ed" />
        </mesh>
      ))}
    </group>
  )
}

function FloorGrid({ width, depth }: { width: number; depth: number }) {
  const geometry = useMemo(() => {
    const positions: number[] = []
    const halfW = width / 2
    const halfD = depth / 2
    for (let x = -halfW; x <= halfW + 0.001; x += 0.5) {
      positions.push(x, 0.045, -halfD, x, 0.045, halfD)
    }
    for (let z = -halfD; z <= halfD + 0.001; z += 0.5) {
      positions.push(-halfW, 0.045, z, halfW, 0.045, z)
    }
    const next = new BufferGeometry()
    next.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return next
  }, [depth, width])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#8a8d98" transparent opacity={0.45} />
    </lineSegments>
  )
}

type Ghost =
  | { mode: 'room'; x: number; z: number; w: number; d: number; ok: boolean }
  | { mode: 'object'; kind: BuildTool; x: number; z: number; rot: number }

function BuildCursor({
  office,
  tool,
  placementRot,
  onTurn,
  onSelect,
  onMove,
  onDrawRoom,
  onPlaceObject,
  onPaint,
}: {
  office: BuiltOffice
  tool: BuildTool
  placementRot: number
  onTurn: (direction: 1 | -1) => void
  onSelect: (selection: Selection | null) => void
  onMove: (selection: Selection, x: number, z: number) => void
  onDrawRoom: (room: { x: number; z: number; w: number; d: number }) => void
  onPlaceObject: (x: number, z: number, rot: number) => void
  onPaint: (selection: Selection | null) => void
}) {
  const { camera, gl } = useThree()
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const drag = useRef<
    | null
    | { mode: 'room'; x: number; z: number }
    | { mode: 'move'; selection: Selection; dx: number; dz: number }
    | { mode: 'place' }
  >(null)
  const handlers = useRef({ onSelect, onMove, onDrawRoom, onPlaceObject, onPaint, onTurn, office, tool, rot: placementRot })
  handlers.current = { onSelect, onMove, onDrawRoom, onPlaceObject, onPaint, onTurn, office, tool, rot: placementRot }

  useEffect(() => {
    setGhost(null)
  }, [tool])

  useEffect(() => {
    setGhost((current) => (current?.mode === 'object' ? { ...current, rot: placementRot } : current))
  }, [placementRot])

  useEffect(() => {
    const element = gl.domElement
    const raycaster = new Raycaster()
    const ndc = new Vector2()
    const plane = new Plane(new Vector3(0, 1, 0), 0)
    const hit = new Vector3()

    const floorPoint = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect()
      ndc.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      ndc.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(plane, hit)) return null
      const { office: current } = handlers.current
      if (Math.abs(hit.x) > current.width / 2 || Math.abs(hit.z) > current.depth / 2) return null
      return { x: snap(hit.x), z: snap(hit.z) }
    }

    const roomGhost = (start: { x: number; z: number }, point: { x: number; z: number }) => {
      const rect = roomRect(start, point)
      const current = handlers.current.office
      const ready = rect.w >= 3 && rect.d >= 3
      const fitted = clampRoom(current, {
        id: 'ghost',
        name: 'Room',
        x: ready ? rect.x : start.x,
        z: ready ? rect.z : start.z,
        w: ready ? rect.w : 4,
        d: ready ? rect.d : 4,
        floor: '#e6e8ee',
        walls: true,
      })
      const shown = ready ? rect : { x: fitted.x, z: fitted.z, w: fitted.w, d: fitted.d }
      return { ...shown, ok: !roomsOverlap(current.rooms, fitted), ready, fitted }
    }

    const onPointerMove = (event: PointerEvent) => {
      const active = drag.current
      if (!active && event.target !== element) {
        setGhost(null)
        return
      }
      const point = floorPoint(event)
      const currentTool = handlers.current.tool
      if (!point) {
        if (!active) setGhost(null)
        element.style.cursor = 'auto'
        return
      }
      if (active?.mode === 'room') {
        const next = roomGhost(active, point)
        setGhost({ mode: 'room', x: next.x, z: next.z, w: next.w, d: next.d, ok: next.ok })
        element.style.cursor = 'crosshair'
        return
      }
      if (active?.mode === 'move') {
        handlers.current.onMove(active.selection, snap(point.x + active.dx), snap(point.z + active.dz))
        element.style.cursor = 'grabbing'
        return
      }
      if (isObjectTool(currentTool)) {
        setGhost({ mode: 'object', kind: currentTool, x: point.x, z: point.z, rot: handlers.current.rot })
        element.style.cursor = 'copy'
        return
      }
      setGhost(null)
      element.style.cursor = currentTool === 'room' || currentTool === 'paint' ? 'crosshair' : hitTest(handlers.current.office, point.x, point.z) ? 'grab' : 'default'
    }

    const onPointerUp = (event: PointerEvent) => {
      const active = drag.current
      drag.current = null
      if (!active) return
      const point = floorPoint(event)
      if (active.mode === 'place') {
        if (!point || !isObjectTool(handlers.current.tool)) return
        handlers.current.onPlaceObject(point.x, point.z, handlers.current.rot)
        return
      }
      if (active.mode !== 'room') return
      const next = roomGhost(active, point ?? active)
      handlers.current.onDrawRoom({ x: next.fitted.x, z: next.fitted.z, w: next.fitted.w, d: next.fitted.d })
      setGhost(null)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const point = floorPoint(event)
      if (!point) return
      const currentTool = handlers.current.tool
      const current = handlers.current.office
      if (currentTool === 'room') {
        drag.current = { mode: 'room', x: point.x, z: point.z }
        setGhost({ mode: 'room', x: point.x, z: point.z, w: 0.5, d: 0.5, ok: true })
        return
      }
      if (currentTool === 'paint') {
        handlers.current.onPaint(hitTest(current, point.x, point.z))
        return
      }
      if (isObjectTool(currentTool)) {
        drag.current = { mode: 'place' }
        return
      }
      const picked = hitTest(current, point.x, point.z)
      handlers.current.onSelect(picked)
      if (!picked) return
      const item = picked.type === 'room' ? current.rooms.find((room) => room.id === picked.id) : current.objects.find((object) => object.id === picked.id)
      if (!item) return
      drag.current = { mode: 'move', selection: picked, dx: item.x - point.x, dz: item.z - point.z }
    }

    const turn = (direction: 1 | -1) => {
      if (!isObjectTool(handlers.current.tool)) return
      handlers.current.onTurn(direction)
    }

    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      if (event.key === 'r' || event.key === 'R' || event.key === '.' || event.key === '>') turn(1)
      else if (event.key === ',' || event.key === '<') turn(-1)
    }

    const onWheel = (event: WheelEvent) => {
      if (!isObjectTool(handlers.current.tool)) return
      event.preventDefault()
      event.stopPropagation()
      turn(event.deltaY > 0 ? 1 : -1)
    }

    element.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('keydown', onKey)
    element.addEventListener('wheel', onWheel, { capture: true, passive: false })
    return () => {
      element.style.cursor = 'auto'
      element.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('keydown', onKey)
      element.removeEventListener('wheel', onWheel, { capture: true })
    }
  }, [camera, gl])

  if (!ghost) return null
  if (ghost.mode === 'room') {
    return (
      <mesh position={[ghost.x, 0.12, ghost.z]}>
        <boxGeometry args={[Math.max(ghost.w, 0.2), 0.16, Math.max(ghost.d, 0.2)]} />
        <meshStandardMaterial color={ghost.ok ? '#2765ed' : '#c0392b'} transparent opacity={0.45} />
      </mesh>
    )
  }
  if (!isObjectTool(ghost.kind)) return null
  return (
    <group position={[ghost.x, 0, ghost.z]}>
      <Furnish prop={toProp({ id: 'ghost', kind: ghost.kind, x: 0, z: 0, rot: ghost.rot, color: '' })} />
      <group rotation={[0, ghost.rot, 0]}>
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.7, 28]} />
          <meshBasicMaterial color="#2765ed" transparent opacity={0.9} />
        </mesh>
        <mesh position={[0, 0.1, 0.95]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.16, 0.34, 3]} />
          <meshBasicMaterial color="#2765ed" />
        </mesh>
      </group>
    </group>
  )
}

function DoorFrame({ door, wall, trim }: { door: Door; wall: string; trim: string }) {
  const rail = 0.1
  const half = door.w / 2
  const headerBottom = OPENING + rail
  return (
    <group position={[door.x, 0, door.z]} rotation={[0, door.axis === 'z' ? Math.PI / 2 : 0, 0]}>
      {[-half, half].map((x) => (
        <mesh key={x} position={[x, OPENING / 2, 0]} castShadow>
          <boxGeometry args={[0.1, OPENING, 0.16]} />
          <meshStandardMaterial color={trim} roughness={0.45} flatShading />
        </mesh>
      ))}
      <mesh position={[0, OPENING + rail / 2, 0]}>
        <boxGeometry args={[door.w + 0.1, rail, 0.16]} />
        <meshStandardMaterial color={trim} roughness={0.45} flatShading />
      </mesh>
      <mesh position={[0, (headerBottom + WALL) / 2, 0]}>
        <boxGeometry args={[door.w, WALL - headerBottom, 0.2]} />
        <meshStandardMaterial color={wall} roughness={0.92} flatShading />
      </mesh>
    </group>
  )
}

function Accent({ color, children }: { color: string; children: ReactNode }) {
  const ref = useRef<Group>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || !color) return
    const made: { mesh: Mesh; source: MeshStandardMaterial; clone: MeshStandardMaterial }[] = []
    root.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh || !isFurnitureAccent(mesh.material)) return
      const source = mesh.material as MeshStandardMaterial
      const clone = source.clone()
      clone.color.set(color)
      mesh.material = clone
      made.push({ mesh, source, clone })
    })
    return () => {
      for (const item of made) {
        if (item.mesh.material === item.clone) item.mesh.material = item.source
        item.clone.dispose()
      }
    }
  }, [color])
  return <group ref={ref}>{children}</group>
}

function Walker({
  parts,
  spawn,
  blocked,
  wallBlocked,
  roomAt,
  seats,
  desks,
  paused,
  onPresence,
  place,
  onStand,
  onMotion,
}: {
  parts: AvatarParts
  spawn: { x: number; z: number }
  blocked: (x: number, z: number) => boolean
  wallBlocked: (x: number, z: number, radius?: number) => boolean
  roomAt: (x: number, z: number) => { id: string; name: string }
  seats: Seat[]
  desks: { x: number; z: number }[]
  paused: boolean
  onPresence: (presence: Presence) => void
  place: SpawnShift | null
  onStand?: (presence: Presence) => void
  onMotion?: (motion: Motion) => void
}) {
  const body = useRef<Group>(null)
  const spot = useRef({ x: spawn.x, z: spawn.z })
  const velocity = useRef({ x: 0, z: 0 })
  const height = useRef(0)
  const vertical = useRef(0)
  const facing = useRef(Math.PI)
  const yaw = useRef(0)
  const pitch = useRef(0.22)
  const gait = useRef<Gait>('idle')
  const occupied = useRef<Seat | null>(null)
  const seatsRef = useRef(seats)
  const reported = useRef({ x: 99, z: 99, room: '', sitting: false, nearSeat: false, atDesk: false })
  const desksRef = useRef(desks)
  desksRef.current = desks
  const snapped = useRef(false)
  const shifted = useRef<SpawnShift | null>(null)
  const [pose, setPose] = useState<Gait>('idle')
  const { camera, gl } = useThree()
  seatsRef.current = seats

  useLayoutEffect(() => {
    spot.current = { x: spawn.x, z: spawn.z }
    const group = body.current
    if (!group) return
    group.position.set(spawn.x, 0, spawn.z)
    group.rotation.y = Math.PI
  }, [spawn.x, spawn.z])

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
      yaw.current -= dx * 0.0022
      pitch.current = clamp(pitch.current + dy * 0.0016, -0.55, 0.85)
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
    if (place && shifted.current !== place) {
      shifted.current = place
      spot.current.x = spawn.x + place.dx
      spot.current.z = spawn.z + place.dz
      yaw.current = place.yaw
      facing.current = place.yaw + Math.PI
      velocity.current.x = 0
      velocity.current.z = 0
      const room = roomAt(spot.current.x, spot.current.z)
      onStand?.({
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
      seats: seatsRef.current,
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
    const aim = frameCamera(spot.current.x, height.current, spot.current.z, yaw.current, pitch.current, wallBlocked, step.sitting ? 0.45 : 0)
    if (!snapped.current) {
      snapped.current = true
      camera.position.set(aim.x, aim.y, aim.z)
      aimed.x = aim.lookX
      aimed.y = aim.lookY
      aimed.z = aim.lookZ
      camera.lookAt(aimed.x, aimed.y, aimed.z)
    } else {
      glideCamera(camera as PerspectiveCamera, aim.x, aim.y, aim.z, aim.lookX, aim.lookY, aim.lookZ, dt)
    }
    const room = roomAt(spot.current.x, spot.current.z)
    const moved = Math.hypot(spot.current.x - reported.current.x, spot.current.z - reported.current.z)
    const atDesk = step.occupied ? deskInFront(step.occupied, desksRef.current) : false
    if (moved > 0.18 || room.id !== reported.current.room || step.sitting !== reported.current.sitting || step.near !== reported.current.nearSeat || atDesk !== reported.current.atDesk) {
      reported.current = { x: spot.current.x, z: spot.current.z, room: room.id, sitting: step.sitting, nearSeat: step.near, atDesk }
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

function lockLook(element: HTMLElement) {
  if (document.pointerLockElement === element) return
  element.style.cursor = 'none'
  const locked = element.requestPointerLock()
  void Promise.resolve(locked).catch(() => undefined)
}

type Gait = 'idle' | 'walk' | 'sprint' | 'sit'

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

function frameCamera(
  x: number,
  lift: number,
  z: number,
  yaw: number,
  pitch: number,
  wallBlocked: (x: number, z: number, radius?: number) => boolean,
  lookLift = 0,
) {
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

const aimed = { x: 0, y: 1.4, z: 4 }
