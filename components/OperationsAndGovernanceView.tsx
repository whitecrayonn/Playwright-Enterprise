'use client';

import React, {useState} from 'react';
import {
  BrowserEngine,
  PlatformState,
  RoleType,
  SOPModule,
  TestCase,
  WorkerStatus,
} from '@/lib/types';
import {ROLE_DEFINITIONS, canPerformAction} from '@/lib/action-registry';
import {
  Bell,
  Copy,
  Cpu,
  FolderTree,
  GitBranch,
  KeyRound,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Server,
  Shield,
  Wrench,
} from 'lucide-react';

interface OperationsAndGovernanceViewProps {
  activeSubView: 'projects' | 'sop' | 'workers' | 'admin';
  state: PlatformState;
  currentRole: RoleType;
  onRoleChange: (role: RoleType) => void;
  onOpenInBuilder: (tc: TestCase) => void;
  onDuplicateTestCase: (testCaseId: string) => Promise<void>;
  onExecuteTestCase: (
    testCaseId: string,
    browser: BrowserEngine
  ) => Promise<void>;
  onSaveSopModule: (sop: Partial<SOPModule>) => Promise<void>;
  onUpdateWorker: (payload: {
    workerId: string;
    status?: WorkerStatus;
    maxConcurrency?: number;
    pool?: string;
    restart?: boolean;
  }) => Promise<void>;
  onRegisterWorker: (payload: {
    name: string;
    pool: string;
    host: string;
    maxConcurrency: number;
  }) => Promise<void>;
  onCreateProject: (payload: {
    name: string;
    key: string;
    description: string;
    workerPool: string;
    concurrencyLimit: number;
  }) => Promise<void>;
  onAddSecret: (payload: {
    key: string;
    value: string;
    environmentSlug: string;
    projectId: string;
  }) => Promise<void>;
  onToggleNotificationRule: (ruleId: string) => Promise<void>;
}

