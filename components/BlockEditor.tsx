'use client';

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  BLOCK_DEFS,
  CATEGORIES,
  PALETTE_ORDER,
  ROLES,
  TARGET_BY,
  blockLabel,
  createBlock,
  newId,
  styleFor,
  validateBlocks,
} from '@/lib/blocks';
import {api, ApiError} from '@/lib/client-api';
import {generateSpec} from '@/lib/codegen';
import type {
  Block,
  BlockKind,
  Issue,
  RunRecord,
  StepStatus,
  StudioDoc,
  StudioEnv,
  TargetBy,
} from '@/lib/studio-types';
import RunReport from '@/components/RunReport';
import {Badge, Button, Notice, Panel, StatusBadge, inputClass, selectClass} from '@/components/ui';
import {cn} from '@/lib/utils';
import {ArrowLeft, Code2, Download, GripVertical, Play, Search} from 'lucide-react';

interface BlockEditorProps {
  doc: StudioDoc;
  docs: StudioDoc[];
  env: StudioEnv;
  activeRunId: string | null;
  onBack: () => void;
  onDocSaved: (doc: StudioDoc) => void;
  onOpenDoc: (id: string) => void;
  onRunStarted: (run: RunRecord) => void;
  onRunFinished: (run: RunRecord) => void;
}

type SaveState = 'saved' | 'unsaved' | 'saving' | 'error';
type DragPayload = {from: 'palette'; kind: BlockKind; ref?: string} | {from: 'canvas'; index: number};

const DRAG_TYPE = 'application/x-studio-block';
const fieldInput = cn(inputClass, 'h-8 text-[13px]');
const fieldSelect = cn(selectClass, 'h-8 text-[13px]');

/** Worst status wins, so a "Use block" shows failed if any inner step failed. */
function combine(a: StepStatus | undefined, b: StepStatus): StepStatus {
  const rank: Record<StepStatus, number> = {failed: 5, running: 4, passed: 2, skipped: 1, pending: 3};
  if (!a) return b;
  // A partly-passed saved block that is still going should read as running.
  if ((a === 'passed' && b === 'pending') || (a === 'pending' && b === 'passed')) return 'running';
  return rank[a] >= rank[b] ? a : b;
}

