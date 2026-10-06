import { useFrame } from '@react-three/fiber'
import { advanceDoor, leafWidth, leafOffset, doorId, useDoors, DOOR_GEOMETRY } from '../../office/doors'
import { useTexture } from '@react-three/drei'
import { FURNITURE_SCALE } from '../../office/scale'
import { useEffect, useState, useRef } from 'react'
import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace, type Material, type Group } from 'three'
import { officeBoardAt } from '../../office/boards'
import { BUILDING, PLAN_SCALE, plan, glassPosts, doors, props, rooms, walls, type Box, type Door, type Prop } from '../../office/layout'
import { FeedPlane, useScreenPicture } from './feeds'
import { TaskSurface } from './TaskSurface'

const WALL = 4.15

const mat = {
  wall: shared('#e6eeff', 0.92),
  trim: shared('#8fb8ff', 0.8),
  frame: shared('#14161c', 0.45, 0.12),
  doorMetal: shared('#14161c', 0.32, 0.5),
  doorFrost: shared('#f3f6fc', 0.8, 0, 0.6),
  doorGreen: shared('#3b82f6', 0.4, 0, 1, '#2765ed'),
  doorAmber: shared('#ffffff', 0.4, 0, 1, '#c4c6ce'),
  glass: shared('#e6eeff', 0.2, 0.06, 0.19),
  orange: shared('#8fb8ff', 0.62),
  sofa: shared('#1447e5', 0.7),
  blue: shared('#2765ed', 0.55),
  bean: shared('#3b82f6', 0.65),
  white: shared('#ffffff', 0.78),
  green: shared('#3e9a55', 0.7),
  leaf: shared('#2f8a48', 0.68),
  ink: shared('#14161c', 0.5),
  screen: shared('#8fb8ff', 0.25, 0, 1, '#3b82f6'),
  wood: shared('#e6b86a', 0.62),
  lamp: shared('#fff4d8', 0.4, 0, 1, '#ffe3a3'),
  server: shared('#0b0b0e', 0.4, 0.2),
  window: shared('#f3f6fc', 0.5, 0, 1, '#e6eeff'),
  city: shared('#e6e8ee', 0.9),
  ground: shared('#e6eeff', 1),
  plinth: shared('#c4c6ce', 0.95),
  ceiling: shared('#ffffff', 1),
  rug: shared('#14161c', 0.9),
  chessLight: shared('#f3f6fc', 0.72),
  chessDark: shared('#8fb8ff', 0.68),
  chessWhite: shared('#ffffff', 0.42),
  chessBlack: shared('#000000', 0.38),
  xoX: shared('#2765ed', 0.45),
  xoO: shared('#000000', 0.4),
  note: shared('#e6eeff', 0.7),
  noteRed: shared('#2765ed', 0.7),
  noteGreen: shared('#8fb8ff', 0.7),
  crate: shared('#c9844a', 0.75),
}

export function isFurnitureAccent(material: Material | Material[]) {
  const list = Array.isArray(material) ? material : [material]
  return list.some(
    (item) =>
      item === mat.orange ||
      item === mat.sofa ||
      item === mat.blue ||
      item === mat.bean ||
      item === mat.wood ||
      item === mat.green ||
      item === mat.leaf ||
      item === mat.server ||
      item === mat.rug,
  )
}

function shared(color: string, roughness: number, metalness = 0, opacity = 1, emissive?: string) {
  return new MeshStandardMaterial({
    color,
    flatShading: true,
    depthWrite: opacity === 1,
    roughness,
    metalness,
    transparent: opacity < 1,
    opacity,
    ...(emissive ? { emissive, emissiveIntensity: 0.75 } : {}),
  })
}

