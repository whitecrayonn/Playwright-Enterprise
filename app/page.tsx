'use client';

import React, {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {
  ActionRegistryEntry,
  BrowserEngine,
  PlatformState,
  RoleType,
  TestCase,
} from '@/lib/types';
import {
  AnalyticsSummary,
  ROLE_DEFINITIONS,
  canPerformAction,
} from '@/lib/action-registry';
import VisualBuilderView from '@/components/VisualBuilderView';
import ExecutionMonitorView from '@/components/ExecutionMonitorView';
import DashboardAndAnalyticsView from '@/components/DashboardAndAnalyticsView';
import OperationsAndGovernanceView from '@/components/OperationsAndGovernanceView';
import {
  Button,
  PageFact,
  PageHeader,
  formatDuration,
  selectClass,
} from '@/components/ui';
import {cn} from '@/lib/utils';
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  FolderTree,
  Layers,
  LayoutDashboard,
  Play,
  Server,
  Shield,
  Wrench,
  XCircle,
} from 'lucide-react';

type ActiveSection =
  | 'dashboard'
  | 'builder'
  | 'executions'
  | 'projects'
  | 'sop'
  | 'workers'
  | 'admin';

interface NavItem {
  id: ActiveSection;
  label: string;
  icon: React.ComponentType<{className?: string}>;
  count?: number | string;
  countLabel?: string;
}

interface SectionMeta {
  title: string;
  description: string;
  facts: PageFact[];
}

