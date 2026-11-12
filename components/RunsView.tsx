'use client';

import React, {useEffect, useState} from 'react';
import {api} from '@/lib/client-api';
import type {RunRecord} from '@/lib/studio-types';
import RunReport, {formatWhen} from '@/components/RunReport';
import {Button, EmptyState, Panel, StatusBadge, formatDuration} from '@/components/ui';
import {cn} from '@/lib/utils';
import {Play} from 'lucide-react';

interface RunsViewProps {
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  onOpenTest: (testId: string) => void;
  onRunTest: (testId: string) => void;
  testExists: (testId: string) => boolean;
  /** Bumped by the parent when a new run starts, to refetch. */
  refreshKey: number;
}

export default function RunsView({
  selectedRunId,
  onSelectRun,
  onOpenTest,
  onRunTest,
  testExists,
  refreshKey,
}: RunsViewProps) {
  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'failed'>('all');

  const anyRunning = runs?.some((r) => r.status === 'running') ?? false;

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .listRuns()
        .then((r) => alive && (setRuns(r.runs), setError(null)))
        .catch((e) => alive && setError((e as Error).message));
    load();
    // Poll only while something is running.
    const timer = anyRunning ? window.setInterval(load, 800) : undefined;
    return () => {
      alive = false;
      if (timer) window.clearInterval(timer);
    };
  }, [refreshKey, anyRunning]);

  if (error && !runs) return <EmptyState>{error}</EmptyState>;
  if (!runs) return <EmptyState>Loading runs…</EmptyState>;
  if (runs.length === 0) {
    return (
      <Panel>
        <EmptyState>
          No runs yet. Open a test and press <strong>Run test</strong>; every run, with its
          screenshots, appears here.
        </EmptyState>
      </Panel>
    );
  }

  const shown = filter === 'failed' ? runs.filter((r) => r.status === 'failed' || r.status === 'error') : runs;
  const selected = runs.find((r) => r.id === selectedRunId) ?? shown[0] ?? runs[0];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
      <Panel
        as="div"
        title="History"
        description={`${runs.length} run${runs.length === 1 ? '' : 's'}, newest first.`}
        actions={
          <div role="group" aria-label="Filter runs" className="flex gap-1">
            {(['all', 'failed'] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'subtle' : 'ghost'}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : 'Failed only'}
              </Button>
            ))}
          </div>
        }
        bodyClassName="p-0"
      >
        {shown.length === 0 ? (
          <EmptyState>No failed runs.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[70vh] overflow-y-auto">
            {shown.map((r) => {
              const active = r.id === selected.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => onSelectRun(r.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 border-l-2 transition-colors',
                      active
                        ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                        : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {r.testName}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                      #{r.number} · {formatWhen(r.startedAt)}
                      {r.durationMs !== undefined && ` · ${formatDuration(r.durationMs)}`}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        as="div"
        title={
          <>
            {selected.testName} <span className="font-mono text-slate-400 font-normal">#{selected.number}</span>
          </>
        }
        actions={
          testExists(selected.testId) ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => onOpenTest(selected.testId)}>
                Open test
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={Play}
                disabled={anyRunning}
                onClick={() => onRunTest(selected.testId)}
              >
                Run again
              </Button>
            </>
          ) : (
            <span className="text-xs text-slate-500">This test was deleted.</span>
          )
        }
      >
        <RunReport run={selected} />
      </Panel>
    </div>
  );
}