export function OfficeShell({ overview = false }: { overview?: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.33, 0]} receiveShadow material={mat.ground}>
        <planeGeometry args={[200, 200]} />
      </mesh>
      <mesh position={[BUILDING.x, -0.18, BUILDING.z]} receiveShadow material={mat.plinth}>
        <boxGeometry args={[BUILDING.w + 0.5, 0.28, BUILDING.d + 0.5]} />
      </mesh>
      {rooms.map((room) => (
        <mesh key={room.id} position={[room.x, -0.02, room.z]} receiveShadow material={floorMaterial(room.floor)}>
          <boxGeometry args={[room.w - 0.08, 0.04, room.d - 0.08]} />
        </mesh>
      ))}
      {!overview && <mesh position={[BUILDING.x, WALL + 0.06, BUILDING.z]} material={mat.ceiling}>
        <boxGeometry args={[BUILDING.w + 0.3, 0.12, BUILDING.d + 0.3]} />
      </mesh>}
      {walls.map((wall, index) => (
        <Wall key={index} box={wall} low={overview && (wall.z === plan(8) || wall.x === plan(13))} />
      ))}
      {glassPosts.map(post => <Block key={`${post.x}-${post.z}`} at={[post.x, WALL / 2, post.z]} size={[0.07, WALL, 0.07]} material={mat.frame} />)}
      {doors.map((door) => (
        <DoorFrame key={`${door.x}-${door.z}`} door={door} />
      ))}
      {props.map((prop, index) => (
        <Furnish key={index} prop={prop} />
      ))}
      <group scale={[PLAN_SCALE, 1, PLAN_SCALE]}><Windows /></group>
      {!overview && <City />}
      <group scale={[PLAN_SCALE, 1, PLAN_SCALE]}><Pendants /></group>
      <BrandPlate position={[plan(-6),2.05,plan(-7.87)]} width={3.5} />
      <BrandPlate position={[plan(9.9),2.4,plan(-7.87)]} width={2.8} />
      <BrandPlate position={[plan(-9),2.6,plan(-17.87)]} width={2.5} />
      <BrandPlate position={[plan(8.8),2.55,plan(-17.87)]} width={3.2} />
      <BrandPlate position={[plan(3.8),2.15,plan(-8.13)]} width={4.2} rotationY={Math.PI} />
      <Sign text="Focus" position={[-6.5,2.98,-10.88]} />
      <Sign text="Collaboration" position={[2.1,2.98,-10.88]} />
      <Sign text="Creative Studio" position={[11.1,2.98,-10.88]} />
      <Sign text="Meeting" position={[3.55, 2.55, -7.72]} />
      <Sign text="Private" position={[10.1, 2.55, -7.72]} />
      <Sign text="Lounge" position={[3.3, 2.55, 7.72]} rotationY={Math.PI} />
      <Sign text="Storage" position={[11.2, 2.55, 7.72]} rotationY={Math.PI} />
      <BrandPlate position={[plan(-9.5),2.15,plan(7.87)]} width={3.2} rotationY={Math.PI} />
      <Sign text="Workspace" position={[-8.2, 2.55, -7.72]} />
    </group>
  )
}

const floors = new Map<string, Material>()

function floorMaterial(color: string) {
  const existing = floors.get(color)
  if (existing) return existing
  const material = shared(color, 1)
  floors.set(color, material)
  return material
}

function Wall({ box, low = false }: { box: Box; low?: boolean }) {
  const height = low ? 0.55 : WALL
  const { x, z, w, d, glass } = box
  if (x === plan(-13) && z === 0) {
    const trimH = 0.44
    const baseH = 0.72
    const mullionH = height - baseH - trimH
    return <group position={[x,0,z]}>
      <Block at={[0,baseH / 2,0]} size={[0.22,baseH,d]} material={mat.wall} />
      <Block at={[0,height - trimH / 2,0]} size={[0.22,trimH,d]} material={mat.trim} />
      {[-7.8,-4,-0.2,3.6,7.8].map(dz => <Block key={dz} at={[0,baseH + mullionH / 2,plan(dz)]} size={[0.25,mullionH,0.2]} material={mat.wall} />)}
    </group>
  }
  if (glass) {
    const rail = 0.12
    const paneTop = WALL - rail
    const paneBottom = rail
    const paneH = paneTop - paneBottom
    return (
      <group position={[x, 0, z]}>
        <mesh position={[0, paneBottom + paneH / 2, 0]} material={mat.glass}>
          <boxGeometry args={[Math.max(w - 0.08, 0.01), paneH, Math.max(d - 0.08, 0.01)]} />
        </mesh>
        <Block at={[0, WALL - rail / 2, 0]} size={[w, rail, d + (w > d ? 0.04 : 0)]} material={mat.frame} />
        <Block at={[0, rail / 2, 0]} size={[w, rail, d + (w > d ? 0.04 : 0)]} material={mat.frame} />
      </group>
    )
  }
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, (height - 0.08) / 2, 0]} castShadow receiveShadow material={mat.wall}>
        <boxGeometry args={[w, height - 0.08, d]} />
      </mesh>
      <mesh position={[0, height - 0.04, 0]} material={mat.trim}>
        <boxGeometry args={[w + 0.03, 0.08, d + 0.03]} />
      </mesh>
    </group>
  )
}

