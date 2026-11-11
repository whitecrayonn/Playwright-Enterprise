'use client';

import React, {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {
  ActionRegistryEntry,
  BrowserEngine,
  PlatformState,
  RoleType,
  SOPModule,
  TestCase,
  WorkerStatus,
} from '@/lib/types';
import {AnalyticsSummary, ROLE_DEFINITIONS} from '@/lib/action-registry';
import VisualBuilderView from '@/components/VisualBuilderView';
import ExecutionMonitorView from '@/components/ExecutionMonitorView';
import DashboardAndAnalyticsView from '@/components/DashboardAndAnalyticsView';
import OperationsAndGovernanceView from '@/components/OperationsAndGovernanceView';
import {
  Activity,
  AlertCircle,
  ExternalLink,
  FolderTree,
  Layers,
  LayoutDashboard,
  Moon,
  Play,
  Server,
  Shield,
  Sun,
  Wrench,
} from 'lucide-react';

type ActiveSection =
  | 'dashboard'
  | 'builder'
  | 'executions'
  | 'projects'
  | 'sop'
  | 'workers'
  | 'admin';

export default function PlaywrightStudioEnterpriseApp() {
  const [state, setState] = useState<PlatformState | null>(null);
  const [actionRegistry, setActionRegistry] = useState<ActionRegistryEntry[]>(
    []
  );
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>('builder');
  const [selectedTestCaseId, setSelectedTestCaseId] =
    useState<string>('tc-101');
  const [selectedRunId, setSelectedRunId] = useState<string | null>('EX-1004');
  const [currentRole, setCurrentRole] =
    useState<RoleType>('platform_admin');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      setStatusBanner({type, message});
    },
    []
  );

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
        showToast(
          'error',
          err instanceof Error ? err.message : 'Error loading state'
        );
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', nextDark);
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
          `Saved ${data.testCase.code} (v${data.testCase.version}) and regenerated Playwright TypeScript spec.`
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
          `Execution ${data.run.id} (${data.run.testCaseCode}) completed on ${data.run.workerName}: ${data.run.status.toUpperCase()} (${data.run.passedSteps}/${data.run.totalSteps} steps in ${data.run.durationMs}ms)`
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
        showToast(
          'success',
          `Suite execution finished: ${passedCount}/${data.runs.length} test cases passed across parallel worker pool.`
        );
      }
    } catch {
      // Handled by postAction
    } finally {
      setIsExecuting(false);
    }
  };

  if (!state || !analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-sm font-mono">
        Loading Playwright Studio Enterprise Workspace...
      </div>
    );
  }

  const selectedTestCase =
    state.testCases.find((tc) => tc.id === selectedTestCaseId) ||
    state.testCases[0];

  const navItems: {
    id: ActiveSection;
    label: string;
    icon: React.ComponentType<{className?: string}>;
    count?: number | string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Overview & Analytics',
      icon: LayoutDashboard,
      count: `${analytics.passRatePercent}%`,
    },
    {
      id: 'builder',
      label: 'Visual Test Builder',
      icon: Wrench,
      count: state.testCases.length,
    },
    {
      id: 'executions',
      label: 'Executions & Reports',
      icon: Activity,
      count: state.executions.length,
    },
    {
      id: 'projects',
      label: 'Projects & Test Suites',
      icon: FolderTree,
      count: state.projects.length,
    },
    {
      id: 'sop',
      label: 'SOP Module Library',
      icon: Layers,
      count: state.sopModules.length,
    },
    {
      id: 'workers',
      label: 'Worker Management',
      icon: Server,
      count: `${analytics.onlineWorkers}/${state.workers.length}`,
    },
    {
      id: 'admin',
      label: 'RBAC, Secrets & Audit',
      icon: Shield,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar following strict 3-zone contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => setActiveSection('dashboard')}
          className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          Playwright Studio Enterprise
        </button>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className={`hover:text-slate-900 dark:hover:text-white hover:underline transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'dashboard'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : ''
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('builder')}
            className={`hover:text-slate-900 dark:hover:text-white hover:underline transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'builder'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : ''
            }`}
          >
            Visual Builder
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('executions')}
            className={`hover:text-slate-900 dark:hover:text-white hover:underline transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'executions'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : ''
            }`}
          >
            Executions
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('sop')}
            className={`hover:text-slate-900 dark:hover:text-white hover:underline transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'sop'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : ''
            }`}
          >
            SOP Modules
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('workers')}
            className={`hover:text-slate-900 dark:hover:text-white hover:underline transition-colors whitespace-nowrap shrink-0 ${
              activeSection === 'workers'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : ''
            }`}
          >
            Workers
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={isExecuting}
            onClick={() =>
              handleExecuteTestCase(selectedTestCase.id, 'chromium')
            }
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 inline mr-1.5" />
            {isExecuting ? 'Running Test...' : `Run ${selectedTestCase.code}`}
          </button>
        </div>
      </header>

      {/* Main Workspace Layout: Sidebar + Content Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Enterprise Sidebar (256px on desktop) */}
        <aside className="w-full lg:w-64 shrink-0 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            {/* Workspace Context */}
            <div className="px-2.5 py-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="text-slate-400 font-medium">Active Workspace</div>
              <div className="font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {state.workspaces[0]?.name}
              </div>
              <div className="text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {state.projects.length} Projects · {analytics.onlineWorkers} Workers
              </div>
            </div>

            {/* Sidebar Links */}
            <nav aria-label="Workspace Sections" className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {item.count !== undefined && (
                      <span
                        className={`font-mono tabular-nums text-xs ${
                          active
                            ? 'text-blue-100'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sidebar Controls: Target App Link, Role Switcher & Theme Toggle */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
            <Link
              href="/sample-app"
              className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-blue-600 dark:text-blue-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Controlled Target App</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <div>
              <label
                htmlFor="sidebar-role-select"
                className="block text-slate-500 dark:text-slate-400 mb-1"
              >
                Active RBAC Role:
              </label>
              <select
                id="sidebar-role-select"
                aria-label="Active RBAC Role"
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value as RoleType)}
                className="w-full px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                {(Object.keys(ROLE_DEFINITIONS) as RoleType[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_DEFINITIONS[r].label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Appearance Theme</span>
              <span className="flex items-center gap-1.5 font-mono">
                {isDark ? (
                  <>
                    <Moon className="w-3.5 h-3.5" /> Dark
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5" /> Light
                  </>
                )}
              </span>
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-6 space-y-5">
          {/* Contextual Breadcrumb & Status Banner Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span>{state.workspaces[0]?.name}</span>
              <span>/</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {navItems.find((n) => n.id === activeSection)?.label}
              </span>
              <span>·</span>
              <span className="font-mono">
                Role: {ROLE_DEFINITIONS[currentRole].label}
              </span>
            </div>

            {statusBanner && (
              <div
                role="status"
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 border ${
                  statusBanner.type === 'error'
                    ? 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{statusBanner.message}</span>
                <button
                  type="button"
                  onClick={() => setStatusBanner(null)}
                  className="ml-2 underline"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Active View Render */}
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
                  `Switched active RBAC role to ${ROLE_DEFINITIONS[r].label}`
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
                  `Registered SOP module "${sopModule.name}" in central library`
                );
              }}
              onUpdateWorker={async (payload) => {
                await postAction({action: 'update_worker', ...payload});
                showToast('success', `Updated worker node configuration`);
              }}
              onRegisterWorker={async (payload) => {
                await postAction({action: 'register_worker', ...payload});
                showToast(
                  'success',
                  `Registered new worker container ${payload.name}`
                );
              }}
              onCreateProject={async (payload) => {
                await postAction({action: 'create_project', ...payload});
                showToast('success', `Created project ${payload.key}`);
              }}
              onAddSecret={async (payload) => {
                await postAction({action: 'add_secret', ...payload});
                showToast(
                  'success',
                  `Encrypted and stored secret {{SECRET:${payload.key}}}`
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
    </div>
  );
}
