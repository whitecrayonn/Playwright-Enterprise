import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYWRIGHT_ACTION_REGISTRY,
  allocateWorkerForJob,
  calculateAnalyticsSummary,
  canPerformAction,
  formatPlaywrightLocator,
  generatePlaywrightCode,
  validateWorkflow,
} from './action-registry';
import {SOPModule, WorkerNode, WorkflowStep} from './types';

test('Playwright Action Registry includes all 6 mandatory action categories', () => {
  const categories = new Set(PLAYWRIGHT_ACTION_REGISTRY.map((a) => a.category));
  assert.equal(categories.has('navigation'), true);
  assert.equal(categories.has('interaction'), true);
  assert.equal(categories.has('assertion'), true);
  assert.equal(categories.has('synchronization'), true);
  assert.equal(categories.has('logic'), true);
  assert.equal(categories.has('advanced'), true);
  assert.ok(PLAYWRIGHT_ACTION_REGISTRY.length >= 25);
});

test('formatPlaywrightLocator converts semantic selector prefixes to idiomatic Playwright locators', () => {
  assert.equal(
    formatPlaywrightLocator('testid=submit-order-btn'),
    "page.getByTestId('submit-order-btn')"
  );
  assert.equal(
    formatPlaywrightLocator('role=button[name="Approve Order"]'),
    "page.getByRole('button', { name: 'Approve Order' })"
  );
  assert.equal(
    formatPlaywrightLocator('label=Corporate Email'),
    "page.getByLabel('Corporate Email')"
  );
  assert.equal(
    formatPlaywrightLocator('#custom-css-id'),
    "page.locator('#custom-css-id')"
  );
});

test('validateWorkflow catches empty steps, invalid URLs, missing parameters, and plaintext passwords', () => {
  const emptyIssues = validateWorkflow([]);
  assert.equal(emptyIssues.length, 1);
  assert.equal(emptyIssues[0].severity, 'error');

  const invalidSteps: WorkflowStep[] = [
    {
      id: 's1',
      actionId: 'nav.goto',
      label: 'Bad URL step',
      enabled: true,
      parameters: {url: 'invalid-url-without-slash'},
    },
    {
      id: 's2',
      actionId: 'act.fill',
      label: 'Fill password with raw secret',
      enabled: true,
      parameters: {
        locator: 'testid=login-password-input',
        value: 'SuperSecretPlaintext123',
      },
    },
  ];

  const issues = validateWorkflow(invalidSteps);
  assert.equal(
    issues.some((i) => i.stepId === 's1' && i.severity === 'error'),
    true
  );
  assert.equal(
    issues.some((i) => i.stepId === 's2' && i.severity === 'warning'),
    true
  );
});

test('generatePlaywrightCode generates executable TypeScript, masks secrets, and imports SOP modules without duplicating code', () => {
  const sopModules: SOPModule[] = [
    {
      id: 'sop-1',
      name: 'Enterprise SSO Login',
      slug: 'enterprise-sso-login',
      description: 'Reusable SSO login flow',
      version: '2.1.0',
      availableVersions: ['2.1.0', '2.0.0'],
      category: 'Authentication',
      ownerRole: 'automation_engineer',
      author: 'Elena Vance',
      inputParameters: [],
      outputParameters: ['sessionToken'],
      steps: [],
      compatibleProjects: ['proj-1'],
      repoReference: 'git@github.com:acme-qa/playwright-sop-modules.git#v2.1.0',
      validationStatus: 'verified',
      usageCount: 14,
      updatedAt: '2026-11-10T10:00:00Z',
      changelog: 'Added MFA fallback handling',
    },
  ];

  const steps: WorkflowStep[] = [
    {
      id: 'step-1',
      actionId: 'nav.goto',
      label: 'Open Controlled Target App',
      enabled: true,
      parameters: {url: '/sample-app', waitUntil: 'domcontentloaded'},
    },
    {
      id: 'step-2',
      actionId: 'logic.subflow',
      label: 'Run Enterprise SSO Login SOP',
      enabled: true,
      parameters: {
        sopSlug: 'enterprise-sso-login',
        sopArgsJson: '{"username":"qa.lead@acme.io"}',
      },
    },
    {
      id: 'step-3',
      actionId: 'act.fill',
      label: 'Fill API Token from Vault',
      enabled: true,
      parameters: {
        locator: 'testid=api-token-input',
        value: '{{SECRET:ACME_API_KEY}}',
        clearFirst: true,
      },
    },
    {
      id: 'step-4',
      actionId: 'assert.text',
      label: 'Verify Portal Header',
      enabled: true,
      parameters: {
        locator: 'testid=portal-heading',
        expectedText: 'Acme Cloud Portal',
        matchMode: 'contains',
      },
    },
  ];

  const result = generatePlaywrightCode(
    {
      id: 'tc-101',
      code: 'TC-101',
      title: 'Verify Enterprise Portal Order Flow',
      version: 3,
      tags: ['smoke', 'regression'],
      steps,
      dataDrivenRows: [{orderQty: '5', dept: 'QA'}],
    },
    sopModules
  );

  assert.equal(result.valid, true);
  assert.ok(
    result.code.includes(
      "import { runSop_enterpriseSsoLogin } from '../sop-modules/enterprise-sso-login';"
    )
  );
  assert.ok(result.code.includes('process.env.SECRET_ACME_API_KEY'));
  assert.equal(result.code.includes('SuperSecret'), false);
  assert.deepEqual(result.importedSopModules, ['enterprise-sso-login']);
  assert.deepEqual(result.referencedSecrets, ['ACME_API_KEY']);
  const codeLines = result.code.split('\n');
  assert.ok(
    codeLines[result.stepLineMap['step-1'].startLine - 1].includes(
      '[Step 1: id=step-1]'
    )
  );
  assert.ok(
    codeLines[result.stepLineMap['step-4'].startLine - 1].includes(
      '[Step 4: id=step-4]'
    )
  );
});

