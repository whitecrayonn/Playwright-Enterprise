'use client';

import React, {useMemo, useState} from 'react';
import {
  BrowserEngine,
  ExecutionRun,
  PlatformState,
  RoleType,
} from '@/lib/types';
import {canPerformAction} from '@/lib/action-registry';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  GitCompare,
  Play,
  Search,
  Terminal,
  XCircle,
} from 'lucide-react';

interface ExecutionMonitorViewProps {
  state: PlatformState;
  selectedRunId: string | null;
  onSelectRunId: (runId: string) => void;
  onExecuteTestCase: (
    testCaseId: string,
    browser: BrowserEngine
  ) => Promise<void>;
  onExecuteSuite: (
    testSuiteId: string,
    browser: BrowserEngine
  ) => Promise<void>;
  onCancelExecution: (executionId: string) => Promise<void>;
  currentRole: RoleType;
  isExecuting: boolean;
}

export default function ExecutionMonitorView({
  state,
  selectedRunId,
  onSelectRunId,
  onExecuteTestCase,
  onExecuteSuite,
  onCancelExecution,
  currentRole,
  isExecuting,
}: ExecutionMonitorViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [browserFilter, setBrowserFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suiteToRun, setSuiteToRun] = useState<string>(
    state.testSuites[0]?.id || 'all'
  );
  const [suiteBrowser, setSuiteBrowser] = useState<BrowserEngine>('chromium');
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [compareRunIdB, setCompareRunIdB] = useState<string>(
    state.executions[1]?.id || state.executions[0]?.id || ''
  );
  const [reportTab, setReportTab] = useState<'steps' | 'logs' | 'spec' | 'artifacts'>('steps');

  const canExecute = canPerformAction(currentRole, 'canExecuteTests');

  const filteredExecutions = useMemo(() => {
    return state.executions.filter((ex) => {
      const matchStatus = statusFilter === 'all' || ex.status === statusFilter;
      const matchBrowser =
        browserFilter === 'all' || ex.browser === browserFilter;
      const matchProj =
        projectFilter === 'all' || ex.projectId === projectFilter;
      const matchSearch =
        !searchQuery.trim() ||
        ex.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.testCaseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.testCaseTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.workerName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchBrowser && matchProj && matchSearch;
    });
  }, [
    state.executions,
    statusFilter,
    browserFilter,
    projectFilter,
    searchQuery,
  ]);

  const activeRun: ExecutionRun | undefined = useMemo(() => {
    if (selectedRunId) {
      const found = state.executions.find((e) => e.id === selectedRunId);
      if (found) return found;
    }
    return filteredExecutions[0] || state.executions[0];
  }, [selectedRunId, filteredExecutions, state.executions]);

  const compareRunB: ExecutionRun | undefined = useMemo(() => {
    return state.executions.find((e) => e.id === compareRunIdB);
  }, [state.executions, compareRunIdB]);

  const handleExportCsv = () => {
    const headers = [
      'Execution ID',
      'Test Code',
      'Title',
      'Status',
      'Browser',
      'Environment',
      'Worker',
      'Duration (ms)',
      'Passed Steps',
      'Failed Steps',
      'Linked Issue',
      'Started At',
    ];
    const rows = filteredExecutions.map((e) => [
      e.id,
      e.testCaseCode,
      `"${e.testCaseTitle.replace(/"/g, '""')}"`,
      e.status,
      e.browser,
      `"${e.environmentName}"`,
      e.workerName,
      e.durationMs,
      e.passedSteps,
      e.failedSteps,
      e.linkedIssueKey || '',
      e.startedAt,
    ]);
    const csvContent =
      headers.join(',') + '\n' + rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playwright-executions-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJsonReport = (run: ExecutionRun) => {
    const blob = new Blob([JSON.stringify(run, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-report-${run.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Suite Execution & Export Action Bar */}
      <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Suite Orchestrator:
          </div>
          <label htmlFor="suite-select" className="sr-only">
            Select Test Suite
          </label>
          <select
            id="suite-select"
            aria-label="Select Test Suite"
            value={suiteToRun}
            onChange={(e) => setSuiteToRun(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="all">
              All Active Test Suites ({state.testCases.length} tests)
            </option>
            {state.testSuites.map((ts) => (
              <option key={ts.id} value={ts.id}>
                Suite: {ts.name} (Parallelism: {ts.parallelism}x)
              </option>
            ))}
          </select>

          <label htmlFor="suite-browser-select" className="sr-only">
            Select Suite Target Browser
          </label>
          <select
            id="suite-browser-select"
            aria-label="Select Suite Target Browser"
            value={suiteBrowser}
            onChange={(e) => setSuiteBrowser(e.target.value as BrowserEngine)}
            className="px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="chromium">chromium</option>
            <option value="firefox">firefox</option>
            <option value="webkit">webkit</option>
          </select>

          <button
            type="button"
            disabled={!canExecute || isExecuting}
            onClick={() => onExecuteSuite(suiteToRun, suiteBrowser)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            {isExecuting ? 'Running Suite...' : 'Run Suite Across Workers'}
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCompareMode((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
              compareMode
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            {compareMode ? 'Exit Run Comparison' : 'Compare Runs'}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export CSV ({filteredExecutions.length})
          </button>
        </div>
      </div>

      {/* Optional Side-by-Side Run Comparison View */}
      {compareMode && activeRun && compareRunB && (
        <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Historical Execution Comparison
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-slate-500">
                Baseline A: <strong>{activeRun.id}</strong> ({activeRun.testCaseCode})
              </span>
              <span>vs.</span>
              <label htmlFor="compare-run-b-select" className="sr-only">
                Select Comparison Run B
              </label>
              <select
                id="compare-run-b-select"
                value={compareRunIdB}
                onChange={(e) => setCompareRunIdB(e.target.value)}
                className="px-2.5 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {state.executions.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.id} · {ex.testCaseCode} ({ex.status.toUpperCase()} · {ex.browser})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {[activeRun, compareRunB].map((r, idx) => (
              <div
                key={`${r.id}-${idx}`}
                className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-2"
              >
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                  <span>
                    {idx === 0 ? 'Run A' : 'Run B'}: {r.id} ({r.testCaseCode})
                  </span>
                  <span
                    className={
                      r.status === 'passed'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {r.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  Browser: {r.browser} · Worker: {r.workerName} · Duration:{' '}
                  {r.durationMs}ms · Passed: {r.passedSteps}/{r.totalSteps}
                </div>
                <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {r.stepResults.map((sr) => (
                    <div
                      key={sr.stepId}
                      className="flex items-center justify-between font-mono"
                    >
                      <span className="truncate max-w-[260px]">
                        {sr.stepIndex + 1}. {sr.label}
                      </span>
                      <span
                        className={
                          sr.status === 'passed'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {sr.status.toUpperCase()} ({sr.durationMs}ms)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Split: Left Execution History Table (5 cols) + Right Detailed Execution Report (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Filterable Execution History List */}
        <div className="lg:col-span-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Persisted Execution Runs ({filteredExecutions.length})
            </h2>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-3 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Filter executions by ID, test case, or worker"
                placeholder="Search EX-1004, ACME-TC-101, worker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>

            <select
              aria-label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="all">All Statuses</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              aria-label="Filter by Browser"
              value={browserFilter}
              onChange={(e) => setBrowserFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="all">All Browsers</option>
              <option value="chromium">Chromium</option>
              <option value="firefox">Firefox</option>
              <option value="webkit">WebKit</option>
            </select>

            <select
              aria-label="Filter by Project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="all">All Projects</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Execution Rows */}
          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {filteredExecutions.map((ex) => {
              const isSelected = activeRun?.id === ex.id;
              return (
                <div
                  key={ex.id}
                  onClick={() => onSelectRunId(ex.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-900 dark:text-white">
                      {ex.status === 'passed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : ex.status === 'failed' ? (
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span>{ex.id}</span>
                      <span className="text-slate-400">·</span>
                      <span>{ex.testCaseCode}</span>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {ex.durationMs}ms
                    </span>
                  </div>

                  <div className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1 truncate">
                    {ex.testCaseTitle}
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-1.5 font-mono">
                    <span>{ex.browser}</span>
                    <span>·</span>
                    <span>{ex.workerName}</span>
                    <span>·</span>
                    <span className="tabular-nums">
                      {ex.passedSteps}/{ex.totalSteps} steps
                    </span>
                    {ex.linkedIssueKey && (
                      <>
                        <span>·</span>
                        <span className="text-red-600 dark:text-red-400 font-semibold">
                          {ex.linkedIssueKey}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Execution Report Inspector */}
        <div className="lg:col-span-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5">
          {activeRun ? (
            <>
              {/* Report Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    <span>Report ID: {activeRun.id}</span>
                    <span>·</span>
                    <span>Trigger: {activeRun.triggerSource}</span>
                    <span>·</span>
                    <span>By: {activeRun.triggeredBy}</span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    {activeRun.testCaseCode} — {activeRun.testCaseTitle}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mt-1.5 font-mono tabular-nums">
                    <span
                      className={`font-bold ${
                        activeRun.status === 'passed'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : activeRun.status === 'failed'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      Status: {activeRun.status.toUpperCase()}
                    </span>
                    <span>·</span>
                    <span>Browser: {activeRun.browser}</span>
                    <span>·</span>
                    <span>Worker: {activeRun.workerName}</span>
                    <span>·</span>
                    <span>Duration: {activeRun.durationMs}ms</span>
                    <span>·</span>
                    <span>Queue Wait: {activeRun.queueWaitMs}ms</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(activeRun.status === 'queued' ||
                    activeRun.status === 'running') && (
                    <button
                      type="button"
                      disabled={!canExecute}
                      onClick={() => onCancelExecution(activeRun.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-500"
                    >
                      Cancel Run
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!canExecute || isExecuting}
                    onClick={() =>
                      onExecuteTestCase(activeRun.testCaseId, activeRun.browser)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Re-Run Test
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadJsonReport(activeRun)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Report JSON
                  </button>
                </div>
              </div>

              {/* Report Sub-Navigation Tabs */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                {[
                  {
                    id: 'steps',
                    label: `Step Results (${activeRun.passedSteps}/${activeRun.totalSteps})`,
                  },
                  {id: 'logs', label: `Execution Logs (${activeRun.logs.length})`},
                  {id: 'spec', label: 'Playwright Spec'},
                  {id: 'artifacts', label: 'Traces & Telemetry'},
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setReportTab(
                        t.id as 'steps' | 'logs' | 'spec' | 'artifacts'
                      )
                    }
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      reportTab === t.id
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Step-by-Step Results */}
              {reportTab === 'steps' && (
                <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                  {activeRun.stepResults.map((sr) => (
                    <div
                      key={sr.stepId}
                      className={`p-3.5 rounded-lg border ${
                        sr.status === 'failed'
                          ? 'border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                          <span className="font-mono text-slate-400 tabular-nums">
                            #{sr.stepIndex + 1}
                          </span>
                          <span>{sr.label}</span>
                        </div>
                        <div className="text-xs font-mono tabular-nums flex items-center gap-2">
                          <span
                            className={
                              sr.status === 'passed'
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : sr.status === 'failed'
                                  ? 'text-red-600 dark:text-red-400 font-semibold'
                                  : 'text-slate-400'
                            }
                          >
                            {sr.status.toUpperCase()}
                          </span>
                          <span>·</span>
                          <span className="text-slate-500">{sr.durationMs}ms</span>
                        </div>
                      </div>

                      <div className="mt-1.5 text-xs font-mono text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-2">
                        <span>Action: {sr.actionId}</span>
                        {sr.locatorResolved && (
                          <>
                            <span>·</span>
                            <span>Locator: {sr.locatorResolved}</span>
                          </>
                        )}
                        {sr.actualValue && (
                          <>
                            <span>·</span>
                            <span>Result: {sr.actualValue}</span>
                          </>
                        )}
                      </div>

                      {sr.errorMessage && (
                        <div className="mt-2 p-2.5 rounded bg-red-950 text-red-200 font-mono text-xs space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-red-300">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {sr.errorMessage}
                          </div>
                          {sr.stackTrace && (
                            <pre className="text-xs text-red-300/90 whitespace-pre-wrap pt-1">
                              {sr.stackTrace}
                            </pre>
                          )}
                        </div>
                      )}

                      {sr.domSnapshotSnippet && (
                        <div className="mt-2 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 overflow-x-auto">
                          DOM Snapshot: {sr.domSnapshotSnippet}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 2: Live / Persisted Execution Logs */}
              {reportTab === 'logs' && (
                <div className="rounded-lg bg-slate-950 text-slate-200 border border-slate-800 p-4 font-mono text-xs space-y-1.5 max-h-[500px] overflow-y-auto">
                  <div className="text-slate-400 flex items-center gap-2 pb-2 border-b border-slate-800">
                    <Terminal className="w-3.5 h-3.5 text-blue-400" />
                    Worker Output Stream ({activeRun.workerName})
                  </div>
                  {activeRun.logs.map((line, idx) => (
                    <div
                      key={idx}
                      className={
                        line.includes('FAILED')
                          ? 'text-red-400'
                          : line.includes('PASSED')
                            ? 'text-emerald-400'
                            : 'text-slate-300'
                      }
                    >
                      {line}
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Executed Playwright Spec */}
              {reportTab === 'spec' && (
                <pre className="rounded-lg bg-slate-950 text-slate-200 border border-slate-800 p-4 font-mono text-xs overflow-x-auto max-h-[500px] overflow-y-auto">
                  {activeRun.generatedSpecCode}
                </pre>
              )}

              {/* Tab 4: Artifacts & Telemetry */}
              {reportTab === 'artifacts' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                      <div className="text-slate-500 dark:text-slate-400">
                        Playwright Trace Bundle
                      </div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white mt-1">
                        {activeRun.traceArtifactId}
                      </div>
                      <div className="text-slate-500 mt-1">
                        Contains DOM snapshots, HAR network log, and console timeline.
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                      <div className="text-slate-500 dark:text-slate-400">
                        Worker Resource Peak
                      </div>
                      <div className="font-mono font-bold tabular-nums text-slate-900 dark:text-white mt-1">
                        CPU: {activeRun.cpuPeakPercent}% · RAM: {activeRun.memoryPeakMb} MB
                      </div>
                      <div className="text-slate-500 mt-1">
                        Container isolated on {activeRun.workerName}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                      <div className="text-slate-500 dark:text-slate-400">
                        Deduplicated Issue Link
                      </div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white mt-1">
                        {activeRun.linkedIssueKey || 'None (Clean Pass)'}
                      </div>
                      <div className="text-slate-500 mt-1 truncate">
                        {activeRun.failureFingerprint || 'All assertions verified'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500">
              Select an execution run on the left to inspect its step-by-step Playwright report.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
