export const SKINS = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
] as const

export type SkinId = (typeof SKINS)[number]

export interface AvatarParts {
  face: SkinId
  outfit: SkinId
  pants: SkinId
}

export const POSES = [
  { id: 'idle', label: 'Idle' },
  { id: 'walk', label: 'Walk' },
  { id: 'sit', label: 'Sit' },
  { id: 'emote-yes', label: 'Yes' },
  { id: 'emote-no', label: 'No' },
] as const

export type PoseId = (typeof POSES)[number]['id']

export function skinUrl(id: SkinId) {
  return `/avatars/Textures/texture-${id}.png`
}

const ATLAS = 1024

// Square windows on the Kenney atlas. The face window is centered on the front of the head.
export const SKIN_CROPS = {
  head: { x: 118, y: 148, size: 150 },
  outfit: { x: 90, y: 805, size: 155 },
  pants: { x: 560, y: 868, size: 125 },
} as const

export function skinCropStyle(crop: keyof typeof SKIN_CROPS, id: SkinId) {
  const box = SKIN_CROPS[crop]
  const zoom = (ATLAS / box.size) * 100
  const place = (origin: number) => (origin / (ATLAS - box.size)) * 100
  return {
    backgroundImage: `url(${skinUrl(id)})`,
    backgroundRepeat: 'no-repeat' as const,
    backgroundSize: `${zoom}% ${zoom}%`,
    backgroundPosition: `${place(box.x)}% ${place(box.y)}%`,
  }
}

export function randomSkin() {
  return SKINS[Math.floor(Math.random() * SKINS.length)] ?? 'a'
}
