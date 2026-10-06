import type { OfficeMedia } from '../net/media'

const off = 'rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-40'
const on = 'rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper disabled:opacity-40'

export function MediaBar({ media }: { media: OfficeMedia }) {
  return (
    <div className="mt-3">
      <button type="button" aria-pressed={media.sharing} disabled={!media.ready} onClick={() => void media.toggleShare()} className={media.sharing ? on : off}>
        {media.sharing ? 'Stop sharing' : 'Share screen'}
      </button>
      {media.sharing ? <p className="mt-1 text-xs text-ink/60">Your screen is on the office screens.</p> : null}
    </div>
  )
}
