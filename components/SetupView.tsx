'use client';

import React, {useMemo, useState} from 'react';
import {api, ApiError} from '@/lib/client-api';
import {
  BROWSERS,
  DEFAULT_ENV,
  VARIABLE_NAME,
  VIEWPORT_PRESETS,
  isSensitiveName,
  validateEnv,
  type EnvErrors,
} from '@/lib/env-schema';
import type {StudioEnv} from '@/lib/studio-types';
import {Button, Field, Notice, Panel, inputClass, selectClass} from '@/components/ui';
import {cn} from '@/lib/utils';
import {Plus} from 'lucide-react';

interface VarRow {
  id: number;
  name: string;
  value: string;
  reveal: boolean;
}

interface SetupViewProps {
  initial: StudioEnv | null;
  /** Errors from an existing but broken .env.json. */
  fileErrors?: EnvErrors;
  firstRun: boolean;
  filePath: string;
  onSaved: (env: StudioEnv) => void;
}

let rowSeq = 0;
const toRows = (vars: Record<string, string>): VarRow[] =>
  Object.entries(vars).map(([name, value]) => ({id: ++rowSeq, name, value, reveal: false}));

export default function SetupView({initial, fileErrors, firstRun, filePath, onSaved}: SetupViewProps) {
  const start = initial ?? DEFAULT_ENV;
  const [baseUrl, setBaseUrl] = useState(start.baseUrl);
  const [browser, setBrowser] = useState(start.browser);
  const [showWindow, setShowWindow] = useState(!start.headless);
  const [timeoutSec, setTimeoutSec] = useState(String(start.timeoutMs / 1000));
  const [width, setWidth] = useState(String(start.viewport.width));
  const [height, setHeight] = useState(String(start.viewport.height));
  const [rows, setRows] = useState<VarRow[]>(() =>
    initial && Object.keys(initial.variables).length > 0
      ? toRows(initial.variables)
      : [{id: ++rowSeq, name: 'USERNAME', value: '', reveal: false}, {id: ++rowSeq, name: 'PASSWORD', value: '', reveal: false}]
  );
  const [errors, setErrors] = useState<EnvErrors>(fileErrors ?? {});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [check, setCheck] = useState<
    {state: 'idle'} | {state: 'checking'} | {state: 'done'; ok: boolean; text: string}
  >({state: 'idle'});

  const draft = useMemo(() => {
    const variables: Record<string, string> = {};
    for (const r of rows) if (r.name.trim()) variables[r.name.trim()] = r.value;
    return {
      baseUrl,
      browser,
      headless: !showWindow,
      timeoutMs: Math.round(Number(timeoutSec) * 1000),
      viewport: {width: Number(width), height: Number(height)},
      variables,
    };
  }, [baseUrl, browser, showWindow, timeoutSec, width, height, rows]);

  const rowProblems = useMemo(() => {
    const seen = new Set<string>();
    const out: Record<number, string> = {};
    for (const r of rows) {
      const n = r.name.trim();
      if (!n) {
        if (r.value) out[r.id] = 'Give this variable a name.';
        continue;
      }
      if (!VARIABLE_NAME.test(n)) out[r.id] = 'Letters, digits and _ only; start with a letter.';
      else if (seen.has(n)) out[r.id] = 'This name is used twice.';
      seen.add(n);
    }
    return out;
  }, [rows]);

  const preview = useMemo(() => {
    const masked = {
      ...draft,
      variables: Object.fromEntries(
        Object.entries(draft.variables).map(([k, v]) => [k, isSensitiveName(k) && v ? '••••••' : v])
      ),
    };
    return JSON.stringify(masked, null, 2);
  }, [draft]);

  const runCheck = async () => {
    setCheck({state: 'checking'});
    try {
      const r = await api.checkUrl(baseUrl);
      setCheck({
        state: 'done',
        ok: r.ok,
        text: r.ok
          ? `Reachable: HTTP ${r.status} in ${r.ms} ms${r.finalUrl && r.finalUrl.replace(/\/$/, '') !== baseUrl.replace(/\/$/, '') ? ` (redirects to ${r.finalUrl})` : ''}.`
          : r.status
            ? `The site answered HTTP ${r.status}. Tests may fail until it is healthy.`
            : `Not reachable: ${r.error}`,
      });
    } catch (e) {
      setCheck({state: 'done', ok: false, text: (e as Error).message});
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (Object.keys(rowProblems).length > 0) {
      setSaveError('Fix the highlighted variables first.');
      return;
    }
    const local = validateEnv(draft);
    if (!local.ok) {
      setErrors(local.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await api.saveConfig(local.env);
      setSavedAt(new Date().toLocaleTimeString());
      onSaved(res.env);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.envErrors);
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const demoUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/sample-app` : '';
  const presetMatch = VIEWPORT_PRESETS.find(
    (p) => String(p.width) === width && String(p.height) === height
  );

  return (
    <form onSubmit={save} className="space-y-6 max-w-5xl" noValidate>
      {firstRun && (
        <Notice tone="info">
          Tell the studio which site to test. These settings are written to{' '}
          <code className="font-mono">.env.json</code> in the project folder. That file is
          ignored by git, so passwords you put here stay on this machine.
        </Notice>
      )}
      {fileErrors?.file && <Notice tone="bad">{fileErrors.file}</Notice>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="space-y-6">
          <Panel title="Site under test" description="Every “Open page” block starts from this address.">
            <div className="space-y-4">
              <Field
                label="Base URL"
                htmlFor="env-base-url"
                required
                hint={
                  errors.baseUrl ? undefined : 'Example: https://staging.example.com. A path like /app is kept.'
                }
              >
                <div className="flex flex-wrap gap-2">
                  <input
                    id="env-base-url"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://staging.example.com"
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      setCheck({state: 'idle'});
                    }}
                    aria-invalid={Boolean(errors.baseUrl)}
                    aria-describedby={errors.baseUrl ? 'env-base-url-error' : undefined}
                    className={cn(inputClass, 'flex-1 min-w-56 font-mono', errors.baseUrl && 'border-red-500')}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!baseUrl.trim() || check.state === 'checking'}
                    onClick={runCheck}
                  >
                    {check.state === 'checking' ? 'Checking…' : 'Check connection'}
                  </Button>
                </div>
              </Field>
              {errors.baseUrl && (
                <p id="env-base-url-error" className="text-[13px] text-red-700 dark:text-red-400 -mt-2">
                  {errors.baseUrl}
                </p>
              )}
              {check.state === 'done' && (
                <p
                  role="status"
                  className={cn(
                    'text-[13px] -mt-2',
                    check.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                  )}
                >
                  {check.text}
                </p>
              )}
              <p className="text-[13px] text-slate-500 dark:text-slate-400">
                No site handy?{' '}
                <button
                  type="button"
                  className="text-blue-700 dark:text-blue-400 underline"
                  onClick={() => {
                    setBaseUrl(demoUrl);
                    setCheck({state: 'idle'});
                  }}
                >
                  Use the built-in demo site
                </button>{' '}
                <span className="font-mono">({demoUrl || '/sample-app'})</span>.
              </p>
            </div>
          </Panel>

          <Panel title="Browser" description="How tests are run on this machine.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Engine"
                htmlFor="env-browser"
                hint={browser === 'chromium' ? 'Installed.' : `Needs: npx playwright install ${browser}`}
              >
                <select
                  id="env-browser"
                  value={browser}
                  onChange={(e) => setBrowser(e.target.value as StudioEnv['browser'])}
                  className={cn(selectClass, 'w-full')}
                >
                  {BROWSERS.map((b) => (
                    <option key={b} value={b}>
                      {b === 'chromium' ? 'Chromium (Chrome, Edge)' : b === 'firefox' ? 'Firefox' : 'WebKit (Safari)'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Wait up to (seconds)"
                htmlFor="env-timeout"
                hint={errors.timeoutMs ?? 'How long a block may wait for an element before it fails.'}
              >
                <input
                  id="env-timeout"
                  type="number"
                  min={1}
                  max={120}
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(e.target.value)}
                  aria-invalid={Boolean(errors.timeoutMs)}
                  className={cn(inputClass, 'font-mono', errors.timeoutMs && 'border-red-500')}
                />
              </Field>
              <Field
                label="Screen size"
                htmlFor="env-viewport"
                hint={errors.viewport ?? `${width} × ${height} pixels`}
              >
                <select
                  id="env-viewport"
                  value={presetMatch ? presetMatch.label : 'custom'}
                  onChange={(e) => {
                    const p = VIEWPORT_PRESETS.find((x) => x.label === e.target.value);
                    if (p) {
                      setWidth(String(p.width));
                      setHeight(String(p.height));
                    }
                  }}
                  className={cn(selectClass, 'w-full')}
                >
                  {VIEWPORT_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label} ({p.width} × {p.height})
                    </option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Width" htmlFor="env-width">
                  <input
                    id="env-width"
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    className={cn(inputClass, 'font-mono', errors.viewport && 'border-red-500')}
                  />
                </Field>
                <Field label="Height" htmlFor="env-height">
                  <input
                    id="env-height"
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className={cn(inputClass, 'font-mono', errors.viewport && 'border-red-500')}
                  />
                </Field>
              </div>
              <label className="sm:col-span-2 flex items-start gap-2.5 text-sm text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWindow}
                  onChange={(e) => setShowWindow(e.target.checked)}
                  className="w-4 h-4 mt-0.5"
                />
                <span>
                  Show the browser window while a test runs
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Useful while building a test. Leave off for faster, quiet runs.
                  </span>
                </span>
              </label>
            </div>
          </Panel>

          <Panel
            title="Variables"
            description={
              <>
                Values your blocks can use, written as{' '}
                <code className="font-mono">{'{{NAME}}'}</code>. Good for logins and test data.
              </>
            }
            actions={
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={Plus}
                onClick={() => setRows((r) => [...r, {id: ++rowSeq, name: '', value: '', reveal: false}])}
              >
                Add variable
              </Button>
            }
          >
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No variables yet.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((r, i) => {
                  const sensitive = isSensitiveName(r.name);
                  return (
                    <li key={r.id}>
                      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2 items-center">
                        <input
                          aria-label={`Variable ${i + 1} name`}
                          placeholder="NAME"
                          value={r.name}
                          onChange={(e) =>
                            setRows((rs) =>
                              rs.map((x) =>
                                x.id === r.id ? {...x, name: e.target.value.replace(/\s/g, '_').toUpperCase()} : x
                              )
                            )
                          }
                          aria-invalid={Boolean(rowProblems[r.id])}
                          className={cn(inputClass, 'font-mono', rowProblems[r.id] && 'border-red-500')}
                        />
                        <div className="relative">
                          <input
                            aria-label={`Value of ${r.name || `variable ${i + 1}`}`}
                            type={sensitive && !r.reveal ? 'password' : 'text'}
                            autoComplete="off"
                            placeholder="value"
                            value={r.value}
                            onChange={(e) =>
                              setRows((rs) => rs.map((x) => (x.id === r.id ? {...x, value: e.target.value} : x)))
                            }
                            className={cn(inputClass, sensitive && 'pr-16')}
                          />
                          {sensitive && (
                            <button
                              type="button"
                              onClick={() =>
                                setRows((rs) => rs.map((x) => (x.id === r.id ? {...x, reveal: !x.reveal} : x)))
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white underline"
                            >
                              {r.reveal ? 'Hide' : 'Show'}
                            </button>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                        >
                          Remove
                        </Button>
                      </div>
                      {rowProblems[r.id] && (
                        <p className="text-xs text-red-700 dark:text-red-400 mt-1">{rowProblems[r.id]}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {errors.variables && <p className="text-[13px] text-red-700 dark:text-red-400 mt-2">{errors.variables}</p>}
          </Panel>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6">
          <Panel title=".env.json" description={filePath} bodyClassName="p-0">
            <pre className="m-0 p-4 text-xs font-mono overflow-x-auto bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 rounded-b-lg">
              {preview}
            </pre>
          </Panel>
          {saveError && <Notice tone="bad">{saveError}</Notice>}
          <Button type="submit" variant="primary" className="w-full" disabled={saving}>
            {saving ? 'Saving…' : firstRun ? 'Save and start building' : 'Save settings'}
          </Button>
          {savedAt && !firstRun && (
            <p role="status" className="text-[13px] text-emerald-700 dark:text-emerald-400 text-center">
              Saved to .env.json at {savedAt}.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