export default function BlockEditor({
  doc,
  docs,
  env,
  activeRunId,
  onBack,
  onDocSaved,
  onOpenDoc,
  onRunStarted,
  onRunFinished,
}: BlockEditorProps) {
  const isTest = doc.kind === 'test';
  const [name, setName] = useState(doc.name);
  const [description, setDescription] = useState(doc.description);
  const [blocks, setBlocks] = useState<Block[]>(doc.blocks);
  const [selectedId, setSelectedId] = useState<string | null>(doc.blocks[0]?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // On phones the palette starts folded so the stack is visible first.
  const [paletteOpen, setPaletteOpen] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches
  );
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [run, setRun] = useState<RunRecord | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<Issue[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [removed, setRemoved] = useState<{block: Block; index: number} | null>(null);
  const lastFocus = useRef<{blockId: string; field: 'value' | 'target'} | null>(null);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const [editedSinceRun, setEditedSinceRun] = useState(false);
  const [openedUpdatedAt] = useState(doc.updatedAt);

  const otherDocs = useMemo(() => docs.filter((d) => d.id !== doc.id), [docs, doc.id]);
  const allDocs = useMemo(() => [...otherDocs, {...doc, name, blocks}], [otherDocs, doc, name, blocks]);
  const savedBlocks = useMemo(() => otherDocs.filter((d) => d.kind === 'block'), [otherDocs]);

  /* ---------------- persistence (autosave) ---------------- */

  const persist = useCallback(async () => {
    const v = version.current;
    if (v === savedVersion.current) return;
    setSaveState('saving');
    try {
      const res = await api.saveDoc(doc.id, {name, description, blocks});
      savedVersion.current = v;
      setSaveState(version.current === v ? 'saved' : 'unsaved');
      setSaveError(null);
      onDocSaved(res.doc);
    } catch (e) {
      setSaveState('error');
      setSaveError((e as Error).message);
    }
  }, [doc.id, name, description, blocks, onDocSaved]);

  const markDirty = () => {
    version.current += 1;
    setEditedSinceRun(true);
    setSaveState('unsaved');
  };

  useEffect(() => {
    if (saveState !== 'unsaved') return;
    const t = window.setTimeout(persist, 700);
    return () => window.clearTimeout(t);
  }, [saveState, persist, name, description, blocks]);

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (version.current !== savedVersion.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const updateBlocks = (fn: (prev: Block[]) => Block[]) => {
    setBlocks(fn);
    setServerIssues([]);
    markDirty();
  };
  const patchBlock = (id: string, patch: Partial<Block>) =>
    updateBlocks((prev) => prev.map((b) => (b.id === id ? {...b, ...patch} : b)));

  /* ---------------- latest run for this test ---------------- */

  useEffect(() => {
    if (!isTest) return;
    let alive = true;
    api
      .listRuns(doc.id)
      .then((r) => alive && setRun(r.runs[0] ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [doc.id, isTest]);

  const runId = run?.id;
  const runRunning = run?.status === 'running';
  useEffect(() => {
    if (!runId || !runRunning) return;
    let alive = true;
    const timer = window.setInterval(async () => {
      try {
        const r = await api.getRun(runId);
        if (!alive) return;
        setRun(r.run);
        if (r.run.status !== 'running') onRunFinished(r.run);
      } catch {
        /* keep polling; a transient error should not end the view */
      }
    }, 600);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [runId, runRunning, onRunFinished]);

  const startRun = async () => {
    setRunError(null);
    setServerIssues([]);
    await persist();
    try {
      const r = await api.startRun(doc.id);
      setEditedSinceRun(false);
      setRun(r.run);
      onRunStarted(r.run);
    } catch (e) {
      setRunError((e as Error).message);
      if (e instanceof ApiError) setServerIssues(e.issues);
    }
  };

  /* ---------------- validation & run overlay ---------------- */

  const issues = useMemo(
    () => [...validateBlocks(blocks, allDocs, env.variables, doc.id), ...serverIssues],
    [blocks, allDocs, env.variables, doc.id, serverIssues]
  );
  const issuesByBlock = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const i of issues) {
      if (!i.blockId) continue;
      m.set(i.blockId, [...(m.get(i.blockId) ?? []), i.message]);
    }
    return m;
  }, [issues]);
  const generalIssues = issues.filter((i) => !i.blockId);

  const runByBlock = useMemo(() => {
    const m = new Map<string, {status: StepStatus; error?: string; note?: string; ms: number}>();
    if (!run) return m;
    for (const s of run.steps) {
      const prev = m.get(s.blockId);
      m.set(s.blockId, {
        status: combine(prev?.status, s.status),
        error: prev?.error ?? (s.error ? (s.via ? `Inside “${s.via}”, step “${s.label}”: ${s.error}` : s.error) : undefined),
        note: prev?.note ?? s.note,
        ms: (prev?.ms ?? 0) + (s.durationMs ?? 0),
      });
    }
    return m;
  }, [run]);
  const runIsStale = Boolean(
    run && run.status !== 'running' && (editedSinceRun || openedUpdatedAt > run.startedAt)
  );

  /* ---------------- add / move / remove ---------------- */

  const insertAt = (index: number, block: Block) => {
    updateBlocks((prev) => {
      const next = [...prev];
      next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
      return next;
    });
    setSelectedId(block.id);
  };

  const addFromPalette = (kind: BlockKind, ref?: string) => {
    const sel = blocks.findIndex((b) => b.id === selectedId);
    insertAt(sel >= 0 ? sel + 1 : blocks.length, createBlock(kind, ref));
  };

  const move = (index: number, to: number) => {
    if (to < 0 || to >= blocks.length || to === index) return;
    updateBlocks((prev) => {
      const next = [...prev];
      const [m] = next.splice(index, 1);
      next.splice(to, 0, m);
      return next;
    });
  };

  const remove = (index: number) => {
    const block = blocks[index];
    setRemoved({block, index});
    updateBlocks((prev) => prev.filter((_, i) => i !== index));
    setSelectedId(blocks[index + 1]?.id ?? blocks[index - 1]?.id ?? null);
  };

  const duplicate = (index: number) => {
    const src = blocks[index];
    insertAt(index + 1, {...src, id: newId(), target: src.target ? {...src.target} : undefined});
  };

  const insertVariable = (name: string) => {
    const f = lastFocus.current;
    const target = blocks.find((b) => b.id === (f?.blockId ?? selectedId));
    if (!target) return;
    const token = `{{${name}}}`;
    if (f?.field === 'target' && target.target) {
      patchBlock(target.id, {target: {...target.target, value: target.target.value + token}});
    } else if (BLOCK_DEFS[target.kind].value) {
      patchBlock(target.id, {value: (target.value ?? '') + token});
    }
  };

  /* ---------------- drag & drop ---------------- */

  const onDragStartPalette = (e: React.DragEvent, kind: BlockKind, ref?: string) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({from: 'palette', kind, ref} satisfies DragPayload));
    e.dataTransfer.effectAllowed = 'copy';
  };
  const onDragStartBlock = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({from: 'canvas', index} satisfies DragPayload));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOverBlock = (e: React.DragEvent, index: number) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropIndex(e.clientY < rect.top + rect.height / 2 ? index : index + 1);
  };
  const onDrop = (e: React.DragEvent) => {
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    const at = dropIndex ?? blocks.length;
    setDropIndex(null);
    if (!raw) return;
    e.preventDefault();
    const p = JSON.parse(raw) as DragPayload;
    if (p.from === 'palette') {
      insertAt(at, createBlock(p.kind, p.ref));
    } else {
      // Moving down: removing the original shifts the target index by one.
      move(p.index, at > p.index ? at - 1 : at);
    }
  };

  /* ---------------- palette ---------------- */

  const q = query.trim().toLowerCase();
  const paletteGroups = CATEGORIES.map((cat) => {
    if (cat.id === 'saved') {
      const items = savedBlocks.filter((s) => !q || s.name.toLowerCase().includes(q));
      return {cat, items: items.map((s) => ({key: s.id, kind: 'useBlock' as BlockKind, ref: s.id, title: s.name, desc: `${s.blocks.length} blocks`}))};
    }
    const items = PALETTE_ORDER.filter((k) => BLOCK_DEFS[k].category === cat.id)
      .map((k) => BLOCK_DEFS[k])
      .filter((d) => !q || d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q))
      .map((d) => ({key: d.kind, kind: d.kind, ref: undefined as string | undefined, title: d.title, desc: d.description}));
    return {cat, items};
  });

  const code = useMemo(() => generateSpec({...doc, name, blocks}, allDocs, env), [doc, name, blocks, allDocs, env]);
  const otherRunActive = activeRunId !== null && activeRunId !== run?.id;
  const varNames = Object.keys(env.variables);

  /* ---------------- render ---------------- */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <button
            type="button"
            onClick={async () => {
              await persist();
              onBack();
            }}
            className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            {isTest ? 'All tests' : 'All saved blocks'}
          </button>
          <label htmlFor="doc-name" className="sr-only">
            {isTest ? 'Test name' : 'Block name'}
          </label>
          <input
            id="doc-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              markDirty();
            }}
            className="w-full bg-transparent text-xl font-bold tracking-tight text-slate-900 dark:text-white rounded px-1 -mx-1 hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900"
          />
          <label htmlFor="doc-desc" className="sr-only">
            Description
          </label>
          <input
            id="doc-desc"
            value={description}
            placeholder={isTest ? 'What does this test prove? (optional)' : 'What does this block do? (optional)'}
            onChange={(e) => {
              setDescription(e.target.value);
              markDirty();
            }}
            className="w-full bg-transparent text-sm text-slate-600 dark:text-slate-400 rounded px-1 -mx-1 hover:bg-slate-100 dark:hover:bg-slate-800 placeholder:text-slate-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            role="status"
            className={cn(
              'text-xs',
              saveState === 'error' ? 'text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
            )}
          >
            {saveState === 'saved' && 'All changes saved'}
            {saveState === 'unsaved' && 'Unsaved changes…'}
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'error' && `Not saved: ${saveError}`}
          </span>
          <Button variant="secondary" icon={Code2} onClick={() => setShowCode(true)}>
            View code
          </Button>
          {isTest && (
            <Button
              variant="primary"
              icon={Play}
              disabled={runRunning || otherRunActive}
              onClick={startRun}
              title={otherRunActive ? 'Another test is running' : undefined}
            >
              {runRunning ? 'Running…' : 'Run test'}
            </Button>
          )}
        </div>
      </div>

      {runError && (
        <Notice tone="bad">
          {runError}
          {serverIssues.length > 0 && ' The blocks with problems are marked below.'}
        </Notice>
      )}
      {generalIssues.map((i) => (
        <Notice key={i.message} tone="warn">
          {i.message}
        </Notice>
      ))}
      {removed && (
        <Notice tone="neutral">
          <span className="flex flex-wrap items-center gap-3">
            Removed “{blockLabel(removed.block, allDocs)}”.
            <button
              type="button"
              className="underline font-medium"
              onClick={() => {
                insertAt(removed.index, removed.block);
                setRemoved(null);
              }}
            >
              Undo
            </button>
            <button type="button" className="underline text-slate-500" onClick={() => setRemoved(null)}>
              Dismiss
            </button>
          </span>
        </Notice>
      )}

      <div
        className={cn(
          'grid grid-cols-1 gap-4 items-start',
          isTest
            ? 'lg:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)_400px]'
            : 'lg:grid-cols-[240px_minmax(0,1fr)]'
        )}
      >
        {/* ---------- Palette ---------- */}
        <Panel as="aside" bodyClassName="p-3 space-y-4" className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <Button
            variant="secondary"
            className="w-full lg:hidden"
            aria-expanded={paletteOpen}
            aria-controls="block-palette"
            onClick={() => setPaletteOpen((o) => !o)}
          >
            {paletteOpen ? 'Hide blocks' : 'Add a block'}
          </Button>
          <div id="block-palette" className={cn('space-y-4', !paletteOpen && 'hidden lg:block')}>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              aria-label="Find a block"
              placeholder="Find a block"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cn(inputClass, 'h-8 pl-8 text-[13px]')}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Drag a block onto the stack, or click it to add it after the selected block.
          </p>
          {paletteGroups.map(({cat, items}) =>
            items.length === 0 && (cat.id !== 'saved' || q) ? null : (
              <section key={cat.id} aria-label={cat.label}>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {cat.label}
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">{cat.hint}</p>
                {items.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    None yet. Create one under Saved blocks.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {items.map((it) => {
                      const style = styleFor(it.kind);
                      return (
                        <li key={it.key}>
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => onDragStartPalette(e, it.kind, it.ref)}
                            onClick={() => addFromPalette(it.kind, it.ref)}
                            title={it.desc}
                            className={cn(
                              'w-full text-left px-2.5 py-1.5 rounded-md text-[13px] font-medium cursor-grab active:cursor-grabbing shadow-sm hover:brightness-110 transition',
                              style.chip
                            )}
                          >
                            {it.kind === 'useBlock' ? `Use: ${it.title}` : it.title}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )
          )}
          <section aria-label="Variables">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Variables
            </h3>
            {varNames.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">None in .env.json. Add them in Settings.</p>
            ) : (
              <>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">
                  Click to insert into the field you last edited.
                </p>
                <div className="flex flex-wrap gap-1">
                  {varNames.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertVariable(v)}
                      className="px-1.5 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
          </div>
        </Panel>

        {/* ---------- Stack ---------- */}
        <section
          aria-label="Block stack"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(DRAG_TYPE)) e.preventDefault();
          }}
          onDrop={onDrop}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropIndex(null);
          }}
          className="min-w-0"
        >
          {/* Hat block: where the run starts */}
          <div className="rounded-t-2xl rounded-b-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-[13px] text-slate-700 dark:text-slate-200">
            {isTest ? (
              <>
                <span className="font-semibold">When the test runs</span> · {env.browser},{' '}
                {env.viewport.width}×{env.viewport.height}, base URL{' '}
                <span className="font-mono break-all">{env.baseUrl}</span>
              </>
            ) : (
              <>
                <span className="font-semibold">Saved block</span> · these steps run wherever a test
                uses “{name}”.
              </>
            )}
          </div>

          <ol className="relative">
            {blocks.map((block, index) => (
              <li key={block.id}>
                {dropIndex === index && <DropLine />}
                <BlockCard
                  block={block}
                  index={index}
                  total={blocks.length}
                  selected={selectedId === block.id}
                  savedBlocks={savedBlocks}
                  issues={issuesByBlock.get(block.id) ?? []}
                  result={runByBlock.get(block.id)}
                  onSelect={() => setSelectedId(block.id)}
                  onPatch={(patch) => patchBlock(block.id, patch)}
                  onMove={(to) => move(index, to)}
                  onDuplicate={() => duplicate(index)}
                  onRemove={() => remove(index)}
                  onOpenSaved={(id) => onOpenDoc(id)}
                  onFocusField={(field) => (lastFocus.current = {blockId: block.id, field})}
                  onDragStart={(e) => onDragStartBlock(e, index)}
                  onDragOver={(e) => onDragOverBlock(e, index)}
                  onDragEnd={() => setDropIndex(null)}
                />
              </li>
            ))}
            {dropIndex === blocks.length && blocks.length > 0 && <DropLine />}
          </ol>

          <div
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
              e.preventDefault();
              setDropIndex(blocks.length);
            }}
            className={cn(
              'mt-1 rounded-b-2xl rounded-t-md border-2 border-dashed px-4 py-5 text-center text-[13px] transition-colors',
              dropIndex === blocks.length
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200'
                : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            )}
          >
            {blocks.length === 0
              ? 'Drop your first block here. Most tests start with “Open page”.'
              : 'Drop a block here to add it at the end.'}
          </div>
        </section>

        {/* ---------- Result ---------- */}
        {isTest && (
          <Panel
            as="aside"
            title="Last run"
            description={
              run
                ? runIsStale
                  ? 'From before your latest edits. Run again to check them.'
                  : `#${run.number} · ${new Date(run.startedAt).toLocaleString()}`
                : undefined
            }
            className="lg:col-span-2 2xl:col-span-1 2xl:sticky 2xl:top-4 2xl:max-h-[calc(100vh-2rem)] 2xl:overflow-y-auto"
          >
            {run ? (
              <RunReport run={run} compact />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Not run yet. Press <strong>Run test</strong>: a real {env.browser} browser opens{' '}
                <span className="font-mono break-all">{env.baseUrl}</span> and works through the
                stack. Each block lights up green or red as it goes.
              </p>
            )}
          </Panel>
        )}
      </div>

      {showCode && <CodeDialog code={code} fileName={`${slug(name)}.spec.ts`} onClose={() => setShowCode(false)} />}
    </div>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'test';
}

