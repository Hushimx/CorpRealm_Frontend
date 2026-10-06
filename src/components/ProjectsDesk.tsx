import { useEffect, useState, type ReactNode } from 'react'
import { knownCopy, useLocale, useT } from '../i18n'
import { ApiError, api } from '../net/api'

type ProjectCard = {
  id: string
  name: string
  summary: string
  createdAt: string
  reports: number
  boards: number
  tasks: number
  done: number
}

type ProjectDetail = {
  id: string
  name: string
  summary: string
  createdAt: string
  stats: { reports: number; boards: number; tasks: number; done: number }
  reports: { id: string; title: string; body: string; createdAt: string; authorName: string; files: number }[]
  boards: { id: string; title: string; tasks: number; done: number }[]
  tasks: { id: string; title: string; boardId: string; boardTitle: string; column: string; done: boolean }[]
}

export function ProjectsDesk({
  officeId,
  onClose,
  onOpenBoard,
}: {
  officeId: string
  onClose: () => void
  onOpenBoard: (board: { id: string; title: string }) => void
}) {
  const [projects, setProjects] = useState<ProjectCard[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const t = useT()
  const locale = useLocale()

  useEffect(() => {
    let closed = false
    void api<{ projects: ProjectCard[] }>(`/offices/${officeId}/projects`)
      .then((next) => {
        if (!closed) setProjects(next.projects)
      })
      .catch((reason: unknown) => {
        if (!closed) setError(reason instanceof ApiError ? reason.message : t('projectsFail'))
      })
    return () => {
      closed = true
    }
  }, [officeId])

  useEffect(() => {
    if (!selectedId) return
    let closed = false
    void api<ProjectDetail>(`/offices/${officeId}/projects/${selectedId}`)
      .then((next) => {
        if (!closed) setDetail(next)
      })
      .catch((reason: unknown) => {
        if (!closed) setError(reason instanceof ApiError ? reason.message : t('projectOpenFail'))
      })
    return () => {
      closed = true
    }
  }, [officeId, selectedId])

  function startCreate() {
    setCreating(true)
    setSelectedId(null)
    setEditing(false)
    setName('')
    setSummary('')
    setError('')
  }

  async function createProject() {
    setBusy(true)
    try {
      const created = await api<ProjectCard>(`/offices/${officeId}/projects`, { method: 'POST', body: JSON.stringify({ name, summary }) })
      setProjects((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setCreating(false)
      setName('')
      setSummary('')
      setSelectedId(created.id)
      setError('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('projectCreateFail'))
    } finally {
      setBusy(false)
    }
  }

  async function saveProject() {
    if (!detail) return
    setBusy(true)
    try {
      const saved = await api<{ id: string; name: string; summary: string }>(`/offices/${officeId}/projects/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, summary }),
      })
      setDetail({ ...detail, name: saved.name, summary: saved.summary })
      setProjects((current) => current.map((item) => (item.id === saved.id ? { ...item, name: saved.name, summary: saved.summary } : item)))
      setEditing(false)
      setError('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('projectSaveFail'))
    } finally {
      setBusy(false)
    }
  }

  async function removeProject() {
    if (!detail) return
    setBusy(true)
    try {
      await api(`/offices/${officeId}/projects/${detail.id}`, { method: 'DELETE' })
      setProjects((current) => current.filter((item) => item.id !== detail.id))
      setSelectedId(null)
      setConfirming(false)
      setError('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('projectDeleteFail'))
    } finally {
      setBusy(false)
    }
  }

  const open = selectedId && detail?.id === selectedId ? detail : null
  const showList = !creating && !selectedId

  return (
    <section className="absolute top-16 end-3 bottom-4 start-32 z-10 flex overflow-hidden rounded-card bg-paper text-ink shadow-card sm:end-4 sm:start-36">
      <aside className={`${showList ? 'flex' : 'hidden sm:flex'} w-full shrink-0 flex-col border-e border-line bg-mist sm:w-60`}>
        <div className="flex items-center justify-between px-3 pt-4">
          <p className="text-xs font-bold tracking-[0.16em] text-ink/50 uppercase">{t('projects')}</p>
          <button type="button" onClick={startCreate} className="rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-paper">
            {t('newItem')}
          </button>
        </div>
        <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
          {projects.length === 0 ? <p className="px-2 py-3 text-xs text-ink/60">{t('noProjects')}</p> : null}
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => {
                setCreating(false)
                setEditing(false)
                setConfirming(false)
                setSelectedId(project.id)
              }}
              className={`block w-full rounded-xl px-2 py-2 text-start ${selectedId === project.id && !creating ? 'bg-paper text-ink shadow-pop' : 'text-ink hover:bg-paper/70'}`}
            >
              <span className="block truncate text-sm font-bold">{project.name}</span>
              <span className="mt-0.5 block truncate text-[11px] font-medium text-ink/55">
                {t('countReport', { n: project.reports })} · {t('countBoard', { n: project.boards })} · {t('countTask', { n: project.tasks })}
              </span>
            </button>
          ))}
        </div>
      </aside>
      <div className={`${showList ? 'hidden sm:flex' : 'flex'} min-w-0 flex-1 flex-col bg-paper`}>
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.16em] text-ink/50 uppercase">{t('projects')}</p>
            <h2 className="truncate font-black text-2xl text-ink">{creating ? t('newProject') : open ? open.name : t('projects')}</h2>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink">
            {t('close')}
          </button>
        </header>
        {error ? <p className="border-b border-line bg-mist px-4 py-2 text-sm font-medium text-danger">{error}</p> : null}
        {creating ? (
          <form
            className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void createProject()
            }}
          >
            <button type="button" onClick={() => setCreating(false)} className="rounded-full bg-frost px-3 py-1 text-xs font-bold text-ink sm:hidden">
              {t('back')}
            </button>
            <Field label={t('name')} value={name} onChange={setName} placeholder={t('lobbyRefresh')} />
            <Field label={t('summary')} value={summary} onChange={setSummary} placeholder={t('projectFor')} multiline />
            <button type="submit" disabled={busy || !name.trim()} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper disabled:opacity-60">
              {busy ? t('creating') : t('createProject')}
            </button>
          </form>
        ) : open ? (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
            <button type="button" onClick={() => setSelectedId(null)} className="rounded-full bg-frost px-3 py-1 text-xs font-bold text-ink sm:hidden">
              {t('allProjects')}
            </button>
            {editing ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  void saveProject()
                }}
              >
                <Field label={t('name')} value={name} onChange={setName} placeholder={t('projectName')} />
                <Field label={t('summary')} value={summary} onChange={setSummary} placeholder={t('projectFor')} multiline />
                <div className="flex gap-2">
                  <button type="submit" disabled={busy || !name.trim()} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper disabled:opacity-60">
                    {t('save')}
                  </button>
                  <button type="button" onClick={() => setEditing(false)} className="rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink">
                    {t('cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-xl text-sm text-ink/70">{open.summary || t('noSummary')}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setName(open.name)
                      setSummary(open.summary)
                      setEditing(true)
                      setConfirming(false)
                    }}
                    className="rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink"
                  >
                    {t('edit')}
                  </button>
                  {confirming ? (
                    <button type="button" onClick={() => void removeProject()} className="rounded-full bg-danger px-3 py-1.5 text-xs font-bold text-paper">
                      {busy ? t('deleting') : t('confirmDelete')}
                    </button>
                  ) : (
                    <button type="button" onClick={() => setConfirming(true)} className="rounded-full px-3 py-1.5 text-xs font-bold text-danger">
                      {t('delete')}
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Stat label={t('reports')} value={String(open.stats.reports)} />
              <Stat label={t('boards')} value={String(open.stats.boards)} />
              <Stat label={t('tasks')} value={String(open.stats.tasks)} />
              <Stat label={t('progress')} value={open.stats.tasks === 0 ? '—' : `${open.stats.done}/${open.stats.tasks}`} hint={progressLabel(open.stats.done, open.stats.tasks, t)} />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-mist">
              <div className="h-full rounded-full bg-lift" style={{ width: `${percent(open.stats.done, open.stats.tasks)}%` }} />
            </div>
            <Section title={t('reports')} empty={t('noProjectReports')}>
              {open.reports.map((report) => (
                <article key={report.id} className="rounded-2xl bg-mist px-3 py-3 text-ink">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="min-w-0 truncate font-bold">{report.title}</h4>
                    <span className="shrink-0 text-[11px] font-medium text-ink/50">{formatWhen(report.createdAt, locale)}</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-ink/60">
                    {report.authorName}
                    {report.files ? ` · ${report.files === 1 ? t('oneFile') : t('nFiles', { n: report.files })}` : ''}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm whitespace-pre-wrap text-ink">{report.body}</p>
                </article>
              ))}
            </Section>
            <Section title={t('boards')} empty={t('noProjectBoards')}>
              {open.boards.map((board) => (
                <article key={board.id} className="flex items-center justify-between gap-3 rounded-2xl bg-mist px-3 py-3 text-ink">
                  <div className="min-w-0">
                    <h4 className="truncate font-bold">{knownCopy(board.title, t)}</h4>
                    <p className="mt-1 text-xs font-medium text-ink/60">
                      {t('tasksDoneOf', { done: board.done, total: board.tasks })}
                    </p>
                  </div>
                  <button type="button" onClick={() => onOpenBoard({ id: board.id, title: board.title })} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
                    {t('open')}
                  </button>
                </article>
              ))}
            </Section>
            <Section title={t('tasks')} empty={t('noProjectTasks')}>
              {open.tasks.map((task) => (
                <article key={`${task.boardId}-${task.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-mist px-3 py-2 text-ink">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-bold">{task.title}</h4>
                    <p className="truncate text-[11px] font-medium text-ink/55">
                      {knownCopy(task.boardTitle, t)} · {knownCopy(task.column, t)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${task.done ? 'bg-lift text-paper' : 'bg-paper text-ink'}`}>{task.done ? t('taskDone') : t('taskOpen')}</span>
                </article>
              ))}
            </Section>
          </div>
        ) : selectedId ? (
          <div className="grid flex-1 place-items-center text-sm font-medium text-ink/60">{t('loadingProject')}</div>
        ) : (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div className="max-w-sm rounded-card border border-dashed border-ink/15 bg-mist px-6 py-8">
              <p className="font-bold text-lg text-ink">{t('pickProject')}</p>
              <p className="mt-1 text-sm text-ink/60">{t('projectGather')}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Field({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean }) {
  const className = 'mt-1 w-full rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm font-medium text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift'
  return (
    <label className="block text-xs font-bold tracking-[0.14em] text-ink/50 uppercase">
      {label}
      {multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} placeholder={placeholder} className={`${className} resize-none`} /> : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={className} />}
    </label>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-mist px-3 py-3 text-ink">
      <p className="text-[11px] font-bold tracking-[0.14em] text-ink/50 uppercase">{label}</p>
      <p className="mt-1 font-black text-2xl leading-none">{value}</p>
      {hint ? <p className="mt-1 text-[11px] font-medium text-ink/60">{hint}</p> : null}
    </div>
  )
}

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children : [children]
  const filled = items.some((item) => item)
  return (
    <section>
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <div className="mt-2 space-y-2">{filled ? children : <p className="rounded-2xl bg-mist px-3 py-3 text-sm text-ink/60">{empty}</p>}</div>
    </section>
  )
}

function percent(done: number, total: number) {
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)))
}

function progressLabel(done: number, total: number, t: (key: 'noTasksYet' | 'percentDone', vars?: Record<string, string | number>) => string) {
  if (total <= 0) return t('noTasksYet')
  return t('percentDone', { n: percent(done, total) })
}

function formatWhen(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}
