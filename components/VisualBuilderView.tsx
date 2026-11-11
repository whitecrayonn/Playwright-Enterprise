'use client';

import React, {useMemo, useRef, useState} from 'react';
import {
  ActionCategory,
  ActionRegistryEntry,
  BrowserEngine,
  PlatformState,
  RoleType,
  SOPModule,
  TestCase,
  WorkflowStep,
} from '@/lib/types';
import {
  canPerformAction,
  formatPlaywrightLocator,
  generatePlaywrightCode,
  getActionRegistryEntry,
} from '@/lib/action-registry';
import {
  Badge,
  Button,
  EmptyState,
  FactGrid,
  Field,
  Notice,
  Panel,
  Tabs,
  inputClass,
  selectClass,
} from '@/components/ui';
import {cn} from '@/lib/utils';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FolderPlus,
  GripVertical,
  Play,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

interface VisualBuilderViewProps {
  state: PlatformState;
  actionRegistry: ActionRegistryEntry[];
  selectedTestCase: TestCase;
  onSelectTestCase: (tc: TestCase) => void;
  onSaveTestCase: (
    updatedTc: Partial<TestCase>,
    changeSummary: string
  ) => Promise<void>;
  onExecuteTestCase: (
    testCaseId: string,
    browser: BrowserEngine
  ) => Promise<void>;
  currentRole: RoleType;
  isExecuting: boolean;
}

const CATEGORY_LABELS: {id: ActionCategory | 'all' | 'sop'; label: string}[] = [
  {id: 'all', label: 'All Actions'},
  {id: 'navigation', label: 'Navigation'},
  {id: 'interaction', label: 'Interactions'},
  {id: 'assertion', label: 'Assertions'},
  {id: 'synchronization', label: 'Sync & Waits'},
  {id: 'logic', label: 'Logic & Vars'},
  {id: 'advanced', label: 'API & Network'},
  {id: 'sop', label: 'SOP Modules'},
];

const SAMPLE_TARGET_LOCATORS = [
  {
    locator: 'testid=login-email-input',
    description: 'Corporate Email Input (SSO Form)',
  },
  {
    locator: 'testid=login-password-input',
    description: 'SSO Vault Credential Password Input',
  },
  {
    locator: 'testid=login-submit-btn',
    description: 'Authenticate Session Submit Button',
  },
  {
    locator: 'testid=dashboard-welcome-banner',
    description: 'Portal Welcome Header Banner',
  },
  {
    locator: 'testid=approval-toggle-btn',
    description: 'Supervisor Auto-Approval Toggle (aria-pressed)',
  },
  {
    locator: 'testid=mfa-challenge-banner',
    description: 'Security Hardware Key Notice Banner',
  },
  {
    locator: 'testid=acknowledge-banner-btn',
    description: 'Acknowledge MFA Notice Button',
  },
  {
    locator: 'testid=quantity-input',
    description: 'Order Unit Quantity Numeric Input',
  },
  {
    locator: 'testid=expedited-shipping-checkbox',
    description: 'Priority Air Freight Checkbox',
  },
  {
    locator: 'testid=create-order-submit',
    description: 'Submit Requisition Order Button',
  },
  {
    locator: 'testid=order-status-badge',
    description: 'Requisition Status Badge ("Approved & Dispatched")',
  },
  {
    locator: 'testid=latest-order-id',
    description: 'Generated Order Reference Code ("ORD-2026-8841")',
  },
  {
    locator: 'testid=category-filter-select',
    description: 'Inventory Category Filter <select>',
  },
  {
    locator: 'testid=inventory-row',
    description: 'Inventory Catalog Table Row Collection',
  },
];