function DropLine() {
  return <div aria-hidden="true" className="h-1 my-0.5 rounded-full bg-blue-500" />;
}

/* ================================================================== */
/* One puzzle block                                                    */
/* ================================================================== */

interface BlockCardProps {
  block: Block;
  index: number;
  total: number;
  selected: boolean;
  savedBlocks: StudioDoc[];
  issues: string[];
  result?: {status: StepStatus; error?: string; note?: string; ms: number};
  onSelect: () => void;
  onPatch: (patch: Partial<Block>) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onOpenSaved: (id: string) => void;
  onFocusField: (field: 'value' | 'target') => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function BlockCard({
  block,
  index,
  total,
  selected,
  savedBlocks,
  issues,
  result,
  onSelect,
  onPatch,
  onMove,
  onDuplicate,
  onRemove,
  onOpenSaved,
  onFocusField,
  onDragStart,
  onDragOver,
  onDragEnd,
}: BlockCardProps) {
  const def = BLOCK_DEFS[block.kind];
  const style = styleFor(block.kind);
  const t = block.target;
  const byMeta = TARGET_BY.find((x) => x.id === t?.by) ?? TARGET_BY[0];
  const id = (f: string) => `blk-${block.id}-${f}`;
  const showTarget = def.needsTarget;
  const saved = block.kind === 'useBlock' ? savedBlocks.find((s) => s.id === block.ref) : undefined;

  return (
    <div
      onDragOver={onDragOver}
      onFocus={onSelect}
      onClick={onSelect}
      className={cn(
        'group relative mt-1 rounded-md border-2 pl-1 transition-shadow',
        style.block,
        selected && 'ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-50 dark:ring-offset-slate-950',
        block.disabled && 'opacity-50',
        // Only failures and the live step override the category colour;
        // passed blocks keep their puzzle colour and show a badge.
        result?.status === 'failed' && 'border-red-500 dark:border-red-500',
        result?.status === 'running' && 'border-blue-500 dark:border-blue-400'
      )}
    >
      {/* Puzzle tab: visually hooks this block under the previous one. */}
      <span
        aria-hidden="true"
        className={cn('absolute -top-1.5 left-8 h-2.5 w-7 rounded-t-md', style.dot)}
      />
      <div className="flex items-start gap-2 p-2.5">
        <span
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="mt-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          title="Drag to move"
          aria-hidden="true"
        >
          <GripVertical className="w-4 h-4" />
        </span>
        <span className="mt-1 w-5 text-right font-mono text-xs text-slate-500 dark:text-slate-400 shrink-0">{index + 1}</span>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className={cn('px-2 py-1 rounded text-[13px] font-semibold', style.chip)}>
              {block.kind === 'useBlock' ? 'Use block' : def.title}
            </span>

            {block.kind === 'useBlock' && (
              <>
                <label htmlFor={id('ref')} className="sr-only">Saved block</label>
                <select
                  id={id('ref')}
                  value={block.ref ?? ''}
                  onChange={(e) => onPatch({ref: e.target.value})}
                  className={cn(fieldSelect, 'min-w-40')}
                >
                  {!saved && <option value={block.ref ?? ''}>Missing block</option>}
                  {savedBlocks.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.blocks.length} blocks)
                    </option>
                  ))}
                </select>
                {saved && (
                  <button
                    type="button"
                    onClick={() => onOpenSaved(saved.id)}
                    className="text-xs underline text-slate-600 dark:text-slate-300"
                  >
                    Edit “{saved.name}”
                  </button>
                )}
              </>
            )}

            {showTarget && (
              <>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {def.targetOptional ? 'in (optional)' : 'the element with'}
                </span>
                <label htmlFor={id('by')} className="sr-only">Find element by</label>
                <select
                  id={id('by')}
                  value={t?.by ?? 'text'}
                  onChange={(e) =>
                    onPatch({target: {...(t ?? {value: ''}), by: e.target.value as TargetBy, role: e.target.value === 'role' ? t?.role ?? 'button' : undefined}})
                  }
                  className={fieldSelect}
                >
                  {TARGET_BY.map((x) => (
                    <option key={x.id} value={x.id}>{x.label}</option>
                  ))}
                </select>
                {t?.by === 'role' && (
                  <>
                    <label htmlFor={id('role')} className="sr-only">Role</label>
                    <select
                      id={id('role')}
                      value={t.role ?? 'button'}
                      onChange={(e) => onPatch({target: {...t, role: e.target.value}})}
                      className={fieldSelect}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-600 dark:text-slate-400">named</span>
                  </>
                )}
                <label htmlFor={id('target')} className="sr-only">
                  {byMeta.help}
                </label>
                <input
                  id={id('target')}
                  value={t?.value ?? ''}
                  placeholder={byMeta.placeholder}
                  title={byMeta.help}
                  onFocus={() => onFocusField('target')}
                  onChange={(e) => onPatch({target: {...(t ?? {by: 'text'}), value: e.target.value}})}
                  className={cn(fieldInput, 'flex-1 min-w-40', t?.by === 'css' || t?.by === 'testid' ? 'font-mono' : '')}
                />
              </>
            )}

            {def.value && (
              <>
                <label htmlFor={id('value')} className="text-xs text-slate-600 dark:text-slate-400">
                  {def.value.label.toLowerCase()}
                </label>
                {def.value.type === 'key' ? (
                  <>
                    <input
                      id={id('value')}
                      list="key-names"
                      value={block.value ?? ''}
                      placeholder={def.value.placeholder}
                      onFocus={() => onFocusField('value')}
                      onChange={(e) => onPatch({value: e.target.value})}
                      className={cn(fieldInput, 'w-36 font-mono')}
                    />
                    <datalist id="key-names">
                      {['Enter', 'Tab', 'Escape', 'Backspace', 'ArrowDown', 'ArrowUp', 'Space', 'Control+A'].map((k) => (
                        <option key={k} value={k} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <input
                    id={id('value')}
                    type={def.value.type === 'number' ? 'number' : 'text'}
                    min={def.value.type === 'number' ? 0 : undefined}
                    value={block.value ?? ''}
                    placeholder={def.value.placeholder}
                    onFocus={() => onFocusField('value')}
                    onChange={(e) => onPatch({value: e.target.value})}
                    className={cn(
                      fieldInput,
                      def.value.type === 'number' ? 'w-24 font-mono' : 'flex-1 min-w-40',
                      def.value.type === 'url' && 'font-mono'
                    )}
                  />
                )}
              </>
            )}

            {result && (
              <span className="ml-auto flex items-center gap-1.5">
                {result.ms > 0 && result.status !== 'running' && (
                  <span className="text-[11px] font-mono text-slate-500">{(result.ms / 1000).toFixed(2)} s</span>
                )}
                <StatusBadge status={result.status} />
              </span>
            )}
            {block.disabled && <Badge>Skipped when running</Badge>}
          </div>

          {(selected || issues.length > 0) && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {block.kind === 'useBlock' ? def.description : def.value?.help ?? def.description}
            </p>
          )}
          {issues.map((m) => (
            <p key={m} className="text-xs font-medium text-amber-800 dark:text-amber-300">
              {m}
            </p>
          ))}
          {result?.error && (
            <p className="text-[13px] text-red-800 dark:text-red-300 [overflow-wrap:anywhere]">{result.error}</p>
          )}
          {result?.note && <p className="text-xs text-amber-800 dark:text-amber-300">{result.note}</p>}

          <div
            className={cn(
              'flex flex-wrap gap-1 pt-0.5',
              selected ? 'flex' : 'hidden group-hover:flex group-focus-within:flex'
            )}
          >
            <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => onMove(index - 1)}>
              Move up
            </Button>
            <Button size="sm" variant="ghost" disabled={index === total - 1} onClick={() => onMove(index + 1)}>
              Move down
            </Button>
            <Button size="sm" variant="ghost" onClick={onDuplicate}>
              Duplicate
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onPatch({disabled: !block.disabled})}>
              {block.disabled ? 'Enable' : 'Skip'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onRemove} className="text-red-700 dark:text-red-400">
              Remove
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Generated code                                                      */
/* ================================================================== */

function CodeDialog({code, fileName, onClose}: {code: string; fileName: string; onClose: () => void}) {
  const [copied, setCopied] = useState(false);
  const download = () => {
    const url = URL.createObjectURL(new Blob([code], {type: 'text/typescript;charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="code-dialog-title"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 id="code-dialog-title" className="text-sm font-semibold text-slate-900 dark:text-white">
              Playwright code
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The same steps as a standard <span className="font-mono">@playwright/test</span> file, for CI or code review.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(code).catch(() => undefined);
                setCopied(true);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="sm" variant="secondary" icon={Download} onClick={download}>
              {fileName}
            </Button>
            <Button size="sm" variant="primary" autoFocus onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <pre className="m-0 p-4 overflow-auto text-xs font-mono bg-slate-950 text-slate-100 rounded-b-lg">{code}</pre>
      </div>
    </div>
  );
}
