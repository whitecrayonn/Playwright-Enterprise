'use client';

import React from 'react';
import {
  BrowserEngine,
  PlatformState,
  RoleType,
  TestCase,
} from '@/lib/types';
import {AnalyticsSummary, canPerformAction} from '@/lib/action-registry';
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  StatusBadge,
  Tone,
  formatDuration,
  formatTimestamp,
  percent,
  toneText,
} from '@/components/ui';
import {cn} from '@/lib/utils';
import {Play, Wrench} from 'lucide-react';

type JumpSection = 'workers' | 'executions' | 'builder';

interface DashboardAndAnalyticsViewProps {
  state: PlatformState;
  analytics: AnalyticsSummary;
  onOpenInBuilder: (tc: TestCase) => void;
  onExecuteTestCase: (
    testCaseId: string,
    browser: BrowserEngine
  ) => Promise<void>;
  onInspectRun: (runId: string) => void;
  onOpenSection?: (section: JumpSection) => void;
  currentRole: RoleType;
  isExecuting: boolean;
}

const FLAKY_THRESHOLD = 15;

function rateTone(rate: number, runs: number): Tone {
  if (runs === 0) return 'neutral';
  if (rate >= 95) return 'good';
  if (rate >= 80) return 'warn';
  return 'bad';
}

interface AttentionItem {
  key: string;
  tone: Tone;
  kind: string;
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}

const th =
  'py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap';
const td = 'py-2.5 px-3 align-middle';