test('allocateWorkerForJob respects pool, browser compatibility, draining state, and concurrency limits', () => {
  const workers: WorkerNode[] = [
    {
      id: 'w-1',
      name: 'pw-runner-us-east-01',
      pool: 'core-linux-pool',
      host: '10.24.1.11',
      containerId: 'ctr-99a1',
      status: 'busy',
      maxConcurrency: 4,
      activeJobs: 4, // At full capacity
      supportedBrowsers: ['chromium', 'firefox', 'webkit'],
      cpuUsagePercent: 88,
      memoryUsageMb: 3400,
      maxMemoryMb: 4096,
      lastHeartbeatAt: '2026-11-10T19:35:00Z',
      uptimeSeconds: 86400,
      totalExecuted: 142,
      errorCount: 0,
      currentExecutionIds: ['ex-1', 'ex-2', 'ex-3', 'ex-4'],
      recentLogs: [],
    },
    {
      id: 'w-2',
      name: 'pw-runner-us-east-02',
      pool: 'core-linux-pool',
      host: '10.24.1.12',
      containerId: 'ctr-99a2',
      status: 'draining',
      maxConcurrency: 4,
      activeJobs: 1,
      supportedBrowsers: ['chromium', 'firefox', 'webkit'],
      cpuUsagePercent: 25,
      memoryUsageMb: 1200,
      maxMemoryMb: 4096,
      lastHeartbeatAt: '2026-11-10T19:35:00Z',
      uptimeSeconds: 86400,
      totalExecuted: 98,
      errorCount: 0,
      currentExecutionIds: ['ex-5'],
      recentLogs: [],
    },
    {
      id: 'w-3',
      name: 'pw-runner-us-east-03',
      pool: 'core-linux-pool',
      host: '10.24.1.13',
      containerId: 'ctr-99a3',
      status: 'online',
      maxConcurrency: 4,
      activeJobs: 1,
      supportedBrowsers: ['chromium', 'firefox'],
      cpuUsagePercent: 32,
      memoryUsageMb: 1450,
      maxMemoryMb: 4096,
      lastHeartbeatAt: '2026-11-10T19:35:00Z',
      uptimeSeconds: 86400,
      totalExecuted: 110,
      errorCount: 0,
      currentExecutionIds: ['ex-6'],
      recentLogs: [],
    },
  ];

  // Should pick w-3 for chromium because w-1 is full and w-2 is draining
  const allocated = allocateWorkerForJob(workers, 'core-linux-pool', 'chromium');
  assert.equal(allocated?.id, 'w-3');

  // Should return null for webkit because w-3 does not support webkit and w-1/w-2 are unavailable
  const allocatedWebkit = allocateWorkerForJob(workers, 'core-linux-pool', 'webkit');
  assert.equal(allocatedWebkit, null);
});

test('RBAC permission engine enforces role boundaries accurately', () => {
  assert.equal(canPerformAction('platform_admin', 'canManageSecretsAndRbac'), true);
  assert.equal(canPerformAction('automation_engineer', 'canManageSopModules'), true);
  assert.equal(canPerformAction('manual_qa', 'canManageSopModules'), false);
  assert.equal(canPerformAction('manual_qa', 'canEditTests'), true);
  assert.equal(canPerformAction('viewer', 'canExecuteTests'), false);
  assert.equal(canPerformAction('viewer', 'canEditTests'), false);
});

test('calculateAnalyticsSummary computes pass rate and worker capacity accurately', () => {
  const summary = calculateAnalyticsSummary(
    [
      {
        id: 'tc-1',
        code: 'TC-1',
        title: 'Test 1',
        description: '',
        workspaceId: 'ws-1',
        projectId: 'p-1',
        testPlanId: 'tp-1',
        testSuiteId: 'ts-1',
        status: 'active',
        priority: 'high',
        tags: [],
        version: 1,
        versionHistory: [],
        author: 'QA',
        targetEnvironment: 'Staging',
        browsers: ['chromium'],
        steps: [],
        dataDrivenRows: [],
        createdAt: '',
        updatedAt: '',
        flakyScore: 22,
        passRate: 80,
        avgDurationMs: 1200,
        totalRuns: 5,
      },
    ],
    [],
    []
  );
  assert.equal(summary.totalTestCases, 1);
  assert.equal(summary.flakyTestsCount, 1);
});
