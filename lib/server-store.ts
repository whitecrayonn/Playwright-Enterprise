import fs from 'node:fs';
import path from 'node:path';
import {
  AuditLogEntry,
  BrowserEngine,
  ExecutionRun,
  IssueTicket,
  NotificationDispatchRecord,
  PlatformState,
  Project,
  RoleType,
  SOPModule,
  StepExecutionResult,
  TestCase,
  WorkerNode,
  WorkflowStep,
} from './types';
import {
  allocateWorkerForJob,
  canPerformAction,
  formatPlaywrightLocator,
  generatePlaywrightCode,
  getActionRegistryEntry,
} from './action-registry';

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'platform-state.json');

// Controlled Sample Target Application Default State (mirrors /sample-app)
interface TargetAppVirtualDomState {
  currentUrl: string;
  title: string;
  authenticatedUser: string | null;
  userRole: string;
  mfaBannerVisible: boolean;
  searchQuery: string;
  selectedCategory: string;
  expeditedShipping: boolean;
  approvalPressed: boolean;
  orderStatusText: string;
  latestOrderId: string;
  inventoryRows: {id: string; sku: string; name: string; category: string; stock: number}[];
  inputValues: Record<string, string>;
}

function createInitialTargetAppState(): TargetAppVirtualDomState {
  return {
    currentUrl: '/sample-app',
    title: 'Acme Cloud Portal — Controlled QA Target App',
    authenticatedUser: 'qa.lead@acme.io',
    userRole: 'Supervisor',
    mfaBannerVisible: true,
    searchQuery: '',
    selectedCategory: 'All',
    expeditedShipping: false,
    approvalPressed: true,
    orderStatusText: 'Approved & Dispatched',
    latestOrderId: 'ORD-2026-8841',
    inventoryRows: [
      {id: '1', sku: 'ACM-901', name: 'Quantum Edge Gateway', category: 'Hardware', stock: 42},
      {id: '2', sku: 'ACM-902', name: 'Zero-Trust Firewall Appliance', category: 'Security', stock: 18},
      {id: '3', sku: 'ACM-903', name: 'Telemetry Rack Sensor', category: 'Hardware', stock: 64},
      {id: '4', sku: 'ACM-904', name: 'Enterprise SSO Bridge', category: 'Software', stock: 999},
    ],
    inputValues: {
      'testid=login-email-input': 'qa.lead@acme.io',
      'testid=quantity-input': '5',
      'testid=inventory-search-input': '',
    },
  };
}

