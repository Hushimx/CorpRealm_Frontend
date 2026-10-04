import { skinUrl, type AvatarParts, type SkinId } from './parts'

const SIZE = 1024

const REGIONS = {
  torso: { x: 0, y: 660, w: 455, h: 364 },
  arms: { x: 460, y: 500, w: 564, h: 280 },
  legs: { x: 460, y: 785, w: 564, h: 239 },
} as const

const cache = new Map<SkinId, Promise<HTMLImageElement>>()

function loadSkin(id: SkinId) {
  const cached = cache.get(id)
  if (cached) return cached
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load skin ${id}`))
    image.src = skinUrl(id)
  })
  cache.set(id, pending)
  return pending
}

function blit(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  region: { x: number; y: number; w: number; h: number },
) {
  context.drawImage(image, region.x, region.y, region.w, region.h, region.x, region.y, region.w, region.h)
}

export async function paintAvatar(canvas: HTMLCanvasElement, parts: AvatarParts) {
  const [face, outfit, pants] = await Promise.all([
    loadSkin(parts.face),
    loadSkin(parts.outfit),
    loadSkin(parts.pants),
  ])
  const context = canvas.getContext('2d')
  if (!context) return
  if (canvas.width !== SIZE) canvas.width = SIZE
  if (canvas.height !== SIZE) canvas.height = SIZE
  context.clearRect(0, 0, SIZE, SIZE)
  context.drawImage(face, 0, 0, SIZE, SIZE)
  blit(context, outfit, REGIONS.torso)
  blit(context, outfit, REGIONS.arms)
  blit(context, pants, REGIONS.legs)
}