export function DoorFrame({ door }: { door: Door }) {
  const panels = useRef<Group>(null)
  const id = doorId(door)
  const open = useDoors(state => Boolean(state.open[id]))
  const moving = useDoors(state => Boolean(state.moving[id]))
  const obstructed = useDoors(state => Boolean(state.obstructed[id]))
  const key = useSign('E', '#14161c', '#f3f6fc')
  const light = moving || (open && obstructed) ? mat.doorAmber : open ? mat.doorGreen : mat.trim
  useFrame((_, delta) => {
    advanceDoor(door, delta)
    panels.current?.children.forEach((leaf, index) => { leaf.position.x = leafOffset(door, index === 0 ? -1 : 1) })
  })
  const half = door.w / 2
  const width = leafWidth(door)
  const fit = DOOR_GEOMETRY
  const leafHeight = fit.top - fit.bottom
  const leafY = (fit.top + fit.bottom) / 2
  const trackLength = 2 * (leafOffset(door, 1, 1) + width / 2 + 0.08)
  return <group position={[door.x,0,door.z]} rotation={[0,door.axis === 'z' ? Math.PI / 2 : 0,0]}>
    <Block at={[0,3.2,fit.frameZ]} size={[trackLength,0.16,fit.frameDepth]} material={mat.doorMetal} />
    <Block at={[0,3.29,fit.frameZ]} size={[trackLength+0.04,0.02,fit.frameDepth+0.02]} material={mat.trim} />
    <group ref={panels}>
      {[-1,1].map(sign => <group key={sign} position={[leafOffset(door,sign),0,fit.trackZ]}>
        <mesh position={[0,leafY,0]} material={mat.glass}><boxGeometry args={[width-2*fit.border,leafHeight-2*fit.border,0.04]} /></mesh>
        {[-1,1].map(edge => <Block key={edge} at={[edge*(width-fit.border)/2,leafY,0]} size={[fit.border,leafHeight,fit.leafDepth]} material={mat.doorMetal} />)}
        {[fit.bottom+fit.border/2,fit.top-fit.border/2].map(y => <Block key={y} at={[0,y,0]} size={[width-2*fit.border,fit.border,fit.leafDepth]} material={mat.doorMetal} />)}
        <Block at={[0,0.15,0]} size={[width-0.12,0.12,0.055]} material={mat.frame} />
        <mesh position={[0,1.4,0]} material={mat.doorFrost}><boxGeometry args={[width-0.12,0.38,0.049]} /></mesh>
        {[-1,1].map(side => <group key={side}>
          {[1.1,1.65].map(y => <Block key={y} at={[-sign*(width/2-0.14),y,side*0.067]} size={[0.065,0.045,0.07]} material={mat.doorMetal} />)}
          <Block at={[-sign*(width/2-0.14),1.375,side*0.112]} size={[0.055,0.6,0.04]} material={mat.orange} />
          <BrandPlate position={[sign*0.12,1.41,side*0.032]} width={Math.min(0.9,width-0.5)} rotationY={side === 1 ? 0 : Math.PI} />
        </group>)}
      </group>)}
    </group>
    {[-half,half].map(x => <Block key={x} at={[x,fit.openingHeight/2,fit.frameZ]} size={[fit.jambWidth,fit.openingHeight,fit.frameDepth]} material={mat.doorMetal} />)}
    <Block at={[0,(3.3 + WALL) / 2,0]} size={[door.w,WALL - 3.3,0.18]} material={mat.wall} />
    {[-1,1].map(side => <group key={side}>
      <Block at={[half+0.18,1.45,side === 1 ? 0.4 : -0.15]} size={[0.2,0.36,0.08]} material={mat.doorMetal} />
      <Block at={[half+0.18,1.55,side === 1 ? 0.447 : -0.197]} size={[0.12,0.025,0.012]} material={light} />
      {key && <mesh position={[half+0.18,1.4,side === 1 ? 0.449 : -0.199]} rotation={[0,side === 1 ? 0 : Math.PI,0]}>
        <planeGeometry args={[0.11,0.085]} /><meshBasicMaterial map={key} toneMapped={false} />
      </mesh>}
    </group>)}
  </group>
}

function Windows() {
  const base = 0.78
  const paneH = WALL - 0.44 - base
  return <group>
    {[-5.9,-2.1,1.7,5.7].map(z => <group key={z} position={[-13, base + paneH / 2, z]}>
      <Block at={[0,0,0]} size={[0.06, paneH, 3.6]} material={mat.window} />
      {[-1.8,0,1.8].map(dz => <Block key={dz} at={[0.07,0,dz]} size={[0.1, paneH - 0.08, 0.055]} material={mat.white} />)}
      <Block at={[0.1, -paneH / 2 + 0.05, 0]} size={[0.38,0.1,3.75]} />
      <Block at={[0.06,0.05,0]} size={[0.1,0.05,3.6]} />
    </group>)}
  </group>
}

function City() {
  const blocks: [number, number, number, number][] = [
    [-18.5, -5, 3.2, 5.5],
    [-19, 0.5, 2.4, 3.4],
    [-17.6, 5.5, 2.8, 4.6],
    [18, -2, 2.6, 4],
    [17.4, 4, 3, 6],
  ]
  return (
    <group>
      {blocks.map(([x, z, w, h]) => (
        <mesh key={`${x}-${z}`} position={[plan(x), h / 2, plan(z)]} material={mat.city}>
          <boxGeometry args={[w, h, w * 0.8]} />
        </mesh>
      ))}
    </group>
  )
}

