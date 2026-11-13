import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faEye, faEyeSlash, faTimes } from '@fortawesome/free-solid-svg-icons'
import {
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import type { ApplicationStatus, DocumentStatus } from '../types'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent'
}) {
  const styles = {
    primary: 'bg-navy-900 text-white hover:bg-navy-800',
    secondary:
      'bg-white text-navy-900 border border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-navy-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
    accent: 'bg-accent text-white hover:bg-accent-light',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({
  children,
  className = '',
  title,
  actions,
}: {
  children: ReactNode
  className?: string
  title?: string
  actions?: ReactNode
}) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title ? <h3 className="text-lg font-semibold text-navy-900">{title}</h3> : <span />}
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'navy',
}: {
  label: string
  value: string | number
  icon: ReactNode
  tone?: 'navy' | 'teal' | 'amber' | 'red' | 'green' | 'slate'
}) {
  const tones = {
    navy: 'bg-navy-900 text-white',
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    green: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-700',
  }
  return (
    <div className="slide-up rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-navy-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
      </div>
    </div>
  )
}

export function Input({
  label,
  error,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-navy-800">{label}</span>}
      <input
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
            : 'border-slate-200 focus:border-navy-600 focus:ring-navy-600/20'
        } ${className}`}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function TextArea({
  label,
  error,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-navy-800">{label}</span>}
      <textarea
        className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20 ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function Select({
  label,
  error,
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-navy-800">{label}</span>}
      <select
        className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20 ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function PasswordInput({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  const [show, setShow] = useState(false)
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-navy-800">{label}</span>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className={`w-full rounded-xl border bg-white px-3.5 py-2.5 pr-11 text-sm outline-none transition focus:ring-2 ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
              : 'border-slate-200 focus:border-navy-600 focus:ring-navy-600/20'
          }`}
          aria-invalid={Boolean(error)}
          {...props}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy-700"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <FontAwesomeIcon icon={show ? faEyeSlash : faEye} />
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'error' | 'warning'
  children: ReactNode
}) {
  const styles = {
    info: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-800',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800',
    error: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-800',
    warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800',
  }
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>
}

export function Badge({
  status,
}: {
  status: ApplicationStatus | DocumentStatus | string
}) {
  const map: Record<string, string> = {
    'Not Started': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100',
    'Awaiting Documents': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100',
    'Documents Under Review': 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
    'Documents Required': 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
    'In Progress': 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    Submitted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
    'Under Review': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    Approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    Rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    Pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100',
    Uploaded: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    Verified: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    'Resubmission Required': 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  }
  const label = status === 'Rejected' ? 'Declined' : status

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-700'}`}>
      {label}
    </span>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
      <div className="slide-up max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-navy-800" aria-label="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
      <p className="font-semibold text-navy-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  )
}

export function Logo({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-sm font-bold tracking-wide text-white shadow-sm">
        IH<span className="text-accent">.</span>
      </div>
      <div>
        <div
          className={`text-[1.65rem] leading-none tracking-[0.08em] ${light ? 'text-white' : 'text-navy-900'}`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          IHOPED<span className="text-accent">.</span>
        </div>
        <div className={`mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${light ? 'text-slate-300' : 'text-slate-400'}`}>
          Housing Assistance
        </div>
      </div>
    </div>
  )
}

export function Timeline({
  steps,
}: {
  steps: { label: string; done: boolean; current?: boolean; date?: string }[]
}) {
  return (
    <ol className="space-y-0">
      {steps.map((step, idx) => {
        const complete = Boolean(step.done)
        const lineDone = Boolean(step.done)
        return (
          <li key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step.current && !complete
                    ? 'bg-accent text-navy-950 ring-4 ring-accent/25'
                    : step.current && complete
                      ? 'bg-emerald-600 text-white ring-4 ring-accent/30'
                      : complete
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                }`}
              >
                {complete ? <FontAwesomeIcon icon={faCheck} /> : idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div className={`my-1 w-0.5 flex-1 min-h-6 ${lineDone ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </div>
            <div className="pb-5 pt-1">
              <p
                className={`font-medium ${
                  step.current && !complete
                    ? 'text-accent'
                    : complete
                      ? 'text-emerald-700'
                      : 'text-navy-900'
                }`}
              >
                {step.label}
              </p>
              {step.date && <p className="text-xs text-slate-500">{step.date}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
