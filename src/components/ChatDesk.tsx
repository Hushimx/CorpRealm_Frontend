import { useEffect, useRef, useState } from 'react'
import { useLocale, useT } from '../i18n'
import { ApiError, api } from '../net/api'
import { useSession } from '../net/session'
import type { Assignable } from './TaskBoard'

const REACTIONS = ['👍', '❤️', '😂', '✅', '👀', '🎉']
const NO_MESSAGES: ChatMessage[] = []

type Channel = {
  id: string
  kind: 'channel' | 'dm'
  name: string
  title: string
  peerId: string
  lastBody: string
  lastAt: string
  canDelete: boolean
}

type ChatMessage = {
  id: string
  userId: string
  name: string
  body: string
  createdAt: string
  reactions: { emoji: string; count: number; mine: boolean }[]
}

export function ChatDesk({ officeId, people, onClose }: { officeId: string; people: Assignable[]; onClose: () => void }) {
  const me = useSession((state) => state.user)
  const t = useT()
  const locale = useLocale()
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelId, setChannelId] = useState<string | null>(null)
  const [byChannel, setByChannel] = useState<Record<string, ChatMessage[]>>({})
  const [draft, setDraft] = useState('')
  const [channelName, setChannelName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const opened = useRef(false)
  const messages = channelId ? byChannel[channelId] ?? NO_MESSAGES : NO_MESSAGES
  const others = people.filter((person) => person.id !== me?.id)
  const open = channels.find((channel) => channel.id === channelId) ?? null

  useEffect(() => {
    let closed = false
    const load = () => {
      void api<{ channels: Channel[] }>(`/offices/${officeId}/chat`)
        .then((next) => {
          if (closed) return
          setChannels(next.channels)
          setError('')
          setChannelId((current) => {
            if (opened.current) return current
            opened.current = true
            return next.channels.find((channel) => channel.name === 'general')?.id ?? next.channels[0]?.id ?? null
          })
        })
        .catch((reason: unknown) => {
          if (!closed) setError(reason instanceof ApiError ? reason.message : t('chatLoadFail'))
        })
    }
    load()
    const timer = window.setInterval(load, 4000)
    return () => {
      closed = true
      window.clearInterval(timer)
    }
  }, [officeId])

  useEffect(() => {
    if (!channelId) return
    let closed = false
    const load = () => {
      void api<{ messages: ChatMessage[] }>(`/offices/${officeId}/chat/channels/${channelId}/messages`)
        .then((next) => {
          if (closed) return
          setByChannel((current) => ({ ...current, [channelId]: next.messages }))
          setError('')
        })
        .catch((reason: unknown) => {
          if (!closed) setError(reason instanceof ApiError ? reason.message : t('messagesFail'))
        })
    }
    load()
    const timer = window.setInterval(load, 2000)
    return () => {
      closed = true
      window.clearInterval(timer)
    }
  }, [officeId, channelId])

  useEffect(() => {
    const box = scroller.current
    if (!box || !stick.current) return
    box.scrollTop = box.scrollHeight
  }, [messages, channelId])

  useEffect(() => {
    if (!open?.lastAt) return
    window.localStorage.setItem(readKey(open.id), open.lastAt)
  }, [open?.id, open?.lastAt])

  function choose(id: string) {
    stick.current = true
    setChannelId(id)
  }

  async function createChannel() {
    try {
      const created = await api<Channel>(`/offices/${officeId}/chat/channels`, { method: 'POST', body: JSON.stringify({ name: channelName }) })
      setChannels((current) => current.some((channel) => channel.id === created.id) ? current : [...current, created])
      setChannelName('')
      setCreating(false)
      choose(created.id)
      setError('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('channelFail'))
    }
  }

  async function openDm(userId: string) {
    try {
      const created = await api<Channel>(`/offices/${officeId}/chat/dm`, { method: 'POST', body: JSON.stringify({ userId }) })
      setChannels((current) => current.some((channel) => channel.id === created.id) ? current.map((channel) => channel.id === created.id ? created : channel) : [...current, created])
      choose(created.id)
      setError('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('dmFail'))
    }
  }

  async function send() {
    if (!channelId || !draft.trim() || sending) return
    const id = channelId
    const text = draft
    setSending(true)
    setDraft('')
    try {
      const message = await api<ChatMessage>(`/offices/${officeId}/chat/channels/${id}/messages`, { method: 'POST', body: JSON.stringify({ text }) })
      setByChannel((current) => {
        const existing = current[id] ?? []
        if (existing.some((item) => item.id === message.id)) return current
        return { ...current, [id]: [...existing, message] }
      })
      stick.current = true
      setError('')
    } catch (reason) {
      setDraft(text)
      setError(reason instanceof ApiError ? reason.message : t('messageFail'))
    } finally {
      setSending(false)
    }
  }

  async function react(messageId: string, emoji: string) {
    if (!channelId) return
    const id = channelId
    try {
      await api(`/offices/${officeId}/chat/messages/${messageId}/react`, { method: 'POST', body: JSON.stringify({ emoji }) })
      const next = await api<{ messages: ChatMessage[] }>(`/offices/${officeId}/chat/channels/${id}/messages`)
      setByChannel((current) => ({ ...current, [id]: next.messages }))
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('reactionFail'))
    }
  }

  async function removeChannel(id: string) {
    try {
      await api(`/offices/${officeId}/chat/channels/${id}`, { method: 'DELETE' })
      setChannels((current) => current.filter((channel) => channel.id !== id))
      if (channelId === id) setChannelId(channels.find((channel) => channel.name === 'general')?.id ?? null)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : t('channelRemoveFail'))
    }
  }

  const roomChannels = channels.filter((channel) => channel.kind === 'channel')

  return (
    <section className="desk-window flex flex-col overflow-hidden rounded-card bg-paper text-ink shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">{t('chat')}</p>
          <h2 className="font-bold text-2xl leading-none sm:text-3xl">{open ? (open.kind === 'dm' ? open.title : `# ${channelLabel(open.title, t)}`) : t('officeChat')}</h2>
          <p className="mt-1 text-xs text-ink/60">{t('chatHint')}</p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
          {t('close')}
        </button>
      </div>
      {error ? <p className="border-b border-line bg-mist px-4 py-2 text-sm font-medium text-danger">{error}</p> : null}
      <div className="flex min-h-0 flex-1">
        <aside className={`${channelId ? 'hidden sm:flex' : 'flex'} w-full shrink-0 flex-col overflow-y-auto border-ink/10 bg-mist sm:w-56 sm:border-e`}>
          <div className="px-3 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold tracking-[0.14em] text-ink/60 uppercase">{t('channels')}</p>
              <button type="button" onClick={() => setCreating((value) => !value)} className="rounded-full bg-paper px-2 py-0.5 text-xs font-bold text-ink">
                {t('add')}
              </button>
            </div>
            {creating ? (
              <form
                className="mt-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void createChannel()
                }}
              >
                <input
                  autoFocus
                  value={channelName}
                  onChange={(event) => setChannelName(event.target.value)}
                  placeholder={t('design')}
                  className="w-full rounded-xl border border-ink/10 bg-paper px-2 py-1.5 text-sm text-ink outline-none placeholder:text-ink/40"
                />
              </form>
            ) : null}
            <div className="mt-2 space-y-1">
              {roomChannels.map((channel) => (
                <ChannelButton key={channel.id} label={`# ${channelLabel(channel.title, t)}`} active={channel.id === channelId} unread={unread(channel)} onClick={() => choose(channel.id)} />
              ))}
            </div>
          </div>
          <div className="px-3 pt-4 pb-3">
            <p className="text-xs font-bold tracking-[0.14em] text-ink/60 uppercase">{t('directMessages')}</p>
            <div className="mt-2 space-y-1">
              {others.length === 0 ? <p className="px-2 text-xs text-ink/60">{t('noOneYet')}</p> : null}
              {others.map((person) => {
                const dm = channels.find((channel) => channel.kind === 'dm' && channel.peerId === person.id)
                return (
                  <ChannelButton
                    key={person.id}
                    label={person.name.trim() || t('unnamed')}
                    hint={dm?.lastBody}
                    active={dm?.id === channelId}
                    unread={dm ? unread(dm) : false}
                    onClick={() => void openDm(person.id)}
                  />
                )
              })}
            </div>
          </div>
        </aside>
        <div className={`${channelId ? 'flex' : 'hidden sm:flex'} min-w-0 flex-1 flex-col bg-paper`}>
          {open ? (
            <>
              <div className="flex items-center gap-2 border-b border-ink/10 px-3 py-2 sm:hidden">
                <button type="button" onClick={() => setChannelId(null)} className="rounded-full bg-frost px-3 py-1 text-xs font-bold text-ink">
                  {t('channels')}
                </button>
                <p className="min-w-0 truncate text-sm font-bold text-ink">{open.kind === 'dm' ? open.title : `# ${channelLabel(open.title, t)}`}</p>
              </div>
              <div
                ref={scroller}
                onScroll={(event) => {
                  const box = event.currentTarget
                  stick.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80
                }}
                className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3"
              >
                {messages.length === 0 ? <p className="px-2 py-6 text-sm text-ink/60">{t('noMessages')}</p> : null}
                {messages.map((message, index) => {
                  const previous = messages[index - 1]
                  const grouped = previous && previous.userId === message.userId && new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 5 * 60 * 1000
                  return (
                    <article key={message.id} className="group rounded-2xl px-2 py-1.5 hover:bg-mist">
                      {grouped ? null : (
                        <p className="flex items-baseline gap-2">
                          <span className="min-w-0 truncate font-bold text-ink">{message.name}</span>
                          <time dateTime={message.createdAt} dir="ltr" className="shrink-0 text-xs font-medium tabular-nums text-ink/50">
                            {new Date(message.createdAt).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}
                          </time>
                        </p>
                      )}
                      <p dir="auto" className="text-sm whitespace-pre-wrap text-ink">{message.body}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {message.reactions.map((reaction) => (
                          <button key={reaction.emoji} type="button" onClick={() => void react(message.id, reaction.emoji)} className={`rounded-full px-2 py-0.5 text-xs font-bold text-ink ${reaction.mine ? 'bg-frost ring-1 ring-lift' : 'bg-mist'}`}>
                            {reaction.emoji} {reaction.count}
                          </button>
                        ))}
                        <span className="flex gap-0.5">
                          {REACTIONS.map((emoji) => (
                            <button key={emoji} type="button" onClick={() => void react(message.id, emoji)} className="rounded-full bg-paper px-1 text-sm">
                              {emoji}
                            </button>
                          ))}
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
              <form
                className="border-t border-ink/10 p-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  void send()
                }}
              >
                {open.canDelete ? (
                  <button type="button" onClick={() => void removeChannel(open.id)} className="mb-2 text-xs font-medium text-danger">
                    {t('removeChannel')}
                  </button>
                ) : null}
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void send()
                    }
                  }}
                  rows={2}
                  placeholder={t('messageTo', { name: open.kind === 'dm' ? open.title : `#${channelLabel(open.title, t)}` })}
                  className="w-full resize-none rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
                />
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center px-6 text-center">
              <p className="text-sm text-ink/70">{t('pickChannel')}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function channelLabel(title: string, t: (key: 'channelGeneral') => string) {
  return title.trim().toLowerCase() === 'general' ? t('channelGeneral') : title
}

function ChannelButton({ label, hint, active, unread: isUnread, onClick }: { label: string; hint?: string; active: boolean; unread: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-start ${active ? 'bg-paper text-ink' : 'text-ink hover:bg-paper/70'}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${isUnread ? 'bg-lift' : 'bg-transparent'}`} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{label}</span>
        {hint ? <span className="block truncate text-[11px] font-medium text-ink/55">{hint}</span> : null}
      </span>
    </button>
  )
}

function unread(channel: Channel) {
  if (!channel.lastAt) return false
  return window.localStorage.getItem(readKey(channel.id)) !== channel.lastAt
}

function readKey(channelId: string) {
  return `corprealm-chat-read:${channelId}`
}
