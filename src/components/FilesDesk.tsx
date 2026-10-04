import { useEffect, useRef, useState } from 'react'
import { ApiError, api } from '../net/api'

type Folder = { id: string; name: string }
type OfficeFile = {
  id: string
  name: string
  mime: string
  size: number
  createdAt: string
  folderId: string | null
  authorId: string
  authorName: string
  canDelete: boolean
}

export function FilesDesk({ officeId, onClose }: { officeId: string; onClose: () => void }) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<OfficeFile[]>([])
  const [folderId, setFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [folderName, setFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const folder = folders.find((item) => item.id === folderId) ?? null
  const shown = files.filter((file) => file.name.toLowerCase().includes(query.trim().toLowerCase()))

  useEffect(() => {
    let closed = false
    const load = () => {
      const path = folderId ? `/offices/${officeId}/files?folder=${encodeURIComponent(folderId)}` : `/offices/${officeId}/files`
      void api<{ folders: Folder[]; files: OfficeFile[] }>(path)
        .then((next) => {
          if (closed) return
          setFolders(next.folders)
          setFiles(next.files)
          setError('')
        })
        .catch((reason: unknown) => {
          if (!closed) setError(reason instanceof ApiError ? reason.message : 'Files could not be loaded.')
        })
    }
    load()
    const timer = window.setInterval(load, 5000)
    return () => {
      closed = true
      window.clearInterval(timer)
    }
  }, [officeId, folderId])

  async function createFolder() {
    try {
      const created = await api<Folder>(`/offices/${officeId}/files/folders`, { method: 'POST', body: JSON.stringify({ name: folderName }) })
      setFolders((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
      setFolderName('')
      setCreating(false)
      setFolderId(created.id)
      setError('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The folder could not be created.')
    }
  }

  async function upload(list: FileList | File[]) {
    const queue = [...list]
    if (queue.length === 0) return
    setBusy(true)
    try {
      for (const file of queue) {
        const body = new FormData()
        body.set('file', file)
        if (folderId) body.set('folderId', folderId)
        const response = await fetch(`/api/offices/${officeId}/files`, { method: 'POST', body, credentials: 'include' })
        if (!response.ok) throw new ApiError(response.status, await readMessage(response))
        const saved = (await response.json()) as OfficeFile
        setFiles((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
      }
      setError('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The upload did not finish.')
    } finally {
      setBusy(false)
    }
  }

  async function download(file: OfficeFile) {
    try {
      const response = await fetch(`/api/offices/${officeId}/files/${file.id}`, { credentials: 'include' })
      if (!response.ok) throw new ApiError(response.status, await readMessage(response))
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      URL.revokeObjectURL(url)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The download did not finish.')
    }
  }

  async function removeFile(file: OfficeFile) {
    try {
      await api(`/offices/${officeId}/files/${file.id}`, { method: 'DELETE' })
      setFiles((current) => current.filter((item) => item.id !== file.id))
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The file could not be deleted.')
    }
  }

  async function moveFile(file: OfficeFile, nextFolder: string) {
    try {
      await api(`/offices/${officeId}/files/${file.id}`, { method: 'PATCH', body: JSON.stringify({ folderId: nextFolder || null }) })
      setFiles((current) => current.filter((item) => item.id !== file.id))
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The file could not be moved.')
    }
  }

  async function removeFolder() {
    if (!folder) return
    try {
      await api(`/offices/${officeId}/files/folders/${folder.id}`, { method: 'DELETE' })
      setFolders((current) => current.filter((item) => item.id !== folder.id))
      setFolderId(null)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'The folder could not be deleted.')
    }
  }

  return (
    <section className="absolute top-16 right-3 bottom-4 left-28 z-10 flex flex-col overflow-hidden rounded-card bg-paper text-ink shadow-card sm:right-4 sm:left-32">
      <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-4 py-3">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">Files</p>
          <h2 className="font-bold text-3xl leading-none">{folder ? folder.name : 'Office files'}</h2>
          <p className="mt-1 text-xs text-ink/60">Shared uploads for this office. Up to 12 MB each.</p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
          Close
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 px-3 py-2">
        <button type="button" onClick={() => setFolderId(null)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${folderId ? 'bg-frost text-ink' : 'bg-ink text-paper'}`}>
          Main
        </button>
        {folders.map((item) => (
          <button key={item.id} type="button" onClick={() => setFolderId(item.id)} className={`max-w-40 truncate rounded-full px-3 py-1.5 text-xs font-bold ${folderId === item.id ? 'bg-ink text-paper' : 'bg-frost text-ink'}`}>
            {item.name}
          </button>
        ))}
        {creating ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void createFolder()
            }}
          >
            <input
              autoFocus
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="Folder name"
              className="rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-xs text-ink outline-none placeholder:text-ink/40"
            />
          </form>
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="rounded-full bg-mist px-3 py-1.5 text-xs font-bold text-ink">
            New folder
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 px-3 py-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search this folder"
          className="min-w-0 flex-1 rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
        />
        <button type="button" onClick={() => input.current?.click()} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        {folder ? (
          <button type="button" onClick={() => void removeFolder()} className="text-xs font-medium text-danger">
            Delete folder
          </button>
        ) : null}
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const list = event.target.files
            if (list) void upload(list)
            event.target.value = ''
          }}
        />
      </div>
      {error ? <p className="px-4 py-2 text-sm font-medium text-danger">{error}</p> : null}
      <div
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-paper p-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          void upload(event.dataTransfer.files)
        }}
      >
        {shown.length === 0 ? <p className="rounded-card border border-line bg-mist px-4 py-6 text-sm text-ink">Nothing in this folder yet. Upload a file, or drop it here.</p> : null}
        {shown.map((file) => (
          <article key={file.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper px-3 py-2 text-ink">
            <FileMark officeId={officeId} file={file} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{file.name}</p>
              <p className="text-xs text-ink/60">{formatSize(file.size)} · {file.authorName} · {new Date(file.createdAt).toLocaleDateString()}</p>
            </div>
            <select
              value={file.folderId ?? ''}
              onChange={(event) => void moveFile(file, event.target.value)}
              aria-label={`Move ${file.name}`}
              className="rounded-xl border border-ink/15 bg-paper px-2 py-1 text-xs text-ink outline-none"
            >
              <option value="">Main folder</option>
              {folders.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => void download(file)} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
              Download
            </button>
            {file.canDelete ? (
              <button type="button" onClick={() => void removeFile(file)} className="text-xs font-medium text-danger">
                Delete
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function FileMark({ officeId, file }: { officeId: string; file: OfficeFile }) {
  const [broken, setBroken] = useState(false)
  if (file.mime.startsWith('image/') && !broken) {
    return <img src={`/api/offices/${officeId}/files/${file.id}?inline=1`} alt="" onError={() => setBroken(true)} className="h-10 w-10 rounded-xl bg-mist object-cover" />
  }
  return <span className="grid h-10 w-10 place-items-center rounded-xl bg-frost text-[10px] font-bold text-ink">{kindLabel(file.mime)}</span>
}

async function readMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: string | string[] }
    if (Array.isArray(body.message)) return body.message.join(' ')
    if (body.message) return body.message
  } catch {
    return response.statusText
  }
  return response.statusText
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function kindLabel(mime: string) {
  if (mime.includes('pdf')) return 'PDF'
  if (mime.includes('zip')) return 'ZIP'
  if (mime.startsWith('video/')) return 'VIDEO'
  if (mime.startsWith('audio/')) return 'AUDIO'
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return 'SHEET'
  if (mime.includes('word') || mime.includes('text')) return 'DOC'
  return 'FILE'
}
