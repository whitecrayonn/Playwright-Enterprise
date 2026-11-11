'use client';

import React from 'react';
import {cn} from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return `${min}m ${sec}s`;
}

/** "2026-05-04T09:12:44.000Z" -> "2026-05-04 09:12" (UTC, stable across server/client). */
export function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '—';
  return iso.slice(0, 16).replace('T', ' ');
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/* ------------------------------------------------------------------ */
/* Shared class strings for native form controls                       */
/* ------------------------------------------------------------------ */

export const inputClass =
  'w-full h-9 px-3 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-60 disabled:cursor-not-allowed';

export const selectClass =
  'h-9 px-2.5 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed';

/* ------------------------------------------------------------------ */
/* Tones                                                               */
/* ------------------------------------------------------------------ */

export type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'info';

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-slate-900 dark:text-white',
  good: 'text-emerald-700 dark:text-emerald-400',
  bad: 'text-red-700 dark:text-red-400',
  warn: 'text-amber-700 dark:text-amber-400',
  info: 'text-blue-700 dark:text-blue-400',
};

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-slate-400',
  good: 'bg-emerald-500',
  bad: 'bg-red-500',
  warn: 'bg-amber-500',
  info: 'bg-blue-500',
};

const TONE_BADGE: Record<Tone, string> = {
  neutral:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  good: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  bad: 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  warn: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  info: 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
};

export function toneText(tone: Tone): string {
  return TONE_TEXT[tone];
}

/** Maps any run / step / worker / module status string to a tone. */
export function statusTone(status: string): Tone {
  switch (status) {
    case 'passed':
    case 'online':
    case 'verified':
    case 'active':
    case 'enabled':
      return 'good';
    case 'failed':
    case 'offline':
    case 'unhealthy':
    case 'timed_out':
    case 'infra_error':
    case 'deprecated':
      return 'bad';
    case 'queued':
    case 'running':
    case 'busy':
    case 'draining':
    case 'draft':
      return 'warn';
    default:
      return 'neutral';
  }
}

export function statusLabel(status: string): string {
  const s = status.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap',
        TONE_BADGE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const tone = statusTone(status);
  return (
    <Badge tone={tone} className={className}>
      <span
        aria-hidden="true"
        className={cn('w-1.5 h-1.5 rounded-full shrink-0', TONE_DOT[tone])}
      />
      {label ?? statusLabel(status)}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-500 border border-blue-600 hover:border-blue-500',
  secondary:
    'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
  ghost:
    'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent',
  subtle:
    'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent',
  danger:
    'bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/50',
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className,
  children,
  type = 'button',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ComponentType<{className?: string}>;
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed',
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        className
      )}
      {...rest}
    >
      {Icon && (
        <Icon
          className={cn('shrink-0', size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')}
        />
      )}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  as: Tag = 'section',
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: 'section' | 'div' | 'aside';
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Tag
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={cn(
        // min-w-0: lets wide tables scroll inside the panel instead of
        // stretching a grid column past the viewport.
        'min-w-0 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800',
        className
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            {title && (
              <h2
                id={headingId}
                className="text-sm font-semibold text-slate-900 dark:text-white"
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </header>
      )}
      {/* relative: absolutely positioned sr-only text inside scrolling
          tables must be clipped by this box, not widen the page. */}
      <div className={cn('relative p-4', bodyClassName)}>{children}</div>
    </Tag>
  );
}

export interface PageFact {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
}

export function PageHeader({
  title,
  description,
  facts,
  actions,
}: {
  title: string;
  description: string;
  facts?: PageFact[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {description}
          </p>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {/* flex-wrap + grow: the last row always fills, no empty cells. */}
      {facts && facts.length > 0 && (
        <dl className="flex flex-wrap gap-px rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800">
          {facts.map((f) => (
            <div
              key={f.label}
              className="flex-1 basis-36 bg-white dark:bg-slate-900 px-4 py-3 min-w-0"
            >
              <dt className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {f.label}
              </dt>
              <dd
                className={cn(
                  'text-lg font-semibold font-mono tabular-nums mt-0.5 truncate',
                  toneText(f.tone ?? 'neutral')
                )}
              >
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Compact definition list for metadata: label above value. */
export function FactGrid({
  items,
  columns = 3,
  className,
}: {
  items: {label: string; value: React.ReactNode; mono?: boolean; tone?: Tone}[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const cols =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-3';
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3', cols, className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs text-slate-500 dark:text-slate-400">
            {it.label}
          </dt>
          <dd
            className={cn(
              'text-sm mt-0.5 break-words',
              it.mono && 'font-mono tabular-nums',
              toneText(it.tone ?? 'neutral')
            )}
          >
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
  aside,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <label
          htmlFor={htmlFor}
          className="text-[13px] font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
          {required && (
            <span className="text-red-600 dark:text-red-400" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
        {aside}
      </div>
      {children}
      {hint && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{hint}</p>
      )}
    </div>
  );
}

export function Notice({
  tone = 'warn',
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'px-3 py-2 rounded-md text-[13px] border',
        tone === 'warn' &&
          'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200',
        tone === 'bad' &&
          'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-900 dark:text-red-200',
        tone === 'info' &&
          'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-200',
        (tone === 'neutral' || tone === 'good') &&
          'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-300'
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({children}: {children: React.ReactNode}) {
  return (
    <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
      {children}
    </div>
  );
}

/** Segmented tab list with proper ARIA. */
export function Tabs<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  items: {id: T; label: React.ReactNode}[];
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-slate-800"
    >
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              '-mb-px px-3 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap',
              active
                ? 'border-blue-600 text-slate-900 dark:text-white'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