export default function DashboardAndAnalyticsView({
  state,
  analytics,
  onOpenInBuilder,
  onExecuteTestCase,
  onInspectRun,
  onOpenSection,
  currentRole,
  isExecuting,
}: DashboardAndAnalyticsViewProps) {
  const canExecute = canPerformAction(currentRole, 'canExecuteTests');

  const browserStats = (['chromium', 'firefox', 'webkit'] as BrowserEngine[]).map(
    (b) => {
      const runs = state.executions.filter((e) => e.browser === b);
      const passed = runs.filter((e) => e.status === 'passed').length;
      return {
        browser: b,
        total: runs.length,
        passed,
        failed: runs.filter((e) => e.status === 'failed').length,
        rate: percent(passed, runs.length),
      };
    }
  );

  const projectStats = state.projects.map((p) => {
    const cases = state.testCases.filter((tc) => tc.projectId === p.id);
    const runs = state.executions.filter((e) => e.projectId === p.id);
    const passed = runs.filter((e) => e.status === 'passed').length;
    return {
      project: p,
      caseCount: cases.length,
      runCount: runs.length,
      rate: percent(passed, runs.length),
    };
  });

  // Latest run per test case, for the inventory table.
  const lastRunByTest = new Map<string, (typeof state.executions)[number]>();
  for (const ex of state.executions) {
    if (!lastRunByTest.has(ex.testCaseId)) lastRunByTest.set(ex.testCaseId, ex);
  }

  // ---- Needs attention: concrete things a person should act on ----
  const attention: AttentionItem[] = [];

  const openIssueKeys = new Set(state.issues.map((i) => i.key));
  for (const iss of state.issues) {
    if (iss.status === 'Resolved') continue;
    const latestRun =
      state.executions.find((e) => e.linkedIssueKey === iss.key) ??
      state.executions.find((e) => e.id === iss.executionId);
    attention.push({
      key: `issue-${iss.id}`,
      tone: 'bad',
      kind: `${iss.key} · ${iss.status} · ${iss.assignee}`,
      title: iss.title,
      detail: `Seen ${iss.occurrenceCount}× · last ${formatTimestamp(iss.lastSeenAt)} UTC · ${iss.failureFingerprint}`,
      actionLabel: latestRun ? `Inspect ${latestRun.id}` : 'View runs',
      onAction: () =>
        latestRun
          ? onInspectRun(latestRun.id)
          : onOpenSection?.('executions'),
    });
  }

  for (const ex of state.executions.filter((e) => e.status === 'failed')) {
    if (ex.linkedIssueKey && openIssueKeys.has(ex.linkedIssueKey)) continue;
    attention.push({
      key: `run-${ex.id}`,
      tone: 'bad',
      kind: `${ex.id} · failed`,
      title: `${ex.testCaseCode} — ${ex.testCaseTitle}`,
      detail: `${ex.passedSteps} of ${ex.totalSteps} steps passed on ${ex.browser} · ${ex.workerName}`,
      actionLabel: 'Inspect run',
      onAction: () => onInspectRun(ex.id),
    });
  }

  for (const tc of state.testCases.filter(
    (t) => t.flakyScore >= FLAKY_THRESHOLD
  )) {
    attention.push({
      key: `flaky-${tc.id}`,
      tone: 'warn',
      kind: `${tc.code} · flaky ${tc.flakyScore}%`,
      title: tc.title,
      detail: `Pass rate ${tc.passRate}% over ${tc.totalRuns} runs · avg ${formatDuration(tc.avgDurationMs)}`,
      actionLabel: 'Open in builder',
      onAction: () => onOpenInBuilder(tc),
    });
  }

  for (const w of state.workers.filter(
    (w) => w.status !== 'online' && w.status !== 'busy'
  )) {
    attention.push({
      key: `worker-${w.id}`,
      tone: w.status === 'draining' ? 'warn' : 'bad',
      kind: `${w.name} · ${w.status}`,
      title: `Worker ${w.status === 'draining' ? 'is draining' : 'is unavailable'} in ${w.pool}`,
      detail: `${w.maxConcurrency} slots removed from capacity · last heartbeat ${formatTimestamp(w.lastHeartbeatAt)} UTC`,
      actionLabel: 'Manage workers',
      onAction: () => onOpenSection?.('workers'),
    });
  }

  const recentRuns = state.executions.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Needs attention */}
        <Panel
          className="xl:col-span-7"
          title="Needs attention"
          description="Open failures, flaky tests and unavailable workers, most severe first."
          actions={
            <Badge tone={attention.length > 0 ? 'warn' : 'good'}>
              {attention.length === 0
                ? 'All clear'
                : `${attention.length} item${attention.length === 1 ? '' : 's'}`}
            </Badge>
          }
          bodyClassName="p-0"
        >
          {attention.length === 0 ? (
            <EmptyState>
              No failing runs, flaky tests or unavailable workers.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {attention.map((item) => (
                <li
                  key={item.key}
                  className="flex flex-wrap sm:flex-nowrap items-start gap-3 px-4 py-3"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1.5 w-2 h-2 rounded-full shrink-0',
                      item.tone === 'bad' ? 'bg-red-500' : 'bg-amber-500'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'text-xs font-mono font-medium',
                        toneText(item.tone)
                      )}
                    >
                      {item.kind}
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 [overflow-wrap:anywhere]">
                      {item.detail}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={item.onAction}>
                    {item.actionLabel}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="xl:col-span-5 space-y-6">
          {/* Browser matrix */}
          <Panel
            title="Pass rate by browser"
            description="Across all recorded runs."
            bodyClassName="p-0"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-100 dark:border-slate-800">
                  <th scope="col" className={th}>
                    Browser
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    Runs
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    Failed
                  </th>
                  <th scope="col" className={cn(th, 'text-right')}>
                    Pass rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {browserStats.map((bs) => (
                  <tr key={bs.browser}>
                    <td className={cn(td, 'font-mono capitalize')}>
                      {bs.browser}
                    </td>
                    <td className={cn(td, 'text-right font-mono tabular-nums')}>
                      {bs.total}
                    </td>
                    <td
                      className={cn(
                        td,
                        'text-right font-mono tabular-nums',
                        bs.failed > 0 && toneText('bad')
                      )}
                    >
                      {bs.failed}
                    </td>
                    <td
                      className={cn(
                        td,
                        'text-right font-mono tabular-nums font-semibold',
                        toneText(rateTone(bs.rate, bs.total))
                      )}
                    >
                      {bs.total === 0 ? 'No runs' : `${bs.rate}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* Projects */}
          <Panel
            title="Projects"
            description="Test count, worker pool and pass rate per project."
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {projectStats.map((ps) => (
                <li
                  key={ps.project.id}
                  className="flex items-start justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      <span className="font-mono text-slate-500 dark:text-slate-400 mr-2">
                        {ps.project.key}
                      </span>
                      {ps.project.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      {ps.project.workerPool} · up to{' '}
                      {ps.project.concurrencyLimit} parallel
                    </div>
                  </div>
                  <div className="text-right text-xs font-mono tabular-nums shrink-0">
                    <div className="text-slate-900 dark:text-white">
                      {ps.caseCount} tests · {ps.runCount} runs
                    </div>
                    <div
                      className={cn(
                        'font-semibold',
                        toneText(rateTone(ps.rate, ps.runCount))
                      )}
                    >
                      {ps.runCount === 0 ? 'No runs yet' : `${ps.rate}% pass`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {/* Recent runs */}
      <Panel
        title="Recent runs"
        description="Latest executions. Select a run ID to open its step report."
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenSection?.('executions')}
          >
            All executions
          </Button>
        }
        bodyClassName="p-0 overflow-x-auto"
      >
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left border-b border-slate-100 dark:border-slate-800">
              <th scope="col" className={th}>
                Run
              </th>
              <th scope="col" className={th}>
                Test
              </th>
              <th scope="col" className={th}>
                Status
              </th>
              <th scope="col" className={th}>
                Browser · worker
              </th>
              <th scope="col" className={cn(th, 'text-right')}>
                Steps passed
              </th>
              <th scope="col" className={cn(th, 'text-right')}>
                Duration
              </th>
              <th scope="col" className={cn(th, 'text-right')}>
                Started (UTC)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentRuns.map((ex) => (
              <tr
                key={ex.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className={td}>
                  <button
                    type="button"
                    onClick={() => onInspectRun(ex.id)}
                    className="font-mono font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    {ex.id}
                  </button>
                </td>
                <td className={cn(td, 'max-w-[280px]')}>
                  <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {ex.testCaseCode}
                  </div>
                  <div className="truncate text-slate-900 dark:text-white">
                    {ex.testCaseTitle}
                  </div>
                </td>
                <td className={td}>
                  <StatusBadge status={ex.status} />
                </td>
                <td
                  className={cn(
                    td,
                    'font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap'
                  )}
                >
                  {ex.browser} · {ex.workerName}
                </td>
                <td className={cn(td, 'text-right font-mono tabular-nums')}>
                  {ex.passedSteps} / {ex.totalSteps}
                </td>
                <td className={cn(td, 'text-right font-mono tabular-nums')}>
                  {formatDuration(ex.durationMs)}
                </td>
                <td
                  className={cn(
                    td,
                    'text-right font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap'
                  )}
                >
                  {formatTimestamp(ex.startedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Test inventory */}
      <Panel
        title="Test cases"
        description={`Stability per test. Flaky means results vary on unchanged code (score ≥ ${FLAKY_THRESHOLD}%).`}
        bodyClassName="p-0 overflow-x-auto"
      >
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left border-b border-slate-100 dark:border-slate-800">
              <th scope="col" className={th}>
                Test case
              </th>
              <th scope="col" className={th}>
                Priority
              </th>
              <th scope="col" className={th}>
                Last run
              </th>
              <th scope="col" className={cn(th, 'text-right')}>
                Steps · version
              </th>
              <th scope="col" className={cn(th, 'text-right')}>
                Pass rate
              </th>
              <th scope="col" className={cn(th, 'text-right')}>
                Flaky
              </th>
              <th scope="col" className={cn(th, 'text-right')}>
                Avg duration
              </th>
              <th scope="col" className={cn(th, 'text-right')}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.testCases.map((tc) => {
              const last = lastRunByTest.get(tc.id);
              return (
                <tr
                  key={tc.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className={cn(td, 'max-w-[320px]')}>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {tc.code} · {tc.targetEnvironment}
                    </div>
                    <div className="text-slate-900 dark:text-white">
                      {tc.title}
                    </div>
                  </td>
                  <td className={td}>
                    <Badge
                      tone={
                        tc.priority === 'critical'
                          ? 'bad'
                          : tc.priority === 'high'
                            ? 'warn'
                            : 'neutral'
                      }
                    >
                      {tc.priority}
                    </Badge>
                  </td>
                  <td className={td}>
                    {last ? (
                      <StatusBadge status={last.status} />
                    ) : (
                      <span className="text-xs text-slate-400">Never run</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      td,
                      'text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap'
                    )}
                  >
                    {tc.steps.length} · v{tc.version}
                  </td>
                  <td
                    className={cn(
                      td,
                      'text-right font-mono tabular-nums font-semibold',
                      toneText(rateTone(tc.passRate, tc.totalRuns))
                    )}
                  >
                    {tc.passRate}%
                  </td>
                  <td
                    className={cn(
                      td,
                      'text-right font-mono tabular-nums',
                      tc.flakyScore >= FLAKY_THRESHOLD
                        ? cn('font-semibold', toneText('warn'))
                        : 'text-slate-500'
                    )}
                  >
                    {tc.flakyScore}%
                  </td>
                  <td className={cn(td, 'text-right font-mono tabular-nums')}>
                    {formatDuration(tc.avgDurationMs)}
                  </td>
                  <td className={cn(td, 'text-right whitespace-nowrap')}>
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Wrench}
                        onClick={() => onOpenInBuilder(tc)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        icon={Play}
                        disabled={!canExecute || isExecuting}
                        onClick={() =>
                          onExecuteTestCase(tc.id, tc.browsers[0] || 'chromium')
                        }
                      >
                        Run
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