function Pendants() {
  const spots: [number, number][] = [
    [-9,-14.5],
    [-0.5,-14.5],
    [8.5,-14.5],
    [-8.4, 0.4],
    [-4.6, -1.55],
    [3.55, -4],
    [3.2, 4.6],
  ]
  return (
    <group>
      {spots.map(([x, z]) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh position={[0, (WALL + 2.93) / 2, 0]} material={mat.ink}>
            <cylinderGeometry args={[0.015, 0.015, WALL - 2.93, 5]} />
          </mesh>
          <mesh position={[0, 2.88, 0]} material={mat.lamp}>
            <cylinderGeometry args={[0.14, 0.08, 0.1, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Furnish({ prop, boardId }: { prop: Prop; boardId?: string }) {
  switch (prop.kind) {
    case 'desk':
      return <Desk x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'chair':
      return <Chair x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'side':
      return <Chair x={prop.x} z={prop.z} rot={prop.rot ?? 0} orange />
    case 'meet':
      return <Meet x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'plant':
      return <Plant x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'sofa':
      return <Sofa x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'bean':
      return <Bean x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'round':
      return <Round x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'cooler':
      return <Cooler x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'kitchen':
      return <Kitchen x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'fridge':
      return <Fridge x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'books':
      return <Books x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'crates':
      return <Crates x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'server':
      return <Server x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'board':
      return <Board x={prop.x} z={prop.z} rot={prop.rot ?? 0} boardId={boardId} />
    case 'tasks':
      return <Tasks x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'screen':
      return <Screen x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'mat':
      return <Welcome x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'clock':
      return <Clock x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'bin':
      return <Bin x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'chess':
      return <ChessTable x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    case 'xo':
      return <XoTable x={prop.x} z={prop.z} rot={prop.rot ?? 0} />
    default:
      return null
  }
}

function Block({ at, size, material = mat.white }: { at: [number, number, number]; size: [number, number, number]; material?: Material }) {
  return <mesh position={at} material={material} castShadow receiveShadow><boxGeometry args={size} /></mesh>
}

function BrandPlate({ position, width, rotationY = 0 }: { position: [number, number, number]; width: number; rotationY?: number }) {
  const map = useTexture('/branding/corplift-logo.png', texture => { texture.colorSpace = SRGBColorSpace })
  return <mesh position={position} rotation={[0,rotationY,0]}>
    <planeGeometry args={[width,width * 784 / 1952]} />
    <meshBasicMaterial map={map} toneMapped={false} transparent alphaTest={0.05} depthWrite={false} />
  </mesh>
}

function Desk({ x, z, rot }: { x: number; z: number; rot: number }) {
  return <group scale={FURNITURE_SCALE.desk} position={[x, 0, z]} rotation={[0, rot, 0]}>
    {[-0.86, 0.86].map((dx) => <group key={dx} position={[dx, 0, 0]}>
      <Block at={[0, 0.39, 0]} size={[0.48, 0.74, 0.7]} />
      {[0.2, 0.43, 0.65].map(y => <group key={y}>
        <Block at={[0, y, 0.36]} size={[0.43, 0.012, 0.012]} material={mat.trim} />
        <Block at={[0, y + 0.07, 0.37]} size={[0.13, 0.025, 0.025]} material={mat.frame} />
      </group>)}
    </group>)}
    <Block at={[0, 0.82, 0]} size={[2.4, 0.12, 0.96]} material={mat.orange} />
    <Block at={[0, 0.9025, -0.19]} size={[0.34, 0.045, 0.23]} material={mat.ink} />
    <Block at={[0, 1.01, -0.27]} size={[0.07, 0.18, 0.06]} material={mat.frame} />
    <BrandPlate position={[0,1.3,-0.288]} width={0.56} rotationY={Math.PI} />
    <BrandPlate position={[-0.86,0.54,0.385]} width={0.32} />
    <Block at={[0, 1.3, -0.25]} size={[0.84, 0.5, 0.065]} material={mat.ink} />
    <Block at={[0, 1.3, -0.209]} size={[0.74, 0.4, 0.013]} material={mat.screen} />
    <Block at={[-0.18, 1.31, -0.197]} size={[0.24, 0.3, 0.01]} material={mat.blue} />
    {[0,1,2].map(i => <Block key={i} at={[0.15, 1.4-i*0.08, -0.197]} size={[0.28-i*0.05, 0.022, 0.01]} />)}
    <Block at={[0, 0.897, 0.21]} size={[0.58, 0.025, 0.19]} material={mat.trim} />
    {[0,1,2].map(i => <Block key={i} at={[0, 0.913, 0.15+i*0.055]} size={[0.51, 0.005, 0.016]} material={mat.white} />)}
    <Block at={[0.46, 0.897, 0.2]} size={[0.12, 0.03, 0.17]} material={mat.ink} />
    <group position={[-0.92, 0.88, -0.1]} scale={0.25}><Plant x={0} z={0} /></group>
    <mesh position={[0.83, 0.97, 0.16]} material={mat.white} castShadow><cylinderGeometry args={[0.075,0.065,0.18,10]} /></mesh>
    <Block at={[0.82, 0.9, -0.23]} size={[0.35, 0.045, 0.26]} material={mat.blue} />
  </group>
}

function Chair({ x, z, rot, orange = false }: { x: number; z: number; rot: number; orange?: boolean }) {
  const color = orange ? mat.orange : mat.blue
  return <group scale={FURNITURE_SCALE.chair} position={[x,0,z]} rotation={[0,rot,0]}>
    <Block at={[0,0.51,0]} size={[0.61,0.13,0.59]} material={color} />
    <group rotation={[-0.12,0,0]}><Block at={[0,0.91,-0.26]} size={[0.59,0.64,0.13]} material={color} /></group>
    <mesh position={[0,0.28,0]} material={mat.frame}><cylinderGeometry args={[0.045,0.055,0.43,8]} /></mesh>
    {[-1,1].map(side => <group key={side}>
      <Block at={[side*0.34,0.67,0]} size={[0.045,0.28,0.045]} material={mat.frame} />
      <Block at={[side*0.34,0.8,0.04]} size={[0.09,0.055,0.37]} material={mat.ink} />
    </group>)}
    {[0,1,2,3,4].map(i => <group key={i} rotation={[0,i*Math.PI*2/5,0]}>
      <Block at={[0,0.13,0.17]} size={[0.06,0.055,0.36]} material={mat.frame} />
      <mesh position={[0,0.07,0.32]} rotation={[0,0,Math.PI/2]} material={mat.ink}><cylinderGeometry args={[0.065,0.065,0.085,8]} /></mesh>
    </group>)}
  </group>
}

function Meet({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group scale={FURNITURE_SCALE.meet} position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Block at={[-0.7,0.83,0]} size={[0.4,0.03,0.3]} />
      <Block at={[0.65,0.83,0.2]} size={[0.38,0.035,0.28]} material={mat.blue} />
      <group position={[0,0.81,0]} scale={0.22}><Plant x={0} z={0} /></group>
      <mesh position={[0, 0.74, 0]} material={mat.orange} castShadow receiveShadow>
        <boxGeometry args={[3.8, 0.12, 1.5]} />
      </mesh>
      {[
        [-1.15, -0.45],
        [1.15, -0.45],
        [-1.15, 0.45],
        [1.15, 0.45],
      ].map(([lx, lz]) => (
        <mesh key={`${lx}-${lz}`} position={[lx, 0.36, lz]} material={mat.white} castShadow>
          <boxGeometry args={[0.08, 0.72, 0.08]} />
        </mesh>
      ))}
    </group>
  )
}

function Plant({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  return <group position={[x,0,z]} rotation={[0,rot,0]}>
    <mesh position={[0,0.27,0]} material={mat.white} castShadow><cylinderGeometry args={[0.27,0.2,0.5,5]} /></mesh>
    <mesh position={[0,0.525,0]} material={mat.ink}><cylinderGeometry args={[0.235,0.235,0.015,5]} /></mesh>
    {[0,1,2,3,4,5,6,7,8].map(i => <group key={i} rotation={[0,i*2.4,0]}>
      <mesh position={[0,0.83,0.1]} rotation={[0.32,0,0]} material={mat.green}><cylinderGeometry args={[0.018,0.022,0.65,5]} /></mesh>
      <mesh position={[0,0.96+(i%3)*0.14,0.19]} rotation={[0.45+(i%3)*0.15,0,0]} scale={[0.13,0.4,0.09]} material={i%2 ? mat.leaf : mat.green} castShadow><icosahedronGeometry args={[1,0]} /></mesh>
    </group>)}
  </group>
}

function Sofa({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      {[-0.48,0.48].map(dx => <Block key={dx} at={[dx,0.51,0.07]} size={[0.89,0.14,0.56]} material={mat.orange} />)}
      {[-0.82,0.82].flatMap(dx => [-0.22,0.28].map(dz => <Block key={`${dx}-${dz}`} at={[dx,0.12,dz]} size={[0.09,0.24,0.09]} material={mat.wood} />))}
      <mesh position={[0, 0.32, 0.05]} material={mat.sofa} castShadow>
        <boxGeometry args={[2.05, 0.28, 0.72]} />
      </mesh>
      <mesh position={[0, 0.62, -0.26]} material={mat.sofa} castShadow>
        <boxGeometry args={[2.05, 0.46, 0.16]} />
      </mesh>
      <mesh position={[-0.96, 0.48, 0.05]} material={mat.sofa}>
        <boxGeometry args={[0.14, 0.32, 0.72]} />
      </mesh>
      <mesh position={[0.96, 0.48, 0.05]} material={mat.sofa}>
        <boxGeometry args={[0.14, 0.32, 0.72]} />
      </mesh>
    </group>
  )
}

function Bean({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.33, 0]} scale={[1.08, 0.7, 0.86]} material={mat.bean} castShadow>
        <sphereGeometry args={[0.52, 9, 6]} />
      </mesh>
    </group>
  )
}

function Round({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group scale={FURNITURE_SCALE.round} position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.48, 0]} material={mat.wood} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.06, 8]} />
      </mesh>
      <mesh position={[0.1, 0.53, 0.18]} material={mat.blue} castShadow>
        <boxGeometry args={[0.2, 0.035, 0.14]} />
      </mesh>
      <mesh position={[0, 0.24, 0]} material={mat.white}>
        <cylinderGeometry args={[0.04, 0.04, 0.42, 5]} />
      </mesh>
    </group>
  )
}

function ChessTable({ x, z, rot }: { x: number; z: number; rot: number }) {
  const board = 0.96
  const cell = board / 8
  const origin = -board / 2 + cell / 2
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'] as const
  const men: { kind: (typeof back)[number] | 'p'; white: boolean; file: number; rank: number }[] = []
  for (let file = 0; file < 8; file++) {
    men.push({ kind: back[file], white: true, file, rank: 0 })
    men.push({ kind: 'p', white: true, file, rank: 1 })
    men.push({ kind: 'p', white: false, file, rank: 6 })
    men.push({ kind: back[file], white: false, file, rank: 7 })
  }
  return (
    <group scale={FURNITURE_SCALE.chess} position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Block at={[0, 0.68, 0]} size={[1.24, 0.08, 1.24]} material={mat.wood} />
      {[-0.5, 0.5].flatMap((lx) =>
        [-0.5, 0.5].map((lz) => <Block key={`${lx}-${lz}`} at={[lx, 0.32, lz]} size={[0.08, 0.64, 0.08]} material={mat.white} />),
      )}
      {Array.from({ length: 64 }, (_, index) => {
        const file = index % 8
        const rank = Math.floor(index / 8)
        const light = (file + rank) % 2 === 1
        return (
          <Block
            key={index}
            at={[origin + file * cell, 0.73, origin + rank * cell]}
            size={[cell * 0.96, 0.018, cell * 0.96]}
            material={light ? mat.chessLight : mat.chessDark}
          />
        )
      })}
      {men.map((man) => (
        <ChessMan key={`${man.file}-${man.rank}`} kind={man.kind} white={man.white} x={origin + man.file * cell} z={origin + man.rank * cell} />
      ))}
    </group>
  )
}

function XoTable({ x, z, rot }: { x: number; z: number; rot: number }) {
  const board = 0.84
  const cell = board / 3
  const origin = -board / 2 + cell / 2
  return (
    <group scale={FURNITURE_SCALE.xo} position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Block at={[0, 0.68, 0]} size={[1.2, 0.08, 1.2]} material={mat.wood} />
      {[-0.46, 0.46].flatMap((lx) =>
        [-0.46, 0.46].map((lz) => <Block key={`${lx}-${lz}`} at={[lx, 0.32, lz]} size={[0.08, 0.64, 0.08]} material={mat.white} />),
      )}
      {Array.from({ length: 9 }, (_, index) => {
        const file = index % 3
        const rank = Math.floor(index / 3)
        return (
          <Block
            key={index}
            at={[origin + file * cell, 0.73, origin + rank * cell]}
            size={[cell * 0.9, 0.02, cell * 0.9]}
            material={(file + rank) % 2 === 0 ? mat.chessLight : mat.chessDark}
          />
        )
      })}
      <group position={[origin, 0.76, origin + cell]} rotation={[0, Math.PI / 4, 0]}>
        <Block at={[0, 0, 0]} size={[0.16, 0.02, 0.03]} material={mat.xoX} />
        <Block at={[0, 0, 0]} size={[0.03, 0.02, 0.16]} material={mat.xoX} />
      </group>
      <mesh position={[origin + cell * 2, 0.76, origin + cell * 2]} rotation={[-Math.PI / 2, 0, 0]} material={mat.xoO}>
        <torusGeometry args={[0.07, 0.018, 6, 10]} />
      </mesh>
    </group>
  )
}

function ChessMan({ kind, white, x, z }: { kind: 'k' | 'q' | 'r' | 'b' | 'n' | 'p'; white: boolean; x: number; z: number }) {
  const material = white ? mat.chessWhite : mat.chessBlack
  const y = 0.76
  if (kind === 'p') {
    return (
      <group position={[x, y, z]}>
        <mesh position={[0, 0.035, 0]} material={material} castShadow><cylinderGeometry args={[0.026, 0.032, 0.05, 6]} /></mesh>
        <mesh position={[0, 0.075, 0]} material={material} castShadow><cylinderGeometry args={[0.02, 0.02, 0.028, 6]} /></mesh>
      </group>
    )
  }
  if (kind === 'r') {
    return (
      <group position={[x, y, z]}>
        <mesh position={[0, 0.05, 0]} material={material} castShadow><cylinderGeometry args={[0.028, 0.034, 0.08, 6]} /></mesh>
        <Block at={[0, 0.1, 0]} size={[0.06, 0.02, 0.06]} material={material} />
      </group>
    )
  }
  if (kind === 'n') {
    return (
      <group position={[x, y, z]} rotation={[0, white ? 0.4 : -0.4, 0]}>
        <mesh position={[0, 0.03, 0]} material={material} castShadow><cylinderGeometry args={[0.028, 0.032, 0.04, 6]} /></mesh>
        <mesh position={[0.01, 0.08, 0.01]} rotation={[0.5, 0, 0.2]} material={material} castShadow><boxGeometry args={[0.03, 0.07, 0.045]} /></mesh>
      </group>
    )
  }
  if (kind === 'b') {
    return (
      <group position={[x, y, z]}>
        <mesh position={[0, 0.055, 0]} material={material} castShadow><cylinderGeometry args={[0.02, 0.032, 0.09, 6]} /></mesh>
        <mesh position={[0, 0.11, 0]} material={material} castShadow><cylinderGeometry args={[0.016, 0.016, 0.02, 6]} /></mesh>
      </group>
    )
  }
  if (kind === 'q') {
    return (
      <group position={[x, y, z]}>
        <mesh position={[0, 0.06, 0]} material={material} castShadow><cylinderGeometry args={[0.022, 0.034, 0.1, 6]} /></mesh>
        <mesh position={[0, 0.12, 0]} material={material} castShadow><cylinderGeometry args={[0.012, 0.02, 0.03, 5]} /></mesh>
      </group>
    )
  }
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.06, 0]} material={material} castShadow><cylinderGeometry args={[0.024, 0.034, 0.1, 6]} /></mesh>
      <Block at={[0, 0.125, 0]} size={[0.012, 0.04, 0.012]} material={material} />
      <Block at={[0, 0.14, 0]} size={[0.034, 0.012, 0.012]} material={material} />
    </group>
  )
}