export default function PlaywrightStudioEnterpriseApp() {
  const [state, setState] = useState<PlatformState | null>(null);
  const [actionRegistry, setActionRegistry] = useState<ActionRegistryEntry[]>(
    []
  );
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>('builder');
  const [selectedTestCaseId, setSelectedTestCaseId] =
    useState<string>('tc-101');
  const [selectedRunId, setSelectedRunId] = useState<string | null>('EX-1004');
  const [currentRole, setCurrentRole] =
    useState<RoleType>('platform_admin');
  // The pre-paint script in layout.tsx has already applied the theme class.
  const [isDark, setIsDark] = useState<boolean>(
    () =>
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark')
  );
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
    id: number;
  } | null>(null);

  const showToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      setStatusBanner({type, message, id: Date.now()});
    },
    []
  );

  // Success toasts clear themselves; errors stay until dismissed.
  useEffect(() => {
    if (!statusBanner || statusBanner.type === 'error') return;
    const handle = window.setTimeout(() => setStatusBanner(null), 6000);
    return () => window.clearTimeout(handle);
  }, [statusBanner]);

  useEffect(() => {
    let active = true;
    fetch('/api/platform')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load platform state');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setState(data.state);
        setActionRegistry(data.actionRegistry);
        setAnalytics(data.analytics);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(
          err instanceof Error ? err.message : 'Error loading state'
        );
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle('dark', nextDark);
    try {
      localStorage.setItem('studio-theme', nextDark ? 'dark' : 'light');
    } catch {
      // Storage blocked (private mode): theme still applies for this session.
    }
  };

  const postAction = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/platform', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        ...payload,
        role: currentRole,
        actor: `${ROLE_DEFINITIONS[currentRole].label}`,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'Operation failed');
      throw new Error(data.error || 'Operation failed');
    }
    if (data.state) setState(data.state);
    if (data.analytics) setAnalytics(data.analytics);
    return data;
  };

  const handleSaveTestCase = async (
    updatedTc: Partial<TestCase>,
    changeSummary: string
  ) => {
    try {
      const data = await postAction({
        action: 'save_test_case',
        testCase: updatedTc,
        changeSummary,
      });
      if (data.testCase) {
        setSelectedTestCaseId(data.testCase.id);
        showToast(
          'success',
          `Saved ${data.testCase.code} as v${data.testCase.version}. Playwright spec regenerated.`
        );
      }
    } catch {
      // Handled by postAction
    }
  };

  const handleExecuteTestCase = async (
    testCaseId: string,
    browser: BrowserEngine
  ) => {
    setIsExecuting(true);
    try {
      const data = await postAction({
        action: 'execute_test_case',
        testCaseId,
        browser,
      });
      if (data.run) {
        setSelectedRunId(data.run.id);
        setActiveSection('executions');
        showToast(
          data.run.status === 'passed' ? 'success' : 'error',
          `${data.run.id} · ${data.run.testCaseCode} ${data.run.status} on ${data.run.workerName}: ${data.run.passedSteps} of ${data.run.totalSteps} steps passed in ${formatDuration(data.run.durationMs)}.`
        );
      }
    } catch {
      // Handled by postAction
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteSuite = async (
    testSuiteId: string,
    browser: BrowserEngine
  ) => {
    setIsExecuting(true);
    try {
      const data = await postAction({
        action: 'execute_test_suite',
        testSuiteId,
        browser,
      });
      if (data.runs && data.runs.length > 0) {
        setSelectedRunId(data.runs[0].id);
        setActiveSection('executions');
        const passedCount = data.runs.filter(
          (r: {status: string}) => r.status === 'passed'
        ).length;
        const failedCount = data.runs.length - passedCount;
        showToast(
          failedCount > 0 ? 'error' : 'success',
          `Suite finished: ${passedCount} passed, ${failedCount} failed across the worker pool.`
        );
      }
    } catch {
      // Handled by postAction
    } finally {
      setIsExecuting(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div
          role="alert"
          className="max-w-md text-center space-y-2 text-sm text-slate-700 dark:text-slate-300"
        >
          <p className="font-semibold text-red-700 dark:text-red-400">
            Workspace could not load
          </p>
          <p>{loadError}. Check that the dev server is running, then reload.</p>
        </div>
      </div>
    );
  }

  if (!state || !analytics) {
    return (
      <div
        role="status"
        className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-sm"
      >
        Loading workspace…
      </div>
    );
  }

  const selectedTestCase =
    state.testCases.find((tc) => tc.id === selectedTestCaseId) ||
    state.testCases[0];

  const workspaceName = state.workspaces[0]?.name ?? 'Workspace';
  const drainingWorkers = state.workers.filter(
    (w) => w.status !== 'online' && w.status !== 'busy'
  ).length;
  const verifiedSops = state.sopModules.filter(
    (s) => s.validationStatus === 'verified'
  ).length;
  const enabledRules = state.notificationRules.filter((r) => r.enabled).length;
  const freeSlots =
    analytics.totalWorkerCapacity - analytics.occupiedWorkerCapacity;

  const navGroups: {label: string; items: NavItem[]}[] = [
    {
      label: 'Monitor',
      items: [
        {
          id: 'dashboard',
          label: 'Overview',
          icon: LayoutDashboard,
          count: `${analytics.passRatePercent}%`,
          countLabel: 'pass rate',
        },
        {
          id: 'executions',
          label: 'Executions',
          icon: Activity,
          count: state.executions.length,
          countLabel: 'runs',
        },
      ],
    },
    {
      label: 'Build',
      items: [
        {
          id: 'builder',
          label: 'Visual Builder',
          icon: Wrench,
          count: state.testCases.length,
          countLabel: 'test cases',
        },
        {
          id: 'projects',
          label: 'Projects & Suites',
          icon: FolderTree,
          count: state.projects.length,
          countLabel: 'projects',
        },
        {
          id: 'sop',
          label: 'SOP Library',
          icon: Layers,
          count: state.sopModules.length,
          countLabel: 'modules',
        },
      ],
    },
    {
      label: 'Operate',
      items: [
        {
          id: 'workers',
          label: 'Workers',
          icon: Server,
          count: `${analytics.onlineWorkers}/${state.workers.length}`,
          countLabel: 'online',
        },
        {
          id: 'admin',
          label: 'Access & Audit',
          icon: Shield,
        },
      ],
    },
  ];
  const navItems = navGroups.flatMap((g) => g.items);

  const sectionMeta: Record<ActiveSection, SectionMeta> = {
    dashboard: {
      title: 'Overview',
      description:
        'Health of the test estate: pass rate, slow or flaky tests, open failures and worker capacity.',
      facts: [
        {
          label: 'Pass rate (target 95%)',
          value: `${analytics.passRatePercent}%`,
          tone: analytics.passRatePercent >= 95 ? 'good' : 'warn',
        },
        {label: 'Runs recorded', value: analytics.totalExecutions},
        {
          label: 'Failed runs',
          value: analytics.failedExecutions,
          tone: analytics.failedExecutions > 0 ? 'bad' : 'neutral',
        },
        {
          label: 'Flaky tests',
          value: analytics.flakyTestsCount,
          tone: analytics.flakyTestsCount > 0 ? 'warn' : 'neutral',
        },
        {
          label: 'Free worker slots',
          value: `${freeSlots} / ${analytics.totalWorkerCapacity}`,
        },
      ],
    },
    builder: {
      title: 'Visual Builder',
      description:
        'Compose a test from Playwright actions and SOP modules. The TypeScript spec regenerates as you edit.',
      facts: [],
    },
    executions: {
      title: 'Executions',
      description:
        'Every recorded run with step results, worker logs, the exact spec that ran and its artifacts.',
      facts: [
        {label: 'Runs recorded', value: analytics.totalExecutions},
        {
          label: 'Passed',
          value: analytics.passedExecutions,
          tone: 'good',
        },
        {
          label: 'Failed',
          value: analytics.failedExecutions,
          tone: analytics.failedExecutions > 0 ? 'bad' : 'neutral',
        },
        {
          label: 'Average duration',
          value: formatDuration(analytics.avgDurationMs),
        },
        {
          label: 'Average queue wait',
          value: formatDuration(analytics.avgQueueWaitMs),
        },
      ],
    },
    projects: {
      title: 'Projects & Suites',
      description:
        'Workspace hierarchy: project → environments → test plans → suites → test cases.',
      facts: [
        {label: 'Projects', value: state.projects.length},
        {label: 'Test plans', value: state.testPlans.length},
        {label: 'Test suites', value: state.testSuites.length},
        {label: 'Test cases', value: state.testCases.length},
        {
          label: 'Environments',
          value: state.projects.reduce(
            (n, p) => n + p.environments.length,
            0
          ),
        },
      ],
    },
    sop: {
      title: 'SOP Library',
      description:
        'Versioned, reusable step sequences. Tests import them by slug instead of copying steps.',
      facts: [
        {label: 'Modules', value: state.sopModules.length},
        {label: 'Verified', value: verifiedSops, tone: 'good'},
        {
          label: 'Draft or deprecated',
          value: state.sopModules.length - verifiedSops,
          tone:
            state.sopModules.length - verifiedSops > 0 ? 'warn' : 'neutral',
        },
        {
          label: 'Uses across tests',
          value: state.sopModules.reduce((n, s) => n + s.usageCount, 0),
        },
      ],
    },
    workers: {
      title: 'Workers',
      description:
        'Containerised Playwright runners. Drain a node to stop new jobs; change slots to cap parallel runs.',
      facts: [
        {
          label: 'Online',
          value: `${analytics.onlineWorkers} / ${state.workers.length}`,
          tone: 'good',
        },
        {
          label: 'Draining or down',
          value: drainingWorkers,
          tone: drainingWorkers > 0 ? 'warn' : 'neutral',
        },
        {label: 'Busy slots', value: analytics.occupiedWorkerCapacity},
        {label: 'Free slots', value: freeSlots},
        {
          label: 'Runs executed',
          value: state.workers.reduce((n, w) => n + w.totalExecuted, 0),
        },
      ],
    },
    admin: {
      title: 'Access & Audit',
      description:
        'Who can do what, which secrets tests may reference, where failures are reported, and what changed.',
      facts: [
        {label: 'Roles', value: Object.keys(ROLE_DEFINITIONS).length},
        {label: 'Stored secrets', value: state.secrets.length},
        {
          label: 'Alert rules on',
          value: `${enabledRules} / ${state.notificationRules.length}`,
        },
        {label: 'Audit entries', value: state.auditLogs.length},
      ],
    },
  };

  const meta = sectionMeta[activeSection];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 lg:flex">
      {/* Sidebar: brand, grouped navigation, session controls */}
      <aside className="lg:w-60 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="px-4 pt-4 pb-3">
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className="text-left"
          >
            <span className="block text-[15px] font-bold tracking-tight text-slate-900 dark:text-white font-display">
              Playwright Studio
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
              {workspaceName}
            </span>
          </button>
        </div>

        <nav
          aria-label="Workspace sections"
          className="px-2 pb-3 lg:flex-1 lg:overflow-y-auto"
        >
          {/* Mobile: one scrolling row. Desktop: grouped list. */}
          <div className="flex lg:block gap-1 overflow-x-auto lg:overflow-visible lg:space-y-4 [scrollbar-width:none]">
            {navGroups.map((group) => (
              <div key={group.label} className="flex lg:block gap-1 shrink-0">
                <div className="hidden lg:block px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        'lg:w-full flex items-center justify-between gap-3 px-2.5 h-9 text-sm rounded-md transition-colors whitespace-nowrap shrink-0',
                        active
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon
                          className={cn(
                            'w-4 h-4 shrink-0',
                            active && 'text-blue-600 dark:text-blue-400'
                          )}
                        />
                        {item.label}
                      </span>
                      {item.count !== undefined && (
                        <span
                          className="hidden lg:inline font-mono tabular-nums text-xs text-slate-400 dark:text-slate-500"
                          title={item.countLabel}
                        >
                          {item.count}
                          {item.countLabel && (
                            <span className="sr-only"> {item.countLabel}</span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        <div className="hidden lg:block px-4 py-4 space-y-3 border-t border-slate-200 dark:border-slate-800 text-[13px]">
          <div>
            <label
              htmlFor="sidebar-role-select"
              className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
            >
              Acting as role
            </label>
            <select
              id="sidebar-role-select"
              aria-label="Active RBAC Role"
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value as RoleType)}
              className={cn(selectClass, 'w-full text-[13px]')}
            >
              {(Object.keys(ROLE_DEFINITIONS) as RoleType[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_DEFINITIONS[r].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/sample-app"
              className="inline-flex items-center gap-1.5 text-blue-700 dark:text-blue-400 hover:underline"
            >
              Target app
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={toggleTheme}
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:underline"
            >
              {isDark ? 'Light theme' : 'Dark theme'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6 h-auto min-h-14 py-2 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
          <nav
            aria-label="Breadcrumb"
            className="text-[13px] text-slate-500 dark:text-slate-400 min-w-0 truncate"
          >
            <span>{workspaceName}</span>
            <span aria-hidden="true" className="mx-2">
              /
            </span>
            <span className="font-medium text-slate-900 dark:text-white">
              {navItems.find((n) => n.id === activeSection)?.label}
            </span>
          </nav>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Role + theme stay reachable on small screens where the sidebar footer is hidden. */}
            <label htmlFor="header-role-select" className="sr-only">
              Acting as role
            </label>
            <select
              id="header-role-select"
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value as RoleType)}
              className={cn(selectClass, 'lg:hidden h-7 text-xs max-w-36')}
            >
              {(Object.keys(ROLE_DEFINITIONS) as RoleType[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_DEFINITIONS[r].label}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="lg:hidden"
            >
              {isDark ? 'Light' : 'Dark'}
            </Button>
            <span className="hidden lg:inline text-xs text-slate-500 dark:text-slate-400">
              {ROLE_DEFINITIONS[currentRole].label}
            </span>
            <Button
              variant="primary"
              size="sm"
              icon={Play}
              disabled={
                isExecuting ||
                !canPerformAction(currentRole, 'canExecuteTests')
              }
              title={
                canPerformAction(currentRole, 'canExecuteTests')
                  ? `Run ${selectedTestCase.code} on chromium`
                  : 'Your role cannot start runs'
              }
              onClick={() =>
                handleExecuteTestCase(selectedTestCase.id, 'chromium')
              }
            >
              {isExecuting ? 'Running…' : `Run ${selectedTestCase.code}`}
            </Button>
          </div>
        </header>

        <main className="flex-1 min-w-0 p-4 lg:p-6 space-y-6">
          <PageHeader
            title={meta.title}
            description={meta.description}
            facts={meta.facts}
          />

          {activeSection === 'builder' && (
            <VisualBuilderView
              state={state}
              actionRegistry={actionRegistry}
              selectedTestCase={selectedTestCase}
              onSelectTestCase={(tc) => setSelectedTestCaseId(tc.id)}
              onSaveTestCase={handleSaveTestCase}
              onExecuteTestCase={handleExecuteTestCase}
              currentRole={currentRole}
              isExecuting={isExecuting}
            />
          )}

          {activeSection === 'executions' && (
            <ExecutionMonitorView
              state={state}
              selectedRunId={selectedRunId}
              onSelectRunId={(id) => setSelectedRunId(id)}
              onExecuteTestCase={handleExecuteTestCase}
              onExecuteSuite={handleExecuteSuite}
              onCancelExecution={async (executionId) => {
                await postAction({action: 'cancel_execution', executionId});
                showToast('success', `Cancelled execution ${executionId}`);
              }}
              currentRole={currentRole}
              isExecuting={isExecuting}
            />
          )}

          {activeSection === 'dashboard' && (
            <DashboardAndAnalyticsView
              state={state}
              analytics={analytics}
              onOpenInBuilder={(tc) => {
                setSelectedTestCaseId(tc.id);
                setActiveSection('builder');
              }}
              onExecuteTestCase={handleExecuteTestCase}
              onInspectRun={(runId) => {
                setSelectedRunId(runId);
                setActiveSection('executions');
              }}
              onOpenSection={(s) => setActiveSection(s)}
              currentRole={currentRole}
              isExecuting={isExecuting}
            />
          )}

          {(activeSection === 'projects' ||
            activeSection === 'sop' ||
            activeSection === 'workers' ||
            activeSection === 'admin') && (
            <OperationsAndGovernanceView
              activeSubView={activeSection}
              state={state}
              currentRole={currentRole}
              onRoleChange={(r) => {
                setCurrentRole(r);
                showToast(
                  'success',
                  `Now acting as ${ROLE_DEFINITIONS[r].label}`
                );
              }}
              onOpenInBuilder={(tc) => {
                setSelectedTestCaseId(tc.id);
                setActiveSection('builder');
              }}
              onDuplicateTestCase={async (testCaseId) => {
                const data = await postAction({
                  action: 'duplicate_test_case',
                  testCaseId,
                });
                if (data.testCase) {
                  showToast(
                    'success',
                    `Cloned test case as ${data.testCase.code}`
                  );
                }
              }}
              onExecuteTestCase={handleExecuteTestCase}
              onSaveSopModule={async (sopModule) => {
                await postAction({action: 'save_sop_module', sopModule});
                showToast(
                  'success',
                  `Published SOP module "${sopModule.name}"`
                );
              }}
              onUpdateWorker={async (payload) => {
                await postAction({action: 'update_worker', ...payload});
                showToast('success', 'Worker configuration updated');
              }}
              onRegisterWorker={async (payload) => {
                await postAction({action: 'register_worker', ...payload});
                showToast('success', `Registered worker ${payload.name}`);
              }}
              onCreateProject={async (payload) => {
                await postAction({action: 'create_project', ...payload});
                showToast('success', `Created project ${payload.key}`);
              }}
              onAddSecret={async (payload) => {
                await postAction({action: 'add_secret', ...payload});
                showToast(
                  'success',
                  `Encrypted and stored {{SECRET:${payload.key}}}`
                );
              }}
              onToggleNotificationRule={async (ruleId) => {
                await postAction({
                  action: 'toggle_notification_rule',
                  ruleId,
                });
              }}
            />
          )}
        </main>
      </div>

      {/* Toast: bottom-right, announced politely; errors persist until dismissed. */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 sm:max-w-md"
      >
        {statusBanner && (
          <div
            key={statusBanner.id}
            role="status"
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg text-[13px] bg-white dark:bg-slate-900',
              statusBanner.type === 'error'
                ? 'border-red-300 dark:border-red-900'
                : 'border-emerald-300 dark:border-emerald-900'
            )}
          >
            {statusBanner.type === 'error' ? (
              <XCircle
                className="w-4 h-4 mt-0.5 shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            )}
            <span className="flex-1 text-slate-800 dark:text-slate-200">
              {statusBanner.message}
            </span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white underline"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
