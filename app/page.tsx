'use client';

import React, {useCallback, useEffect, useState} from 'react';
import {api, type ConfigResponse} from '@/lib/client-api';
import {demoTestBlocks, isDemoBaseUrl} from '@/lib/examples';
import type {RunRecord, StudioDoc, StudioEnv} from '@/lib/studio-types';
import BlockEditor from '@/components/BlockEditor';
import LibraryView from '@/components/LibraryView';
import RunsView from '@/components/RunsView';
import SetupView from '@/components/SetupView';
import {Button, Notice} from '@/components/ui';
import {cn} from '@/lib/utils';
import {
  CheckCircle2,
  FlaskConical,
  History,
  Puzzle,
  Settings,
  XCircle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Hash routes keep the browser back button and reloads working.       */
/* ------------------------------------------------------------------ */

type Route =
  | {name: 'tests'}
  | {name: 'blocks'}
  | {name: 'doc'; id: string}
  | {name: 'runs'; id: string | null}
  | {name: 'settings'};

function parseHash(hash: string): Route {
  const [, a, b] = hash.replace(/^#/, '').split('/');
  if (a === 'blocks') return {name: 'blocks'};
  if (a === 'edit' && b) return {name: 'doc', id: decodeURIComponent(b)};
  if (a === 'runs') return {name: 'runs', id: b ? decodeURIComponent(b) : null};
  if (a === 'settings') return {name: 'settings'};
  return {name: 'tests'};
}

function toHash(r: Route): string {
  switch (r.name) {
    case 'tests':
      return '#/tests';
    case 'blocks':
      return '#/blocks';
    case 'doc':
      return `#/edit/${encodeURIComponent(r.id)}`;
    case 'runs':
      return r.id ? `#/runs/${encodeURIComponent(r.id)}` : '#/runs';
    case 'settings':
      return '#/settings';
  }
}

function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? {name: 'tests'} : parseHash(window.location.hash)
  );
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((r: Route) => {
    const h = toHash(r);
    if (window.location.hash !== h) window.location.hash = h;
    setRoute(r);
    window.scrollTo(0, 0);
  }, []);
  return [route, go];
}

/* ------------------------------------------------------------------ */