function Cooler({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.55, 0]} material={mat.white} castShadow>
        <boxGeometry args={[0.38, 1.05, 0.36]} />
      </mesh>
      <mesh position={[0, 0.85, 0.2]} material={mat.blue} castShadow>
        <boxGeometry args={[0.1, 0.16, 0.06]} />
      </mesh>
    </group>
  )
}

function Kitchen({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.55, 0]} material={mat.white} castShadow>
        <boxGeometry args={[2.4, 1.05, 0.5]} />
      </mesh>
      <mesh position={[0, 1.1, 0]} material={mat.wood}>
        <boxGeometry args={[2.46, 0.06, 0.56]} />
      </mesh>
    </group>
  )
}

function Fridge({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.85, 0]} material={mat.white} castShadow>
        <boxGeometry args={[0.58, 1.65, 0.5]} />
      </mesh>
      <mesh position={[0.22, 1.05, 0.26]} material={mat.frame}>
        <boxGeometry args={[0.04, 0.7, 0.04]} />
      </mesh>
    </group>
  )
}

function Books({ x, z, rot }: { x: number; z: number; rot: number }) {
  return <group position={[x,0,z]} rotation={[0,rot,0]}>
    <Block at={[0,1.05,-0.16]} size={[1.15,2.1,0.05]} material={mat.trim} />
    {[-0.55,0.55].map(dx => <Block key={dx} at={[dx,1.05,0]} size={[0.08,2.1,0.38]} />)}
    {[0.07,0.72,1.37,2.05].map(y => <Block key={y} at={[0,y,0]} size={[1.15,0.07,0.4]} />)}
    {[0,1,2].map(row => <group key={row}>
      {[0,1,2,3,4].map(i => <Block key={i} at={[-0.4+i*0.17,0.32+row*0.65,0]} size={[0.11,0.4+(i%2)*0.1,0.25]} material={[mat.blue,mat.orange,mat.white,mat.green,mat.noteRed][(i+row)%5]} />)}
    </group>)}
  </group>
}

