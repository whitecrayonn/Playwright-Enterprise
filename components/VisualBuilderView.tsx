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
  Layers,
  Play,
  Plus,
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

  return (
    <div className="space-y-4">
      {/* Builder Top Toolbar */}
      <div className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div>
            <label htmlFor="builder-testcase-select" className="sr-only">
              Select Active Test Case
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
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              {state.testCases.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.code} · {tc.title} (v{tc.version})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setShowNewTestModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New Test Case
          </button>

          <a
            href="/sample-app"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Target App (/sample-app)
          </a>
        </div>

        {/* Validation Status + Save + Execute Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="text-xs flex items-center gap-1.5 mr-2">
            {codeGenResult.valid ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valid Workflow ({steps.length} steps)
              </span>
            ) : (
              <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {codeGenResult.issues.length} Validation Issue(s)
              </span>
            )}
            {saveMessage && (
              <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                · {saveMessage}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleDownloadSpecFile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export .spec.ts
          </button>

          <button
            type="button"
            disabled={!canEdit}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            Save Workflow
          </button>

          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
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
              className="px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            >
              <option value="chromium">chromium</option>
              <option value="firefox">firefox</option>
              <option value="webkit">webkit</option>
            </select>

            <button
              type="button"
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
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              {isExecuting ? 'Executing...' : 'Execute Test'}
            </button>
          </div>
        </div>
      </div>

      {/* Main 3-Pane Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT PANE: Action Registry & SOP Module Palette (3 cols) */}
        <div className="lg:col-span-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Action & SOP Library
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap shrink-0">
              {actionRegistry.length} Actions · {state.sopModules.length} SOPs
            </span>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Search Playwright actions or SOP modules"
              placeholder="Search click, assert, SOP..."
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap gap-1">
            {CATEGORY_LABELS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  activeCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Action Items List */}
          <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
            {filteredSopModules.length > 0 && (
              <div className="pt-1 pb-1">
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1.5 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  Reusable SOP Modules
                </div>
                <div className="space-y-1.5">
                  {filteredSopModules.map((sop) => (
                    <div
                      key={sop.id}
                      className="p-2.5 rounded-md border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {sop.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                          v{sop.version} · {sop.steps.length} steps
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canEdit}
                        aria-label={`Insert SOP ${sop.name}`}
                        onClick={() => handleAddSopStep(sop)}
                        className="px-2 py-1 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 whitespace-nowrap shrink-0"
                      >
                        + Add SOP
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredActions.map((entry) => (
              <div
                key={entry.id}
                className="p-2.5 rounded-md border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/60 dark:bg-slate-950/50 flex items-center justify-between gap-2 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {entry.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    <span className="font-mono">{entry.id}</span> · {entry.category}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canEdit}
                  aria-label={`Add ${entry.name} step`}
                  onClick={() => handleAddActionStep(entry)}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3 h-3 inline mr-0.5" />
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER PANE: Visual Workflow Canvas (5 cols) */}
        <div className="lg:col-span-5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
          {/* Editable Test Case Title & Metadata */}
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                <strong className="font-mono text-slate-800 dark:text-slate-200">
                  {selectedTestCase.code}
                </strong>{' '}
                · v{selectedTestCase.version} · {selectedTestCase.author}
              </span>
              <span className="font-mono tabular-nums whitespace-nowrap shrink-0">
                Pass Rate: {selectedTestCase.passRate}%
              </span>
            </div>
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
                className="w-full px-3 py-1.5 text-sm font-bold rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Validation Banner if errors/warnings exist */}
          {codeGenResult.issues.length > 0 && (
            <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 space-y-1">
              <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Workflow Diagnostics ({codeGenResult.issues.length})
              </div>
              <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-0.5 pl-5 list-disc">
                {codeGenResult.issues.map((iss, idx) => (
                  <li key={idx}>
                    [{iss.severity.toUpperCase()}] {iss.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Drag-and-Drop Visual Workflow Step Nodes */}
          <div
            data-testid="visual-workflow-canvas"
            className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1"
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
                <div
                  key={step.id}
                  draggable={canEdit}
                  onDragStart={() => setDraggedStepIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropStep(index)}
                  onClick={() => setSelectedStepId(step.id)}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                  } ${!step.enabled ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-400 mt-0.5 shrink-0 cursor-grab" />
                      <span className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono font-bold flex items-center justify-center shrink-0 tabular-nums">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {step.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-blue-600 dark:text-blue-400">
                            {entry?.category || 'step'}
                          </span>
                          <span>·</span>
                          <code className="font-mono truncate max-w-[220px]">
                            {locatorPreview}
                          </code>
                          {lineRange && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-slate-400 tabular-nums">
                                L{lineRange.startLine}–{lineRange.endLine}
                              </span>
                            </>
                          )}
                        </div>
                        {stepIssues.length > 0 && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                            {stepIssues[0].message}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step Node Action Buttons */}
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={!canEdit || index === 0}
                        aria-label={`Move step ${index + 1} up`}
                        onClick={() => handleMoveStep(index, -1)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!canEdit || index === steps.length - 1}
                        aria-label={`Move step ${index + 1} down`}
                        onClick={() => handleMoveStep(index, 1)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!canEdit}
                        aria-label={`Duplicate step ${index + 1}`}
                        onClick={() => handleDuplicateStep(index)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!canEdit || steps.length <= 1}
                        aria-label={`Delete step ${index + 1}`}
                        onClick={() => handleRemoveStep(step.id)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANE: Step Configuration Form + Live Generated Playwright Code (4 cols) */}
        <div className="lg:col-span-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
          {/* Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
              <button
                type="button"
                onClick={() => setRightTab('split')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  rightTab === 'split'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Split
              </button>
              <button
                type="button"
                onClick={() => setRightTab('config')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  rightTab === 'config'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Settings2 className="w-3 h-3 inline mr-1" />
                Config
              </button>
              <button
                type="button"
                onClick={() => setRightTab('code')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  rightTab === 'code'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Code2 className="w-3 h-3 inline mr-1" />
                Code
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowLocatorPicker((prev) => !prev)}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              {showLocatorPicker ? 'Hide Locators' : 'Target Locators'}
            </button>
          </div>

          {/* Optional Target App Locator Assistant Drawer */}
          {showLocatorPicker && (
            <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Click a Controlled Target App Locator to Bind to Current Step:
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {SAMPLE_TARGET_LOCATORS.map((item) => (
                  <button
                    key={item.locator}
                    type="button"
                    onClick={() => {
                      if (!selectedStep) return;
                      handleUpdateParameter(
                        selectedStep.id,
                        'locator',
                        item.locator
                      );
                    }}
                    className="w-full text-left px-2 py-1 rounded text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center justify-between gap-2"
                  >
                    <code className="font-mono text-blue-600 dark:text-blue-400">
                      {item.locator}
                    </code>
                    <span className="text-slate-500 dark:text-slate-400 truncate">
                      {item.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP CONFIGURATION FORM */}
          {(rightTab === 'config' || rightTab === 'split') && selectedStep && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Step Configuration · {selectedActionSchema?.name || selectedStep.actionId}
                </h3>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStep.enabled}
                    onChange={(e) =>
                      handleUpdateStep(selectedStep.id, {
                        enabled: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300"
                  />
                  Step Enabled
                </label>
              </div>

              <div>
                <label
                  htmlFor="step-label-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Human-Readable Step Description
                </label>
                <input
                  id="step-label-input"
                  type="text"
                  disabled={!canEdit}
                  value={selectedStep.label}
                  onChange={(e) =>
                    handleUpdateStep(selectedStep.id, {label: e.target.value})
                  }
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              {/* Schema-Driven Parameters */}
              {selectedActionSchema?.parameters.map((param) => {
                const rawVal = selectedStep.parameters[param.name] ?? param.defaultValue ?? '';
                const inputId = `param-${selectedStep.id}-${param.name}`;

                return (
                  <div key={param.name}>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor={inputId}
                        className="text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        {param.label}{' '}
                        {param.required && (
                          <span className="text-red-500">*</span>
                        )}
                      </label>
                      {param.type === 'locator' && (
                        <span className="text-xs font-mono text-slate-400">
                          {formatPlaywrightLocator(String(rawVal))}
                        </span>
                      )}
                    </div>

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
                        className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                      >
                        {param.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : param.type === 'boolean' ? (
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
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
                          className="rounded border-slate-300"
                        />
                        <span>{param.description}</span>
                      </label>
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
                        className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                      />
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {param.description}
                    </p>
                  </div>
                );
              })}

              {/* Quick Vault Secret Insertion Helper */}
              {selectedStep.actionId === 'act.fill' && (
                <div className="pt-1 flex items-center gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Insert Encrypted Secret:
                  </span>
                  {state.secrets.map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() =>
                        handleUpdateParameter(
                          selectedStep.id,
                          'value',
                          `{{SECRET:${sec.key}}}`
                        )
                      }
                      className="px-2 py-0.5 rounded font-mono bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {`{{SECRET:${sec.key}}}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GENERATED PLAYWRIGHT TYPESCRIPT CODE PREVIEW */}
          {(rightTab === 'code' || rightTab === 'split') && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Generated Playwright TypeScript
                </div>
                <span className="text-xs font-mono text-slate-400 whitespace-nowrap shrink-0">
                  {selectedTestCase.code.toLowerCase()}.spec.ts
                </span>
              </div>

              <div
                data-testid="generated-playwright-code"
                className="rounded-md bg-slate-950 text-slate-100 border border-slate-800 p-3 font-mono text-xs overflow-x-auto max-h-[320px] overflow-y-auto"
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
                      className={`flex items-start gap-3 px-1.5 py-0.5 rounded ${
                        isHighlighted
                          ? 'bg-blue-900/50 text-blue-100'
                          : 'text-slate-300'
                      }`}
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
      </div>

      {/* Create New Test Case Modal */}
      {showNewTestModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-test-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2
              id="new-test-modal-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Create Visual Playwright Test Case
            </h2>
            <form onSubmit={handleCreateNewTest} className="space-y-4">
              <div>
                <label
                  htmlFor="new-tc-title"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Test Case Title *
                </label>
                <input
                  id="new-tc-title"
                  type="text"
                  required
                  placeholder="e.g. Verify Multi-Item Procurement Approval"
                  value={newTestTitle}
                  onChange={(e) => setNewTestTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="new-tc-priority"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Priority
                </label>
                <select
                  id="new-tc-priority"
                  value={newTestPriority}
                  onChange={(e) =>
                    setNewTestPriority(
                      e.target.value as 'critical' | 'high' | 'medium' | 'low'
                    )
                  }
                  className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTestModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-500"
                >
                  Create & Open in Builder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
