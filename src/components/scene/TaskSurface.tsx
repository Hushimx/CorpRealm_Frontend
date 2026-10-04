import { useEffect, useRef, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { seedBoard, useTaskStore, type TaskBoardData } from '../../store/tasks'

const PAPER = '#ffffff'
const CREAM = '#f3f6fc'
const INK = '#000000'
const MUTED = '#5c5c5c'

export function TaskSurface({ boardId, width, height }: { boardId: string; width: number; height: number }) {
  const saved = useTaskStore((state) => state.boards[boardId])
  const ensure = useTaskStore((state) => state.ensure)
  const data = saved ?? seedBoard(boardId)
  const map = useBoardTexture(data)

  useEffect(() => {
    ensure(boardId)
  }, [boardId, ensure])

  return (
    <mesh position={[0, 0, 0.045]} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={map ?? undefined} color={map ? '#ffffff' : PAPER} roughness={0.9} metalness={0} />
    </mesh>
  )
}

function useBoardTexture(data: TaskBoardData) {
  const [map, setMap] = useState<CanvasTexture | null>(null)
  const texture = useRef<CanvasTexture | null>(null)
  const signature = JSON.stringify(data)

  useEffect(() => {
    let alive = true
    const paint = () => {
      if (!alive) return
      const next = new CanvasTexture(paintBoard(data))
      next.colorSpace = SRGBColorSpace
      next.anisotropy = 8
      next.needsUpdate = true
      texture.current?.dispose()
      texture.current = next
      setMap(next)
    }
    paint()
    void document.fonts.ready.then(paint)
    return () => {
      alive = false
      texture.current?.dispose()
      texture.current = null
    }
  }, [signature])

  return map
}

function paintBoard(data: TaskBoardData) {
  const canvas = document.createElement('canvas')
  canvas.width = 1800
  canvas.height = 1110
  const context = canvas.getContext('2d')
  if (!context) return canvas
  context.fillStyle = PAPER
  context.fillRect(0, 0, canvas.width, canvas.height)

  const columns = data.columns.slice(0, 8)
  const pad = 28
  const gap = 16
  const count = Math.max(columns.length, 1)
  const colW = (canvas.width - pad * 2 - gap * (count - 1)) / count
  const colH = canvas.height - pad * 2
  const titleSize = Math.round(Math.max(26, Math.min(44, colW * 0.1)))
  const cardTitle = Math.round(Math.max(22, Math.min(36, colW * 0.078)))
  const detailSize = Math.round(Math.max(18, Math.min(26, colW * 0.055)))

  columns.forEach((column, index) => {
    const x = pad + index * (colW + gap)
    const y = pad
    roundRect(context, x, y, colW, colH, 28)
    context.fillStyle = CREAM
    context.fill()

    context.fillStyle = INK
    context.font = `700 ${titleSize}px "Thmanyah Sans", system-ui, sans-serif`
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    const header = fit(context, column.title, colW - 110)
    context.fillText(header, x + 22, y + 46)

    const cards = column.cardIds.map((id) => data.cards[id]).filter((card) => card !== undefined)
    const badge = String(cards.length)
    context.font = `700 ${Math.max(18, titleSize - 10)}px "Thmanyah Sans", system-ui, sans-serif`
    const badgeW = Math.max(42, context.measureText(badge).width + 22)
    roundRect(context, x + colW - badgeW - 18, y + 26, badgeW, 40, 20)
    context.fillStyle = PAPER
    context.fill()
    context.fillStyle = INK
    context.textAlign = 'center'
    context.fillText(badge, x + colW - badgeW / 2 - 18, y + 46)

    const cardTop = y + 92
    const cardH = cardTitle + detailSize + 36
    const room = colH - 108
    const slots = Math.max(1, Math.floor(room / (cardH + 12)))
    if (cards.length === 0) {
      context.fillStyle = MUTED
      context.font = `500 ${detailSize}px "Thmanyah Sans", system-ui, sans-serif`
      context.textAlign = 'left'
      context.fillText('Nothing here yet.', x + 22, cardTop + 16)
      return
    }

    const extra = Math.max(0, cards.length - slots)
    const shown = cards.slice(0, extra > 0 ? Math.max(1, slots - 1) : slots)
    const hidden = cards.length - shown.length
    shown.forEach((card, cardIndex) => {
      const cy = cardTop + cardIndex * (cardH + 12)
      roundRect(context, x + 14, cy, colW - 28, cardH, 16)
      context.fillStyle = PAPER
      context.fill()
      context.textAlign = 'left'
      context.fillStyle = INK
      context.font = `700 ${cardTitle}px "Thmanyah Sans", system-ui, sans-serif`
      context.fillText(fit(context, card.title, colW - 58), x + 30, cy + cardTitle * 0.7 + 8)
      if (card.detail) {
        context.fillStyle = MUTED
        context.font = `500 ${detailSize}px "Thmanyah Sans", system-ui, sans-serif`
        context.fillText(fit(context, card.detail, colW - 58), x + 30, cy + cardTitle + detailSize + 10)
      }
    })
    if (hidden > 0) {
      const cy = cardTop + shown.length * (cardH + 12) + 8
      context.fillStyle = INK
      context.font = `700 ${detailSize}px "Thmanyah Sans", system-ui, sans-serif`
      context.textAlign = 'left'
      context.fillText(`+${hidden} more`, x + 22, cy)
    }
  })

  return canvas
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

function fit(context: CanvasRenderingContext2D, text: string, max: number) {
  if (context.measureText(text).width <= max) return text
  let cut = text
  while (cut.length > 1 && context.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1)
  return `${cut}…`
}