function Crates({ x, z, rot }: { x: number; z: number; rot: number }) {
  return <group position={[x,0,z]} rotation={[0,rot,0]}>
    {[-0.66,0.66].flatMap(dx => [-0.2,0.2].map(dz => <Block key={`${dx}-${dz}`} at={[dx,1, dz]} size={[0.065,2,0.065]} material={mat.frame} />))}
    {[0.1,0.7,1.3,1.92].map((y,i) => <group key={y}>
      <Block at={[0,y,0]} size={[1.45,0.08,0.5]} material={mat.wood} />
      {i<3 && [-0.35,0.3].map(dx => <group key={dx}>
        <Block at={[dx,y+0.24,0]} size={[0.48,0.39,0.36]} material={i%2 ? mat.white : mat.crate} />
        <Block at={[dx,y+0.27,0.19]} size={[0.2,0.09,0.01]} />
      </group>)}
    </group>)}
  </group>
}

function Server({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.9, 0]} material={mat.server} castShadow>
        <boxGeometry args={[0.58, 1.75, 0.42]} />
      </mesh>
      <BrandPlate position={[0,1.57,0.237]} width={0.44} />
      {[0.5, 0.9, 1.3].map((y) => (
        <mesh key={y} position={[0, y, 0.225]} material={mat.screen}>
          <boxGeometry args={[0.4, 0.06, 0.02]} />
        </mesh>
      ))}
    </group>
  )
}

