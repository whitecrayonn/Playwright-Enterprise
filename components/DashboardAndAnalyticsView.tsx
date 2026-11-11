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
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Play,
  Wrench,
  XCircle,
} from 'lucide-react';

interface DashboardAndAnalyticsViewProps {
  state: PlatformState;
  analytics: AnalyticsSummary;
  onOpenInBuilder: (tc: TestCase) => void;
  onExecuteTestCase: (
    testCaseId: string,
    browser: BrowserEngine
  ) => Promise<void>;
  onInspectRun: (runId: string) => void;
  currentRole: RoleType;
  isExecuting: boolean;
}

export default function DashboardAndAnalyticsView({
  state,
  analytics,
  onOpenInBuilder,
  onExecuteTestCase,
  onInspectRun,
  currentRole,
  isExecuting,
}: DashboardAndAnalyticsViewProps) {
  const canExecute = canPerformAction(currentRole, 'canExecuteTests');

  // Compute browser breakdown from actual persisted executions
  const browserStats = (['chromium', 'firefox', 'webkit'] as BrowserEngine[]).map(
    (b) => {
      const runs = state.executions.filter((e) => e.browser === b);
      const passed = runs.filter((e) => e.status === 'passed').length;
      const rate =
        runs.length > 0 ? Math.round((passed / runs.length) * 100) : 100;
      return {browser: b, total: runs.length, passed, rate};
    }
  );

  // Project activity breakdown
  const projectStats = state.projects.map((p) => {
    const cases = state.testCases.filter((tc) => tc.projectId === p.id);
    const runs = state.executions.filter((e) => e.projectId === p.id);
    const passed = runs.filter((e) => e.status === 'passed').length;
    const rate =
      runs.length > 0 ? Math.round((passed / runs.length) * 100) : 100;
    return {project: p, caseCount: cases.length, runCount: runs.length, rate};
  });

  return (
    <div className="space-y-6">
      {/* Top KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total Test Cases
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {analytics.totalTestCases}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {state.sopModules.length} Reusable SOP Modules
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Persisted Executions
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {analytics.totalExecutions}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            {analytics.passedExecutions} passed · {analytics.failedExecutions} failed
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Overall Pass Rate
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {analytics.passRatePercent}%
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Target SLA: 95.0%
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Avg Execution Duration
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {analytics.avgDurationMs}ms
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            Avg Queue Wait: {analytics.avgQueueWaitMs}ms
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Flaky Test Watchlist
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {analytics.flakyTestsCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Score &ge; 15% variance
          </div>
        </div>

        <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Worker Cluster Capacity
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {analytics.onlineWorkers}/{state.workers.length} Online
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            {analytics.totalWorkerCapacity - analytics.occupiedWorkerCapacity}/
            {analytics.totalWorkerCapacity} slots free
          </div>
        </div>
      </div>

      {/* Middle Row: Execution Duration & Outcome Chart + Browser & Project Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Persisted Execution Timeline Bar Chart (7 cols) */}
        <div className="lg:col-span-7 p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Execution Duration & Stability Telemetry
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Click any bar to inspect the persisted execution report and step trace.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Last {Math.min(10, state.executions.length)} Runs
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 pt-2">
              {state.executions.slice(0, 8).map((ex) => {
                const maxDur = Math.max(
                  2500,
                  ...state.executions.map((r) => r.durationMs)
                );
                const widthPct = Math.max(
                  12,
                  Math.min(100, Math.round((ex.durationMs / maxDur) * 100))
                );
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => onInspectRun(ex.id)}
                    className="w-full text-left group p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {ex.id}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {ex.testCaseCode}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{ex.browser}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{ex.workerName}</span>
                      </div>
                      <div className="font-mono tabular-nums flex items-center gap-2">
                        <span
                          className={
                            ex.status === 'passed'
                              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'text-red-600 dark:text-red-400 font-semibold'
                          }
                        >
                          {ex.status.toUpperCase()} ({ex.passedSteps}/
                          {ex.totalSteps})
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {ex.durationMs}ms
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        style={{width: `${widthPct}%`}}
                        className={`h-full rounded-full ${
                          ex.status === 'passed'
                            ? 'bg-emerald-500'
                            : ex.status === 'failed'
                              ? 'bg-red-500'
                              : 'bg-amber-500'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Browser & Project Breakdown + Operational Health (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Cross-Browser & Multi-Project Matrix
            </h2>

            <div className="space-y-3">
              {browserStats.map((bs) => (
                <div
                  key={bs.browser}
                  className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800/80"
                >
                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 uppercase">
                    {bs.browser}
                  </div>
                  <div className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {bs.passed}/{bs.total} runs passed ·{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {bs.rate}%
                    </strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Projects
              </div>
              {projectStats.map((ps) => (
                <div
                  key={ps.project.id}
                  className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {ps.project.key} · {ps.project.name}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      Pool: {ps.project.workerPool} · Max Concurrency:{' '}
                      {ps.project.concurrencyLimit}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {ps.caseCount} Tests
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-400">
                      {ps.rate}% Pass
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deduplicated Failure & Flaky Radar */}
          <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Active Failure Fingerprints & Jira Triage
            </h2>
            {state.issues.map((iss) => (
              <div
                key={iss.id}
                className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {iss.key} · {iss.status}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    Deduplicated Occurrences: {iss.occurrenceCount}x
                  </span>
                </div>
                <div className="font-medium text-slate-800 dark:text-slate-200">
                  {iss.title}
                </div>
                <div className="text-slate-500 font-mono truncate">
                  Fingerprint: {iss.failureFingerprint}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Table: Test Case Inventory & Stability Index */}
      <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Test Case Stability & Quick Execution Matrix
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select any test case to open its visual workflow in the builder or trigger an immediate worker run.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3 font-medium">Code</th>
                <th className="py-2.5 px-3 font-medium">Title</th>
                <th className="py-2.5 px-3 font-medium">Steps & Version</th>
                <th className="py-2.5 px-3 font-medium">Target Environment</th>
                <th className="py-2.5 px-3 font-medium text-right">Pass Rate</th>
                <th className="py-2.5 px-3 font-medium text-right">Flaky Score</th>
                <th className="py-2.5 px-3 font-medium text-right">Avg Duration</th>
                <th className="py-2.5 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.testCases.map((tc) => (
                <tr
                  key={tc.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {tc.code}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                    {tc.title}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {tc.steps.length} steps · v{tc.version}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {tc.targetEnvironment}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                    {tc.passRate}%
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono tabular-nums font-semibold ${
                      tc.flakyScore >= 15
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {tc.flakyScore}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {tc.avgDurationMs}ms
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenInBuilder(tc)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Wrench className="w-3 h-3" />
                        Visual Builder
                      </button>
                      <button
                        type="button"
                        disabled={!canExecute || isExecuting}
                        onClick={() =>
                          onExecuteTestCase(tc.id, tc.browsers[0] || 'chromium')
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        <Play className="w-3 h-3" />
                        Run
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