function createSeedState(): PlatformState {
  const sopModules: SOPModule[] = [
    {
      id: 'sop-sso-login',
      name: 'Enterprise SSO Login & Session Bootstrap',
      slug: 'enterprise-sso-login',
      description:
        'Executes standardized corporate login against Acme Cloud Portal, handles optional MFA banner acknowledgement, and verifies session readiness.',
      version: '2.4.0',
      availableVersions: ['2.4.0', '2.3.1', '2.0.0'],
      category: 'Authentication',
      ownerRole: 'automation_engineer',
      author: 'Elena Vance (Staff SDET)',
      inputParameters: [
        {
          name: 'username',
          label: 'Corporate Email',
          type: 'string',
          required: true,
          defaultValue: 'qa.lead@acme.io',
          description: 'Target user account email.',
        },
        {
          name: 'role',
          label: 'Expected Role',
          type: 'string',
          required: false,
          defaultValue: 'Supervisor',
          description: 'RBAC role displayed in the portal header.',
        },
      ],
      outputParameters: ['authenticatedSessionId'],
      steps: [
        {
          id: 'sop-step-1',
          actionId: 'act.fill',
          label: 'Enter Corporate Email',
          enabled: true,
          parameters: {
            locator: 'testid=login-email-input',
            value: 'qa.lead@acme.io',
            clearFirst: true,
          },
        },
        {
          id: 'sop-step-2',
          actionId: 'act.fill',
          label: 'Enter Encrypted Vault Password',
          enabled: true,
          parameters: {
            locator: 'testid=login-password-input',
            value: '{{SECRET:ACME_SSO_PASSWORD}}',
            clearFirst: true,
          },
        },
        {
          id: 'sop-step-3',
          actionId: 'act.click',
          label: 'Click Sign In Button',
          enabled: true,
          parameters: {
            locator: 'testid=login-submit-btn',
            clickType: 'single',
          },
        },
      ],
      compatibleProjects: ['proj-acme-cloud', 'proj-finledger'],
      repoReference: 'git@github.com:acme-org/playwright-sop-library.git#v2.4.0',
      validationStatus: 'verified',
      usageCount: 38,
      updatedAt: '2026-11-09T14:20:00Z',
      changelog: 'v2.4.0: Migrated to semantic getByTestId locators and secret vault references.',
    },
    {
      id: 'sop-order-approval',
      name: 'Procurement Order Creation & Supervisor Approval',
      slug: 'procurement-order-approval',
      description:
        'Selects hardware inventory, sets order quantity, enables expedited shipping, and triggers supervisor approval assertion.',
      version: '1.8.0',
      availableVersions: ['1.8.0', '1.7.0'],
      category: 'Business Workflow',
      ownerRole: 'automation_engineer',
      author: 'Marcus Chen (Lead QA Architect)',
      inputParameters: [
        {
          name: 'quantity',
          label: 'Order Quantity',
          type: 'number',
          required: true,
          defaultValue: '5',
          description: 'Units to request.',
        },
      ],
      outputParameters: ['capturedOrderCode'],
      steps: [
        {
          id: 'sop-ord-1',
          actionId: 'act.fill',
          label: 'Set Order Quantity',
          enabled: true,
          parameters: {
            locator: 'testid=quantity-input',
            value: '5',
            clearFirst: true,
          },
        },
        {
          id: 'sop-ord-2',
          actionId: 'act.check',
          label: 'Enable Expedited Shipping',
          enabled: true,
          parameters: {
            locator: 'testid=expedited-shipping-checkbox',
            checked: true,
          },
        },
        {
          id: 'sop-ord-3',
          actionId: 'act.click',
          label: 'Submit Order Approval',
          enabled: true,
          parameters: {
            locator: 'testid=create-order-submit',
            clickType: 'single',
          },
        },
      ],
      compatibleProjects: ['proj-acme-cloud'],
      repoReference: 'git@github.com:acme-org/playwright-sop-library.git#v1.8.0',
      validationStatus: 'verified',
      usageCount: 24,
      updatedAt: '2026-11-08T09:15:00Z',
      changelog: 'v1.8.0: Added explicit auto-wait before order confirmation toast check.',
    },
    {
      id: 'sop-table-audit',
      name: 'Inventory Grid Filter & Row Count Verification',
      slug: 'inventory-grid-audit',
      description:
        'Filters a data grid by category dropdown and validates matching row counts and cell values.',
      version: '1.3.2',
      availableVersions: ['1.3.2', '1.2.0'],
      category: 'Table Validation',
      ownerRole: 'automation_engineer',
      author: 'Priya Nair (Senior SDET)',
      inputParameters: [
        {
          name: 'category',
          label: 'Filter Category',
          type: 'string',
          required: true,
          defaultValue: 'Hardware',
          description: 'Category option to select.',
        },
      ],
      outputParameters: ['rowCount'],
      steps: [
        {
          id: 'sop-tbl-1',
          actionId: 'act.selectOption',
          label: 'Select Category Filter',
          enabled: true,
          parameters: {
            locator: 'testid=category-filter-select',
            optionValue: 'Hardware',
          },
        },
      ],
      compatibleProjects: ['proj-acme-cloud', 'proj-finledger', 'proj-medvault'],
      repoReference: 'git@github.com:acme-org/playwright-sop-library.git#v1.3.2',
      validationStatus: 'verified',
      usageCount: 51,
      updatedAt: '2026-11-07T18:00:00Z',
      changelog: 'v1.3.2: Added support for virtualized table rows.',
    },
  ];

  const tc1Steps: WorkflowStep[] = [
    {
      id: 'step-101',
      actionId: 'nav.goto',
      label: 'Navigate to Controlled Sample Portal',
      enabled: true,
      parameters: {
        url: '/sample-app',
        waitUntil: 'domcontentloaded',
      },
      timeoutMs: 10000,
    },
    {
      id: 'step-102',
      actionId: 'nav.viewport',
      label: 'Configure Desktop 1440x900 Viewport',
      enabled: true,
      parameters: {
        width: 1440,
        height: 900,
      },
    },
    {
      id: 'step-103',
      actionId: 'logic.subflow',
      label: 'Execute SOP: Enterprise SSO Login',
      enabled: true,
      sopModuleId: 'sop-sso-login',
      sopModuleVersion: '2.4.0',
      parameters: {
        sopSlug: 'enterprise-sso-login',
        sopArgsJson: '{"username":"qa.lead@acme.io","role":"Supervisor"}',
      },
    },
    {
      id: 'step-104',
      actionId: 'assert.visible',
      label: 'Verify Welcome Banner Is Visible',
      enabled: true,
      parameters: {
        locator: 'testid=dashboard-welcome-banner',
        shouldBeVisible: true,
      },
    },
    {
      id: 'step-105',
      actionId: 'act.fill',
      label: 'Set Order Quantity to 5 Units',
      enabled: true,
      parameters: {
        locator: 'testid=quantity-input',
        value: '5',
        clearFirst: true,
      },
    },
    {
      id: 'step-106',
      actionId: 'act.check',
      label: 'Check Expedited Shipping Option',
      enabled: true,
      parameters: {
        locator: 'testid=expedited-shipping-checkbox',
        checked: true,
      },
    },
    {
      id: 'step-107',
      actionId: 'act.click',
      label: 'Click Submit Order Button',
      enabled: true,
      parameters: {
        locator: 'testid=create-order-submit',
        clickType: 'single',
      },
    },
    {
      id: 'step-108',
      actionId: 'assert.text',
      label: 'Assert Order Status Badge Reads Approved & Dispatched',
      enabled: true,
      parameters: {
        locator: 'testid=order-status-badge',
        expectedText: 'Approved & Dispatched',
        matchMode: 'contains',
      },
    },
    {
      id: 'step-109',
      actionId: 'logic.setVariable',
      label: 'Capture Generated Order ID into Variable',
      enabled: true,
      variableOutput: 'capturedOrderCode',
      parameters: {
        variableName: 'capturedOrderCode',
        sourceType: 'locatorText',
        sourceValue: 'testid=latest-order-id',
      },
    },
    {
      id: 'step-110',
      actionId: 'adv.captureScreenshot',
      label: 'Capture Order Confirmation Evidence Screenshot',
      enabled: true,
      parameters: {
        artifactName: 'order-approved-confirmation.png',
        fullPage: true,
      },
    },
  ];

  const tc2Steps: WorkflowStep[] = [
    {
      id: 'step-201',
      actionId: 'nav.goto',
      label: 'Open Controlled Sample Portal',
      enabled: true,
      parameters: {
        url: '/sample-app',
        waitUntil: 'domcontentloaded',
      },
    },
    {
      id: 'step-202',
      actionId: 'assert.count',
      label: 'Verify Default Inventory Table Shows 4 Items',
      enabled: true,
      parameters: {
        locator: 'testid=inventory-row',
        expectedCount: 4,
      },
    },
    {
      id: 'step-203',
      actionId: 'act.selectOption',
      label: 'Filter Inventory by Hardware Category',
      enabled: true,
      parameters: {
        locator: 'testid=category-filter-select',
        optionValue: 'Hardware',
      },
    },
    {
      id: 'step-204',
      actionId: 'assert.count',
      label: 'Assert Filtered Hardware Row Count Equals 2',
      enabled: true,
      parameters: {
        locator: 'testid=inventory-row',
        expectedCount: 2,
      },
    },
    {
      id: 'step-205',
      actionId: 'assert.attribute',
      label: 'Verify Supervisor Approval Toggle Is Active',
      enabled: true,
      parameters: {
        locator: 'testid=approval-toggle-btn',
        attributeName: 'aria-pressed',
        expectedValue: 'true',
      },
    },
  ];

  const tc3Steps: WorkflowStep[] = [
    {
      id: 'step-301',
      actionId: 'nav.goto',
      label: 'Open Controlled Sample Portal',
      enabled: true,
      parameters: {
        url: '/sample-app',
        waitUntil: 'domcontentloaded',
      },
    },
    {
      id: 'step-302',
      actionId: 'adv.apiRequest',
      label: 'Verify Platform Health API Status 200',
      enabled: true,
      parameters: {
        method: 'GET',
        endpoint: '/api/platform',
        expectedStatus: 200,
      },
    },
    {
      id: 'step-303',
      actionId: 'logic.ifBranch',
      label: 'Dismiss Optional MFA Security Banner If Present',
      enabled: true,
      parameters: {
        conditionLocator: 'testid=mfa-challenge-banner',
        thenActionLocator: 'testid=acknowledge-banner-btn',
      },
    },
    {
      id: 'step-304',
      actionId: 'assert.url',
      label: 'Verify URL Remains on Controlled Sample App',
      enabled: true,
      parameters: {
        targetProperty: 'url',
        expectedPattern: '/sample-app',
      },
    },
  ];

  const tc4FlakySteps: WorkflowStep[] = [
    {
      id: 'step-401',
      actionId: 'nav.goto',
      label: 'Navigate to FinLedger Settlement Portal',
      enabled: true,
      parameters: {
        url: '/sample-app',
        waitUntil: 'domcontentloaded',
      },
    },
    {
      id: 'step-402',
      actionId: 'sync.waitForResponse',
      label: 'Wait for Settlement Batch Webhook Response',
      enabled: true,
      parameters: {
        urlSubstring: '/api/platform',
        expectedStatus: 200,
      },
    },
    {
      id: 'step-403',
      actionId: 'assert.text',
      label: 'Verify Settlement Batch Reconciled Status',
      enabled: true,
      parameters: {
        locator: 'testid=order-status-badge',
        expectedText: 'Batch Settlement Completed #99',
        matchMode: 'exact',
      },
    },
  ];

  const projects: Project[] = [
    {
      id: 'proj-acme-cloud',
      workspaceId: 'ws-enterprise-01',
      key: 'ACME',
      name: 'Acme Cloud Commerce',
      description: 'Enterprise B2B procurement portal, order workflows, and inventory management.',
      defaultEnvironment: 'Staging (Controlled Target)',
      concurrencyLimit: 8,
      workerPool: 'core-linux-pool',
      artifactRetentionDays: 30,
      createdAt: '2026-09-01T08:00:00Z',
      environments: [
        {
          id: 'env-staging',
          name: 'Staging (Controlled Target)',
          slug: 'staging',
          baseUrl: 'http://localhost:3000',
          variables: {
            PORTAL_PATH: '/sample-app',
            DEFAULT_LOCALE: 'en-US',
          },
          defaultRetries: 1,
          timeoutMs: 30000,
        },
        {
          id: 'env-prod-canary',
          name: 'Production Canary',
          slug: 'prod-canary',
          baseUrl: 'https://canary.acme-commerce.internal',
          variables: {
            PORTAL_PATH: '/sample-app',
            DEFAULT_LOCALE: 'en-US',
          },
          defaultRetries: 2,
          timeoutMs: 45000,
        },
      ],
    },
    {
      id: 'proj-finledger',
      workspaceId: 'ws-enterprise-01',
      key: 'FINL',
      name: 'FinLedger Core Banking',
      description: 'Real-time wire settlement, treasury approvals, and compliance reconciliation.',
      defaultEnvironment: 'QA Sandbox',
      concurrencyLimit: 6,
      workerPool: 'high-mem-pool',
      artifactRetentionDays: 90,
      createdAt: '2026-09-15T10:00:00Z',
      environments: [
        {
          id: 'env-fin-qa',
          name: 'QA Sandbox',
          slug: 'qa-sandbox',
          baseUrl: 'http://localhost:3000',
          variables: {LEDGER_MODE: 'STRICT'},
          defaultRetries: 2,
          timeoutMs: 60000,
        },
      ],
    },
  ];

  const testCases: TestCase[] = [
    {
      id: 'tc-101',
      code: 'ACME-TC-101',
      title: 'E2E Procurement Order Creation & Supervisor Approval',
      description:
        'Validates complete SSO login via SOP module, order quantity entry, expedited shipping toggle, approval assertion, and order ID extraction against /sample-app.',
      workspaceId: 'ws-enterprise-01',
      projectId: 'proj-acme-cloud',
      testPlanId: 'tp-release-2026-4',
      testSuiteId: 'ts-checkout-e2e',
      status: 'active',
      priority: 'critical',
      tags: ['smoke', 'e2e', 'procurement'],
      version: 4,
      versionHistory: [
        {
          version: 4,
          updatedAt: '2026-11-10T16:30:00Z',
          author: 'Elena Vance',
          summary: 'Added variable extraction for capturedOrderCode and evidence screenshot.',
          stepCount: 10,
        },
        {
          version: 3,
          updatedAt: '2026-11-05T11:15:00Z',
          author: 'Jordan Rivera (Manual QA)',
          summary: 'Replaced manual login steps with Enterprise SSO Login SOP v2.4.0.',
          stepCount: 8,
        },
      ],
      author: 'Jordan Rivera (Manual QA)',
      targetEnvironment: 'Staging (Controlled Target)',
      browsers: ['chromium', 'firefox'],
      steps: tc1Steps,
      dataDrivenRows: [
        {orderQty: '5', department: 'Cloud Infrastructure'},
        {orderQty: '12', department: 'Security Operations'},
      ],
      createdAt: '2026-10-12T09:00:00Z',
      updatedAt: '2026-11-10T16:30:00Z',
      flakyScore: 4,
      passRate: 98.2,
      avgDurationMs: 1840,
      totalRuns: 45,
    },
    {
      id: 'tc-102',
      code: 'ACME-TC-102',
      title: 'Inventory Catalog Category Filtering & Row Count Verification',
      description:
        'Verifies initial 4 inventory rows in the controlled target portal, filters by Hardware category, and asserts 2 matching rows.',
      workspaceId: 'ws-enterprise-01',
      projectId: 'proj-acme-cloud',
      testPlanId: 'tp-release-2026-4',
      testSuiteId: 'ts-inventory-grid',
      status: 'active',
      priority: 'high',
      tags: ['regression', 'inventory', 'grid'],
      version: 2,
      versionHistory: [
        {
          version: 2,
          updatedAt: '2026-11-09T10:00:00Z',
          author: 'Priya Nair',
          summary: 'Added supervisor approval aria-pressed attribute assertion.',
          stepCount: 5,
        },
      ],
      author: 'Priya Nair',
      targetEnvironment: 'Staging (Controlled Target)',
      browsers: ['chromium', 'webkit'],
      steps: tc2Steps,
      dataDrivenRows: [],
      createdAt: '2026-10-18T14:00:00Z',
      updatedAt: '2026-11-09T10:00:00Z',
      flakyScore: 2,
      passRate: 100,
      avgDurationMs: 1120,
      totalRuns: 32,
    },
    {
      id: 'tc-103',
      code: 'ACME-TC-103',
      title: 'API Health Readiness & Conditional MFA Banner Dismissal',
      description:
        'Combines direct Playwright request API verification with conditional DOM branch execution on the sample portal.',
      workspaceId: 'ws-enterprise-01',
      projectId: 'proj-acme-cloud',
      testPlanId: 'tp-release-2026-4',
      testSuiteId: 'ts-checkout-e2e',
      status: 'active',
      priority: 'medium',
      tags: ['api', 'hybrid', 'security'],
      version: 1,
      versionHistory: [
        {
          version: 1,
          updatedAt: '2026-11-08T15:45:00Z',
          author: 'Marcus Chen',
          summary: 'Initial hybrid API + UI conditional workflow.',
          stepCount: 4,
        },
      ],
      author: 'Marcus Chen',
      targetEnvironment: 'Staging (Controlled Target)',
      browsers: ['chromium'],
      steps: tc3Steps,
      dataDrivenRows: [],
      createdAt: '2026-11-08T15:45:00Z',
      updatedAt: '2026-11-08T15:45:00Z',
      flakyScore: 0,
      passRate: 100,
      avgDurationMs: 960,
      totalRuns: 19,
    },
    {
      id: 'tc-201',
      code: 'FINL-TC-201',
      title: 'Cross-Border Settlement Batch Status Assertion (Negative / Failure Demo)',
      description:
        'Demonstrates failure capture, Playwright stack trace diagnostics, and deduplicated Jira ticket creation when expected settlement status text differs.',
      workspaceId: 'ws-enterprise-01',
      projectId: 'proj-finledger',
      testPlanId: 'tp-fin-q4',
      testSuiteId: 'ts-fin-settlement',
      status: 'active',
      priority: 'critical',
      tags: ['settlement', 'flaky-watch', 'compliance'],
      version: 3,
      versionHistory: [
        {
          version: 3,
          updatedAt: '2026-11-10T08:00:00Z',
          author: 'Elena Vance',
          summary: 'Strict exact match on settlement status badge.',
          stepCount: 3,
        },
      ],
      author: 'Elena Vance',
      targetEnvironment: 'QA Sandbox',
      browsers: ['chromium', 'firefox'],
      steps: tc4FlakySteps,
      dataDrivenRows: [],
      createdAt: '2026-10-25T11:00:00Z',
      updatedAt: '2026-11-10T08:00:00Z',
      flakyScore: 28,
      passRate: 71.4,
      avgDurationMs: 2150,
      totalRuns: 28,
    },
  ];

  const workers: WorkerNode[] = [
    {
      id: 'worker-us-east-01',
      name: 'pw-runner-us-east-01',
      pool: 'core-linux-pool',
      host: '10.42.10.14',
      containerId: 'docker://9f82c1a4b01e',
      status: 'online',
      maxConcurrency: 4,
      activeJobs: 0,
      supportedBrowsers: ['chromium', 'firefox', 'webkit'],
      cpuUsagePercent: 18,
      memoryUsageMb: 1120,
      maxMemoryMb: 8192,
      lastHeartbeatAt: '2026-11-10T19:38:00Z',
      uptimeSeconds: 412800,
      totalExecuted: 842,
      errorCount: 1,
      currentExecutionIds: [],
      recentLogs: [
        '[19:38:00] Heartbeat OK — Playwright 1.50.0 container healthy (chromium, firefox, webkit ready)',
        '[19:35:14] Completed execution EX-1004 in 1,810ms (exitCode=0)',
      ],
    },
    {
      id: 'worker-us-east-02',
      name: 'pw-runner-us-east-02',
      pool: 'core-linux-pool',
      host: '10.42.10.15',
      containerId: 'docker://3d71e8c9a22f',
      status: 'online',
      maxConcurrency: 4,
      activeJobs: 0,
      supportedBrowsers: ['chromium', 'firefox', 'webkit'],
      cpuUsagePercent: 24,
      memoryUsageMb: 1480,
      maxMemoryMb: 8192,
      lastHeartbeatAt: '2026-11-10T19:38:02Z',
      uptimeSeconds: 389100,
      totalExecuted: 791,
      errorCount: 0,
      currentExecutionIds: [],
      recentLogs: [
        '[19:38:02] Heartbeat OK — Worker pool slot capacity 4/4 available',
        '[19:32:09] Uploaded trace bundle trace-EX-1003.zip to persistent object store',
      ],
    },
    {
      id: 'worker-eu-west-01',
      name: 'pw-runner-eu-west-01',
      pool: 'high-mem-pool',
      host: '10.88.4.21',
      containerId: 'docker://7c11b3e0f99d',
      status: 'online',
      maxConcurrency: 6,
      activeJobs: 0,
      supportedBrowsers: ['chromium', 'firefox'],
      cpuUsagePercent: 15,
      memoryUsageMb: 2150,
      maxMemoryMb: 16384,
      lastHeartbeatAt: '2026-11-10T19:38:01Z',
      uptimeSeconds: 604800,
      totalExecuted: 1205,
      errorCount: 3,
      currentExecutionIds: [],
      recentLogs: [
        '[19:38:01] Heartbeat OK — Isolated network namespace verified',
        '[19:29:44] Execution EX-1002 failed assertion at step 3 (trace preserved)',
      ],
    },
    {
      id: 'worker-apac-01',
      name: 'pw-runner-apac-01',
      pool: 'core-linux-pool',
      host: '10.112.8.09',
      containerId: 'docker://5a09d2f4e11b',
      status: 'draining',
      maxConcurrency: 4,
      activeJobs: 0,
      supportedBrowsers: ['chromium', 'webkit'],
      cpuUsagePercent: 8,
      memoryUsageMb: 890,
      maxMemoryMb: 8192,
      lastHeartbeatAt: '2026-11-10T19:37:55Z',
      uptimeSeconds: 172400,
      totalExecuted: 310,
      errorCount: 0,
      currentExecutionIds: [],
      recentLogs: [
        '[19:30:00] Worker placed in DRAINING mode by Platform Admin for kernel image upgrade',
      ],
    },
  ];

  const genTc1 = generatePlaywrightCode(testCases[0], sopModules);
  const genTc2 = generatePlaywrightCode(testCases[1], sopModules);
  const genTc4 = generatePlaywrightCode(testCases[3], sopModules);

  const executions: ExecutionRun[] = [
    {
      id: 'EX-1004',
      runNumber: 1004,
      workspaceId: 'ws-enterprise-01',
      projectId: 'proj-acme-cloud',
      testPlanId: 'tp-release-2026-4',
      testSuiteId: 'ts-checkout-e2e',
      testCaseId: 'tc-101',
      testCaseCode: 'ACME-TC-101',
      testCaseTitle: 'E2E Procurement Order Creation & Supervisor Approval',
      triggerSource: 'manual',
      triggeredBy: 'Jordan Rivera',
      triggeredByRole: 'manual_qa',
      environmentName: 'Staging (Controlled Target)',
      baseUrl: 'http://localhost:3000',
      browser: 'chromium',
      workerId: 'worker-us-east-01',
      workerName: 'pw-runner-us-east-01',
      status: 'passed',
      retryAttempt: 0,
      maxRetries: 1,
      queuedAt: '2026-11-10T19:35:11Z',
      startedAt: '2026-11-10T19:35:12Z',
      completedAt: '2026-11-10T19:35:14Z',
      durationMs: 1810,
      queueWaitMs: 120,
      passedSteps: 10,
      failedSteps: 0,
      skippedSteps: 0,
      totalSteps: 10,
      generatedSpecCode: genTc1.code,
      traceArtifactId: 'trace-EX-1004-chromium.zip',
      videoArtifactId: 'video-EX-1004-chromium.webm',
      screenshotArtifactId: 'order-approved-confirmation.png',
      cpuPeakPercent: 46,
      memoryPeakMb: 1640,
      logs: [
        '[19:35:12.010] Worker pw-runner-us-east-01 leased job EX-1004 (browser=chromium)',
        '[19:35:12.140] Step 1 PASSED: page.goto("/sample-app") -> HTTP 200 OK',
        '[19:35:12.220] Step 2 PASSED: page.setViewportSize({ width: 1440, height: 900 })',
        '[19:35:12.590] Step 3 PASSED: SOP module runSop_enterpriseSsoLogin(page, {"username":"qa.lead@acme.io","role":"Supervisor"})',
        '[19:35:12.810] Step 4 PASSED: expect(page.getByTestId("dashboard-welcome-banner")).toBeVisible()',
        '[19:35:13.020] Step 5 PASSED: page.getByTestId("quantity-input").fill("5")',
        '[19:35:13.190] Step 6 PASSED: page.getByTestId("expedited-shipping-checkbox").check()',
        '[19:35:13.440] Step 7 PASSED: page.getByTestId("create-order-submit").click()',
        '[19:35:13.610] Step 8 PASSED: expect(page.getByTestId("order-status-badge")).toContainText("Approved & Dispatched")',
        '[19:35:13.710] Step 9 PASSED: Variable capturedOrderCode = "ORD-2026-8841"',
        '[19:35:13.820] Step 10 PASSED: Captured full-page artifact order-approved-confirmation.png',
        '[19:35:13.820] Playwright Trace saved: trace-EX-1004-chromium.zip (10/10 steps passed)',
      ],
      stepResults: tc1Steps.map((s, idx) => ({
        stepId: s.id,
        stepIndex: idx,
        actionId: s.actionId,
        label: s.label,
        status: 'passed',
        durationMs: 140 + (idx % 4) * 35,
        startedAt: '2026-11-10T19:35:12Z',
        completedAt: '2026-11-10T19:35:14Z',
        generatedCodeLine: `// Step ${idx + 1}: ${s.label}`,
        locatorResolved: s.parameters.locator
          ? formatPlaywrightLocator(String(s.parameters.locator))
          : 'page',
        actualValue:
          s.actionId === 'assert.text'
            ? 'Approved & Dispatched'
            : s.actionId === 'logic.setVariable'
              ? 'ORD-2026-8841'
              : 'OK',
        expectedValue: String(
          s.parameters.expectedText || s.parameters.value || 'OK'
        ),
        logLines: [`Step ${idx + 1} (${s.actionId}) completed cleanly.`],
        domSnapshotSnippet:
          '<div data-testid="order-status-badge" class="status-approved">Approved & Dispatched · ORD-2026-8841</div>',
      })),
    },
    {
      id: 'EX-1003',
      runNumber: 1003,
      workspaceId: 'ws-enterprise-01',
      projectId: 'proj-acme-cloud',
      testPlanId: 'tp-release-2026-4',
      testSuiteId: 'ts-inventory-grid',
      testCaseId: 'tc-102',
      testCaseCode: 'ACME-TC-102',
      testCaseTitle: 'Inventory Catalog Category Filtering & Row Count Verification',
      triggerSource: 'suite',
      triggeredBy: 'Priya Nair',
      triggeredByRole: 'automation_engineer',
      environmentName: 'Staging (Controlled Target)',
      baseUrl: 'http://localhost:3000',
      browser: 'webkit',
      workerId: 'worker-us-east-02',
      workerName: 'pw-runner-us-east-02',
      status: 'passed',
      retryAttempt: 0,
      maxRetries: 1,
      queuedAt: '2026-11-10T19:32:07Z',
      startedAt: '2026-11-10T19:32:08Z',
      completedAt: '2026-11-10T19:32:09Z',
      durationMs: 1140,
      queueWaitMs: 95,
      passedSteps: 5,
      failedSteps: 0,
      skippedSteps: 0,
      totalSteps: 5,
      generatedSpecCode: genTc2.code,
      traceArtifactId: 'trace-EX-1003-webkit.zip',
      cpuPeakPercent: 39,
      memoryPeakMb: 1410,
      logs: [
        '[19:32:08.005] Worker pw-runner-us-east-02 leased job EX-1003 (browser=webkit)',
        '[19:32:08.250] Step 1 PASSED: Navigated to /sample-app',
        '[19:32:08.480] Step 2 PASSED: Verified 4 inventory rows',
        '[19:32:08.710] Step 3 PASSED: Selected Hardware filter option',
        '[19:32:08.950] Step 4 PASSED: Verified 2 filtered Hardware rows',
        '[19:32:09.145] Step 5 PASSED: Verified aria-pressed="true" on approval toggle',
      ],
      stepResults: tc2Steps.map((s, idx) => ({
        stepId: s.id,
        stepIndex: idx,
        actionId: s.actionId,
        label: s.label,
        status: 'passed',
        durationMs: 210,
        startedAt: '2026-11-10T19:32:08Z',
        completedAt: '2026-11-10T19:32:09Z',
        generatedCodeLine: `// Step ${idx + 1}: ${s.label}`,
        locatorResolved: s.parameters.locator
          ? formatPlaywrightLocator(String(s.parameters.locator))
          : 'page',
        actualValue: String(
          s.parameters.expectedCount ?? s.parameters.expectedValue ?? 'OK'
        ),
        expectedValue: String(
          s.parameters.expectedCount ?? s.parameters.expectedValue ?? 'OK'
        ),
        logLines: [`Step ${idx + 1} verified.`],
      })),
    },
    {
      id: 'EX-1002',
      runNumber: 1002,
      workspaceId: 'ws-enterprise-01',
      projectId: 'proj-finledger',
      testPlanId: 'tp-fin-q4',
      testSuiteId: 'ts-fin-settlement',
      testCaseId: 'tc-201',
      testCaseCode: 'FINL-TC-201',
      testCaseTitle: 'Cross-Border Settlement Batch Status Assertion (Negative / Failure Demo)',
      triggerSource: 'schedule',
      triggeredBy: 'Nightly Scheduler',
      triggeredByRole: 'automation_engineer',
      environmentName: 'QA Sandbox',
      baseUrl: 'http://localhost:3000',
      browser: 'firefox',
      workerId: 'worker-eu-west-01',
      workerName: 'pw-runner-eu-west-01',
      status: 'failed',
      retryAttempt: 2,
      maxRetries: 2,
      queuedAt: '2026-11-10T19:29:41Z',
      startedAt: '2026-11-10T19:29:42Z',
      completedAt: '2026-11-10T19:29:44Z',
      durationMs: 2290,
      queueWaitMs: 180,
      passedSteps: 2,
      failedSteps: 1,
      skippedSteps: 0,
      totalSteps: 3,
      generatedSpecCode: genTc4.code,
      traceArtifactId: 'trace-EX-1002-firefox.zip',
      screenshotArtifactId: 'failure-EX-1002-step-3.png',
      cpuPeakPercent: 62,
      memoryPeakMb: 2340,
      failureFingerprint: 'FINL-TC-201::step-403::assert.text::Batch Settlement Completed #99',
      linkedIssueKey: 'JIRA-QA-409',
      logs: [
        '[19:29:42.010] Worker pw-runner-eu-west-01 leased job EX-1002 (browser=firefox)',
        '[19:29:42.310] Step 1 PASSED: page.goto("/sample-app")',
        '[19:29:42.680] Step 2 PASSED: page.waitForResponse("/api/platform" -> 200)',
        '[19:29:44.300] Step 3 FAILED: Expect(page.getByTestId("order-status-badge")).toHaveText("Batch Settlement Completed #99")',
        '[19:29:44.300]   Expected string: "Batch Settlement Completed #99"',
        '[19:29:44.300]   Received string: "Approved & Dispatched"',
        '[19:29:44.310] Linked existing deduplicated issue JIRA-QA-409 (occurrence #3)',
      ],
      stepResults: [
        {
          stepId: 'step-401',
          stepIndex: 0,
          actionId: 'nav.goto',
          label: 'Navigate to FinLedger Settlement Portal',
          status: 'passed',
          durationMs: 300,
          startedAt: '2026-11-10T19:29:42Z',
          completedAt: '2026-11-10T19:29:42Z',
          generatedCodeLine: "await page.goto('/sample-app');",
          locatorResolved: 'page',
          actualValue: '/sample-app',
          expectedValue: '/sample-app',
          logLines: ['Navigated to /sample-app (200 OK)'],
        },
        {
          stepId: 'step-402',
          stepIndex: 1,
          actionId: 'sync.waitForResponse',
          label: 'Wait for Settlement Batch Webhook Response',
          status: 'passed',
          durationMs: 370,
          startedAt: '2026-11-10T19:29:42Z',
          completedAt: '2026-11-10T19:29:43Z',
          generatedCodeLine:
            "await page.waitForResponse((res) => res.url().includes('/api/platform') && res.status() === 200);",
          locatorResolved: 'network',
          actualValue: '200',
          expectedValue: '200',
          logLines: ['Matched GET /api/platform -> 200 OK'],
        },
        {
          stepId: 'step-403',
          stepIndex: 2,
          actionId: 'assert.text',
          label: 'Verify Settlement Batch Reconciled Status',
          status: 'failed',
          durationMs: 1620,
          startedAt: '2026-11-10T19:29:43Z',
          completedAt: '2026-11-10T19:29:44Z',
          generatedCodeLine:
            "await expect(page.getByTestId('order-status-badge')).toHaveText('Batch Settlement Completed #99');",
          locatorResolved: "page.getByTestId('order-status-badge')",
          actualValue: 'Approved & Dispatched',
          expectedValue: 'Batch Settlement Completed #99',
          errorMessage:
            'Timed out 5000ms waiting for expect(locator).toHaveText(expected) — Expected: "Batch Settlement Completed #99", Received: "Approved & Dispatched"',
          stackTrace: `Error: Timed out 5000ms waiting for expect(locator).toHaveText(expected)
Locator: getByTestId('order-status-badge')
Expected string: "Batch Settlement Completed #99"
Received string: "Approved & Dispatched"
    at tests/FINL-TC-201.spec.ts:18:56`,
          logLines: [
            'Locator resolved to <span data-testid="order-status-badge">Approved & Dispatched</span>',
            'Assertion failed after auto-wait retry budget exhausted.',
          ],
          domSnapshotSnippet:
            '<span data-testid="order-status-badge" class="status-pill">Approved & Dispatched</span>',
        },
      ],
    },
  ];

  return {
    workspaces: [
      {
        id: 'ws-enterprise-01',
        name: 'Acme Global Quality Engineering',
        slug: 'acme-global-qe',
        tier: 'Enterprise Multi-Tenant',
      },
    ],
    projects,
    testPlans: [
      {
        id: 'tp-release-2026-4',
        name: 'Release 2026.4 Master Sign-Off Plan',
        description: 'Mandatory pre-release regression and smoke verification plan for Acme Cloud Commerce.',
        projectId: 'proj-acme-cloud',
        targetRelease: 'v2026.4.0-rc2',
        scheduleCron: '0 */6 * * *',
      },
      {
        id: 'tp-fin-q4',
        name: 'Q4 Regulatory Settlement Audit Plan',
        description: 'Automated compliance checks for wire transfers and batch reconciliation.',
        projectId: 'proj-finledger',
        targetRelease: 'v9.12.0',
        scheduleCron: '0 2 * * *',
      },
    ],
    testSuites: [
      {
        id: 'ts-checkout-e2e',
        name: 'Procurement & Order Approval Suite',
        description: 'End-to-end order lifecycle, SSO authentication, and supervisor sign-off.',
        projectId: 'proj-acme-cloud',
        testPlanId: 'tp-release-2026-4',
        tags: ['smoke', 'critical-path'],
        parallelism: 4,
      },
      {
        id: 'ts-inventory-grid',
        name: 'Inventory Catalog & Search Filtering Suite',
        description: 'Data grid filtering, sorting, and stock count assertions.',
        projectId: 'proj-acme-cloud',
        testPlanId: 'tp-release-2026-4',
        tags: ['regression', 'ui-grid'],
        parallelism: 2,
      },
      {
        id: 'ts-fin-settlement',
        name: 'Core Settlement Reconciliation Suite',
        description: 'High-priority ledger settlement checks.',
        projectId: 'proj-finledger',
        testPlanId: 'tp-fin-q4',
        tags: ['compliance', 'settlement'],
        parallelism: 2,
      },
    ],
    testCases,
    sopModules,
    workers,
    executions,
    secrets: [
      {
        id: 'sec-1',
        key: 'ACME_SSO_PASSWORD',
        environmentSlug: 'staging',
        projectId: 'proj-acme-cloud',
        maskedValue: '•••••••••••••••••••• (AES-256-GCM)',
        createdAt: '2026-10-01T12:00:00Z',
        createdBy: 'Elena Vance',
        lastUsedAt: '2026-11-10T19:35:12Z',
      },
      {
        id: 'sec-2',
        key: 'ACME_API_KEY',
        environmentSlug: 'staging',
        projectId: 'proj-acme-cloud',
        maskedValue: '•••••••••••••••••••• (AES-256-GCM)',
        createdAt: '2026-10-04T09:30:00Z',
        createdBy: 'Marcus Chen',
        lastUsedAt: '2026-11-10T18:10:00Z',
      },
    ],
    notificationRules: [
      {
        id: 'notif-slack-1',
        name: 'QA Alerts — #qa-automation-alerts',
        channel: 'slack',
        targetDestination: '#qa-automation-alerts',
        events: ['execution_failed', 'worker_unhealthy', 'flaky_threshold'],
        enabled: true,
        deduplicateFailures: true,
        projectId: 'proj-acme-cloud',
      },
      {
        id: 'notif-jira-1',
        name: 'Jira Auto-Triage (Deduplicated by Fingerprint)',
        channel: 'jira',
        targetDestination: 'Project: JIRA-QA',
        events: ['execution_failed'],
        enabled: true,
        deduplicateFailures: true,
        projectId: 'proj-finledger',
      },
      {
        id: 'notif-teams-1',
        name: 'Release Sign-Off Digest — MS Teams',
        channel: 'teams',
        targetDestination: 'Release Engineering Channel',
        events: ['execution_completed', 'execution_failed'],
        enabled: true,
        deduplicateFailures: false,
        projectId: 'proj-acme-cloud',
      },
    ],
    notificationHistory: [
      {
        id: 'nd-1',
        ruleId: 'notif-jira-1',
        channel: 'jira',
        destination: 'Project: JIRA-QA',
        subject: '[DEDUPLICATED] Failure in FINL-TC-201 linked to JIRA-QA-409',
        message:
          'Execution EX-1002 failed with matching fingerprint FINL-TC-201::step-403. Incremented occurrence counter on JIRA-QA-409 instead of creating duplicate ticket.',
        executionId: 'EX-1002',
        issueKey: 'JIRA-QA-409',
        createdAt: '2026-11-10T19:29:44Z',
        deduplicated: true,
      },
      {
        id: 'nd-2',
        ruleId: 'notif-teams-1',
        channel: 'teams',
        destination: 'Release Engineering Channel',
        subject: 'Execution EX-1004 PASSED (ACME-TC-101)',
        message: '10/10 steps passed on Chromium in 1,810ms via worker pw-runner-us-east-01.',
        executionId: 'EX-1004',
        createdAt: '2026-11-10T19:35:14Z',
        deduplicated: false,
      },
    ],
    issues: [
      {
        id: 'iss-1',
        key: 'JIRA-QA-409',
        title: 'FINL-TC-201: Settlement status badge shows Approved & Dispatched instead of Batch Settlement Completed #99',
        projectId: 'proj-finledger',
        testCaseId: 'tc-201',
        executionId: 'EX-1002',
        failureFingerprint: 'FINL-TC-201::step-403::assert.text::Batch Settlement Completed #99',
        status: 'Open',
        occurrenceCount: 3,
        createdAt: '2026-11-09T22:15:00Z',
        lastSeenAt: '2026-11-10T19:29:44Z',
        assignee: 'Elena Vance',
      },
    ],
    auditLogs: [
      {
        id: 'aud-1',
        timestamp: '2026-11-10T19:35:12Z',
        actor: 'Jordan Rivera',
        role: 'manual_qa',
        action: 'TRIGGER_EXECUTION',
        resourceType: 'execution',
        resourceId: 'EX-1004',
        details: 'Triggered manual execution of ACME-TC-101 on Chromium (Staging)',
        ipAddress: '10.14.88.102',
      },
      {
        id: 'aud-2',
        timestamp: '2026-11-10T19:30:00Z',
        actor: 'Alex Morgan',
        role: 'platform_admin',
        action: 'DRAIN_WORKER',
        resourceType: 'worker',
        resourceId: 'worker-apac-01',
        details: 'Transitioned worker pw-runner-apac-01 to DRAINING state for maintenance',
        ipAddress: '10.14.12.04',
      },
      {
        id: 'aud-3',
        timestamp: '2026-11-10T16:30:00Z',
        actor: 'Elena Vance',
        role: 'automation_engineer',
        action: 'UPDATE_TEST_WORKFLOW',
        resourceType: 'test_case',
        resourceId: 'tc-101',
        details: 'Saved visual workflow v4 for ACME-TC-101 (10 steps, valid Playwright TypeScript)',
        ipAddress: '10.14.22.19',
      },
    ],
  };
}

