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
  Badge,
  Button,
  FactGrid,
  Field,
  Notice,
  Panel,
  StatusBadge,
  Tone,
  formatTimestamp,
  inputClass,
  percent,
  selectClass,
  toneText,
} from '@/components/ui';
import {cn} from '@/lib/utils';
import {
  Copy,
  FolderTree,
  GitBranch,
  KeyRound,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Server,
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

const th =
  'py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap text-left';
const td = 'py-2.5 px-3 align-top';

const PERMISSION_COLUMNS: {
  key: Parameters<typeof canPerformAction>[1];
  label: string;
}[] = [
  {key: 'canViewDashboards', label: 'View'},
  {key: 'canEditTests', label: 'Edit tests'},
  {key: 'canExecuteTests', label: 'Run tests'},
  {key: 'canManageSopModules', label: 'Publish SOPs'},
  {key: 'canManageWorkers', label: 'Manage workers'},
  {key: 'canManageSecretsAndRbac', label: 'Secrets & roles'},
];

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function loadTone(pct: number): Tone {
  if (pct >= 90) return 'bad';
  if (pct >= 75) return 'warn';
  return 'neutral';
}

function RoleNotice({children}: {children: React.ReactNode}) {
  return <Notice tone="info">{children}</Notice>;
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
  // Project form
  const [projName, setProjName] = useState('');
  const [projKey, setProjKey] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projPool, setProjPool] = useState('core-linux-pool');
  const [projConcurrency, setProjConcurrency] = useState(6);

  // SOP form
  const [sopName, setSopName] = useState('');
  const [sopSlug, setSopSlug] = useState('');
  const [sopVersion, setSopVersion] = useState('1.0.0');
  const [sopCategory] = useState('Business Workflow');
  const [sopDesc, setSopDesc] = useState('');
  const [sopChangelog, setSopChangelog] = useState('');

  // Worker form
  const [workerName, setWorkerName] = useState('');
  const [workerHost, setWorkerHost] = useState('10.42.10.25');
  const [workerPool, setWorkerPool] = useState('core-linux-pool');
  const [workerConcurrency, setWorkerConcurrency] = useState(4);

  // Secret form
  const [secretKey, setSecretKey] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [secretEnv] = useState('staging');

  const canEditTests = canPerformAction(currentRole, 'canEditTests');
  const canExecute = canPerformAction(currentRole, 'canExecuteTests');
  const canManageSop = canPerformAction(currentRole, 'canManageSopModules');
  const canManageWorkers = canPerformAction(currentRole, 'canManageWorkers');
  const canManageAdmin = canPerformAction(
    currentRole,
    'canManageSecretsAndRbac'
  );
  const roleLabel = ROLE_DEFINITIONS[currentRole].label;

  // ==================== 1. PROJECTS, PLANS, SUITES & TEST CASES ====================
  if (activeSubView === 'projects') {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-6">
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
              <Panel
                key={project.id}
                id={`project-${project.id}`}
                title={
                  <>
                    <span className="font-mono text-slate-500 dark:text-slate-400 mr-2">
                      {project.key}
                    </span>
                    {project.name}
                  </>
                }
                description={project.description}
                bodyClassName="p-0"
              >
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <FactGrid
                    columns={4}
                    items={[
                      {
                        label: 'Worker pool',
                        value: project.workerPool,
                        mono: true,
                      },
                      {
                        label: 'Max parallel runs',
                        value: project.concurrencyLimit,
                        mono: true,
                      },
                      {
                        label: 'Artifact retention',
                        value: `${project.artifactRetentionDays} days`,
                        mono: true,
                      },
                      {
                        label: 'Default environment',
                        value: project.defaultEnvironment,
                      },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="p-4 lg:border-r border-slate-100 dark:border-slate-800">
                    <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white mb-2">
                      Environments ({project.environments.length})
                    </h3>
                    <ul className="space-y-2 text-[13px]">
                      {project.environments.map((env) => (
                        <li key={env.id}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-slate-900 dark:text-white">
                              {env.name}
                            </span>
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {env.defaultRetries} retries ·{' '}
                              {env.timeoutMs / 1000}s timeout
                            </span>
                          </div>
                          <div className="font-mono text-xs text-slate-500 dark:text-slate-400 break-all">
                            {env.baseUrl}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4">
                    <h3 className="text-[13px] font-semibold text-slate-900 dark:text-white mb-2">
                      Test plans and suites
                    </h3>
                    <ul className="space-y-3 text-[13px]">
                      {plans.map((tp) => {
                        const planSuites = suites.filter(
                          (s) => s.testPlanId === tp.id
                        );
                        return (
                          <li key={tp.id}>
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="text-slate-900 dark:text-white">
                                {tp.name}
                              </span>
                              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {tp.targetRelease}
                              </span>
                            </div>
                            {tp.scheduleCron && (
                              <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                Scheduled: {tp.scheduleCron}
                              </div>
                            )}
                            {planSuites.length > 0 && (
                              <ul className="mt-1 pl-3 border-l border-slate-200 dark:border-slate-800 space-y-0.5">
                                {planSuites.map((s) => (
                                  <li
                                    key={s.id}
                                    className="text-xs text-slate-600 dark:text-slate-400"
                                  >
                                    {s.name}{' '}
                                    <span className="font-mono text-slate-400">
                                      ·{' '}
                                      {
                                        cases.filter(
                                          (c) => c.testSuiteId === s.id
                                        ).length
                                      }{' '}
                                      tests · {s.parallelism}× parallel
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                      {plans.length === 0 && (
                        <li className="text-xs text-slate-500">
                          No test plans yet.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="relative overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <caption className="sr-only">
                      Test cases in {project.name}
                    </caption>
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th scope="col" className={th}>
                          Test case ({cases.length})
                        </th>
                        <th scope="col" className={th}>
                          Status
                        </th>
                        <th scope="col" className={th}>
                          Priority
                        </th>
                        <th scope="col" className={cn(th, 'text-right')}>
                          Steps · version
                        </th>
                        <th scope="col" className={cn(th, 'text-right')}>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {cases.map((tc) => (
                        <tr key={tc.id}>
                          <td className={td}>
                            <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                              {tc.code} · {tc.author}
                            </div>
                            <div className="text-slate-900 dark:text-white">
                              {tc.title}
                            </div>
                          </td>
                          <td className={td}>
                            <StatusBadge status={tc.status} />
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
                          <td
                            className={cn(
                              td,
                              'text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap'
                            )}
                          >
                            {tc.steps.length} · v{tc.version}
                          </td>
                          <td className={cn(td, 'text-right whitespace-nowrap')}>
                            <div className="inline-flex items-center gap-1.5">
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
                                variant="secondary"
                                icon={Copy}
                                disabled={!canEditTests}
                                onClick={() => onDuplicateTestCase(tc.id)}
                              >
                                Clone
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                icon={Play}
                                disabled={!canExecute}
                                onClick={() =>
                                  onExecuteTestCase(
                                    tc.id,
                                    tc.browsers[0] || 'chromium'
                                  )
                                }
                              >
                                Run
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            );
          })}
        </div>

        <Panel
          as="aside"
          id="create-project"
          className="xl:col-span-4 xl:sticky xl:top-20"
          title={
            <span className="inline-flex items-center gap-2">
              <FolderTree
                className="w-4 h-4 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
              New project
            </span>
          }
          description="Creates the project with default environments. Test codes use the key as prefix."
        >
          {!canEditTests && (
            <div className="mb-3">
              <RoleNotice>
                {roleLabel} cannot create projects. Switch to an
                engineer or admin role.
              </RoleNotice>
            </div>
          )}
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
            className="space-y-3"
          >
            <Field label="Project name" htmlFor="proj-name-input" required>
              <input
                id="proj-name-input"
                type="text"
                required
                disabled={!canEditTests}
                placeholder="e.g. MedVault Patient Portal"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Key prefix"
              htmlFor="proj-key-input"
              required
              hint="Up to 6 letters, e.g. MEDV → MEDV-TC-101."
            >
              <input
                id="proj-key-input"
                type="text"
                required
                maxLength={6}
                disabled={!canEditTests}
                placeholder="MEDV"
                value={projKey}
                onChange={(e) => setProjKey(e.target.value.toUpperCase())}
                className={cn(inputClass, 'font-mono uppercase')}
              />
            </Field>
            <Field label="Description" htmlFor="proj-desc-input">
              <input
                id="proj-desc-input"
                type="text"
                disabled={!canEditTests}
                placeholder="Patient scheduling and telehealth flows"
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Worker pool" htmlFor="proj-pool-select">
                <select
                  id="proj-pool-select"
                  disabled={!canEditTests}
                  value={projPool}
                  onChange={(e) => setProjPool(e.target.value)}
                  className={cn(selectClass, 'w-full font-mono text-xs')}
                >
                  <option value="core-linux-pool">core-linux-pool</option>
                  <option value="high-mem-pool">high-mem-pool</option>
                </select>
              </Field>
              <Field label="Max parallel" htmlFor="proj-concurrency-input">
                <input
                  id="proj-concurrency-input"
                  type="number"
                  min={1}
                  max={32}
                  disabled={!canEditTests}
                  value={projConcurrency}
                  onChange={(e) => setProjConcurrency(Number(e.target.value))}
                  className={cn(inputClass, 'font-mono tabular-nums')}
                />
              </Field>
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={!canEditTests}
              className="w-full"
            >
              Create project
            </Button>
          </form>
        </Panel>
      </div>
    );
  }

  // ==================== 2. SOP MODULE LIBRARY ====================
  if (activeSubView === 'sop') {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          {state.sopModules.map((sop) => (
            <Panel
              key={sop.id}
              id={`sop-${sop.id}`}
              title={sop.name}
              description={sop.description}
              actions={<StatusBadge status={sop.validationStatus} />}
            >
              <div className="space-y-4">
                <FactGrid
                  columns={4}
                  items={[
                    {
                      label: 'Import path',
                      value: `sop-modules/${sop.slug}`,
                      mono: true,
                    },
                    {
                      label: 'Version (available)',
                      value: `v${sop.version} (${sop.availableVersions.join(', ')})`,
                      mono: true,
                    },
                    {
                      label: 'Used by',
                      value: `${sop.usageCount} test${sop.usageCount === 1 ? '' : 's'}`,
                      mono: true,
                    },
                    {
                      label: 'Owner',
                      value: `${sop.author} · ${ROLE_DEFINITIONS[sop.ownerRole]?.label ?? sop.ownerRole}`,
                    },
                    {
                      label: 'Steps',
                      value: sop.steps.length,
                      mono: true,
                    },
                    {
                      label: 'Inputs',
                      value:
                        sop.inputParameters.length > 0
                          ? sop.inputParameters.map((p) => p.name).join(', ')
                          : 'None',
                      mono: true,
                    },
                    {
                      label: 'Outputs',
                      value:
                        sop.outputParameters.length > 0
                          ? sop.outputParameters.join(', ')
                          : 'None',
                      mono: true,
                    },
                    {
                      label: 'Updated (UTC)',
                      value: formatTimestamp(sop.updatedAt),
                      mono: true,
                    },
                  ]}
                />
                <div className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-mono text-slate-600 dark:text-slate-400 break-all">
                    <GitBranch
                      className="w-3.5 h-3.5 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    {sop.repoReference}
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">
                      Latest change:{' '}
                    </span>
                    {sop.changelog}
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>

        <Panel
          as="aside"
          id="publish-sop"
          className="xl:col-span-4 xl:sticky xl:top-20"
          title={
            <span className="inline-flex items-center gap-2">
              <Layers
                className="w-4 h-4 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
              Publish SOP module
            </span>
          }
          description="Publishes a new module or version to the shared library."
        >
          {!canManageSop && (
            <div className="mb-3">
              <RoleNotice>
                {roleLabel} can use SOP modules but not publish them. Switch
                to Automation Engineer or an admin role.
              </RoleNotice>
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
            className="space-y-3"
          >
            <Field label="Module name" htmlFor="sop-name-input" required>
              <input
                id="sop-name-input"
                type="text"
                required
                disabled={!canManageSop}
                placeholder="e.g. Multi-currency checkout approval"
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
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Import slug"
                htmlFor="sop-slug-input"
                required
                hint="Filled from the name."
              >
                <input
                  id="sop-slug-input"
                  type="text"
                  required
                  disabled={!canManageSop}
                  placeholder="multi-currency-checkout"
                  value={sopSlug}
                  onChange={(e) => setSopSlug(e.target.value)}
                  className={cn(inputClass, 'font-mono text-xs')}
                />
              </Field>
              <Field
                label="Version"
                htmlFor="sop-ver-input"
                required
                hint="Semantic, e.g. 1.2.0"
              >
                <input
                  id="sop-ver-input"
                  type="text"
                  required
                  disabled={!canManageSop}
                  value={sopVersion}
                  onChange={(e) => setSopVersion(e.target.value)}
                  className={cn(inputClass, 'font-mono text-xs')}
                />
              </Field>
            </div>
            <Field label="What it does" htmlFor="sop-desc-input">
              <input
                id="sop-desc-input"
                type="text"
                disabled={!canManageSop}
                placeholder="Selects currency and verifies tax lines"
                value={sopDesc}
                onChange={(e) => setSopDesc(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Changelog" htmlFor="sop-changelog-input">
              <input
                id="sop-changelog-input"
                type="text"
                disabled={!canManageSop}
                placeholder="Initial release"
                value={sopChangelog}
                onChange={(e) => setSopChangelog(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Button
              type="submit"
              variant="primary"
              disabled={!canManageSop}
              className="w-full"
            >
              Publish module
            </Button>
          </form>
        </Panel>
      </div>
    );
  }

  // ==================== 3. WORKERS ====================
  if (activeSubView === 'workers') {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          {!canManageWorkers && (
            <RoleNotice>
              {roleLabel} can view workers but not drain, restart or resize
              them. Switch to Platform or Workspace Administrator.
            </RoleNotice>
          )}
          {state.workers.map((worker) => {
            const slotPct = percent(worker.activeJobs, worker.maxConcurrency);
            const memPct = percent(worker.memoryUsageMb, worker.maxMemoryMb);
            return (
              <Panel
                key={worker.id}
                id={`worker-${worker.id}`}
                title={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="font-mono">{worker.name}</span>
                    <StatusBadge status={worker.status} />
                  </span>
                }
                description={
                  <span className="font-mono">
                    {worker.pool} · {worker.host} · container{' '}
                    {worker.containerId}
                  </span>
                }
                actions={
                  <>
                    <label
                      htmlFor={`concurrency-${worker.id}`}
                      className="text-xs text-slate-500 dark:text-slate-400"
                    >
                      Slots
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
                      className={cn(selectClass, 'h-7 text-xs font-mono')}
                    >
                      {[2, 4, 6, 8, 12].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    {worker.status === 'draining' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canManageWorkers}
                        onClick={() =>
                          onUpdateWorker({
                            workerId: worker.id,
                            status: 'online',
                          })
                        }
                      >
                        Resume jobs
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canManageWorkers}
                        onClick={() =>
                          onUpdateWorker({
                            workerId: worker.id,
                            status: 'draining',
                          })
                        }
                      >
                        Drain
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={RefreshCw}
                      disabled={!canManageWorkers}
                      onClick={() =>
                        onUpdateWorker({workerId: worker.id, restart: true})
                      }
                    >
                      Restart
                    </Button>
                  </>
                }
              >
                <div className="space-y-4">
                  <FactGrid
                    columns={4}
                    items={[
                      {
                        label: 'Slots in use',
                        value: `${worker.activeJobs} of ${worker.maxConcurrency} (${slotPct}%)`,
                        mono: true,
                        tone: loadTone(slotPct),
                      },
                      {
                        label: 'CPU',
                        value: `${worker.cpuUsagePercent}%`,
                        mono: true,
                        tone: loadTone(worker.cpuUsagePercent),
                      },
                      {
                        label: 'Memory',
                        value: `${worker.memoryUsageMb} / ${worker.maxMemoryMb} MB (${memPct}%)`,
                        mono: true,
                        tone: loadTone(memPct),
                      },
                      {
                        label: 'Browsers',
                        value: worker.supportedBrowsers.join(', '),
                        mono: true,
                      },
                      {
                        label: 'Runs executed',
                        value: worker.totalExecuted,
                        mono: true,
                      },
                      {
                        label: 'Errors',
                        value: worker.errorCount,
                        mono: true,
                        tone: worker.errorCount > 0 ? 'warn' : 'neutral',
                      },
                      {
                        label: 'Uptime',
                        value: formatUptime(worker.uptimeSeconds),
                        mono: true,
                      },
                      {
                        label: 'Last heartbeat (UTC)',
                        value: formatTimestamp(worker.lastHeartbeatAt),
                        mono: true,
                      },
                    ]}
                  />
                  {worker.recentLogs.length > 0 && (
                    <div className="rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs">
                      <div className="px-3 py-1.5 text-slate-500 border-b border-slate-800">
                        Recent log
                      </div>
                      <ol className="px-3 py-2 space-y-0.5">
                        {worker.recentLogs.slice(0, 3).map((l, i) => (
                          <li key={i} className="break-all">
                            {l}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>

        <Panel
          as="aside"
          id="register-worker"
          className="xl:col-span-4 xl:sticky xl:top-20"
          title={
            <span className="inline-flex items-center gap-2">
              <Server
                className="w-4 h-4 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
              Register worker
            </span>
          }
          description="Adds a containerised runner to a pool. It takes jobs once its first heartbeat arrives."
        >
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
            className="space-y-3"
          >
            <Field label="Hostname" htmlFor="worker-name-input" required>
              <input
                id="worker-name-input"
                type="text"
                required
                disabled={!canManageWorkers}
                placeholder="pw-runner-us-west-03"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                className={cn(inputClass, 'font-mono')}
              />
            </Field>
            <Field label="Pool" htmlFor="worker-pool-select">
              <select
                id="worker-pool-select"
                disabled={!canManageWorkers}
                value={workerPool}
                onChange={(e) => setWorkerPool(e.target.value)}
                className={cn(selectClass, 'w-full font-mono')}
              >
                <option value="core-linux-pool">core-linux-pool</option>
                <option value="high-mem-pool">high-mem-pool</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Private IP" htmlFor="worker-host-input">
                <input
                  id="worker-host-input"
                  type="text"
                  disabled={!canManageWorkers}
                  value={workerHost}
                  onChange={(e) => setWorkerHost(e.target.value)}
                  className={cn(inputClass, 'font-mono')}
                />
              </Field>
              <Field label="Slots" htmlFor="worker-slots-input">
                <input
                  id="worker-slots-input"
                  type="number"
                  min={1}
                  max={16}
                  disabled={!canManageWorkers}
                  value={workerConcurrency}
                  onChange={(e) => setWorkerConcurrency(Number(e.target.value))}
                  className={cn(inputClass, 'font-mono tabular-nums')}
                />
              </Field>
            </div>
            <Button
              type="submit"
              variant="primary"
              icon={Plus}
              disabled={!canManageWorkers}
              className="w-full"
            >
              Register worker
            </Button>
          </form>
        </Panel>
      </div>
    );
  }

  // ==================== 4. ACCESS, SECRETS, ALERTS & AUDIT ====================
  return (
    <div className="space-y-6">
      {/* Role permission matrix */}
      <Panel
        id="rbac"
        title="Roles and permissions"
        description="The API enforces these on every request. Pick “Act as” to try the app with a role's permissions."
        bodyClassName="p-0 overflow-x-auto"
      >
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th scope="col" className={th}>
                Role
              </th>
              {PERMISSION_COLUMNS.map((p) => (
                <th
                  key={p.key}
                  scope="col"
                  className={cn(th, 'text-center')}
                >
                  {p.label}
                </th>
              ))}
              <th scope="col" className={cn(th, 'text-right')}>
                <span className="sr-only">Switch role</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(Object.keys(ROLE_DEFINITIONS) as RoleType[]).map((rKey) => {
              const def = ROLE_DEFINITIONS[rKey];
              const isCurrent = currentRole === rKey;
              return (
                <tr
                  key={rKey}
                  className={cn(
                    isCurrent && 'bg-blue-50/60 dark:bg-blue-950/25'
                  )}
                >
                  <th scope="row" className={cn(td, 'text-left font-normal')}>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {def.label}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                      {def.description}
                    </div>
                  </th>
                  {PERMISSION_COLUMNS.map((p) => {
                    const allowed = def.permissions[p.key];
                    return (
                      <td
                        key={p.key}
                        className={cn(
                          td,
                          'text-center text-xs',
                          allowed
                            ? toneText('good')
                            : 'text-slate-400 dark:text-slate-600'
                        )}
                      >
                        {allowed ? 'Yes' : 'No'}
                      </td>
                    );
                  })}
                  <td className={cn(td, 'text-right')}>
                    {isCurrent ? (
                      <Badge tone="info">Acting as</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onRoleChange(rKey)}
                      >
                        Act as
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Secrets */}
        <Panel
          id="secrets"
          title={
            <span className="inline-flex items-center gap-2">
              <KeyRound
                className="w-4 h-4 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
              Secrets vault
            </span>
          }
          description="Tests reference a secret by key; generated specs never contain the plain value."
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.secrets.map((sec) => (
              <li
                key={sec.id}
                className="px-4 py-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
              >
                <div className="min-w-0">
                  <code className="font-mono text-[13px] text-slate-900 dark:text-white break-all">
                    {`{{SECRET:${sec.key}}}`}
                  </code>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {sec.environmentSlug} · added by {sec.createdBy}
                    {sec.lastUsedAt &&
                      ` · last used ${formatTimestamp(sec.lastUsedAt)} UTC`}
                  </div>
                </div>
                <span className="font-mono text-xs text-slate-500">
                  {sec.maskedValue}
                </span>
              </li>
            ))}
          </ul>
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
            className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3"
          >
            {!canManageAdmin && (
              <RoleNotice>
                Only Platform or Workspace Administrators can add secrets.
              </RoleNotice>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label={`New secret key (${secretEnv})`}
                htmlFor="secret-key-input"
              >
                <input
                  id="secret-key-input"
                  type="text"
                  required
                  disabled={!canManageAdmin}
                  aria-label="Secret Key Identifier"
                  placeholder="STRIPE_TEST_SECRET"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value.toUpperCase())}
                  className={cn(inputClass, 'font-mono')}
                />
              </Field>
              <Field label="Value" htmlFor="secret-value-input">
                <input
                  id="secret-value-input"
                  type="password"
                  required
                  autoComplete="off"
                  disabled={!canManageAdmin}
                  aria-label="Secret Plaintext Value"
                  placeholder="Encrypted on save"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <Button type="submit" variant="primary" disabled={!canManageAdmin}>
              Encrypt and store
            </Button>
          </form>
        </Panel>

        {/* Alert rules */}
        <Panel
          id="alerts"
          title="Alert rules"
          description="Where failures and worker problems are reported. Deduplication groups repeats of the same failure."
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.notificationRules.map((rule) => (
              <li
                key={rule.id}
                className="px-4 py-3 flex flex-wrap sm:flex-nowrap items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {rule.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="uppercase font-mono">{rule.channel}</span>{' '}
                    → <span className="font-mono break-all">{rule.targetDestination}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    On: {rule.events.map((e) => e.replace(/_/g, ' ')).join(', ')}
                    {' · '}
                    Dedup {rule.deduplicateFailures ? 'on' : 'off'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={`${rule.name} alerts`}
                  onClick={() => onToggleNotificationRule(rule.id)}
                  className={cn(
                    'shrink-0 inline-flex items-center gap-2 h-7 px-2.5 rounded-md text-xs font-medium border transition-colors',
                    rule.enabled
                      ? 'border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                      : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      rule.enabled ? 'bg-emerald-500' : 'bg-slate-400'
                    )}
                  />
                  {rule.enabled ? 'On' : 'Paused'}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Audit log */}
      <Panel
        id="audit"
        title="Audit trail"
        description={`Append-only record of changes. Showing the latest ${Math.min(12, state.auditLogs.length)} of ${state.auditLogs.length}.`}
        bodyClassName="p-0 overflow-x-auto"
      >
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th scope="col" className={th}>
                Time (UTC)
              </th>
              <th scope="col" className={th}>
                Actor
              </th>
              <th scope="col" className={th}>
                Action
              </th>
              <th scope="col" className={th}>
                Resource
              </th>
              <th scope="col" className={th}>
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {state.auditLogs.slice(0, 12).map((log) => (
              <tr key={log.id}>
                <td
                  className={cn(
                    td,
                    'font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap'
                  )}
                >
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  <div className="text-slate-900 dark:text-white">
                    {log.actor}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {ROLE_DEFINITIONS[log.role]?.label ?? log.role}
                  </div>
                </td>
                <td
                  className={cn(
                    td,
                    'font-mono text-xs text-blue-700 dark:text-blue-400 whitespace-nowrap'
                  )}
                >
                  {log.action}
                </td>
                <td
                  className={cn(
                    td,
                    'font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap'
                  )}
                >
                  {log.resourceType}:{log.resourceId}
                </td>
                <td className={cn(td, 'text-slate-700 dark:text-slate-300')}>
                  {log.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
