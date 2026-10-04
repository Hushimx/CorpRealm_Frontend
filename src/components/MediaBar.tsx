import { useEffect, useRef } from 'react'
import type { OfficeMedia } from '../net/media'

const off = 'rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40'
const on = 'rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper disabled:opacity-40'

export function MediaBar({ media }: { media: OfficeMedia }) {
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={media.camera} disabled={!media.ready} onClick={() => void media.toggleCamera()} className={media.camera ? on : off}>
          Camera
        </button>
        <button type="button" aria-pressed={media.sharing} disabled={!media.ready} onClick={() => void media.toggleShare()} className={media.sharing ? on : off}>
          Screen
        </button>
      </div>
      {media.sharing ? <p className="mt-1 text-xs text-ink/60">Your screen is on the office screens.</p> : null}
      <Preview track={media.localCamera} />
    </div>
  )
}

function Preview({ track }: { track: OfficeMedia['localCamera'] }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = video.current
    if (!element || !track) return
    track.attach(element)
    return () => {
      track.detach(element)
    }
  }, [track])
  if (!track) return null
  return <video ref={video} muted autoPlay playsInline className="mt-2 h-16 w-full rounded-xl bg-ink object-cover" />
}