export default function VisualBuilderView({
  state,
  actionRegistry,
  selectedTestCase,
  onSelectTestCase,
  onSaveTestCase,
  onExecuteTestCase,
  currentRole,
  isExecuting,
}: VisualBuilderViewProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>(selectedTestCase.steps);
  const [title, setTitle] = useState(selectedTestCase.title);
  const [selectedStepId, setSelectedStepId] = useState<string>(
    selectedTestCase.steps[0]?.id || ''
  );
  const [activeCategory, setActiveCategory] = useState<
    ActionCategory | 'all' | 'sop'
  >('all');
  const [librarySearch, setLibrarySearch] = useState('');
  const [rightTab, setRightTab] = useState<'config' | 'code' | 'split'>('split');
  const [selectedBrowser, setSelectedBrowser] =
    useState<BrowserEngine>('chromium');
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [showLocatorPicker, setShowLocatorPicker] = useState(false);
  const [showNewTestModal, setShowNewTestModal] = useState(false);
  const [newTestTitle, setNewTestTitle] = useState('');
  const [newTestPriority, setNewTestPriority] = useState<
    'critical' | 'high' | 'medium' | 'low'
  >('high');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const stepSeqRef = useRef(500);
  const nextStepId = () => {
    stepSeqRef.current += 1;
    return `step-seq-${stepSeqRef.current}`;
  };

  // Sync local workflow editor state when selectedTestCase changes
  const [prevTestId, setPrevTestId] = useState(selectedTestCase.id);
  if (selectedTestCase.id !== prevTestId) {
    setPrevTestId(selectedTestCase.id);
    setSteps(selectedTestCase.steps);
    setTitle(selectedTestCase.title);
    setSelectedStepId(selectedTestCase.steps[0]?.id || '');
  }

  const canEdit = canPerformAction(currentRole, 'canEditTests');
  const canExecute = canPerformAction(currentRole, 'canExecuteTests');

  // Generate Playwright TypeScript code & validation issues live
  const codeGenResult = useMemo(() => {
    return generatePlaywrightCode(
      {
        id: selectedTestCase.id,
        code: selectedTestCase.code,
        title: title || selectedTestCase.title,
        version: selectedTestCase.version,
        tags: selectedTestCase.tags,
        steps,
        dataDrivenRows: selectedTestCase.dataDrivenRows,
      },
      state.sopModules
    );
  }, [selectedTestCase, title, steps, state.sopModules]);

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectedStepId) || steps[0] || null,
    [steps, selectedStepId]
  );

  const selectedActionSchema = useMemo(
    () =>
      selectedStep ? getActionRegistryEntry(selectedStep.actionId) : undefined,
    [selectedStep]
  );

  const filteredActions = useMemo(() => {
    if (activeCategory === 'sop') return [];
    return actionRegistry.filter((entry) => {
      const matchesCat =
        activeCategory === 'all' || entry.category === activeCategory;
      const matchesQuery =
        !librarySearch.trim() ||
        entry.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
        entry.description.toLowerCase().includes(librarySearch.toLowerCase()) ||
        entry.id.toLowerCase().includes(librarySearch.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [actionRegistry, activeCategory, librarySearch]);

  const filteredSopModules = useMemo(() => {
    if (activeCategory !== 'all' && activeCategory !== 'sop') return [];
    return state.sopModules.filter(
      (sop) =>
        !librarySearch.trim() ||
        sop.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
        sop.slug.toLowerCase().includes(librarySearch.toLowerCase())
    );
  }, [state.sopModules, activeCategory, librarySearch]);

  const handleAddActionStep = (entry: ActionRegistryEntry) => {
    if (!canEdit) return;
    const defaultParams: Record<string, string | number | boolean> = {};
    for (const p of entry.parameters) {
      if (p.defaultValue !== undefined) {
        defaultParams[p.name] = p.defaultValue;
      }
    }
    const newStep: WorkflowStep = {
      id: nextStepId(),
      actionId: entry.id,
      label: entry.name,
      enabled: true,
      parameters: defaultParams,
      timeoutMs: 5000,
    };
    const updated = [...steps, newStep];
    setSteps(updated);
    setSelectedStepId(newStep.id);
  };

  const handleAddSopStep = (sop: SOPModule) => {
    if (!canEdit) return;
    const defaultArgs: Record<string, string> = {};
    for (const inp of sop.inputParameters) {
      defaultArgs[inp.name] = inp.defaultValue || '';
    }
    const newStep: WorkflowStep = {
      id: nextStepId(),
      actionId: 'logic.subflow',
      label: `SOP: ${sop.name}`,
      enabled: true,
      sopModuleId: sop.id,
      sopModuleVersion: sop.version,
      parameters: {
        sopSlug: sop.slug,
        sopArgsJson: JSON.stringify(defaultArgs),
      },
    };
    const updated = [...steps, newStep];
    setSteps(updated);
    setSelectedStepId(newStep.id);
  };

  const handleUpdateStep = (
    stepId: string,
    patch: Partial<WorkflowStep>
  ) => {
    if (!canEdit) return;
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? {...s, ...patch} : s))
    );
  };

  const handleUpdateParameter = (
    stepId: string,
    paramName: string,
    value: string | number | boolean
  ) => {
    if (!canEdit) return;
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? {
              ...s,
              parameters: {
                ...s.parameters,
                [paramName]: value,
              },
            }
          : s
      )
    );
  };

  const handleMoveStep = (index: number, direction: -1 | 1) => {
    if (!canEdit) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const next = [...steps];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    setSteps(next);
  };

  const handleDuplicateStep = (index: number) => {
    if (!canEdit) return;
    const src = steps[index];
    const clone: WorkflowStep = {
      ...src,
      id: nextStepId(),
      label: `${src.label} (Copy)`,
      parameters: {...src.parameters},
    };
    const next = [...steps];
    next.splice(index + 1, 0, clone);
    setSteps(next);
    setSelectedStepId(clone.id);
  };

  const handleRemoveStep = (stepId: string) => {
    if (!canEdit || steps.length <= 1) return;
    const next = steps.filter((s) => s.id !== stepId);
    setSteps(next);
    if (selectedStepId === stepId) {
      setSelectedStepId(next[0]?.id || '');
    }
  };

  const handleDropStep = (targetIndex: number) => {
    if (!canEdit || draggedStepIndex === null || draggedStepIndex === targetIndex)
      return;
    const next = [...steps];
    const [moved] = next.splice(draggedStepIndex, 1);
    next.splice(targetIndex, 0, moved);
    setSteps(next);
    setDraggedStepIndex(null);
  };

  const handleSave = async () => {
    if (!canEdit) return;
    await onSaveTestCase(
      {
        ...selectedTestCase,
        title,
        steps,
      },
      `Updated visual workflow (${steps.length} steps)`
    );
    setSaveMessage(`Saved v${selectedTestCase.version + 1} & validated TypeScript spec`);
    setTimeout(() => setSaveMessage(null), 3500);
  };

  const handleCreateNewTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestTitle.trim()) return;
    await onSaveTestCase(
      {
        title: newTestTitle.trim(),
        priority: newTestPriority,
        projectId: selectedTestCase.projectId,
        testPlanId: selectedTestCase.testPlanId,
        testSuiteId: selectedTestCase.testSuiteId,
        steps: [
          {
            id: nextStepId(),
            actionId: 'nav.goto',
            label: 'Navigate to Controlled Sample Portal',
            enabled: true,
            parameters: {
              url: '/sample-app',
              waitUntil: 'domcontentloaded',
            },
          },
          {
            id: nextStepId(),
            actionId: 'assert.visible',
            label: 'Assert Portal Welcome Banner Visible',
            enabled: true,
            parameters: {
              locator: 'testid=dashboard-welcome-banner',
              shouldBeVisible: true,
            },
          },
        ],
      },
      'Created new visual test case'
    );
    setNewTestTitle('');
    setShowNewTestModal(false);
  };

  const handleDownloadSpecFile = () => {
    const blob = new Blob([codeGenResult.code], {
      type: 'text/typescript;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTestCase.code.toLowerCase()}.spec.ts`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const codeLines = useMemo(
    () => codeGenResult.code.split('\n'),
    [codeGenResult.code]
  );

  const selectedStepRange = selectedStep
    ? codeGenResult.stepLineMap[selectedStep.id]
    : undefined;

  const priorityTone =
    selectedTestCase.priority === 'critical'
      ? 'bad'
      : selectedTestCase.priority === 'high'
        ? 'warn'
        : 'neutral';
  const enabledStepCount = steps.filter((s) => s.enabled).length;

  return (
    <div className="space-y-4">
      {/* Test case header: what is open, its state, and the actions on it */}
      <Panel bodyClassName="p-4 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="builder-testcase-select"
              className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
            >
              Test case
            </label>
            <select
              id="builder-testcase-select"
              aria-label="Select Active Test Case"
              value={selectedTestCase.id}
              onChange={(e) => {
                const found = state.testCases.find(
                  (t) => t.id === e.target.value
                );
                if (found) onSelectTestCase(found);
              }}
              className={cn(selectClass, 'w-full max-w-xl font-medium')}
            >
              {state.testCases.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.code} · {tc.title} (v{tc.version})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={FolderPlus}
              disabled={!canEdit}
              onClick={() => setShowNewTestModal(true)}
            >
              New test case
            </Button>
            <a
              href="/sample-app"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md text-blue-700 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              Open target app
            </a>
          </div>
        </div>

        <FactGrid
          columns={4}
          items={[
            {
              label: 'Version · author',
              value: `v${selectedTestCase.version} · ${selectedTestCase.author}`,
            },
            {
              label: 'Priority · environment',
              value: (
                <span className="inline-flex items-center gap-2">
                  <Badge tone={priorityTone}>{selectedTestCase.priority}</Badge>
                  {selectedTestCase.targetEnvironment}
                </span>
              ),
            },
            {
              label: 'Pass rate · flaky score',
              value: `${selectedTestCase.passRate}% · ${selectedTestCase.flakyScore}%`,
              mono: true,
            },
            {
              label: 'Steps',
              value: `${enabledStepCount} enabled of ${steps.length}`,
              mono: true,
            },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {codeGenResult.valid ? (
              <Badge tone="good">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Workflow valid
              </Badge>
            ) : (
              <Badge tone="bad">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                {codeGenResult.issues.length} validation issue
                {codeGenResult.issues.length === 1 ? '' : 's'}
              </Badge>
            )}
            {saveMessage && (
              <span role="status" className="text-blue-700 dark:text-blue-400">
                {saveMessage}
              </span>
            )}
            {!canEdit && (
              <span className="text-slate-500 dark:text-slate-400">
                Read-only for your role.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={Download}
              onClick={handleDownloadSpecFile}
            >
              Export .spec.ts
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={Save}
              disabled={!canEdit}
              onClick={handleSave}
            >
              Save
            </Button>
            <span
              aria-hidden="true"
              className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-800"
            />
            <label htmlFor="builder-browser-select" className="sr-only">
              Execution Browser
            </label>
            <select
              id="builder-browser-select"
              aria-label="Execution Browser"
              value={selectedBrowser}
              onChange={(e) =>
                setSelectedBrowser(e.target.value as BrowserEngine)
              }
              className={cn(selectClass, 'h-7 text-xs font-mono')}
            >
              <option value="chromium">chromium</option>
              <option value="firefox">firefox</option>
              <option value="webkit">webkit</option>
            </select>
            <Button
              size="sm"
              variant="primary"
              icon={Play}
              disabled={!canExecute || isExecuting}
              onClick={async () => {
                if (canEdit) {
                  await onSaveTestCase(
                    {...selectedTestCase, title, steps},
                    'Auto-saved prior to execution'
                  );
                }
                await onExecuteTestCase(selectedTestCase.id, selectedBrowser);
              }}
            >
              {isExecuting ? 'Executing…' : 'Save & run'}
            </Button>
          </div>
        </div>
      </Panel>

      {/* Studio: library | workflow | inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
        {/* LIBRARY */}
        <Panel
          as="div"
          title="Action library"
          description={`${actionRegistry.length} Playwright actions · ${state.sopModules.length} SOP modules`}
          bodyClassName="p-3 space-y-3"
        >
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search Playwright actions or SOP modules"
              placeholder="click, assert, login…"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className={cn(inputClass, 'pl-9')}
            />
          </div>

          <div
            role="group"
            aria-label="Action category"
            className="flex flex-wrap gap-1"
          >
            {CATEGORY_LABELS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                aria-pressed={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'px-2 h-6 text-xs font-medium rounded transition-colors whitespace-nowrap',
                  activeCategory === cat.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="max-h-[600px] overflow-y-auto -mx-3 px-3 space-y-3">
            {filteredSopModules.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  SOP modules
                </div>
                <ul className="space-y-1.5">
                  {filteredSopModules.map((sop) => (
                    <li
                      key={sop.id}
                      className="p-2.5 rounded-md border border-blue-200 dark:border-blue-900/70 bg-blue-50/50 dark:bg-blue-950/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-slate-900 dark:text-white">
                            {sop.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            v{sop.version} · {sop.steps.length} steps ·{' '}
                            {sop.inputParameters.length} inputs
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!canEdit}
                          aria-label={`Insert SOP ${sop.name}`}
                          onClick={() => handleAddSopStep(sop)}
                        >
                          Add
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {filteredActions.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  Actions
                </div>
                <ul className="space-y-1.5">
                  {filteredActions.map((entry) => (
                    <li
                      key={entry.id}
                      className="p-2.5 rounded-md border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-slate-900 dark:text-white">
                            {entry.name}
                          </div>
                          <div
                            className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5"
                            title={entry.description}
                          >
                            {entry.description}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                            {entry.id}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canEdit}
                          aria-label={`Add ${entry.name} step`}
                          onClick={() => handleAddActionStep(entry)}
                        >
                          Add
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {filteredActions.length === 0 &&
              filteredSopModules.length === 0 && (
                <EmptyState>Nothing matches “{librarySearch}”.</EmptyState>
              )}
          </div>
        </Panel>

        {/* WORKFLOW */}
        <Panel
          as="div"
          title="Workflow"
          description={
            canEdit
              ? 'Steps run top to bottom. Select a step to configure it; drag to reorder.'
              : 'Steps run top to bottom. Select a step to inspect it.'
          }
          bodyClassName="p-3 space-y-3"
        >
          <div>
            <label htmlFor="test-case-title-input" className="sr-only">
              Test Case Title
            </label>
            <input
              id="test-case-title-input"
              type="text"
              disabled={!canEdit}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(inputClass, 'font-semibold')}
            />
          </div>

          {codeGenResult.issues.length > 0 && (
            <Notice tone="warn">
              <div className="font-medium flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                {codeGenResult.issues.length} issue
                {codeGenResult.issues.length === 1 ? '' : 's'} to fix before
                this spec is valid
              </div>
              <ul className="mt-1 pl-5 list-disc space-y-0.5">
                {codeGenResult.issues.map((iss, idx) => (
                  <li key={idx}>
                    {iss.stepIndex !== undefined &&
                      `Step ${iss.stepIndex + 1}: `}
                    {iss.message}
                    {iss.severity === 'warning' && ' (warning)'}
                  </li>
                ))}
              </ul>
            </Notice>
          )}

          <ol
            data-testid="visual-workflow-canvas"
            className="space-y-2 max-h-[640px] overflow-y-auto pr-1"
          >
            {steps.map((step, index) => {
              const isSelected = selectedStep?.id === step.id;
              const entry = getActionRegistryEntry(step.actionId);
              const lineRange = codeGenResult.stepLineMap[step.id];
              const stepIssues = codeGenResult.issues.filter(
                (i) => i.stepId === step.id
              );
              const locatorPreview = step.parameters.locator
                ? formatPlaywrightLocator(String(step.parameters.locator))
                : step.parameters.url
                  ? `goto('${step.parameters.url}')`
                  : step.parameters.sopSlug
                    ? `SOP: ${step.parameters.sopSlug}`
                    : step.actionId;

              return (
                <li
                  key={step.id}
                  draggable={canEdit}
                  onDragStart={() => setDraggedStepIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropStep(index)}
                  className={cn(
                    'rounded-md border transition-colors',
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/25'
                      : stepIssues.length > 0
                        ? 'border-amber-300 dark:border-amber-800'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
                    !step.enabled && 'opacity-60'
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedStepId(step.id)}
                    className="w-full text-left flex items-start gap-2.5 p-3"
                  >
                    {canEdit && (
                      <GripVertical
                        className="w-4 h-4 text-slate-400 mt-0.5 shrink-0 cursor-grab"
                        aria-hidden="true"
                      />
                    )}
                    <span className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-mono font-semibold flex items-center justify-center shrink-0 tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {step.label}
                        </span>
                        {!step.enabled && (
                          <Badge tone="neutral">Disabled</Badge>
                        )}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="text-blue-700 dark:text-blue-400">
                          {entry?.category || 'step'}
                        </span>
                        {lineRange && (
                          <span className="font-mono tabular-nums text-slate-400">
                            {' '}
                            · lines {lineRange.startLine}–{lineRange.endLine}
                          </span>
                        )}
                      </span>
                      <code className="block font-mono text-xs text-slate-600 dark:text-slate-400 mt-0.5 break-all">
                        {locatorPreview}
                      </code>
                      {stepIssues.length > 0 && (
                        <span className="block text-xs text-amber-700 dark:text-amber-400 mt-1 font-medium">
                          {stepIssues[0].message}
                        </span>
                      )}
                    </span>
                  </button>

                  {isSelected && canEdit && (
                    <div className="flex flex-wrap items-center gap-1 px-3 pb-2.5 -mt-1 ml-[3.75rem]">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={ArrowUp}
                        disabled={index === 0}
                        aria-label={`Move step ${index + 1} up`}
                        onClick={() => handleMoveStep(index, -1)}
                      >
                        Up
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={ArrowDown}
                        disabled={index === steps.length - 1}
                        aria-label={`Move step ${index + 1} down`}
                        onClick={() => handleMoveStep(index, 1)}
                      >
                        Down
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Copy}
                        aria-label={`Duplicate step ${index + 1}`}
                        onClick={() => handleDuplicateStep(index)}
                      >
                        Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        disabled={steps.length <= 1}
                        aria-label={`Delete step ${index + 1}`}
                        onClick={() => handleRemoveStep(step.id)}
                        className="text-red-700 dark:text-red-400"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </Panel>

        {/* INSPECTOR */}
        <Panel
          as="div"
          className="lg:col-span-2 2xl:col-span-1"
          bodyClassName="p-0"
        >
          <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-2">
            <Tabs<'config' | 'code' | 'split'>
              label="Inspector view"
              value={rightTab}
              onChange={setRightTab}
              items={[
                {
                  id: 'split',
                  label: 'Both',
                },
                {
                  id: 'config',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Configure step
                    </span>
                  ),
                },
                {
                  id: 'code',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Generated code
                    </span>
                  ),
                },
              ]}
            />
            <Button
              size="sm"
              variant="ghost"
              icon={Eye}
              aria-expanded={showLocatorPicker}
              onClick={() => setShowLocatorPicker((prev) => !prev)}
              className="mb-1"
            >
              {showLocatorPicker ? 'Hide locators' : 'Target locators'}
            </Button>
          </div>

          {/* In "Both" mode, when the inspector spans the full row (lg–2xl),
              settings and code sit side by side; otherwise they stack. */}
          <div
            className={cn(
              'p-4 gap-6',
              rightTab === 'split'
                ? 'flex flex-col lg:grid lg:grid-cols-2 2xl:flex'
                : 'flex flex-col'
            )}
          >
            <div className="space-y-4 min-w-0">
            {showLocatorPicker && (
              <div className="rounded-md border border-slate-200 dark:border-slate-800">
                <div className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  Known elements in the target app. Select one to set it as
                  the locator of step {selectedStep ? steps.indexOf(selectedStep) + 1 : '—'}.
                </div>
                <ul className="max-h-44 overflow-y-auto py-1">
                  {SAMPLE_TARGET_LOCATORS.map((item) => (
                    <li key={item.locator}>
                      <button
                        type="button"
                        disabled={!canEdit || !selectedStep}
                        onClick={() => {
                          if (!selectedStep) return;
                          handleUpdateParameter(
                            selectedStep.id,
                            'locator',
                            item.locator
                          );
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:opacity-50"
                      >
                        <code className="block font-mono text-blue-700 dark:text-blue-400 break-all">
                          {item.locator}
                        </code>
                        <span className="text-slate-500 dark:text-slate-400">
                          {item.description}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(rightTab === 'config' || rightTab === 'split') &&
              selectedStep && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Step {steps.indexOf(selectedStep) + 1}:{' '}
                        {selectedActionSchema?.name || selectedStep.actionId}
                      </h3>
                      {selectedActionSchema?.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {selectedActionSchema.description}
                        </p>
                      )}
                    </div>
                    <label className="flex items-center gap-1.5 text-[13px] text-slate-700 dark:text-slate-300 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedStep.enabled}
                        disabled={!canEdit}
                        onChange={(e) =>
                          handleUpdateStep(selectedStep.id, {
                            enabled: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      Enabled
                    </label>
                  </div>

                  <Field
                    label="Description shown in reports"
                    htmlFor="step-label-input"
                  >
                    <input
                      id="step-label-input"
                      type="text"
                      disabled={!canEdit}
                      value={selectedStep.label}
                      onChange={(e) =>
                        handleUpdateStep(selectedStep.id, {
                          label: e.target.value,
                        })
                      }
                      className={inputClass}
                    />
                  </Field>

                  {selectedActionSchema?.parameters.map((param) => {
                    const rawVal =
                      selectedStep.parameters[param.name] ??
                      param.defaultValue ??
                      '';
                    const inputId = `param-${selectedStep.id}-${param.name}`;

                    if (param.type === 'boolean') {
                      return (
                        <label
                          key={param.name}
                          htmlFor={inputId}
                          className="flex items-start gap-2 text-[13px] text-slate-700 dark:text-slate-300"
                        >
                          <input
                            id={inputId}
                            type="checkbox"
                            disabled={!canEdit}
                            checked={Boolean(rawVal)}
                            onChange={(e) =>
                              handleUpdateParameter(
                                selectedStep.id,
                                param.name,
                                e.target.checked
                              )
                            }
                            className="w-4 h-4 mt-0.5 rounded border-slate-300"
                          />
                          <span>
                            <span className="font-medium">{param.label}</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400">
                              {param.description}
                            </span>
                          </span>
                        </label>
                      );
                    }

                    return (
                      <Field
                        key={param.name}
                        label={param.label}
                        htmlFor={inputId}
                        required={param.required}
                        hint={param.description}
                        aside={
                          param.type === 'locator' && rawVal !== '' ? (
                            <code className="text-[11px] font-mono text-slate-400 truncate max-w-[55%]">
                              {formatPlaywrightLocator(String(rawVal))}
                            </code>
                          ) : undefined
                        }
                      >
                        {param.type === 'select' && param.options ? (
                          <select
                            id={inputId}
                            disabled={!canEdit}
                            value={String(rawVal)}
                            onChange={(e) =>
                              handleUpdateParameter(
                                selectedStep.id,
                                param.name,
                                e.target.value
                              )
                            }
                            className={cn(selectClass, 'w-full')}
                          >
                            {param.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={inputId}
                            type={param.type === 'number' ? 'number' : 'text'}
                            disabled={!canEdit}
                            placeholder={param.placeholder}
                            value={String(rawVal)}
                            onChange={(e) =>
                              handleUpdateParameter(
                                selectedStep.id,
                                param.name,
                                param.type === 'number'
                                  ? Number(e.target.value)
                                  : e.target.value
                              )
                            }
                            className={cn(inputClass, 'font-mono')}
                          />
                        )}
                      </Field>
                    );
                  })}

                  {selectedStep.actionId === 'act.fill' &&
                    state.secrets.length > 0 && (
                      <div className="text-xs">
                        <div className="text-slate-500 dark:text-slate-400 mb-1">
                          Use a vault secret as the value (never written to
                          the spec in plain text):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {state.secrets.map((sec) => (
                            <button
                              key={sec.id}
                              type="button"
                              disabled={!canEdit}
                              onClick={() =>
                                handleUpdateParameter(
                                  selectedStep.id,
                                  'value',
                                  `{{SECRET:${sec.key}}}`
                                )
                              }
                              className="px-2 py-0.5 rounded font-mono bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 hover:underline disabled:opacity-50"
                            >
                              {`{{SECRET:${sec.key}}}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>

            {(rightTab === 'code' || rightTab === 'split') && (
              <div
                className={cn(
                  'space-y-2 min-w-0',
                  rightTab === 'split' &&
                    'pt-4 border-t border-slate-100 dark:border-slate-800 lg:pt-0 lg:border-t-0 2xl:pt-4 2xl:border-t'
                )}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {selectedTestCase.code.toLowerCase()}.spec.ts
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {codeLines.length} lines
                    {selectedStepRange &&
                      ` · step highlighted at ${selectedStepRange.startLine}–${selectedStepRange.endLine}`}
                  </span>
                </div>
                <div
                  data-testid="generated-playwright-code"
                  className="rounded-md bg-slate-950 text-slate-100 border border-slate-800 py-2 font-mono text-xs overflow-x-auto max-h-[420px] overflow-y-auto"
                >
                  {codeLines.map((line, idx) => {
                    const lineNum = idx + 1;
                    const isHighlighted =
                      selectedStepRange &&
                      lineNum >= selectedStepRange.startLine &&
                      lineNum <= selectedStepRange.endLine;
                    return (
                      <div
                        key={lineNum}
                        className={cn(
                          'flex items-start gap-3 px-3 leading-5',
                          isHighlighted
                            ? 'bg-blue-900/50 text-blue-50'
                            : 'text-slate-300'
                        )}
                      >
                        <span className="w-6 text-right text-slate-600 select-none tabular-nums shrink-0">
                          {lineNum}
                        </span>
                        <span className="whitespace-pre">{line || ' '}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* New test case dialog */}
      {showNewTestModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-test-modal-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowNewTestModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
            <div>
              <h2
                id="new-test-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-white"
              >
                New test case
              </h2>
              <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                Created in the same project and suite as{' '}
                {selectedTestCase.code}, starting with two steps: open the
                target app and check its welcome banner.
              </p>
            </div>
            <form onSubmit={handleCreateNewTest} className="space-y-4">
              <Field label="Title" htmlFor="new-tc-title" required>
                <input
                  id="new-tc-title"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Verify multi-item procurement approval"
                  value={newTestTitle}
                  onChange={(e) => setNewTestTitle(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Priority" htmlFor="new-tc-priority">
                <select
                  id="new-tc-priority"
                  value={newTestPriority}
                  onChange={(e) =>
                    setNewTestPriority(
                      e.target.value as 'critical' | 'high' | 'medium' | 'low'
                    )
                  }
                  className={cn(selectClass, 'w-full')}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </Field>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowNewTestModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Create and open
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
