'use client';

import React, {useState} from 'react';
import {artifactUrl} from '@/lib/client-api';
import type {RunRecord} from '@/lib/studio-types';
import {
  Badge,
  FactGrid,
  Notice,
  StatusBadge,
  formatDuration,
} from '@/components/ui';
import {cn} from '@/lib/utils';

export function runHeadline(run: RunRecord): string {
  const passed = run.steps.filter((s) => s.status === 'passed').length;
  const failedStep = run.steps.find((s) => s.status === 'failed');
  switch (run.status) {
    case 'running': {
      const current = run.steps.find((s) => s.status === 'running');
      return current
        ? `Running step ${current.index + 1}: ${current.label}`
        : 'Starting the browser…';
    }
    case 'passed':
      return `All ${run.steps.length} steps passed.`;
    case 'failed':
      return failedStep
        ? `Failed at step ${failedStep.index + 1} after ${passed} passed.`
        : 'Failed.';
    case 'error':
      return run.error ?? 'The run could not finish.';
  }
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function Shot({runId, file, alt}: {runId: string; file: string; alt: string}) {
  const [open, setOpen] = useState(false);
  const src = artifactUrl(runId, file);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block mt-2 rounded border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-blue-500 focus-visible:border-blue-500"
        aria-label={`Enlarge screenshot: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local artifact, size unknown */}
        <img src={src} alt={alt} loading="lazy" className="max-h-40 w-auto" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          tabIndex={-1}
          onClick={() => setOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 p-4 flex flex-col items-center justify-center gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local artifact */}
          <img src={src} alt={alt} className="max-w-full max-h-[85vh] rounded shadow-2xl" />
          <span className="text-sm text-white">{alt} · click anywhere or press Esc to close</span>
        </div>
      )}
    </>
  );
}

/** Full report of one run: summary, each step, evidence and page errors. */
export default function RunReport({run, compact = false}: {run: RunRecord; compact?: boolean}) {
  const passed = run.steps.filter((s) => s.status === 'passed').length;
  const failed = run.steps.filter((s) => s.status === 'failed').length;
  const skipped = run.steps.filter((s) => s.status === 'skipped').length;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'rounded-md border px-3 py-2.5 text-sm',
          run.status === 'passed' && 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200',
          (run.status === 'failed' || run.status === 'error') && 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-900 dark:text-red-200',
          run.status === 'running' && 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-200'
        )}
        role="status"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{runHeadline(run)}</span>
          <StatusBadge status={run.status} />
        </div>
      </div>

      {!compact && (
        <FactGrid
          columns={4}
          items={[
            {label: 'Steps', value: `${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`, mono: true},
            {label: 'Duration', value: run.durationMs !== undefined ? formatDuration(run.durationMs) : '—', mono: true},
            {label: 'Browser', value: `${run.env.browser} · ${run.env.viewport.width}×${run.env.viewport.height}${run.env.headless ? '' : ' · visible'}`, mono: true},
            {label: 'Started', value: formatWhen(run.startedAt)},
            {label: 'Base URL', value: run.env.baseUrl, mono: true},
            {label: 'Ended on page', value: run.finalUrl ?? '—', mono: true},
          ]}
        />
      )}

      <ol className="space-y-1.5">
        {run.steps.map((s) => (
          <li
            key={s.index}
            className={cn(
              'rounded-md border px-3 py-2',
              s.status === 'failed'
                ? 'border-red-300 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20'
                : s.status === 'running'
                  ? 'border-blue-300 dark:border-blue-800'
                  : 'border-slate-200 dark:border-slate-800',
              s.status === 'skipped' && 'opacity-60'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-start gap-2">
                <span className="w-5 text-right font-mono text-xs text-slate-400 pt-0.5 shrink-0">
                  {s.index + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] text-slate-900 dark:text-white [overflow-wrap:anywhere]">
                    {s.label}
                  </div>
                  {s.via && (
                    <div className="text-xs text-rose-700 dark:text-rose-400">from “{s.via}”</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.durationMs !== undefined && (
                  <span className="text-xs font-mono text-slate-500">{formatDuration(s.durationMs)}</span>
                )}
                <StatusBadge status={s.status} />
              </div>
            </div>
            {s.error && (
              <p className="mt-1.5 ml-7 text-[13px] text-red-800 dark:text-red-300 [overflow-wrap:anywhere]">
                {s.error}
              </p>
            )}
            {s.note && (
              <p className="mt-1 ml-7 text-xs text-amber-700 dark:text-amber-400">{s.note}</p>
            )}
            {s.screenshot && (
              <div className="ml-7">
                <Shot runId={run.id} file={s.screenshot} alt={`Step ${s.index + 1}: ${s.label}`} />
              </div>
            )}
          </li>
        ))}
      </ol>

      {run.finalScreenshot && (
        <div>
          <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white">Page at the end</h3>
          <Shot runId={run.id} file={run.finalScreenshot} alt="Page at the end of the run" />
        </div>
      )}

      {(run.consoleErrors.length > 0 || run.failedRequests.length > 0) && (
        <div className="space-y-2">
          {run.consoleErrors.length > 0 && (
            <details className="rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2">
              <summary className="text-[13px] cursor-pointer text-slate-800 dark:text-slate-200">
                Page errors <Badge tone="warn">{run.consoleErrors.length}</Badge>
              </summary>
              <ul className="mt-2 space-y-1 font-mono text-xs text-slate-600 dark:text-slate-400">
                {run.consoleErrors.map((l, i) => (
                  <li key={i} className="[overflow-wrap:anywhere]">{l}</li>
                ))}
              </ul>
            </details>
          )}
          {run.failedRequests.length > 0 && (
            <details className="rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2">
              <summary className="text-[13px] cursor-pointer text-slate-800 dark:text-slate-200">
                Failed network requests <Badge tone="warn">{run.failedRequests.length}</Badge>
              </summary>
              <ul className="mt-2 space-y-1 font-mono text-xs text-slate-600 dark:text-slate-400">
                {run.failedRequests.map((l, i) => (
                  <li key={i} className="[overflow-wrap:anywhere]">{l}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {run.status === 'error' && run.error && <Notice tone="bad">{run.error}</Notice>}
    </div>
  );
}
