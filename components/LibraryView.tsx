'use client';

import React, {useState} from 'react';
import {styleFor} from '@/lib/blocks';
import type {RunRecord, StudioDoc} from '@/lib/studio-types';
import {formatWhen} from '@/components/RunReport';
import {Button, EmptyState, Notice, Panel, StatusBadge, formatDuration, inputClass} from '@/components/ui';
import {cn} from '@/lib/utils';
import {Copy, Play, Plus} from 'lucide-react';

interface LibraryViewProps {
  kind: StudioDoc['kind'];
  docs: StudioDoc[];
  runs: RunRecord[];
  runningTestId: string | null;
  showDemoOption: boolean;
  onCreate: (name: string) => Promise<void>;
  onCreateDemo: () => Promise<void>;
  onOpen: (id: string) => void;
  onRun: (id: string) => void;
  onDuplicate: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

/** Thin colour strip previewing a stack: one segment per block, coloured by category. */
function StackStrip({doc}: {doc: StudioDoc}) {
  if (doc.blocks.length === 0) {
    return <span className="text-xs text-slate-400">Empty</span>;
  }
  return (
    <span className="flex items-center gap-0.5" aria-hidden="true">
      {doc.blocks.slice(0, 24).map((b) => (
        <span key={b.id} className={cn('h-3 w-1.5 rounded-sm', styleFor(b.kind).dot, b.disabled && 'opacity-30')} />
      ))}
      {doc.blocks.length > 24 && <span className="text-xs text-slate-400 ml-1">+{doc.blocks.length - 24}</span>}
    </span>
  );
}

export default function LibraryView({
  kind,
  docs,
  runs,
  runningTestId,
  showDemoOption,
  onCreate,
  onCreateDemo,
  onOpen,
  onRun,
  onDuplicate,
  onDelete,
}: LibraryViewProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = docs
    .filter((d) => d.kind === kind)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const isTests = kind === 'test';
  const noun = isTests ? 'test' : 'saved block';

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onCreate(name.trim());
      setName('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const guard = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const usedBy = (id: string) =>
    docs.filter((d) => d.blocks.some((b) => b.kind === 'useBlock' && b.ref === id));

  return (
    <div className="space-y-6 max-w-5xl">
      <Panel>
        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-60">
            <label htmlFor="new-doc-name" className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              {isTests ? 'New test' : 'New saved block'}
            </label>
            <input
              id="new-doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isTests ? 'e.g. Customer can log in' : 'e.g. Log in as QA user'}
              className={inputClass}
            />
          </div>
          <Button type="submit" variant="primary" icon={Plus} disabled={busy}>
            {isTests ? 'Create test' : 'Create block'}
          </Button>
          {isTests && showDemoOption && (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => guard(onCreateDemo)}>
              Add example test for the demo site
            </Button>
          )}
        </form>
        {!isTests && (
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-3">
            A saved block is a named stack (for example: open login page, type email, type
            password, click Sign in). Drop it into any test with one block; edit it once and every
            test that uses it changes.
          </p>
        )}
      </Panel>

      {error && <Notice tone="bad">{error}</Notice>}

      {items.length === 0 ? (
        <Panel>
          <EmptyState>
            {isTests ? (
              <>
                No tests yet. Name one above, then snap blocks together:
                <br />
                <span className="text-slate-700 dark:text-slate-300">Open page → Type into → Click → Check text</span>
              </>
            ) : (
              'No saved blocks yet.'
            )}
          </EmptyState>
        </Panel>
      ) : (
        <Panel bodyClassName="p-0">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((d) => {
              const last = runs.find((r) => r.testId === d.id);
              const users = isTests ? [] : usedBy(d.id);
              const running = runningTestId === d.id;
              return (
                <li key={d.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <button
                    type="button"
                    onClick={() => onOpen(d.id)}
                    className="flex-1 min-w-56 text-left group"
                  >
                    <span className="block text-sm font-medium text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 group-hover:underline">
                      {d.name}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <StackStrip doc={d} />
                      <span>
                        {d.blocks.length} block{d.blocks.length === 1 ? '' : 's'}
                      </span>
                      {!isTests && (
                        <span>
                          {users.length === 0
                            ? 'Not used yet'
                            : `Used in ${users.map((u) => u.name).join(', ')}`}
                        </span>
                      )}
                    </span>
                  </button>

                  {isTests && (
                    <div className="text-xs text-right min-w-40">
                      {running ? (
                        <StatusBadge status="running" label="Running now" />
                      ) : last ? (
                        <>
                          <StatusBadge status={last.status} />
                          <div className="text-slate-500 dark:text-slate-400 mt-1 font-mono">
                            {formatWhen(last.startedAt)}
                            {last.durationMs !== undefined && ` · ${formatDuration(last.durationMs)}`}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400">Never run</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    {confirmId === d.id ? (
                      <>
                        <span className="text-[13px] text-slate-700 dark:text-slate-300">Delete “{d.name}”?</span>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => guard(async () => {
                            await onDelete(d.id);
                            setConfirmId(null);
                          })}
                        >
                          Delete
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                          Keep
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => onOpen(d.id)}>
                          Edit
                        </Button>
                        {isTests && (
                          <Button
                            size="sm"
                            variant="primary"
                            icon={Play}
                            disabled={runningTestId !== null}
                            onClick={() => onRun(d.id)}
                          >
                            Run
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" icon={Copy} onClick={() => guard(() => onDuplicate(d.id))}>
                          Copy
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(d.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
      <p className="sr-only" aria-live="polite">
        {items.length} {noun}s
      </p>
    </div>
  );
}