export default function OperationsAndGovernanceView({
  activeSubView,
  state,
  currentRole,
  onRoleChange,
  onOpenInBuilder,
  onDuplicateTestCase,
  onExecuteTestCase,
  onSaveSopModule,
  onUpdateWorker,
  onRegisterWorker,
  onCreateProject,
  onAddSecret,
  onToggleNotificationRule,
}: OperationsAndGovernanceViewProps) {
  // Project Form State
  const [projName, setProjName] = useState('');
  const [projKey, setProjKey] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projPool, setProjPool] = useState('core-linux-pool');
  const [projConcurrency, setProjConcurrency] = useState(6);

  // SOP Form State
  const [sopName, setSopName] = useState('');
  const [sopSlug, setSopSlug] = useState('');
  const [sopVersion, setSopVersion] = useState('1.0.0');
  const [sopCategory, setSopCategory] = useState('Business Workflow');
  const [sopDesc, setSopDesc] = useState('');
  const [sopChangelog, setSopChangelog] = useState('');

  // Worker Form State
  const [workerName, setWorkerName] = useState('');
  const [workerHost, setWorkerHost] = useState('10.42.10.25');
  const [workerPool, setWorkerPool] = useState('core-linux-pool');
  const [workerConcurrency, setWorkerConcurrency] = useState(4);

  // Secret Form State
  const [secretKey, setSecretKey] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [secretEnv, setSecretEnv] = useState('staging');

  const canEditTests = canPerformAction(currentRole, 'canEditTests');
  const canExecute = canPerformAction(currentRole, 'canExecuteTests');
  const canManageSop = canPerformAction(currentRole, 'canManageSopModules');
  const canManageWorkers = canPerformAction(currentRole, 'canManageWorkers');
  const canManageAdmin = canPerformAction(
    currentRole,
    'canManageSecretsAndRbac'
  );

  // ==================== 1. PROJECTS, SUITES & TEST CASES ====================
  if (activeSubView === 'projects') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Workspace -> Project -> Plan -> Suite -> Case Hierarchy (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {state.projects.map((project) => {
              const plans = state.testPlans.filter(
                (tp) => tp.projectId === project.id
              );
              const suites = state.testSuites.filter(
                (ts) => ts.projectId === project.id
              );
              const cases = state.testCases.filter(
                (tc) => tc.projectId === project.id
              );

              return (
                <div
                  key={project.id}
                  className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        Workspace: {state.workspaces[0]?.name} · Key:{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {project.key}
                        </strong>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                        {project.name}
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {project.description}
                      </p>
                    </div>
                    <div className="text-right text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      <div>Worker Pool: {project.workerPool}</div>
                      <div>Concurrency Limit: {project.concurrencyLimit}</div>
                      <div>Retention: {project.artifactRetentionDays} days</div>
                    </div>
                  </div>

                  {/* Environments & Test Plans Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                        Configured Environments ({project.environments.length})
                      </div>
                      {project.environments.map((env) => (
                        <div
                          key={env.id}
                          className="font-mono text-slate-600 dark:text-slate-400 flex items-center justify-between py-0.5"
                        >
                          <span>{env.name}</span>
                          <span>
                            Retries: {env.defaultRetries} · {env.timeoutMs / 1000}s
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                        Test Plans & Suites ({plans.length} Plans · {suites.length} Suites)
                      </div>
                      {plans.map((tp) => (
                        <div
                          key={tp.id}
                          className="text-slate-600 dark:text-slate-400 py-0.5 flex items-center justify-between"
                        >
                          <span>{tp.name}</span>
                          <span className="font-mono">{tp.targetRelease}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Test Cases in Project */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Project Test Cases ({cases.length})
                    </div>
                    {cases.map((tc) => (
                      <div
                        key={tc.id}
                        className="p-3 rounded-md border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="font-mono text-blue-600 dark:text-blue-400">
                              {tc.code}
                            </span>
                            <span>{tc.title}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                            v{tc.version} · {tc.steps.length} steps · Priority:{' '}
                            {tc.priority} · Status: {tc.status} · Author: {tc.author}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenInBuilder(tc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Wrench className="w-3 h-3" />
                            Edit Workflow
                          </button>
                          <button
                            type="button"
                            disabled={!canEditTests}
                            onClick={() => onDuplicateTestCase(tc.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                          >
                            <Copy className="w-3 h-3" />
                            Clone
                          </button>
                          <button
                            type="button"
                            disabled={!canExecute}
                            onClick={() =>
                              onExecuteTestCase(
                                tc.id,
                                tc.browsers[0] || 'chromium'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
                          >
                            <Play className="w-3 h-3" />
                            Run
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Create New Project Form (4 cols) */}
          <div className="lg:col-span-4 p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Create New Automation Project
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!projName.trim() || !projKey.trim()) return;
                await onCreateProject({
                  name: projName.trim(),
                  key: projKey.trim(),
                  description: projDesc.trim(),
                  workerPool: projPool,
                  concurrencyLimit: projConcurrency,
                });
                setProjName('');
                setProjKey('');
                setProjDesc('');
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label
                  htmlFor="proj-name-input"
                  className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Project Name *
                </label>
                <input
                  id="proj-name-input"
                  type="text"
                  required
                  disabled={!canEditTests}
                  placeholder="e.g. MedVault Patient Portal"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="proj-key-input"
                  className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Project Key Prefix *
                </label>
                <input
                  id="proj-key-input"
                  type="text"
                  required
                  maxLength={6}
                  disabled={!canEditTests}
                  placeholder="e.g. MEDV"
                  value={projKey}
                  onChange={(e) => setProjKey(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 font-mono uppercase rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="proj-desc-input"
                  className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Description
                </label>
                <input
                  id="proj-desc-input"
                  type="text"
                  disabled={!canEditTests}
                  placeholder="HIPAA-compliant patient scheduling & telehealth flows"
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="proj-pool-select"
                    className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Worker Pool
                  </label>
                  <select
                    id="proj-pool-select"
                    value={projPool}
                    onChange={(e) => setProjPool(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="core-linux-pool">core-linux-pool</option>
                    <option value="high-mem-pool">high-mem-pool</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="proj-concurrency-input"
                    className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Max Concurrency
                  </label>
                  <input
                    id="proj-concurrency-input"
                    type="number"
                    min={1}
                    max={32}
                    value={projConcurrency}
                    onChange={(e) => setProjConcurrency(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono tabular-nums rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!canEditTests}
                className="w-full px-4 py-2 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
              >
                Create Project & Default Environments
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 2. SOP MODULES REGISTRY ====================
  if (activeSubView === 'sop') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Standard Operating Procedure (SOP) Reusable Module Registry (
              {state.sopModules.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Versioned, centrally maintained Playwright modules imported by generated tests without duplicating underlying implementation code.
            </p>
          </div>

          {state.sopModules.map((sop) => (
            <div
              key={sop.id}
              className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-blue-600 dark:text-blue-400">
                    <span>../sop-modules/{sop.slug}</span>
                    <span>·</span>
                    <span>v{sop.version}</span>
                    <span>·</span>
                    <span>Status: {sop.validationStatus.toUpperCase()}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    {sop.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {sop.description}
                  </p>
                </div>

                <div className="text-right text-xs font-mono tabular-nums text-slate-500">
                  <div>Used in {sop.usageCount} Tests</div>
                  <div>Author: {sop.author}</div>
                  <div>Versions: {sop.availableVersions.join(', ')}</div>
                </div>
              </div>

              <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-1">
                <div className="text-slate-500 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                  Source Repository: {sop.repoReference}
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  Changelog: {sop.changelog}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Register / Publish SOP Module Form */}
        <div className="lg:col-span-4 p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Publish Versioned SOP Module
          </h2>
          {!canManageSop && (
            <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs">
              Note: Current role ({currentRole}) has read/use access to SOP modules. Switch to Automation Engineer or Admin to publish new SOP modules.
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!sopName.trim() || !sopSlug.trim()) return;
              await onSaveSopModule({
                name: sopName.trim(),
                slug: sopSlug.trim(),
                version: sopVersion.trim() || '1.0.0',
                category: sopCategory,
                description: sopDesc.trim(),
                changelog: sopChangelog.trim(),
              });
              setSopName('');
              setSopSlug('');
              setSopDesc('');
              setSopChangelog('');
            }}
            className="space-y-3 text-xs"
          >
            <div>
              <label
                htmlFor="sop-name-input"
                className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                SOP Module Name *
              </label>
              <input
                id="sop-name-input"
                type="text"
                required
                disabled={!canManageSop}
                placeholder="e.g. Multi-Currency Checkout Approval"
                value={sopName}
                onChange={(e) => {
                  setSopName(e.target.value);
                  if (!sopSlug) {
                    setSopSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '')
                    );
                  }
                }}
                className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="sop-slug-input"
                  className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Module Import Slug *
                </label>
                <input
                  id="sop-slug-input"
                  type="text"
                  required
                  disabled={!canManageSop}
                  placeholder="multi-currency-checkout"
                  value={sopSlug}
                  onChange={(e) => setSopSlug(e.target.value)}
                  className="w-full px-3 py-2 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="sop-ver-input"
                  className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Semantic Version *
                </label>
                <input
                  id="sop-ver-input"
                  type="text"
                  required
                  disabled={!canManageSop}
                  value={sopVersion}
                  onChange={(e) => setSopVersion(e.target.value)}
                  className="w-full px-3 py-2 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="sop-desc-input"
                className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Module Specification
              </label>
              <input
                id="sop-desc-input"
                type="text"
                disabled={!canManageSop}
                placeholder="Reusable currency selector and tax verification steps"
                value={sopDesc}
                onChange={(e) => setSopDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="sop-changelog-input"
                className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Release Changelog
              </label>
              <input
                id="sop-changelog-input"
                type="text"
                disabled={!canManageSop}
                placeholder="Initial verified SOP module release"
                value={sopChangelog}
                onChange={(e) => setSopChangelog(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={!canManageSop}
              className="w-full px-4 py-2 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Register SOP Module in Central Library
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==================== 3. WORKER MANAGEMENT ====================
  if (activeSubView === 'workers') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Playwright Execution Worker Cluster ({state.workers.length} Nodes)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Isolated containerized Playwright runners reporting real-time heartbeats, slot capacity, and telemetry.
              </p>
            </div>
          </div>

          {state.workers.map((worker) => (
            <div
              key={worker.id}
              className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span
                      className={`font-bold ${
                        worker.status === 'online'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : worker.status === 'draining'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      [{worker.status.toUpperCase()}]
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {worker.name}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">Pool: {worker.pool}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{worker.host}</span>
                  </div>
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                    Container: {worker.containerId} · Browsers:{' '}
                    {worker.supportedBrowsers.join(', ')} · Total Executed:{' '}
                    {worker.totalExecuted} runs · Last Heartbeat:{' '}
                    {worker.lastHeartbeatAt.slice(11, 19)} UTC
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor={`concurrency-${worker.id}`}
                    className="text-xs font-mono text-slate-500"
                  >
                    Max Slots:
                  </label>
                  <select
                    id={`concurrency-${worker.id}`}
                    disabled={!canManageWorkers}
                    value={worker.maxConcurrency}
                    onChange={(e) =>
                      onUpdateWorker({
                        workerId: worker.id,
                        maxConcurrency: Number(e.target.value),
                      })
                    }
                    className="px-2 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    {[2, 4, 6, 8, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}x
                      </option>
                    ))}
                  </select>

                  {worker.status === 'draining' ? (
                    <button
                      type="button"
                      disabled={!canManageWorkers}
                      onClick={() =>
                        onUpdateWorker({
                          workerId: worker.id,
                          status: 'online',
                        })
                      }
                      className="px-3 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
                    >
                      Activate Worker
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canManageWorkers}
                      onClick={() =>
                        onUpdateWorker({
                          workerId: worker.id,
                          status: 'draining',
                        })
                      }
                      className="px-3 py-1 text-xs font-medium rounded border border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-40"
                    >
                      Drain Node
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!canManageWorkers}
                    onClick={() =>
                      onUpdateWorker({
                        workerId: worker.id,
                        restart: true,
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Restart
                  </button>
                </div>
              </div>

              {/* Resource Telemetry Bars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono tabular-nums">
                <div>
                  <div className="flex justify-between text-slate-500 mb-1">
                    <span>Slot Capacity</span>
                    <span>
                      {worker.activeJobs}/{worker.maxConcurrency} occupied
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      style={{
                        width: `${Math.min(100, (worker.activeJobs / worker.maxConcurrency) * 100)}%`,
                      }}
                      className="h-full rounded-full bg-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-500 mb-1">
                    <span>CPU Utilization</span>
                    <span>{worker.cpuUsagePercent}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      style={{width: `${worker.cpuUsagePercent}%`}}
                      className="h-full rounded-full bg-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-500 mb-1">
                    <span>Memory Usage</span>
                    <span>
                      {worker.memoryUsageMb}/{worker.maxMemoryMb} MB
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      style={{
                        width: `${Math.round((worker.memoryUsageMb / worker.maxMemoryMb) * 100)}%`,
                      }}
                      className="h-full rounded-full bg-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Worker Recent Logs */}
              <div className="p-2.5 rounded bg-slate-950 text-slate-300 font-mono text-xs space-y-1">
                {worker.recentLogs.slice(0, 2).map((l, i) => (
                  <div key={i} className="truncate">
                    {l}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Provision New Worker Node */}
        <div className="lg:col-span-4 p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Register Containerized Worker Node
          </h2>
          {!canManageWorkers && (
            <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs">
              Switch role to Platform Admin or Workspace Admin to register or drain worker nodes.
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!workerName.trim()) return;
              await onRegisterWorker({
                name: workerName.trim(),
                pool: workerPool,
                host: workerHost.trim(),
                maxConcurrency: workerConcurrency,
              });
              setWorkerName('');
            }}
            className="space-y-3 text-xs"
          >
            <div>
              <label
                htmlFor="worker-name-input"
                className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Worker Node Hostname *
              </label>
              <input
                id="worker-name-input"
                type="text"
                required
                disabled={!canManageWorkers}
                placeholder="pw-runner-us-west-03"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                className="w-full px-3 py-2 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="worker-pool-select"
                className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Execution Pool
              </label>
              <select
                id="worker-pool-select"
                disabled={!canManageWorkers}
                value={workerPool}
                onChange={(e) => setWorkerPool(e.target.value)}
                className="w-full px-3 py-2 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              >
                <option value="core-linux-pool">core-linux-pool</option>
                <option value="high-mem-pool">high-mem-pool</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="worker-host-input"
                  className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Private IP
                </label>
                <input
                  id="worker-host-input"
                  type="text"
                  disabled={!canManageWorkers}
                  value={workerHost}
                  onChange={(e) => setWorkerHost(e.target.value)}
                  className="w-full px-3 py-2 font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="worker-slots-input"
                  className="block font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Max Slots
                </label>
                <input
                  id="worker-slots-input"
                  type="number"
                  min={1}
                  max={16}
                  disabled={!canManageWorkers}
                  value={workerConcurrency}
                  onChange={(e) => setWorkerConcurrency(Number(e.target.value))}
                  className="w-full px-3 py-2 font-mono tabular-nums rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={!canManageWorkers}
              className="w-full px-4 py-2 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" />
              Register Worker Container
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==================== 4. ENTERPRISE RBAC, SECRETS, NOTIFICATIONS & AUDIT LOGS ====================
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* RBAC Role Switcher & Enforcement Matrix (6 cols) */}
        <div className="lg:col-span-6 p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Role-Based Access Control (RBAC) Enforcement
            </h2>
            <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
              Active Session Role: {ROLE_DEFINITIONS[currentRole].label}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            Select a role below to test live backend API and UI permission enforcement across the platform.
          </p>

          <div className="space-y-2">
            {(Object.keys(ROLE_DEFINITIONS) as RoleType[]).map((rKey) => {
              const def = ROLE_DEFINITIONS[rKey];
              const isCurrent = currentRole === rKey;
              return (
                <div
                  key={rKey}
                  onClick={() => onRoleChange(rKey)}
                  className={`p-3 rounded-md border cursor-pointer transition-colors ${
                    isCurrent
                      ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span>{def.label}</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      {isCurrent ? 'ACTIVE ROLE' : 'Switch Role'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {def.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Encrypted Secrets Vault & Notification Channels (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Encrypted Secrets Vault */}
          <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Encrypted Secrets Vault (Zero-Plaintext Code Generation)
            </h2>

            <div className="space-y-2">
              {state.secrets.map((sec) => (
                <div
                  key={sec.id}
                  className="p-2.5 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <strong className="text-slate-900 dark:text-white">
                      {`{{SECRET:${sec.key}}}`}
                    </strong>
                    <span className="text-slate-400 ml-2">
                      · Env: {sec.environmentSlug}
                    </span>
                  </div>
                  <span className="text-slate-500">{sec.maskedValue}</span>
                </div>
              ))}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!secretKey.trim() || !secretValue.trim()) return;
                await onAddSecret({
                  key: secretKey.trim(),
                  value: secretValue.trim(),
                  environmentSlug: secretEnv,
                  projectId: state.projects[0].id,
                });
                setSecretKey('');
                setSecretValue('');
              }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs"
            >
              <input
                type="text"
                required
                disabled={!canManageAdmin}
                aria-label="Secret Key Identifier"
                placeholder="STRIPE_TEST_SECRET"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value.toUpperCase())}
                className="px-3 py-1.5 font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <input
                type="password"
                required
                disabled={!canManageAdmin}
                aria-label="Secret Plaintext Value"
                placeholder="Secret value to encrypt..."
                value={secretValue}
                onChange={(e) => setSecretValue(e.target.value)}
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <button
                type="submit"
                disabled={!canManageAdmin}
                className="px-3 py-1.5 font-semibold rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
              >
                Encrypt & Store
              </button>
            </form>
          </div>

          {/* Notification Rules & Deduplicated Issue Tracking */}
          <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Alerting Channels & Jira Deduplication Rules
            </h2>
            {state.notificationRules.map((rule) => (
              <div
                key={rule.id}
                className="p-3 rounded-md border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {rule.name} ({rule.channel.toUpperCase()})
                  </div>
                  <div className="text-slate-500 font-mono mt-0.5">
                    Target: {rule.targetDestination} · Deduplicate:{' '}
                    {rule.deduplicateFailures ? 'ON' : 'OFF'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleNotificationRule(rule.id)}
                  className={`px-3 py-1 font-semibold rounded transition-colors ${
                    rule.enabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {rule.enabled ? 'Enabled' : 'Paused'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Immutable Audit Log Table */}
      <div className="p-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Immutable Security & Operational Audit Trail ({state.auditLogs.length})
        </h2>
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-md">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Actor & Role</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Resource</th>
                <th className="py-2 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {state.auditLogs.slice(0, 12).map((log) => (
                <tr key={log.id}>
                  <td className="py-2 px-3 text-slate-500 tabular-nums whitespace-nowrap">
                    {log.timestamp.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="py-2 px-3 text-slate-900 dark:text-white whitespace-nowrap">
                    {log.actor} ({log.role})
                  </td>
                  <td className="py-2 px-3 text-blue-600 dark:text-blue-400 font-semibold whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                    {log.resourceType}:{log.resourceId}
                  </td>
                  <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                    {log.details}
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
