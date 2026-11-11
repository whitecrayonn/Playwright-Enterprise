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
  Button,
  EmptyState,
  FactGrid,
  Panel,
  StatusBadge,
  Tabs,
  formatDuration,
  formatTimestamp,
  inputClass,
  selectClass,
  toneText,
} from '@/components/ui';
import {cn} from '@/lib/utils';
import {
  AlertCircle,
  Download,
  FileSpreadsheet,
  GitCompare,
  Play,
  Search,
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

type ReportTab = 'steps' | 'logs' | 'spec' | 'artifacts';

const TRIGGER_LABEL: Record<ExecutionRun['triggerSource'], string> = {
  manual: 'Manual',
  suite: 'Suite run',
  schedule: 'Schedule',
  ci_webhook: 'CI webhook',
};

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
  const [reportTab, setReportTab] = useState<ReportTab>('steps');

  const canExecute = canPerformAction(currentRole, 'canExecuteTests');

  const filteredExecutions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.executions.filter((ex) => {
      const matchStatus = statusFilter === 'all' || ex.status === statusFilter;
      const matchBrowser =
        browserFilter === 'all' || ex.browser === browserFilter;
      const matchProj =
        projectFilter === 'all' || ex.projectId === projectFilter;
      const matchSearch =
        !q ||
        ex.id.toLowerCase().includes(q) ||
        ex.testCaseCode.toLowerCase().includes(q) ||
        ex.testCaseTitle.toLowerCase().includes(q) ||
        ex.workerName.toLowerCase().includes(q);
      return matchStatus && matchBrowser && matchProj && matchSearch;
    });
  }, [
    state.executions,
    statusFilter,
    browserFilter,
    projectFilter,
    searchQuery,
  ]);

  const filtersActive =
    statusFilter !== 'all' ||
    browserFilter !== 'all' ||
    projectFilter !== 'all' ||
    searchQuery.trim() !== '';

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

  const selectedSuite = state.testSuites.find((s) => s.id === suiteToRun);
  const suiteCaseCount =
    suiteToRun === 'all'
      ? state.testCases.length
      : state.testCases.filter((tc) => tc.testSuiteId === suiteToRun).length;

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

  const firstFailedStep = activeRun?.stepResults.find(
    (s) => s.status === 'failed'
  );

  return (
    <div className="space-y-6">
      {/* Suite runner + exports */}
      <Panel
        title="Run a suite"
        description={
          selectedSuite
            ? `${selectedSuite.name}: ${suiteCaseCount} test cases, up to ${selectedSuite.parallelism} in parallel.`
            : `Every active suite: ${suiteCaseCount} test cases.`
        }
        actions={
          <>
            <Button
              size="sm"
              variant={compareMode ? 'subtle' : 'secondary'}
              icon={GitCompare}
              aria-pressed={compareMode}
              onClick={() => setCompareMode((prev) => !prev)}
            >
              {compareMode ? 'Close comparison' : 'Compare two runs'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={FileSpreadsheet}
              onClick={handleExportCsv}
            >
              Export CSV ({filteredExecutions.length})
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:flex-none">
            <label
              htmlFor="suite-select"
              className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
            >
              Suite
            </label>
            <select
              id="suite-select"
              aria-label="Select Test Suite"
              value={suiteToRun}
              onChange={(e) => setSuiteToRun(e.target.value)}
              className={cn(selectClass, 'w-full sm:w-72')}
            >
              <option value="all">All active suites</option>
              {state.testSuites.map((ts) => (
                <option key={ts.id} value={ts.id}>
                  {ts.name} ({ts.parallelism}× parallel)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="suite-browser-select"
              className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
            >
              Browser
            </label>
            <select
              id="suite-browser-select"
              aria-label="Select Suite Target Browser"
              value={suiteBrowser}
              onChange={(e) => setSuiteBrowser(e.target.value as BrowserEngine)}
              className={cn(selectClass, 'font-mono')}
            >
              <option value="chromium">chromium</option>
              <option value="firefox">firefox</option>
              <option value="webkit">webkit</option>
            </select>
          </div>
          <Button
            variant="primary"
            icon={Play}
            disabled={!canExecute || isExecuting}
            onClick={() => onExecuteSuite(suiteToRun, suiteBrowser)}
          >
            {isExecuting ? 'Running suite…' : 'Run suite'}
          </Button>
          {!canExecute && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Your role cannot start runs.
            </span>
          )}
        </div>
      </Panel>

      {/* Side-by-side comparison */}
      {compareMode && activeRun && compareRunB && (
        <Panel
          title="Run comparison"
          description="Steps whose outcome differs between the two runs are highlighted."
          actions={
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-slate-500 dark:text-slate-400">
                A: <span className="font-mono">{activeRun.id}</span> vs B:
              </span>
              <label htmlFor="compare-run-b-select" className="sr-only">
                Select Comparison Run B
              </label>
              <select
                id="compare-run-b-select"
                value={compareRunIdB}
                onChange={(e) => setCompareRunIdB(e.target.value)}
                className={cn(selectClass, 'h-8 text-xs font-mono')}
              >
                {state.executions.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.id} · {ex.testCaseCode} · {ex.status} · {ex.browser}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[activeRun, compareRunB].map((r, idx) => {
              const other = idx === 0 ? compareRunB : activeRun;
              return (
                <div
                  key={`${r.id}-${idx}`}
                  className="rounded-md border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {idx === 0 ? 'A' : 'B'} ·{' '}
                      <span className="font-mono">{r.id}</span> ·{' '}
                      {r.testCaseCode}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="px-3 py-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {r.browser} · {r.workerName} ·{' '}
                    {formatDuration(r.durationMs)} · {r.passedSteps} of{' '}
                    {r.totalSteps} passed
                  </div>
                  <ol className="divide-y divide-slate-100 dark:divide-slate-800 text-[13px]">
                    {r.stepResults.map((sr) => {
                      const peer = other.stepResults[sr.stepIndex];
                      const differs = peer && peer.status !== sr.status;
                      return (
                        <li
                          key={sr.stepId}
                          className={cn(
                            'flex items-center justify-between gap-3 px-3 py-1.5',
                            differs && 'bg-amber-50 dark:bg-amber-950/30'
                          )}
                        >
                          <span className="truncate text-slate-700 dark:text-slate-300">
                            <span className="font-mono text-slate-400 mr-2">
                              {sr.stepIndex + 1}
                            </span>
                            {sr.label}
                          </span>
                          <span className="flex items-center gap-2 shrink-0 font-mono text-xs tabular-nums">
                            <span className="text-slate-500">
                              {formatDuration(sr.durationMs)}
                            </span>
                            <StatusBadge status={sr.status} />
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Run list */}
        <Panel
          as="div"
          className="xl:col-span-5"
          title="Runs"
          description={
            filtersActive
              ? `${filteredExecutions.length} of ${state.executions.length} runs match the filters.`
              : `${state.executions.length} runs, newest first.`
          }
          actions={
            filtersActive ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setStatusFilter('all');
                  setBrowserFilter('all');
                  setProjectFilter('all');
                  setSearchQuery('');
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
          bodyClassName="p-0"
        >
          <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 border-b border-slate-100 dark:border-slate-800">
            <div className="sm:col-span-3 relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Filter executions by ID, test case, or worker"
                placeholder="Run ID, test code, title or worker"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(inputClass, 'pl-9')}
              />
            </div>
            <select
              aria-label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">Any status</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              aria-label="Filter by Browser"
              value={browserFilter}
              onChange={(e) => setBrowserFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">Any browser</option>
              <option value="chromium">Chromium</option>
              <option value="firefox">Firefox</option>
              <option value="webkit">WebKit</option>
            </select>
            <select
              aria-label="Filter by Project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">Any project</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {filteredExecutions.length === 0 ? (
            <EmptyState>No runs match these filters.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[640px] overflow-y-auto">
              {filteredExecutions.map((ex) => {
                const isSelected = activeRun?.id === ex.id;
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      aria-current={isSelected ? 'true' : undefined}
                      onClick={() => onSelectRunId(ex.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 transition-colors border-l-2',
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {ex.id}
                          </span>{' '}
                          · {ex.testCaseCode}
                        </span>
                        <StatusBadge status={ex.status} />
                      </div>
                      <div className="text-sm text-slate-900 dark:text-white mt-1 truncate">
                        {ex.testCaseTitle}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums flex flex-wrap gap-x-2">
                        <span>{ex.browser}</span>
                        <span aria-hidden="true">·</span>
                        <span>{ex.workerName}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {ex.passedSteps}/{ex.totalSteps} steps
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDuration(ex.durationMs)}</span>
                        {ex.linkedIssueKey && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className={toneText('bad')}>
                              {ex.linkedIssueKey}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Report */}
        <Panel as="div" className="xl:col-span-7" bodyClassName="p-0">
          {activeRun ? (
            <>
              <div className="p-4 space-y-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {activeRun.id} · run #{activeRun.runNumber} ·{' '}
                      {activeRun.testCaseCode}
                    </div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white mt-0.5">
                      {activeRun.testCaseTitle}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(activeRun.status === 'queued' ||
                      activeRun.status === 'running') && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!canExecute}
                        onClick={() => onCancelExecution(activeRun.id)}
                      >
                        Cancel run
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Download}
                      onClick={() => handleDownloadJsonReport(activeRun)}
                    >
                      Report JSON
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={Play}
                      disabled={!canExecute || isExecuting}
                      onClick={() =>
                        onExecuteTestCase(
                          activeRun.testCaseId,
                          activeRun.browser
                        )
                      }
                    >
                      Re-run
                    </Button>
                  </div>
                </div>

                {firstFailedStep && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-[13px] text-red-900 dark:text-red-200">
                    <AlertCircle
                      className="w-4 h-4 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Failed at step {firstFailedStep.stepIndex + 1} (
                      {firstFailedStep.label}):{' '}
                      {firstFailedStep.errorMessage ?? 'no error message'}
                    </span>
                  </div>
                )}

                <FactGrid
                  columns={4}
                  items={[
                    {
                      label: 'Status',
                      value: <StatusBadge status={activeRun.status} />,
                    },
                    {
                      label: 'Steps',
                      value:
                        `${activeRun.passedSteps} passed, ${activeRun.failedSteps} failed` +
                        (activeRun.skippedSteps > 0
                          ? `, ${activeRun.skippedSteps} skipped`
                          : ''),
                      mono: true,
                    },
                    {
                      label: 'Duration',
                      value: formatDuration(activeRun.durationMs),
                      mono: true,
                    },
                    {
                      label: 'Queue wait',
                      value: formatDuration(activeRun.queueWaitMs),
                      mono: true,
                    },
                    {
                      label: 'Browser · worker',
                      value: `${activeRun.browser} · ${activeRun.workerName}`,
                      mono: true,
                    },
                    {label: 'Environment', value: activeRun.environmentName},
                    {
                      label: 'Trigger',
                      value: `${TRIGGER_LABEL[activeRun.triggerSource]} by ${activeRun.triggeredBy}`,
                    },
                    {
                      label: 'Started (UTC)',
                      value: formatTimestamp(activeRun.startedAt),
                      mono: true,
                    },
                  ]}
                />
              </div>

              <div className="px-4 pt-2">
                <Tabs<ReportTab>
                  label="Report sections"
                  value={reportTab}
                  onChange={setReportTab}
                  items={[
                    {
                      id: 'steps',
                      label: `Steps (${activeRun.stepResults.length})`,
                    },
                    {id: 'logs', label: `Logs (${activeRun.logs.length})`},
                    {id: 'spec', label: 'Spec that ran'},
                    {id: 'artifacts', label: 'Artifacts'},
                  ]}
                />
              </div>

              <div className="p-4">
                {reportTab === 'steps' && (
                  <ol className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                    {activeRun.stepResults.map((sr) => (
                      <li
                        key={sr.stepId}
                        className={cn(
                          'rounded-md border px-3 py-2.5',
                          sr.status === 'failed'
                            ? 'border-red-300 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20'
                            : 'border-slate-200 dark:border-slate-800'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex items-start gap-2.5">
                            <span className="w-6 text-right font-mono text-xs text-slate-400 tabular-nums pt-0.5 shrink-0">
                              {sr.stepIndex + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm text-slate-900 dark:text-white">
                                {sr.label}
                              </div>
                              <div className="mt-0.5 text-xs font-mono text-slate-500 dark:text-slate-400 break-all">
                                {sr.actionId}
                                {sr.locatorResolved &&
                                  ` · ${sr.locatorResolved}`}
                                {sr.actualValue && ` · got ${sr.actualValue}`}
                                {sr.expectedValue &&
                                  ` · expected ${sr.expectedValue}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-mono tabular-nums text-slate-500">
                              {formatDuration(sr.durationMs)}
                            </span>
                            <StatusBadge status={sr.status} />
                          </div>
                        </div>

                        {sr.errorMessage && (
                          <div className="mt-2 ml-8 p-2.5 rounded bg-slate-950 text-red-300 font-mono text-xs">
                            <div className="font-semibold">
                              {sr.errorMessage}
                            </div>
                            {sr.stackTrace && (
                              <pre className="whitespace-pre-wrap pt-1 text-red-300/80">
                                {sr.stackTrace}
                              </pre>
                            )}
                          </div>
                        )}

                        {sr.domSnapshotSnippet && (
                          <div className="mt-2 ml-8 text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 overflow-x-auto">
                            <span className="text-slate-400">DOM: </span>
                            {sr.domSnapshotSnippet}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {reportTab === 'logs' && (
                  <div className="rounded-md bg-slate-950 text-slate-200 border border-slate-800 font-mono text-xs max-h-[520px] overflow-y-auto">
                    <div className="px-3 py-2 text-slate-400 border-b border-slate-800">
                      Worker output · {activeRun.workerName}
                    </div>
                    <ol className="p-3 space-y-1">
                      {activeRun.logs.map((line, idx) => (
                        <li
                          key={idx}
                          className={cn(
                            'whitespace-pre-wrap break-all',
                            line.includes('FAILED')
                              ? 'text-red-400'
                              : line.includes('PASSED')
                                ? 'text-emerald-400'
                                : 'text-slate-300'
                          )}
                        >
                          {line}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {reportTab === 'spec' && (
                  <pre className="rounded-md bg-slate-950 text-slate-200 border border-slate-800 p-4 font-mono text-xs overflow-x-auto max-h-[520px] overflow-y-auto">
                    {activeRun.generatedSpecCode}
                  </pre>
                )}

                {reportTab === 'artifacts' && (
                  <FactGrid
                    columns={2}
                    items={[
                      {
                        label: 'Trace bundle (DOM snapshots, HAR, console)',
                        value: activeRun.traceArtifactId,
                        mono: true,
                      },
                      {
                        label: 'Video · screenshot',
                        value: `${activeRun.videoArtifactId ?? 'none'} · ${activeRun.screenshotArtifactId ?? 'none'}`,
                        mono: true,
                      },
                      {
                        label: 'Worker peak usage',
                        value: `CPU ${activeRun.cpuPeakPercent}% · RAM ${activeRun.memoryPeakMb} MB`,
                        mono: true,
                      },
                      {
                        label: 'Retry attempt',
                        value: `${activeRun.retryAttempt} of ${activeRun.maxRetries} allowed`,
                        mono: true,
                      },
                      {
                        label: 'Linked issue',
                        value: activeRun.linkedIssueKey ?? 'None',
                        mono: true,
                        tone: activeRun.linkedIssueKey ? 'bad' : 'neutral',
                      },
                      {
                        label: 'Failure fingerprint',
                        value:
                          activeRun.failureFingerprint ??
                          'None — all assertions passed',
                        mono: true,
                      },
                    ]}
                  />
                )}
              </div>
            </>
          ) : (
            <EmptyState>
              Select a run to see its step report, logs and artifacts.
            </EmptyState>
          )}
        </Panel>
      </div>
    </div>
  );
}