function Board({ x, z, rot, boardId }: { x: number; z: number; rot: number; boardId?: string }) {
  const liveId = boardId ?? officeBoardAt(x, z)?.id
  return (
    <group position={[x, liveId ? 1.92 : 1.7, z]} rotation={[0, rot, 0]}>
      <mesh material={mat.frame}>
        <boxGeometry args={liveId ? [2.4, 1.55, 0.05] : [1.5, 1.05, 0.04]} />
      </mesh>
      {liveId ? (
        <TaskSurface boardId={liveId} width={2.22} height={1.38} />
      ) : (
        <>
          <mesh position={[0, 0, 0.03]} material={mat.white}>
            <boxGeometry args={[1.34, 0.9, 0.02]} />
          </mesh>
          <mesh position={[-0.3, 0.15, 0.05]} material={mat.note}>
            <boxGeometry args={[0.18, 0.16, 0.02]} />
          </mesh>
          <mesh position={[0.05, -0.05, 0.05]} material={mat.noteRed}>
            <boxGeometry args={[0.16, 0.14, 0.02]} />
          </mesh>
        </>
      )}
    </group>
  )
}

function Tasks({ x, z, rot }: { x: number; z: number; rot: number }) {
  const live = officeBoardAt(x, z)
  return (
    <group position={[x, live ? 1.92 : 1.65, z]} rotation={[0, rot, 0]}>
      <mesh material={mat.ink}>
        <boxGeometry args={live ? [2.4, 1.55, 0.05] : [1.15, 0.9, 0.04]} />
      </mesh>
      {live ? (
        <TaskSurface boardId={live.id} width={2.22} height={1.38} />
      ) : (
        <>
          <mesh position={[-0.28, 0.12, 0.04]} material={mat.noteRed}>
            <boxGeometry args={[0.22, 0.18, 0.02]} />
          </mesh>
          <mesh position={[0.05, 0.18, 0.04]} material={mat.note}>
            <boxGeometry args={[0.2, 0.16, 0.02]} />
          </mesh>
          <mesh position={[0.28, -0.08, 0.04]} material={mat.noteGreen}>
            <boxGeometry args={[0.2, 0.16, 0.02]} />
          </mesh>
        </>
      )}
    </group>
  )
}