export function loadPlatformState(): PlatformState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true});
    }
    if (!fs.existsSync(DB_FILE)) {
      const seed = createSeedState();
      fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), 'utf-8');
      return seed;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as PlatformState;
  } catch {
    return createSeedState();
  }
}

export function savePlatformState(state: PlatformState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true});
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Ignore write errors in read-only environments
  }
}

export function appendAuditLog(
  state: PlatformState,
  entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'ipAddress'>
): void {
  state.auditLogs.unshift({
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ipAddress: '10.42.0.1',
    ...entry,
  });
}

/**
 * Executes a TestCase against our controlled target application virtual DOM state machine
 * and updates workers, execution history, deduplicated Jira issues, and notifications.
 */
export function runTestCaseExecution(
  state: PlatformState,
  params: {
    testCaseId: string;
    browser?: BrowserEngine;
    environmentName?: string;
    triggerSource?: 'manual' | 'suite' | 'schedule' | 'ci_webhook';
    actorName?: string;
    actorRole: RoleType;
  }
): {run: ExecutionRun; error?: string} {
  if (!canPerformAction(params.actorRole, 'canExecuteTests')) {
    return {
      run: null as unknown as ExecutionRun,
      error: `Permission denied: Role "${params.actorRole}" is not authorized to execute tests.`,
    };
  }

  const testCase = state.testCases.find((tc) => tc.id === params.testCaseId);
  if (!testCase) {
    return {
      run: null as unknown as ExecutionRun,
      error: `Test case "${params.testCaseId}" not found.`,
    };
  }

  const project =
    state.projects.find((p) => p.id === testCase.projectId) || state.projects[0];
  const browser: BrowserEngine =
    params.browser || testCase.browsers[0] || 'chromium';
  const envName =
    params.environmentName ||
    testCase.targetEnvironment ||
    project.defaultEnvironment;

  // Allocate worker from project pool
  let worker = allocateWorkerForJob(state.workers, project.workerPool, browser);
  if (!worker) {
    // Fallback to any online worker supporting the browser
    worker = allocateWorkerForJob(state.workers, 'any', browser);
  }

  const nextRunNumber =
    state.executions.reduce((max, e) => Math.max(max, e.runNumber), 1000) + 1;
  const executionId = `EX-${nextRunNumber}`;
  const nowIso = new Date().toISOString();
  const codeGen = generatePlaywrightCode(testCase, state.sopModules);

  if (!worker) {
    // Create an infrastructure/queued warning run if all workers are offline/draining
    const infraRun: ExecutionRun = {
      id: executionId,
      runNumber: nextRunNumber,
      workspaceId: testCase.workspaceId,
      projectId: testCase.projectId,
      testPlanId: testCase.testPlanId,
      testSuiteId: testCase.testSuiteId,
      testCaseId: testCase.id,
      testCaseCode: testCase.code,
      testCaseTitle: testCase.title,
      triggerSource: params.triggerSource || 'manual',
      triggeredBy: params.actorName || 'QA Operator',
      triggeredByRole: params.actorRole,
      environmentName: envName,
      baseUrl: 'http://localhost:3000',
      browser,
      workerId: 'unassigned',
      workerName: 'No Eligible Worker Available',
      status: 'queued',
      retryAttempt: 0,
      maxRetries: 1,
      queuedAt: nowIso,
      startedAt: nowIso,
      durationMs: 0,
      queueWaitMs: 450,
      passedSteps: 0,
      failedSteps: 0,
      skippedSteps: testCase.steps.length,
      totalSteps: testCase.steps.length,
      stepResults: testCase.steps.map((s, idx) => ({
        stepId: s.id,
        stepIndex: idx,
        actionId: s.actionId,
        label: s.label,
        status: 'queued',
        durationMs: 0,
        startedAt: nowIso,
        generatedCodeLine: `// Queued: ${s.label}`,
        logLines: ['Waiting in durable execution queue for worker capacity...'],
      })),
      logs: [
        `[${nowIso}] Job ${executionId} enqueued. Waiting for worker supporting ${browser} in pool ${project.workerPool}.`,
      ],
      generatedSpecCode: codeGen.code,
      traceArtifactId: `trace-${executionId}-${browser}.zip`,
      cpuPeakPercent: 0,
      memoryPeakMb: 0,
    };
    state.executions.unshift(infraRun);
    savePlatformState(state);
    return {run: infraRun};
  }

  // Evaluate workflow steps deterministically against the Controlled Target App Virtual DOM
  const vdom = createInitialTargetAppState();
  const stepResults: StepExecutionResult[] = [];
  const runLogs: string[] = [
    `[${new Date().toISOString().slice(11, 23)}] Worker ${worker.name} (${worker.containerId}) leased job ${executionId} [browser=${browser}, env=${envName}]`,
  ];

  let passedSteps = 0;
  let failedSteps = 0;
  let skippedSteps = 0;
  let totalDurationMs = 0;
  let failureStep: {step: WorkflowStep; message: string} | null = null;
  const runtimeVariables: Record<string, string> = {};

  for (let i = 0; i < testCase.steps.length; i++) {
    const step = testCase.steps[i];
    if (!step.enabled || failureStep) {
      skippedSteps++;
      stepResults.push({
        stepId: step.id,
        stepIndex: i,
        actionId: step.actionId,
        label: step.label,
        status: 'skipped',
        durationMs: 0,
        startedAt: nowIso,
        completedAt: nowIso,
        generatedCodeLine: `// Skipped: ${step.label}`,
        logLines: [
          !step.enabled
            ? 'Step disabled in workflow definition.'
            : 'Step skipped due to prior step failure.',
        ],
      });
      continue;
    }

    const evalOutcome = evaluateStepAgainstTargetDom(
      step,
      vdom,
      runtimeVariables,
      state.sopModules
    );
    totalDurationMs += evalOutcome.durationMs;

    if (evalOutcome.passed) {
      passedSteps++;
      stepResults.push({
        stepId: step.id,
        stepIndex: i,
        actionId: step.actionId,
        label: step.label,
        status: 'passed',
        durationMs: evalOutcome.durationMs,
        startedAt: nowIso,
        completedAt: nowIso,
        generatedCodeLine: evalOutcome.codeLine,
        locatorResolved: evalOutcome.locatorResolved,
        actualValue: evalOutcome.actualValue,
        expectedValue: evalOutcome.expectedValue,
        logLines: evalOutcome.logs,
        domSnapshotSnippet: evalOutcome.domSnippet,
      });
      runLogs.push(
        `[${new Date().toISOString().slice(11, 23)}] Step ${i + 1} PASSED (${evalOutcome.durationMs}ms): ${step.label} -> ${evalOutcome.actualValue}`
      );
    } else {
      failedSteps++;
      failureStep = {step, message: evalOutcome.errorMessage || 'Step failed'};
      stepResults.push({
        stepId: step.id,
        stepIndex: i,
        actionId: step.actionId,
        label: step.label,
        status: 'failed',
        durationMs: evalOutcome.durationMs,
        startedAt: nowIso,
        completedAt: nowIso,
        generatedCodeLine: evalOutcome.codeLine,
        locatorResolved: evalOutcome.locatorResolved,
        actualValue: evalOutcome.actualValue,
        expectedValue: evalOutcome.expectedValue,
        errorMessage: evalOutcome.errorMessage,
        stackTrace: evalOutcome.stackTrace,
        logLines: evalOutcome.logs,
        domSnapshotSnippet: evalOutcome.domSnippet,
      });
      runLogs.push(
        `[${new Date().toISOString().slice(11, 23)}] Step ${i + 1} FAILED (${evalOutcome.durationMs}ms): ${evalOutcome.errorMessage}`
      );
    }
  }

  const finalStatus = failedSteps > 0 ? 'failed' : 'passed';
  let failureFingerprint: string | undefined;
  let linkedIssueKey: string | undefined;

  if (failureStep) {
    failureFingerprint = `${testCase.code}::${failureStep.step.id}::${failureStep.step.actionId}::${String(
      failureStep.step.parameters.expectedText ||
        failureStep.step.parameters.expectedCount ||
        failureStep.step.parameters.expectedValue ||
        'error'
    )}`;

    // Deduplicated issue tracking
    const existingIssue = state.issues.find(
      (iss) => iss.failureFingerprint === failureFingerprint
    );
    if (existingIssue) {
      existingIssue.occurrenceCount += 1;
      existingIssue.lastSeenAt = nowIso;
      existingIssue.executionId = executionId;
      linkedIssueKey = existingIssue.key;
      runLogs.push(
        `[${new Date().toISOString().slice(11, 23)}] Linked failure to existing Jira ticket ${existingIssue.key} (deduplicated occurrence #${existingIssue.occurrenceCount})`
      );
    } else {
      const newIssueKey = `JIRA-QA-${410 + state.issues.length}`;
      const newIssue: IssueTicket = {
        id: `iss-${Date.now()}`,
        key: newIssueKey,
        title: `${testCase.code}: ${failureStep.step.label} failed on ${browser}`,
        projectId: testCase.projectId,
        testCaseId: testCase.id,
        executionId,
        failureFingerprint,
        status: 'Open',
        occurrenceCount: 1,
        createdAt: nowIso,
        lastSeenAt: nowIso,
        assignee: testCase.author,
      };
      state.issues.unshift(newIssue);
      linkedIssueKey = newIssueKey;
      runLogs.push(
        `[${new Date().toISOString().slice(11, 23)}] Created new Jira issue ${newIssueKey} for unique failure fingerprint`
      );
    }
  }

  runLogs.push(
    `[${new Date().toISOString().slice(11, 23)}] Playwright Trace archived: trace-${executionId}-${browser}.zip (${passedSteps}/${testCase.steps.length} steps passed in ${totalDurationMs}ms)`
  );

  const run: ExecutionRun = {
    id: executionId,
    runNumber: nextRunNumber,
    workspaceId: testCase.workspaceId,
    projectId: testCase.projectId,
    testPlanId: testCase.testPlanId,
    testSuiteId: testCase.testSuiteId,
    testCaseId: testCase.id,
    testCaseCode: testCase.code,
    testCaseTitle: testCase.title,
    triggerSource: params.triggerSource || 'manual',
    triggeredBy: params.actorName || 'QA Operator',
    triggeredByRole: params.actorRole,
    environmentName: envName,
    baseUrl: 'http://localhost:3000',
    browser,
    workerId: worker.id,
    workerName: worker.name,
    status: finalStatus,
    retryAttempt: failedSteps > 0 ? 1 : 0,
    maxRetries: 1,
    queuedAt: nowIso,
    startedAt: nowIso,
    completedAt: new Date(Date.now() + totalDurationMs).toISOString(),
    durationMs: totalDurationMs,
    queueWaitMs: 85,
    passedSteps,
    failedSteps,
    skippedSteps,
    totalSteps: testCase.steps.length,
    stepResults,
    logs: runLogs,
    generatedSpecCode: codeGen.code,
    traceArtifactId: `trace-${executionId}-${browser}.zip`,
    videoArtifactId: `video-${executionId}-${browser}.webm`,
    screenshotArtifactId:
      finalStatus === 'failed'
        ? `failure-${executionId}.png`
        : `evidence-${executionId}.png`,
    cpuPeakPercent: Math.min(95, worker.cpuUsagePercent + 24),
    memoryPeakMb: worker.memoryUsageMb + 380,
    failureFingerprint,
    linkedIssueKey,
  };

  // Update worker stats
  worker.totalExecuted += 1;
  worker.lastHeartbeatAt = nowIso;
  if (finalStatus === 'failed') {
    worker.errorCount += 1;
  }
  worker.recentLogs.unshift(
    `[${nowIso.slice(11, 19)}] Completed ${executionId} (${testCase.code}) -> ${finalStatus.toUpperCase()} in ${totalDurationMs}ms`
  );
  worker.recentLogs = worker.recentLogs.slice(0, 10);

  // Update TestCase metrics
  testCase.totalRuns += 1;
  const tcRuns = [
    run,
    ...state.executions.filter((e) => e.testCaseId === testCase.id),
  ];
  const tcPassed = tcRuns.filter((e) => e.status === 'passed').length;
  testCase.passRate = Math.round((tcPassed / tcRuns.length) * 1000) / 10;
  testCase.avgDurationMs = Math.round(
    tcRuns.reduce((sum, e) => sum + e.durationMs, 0) / tcRuns.length
  );

  // Dispatch Notifications for matching rules
  for (const rule of state.notificationRules) {
    if (!rule.enabled) continue;
    const matchesEvent =
      (finalStatus === 'failed' && rule.events.includes('execution_failed')) ||
      (finalStatus === 'passed' && rule.events.includes('execution_completed'));
    if (matchesEvent) {
      const dispatch: NotificationDispatchRecord = {
        id: `nd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ruleId: rule.id,
        channel: rule.channel,
        destination: rule.targetDestination,
        subject: `[${finalStatus.toUpperCase()}] ${executionId} — ${testCase.code} (${browser})`,
        message:
          finalStatus === 'passed'
            ? `${passedSteps}/${testCase.steps.length} steps passed in ${totalDurationMs}ms on ${worker.name}.`
            : `Failed at "${failureStep?.step.label}". Linked Jira issue: ${linkedIssueKey || 'N/A'}.`,
        executionId,
        issueKey: linkedIssueKey,
        createdAt: nowIso,
        deduplicated: Boolean(finalStatus === 'failed' && rule.deduplicateFailures),
      };
      state.notificationHistory.unshift(dispatch);
    }
  }

  state.executions.unshift(run);
  appendAuditLog(state, {
    actor: params.actorName || 'QA Operator',
    role: params.actorRole,
    action: 'EXECUTE_TEST_CASE',
    resourceType: 'execution',
    resourceId: executionId,
    details: `Executed ${testCase.code} on ${browser} (${worker.name}) -> ${finalStatus.toUpperCase()}`,
  });

  savePlatformState(state);
  return {run};
}

function evaluateStepAgainstTargetDom(
  step: WorkflowStep,
  vdom: TargetAppVirtualDomState,
  runtimeVariables: Record<string, string>,
  sopModules: SOPModule[]
): {
  passed: boolean;
  durationMs: number;
  codeLine: string;
  locatorResolved: string;
  actualValue: string;
  expectedValue: string;
  errorMessage?: string;
  stackTrace?: string;
  logs: string[];
  domSnippet: string;
} {
  const p = step.parameters;
  const schema = getActionRegistryEntry(step.actionId);
  const locStr = p.locator ? formatPlaywrightLocator(String(p.locator)) : 'page';

  switch (step.actionId) {
    case 'nav.goto': {
      const url = String(p.url || '/sample-app');
      vdom.currentUrl = url;
      return {
        passed: true,
        durationMs: 210,
        codeLine: `await page.goto('${url}', { waitUntil: '${p.waitUntil || 'domcontentloaded'}' });`,
        locatorResolved: 'page',
        actualValue: `HTTP 200 (${url})`,
        expectedValue: url,
        logs: [`Navigated to ${url} and awaited ${p.waitUntil || 'domcontentloaded'}.`],
        domSnippet: `<main data-testid="sample-app-root" data-url="${url}"><h1>${vdom.title}</h1></main>`,
      };
    }

    case 'nav.viewport': {
      const w = Number(p.width || 1440);
      const h = Number(p.height || 900);
      return {
        passed: true,
        durationMs: 65,
        codeLine: `await page.setViewportSize({ width: ${w}, height: ${h} });`,
        locatorResolved: 'page.viewportSize()',
        actualValue: `${w}x${h}`,
        expectedValue: `${w}x${h}`,
        logs: [`Viewport resized to ${w}x${h}px.`],
        domSnippet: `<body style="width:${w}px;height:${h}px">`,
      };
    }

    case 'act.fill': {
      const locKey = String(p.locator || '');
      const rawVal = String(p.value ?? '');
      const maskedVal = rawVal.includes('{{SECRET:')
        ? '•••••••• (Injected from Vault)'
        : rawVal;
      vdom.inputValues[locKey] = rawVal;
      if (locKey.includes('search')) {
        vdom.searchQuery = rawVal;
      }
      return {
        passed: true,
        durationMs: 145,
        codeLine: `await ${locStr}.fill('${maskedVal}');`,
        locatorResolved: locStr,
        actualValue: maskedVal,
        expectedValue: maskedVal,
        logs: [`Cleared and filled ${locStr} with "${maskedVal}".`],
        domSnippet: `<input data-testid="${locKey.replace('testid=', '')}" value="${maskedVal}" />`,
      };
    }

    case 'act.click': {
      const locKey = String(p.locator || '');
      if (locKey.includes('acknowledge-banner-btn')) {
        vdom.mfaBannerVisible = false;
      }
      if (locKey.includes('create-order-submit')) {
        vdom.orderStatusText = 'Approved & Dispatched';
      }
      if (locKey.includes('approval-toggle-btn')) {
        vdom.approvalPressed = !vdom.approvalPressed;
      }
      return {
        passed: true,
        durationMs: 160,
        codeLine: `await ${locStr}.click();`,
        locatorResolved: locStr,
        actualValue: 'Clicked (Element visible & enabled)',
        expectedValue: 'Click dispatched',
        logs: [`Auto-wait passed; pointer click dispatched on ${locStr}.`],
        domSnippet: `<button data-testid="${locKey.replace('testid=', '')}" data-clicked="true">Action Button</button>`,
      };
    }

    case 'act.check': {
      const locKey = String(p.locator || '');
      const checked = Boolean(p.checked ?? true);
      if (locKey.includes('expedited-shipping')) {
        vdom.expeditedShipping = checked;
      }
      return {
        passed: true,
        durationMs: 120,
        codeLine: checked ? `await ${locStr}.check();` : `await ${locStr}.uncheck();`,
        locatorResolved: locStr,
        actualValue: `checked=${checked}`,
        expectedValue: `checked=${checked}`,
        logs: [`Checkbox state set to ${checked}.`],
        domSnippet: `<input type="checkbox" data-testid="${locKey.replace('testid=', '')}" ${checked ? 'checked' : ''} />`,
      };
    }

    case 'act.selectOption': {
      const opt = String(p.optionValue || 'All');
      vdom.selectedCategory = opt;
      return {
        passed: true,
        durationMs: 135,
        codeLine: `await ${locStr}.selectOption('${opt}');`,
        locatorResolved: locStr,
        actualValue: opt,
        expectedValue: opt,
        logs: [`Selected dropdown option "${opt}" on ${locStr}.`],
        domSnippet: `<select data-testid="category-filter-select"><option selected>${opt}</option></select>`,
      };
    }

    case 'assert.text': {
      const locKey = String(p.locator || '');
      const expected = String(p.expectedText ?? '');
      const matchMode = String(p.matchMode || 'contains');
      let actual = vdom.orderStatusText;
      if (locKey.includes('portal-heading') || locKey.includes('welcome')) {
        actual = vdom.title;
      } else if (locKey.includes('latest-order-id')) {
        actual = vdom.latestOrderId;
      }

      const matched =
        matchMode === 'exact'
          ? actual === expected
          : actual.toLowerCase().includes(expected.toLowerCase());

      if (!matched) {
        return {
          passed: false,
          durationMs: 1520,
          codeLine: `await expect(${locStr}).${matchMode === 'exact' ? 'toHaveText' : 'toContainText'}('${expected}');`,
          locatorResolved: locStr,
          actualValue: actual,
          expectedValue: expected,
          errorMessage: `Timed out 5000ms waiting for expect(${locStr}).${matchMode === 'exact' ? 'toHaveText' : 'toContainText'}('${expected}') — Received: "${actual}"`,
          stackTrace: `Error: Timed out 5000ms waiting for expect(locator).${matchMode === 'exact' ? 'toHaveText' : 'toContainText'}(expected)\nLocator: ${locStr}\nExpected: "${expected}"\nReceived: "${actual}"`,
          logs: [`Assertion failed: expected "${expected}", received "${actual}".`],
          domSnippet: `<span data-testid="${locKey.replace('testid=', '')}">${actual}</span>`,
        };
      }

      return {
        passed: true,
        durationMs: 130,
        codeLine: `await expect(${locStr}).${matchMode === 'exact' ? 'toHaveText' : 'toContainText'}('${expected}');`,
        locatorResolved: locStr,
        actualValue: actual,
        expectedValue: expected,
        logs: [`Verified text "${actual}" matches "${expected}".`],
        domSnippet: `<span data-testid="${locKey.replace('testid=', '')}">${actual}</span>`,
      };
    }

    case 'assert.count': {
      const expectedCount = Number(p.expectedCount ?? 4);
      const filteredRows = vdom.inventoryRows.filter((row) => {
        const matchesCat =
          vdom.selectedCategory === 'All' ||
          row.category.toLowerCase() === vdom.selectedCategory.toLowerCase();
        const matchesSearch =
          !vdom.searchQuery ||
          row.name.toLowerCase().includes(vdom.searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
      });
      const actualCount = filteredRows.length;
      const passed = actualCount === expectedCount;

      return {
        passed,
        durationMs: passed ? 140 : 1450,
        codeLine: `await expect(${locStr}).toHaveCount(${expectedCount});`,
        locatorResolved: locStr,
        actualValue: String(actualCount),
        expectedValue: String(expectedCount),
        errorMessage: passed
          ? undefined
          : `expect(${locStr}).toHaveCount(${expectedCount}) failed: found ${actualCount} elements.`,
        stackTrace: passed
          ? undefined
          : `Error: expect(locator).toHaveCount(expected)\nLocator: ${locStr}\nExpected: ${expectedCount}\nReceived: ${actualCount}`,
        logs: [
          `Counted ${actualCount} matching DOM nodes (category="${vdom.selectedCategory}").`,
        ],
        domSnippet: `<tbody data-rows="${actualCount}">${filteredRows.map((r) => `<tr data-testid="inventory-row">${r.name}</tr>`).join('')}</tbody>`,
      };
    }

    case 'assert.attribute': {
      const attr = String(p.attributeName || 'aria-pressed');
      const expected = String(p.expectedValue ?? 'true');
      const actual = attr === 'aria-pressed' ? String(vdom.approvalPressed) : expected;
      const passed = actual === expected;
      return {
        passed,
        durationMs: 115,
        codeLine: `await expect(${locStr}).toHaveAttribute('${attr}', '${expected}');`,
        locatorResolved: locStr,
        actualValue: `${attr}="${actual}"`,
        expectedValue: `${attr}="${expected}"`,
        errorMessage: passed
          ? undefined
          : `Attribute "${attr}" had value "${actual}" instead of "${expected}".`,
        logs: [`Verified attribute ${attr}="${actual}" on ${locStr}.`],
        domSnippet: `<button data-testid="approval-toggle-btn" ${attr}="${actual}">Supervisor Approval</button>`,
      };
    }

    case 'logic.subflow': {
      const slug = String(p.sopSlug || 'enterprise-sso-login');
      const sop = sopModules.find((m) => m.slug === slug);
      return {
        passed: true,
        durationMs: 340,
        codeLine: `await runSop_${slug.replace(/-/g, '_')}(page, ${p.sopArgsJson || '{}'});`,
        locatorResolved: `SOP Module: ${sop ? sop.name : slug} (v${sop?.version || '1.0.0'})`,
        actualValue: `Executed ${sop ? sop.steps.length : 3} encapsulated SOP steps`,
        expectedValue: 'SOP Module Success',
        logs: [
          `Invoked shared SOP module "${slug}" without code duplication.`,
          `All internal SOP preconditions and locators succeeded.`,
        ],
        domSnippet: `<header data-testid="authenticated-user">${vdom.authenticatedUser} · ${vdom.userRole}</header>`,
      };
    }

    case 'logic.setVariable': {
      const varName = String(p.variableName || 'capturedOrderCode');
      runtimeVariables[varName] = vdom.latestOrderId;
      return {
        passed: true,
        durationMs: 95,
        codeLine: `const ${varName} = (await ${formatPlaywrightLocator(String(p.sourceValue || ''))}.textContent())?.trim() ?? '';`,
        locatorResolved: formatPlaywrightLocator(String(p.sourceValue || '')),
        actualValue: `${varName} = "${vdom.latestOrderId}"`,
        expectedValue: 'Non-empty string',
        logs: [`Extracted "${vdom.latestOrderId}" into workflow variable {{${varName}}}.`],
        domSnippet: `<code data-testid="latest-order-id">${vdom.latestOrderId}</code>`,
      };
    }

    default: {
      return {
        passed: true,
        durationMs: 130,
        codeLine: `// ${schema?.name || step.actionId}: ${step.label}`,
        locatorResolved: locStr,
        actualValue: 'Verified OK',
        expectedValue: 'Verified OK',
        logs: [`Executed ${schema?.name || step.actionId} successfully.`],
        domSnippet: `<div data-testid="dashboard-welcome-banner">Acme Cloud Portal Ready</div>`,
      };
    }
  }
}
