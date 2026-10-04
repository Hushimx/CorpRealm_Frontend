import type { FormEvent, ReactNode } from 'react'

export function AuthScreen({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string
  title: string
  lede: string
  children: ReactNode
}) {
  return (
    <main className="px-4 pb-16 text-ink sm:px-5 md:px-8">
      <section className="mx-auto mt-6 w-full max-w-md rounded-card bg-paper px-6 py-8 text-ink shadow-card sm:mt-12">
        <img src="/branding/corplift-logo.svg" alt="CorpLift" className="mb-6 h-7 w-auto" />
        <p className="text-xs font-medium text-lift">{eyebrow}</p>
        <h1 className="mt-2 text-5xl leading-tight font-black text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate">{lede}</p>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  )
}

export function AuthField({
  label,
  type,
  value,
  autoComplete,
  placeholder,
  onChange,
}: {
  label: string
  type: string
  value: string
  autoComplete: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block text-ink">
      <span className="text-xs text-ink/70">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-line bg-mist px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
      />
    </label>
  )
}

export function AuthForm({
  onSubmit,
  error,
  pending,
  submitLabel,
  children,
  footer,
}: {
  onSubmit: (event: FormEvent) => void
  error: string
  pending: boolean
  submitLabel: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 text-ink">
      {children}
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 w-full rounded-full bg-lift px-4 py-2.5 text-sm font-bold text-paper shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
      >
        {pending ? 'Please wait…' : submitLabel}
      </button>
      <p className="text-sm text-ink/80">{footer}</p>
    </form>
  )
}
