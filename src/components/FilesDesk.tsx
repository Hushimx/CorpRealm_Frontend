import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useLocale, useT, type CopyKey } from '../i18n'
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
type Menu =
  | { kind: 'new'; x: number; y: number; align: 'start' | 'end' }
  | { kind: 'file'; id: string; x: number; y: number; align: 'start' | 'end' }
  | { kind: 'folder'; id: string; x: number; y: number; align: 'start' | 'end' }

export function FilesDesk({ officeId, onClose }: { officeId: string; onClose: () => void }) {
  const t = useT()
  const locale = useLocale()
  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<OfficeFile[]>([])
  const [folderId, setFolderId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [folderName, setFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [menu, setMenu] = useState<Menu | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const folder = folders.find((item) => item.id === folderId) ?? null
  const needle = query.trim().toLowerCase()
  const shownFiles = files.filter((file) => file.name.toLowerCase().includes(needle))
  const shownFolders = folderId ? [] : folders.filter((item) => item.name.toLowerCase().includes(needle))

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
          if (!closed) setError(reason instanceof ApiError ? reason.message : t('filesFail'))
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
      setError(reason instanceof ApiError ? reason.message : t('folderFail'))
    }
  }

  async function upload(list: FileList | File[]) {
    const queue = [...list]
    if (queue.length === 0) return
    setBusy(true)
    setMenu(null)
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
      setError(reason instanceof ApiError ? reason.message : t('uploadFail'))
    } finally {
      setBusy(false)
      setDragging(false)
    }
  }

  async function download(file: OfficeFile) {
    setMenu(null)
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
      setError(reason instanceof ApiError ? reason.message : t('downloadFail'))
    }
  }

  async function removeFile(file: OfficeFile) {
    setMenu(null)
    try {
      await api(`/offices/${officeId}/files/${file.id}`, { method: 'DELETE' })
      setFiles((current) => current.filter((item) => item.id !== file.id))
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('fileDeleteFail'))
    }
  }

  async function moveFile(file: OfficeFile, nextFolder: string) {
    setMenu(null)
    try {
      await api(`/offices/${officeId}/files/${file.id}`, { method: 'PATCH', body: JSON.stringify({ folderId: nextFolder || null }) })
      setFiles((current) => current.filter((item) => item.id !== file.id))
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('fileMoveFail'))
    }
  }

  async function removeFolder(target: Folder) {
    setMenu(null)
    try {
      await api(`/offices/${officeId}/files/folders/${target.id}`, { method: 'DELETE' })
      setFolders((current) => current.filter((item) => item.id !== target.id))
      if (folderId === target.id) setFolderId(null)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('folderDeleteFail'))
    }
  }

  function openMenu(event: ReactMouseEvent<HTMLElement>, next: { kind: 'new' } | { kind: 'file'; id: string } | { kind: 'folder'; id: string }) {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const align: 'start' | 'end' = rect.left > window.innerWidth * 0.45 ? 'end' : 'start'
    const point = { x: align === 'end' ? rect.right : rect.left, y: rect.bottom + 6, align }
    setMenu(next.kind === 'new' ? { kind: 'new', ...point } : { ...next, ...point })
  }

  const empty = shownFolders.length === 0 && shownFiles.length === 0

  return (
    <section className="absolute top-16 end-3 bottom-4 start-32 z-10 flex overflow-hidden rounded-card bg-paper text-ink shadow-card sm:end-4 sm:start-36" onMouseDown={() => setMenu(null)}>
      <aside className="hidden w-52 shrink-0 flex-col border-e border-line bg-mist sm:flex">
        <p className="px-4 pt-4 text-xs font-bold tracking-[0.16em] text-ink/50 uppercase">{t('files')}</p>
        <nav className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3" aria-label={t('folders')}>
          <SideItem active={folderId === null} label={t('officeFiles')} onClick={() => setFolderId(null)} />
          {folders.map((item) => (
            <SideItem
              key={item.id}
              active={folderId === item.id}
              label={item.name}
              onClick={() => setFolderId(item.id)}
              onMore={(event) => openMenu(event, { kind: 'folder', id: item.id })}
            />
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-paper">
        <header className="border-b border-line px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-ink/50">
                <button type="button" onClick={() => setFolderId(null)} className="font-bold text-ink/70 hover:text-ink">
                  {t('officeFiles')}
                </button>
                {folder ? <span className="text-ink"> / {folder.name}</span> : null}
              </p>
              <h2 className="truncate font-black text-2xl leading-none text-ink">{folder ? folder.name : t('officeFiles')}</h2>
              <p className="mt-1 text-xs text-ink/55">{t('filesHint')}</p>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink">
              {t('close')}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex min-w-[10rem] flex-1 items-center gap-2 rounded-full bg-mist px-3 py-2">
            <SearchMark />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchFiles')}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/40"
            />
          </label>
          <div className="flex rounded-full bg-mist p-0.5" role="group" aria-label={t('layout')}>
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} className={`rounded-full px-2.5 py-1 text-xs font-bold ${view === 'list' ? 'bg-paper text-ink shadow-pop' : 'text-ink/60'}`}>
              {t('list')}
            </button>
            <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')} className={`rounded-full px-2.5 py-1 text-xs font-bold ${view === 'grid' ? 'bg-paper text-ink shadow-pop' : 'text-ink/60'}`}>
              {t('grid')}
            </button>
          </div>
          <button type="button" onClick={(event) => openMenu(event, { kind: 'new' })} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
            {busy ? t('uploading') : t('newItem')}
          </button>
          </div>
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
        </header>
        <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2 sm:hidden">
          <button type="button" onClick={() => setFolderId(null)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${folderId ? 'bg-frost text-ink' : 'bg-ink text-paper'}`}>
            {t('officeFiles')}
          </button>
          {folders.map((item) => (
            <button key={item.id} type="button" onClick={() => setFolderId(item.id)} className={`max-w-36 shrink-0 truncate rounded-full px-3 py-1 text-xs font-bold ${folderId === item.id ? 'bg-ink text-paper' : 'bg-frost text-ink'}`}>
              {item.name}
            </button>
          ))}
        </div>
        {error ? <p className="px-4 py-2 text-sm font-medium text-danger">{error}</p> : null}
        <div
          className={`min-h-0 flex-1 overflow-y-auto p-4 ${dragging ? 'bg-frost' : 'bg-paper'}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void upload(event.dataTransfer.files)
          }}
        >
          {dragging ? <p className="mb-3 rounded-2xl border border-dashed border-lift bg-paper px-4 py-3 text-center text-sm font-bold text-ink">{t('dropUpload', { name: folder ? folder.name : t('officeFiles') })}</p> : null}
          {shownFolders.length > 0 ? (
            <section>
              <h3 className="text-sm font-bold text-ink">{t('folders')}</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-3">
                {shownFolders.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-2xl bg-mist px-3 py-3 text-ink hover:bg-frost">
                    <button type="button" onClick={() => setFolderId(item.id)} className="flex min-w-0 flex-1 items-center gap-2 text-start">
                      <FolderMark />
                      <span className="truncate text-sm font-bold">{item.name}</span>
                    </button>
                    <button type="button" aria-label={t('folderActions', { name: item.name })} onClick={(event) => openMenu(event, { kind: 'folder', id: item.id })} className="grid h-7 w-7 place-items-center rounded-full text-ink hover:bg-paper">
                      ···
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {shownFiles.length > 0 ? (
            <section className={shownFolders.length > 0 ? 'mt-6' : ''}>
              <h3 className="text-sm font-bold text-ink">{t('files')}</h3>
              {view === 'grid' ? (
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {shownFiles.map((file) => (
                    <article key={file.id} className={`overflow-hidden rounded-2xl border text-ink ${selected === file.id ? 'border-lift bg-frost' : 'border-line bg-paper'}`}>
                      <button type="button" onClick={() => setSelected(file.id)} onDoubleClick={() => void download(file)} className="block w-full bg-mist text-start">
                        <FilePreview officeId={officeId} file={file} large />
                      </button>
                      <div className="flex items-start gap-2 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink">{file.name}</p>
                          <p className="truncate text-[11px] text-ink/55">{formatSize(file.size)} · {file.authorName}</p>
                        </div>
                        <button type="button" aria-label={t('fileActions', { name: file.name })} onClick={(event) => openMenu(event, { kind: 'file', id: file.id })} className="text-sm font-bold text-ink">
                          ···
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-2 overflow-hidden rounded-2xl border border-line">
                  <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_1.75rem] gap-3 bg-mist px-3 py-2 text-[11px] font-bold text-ink/50 uppercase md:grid-cols-[minmax(0,1fr)_6rem_3.5rem_1.75rem] lg:grid-cols-[minmax(0,1fr)_7rem_6rem_3.5rem_1.75rem]">
                    <span>{t('name')}</span>
                    <span className="hidden lg:block">{t('owner')}</span>
                    <span className="hidden md:block">{t('modified')}</span>
                    <span>{t('size')}</span>
                    <span />
                  </div>
                  {shownFiles.map((file) => (
                    <div key={file.id} className={`grid grid-cols-[minmax(0,1fr)_3.5rem_1.75rem] items-center gap-3 border-t border-line px-3 py-2 md:grid-cols-[minmax(0,1fr)_6rem_3.5rem_1.75rem] lg:grid-cols-[minmax(0,1fr)_7rem_6rem_3.5rem_1.75rem] ${selected === file.id ? 'bg-frost' : 'hover:bg-mist'}`}>
                      <button type="button" onClick={() => setSelected(file.id)} onDoubleClick={() => void download(file)} className="flex min-w-0 items-center gap-2 text-start">
                        <FilePreview officeId={officeId} file={file} />
                        <span className="truncate text-sm font-medium text-ink">{file.name}</span>
                      </button>
                      <span className="hidden truncate text-xs text-ink/70 lg:block">{file.authorName}</span>
                      <span className="hidden truncate text-xs text-ink/70 md:block">{formatWhen(file.createdAt, locale)}</span>
                      <span className="truncate text-xs text-ink/70">{formatSize(file.size)}</span>
                      <button type="button" aria-label={t('fileActions', { name: file.name })} onClick={(event) => openMenu(event, { kind: 'file', id: file.id })} className="text-sm font-bold text-ink">
                        ···
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
          {empty && !dragging ? (
            <div className="grid min-h-full place-items-center py-10">
              <div className="w-full max-w-md rounded-card border border-dashed border-ink/15 bg-mist px-6 py-10 text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-paper">
                  <FolderMark large />
                </span>
                <p className="mt-4 font-bold text-xl text-ink">{needle ? t('noSearch') : t('emptyFolder')}</p>
                <p className="mt-1 text-sm text-ink/60">{needle ? t('tryName') : t('dropHint')}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {menu ? <DriveMenu menu={menu} folders={folders} files={files} onUpload={() => input.current?.click()} onNewFolder={() => { setMenu(null); setCreating(true); setFolderName('') }} onDownload={(file) => void download(file)} onDeleteFile={(file) => void removeFile(file)} onMove={(file, next) => void moveFile(file, next)} onDeleteFolder={(item) => void removeFolder(item)} onOpenFolder={(id) => { setMenu(null); setFolderId(id) }} /> : null}
      {creating ? (
        <div
          className="absolute inset-0 z-40 grid place-items-center bg-ink/25 p-4"
          onMouseDown={(event) => {
            event.stopPropagation()
            if (event.target === event.currentTarget) setCreating(false)
          }}
        >
          <form
            className="w-full max-w-sm rounded-card bg-paper p-4 text-ink shadow-card"
            onSubmit={(event) => {
              event.preventDefault()
              void createFolder()
            }}
          >
            <p className="text-xs font-bold tracking-[0.16em] text-ink/50 uppercase">{t('newFolder')}</p>
            <input
              autoFocus
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder={t('folderName')}
              className="mt-3 w-full rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink">
                {t('cancel')}
              </button>
              <button type="submit" className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
                {t('create')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}

function SideItem({ active, label, onClick, onMore }: { active: boolean; label: string; onClick: () => void; onMore?: (event: ReactMouseEvent<HTMLButtonElement>) => void }) {
  return (
    <div className={`flex items-center rounded-xl ${active ? 'bg-paper text-ink shadow-pop' : 'text-ink hover:bg-paper/70'}`}>
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-start">
        <FolderMark small />
        <span className="truncate text-sm font-bold">{label}</span>
      </button>
      {onMore ? (
        <button type="button" aria-label={label} onClick={onMore} className="me-1 grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-ink">
          ···
        </button>
      ) : null}
    </div>
  )
}

function DriveMenu({
  menu,
  folders,
  files,
  onUpload,
  onNewFolder,
  onDownload,
  onDeleteFile,
  onMove,
  onDeleteFolder,
  onOpenFolder,
}: {
  menu: Menu
  folders: Folder[]
  files: OfficeFile[]
  onUpload: () => void
  onNewFolder: () => void
  onDownload: (file: OfficeFile) => void
  onDeleteFile: (file: OfficeFile) => void
  onMove: (file: OfficeFile, folderId: string) => void
  onDeleteFolder: (folder: Folder) => void
  onOpenFolder: (id: string) => void
}) {
  const t = useT()
  const file = menu.kind === 'file' ? files.find((item) => item.id === menu.id) : undefined
  const folder = menu.kind === 'folder' ? folders.find((item) => item.id === menu.id) : undefined
  return (
    <div
      className="fixed z-50 w-56 rounded-2xl border border-line bg-paper p-1 text-ink shadow-card"
      style={{ left: menu.x, top: menu.y, transform: menu.align === 'end' ? 'translateX(-100%)' : undefined }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {menu.kind === 'new' ? (
        <>
          <MenuButton label={t('uploadFiles')} onClick={onUpload} />
          <MenuButton label={t('newFolder')} onClick={onNewFolder} />
        </>
      ) : null}
      {file ? (
        <>
          <MenuButton label={t('download')} onClick={() => onDownload(file)} />
          <label className="block px-2 py-1.5 text-xs text-ink/60">
            {t('moveTo')}
            <select
              value={file.folderId ?? ''}
              onChange={(event) => onMove(file, event.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/15 bg-paper px-2 py-1.5 text-sm text-ink outline-none"
            >
              <option value="">{t('officeFiles')}</option>
              {folders.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          {file.canDelete ? <MenuButton label={t('delete')} danger onClick={() => onDeleteFile(file)} /> : null}
        </>
      ) : null}
      {folder ? (
        <>
          <MenuButton label={t('open')} onClick={() => onOpenFolder(folder.id)} />
          <MenuButton label={t('deleteFolder')} danger onClick={() => onDeleteFolder(folder)} />
        </>
      ) : null}
    </div>
  )
}

function MenuButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`block w-full rounded-xl px-3 py-2 text-start text-sm font-medium hover:bg-mist ${danger ? 'text-danger' : 'text-ink'}`}>
      {label}
    </button>
  )
}

function FilePreview({ officeId, file, large }: { officeId: string; file: OfficeFile; large?: boolean }) {
  const t = useT()
  const [broken, setBroken] = useState(false)
  if (file.mime.startsWith('image/') && !broken) {
    return <img src={`/api/offices/${officeId}/files/${file.id}?inline=1`} alt="" onError={() => setBroken(true)} className={large ? 'h-28 w-full object-cover' : 'h-8 w-8 rounded-lg object-cover'} />
  }
  const kind = kindOf(file.mime, t)
  return (
    <span className={`grid place-items-center font-bold ${large ? 'h-28 w-full text-sm' : 'h-8 w-8 shrink-0 rounded-lg text-[9px]'} ${kind.light ? 'text-ink' : 'text-paper'}`} style={{ background: kind.color }}>
      {large ? kind.label : kind.short}
    </span>
  )
}

function FolderMark({ large, small }: { large?: boolean; small?: boolean }) {
  const box = large ? 'h-10 w-12' : small ? 'h-4 w-5' : 'h-6 w-7'
  return (
    <span className={`relative shrink-0 ${box}`} aria-hidden="true">
      <span className="absolute top-0 left-0 h-[30%] w-[46%] rounded-t-sm bg-lift" />
      <span className="absolute right-0 bottom-0 left-0 h-[72%] rounded-sm bg-lift" />
    </span>
  )
}

function SearchMark() {
  return (
    <span className="relative h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <span className="absolute inset-0 rounded-full border-2 border-ink/50" />
      <span className="absolute right-0 bottom-0 h-1.5 w-0.5 origin-bottom-right rotate-45 rounded-full bg-ink/50" />
    </span>
  )
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

function formatWhen(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

function kindOf(mime: string, t: (key: CopyKey) => string) {
  if (mime.includes('pdf')) return { label: 'PDF', short: 'PDF', color: '#c0392b', light: false }
  if (mime.includes('zip')) return { label: 'ZIP', short: 'ZIP', color: '#14161c', light: false }
  if (mime.startsWith('video/')) return { label: t('video'), short: 'VID', color: '#6d4aff', light: false }
  if (mime.startsWith('audio/')) return { label: t('audio'), short: 'AUD', color: '#e07a2f', light: false }
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return { label: t('sheet'), short: 'XLS', color: '#2f9e6b', light: false }
  if (mime.includes('word') || mime.startsWith('text/')) return { label: t('doc'), short: 'DOC', color: '#2765ed', light: false }
  if (mime.startsWith('image/')) return { label: t('image'), short: 'IMG', color: '#8fb8ff', light: true }
  return { label: t('fileWord'), short: 'FILE', color: '#e6eeff', light: true }
}
