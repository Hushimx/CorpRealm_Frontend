import { useEffect, useRef, useState } from 'react'
import { text, useLocale, useT } from '../i18n'
import { ApiError, api } from '../net/api'
import { useSession } from '../net/session'
import type { Assignable } from './TaskBoard'

type Report = {
  id: string
  title: string
  body: string
  createdAt: string
  authorId: string
  authorName: string
  unread: boolean
  project: { id: string; name: string } | null
  files: { id: string; name: string; mime: string; size: number }[]
  recipients: { id: string; name: string; read: boolean }[]
}

type Box = 'inbox' | 'sent'

export function ReportsDesk({ officeId, people, onClose }: { officeId: string; people: Assignable[]; onClose: () => void }) {
  const me = useSession((state) => state.user)
  const t = useT()
  const locale = useLocale()
  const [box, setBox] = useState<Box>('inbox')
  const [reports, setReports] = useState<Report[]>([])
  const [unread, setUnread] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState('')
  const [draft, setDraft] = useState('')
  const [recipientIds, setRecipientIds] = useState<string[]>([])
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [attachments, setAttachments] = useState<File[]>([])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const readIds = useRef(new Set<string>())
  const others = people.filter((person) => person.id !== me?.id)
  const selected = reports.find((report) => report.id === selectedId) ?? null
  const showList = !composing && !selected

  useEffect(() => {
    let closed = false
    const load = () => {
      void api<{ reports: Report[]; unread: number }>(`/offices/${officeId}/reports?box=${box}`)
        .then((next) => {
          if (closed) return
          setReports(next.reports.map((report) => (readIds.current.has(report.id) ? { ...report, unread: false } : report)))
          setUnread(Math.max(0, next.unread - [...readIds.current].filter((id) => next.reports.some((report) => report.id === id && report.unread)).length))
          setError('')
          setSelectedId((current) => (current && next.reports.some((report) => report.id === current) ? current : null))
        })
        .catch((reason: unknown) => {
          if (!closed) setError(reason instanceof ApiError ? reason.message : t('reportsFail'))
        })
    }
    load()
    const timer = window.setInterval(load, 5000)
    return () => {
      closed = true
      window.clearInterval(timer)
    }
  }, [officeId, box])

  useEffect(() => {
    let closed = false
    void api<{ projects: { id: string; name: string }[] }>(`/offices/${officeId}/projects`)
      .then((next) => {
        if (!closed) setProjects(next.projects)
      })
      .catch(() => undefined)
    return () => {
      closed = true
    }
  }, [officeId])

  function chooseBox(next: Box) {
    setComposing(false)
    setSelectedId(null)
    if (next !== box) setReports([])
    setBox(next)
  }

  function openReport(report: Report) {
    setComposing(false)
    setSelectedId(report.id)
    if (!report.unread || readIds.current.has(report.id)) return
    readIds.current.add(report.id)
    setReports((current) => current.map((item) => (item.id === report.id ? { ...item, unread: false } : item)))
    setUnread((count) => Math.max(0, count - 1))
    void api(`/offices/${officeId}/reports/${report.id}/read`, { method: 'POST', body: '{}' }).catch(() => {
      readIds.current.delete(report.id)
    })
  }

  async function attachMore(reportId: string, list: FileList) {
    const saved: Report['files'] = []
    const failed: string[] = []
    for (const file of list) {
      try {
        saved.push(await uploadAttachment(officeId, reportId, file))
      } catch (reason) {
        failed.push(reason instanceof ApiError ? `${file.name}: ${reason.message}` : file.name)
      }
    }
    if (saved.length) {
      setReports((current) => current.map((item) => (item.id === reportId ? { ...item, files: [...item.files, ...saved] } : item)))
    }
    setError(failed.length ? t('someAttach', { detail: failed.join(' ') }) : '')
  }

  function togglePerson(id: string) {
    setRecipientIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function send() {
    setSending(true)
    try {
      const created = await api<Report>(`/offices/${officeId}/reports`, {
        method: 'POST',
        body: JSON.stringify({ title, body: draft, recipientIds, projectId: projectId || undefined }),
      })
      const saved = [...created.files]
      const failed: string[] = []
      for (const file of attachments) {
        try {
          saved.push(await uploadAttachment(officeId, created.id, file))
        } catch (reason) {
          failed.push(reason instanceof ApiError ? `${file.name}: ${reason.message}` : file.name)
        }
      }
      const next = { ...created, files: saved }
      setTitle('')
      setDraft('')
      setRecipientIds([])
      setProjectId('')
      setAttachments([])
      setError(failed.length ? t('sentSome', { detail: failed.join(' ') }) : '')
      setComposing(false)
      setBox('sent')
      setSelectedId(next.id)
      setReports((current) => [next, ...current.filter((item) => item.id !== next.id)])
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('reportFail'))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="desk-window flex flex-col overflow-hidden rounded-card bg-paper text-ink shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">{t('reports')}</p>
          <h2 className="truncate font-bold text-2xl leading-none text-ink sm:text-3xl">{composing ? t('newReport') : selected ? selected.title : box === 'sent' ? t('sent') : t('inbox')}</h2>
          <p className="mt-1 text-xs text-ink/60">{t('reportsHint')}</p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink">
          {t('close')}
        </button>
      </header>
      {error ? <p className="border-b border-line bg-mist px-4 py-2 text-sm font-medium text-danger">{error}</p> : null}
      <div className="flex min-h-0 flex-1">
        <aside className={`${showList ? 'flex' : 'hidden sm:flex'} w-full shrink-0 flex-col border-ink/10 bg-mist sm:w-60 sm:border-e`}>
          <div className="space-y-1 px-2 pt-3">
            <SideButton label={t('inbox')} count={unread} active={!composing && box === 'inbox'} onClick={() => chooseBox('inbox')} />
            <SideButton label={t('sent')} active={!composing && box === 'sent'} onClick={() => chooseBox('sent')} />
            <button type="button" onClick={() => { setComposing(true); setSelectedId(null) }} className={`w-full rounded-xl px-3 py-2 text-start text-sm font-bold ${composing ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
              {t('newReport')}
            </button>
          </div>
          <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
            {reports.length === 0 ? (
              <p className="px-2 py-3 text-xs text-ink/60">{box === 'sent' ? t('noneSent') : t('noneInbox')}</p>
            ) : null}
            {reports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => openReport(report)}
                className={`block w-full rounded-xl px-2 py-2 text-start ${selected?.id === report.id && !composing ? 'bg-paper text-ink shadow-pop' : 'text-ink hover:bg-paper/70'}`}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${report.unread ? 'bg-lift' : 'bg-transparent'}`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{report.title}</span>
                  <span className="shrink-0 text-[11px] font-medium text-ink/50">{formatWhen(report.createdAt, locale)}</span>
                </span>
                <span className="mt-0.5 block truncate ps-4 text-[11px] font-medium text-ink/55">
                  {box === 'sent' ? t('toPerson', { name: names(report.recipients, t('noOne')) }) : report.authorName}
                </span>
              </button>
            ))}
          </div>
        </aside>
        <div className={`${showList ? 'hidden sm:flex' : 'flex'} min-w-0 flex-1 flex-col bg-paper`}>
          {composing ? (
            <form
              className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
              onSubmit={(event) => {
                event.preventDefault()
                void send()
              }}
            >
              <button type="button" onClick={() => setComposing(false)} className="rounded-full bg-frost px-3 py-1 text-xs font-bold text-ink sm:hidden">
                {t('back')}
              </button>
              <label className="block text-xs font-bold tracking-[0.14em] text-ink/50 uppercase">
                {t('title')}
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t('weeklyNotes')}
                  className="mt-1 w-full rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm font-medium text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
                />
              </label>
              <label className="block text-xs font-bold tracking-[0.14em] text-ink/50 uppercase">
                {t('report')}
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={8}
                  placeholder={t('reportBody')}
                  className="mt-1 w-full resize-none rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm font-medium text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
                />
              </label>
              <label className="block text-xs font-bold tracking-[0.14em] text-ink/50 uppercase">
                {t('project')}
                <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1 w-full rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm font-medium text-ink outline-none">
                  <option value="">{t('noProject')}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-ink/50 uppercase">{t('files')}</p>
                <label className="mt-2 inline-block cursor-pointer rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink">
                  {t('attachFiles')}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const list = event.target.files
                      if (list) setAttachments((current) => [...current, ...list])
                      event.target.value = ''
                    }}
                  />
                </label>
                {attachments.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {attachments.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-xl bg-mist px-2 py-1 text-sm text-ink">
                        <span className="min-w-0 truncate">{file.name}</span>
                        <button type="button" onClick={() => setAttachments((current) => current.filter((_, item) => item !== index))} className="shrink-0 text-xs font-bold text-danger">
                          {t('remove')}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-xs text-ink/55">{t('noFiles')}</p>}
              </div>
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-ink/50 uppercase">{t('sendTo')}</p>
                {others.length === 0 ? <p className="mt-2 text-sm text-ink/60">{t('noOneBelongs')}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {others.map((person) => {
                    const on = recipientIds.includes(person.id)
                    return (
                      <button key={person.id} type="button" aria-pressed={on} onClick={() => togglePerson(person.id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${on ? 'bg-ink text-paper' : 'bg-frost text-ink'}`}>
                        {person.name.trim() || t('unnamed')}
                      </button>
                    )
                  })}
                </div>
              </div>
              <button type="submit" disabled={sending || !title.trim() || !draft.trim() || recipientIds.length === 0} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper disabled:opacity-60">
                {sending ? t('sending') : t('sendReport')}
              </button>
            </form>
          ) : selected ? (
            <article className="min-h-0 flex-1 overflow-y-auto p-4">
              <button type="button" onClick={() => setSelectedId(null)} className="mb-3 rounded-full bg-frost px-3 py-1 text-xs font-bold text-ink sm:hidden">
                {t('back')}
              </button>
              <p className="text-xs font-medium text-ink/55">
                {t('fromPerson', { name: selected.authorName })} · {new Date(selected.createdAt).toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
              <p className="mt-1 text-xs font-medium text-ink/70">{t('toPerson', { name: names(selected.recipients, t('noOne')) })}{box === 'sent' ? readNote(selected.recipients) : ''}</p>
              {selected.project ? <p className="mt-1 text-xs font-bold text-ink">{t('projectDot', { name: selected.project.name })}</p> : null}
              <h3 className="mt-3 font-black text-2xl text-ink">{selected.title}</h3>
              <p className="mt-3 text-sm whitespace-pre-wrap text-ink">{selected.body}</p>
              <div className="mt-4">
                <p className="text-xs font-bold tracking-[0.14em] text-ink/50 uppercase">{t('files')}</p>
                {selected.files.length === 0 ? <p className="mt-2 text-sm text-ink/60">{t('noFiles')}</p> : null}
                <ul className="mt-2 space-y-1">
                  {selected.files.map((file) => (
                    <li key={file.id}>
                      <button type="button" onClick={() => void downloadAttachment(officeId, file)} className="rounded-xl bg-mist px-3 py-2 text-start text-sm font-bold text-ink">
                        {file.name}
                      </button>
                    </li>
                  ))}
                </ul>
                {me?.id === selected.authorId ? (
                  <label className="mt-3 inline-block cursor-pointer rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink">
                    {t('attachFile')}
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        const list = event.target.files
                        if (list && selected) void attachMore(selected.id, list)
                        event.target.value = ''
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </article>
          ) : (
            <div className="grid flex-1 place-items-center px-6 text-center">
              <div className="max-w-sm rounded-card border border-dashed border-ink/15 bg-mist px-6 py-8">
                <p className="font-bold text-lg text-ink">{box === 'sent' ? t('noReport') : t('inboxQuiet')}</p>
                <p className="mt-1 text-sm text-ink/60">{t('pickReport')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function SideButton({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-start text-sm font-bold ${active ? 'bg-paper text-ink shadow-pop' : 'text-ink hover:bg-paper/70'}`}>
      <span>{label}</span>
      {count ? <span className="rounded-full bg-lift px-1.5 text-[11px] font-bold text-paper">{count}</span> : null}
    </button>
  )
}

function names(people: { name: string }[], empty: string) {
  if (people.length === 0) return empty
  return people.map((person) => person.name).join(', ')
}

function readNote(people: { read: boolean }[]) {
  const seen = people.filter((person) => person.read).length
  if (people.length === 0) return ''
  if (seen === people.length) return ` · ${text('read')}`
  if (seen === 0) return ` · ${text('unread')}`
  return ` · ${text('readBy', { seen, total: people.length })}`
}

async function uploadAttachment(officeId: string, reportId: string, file: File) {
  const body = new FormData()
  body.set('file', file)
  body.set('reportId', reportId)
  const response = await fetch(`/api/offices/${officeId}/files`, { method: 'POST', body, credentials: 'include' })
  if (!response.ok) {
    let message = text('attachFail')
    try {
      const payload = (await response.json()) as { message?: string | string[] }
      if (Array.isArray(payload.message)) message = payload.message.join(' ')
      else if (payload.message) message = payload.message
    } catch {
      message = response.statusText || message
    }
    throw new ApiError(response.status, message)
  }
  return (await response.json()) as Report['files'][number]
}

async function downloadAttachment(officeId: string, file: { id: string; name: string }) {
  const response = await fetch(`/api/offices/${officeId}/files/${file.id}`, { credentials: 'include' })
  if (!response.ok) return
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
}

function formatWhen(value: string, locale: string) {
  const date = new Date(value)
  if (date.toDateString() === new Date().toDateString()) return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}