export default function StudioApp() {
  const [route, go] = useHashRoute();
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [docs, setDocs] = useState<StudioDoc[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{tone: 'good' | 'bad'; text: string; id: number} | null>(null);
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  const notify = useCallback((tone: 'good' | 'bad', text: string) => {
    setToast({tone, text, id: Date.now()});
  }, []);
  useEffect(() => {
    if (!toast || toast.tone === 'bad') return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const reloadAll = useCallback(async () => {
    const [d, r] = await Promise.all([api.listDocs(), api.listRuns()]);
    setDocs(d.docs);
    setRuns(r.runs);
    setActiveRunId(r.activeRunId);
  }, []);

  useEffect(() => {
    api
      .getConfig()
      .then(async (c) => {
        setConfig(c);
        if (c.state === 'ok') await reloadAll();
      })
      .catch((e) => setLoadError((e as Error).message));
  }, [reloadAll]);

  // Keep list badges current while a run is going.
  useEffect(() => {
    if (!activeRunId) return;
    const t = window.setInterval(() => {
      api
        .listRuns()
        .then((r) => {
          setRuns(r.runs);
          setActiveRunId(r.activeRunId);
        })
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(t);
  }, [activeRunId]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('studio-theme', next ? 'dark' : 'light');
    } catch {
      /* storage blocked: theme still applies for this visit */
    }
  };

  const runTest = async (testId: string) => {
    try {
      const {run} = await api.startRun(testId);
      setActiveRunId(run.id);
      setRuns((rs) => [run, ...rs]);
      setRefreshKey((k) => k + 1);
      go({name: 'runs', id: run.id});
    } catch (e) {
      notify('bad', (e as Error).message);
      if ((e as {status?: number}).status === 400) go({name: 'doc', id: testId});
    }
  };

  const onDocSaved = useCallback((doc: StudioDoc) => {
    setDocs((ds) => ds.map((d) => (d.id === doc.id ? doc : d)));
  }, []);
  const onRunStarted = useCallback((run: RunRecord) => {
    setActiveRunId(run.id);
    setRuns((rs) => [run, ...rs.filter((r) => r.id !== run.id)]);
  }, []);
  const onRunFinished = useCallback(
    (run: RunRecord) => {
      setActiveRunId(null);
      setRuns((rs) => rs.map((r) => (r.id === run.id ? run : r)));
      notify(
        run.status === 'passed' ? 'good' : 'bad',
        run.status === 'passed'
          ? `“${run.testName}” passed.`
          : `“${run.testName}” ${run.status === 'error' ? 'could not run' : 'failed'}. See the red block.`
      );
    },
    [notify]
  );

  /* ---------------- loading / first run ---------------- */

  if (loadError) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-slate-50 dark:bg-slate-950">
        <div role="alert" className="max-w-md text-center space-y-2 text-sm text-slate-700 dark:text-slate-300">
          <p className="font-semibold text-red-700 dark:text-red-400">The studio could not start</p>
          <p>{loadError}</p>
        </div>
      </div>
    );
  }
  if (!config) {
    return (
      <div role="status" className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (config.state !== 'ok') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Playwright Studio</p>
            <h1 className="text-2xl font-bold tracking-tight mt-1">
              {config.state === 'missing' ? 'Which site are we testing?' : 'Your .env.json needs a fix'}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Fill this in once. You can change it any time under Settings.
            </p>
          </div>
          <SetupView
            initial={null}
            fileErrors={config.state === 'invalid' ? config.errors : undefined}
            firstRun
            filePath={config.file}
            onSaved={async (env) => {
              setConfig({state: 'ok', env, file: config.file});
              await reloadAll().catch((e) => notify('bad', (e as Error).message));
              go({name: 'tests'});
            }}
          />
        </div>
      </div>
    );
  }

  const env: StudioEnv = config.env;
  const tests = docs.filter((d) => d.kind === 'test');
  const savedBlocks = docs.filter((d) => d.kind === 'block');
  const runningTestId = runs.find((r) => r.id === activeRunId)?.testId ?? null;
  const editing = route.name === 'doc' ? docs.find((d) => d.id === route.id) : undefined;

  const nav = [
    {route: {name: 'tests'} as Route, label: 'Tests', icon: FlaskConical, count: tests.length, active: route.name === 'tests' || editing?.kind === 'test'},
    {route: {name: 'blocks'} as Route, label: 'Saved blocks', icon: Puzzle, count: savedBlocks.length, active: route.name === 'blocks' || editing?.kind === 'block'},
    {route: {name: 'runs', id: null} as Route, label: 'Runs', icon: History, count: runs.length, active: route.name === 'runs'},
    {route: {name: 'settings'} as Route, label: 'Settings', icon: Settings, active: route.name === 'settings'},
  ];

  const titles: Record<Route['name'], {title: string; sub: string}> = {
    tests: {title: 'Tests', sub: 'Each test is a stack of blocks that a real browser follows from top to bottom.'},
    blocks: {title: 'Saved blocks', sub: 'Reusable stacks, like logging in, that many tests can share.'},
    runs: {title: 'Runs', sub: 'What happened in each run, step by step, with screenshots.'},
    settings: {title: 'Settings', sub: 'The site, browser and variables stored in .env.json.'},
    doc: {title: '', sub: ''},
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 lg:flex">
      <aside className="lg:w-56 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="px-4 pt-4 pb-3">
          <span className="block text-[15px] font-bold tracking-tight font-display">Playwright Studio</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">Build browser tests from blocks</span>
        </div>
        <nav aria-label="Main" className="px-2 pb-3 lg:flex-1">
          <ul className="flex lg:flex-col gap-1 overflow-x-auto [scrollbar-width:none]">
            {nav.map((n) => {
              const Icon = n.icon;
              return (
                <li key={n.label} className="shrink-0">
                  <button
                    type="button"
                    aria-current={n.active ? 'page' : undefined}
                    onClick={() => go(n.route)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-2.5 h-9 rounded-md text-sm whitespace-nowrap transition-colors',
                      n.active
                        ? 'bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className={cn('w-4 h-4', n.active && 'text-blue-600 dark:text-blue-400')} aria-hidden="true" />
                      {n.label}
                    </span>
                    {n.count !== undefined && (
                      <span className="hidden lg:inline text-xs font-mono text-slate-400">{n.count}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="hidden lg:block px-4 py-4 border-t border-slate-200 dark:border-slate-800 text-xs space-y-2">
          <div className="text-slate-500 dark:text-slate-400">Testing</div>
          <div className="font-mono text-slate-800 dark:text-slate-200 break-all">{env.baseUrl}</div>
          <div className="text-slate-500 dark:text-slate-400">
            {env.browser} · {env.viewport.width}×{env.viewport.height}
            {activeRunId && <span className="block text-blue-700 dark:text-blue-400 mt-1">A test is running…</span>}
          </div>
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={() => go({name: 'settings'})} className="text-blue-700 dark:text-blue-400 hover:underline">
              Change site
            </button>
            <button type="button" onClick={toggleTheme} className="text-slate-600 dark:text-slate-400 hover:underline">
              {isDark ? 'Light theme' : 'Dark theme'}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 lg:p-8 space-y-6">
        {route.name !== 'doc' && (
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{titles[route.name].title}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{titles[route.name].sub}</p>
            </div>
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={toggleTheme}>
              {isDark ? 'Light theme' : 'Dark theme'}
            </Button>
          </header>
        )}

        {(route.name === 'tests' || route.name === 'blocks') && (
          <LibraryView
            kind={route.name === 'tests' ? 'test' : 'block'}
            docs={docs}
            runs={runs}
            runningTestId={runningTestId}
            showDemoOption={isDemoBaseUrl(env.baseUrl) && !tests.some((t) => t.name === 'Demo: log in and place an order')}
            onCreate={async (name) => {
              const {doc} = await api.createDoc({kind: route.name === 'tests' ? 'test' : 'block', name});
              setDocs((ds) => [...ds, doc]);
              go({name: 'doc', id: doc.id});
            }}
            onCreateDemo={async () => {
              const {doc} = await api.createDoc({
                kind: 'test',
                name: 'Demo: log in and place an order',
                blocks: demoTestBlocks(env.variables),
              });
              setDocs((ds) => [...ds, doc]);
              go({name: 'doc', id: doc.id});
            }}
            onOpen={(id) => go({name: 'doc', id})}
            onRun={runTest}
            onDuplicate={async (id) => {
              const {doc} = await api.duplicateDoc(id);
              setDocs((ds) => [...ds, doc]);
              notify('good', `Copied as “${doc.name}”.`);
            }}
            onDelete={async (id) => {
              await api.deleteDoc(id);
              setDocs((ds) => ds.filter((d) => d.id !== id));
            }}
          />
        )}

        {route.name === 'doc' &&
          (editing ? (
            <BlockEditor
              key={editing.id}
              doc={editing}
              docs={docs}
              env={env}
              activeRunId={activeRunId}
              onBack={() => go({name: editing.kind === 'test' ? 'tests' : 'blocks'})}
              onDocSaved={onDocSaved}
              onOpenDoc={(id) => go({name: 'doc', id})}
              onRunStarted={onRunStarted}
              onRunFinished={onRunFinished}
            />
          ) : (
            <Notice tone="warn">
              This test or block no longer exists.{' '}
              <button type="button" className="underline" onClick={() => go({name: 'tests'})}>
                Back to tests
              </button>
            </Notice>
          ))}

        {route.name === 'runs' && (
          <RunsView
            selectedRunId={route.id}
            onSelectRun={(id) => go({name: 'runs', id})}
            onOpenTest={(id) => go({name: 'doc', id})}
            onRunTest={runTest}
            testExists={(id) => docs.some((d) => d.id === id)}
            refreshKey={refreshKey}
          />
        )}

        {route.name === 'settings' && (
          <SetupView
            initial={env}
            firstRun={false}
            filePath={config.file}
            onSaved={(next) => {
              setConfig({state: 'ok', env: next, file: config.file});
              notify('good', 'Settings saved to .env.json.');
            }}
          />
        )}
      </main>

      <div aria-live="polite" className="fixed bottom-4 right-4 left-4 sm:left-auto z-40 sm:max-w-md">
        {toast && (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg text-[13px] bg-white dark:bg-slate-900',
              toast.tone === 'bad' ? 'border-red-300 dark:border-red-900' : 'border-emerald-300 dark:border-emerald-900'
            )}
          >
            {toast.tone === 'bad' ? (
              <XCircle className="w-4 h-4 mt-0.5 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            )}
            <span className="flex-1">{toast.text}</span>
            <button type="button" onClick={() => setToast(null)} className="text-xs underline text-slate-500">
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