function Screen({ x, z, rot }: { x: number; z: number; rot: number }) {
  const picture = useScreenPicture(x, z)
  return (
    <group scale={[1.35, 1.35, 1]} position={[x, 2.05, z]} rotation={[0, rot, 0]}>
      <mesh material={mat.ink}>
        <boxGeometry args={[1.6, 0.95, 0.05]} />
      </mesh>
      {picture ? (
        <FeedPlane track={picture.track} width={1.42} height={0.78} position={[0, 0, 0.04]} />
      ) : (
        <mesh position={[0, 0, 0.03]} material={mat.screen}>
          <boxGeometry args={[1.42, 0.78, 0.02]} />
        </mesh>
      )}
    </group>
  )
}

function Welcome({ x, z, rot }: { x: number; z: number; rot: number }) {
  const map = useSign('WELCOME', '#ffffff', '#14161c')
  return (
    <group position={[x, 0.05, z]} rotation={[0, rot, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={mat.rug} receiveShadow>
        <planeGeometry args={[1.7, 1]} />
      </mesh>
      {map ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[1.15, 0.28]} />
          <meshBasicMaterial map={map} toneMapped={false} transparent alphaTest={0.05} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}

function Clock({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 1.7, z]} rotation={[0, rot, 0]}>
      <Block at={[0,0.075,0.081]} size={[0.016,0.15,0.012]} material={mat.ink} />
      <Block at={[0.05,0,0.066]} size={[0.1,0.018,0.012]} material={mat.ink} />
      <mesh rotation={[Math.PI / 2, 0, 0]} material={mat.frame}>
        <cylinderGeometry args={[0.28, 0.28, 0.06, 12]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.045]} material={mat.white}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 12]} />
      </mesh>
    </group>
  )
}

function Bin({ x, z, rot }: { x: number; z: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.28, 0]} material={mat.ink} castShadow>
        <cylinderGeometry args={[0.16, 0.14, 0.5, 6]} />
      </mesh>
      <mesh position={[0, 0.34, 0.15]} material={mat.white}>
        <boxGeometry args={[0.08, 0.1, 0.02]} />
      </mesh>
    </group>
  )
}

function glassFace(x: number, z: number) {
  let best: { x: number; z: number; length: number; horizontal: boolean; across: number } | null = null
  for (const wall of walls) {
    if (!wall.glass) continue
    const horizontal = wall.w > wall.d
    const along = horizontal ? x - wall.x : z - wall.z
    const across = Math.abs(horizontal ? z - wall.z : x - wall.x)
    const length = horizontal ? wall.w : wall.d
    if (Math.abs(along) > length / 2 || across > 0.55) continue
    if (best && across >= best.across) continue
    best = { x: wall.x, z: wall.z, length, horizontal, across }
  }
  return best
}

function Sign({
  text,
  position,
  rotationY = 0,
}: {
  text: string
  position: [number, number, number]
  rotationY?: number
}) {
  const x = plan(position[0])
  const z = plan(position[2])
  const face = glassFace(x, z)
  const height = 0.32
  const width = Math.min(Math.max(1.2, text.length * 0.155), face ? Math.max(1.15, face.length - 0.46) : 2.35)
  const map = useSign(text, '#000000', '#ffffff', width / height)
  if (!map) return null
  const placeX = face?.horizontal ? face.x : x
  const placeY = face ? 2.98 : position[1]
  const placeZ = face && !face.horizontal ? face.z : z
  return (
    <mesh position={[placeX, placeY, placeZ]} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  )
}

function useSign(label: string, ink = '#000000', paper = '#ffffff', aspect = 4) {
  const [map, setMap] = useState<CanvasTexture | null>(null)
  useEffect(() => {
    let active = true
    let texture: CanvasTexture | null = null
    const draw = () => {
      if (!active) return
      const canvas = document.createElement('canvas')
      const width = 1024
      const height = Math.max(128, Math.round(width / aspect))
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) return
      context.fillStyle = paper
      context.fillRect(0, 0, width, height)
      context.fillStyle = ink
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const family = '"Thmanyah Sans", system-ui, sans-serif'
      const limit = width - 96
      let size = Math.floor(height * 0.62)
      context.font = `900 ${size}px ${family}`
      while (size > 28 && context.measureText(label).width > limit) {
        size -= 2
        context.font = `900 ${size}px ${family}`
      }
      context.fillText(label, width / 2, height / 2)
      texture = new CanvasTexture(canvas)
      texture.colorSpace = SRGBColorSpace
      texture.needsUpdate = true
      setMap(texture)
    }
    void document.fonts.ready.then(draw)
    return () => {
      active = false
      texture?.dispose()
    }
  }, [aspect, ink, label, paper])
  return map
}
