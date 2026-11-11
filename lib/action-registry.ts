import {
  ActionRegistryEntry,
  CodeGenerationResult,
  ExecutionRun,
  RoleType,
  SOPModule,
  TestCase,
  ValidationIssue,
  WorkerNode,
  WorkflowStep,
} from './types';

export const PLAYWRIGHT_ACTION_REGISTRY: ActionRegistryEntry[] = [
  // ==================== 1. NAVIGATION & BROWSER ====================
  {
    id: 'nav.goto',
    version: '1.2.0',
    name: 'Navigate to URL',
    category: 'navigation',
    description:
      'Navigates the active browser page to a target URL or relative path and waits for the initial document load.',
    parameters: [
      {
        name: 'url',
        label: 'Target URL or Path',
        type: 'string',
        required: true,
        defaultValue: '/sample-app',
        placeholder: 'https://portal.acme.internal/login or /sample-app',
        description: 'Full URL or path relative to the environment baseURL.',
        example: '/sample-app',
      },
      {
        name: 'waitUntil',
        label: 'Wait Until Event',
        type: 'select',
        required: false,
        defaultValue: 'domcontentloaded',
        options: [
          {label: 'DOM Content Loaded (Fastest & Reliable)', value: 'domcontentloaded'},
          {label: 'Load (All resources)', value: 'load'},
          {label: 'Commit (Response received)', value: 'commit'},
        ],
        description: 'Lifecycle event to await before proceeding.',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'fail_fast',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'nav.reload',
    version: '1.0.0',
    name: 'Reload Page',
    category: 'navigation',
    description: 'Reloads the current page and waits for navigation state.',
    parameters: [
      {
        name: 'waitUntil',
        label: 'Wait Until',
        type: 'select',
        required: false,
        defaultValue: 'domcontentloaded',
        options: [
          {label: 'DOM Content Loaded', value: 'domcontentloaded'},
          {label: 'Full Load', value: 'load'},
        ],
        description: 'Navigation completion state.',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'fail_fast',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'nav.backForward',
    version: '1.0.0',
    name: 'Go Back or Forward',
    category: 'navigation',
    description: 'Navigates backward or forward in the browser session history.',
    parameters: [
      {
        name: 'direction',
        label: 'History Direction',
        type: 'select',
        required: true,
        defaultValue: 'back',
        options: [
          {label: 'Go Back', value: 'back'},
          {label: 'Go Forward', value: 'forward'},
        ],
        description: 'Direction in history stack.',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'fail_fast',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'nav.tab',
    version: '1.1.0',
    name: 'Open or Switch Browser Tab',
    category: 'navigation',
    description: 'Opens a new browser tab or switches active page context.',
    parameters: [
      {
        name: 'operation',
        label: 'Tab Operation',
        type: 'select',
        required: true,
        defaultValue: 'newTab',
        options: [
          {label: 'Open New Tab', value: 'newTab'},
          {label: 'Switch Tab by Index', value: 'switchTab'},
          {label: 'Close Current Tab', value: 'closeTab'},
        ],
        description: 'Action to perform on browser context pages.',
      },
      {
        name: 'tabIndex',
        label: 'Target Tab Index',
        type: 'number',
        required: false,
        defaultValue: 0,
        description: 'Zero-based index when switching tabs.',
      },
    ],
    supportedContexts: ['browserContext'],
    errorBehavior: 'fail_fast',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'nav.viewport',
    version: '1.0.0',
    name: 'Configure Viewport',
    category: 'navigation',
    description: 'Resizes the browser viewport for responsive layout verification.',
    parameters: [
      {
        name: 'width',
        label: 'Viewport Width (px)',
        type: 'number',
        required: true,
        defaultValue: 1440,
        description: 'Width in CSS pixels.',
      },
      {
        name: 'height',
        label: 'Viewport Height (px)',
        type: 'number',
        required: true,
        defaultValue: 900,
        description: 'Height in CSS pixels.',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'fail_fast',
    dependencies: ['@playwright/test'],
  },

  // ==================== 2. ELEMENT INTERACTIONS ====================
  {
    id: 'act.click',
    version: '1.3.0',
    name: 'Click Element',
    category: 'interaction',
    description:
      'Auto-waits for target element to be visible, enabled, and stable, then performs a pointer click.',
    parameters: [
      {
        name: 'locator',
        label: 'Element Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=login-submit-btn',
        placeholder: 'testid=submit-btn or role=button[name="Sign In"]',
        description: 'Playwright semantic locator or CSS selector.',
        example: 'role=button[name="Sign In"]',
      },
      {
        name: 'clickType',
        label: 'Click Variant',
        type: 'select',
        required: false,
        defaultValue: 'single',
        options: [
          {label: 'Single Click', value: 'single'},
          {label: 'Double Click', value: 'double'},
          {label: 'Right Click (Context)', value: 'right'},
        ],
        description: 'Pointer click behavior.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'act.fill',
    version: '1.3.0',
    name: 'Fill Input Field',
    category: 'interaction',
    description:
      'Clears existing input value and fills the target field with text, variables, or vault secrets.',
    parameters: [
      {
        name: 'locator',
        label: 'Input Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=login-email-input',
        placeholder: 'label=Email Address or testid=email-input',
        description: 'Target input or textarea locator.',
        example: 'testid=login-email-input',
      },
      {
        name: 'value',
        label: 'Input Value',
        type: 'string',
        required: true,
        defaultValue: 'qa.lead@acme.io',
        placeholder: 'Text, {{variable}}, or {{SECRET:QA_PASSWORD}}',
        description: 'Value to enter. Use {{SECRET:KEY}} for encrypted credentials.',
        example: 'qa.lead@acme.io',
      },
      {
        name: 'clearFirst',
        label: 'Clear Before Typing',
        type: 'boolean',
        required: false,
        defaultValue: true,
        description: 'Ensures input is emptied prior to filling.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'act.press',
    version: '1.1.0',
    name: 'Press Keyboard Key',
    category: 'interaction',
    description: 'Dispatches a keyboard key press such as Enter, Escape, Tab, or shortcut chords.',
    parameters: [
      {
        name: 'locator',
        label: 'Target Element Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=inventory-search-input',
        description: 'Element to focus before pressing key.',
      },
      {
        name: 'key',
        label: 'Key / Shortcut',
        type: 'string',
        required: true,
        defaultValue: 'Enter',
        placeholder: 'Enter, Escape, Tab, Control+A',
        description: 'Playwright key identifier.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'act.selectOption',
    version: '1.1.0',
    name: 'Select Dropdown Option',
    category: 'interaction',
    description: 'Selects an option in a native <select> element by value or visible label.',
    parameters: [
      {
        name: 'locator',
        label: 'Select Element Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=category-filter-select',
        description: 'Target <select> element.',
      },
      {
        name: 'optionValue',
        label: 'Option Value or Label',
        type: 'string',
        required: true,
        defaultValue: 'Hardware',
        description: 'Value attribute or visible text of the option.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'act.check',
    version: '1.1.0',
    name: 'Check or Uncheck Toggle',
    category: 'interaction',
    description: 'Sets a checkbox or radio input to checked or unchecked state.',
    parameters: [
      {
        name: 'locator',
        label: 'Checkbox Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=expedited-shipping-checkbox',
        description: 'Target checkbox or switch.',
      },
      {
        name: 'checked',
        label: 'Desired Checked State',
        type: 'boolean',
        required: true,
        defaultValue: true,
        description: 'True to check(), false to uncheck().',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'act.hover',
    version: '1.0.0',
    name: 'Hover Over Element',
    category: 'interaction',
    description: 'Moves the virtual pointer over the target element to trigger hover menus or tooltips.',
    parameters: [
      {
        name: 'locator',
        label: 'Element Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=user-profile-menu',
        description: 'Element to hover.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'act.dragAndDrop',
    version: '1.0.0',
    name: 'Drag and Drop',
    category: 'interaction',
    description: 'Drags a source element and drops it onto a target destination locator.',
    parameters: [
      {
        name: 'sourceLocator',
        label: 'Source Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=kanban-card-1',
        description: 'Element to drag.',
      },
      {
        name: 'targetLocator',
        label: 'Target Dropzone Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=kanban-column-approved',
        description: 'Destination element.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'act.uploadFile',
    version: '1.0.0',
    name: 'Upload File',
    category: 'interaction',
    description: 'Attaches one or more test fixture files to a file input control.',
    parameters: [
      {
        name: 'locator',
        label: 'File Input Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=invoice-upload-input',
        description: 'Target input[type="file"].',
      },
      {
        name: 'filePath',
        label: 'Fixture File Path',
        type: 'string',
        required: true,
        defaultValue: 'fixtures/sample-invoice.pdf',
        description: 'Relative path inside project test fixtures.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'act.scroll',
    version: '1.0.0',
    name: 'Scroll Element Into View',
    category: 'interaction',
    description: 'Scrolls the page until the specified locator is visible in the viewport.',
    parameters: [
      {
        name: 'locator',
        label: 'Target Element Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=audit-summary-footer',
        description: 'Element to scroll into view.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'act.dialog',
    version: '1.0.0',
    name: 'Handle Browser Dialog',
    category: 'interaction',
    description: 'Registers a listener to automatically accept or dismiss native alert/confirm/prompt dialogs.',
    parameters: [
      {
        name: 'decision',
        label: 'Dialog Action',
        type: 'select',
        required: true,
        defaultValue: 'accept',
        options: [
          {label: 'Accept Dialog', value: 'accept'},
          {label: 'Dismiss / Cancel Dialog', value: 'dismiss'},
        ],
        description: 'How to resolve the native dialog.',
      },
      {
        name: 'promptText',
        label: 'Optional Prompt Input',
        type: 'string',
        required: false,
        defaultValue: '',
        description: 'Text to pass when accepting a prompt dialog.',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'fail_fast',
    dependencies: ['@playwright/test'],
  },

  // ==================== 3. ASSERTIONS ====================
  {
    id: 'assert.visible',
    version: '1.2.0',
    name: 'Assert Element Visibility',
    category: 'assertion',
    description:
      'Uses Playwright web-first assertion expect(locator).toBeVisible() or toBeHidden().',
    parameters: [
      {
        name: 'locator',
        label: 'Element Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=dashboard-welcome-banner',
        description: 'Element to verify.',
      },
      {
        name: 'shouldBeVisible',
        label: 'Expected Visibility',
        type: 'boolean',
        required: true,
        defaultValue: true,
        description: 'True for toBeVisible(), false for toBeHidden().',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'assert.text',
    version: '1.2.0',
    name: 'Assert Text Content',
    category: 'assertion',
    description:
      'Asserts that an element contains or exactly matches the expected text using web-first auto-retrying assertions.',
    parameters: [
      {
        name: 'locator',
        label: 'Element Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=order-status-badge',
        description: 'Element containing text.',
      },
      {
        name: 'expectedText',
        label: 'Expected Text',
        type: 'string',
        required: true,
        defaultValue: 'Approved & Dispatched',
        description: 'Expected substring or exact match.',
      },
      {
        name: 'matchMode',
        label: 'Comparison Mode',
        type: 'select',
        required: false,
        defaultValue: 'contains',
        options: [
          {label: 'Contains Text (toContainText)', value: 'contains'},
          {label: 'Exact Match (toHaveText)', value: 'exact'},
        ],
        description: 'Substring vs exact text assertion.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'assert.value',
    version: '1.1.0',
    name: 'Assert Input Value',
    category: 'assertion',
    description: 'Verifies the current value of an input, textarea, or select element.',
    parameters: [
      {
        name: 'locator',
        label: 'Input Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=quantity-input',
        description: 'Form control locator.',
      },
      {
        name: 'expectedValue',
        label: 'Expected Value',
        type: 'string',
        required: true,
        defaultValue: '5',
        description: 'Expected string value.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'assert.url',
    version: '1.1.0',
    name: 'Assert Page URL & Title',
    category: 'assertion',
    description: 'Verifies that the current browser URL or document title matches expected criteria.',
    parameters: [
      {
        name: 'targetProperty',
        label: 'Target Property',
        type: 'select',
        required: true,
        defaultValue: 'url',
        options: [
          {label: 'Page URL (toHaveURL)', value: 'url'},
          {label: 'Document Title (toHaveTitle)', value: 'title'},
        ],
        description: 'Whether to assert URL or Title.',
      },
      {
        name: 'expectedPattern',
        label: 'Expected Substring or Value',
        type: 'string',
        required: true,
        defaultValue: '/sample-app',
        description: 'Substring or exact URL/Title.',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'assert.attribute',
    version: '1.0.0',
    name: 'Assert Element Attribute',
    category: 'assertion',
    description: 'Asserts that an element possesses a specific DOM attribute value (e.g. aria-expanded, href, data-state).',
    parameters: [
      {
        name: 'locator',
        label: 'Element Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=approval-toggle-btn',
        description: 'Target element.',
      },
      {
        name: 'attributeName',
        label: 'Attribute Name',
        type: 'string',
        required: true,
        defaultValue: 'aria-pressed',
        description: 'DOM attribute name.',
      },
      {
        name: 'expectedValue',
        label: 'Expected Attribute Value',
        type: 'string',
        required: true,
        defaultValue: 'true',
        description: 'Expected attribute value.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'assert.count',
    version: '1.0.0',
    name: 'Assert Element Count',
    category: 'assertion',
    description: 'Verifies the exact number of DOM elements matching the locator.',
    parameters: [
      {
        name: 'locator',
        label: 'Collection Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=inventory-row',
        description: 'Locator matching multiple items.',
      },
      {
        name: 'expectedCount',
        label: 'Expected Count',
        type: 'number',
        required: true,
        defaultValue: 4,
        description: 'Exact number of matching nodes.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'assert.enabled',
    version: '1.0.0',
    name: 'Assert Enabled or Disabled State',
    category: 'assertion',
    description: 'Asserts whether a button or input control is enabled or disabled.',
    parameters: [
      {
        name: 'locator',
        label: 'Control Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=create-order-submit',
        description: 'Button or input locator.',
      },
      {
        name: 'shouldBeEnabled',
        label: 'Expected Enabled State',
        type: 'boolean',
        required: true,
        defaultValue: true,
        description: 'True for toBeEnabled(), false for toBeDisabled().',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'assert.screenshot',
    version: '1.0.0',
    name: 'Visual Screenshot Comparison',
    category: 'assertion',
    description: 'Compares the current page or locator visual appearance against a baseline snapshot using toHaveScreenshot().',
    parameters: [
      {
        name: 'snapshotName',
        label: 'Baseline Snapshot Name',
        type: 'string',
        required: true,
        defaultValue: 'portal-inventory-baseline.png',
        description: 'Filename for baseline image comparison.',
      },
      {
        name: 'maxDiffPixelRatio',
        label: 'Max Diff Pixel Ratio',
        type: 'number',
        required: false,
        defaultValue: 0.02,
        description: 'Allowed threshold between 0 and 1.',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'soft_assert',
    dependencies: ['@playwright/test'],
  },

  // ==================== 4. SYNCHRONIZATION ====================
  {
    id: 'sync.waitForUrl',
    version: '1.1.0',
    name: 'Wait for URL Change',
    category: 'synchronization',
    description: 'Waits until the page navigates to a URL matching the specified substring or glob.',
    parameters: [
      {
        name: 'urlPattern',
        label: 'Expected URL Pattern',
        type: 'string',
        required: true,
        defaultValue: '**/sample-app*',
        description: 'Glob or substring to wait for.',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'sync.waitForSelector',
    version: '1.1.0',
    name: 'Wait for Element State',
    category: 'synchronization',
    description: 'Waits for a locator to reach attached, visible, hidden, or detached state.',
    parameters: [
      {
        name: 'locator',
        label: 'Element Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=loading-spinner',
        description: 'Target element.',
      },
      {
        name: 'state',
        label: 'Target Lifecycle State',
        type: 'select',
        required: true,
        defaultValue: 'hidden',
        options: [
          {label: 'Visible', value: 'visible'},
          {label: 'Hidden', value: 'hidden'},
          {label: 'Attached to DOM', value: 'attached'},
          {label: 'Detached from DOM', value: 'detached'},
        ],
        description: 'Element state to await.',
      },
    ],
    supportedContexts: ['page', 'frame'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'sync.waitForResponse',
    version: '1.1.0',
    name: 'Wait for Network Response',
    category: 'synchronization',
    description: 'Synchronizes test execution with an HTTP API response matching URL and status code.',
    parameters: [
      {
        name: 'urlSubstring',
        label: 'API Endpoint Substring',
        type: 'string',
        required: true,
        defaultValue: '/api/platform',
        description: 'URL path or substring to match.',
      },
      {
        name: 'expectedStatus',
        label: 'Expected HTTP Status',
        type: 'number',
        required: true,
        defaultValue: 200,
        description: 'HTTP status code (e.g. 200, 201).',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'retry_auto_wait',
    dependencies: ['@playwright/test'],
  },

  // ==================== 5. WORKFLOW LOGIC ====================
  {
    id: 'logic.setVariable',
    version: '1.1.0',
    name: 'Extract or Set Variable',
    category: 'logic',
    description: 'Extracts text from a locator or assigns an expression into a workflow variable for subsequent steps.',
    parameters: [
      {
        name: 'variableName',
        label: 'Variable Name',
        type: 'string',
        required: true,
        defaultValue: 'capturedOrderCode',
        description: 'Identifier to reference later via {{variableName}}.',
      },
      {
        name: 'sourceType',
        label: 'Value Source',
        type: 'select',
        required: true,
        defaultValue: 'locatorText',
        options: [
          {label: 'Extract Element textContent()', value: 'locatorText'},
          {label: 'Static / Computed Expression', value: 'literal'},
        ],
        description: 'How to populate the variable.',
      },
      {
        name: 'sourceValue',
        label: 'Locator or Expression',
        type: 'string',
        required: true,
        defaultValue: 'testid=latest-order-id',
        description: 'Locator when extracting text, or literal string value.',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'fail_fast',
    dependencies: ['@playwright/test'],
    outputVariableSupported: true,
  },
  {
    id: 'logic.ifBranch',
    version: '1.0.0',
    name: 'Conditional Branch (If Visible)',
    category: 'logic',
    description: 'Evaluates whether a locator is visible and conditionally executes child actions.',
    parameters: [
      {
        name: 'conditionLocator',
        label: 'Condition Element Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=mfa-challenge-banner',
        description: 'Element whose visibility controls the branch.',
      },
      {
        name: 'thenActionLocator',
        label: 'Then Click Locator',
        type: 'locator',
        required: true,
        defaultValue: 'testid=acknowledge-banner-btn',
        description: 'Element to click when condition is met.',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'soft_assert',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'logic.subflow',
    version: '1.2.0',
    name: 'Reusable SOP Module Call',
    category: 'logic',
    description:
      'Invokes a versioned Standard Operating Procedure (SOP) module via clean TypeScript import without duplicating underlying code.',
    parameters: [
      {
        name: 'sopSlug',
        label: 'SOP Module Identifier',
        type: 'string',
        required: true,
        defaultValue: 'enterprise-sso-login',
        description: 'Slug of the registered SOP module.',
      },
      {
        name: 'sopArgsJson',
        label: 'Module Input Arguments (JSON)',
        type: 'json',
        required: false,
        defaultValue: '{"username":"qa.lead@acme.io","role":"Supervisor"}',
        description: 'JSON key-value arguments passed to the SOP function.',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'fail_fast',
    dependencies: ['@playwright/test'],
  },

  // ==================== 6. ADVANCED ACTIONS ====================
  {
    id: 'adv.apiRequest',
    version: '1.1.0',
    name: 'Execute API Request',
    category: 'advanced',
    description: 'Uses Playwright request fixture to perform a direct HTTP API call for test setup or backend verification.',
    parameters: [
      {
        name: 'method',
        label: 'HTTP Method',
        type: 'select',
        required: true,
        defaultValue: 'GET',
        options: [
          {label: 'GET', value: 'GET'},
          {label: 'POST', value: 'POST'},
          {label: 'PUT', value: 'PUT'},
          {label: 'DELETE', value: 'DELETE'},
        ],
        description: 'HTTP verb.',
      },
      {
        name: 'endpoint',
        label: 'Endpoint URL',
        type: 'string',
        required: true,
        defaultValue: '/api/platform',
        description: 'API endpoint path or full URL.',
      },
      {
        name: 'expectedStatus',
        label: 'Assert Status Code',
        type: 'number',
        required: true,
        defaultValue: 200,
        description: 'Expected response status code.',
      },
    ],
    supportedContexts: ['apiRequest'],
    errorBehavior: 'fail_fast',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'adv.networkIntercept',
    version: '1.0.0',
    name: 'Intercept / Mock Network Route',
    category: 'advanced',
    description: 'Registers page.route() to mock or inspect matching outbound network requests.',
    parameters: [
      {
        name: 'urlGlob',
        label: 'Route Glob Pattern',
        type: 'string',
        required: true,
        defaultValue: '**/api/inventory/**',
        description: 'URL pattern to intercept.',
      },
      {
        name: 'statusCode',
        label: 'Mock HTTP Status',
        type: 'number',
        required: true,
        defaultValue: 200,
        description: 'Response status code to fulfill.',
      },
      {
        name: 'responseJson',
        label: 'Mock JSON Payload',
        type: 'json',
        required: true,
        defaultValue: '{"status":"mocked_ok","items":4}',
        description: 'JSON body returned by route.fulfill().',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'fail_fast',
    dependencies: ['@playwright/test'],
  },
  {
    id: 'adv.captureScreenshot',
    version: '1.0.0',
    name: 'Capture Evidence Screenshot',
    category: 'advanced',
    description: 'Captures a full-page or viewport screenshot and attaches it to the Playwright test report.',
    parameters: [
      {
        name: 'artifactName',
        label: 'Screenshot Artifact Name',
        type: 'string',
        required: true,
        defaultValue: 'step-verification-capture.png',
        description: 'Artifact filename.',
      },
      {
        name: 'fullPage',
        label: 'Capture Full Scrollable Page',
        type: 'boolean',
        required: false,
        defaultValue: true,
        description: 'Whether to capture full page height.',
      },
    ],
    supportedContexts: ['page'],
    errorBehavior: 'soft_assert',
    dependencies: ['@playwright/test'],
  },
];

export function getActionRegistryEntry(
  actionId: string
): ActionRegistryEntry | undefined {
  return PLAYWRIGHT_ACTION_REGISTRY.find((entry) => entry.id === actionId);
}

/**
 * Formats a user-entered locator expression into idiomatic Playwright TypeScript code.
 */
export function formatPlaywrightLocator(rawLocator: string): string {
  const trimmed = (rawLocator || '').trim();
  if (!trimmed) {
    return "page.locator('body')";
  }
  if (trimmed.startsWith('testid=')) {
    const idVal = trimmed.slice('testid='.length).trim();
    return `page.getByTestId('${escapeSingleQuotes(idVal)}')`;
  }
  if (trimmed.startsWith('label=')) {
    const labelVal = trimmed.slice('label='.length).trim();
    return `page.getByLabel('${escapeSingleQuotes(labelVal)}')`;
  }
  if (trimmed.startsWith('placeholder=')) {
    const phVal = trimmed.slice('placeholder='.length).trim();
    return `page.getByPlaceholder('${escapeSingleQuotes(phVal)}')`;
  }
  if (trimmed.startsWith('text=')) {
    const txtVal = trimmed.slice('text='.length).trim();
    return `page.getByText('${escapeSingleQuotes(txtVal)}')`;
  }
  const roleMatch = trimmed.match(/^role=([a-zA-Z]+)(?:\[name=["'](.+)["']\])?$/);
  if (roleMatch) {
    const roleName = roleMatch[1];
    const accessibleName = roleMatch[2];
    if (accessibleName) {
      return `page.getByRole('${escapeSingleQuotes(roleName)}', { name: '${escapeSingleQuotes(accessibleName)}' })`;
    }
    return `page.getByRole('${escapeSingleQuotes(roleName)}')`;
  }
  return `page.locator('${escapeSingleQuotes(trimmed)}')`;
}

function escapeSingleQuotes(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Resolves {{SECRET:KEY}} and {{variable}} expressions into safe TypeScript code expressions
 * so secrets are never embedded in plaintext inside generated scripts.
 */
export function formatValueExpression(
  rawValue: string,
  referencedSecrets: Set<string>
): string {
  const str = String(rawValue ?? '');
  const secretMatch = str.match(/^\{\{SECRET:([A-Z0-9_]+)\}\}$/);
  if (secretMatch) {
    const secretKey = secretMatch[1];
    referencedSecrets.add(secretKey);
    return `(process.env.SECRET_${secretKey} ?? '')`;
  }
  const varMatch = str.match(/^\{\{([a-zA-Z0-9_]+)\}\}$/);
  if (varMatch) {
    return `String(${varMatch[1]})`;
  }
  if (str.includes('{{')) {
    const templateReplaced = str
      .replace(/\{\{SECRET:([A-Z0-9_]+)\}\}/g, (_, key) => {
        referencedSecrets.add(key);
        return `\${process.env.SECRET_${key} ?? ''}`;
      })
      .replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, varName) => `\${${varName}}`);
    return `\`${templateReplaced}\``;
  }
  return `'${escapeSingleQuotes(str)}'`;
}

/**
 * Validates a visual workflow definition against the Playwright Action Registry and SOP library.
 */
export function validateWorkflow(
  steps: WorkflowStep[],
  sopModules: SOPModule[] = []
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!steps || steps.length === 0) {
    issues.push({
      severity: 'error',
      message: 'Workflow must contain at least one automation step.',
    });
    return issues;
  }

  const enabledSteps = steps.filter((s) => s.enabled);
  if (enabledSteps.length === 0) {
    issues.push({
      severity: 'error',
      message: 'At least one step in the workflow must be enabled.',
    });
  }

  steps.forEach((step, idx) => {
    const schema = getActionRegistryEntry(step.actionId);
    if (!schema) {
      issues.push({
        stepId: step.id,
        stepIndex: idx,
        severity: 'error',
        message: `Unsupported action identifier "${step.actionId}". Register a custom action or choose a supported operation.`,
      });
      return;
    }

    for (const paramSchema of schema.parameters) {
      const val = step.parameters[paramSchema.name];
      if (
        paramSchema.required &&
        (val === undefined || val === null || String(val).trim() === '')
      ) {
        issues.push({
          stepId: step.id,
          stepIndex: idx,
          field: paramSchema.name,
          severity: 'error',
          message: `Step ${idx + 1} (${schema.name}): Required parameter "${paramSchema.label}" is missing.`,
        });
      }

      if (
        paramSchema.name === 'url' &&
        typeof val === 'string' &&
        val.trim() !== ''
      ) {
        const trimmedUrl = val.trim();
        const isRelative = trimmedUrl.startsWith('/');
        const isHttp =
          trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://');
        if (!isRelative && !isHttp && !trimmedUrl.startsWith('{{')) {
          issues.push({
            stepId: step.id,
            stepIndex: idx,
            field: 'url',
            severity: 'error',
            message: `Step ${idx + 1}: URL "${trimmedUrl}" must start with "/", "http://", or "https://".`,
          });
        }
      }

      if (paramSchema.type === 'json' && typeof val === 'string' && val.trim()) {
        try {
          JSON.parse(val);
        } catch {
          issues.push({
            stepId: step.id,
            stepIndex: idx,
            field: paramSchema.name,
            severity: 'error',
            message: `Step ${idx + 1}: Parameter "${paramSchema.label}" must be valid JSON.`,
          });
        }
      }

      // Security check: detect suspicious raw password literals not using {{SECRET:...}}
      if (
        typeof val === 'string' &&
        (String(step.parameters.locator || '')
          .toLowerCase()
          .includes('password') ||
          paramSchema.name.toLowerCase().includes('password')) &&
        !val.includes('{{SECRET:') &&
        val.length > 0
      ) {
        issues.push({
          stepId: step.id,
          stepIndex: idx,
          field: paramSchema.name,
          severity: 'warning',
          message: `Step ${idx + 1}: Plaintext credential detected in password field. Use {{SECRET:KEY_NAME}} to reference the encrypted secret vault.`,
        });
      }
    }

    if (step.actionId === 'logic.subflow') {
      const slug = String(step.parameters.sopSlug || '').trim();
      if (sopModules.length > 0 && slug) {
        const foundSop = sopModules.find((m) => m.slug === slug || m.id === step.sopModuleId);
        if (!foundSop) {
          issues.push({
            stepId: step.id,
            stepIndex: idx,
            field: 'sopSlug',
            severity: 'error',
            message: `Step ${idx + 1}: Referenced SOP Module "${slug}" was not found in the SOP Registry.`,
          });
        } else if (foundSop.validationStatus === 'deprecated') {
          issues.push({
            stepId: step.id,
            stepIndex: idx,
            field: 'sopSlug',
            severity: 'warning',
            message: `Step ${idx + 1}: SOP Module "${foundSop.name}" (v${foundSop.version}) is marked deprecated.`,
          });
        }
      }
    }

    if (step.timeoutMs !== undefined && (step.timeoutMs < 100 || step.timeoutMs > 120000)) {
      issues.push({
        stepId: step.id,
        stepIndex: idx,
        field: 'timeoutMs',
        severity: 'warning',
        message: `Step ${idx + 1}: Step timeout (${step.timeoutMs}ms) should be between 100ms and 120,000ms.`,
      });
    }
  });

  return issues;
}

/**
 * Generates maintainable, executable Playwright TypeScript code from a TestCase visual definition.
 */
export function generatePlaywrightCode(
  testCase: Pick<
    TestCase,
    'id' | 'code' | 'title' | 'steps' | 'tags' | 'dataDrivenRows' | 'version'
  >,
  sopModules: SOPModule[] = []
): CodeGenerationResult {
  const issues = validateWorkflow(testCase.steps, sopModules);
  const hasErrors = issues.some((i) => i.severity === 'error');
  const stepLineMap: Record<string, {startLine: number; endLine: number}> = {};
  const importedSopModules = new Set<string>();
  const referencedSecrets = new Set<string>();

  // Identify reusable SOP imports first
  for (const step of testCase.steps) {
    if (step.enabled && step.actionId === 'logic.subflow') {
      const slug = String(step.parameters.sopSlug || 'custom-sop').trim();
      if (slug) {
        importedSopModules.add(slug);
      }
    }
  }

  const lines: string[] = [];
  lines.push(`import { test, expect } from '@playwright/test';`);

  // Emit clean versioned SOP module imports instead of duplicating code
  for (const sopSlug of importedSopModules) {
    const fnName = toCamelCaseSopFunction(sopSlug);
    const sopMod = sopModules.find((m) => m.slug === sopSlug);
    const verComment = sopMod ? ` // v${sopMod.version} (${sopMod.repoReference})` : '';
    lines.push(
      `import { ${fnName} } from '../sop-modules/${sopSlug}';${verComment}`
    );
  }

  lines.push('');
  const tagAnnotation =
    testCase.tags && testCase.tags.length > 0
      ? ` ${testCase.tags.map((t) => (t.startsWith('@') ? t : `@${t}`)).join(' ')}`
      : '';

  if (testCase.dataDrivenRows && testCase.dataDrivenRows.length > 0) {
    const jsonLines = JSON.stringify(testCase.dataDrivenRows, null, 2).split(
      '\n'
    );
    lines.push(`const testDataRows = ${jsonLines[0]}`);
    for (let j = 1; j < jsonLines.length; j++) {
      lines.push(
        j === jsonLines.length - 1 ? `${jsonLines[j]};` : jsonLines[j]
      );
    }
    lines.push('');
  }

  lines.push(
    `test.describe('${escapeSingleQuotes(testCase.code)} - ${escapeSingleQuotes(testCase.title)} (v${testCase.version})', () => {`
  );

  const needsApiRequest = testCase.steps.some(
    (s) => s.enabled && s.actionId === 'adv.apiRequest'
  );
  const fixtures = needsApiRequest ? '{ page, context, request }' : '{ page, context }';

  lines.push(
    `  test('${escapeSingleQuotes(testCase.title)}${escapeSingleQuotes(tagAnnotation)}', async (${fixtures}) => {`
  );

  for (let i = 0; i < testCase.steps.length; i++) {
    const step = testCase.steps[i];
    const startLine = lines.length + 1;

    if (!step.enabled) {
      lines.push(
        `    // [Step ${i + 1}: id=${step.id}] (Disabled) ${step.label}`
      );
      stepLineMap[step.id] = {startLine, endLine: lines.length};
      continue;
    }

    lines.push(`    // [Step ${i + 1}: id=${step.id}] ${step.label}`);
    const stepCodeLines = generateStepCodeLines(
      step,
      referencedSecrets
    );
    for (const codeLine of stepCodeLines) {
      lines.push(`    ${codeLine}`);
    }
    const endLine = lines.length;
    stepLineMap[step.id] = {startLine, endLine};
    lines.push('');
  }

  lines.push(`  });`);
  lines.push(`});`);

  return {
    code: lines.join('\n'),
    valid: !hasErrors,
    issues,
    stepLineMap,
    importedSopModules: Array.from(importedSopModules),
    referencedSecrets: Array.from(referencedSecrets),
  };
}

function toCamelCaseSopFunction(slug: string): string {
  const cleaned = slug
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .split(/[-_]/)
    .filter(Boolean);
  if (cleaned.length === 0) return 'runSopModule';
  return (
    'runSop_' +
    cleaned
      .map((part, idx) =>
        idx === 0
          ? part.toLowerCase()
          : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      )
      .join('')
  );
}

function generateStepCodeLines(
  step: WorkflowStep,
  referencedSecrets: Set<string>
): string[] {
  const p = step.parameters;
  const timeoutOpt =
    step.timeoutMs && step.timeoutMs !== 5000
      ? `, { timeout: ${Number(step.timeoutMs)} }`
      : '';

  switch (step.actionId) {
    case 'nav.goto': {
      const urlExpr = formatValueExpression(String(p.url || '/'), referencedSecrets);
      const waitUntil = String(p.waitUntil || 'domcontentloaded');
      return [
        `await page.goto(${urlExpr}, { waitUntil: '${escapeSingleQuotes(waitUntil)}' });`,
      ];
    }
    case 'nav.reload': {
      const waitUntil = String(p.waitUntil || 'domcontentloaded');
      return [
        `await page.reload({ waitUntil: '${escapeSingleQuotes(waitUntil)}' });`,
      ];
    }
    case 'nav.backForward': {
      return p.direction === 'forward'
        ? [`await page.goForward();`]
        : [`await page.goBack();`];
    }
    case 'nav.tab': {
      if (p.operation === 'closeTab') {
        return [`await page.close();`];
      }
      if (p.operation === 'switchTab') {
        const idx = Number(p.tabIndex || 0);
        return [
          `const pages = context.pages();`,
          `await pages[${idx}].bringToFront();`,
        ];
      }
      return [`const newTab = await context.newPage();`, `await newTab.bringToFront();`];
    }
    case 'nav.viewport': {
      const width = Number(p.width || 1440);
      const height = Number(p.height || 900);
      return [`await page.setViewportSize({ width: ${width}, height: ${height} });`];
    }
    case 'act.click': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      if (p.clickType === 'double') {
        return [`await ${loc}.dblclick();`];
      }
      if (p.clickType === 'right') {
        return [`await ${loc}.click({ button: 'right' });`];
      }
      return [`await ${loc}.click();`];
    }
    case 'act.fill': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      const valExpr = formatValueExpression(String(p.value ?? ''), referencedSecrets);
      const out: string[] = [];
      if (p.clearFirst) {
        out.push(`await ${loc}.clear();`);
      }
      out.push(`await ${loc}.fill(${valExpr});`);
      return out;
    }
    case 'act.press': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      const key = escapeSingleQuotes(String(p.key || 'Enter'));
      return [`await ${loc}.press('${key}');`];
    }
    case 'act.selectOption': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      const opt = formatValueExpression(String(p.optionValue || ''), referencedSecrets);
      return [`await ${loc}.selectOption(${opt});`];
    }
    case 'act.check': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      return p.checked === false
        ? [`await ${loc}.uncheck();`]
        : [`await ${loc}.check();`];
    }
    case 'act.hover': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      return [`await ${loc}.hover();`];
    }
    case 'act.dragAndDrop': {
      const src = formatPlaywrightLocator(String(p.sourceLocator || ''));
      const dst = formatPlaywrightLocator(String(p.targetLocator || ''));
      return [`await ${src}.dragTo(${dst});`];
    }
    case 'act.uploadFile': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      const file = escapeSingleQuotes(String(p.filePath || 'fixtures/sample.pdf'));
      return [`await ${loc}.setInputFiles('${file}');`];
    }
    case 'act.scroll': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      return [`await ${loc}.scrollIntoViewIfNeeded();`];
    }
    case 'act.dialog': {
      const decision = p.decision === 'dismiss' ? 'dismiss' : 'accept';
      const promptText = String(p.promptText || '');
      if (decision === 'accept' && promptText) {
        return [
          `page.once('dialog', (dialog) => dialog.accept('${escapeSingleQuotes(promptText)}'));`,
        ];
      }
      return [`page.once('dialog', (dialog) => dialog.${decision}());`];
    }
    case 'assert.visible': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      return p.shouldBeEnabled === false || p.shouldBeVisible === false
        ? [`await expect(${loc}).toBeHidden(${timeoutOpt.slice(2)});`]
        : [`await expect(${loc}).toBeVisible(${timeoutOpt.slice(2)});`];
    }
    case 'assert.text': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      const textExpr = formatValueExpression(
        String(p.expectedText ?? ''),
        referencedSecrets
      );
      const matcher = p.matchMode === 'exact' ? 'toHaveText' : 'toContainText';
      return [`await expect(${loc}).${matcher}(${textExpr}${timeoutOpt});`];
    }
    case 'assert.value': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      const valExpr = formatValueExpression(
        String(p.expectedValue ?? ''),
        referencedSecrets
      );
      return [`await expect(${loc}).toHaveValue(${valExpr}${timeoutOpt});`];
    }
    case 'assert.url': {
      const expected = escapeSingleQuotes(String(p.expectedPattern || ''));
      if (p.targetProperty === 'title') {
        return [`await expect(page).toHaveTitle(new RegExp('${expected}'));`];
      }
      return [`await expect(page).toHaveURL(new RegExp('${expected}'));`];
    }
    case 'assert.attribute': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      const attr = escapeSingleQuotes(String(p.attributeName || 'data-state'));
      const val = formatValueExpression(
        String(p.expectedValue ?? ''),
        referencedSecrets
      );
      return [`await expect(${loc}).toHaveAttribute('${attr}', ${val});`];
    }
    case 'assert.count': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      const count = Number(p.expectedCount ?? 1);
      return [`await expect(${loc}).toHaveCount(${count});`];
    }
    case 'assert.enabled': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      return p.shouldBeEnabled === false
        ? [`await expect(${loc}).toBeDisabled();`]
        : [`await expect(${loc}).toBeEnabled();`];
    }
    case 'assert.screenshot': {
      const snap = escapeSingleQuotes(
        String(p.snapshotName || 'baseline-snapshot.png')
      );
      const ratio = Number(p.maxDiffPixelRatio ?? 0.02);
      return [
        `await expect(page).toHaveScreenshot('${snap}', { maxDiffPixelRatio: ${ratio} });`,
      ];
    }
    case 'sync.waitForUrl': {
      const pat = escapeSingleQuotes(String(p.urlPattern || '**/'));
      return [`await page.waitForURL('${pat}');`];
    }
    case 'sync.waitForSelector': {
      const loc = formatPlaywrightLocator(String(p.locator || ''));
      const state = escapeSingleQuotes(String(p.state || 'visible'));
      return [`await ${loc}.waitFor({ state: '${state}' });`];
    }
    case 'sync.waitForResponse': {
      const sub = escapeSingleQuotes(String(p.urlSubstring || '/api/'));
      const status = Number(p.expectedStatus || 200);
      return [
        `await page.waitForResponse((res) => res.url().includes('${sub}') && res.status() === ${status});`,
      ];
    }
    case 'logic.setVariable': {
      const varName = String(p.variableName || 'extractedValue').replace(
        /[^a-zA-Z0-9_]/g,
        ''
      );
      if (p.sourceType === 'locatorText') {
        const loc = formatPlaywrightLocator(String(p.sourceValue || ''));
        return [`const ${varName} = (await ${loc}.textContent())?.trim() ?? '';`];
      }
      const valExpr = formatValueExpression(
        String(p.sourceValue || ''),
        referencedSecrets
      );
      return [`const ${varName} = ${valExpr};`];
    }
    case 'logic.ifBranch': {
      const condLoc = formatPlaywrightLocator(String(p.conditionLocator || ''));
      const thenLoc = formatPlaywrightLocator(String(p.thenActionLocator || ''));
      return [
        `if (await ${condLoc}.isVisible()) {`,
        `  await ${thenLoc}.click();`,
        `}`,
      ];
    }
    case 'logic.subflow': {
      const slug = String(p.sopSlug || 'custom-sop').trim();
      const fnName = toCamelCaseSopFunction(slug);
      let argsCode = '{}';
      try {
        const parsed = JSON.parse(String(p.sopArgsJson || '{}'));
        argsCode = JSON.stringify(parsed);
      } catch {
        argsCode = '{}';
      }
      return [`await ${fnName}(page, ${argsCode});`];
    }
    case 'adv.apiRequest': {
      const method = String(p.method || 'GET').toLowerCase();
      const endpoint = escapeSingleQuotes(String(p.endpoint || '/api/platform'));
      const expectedStatus = Number(p.expectedStatus || 200);
      return [
        `const apiRes = await request.${method}('${endpoint}');`,
        `expect(apiRes.status()).toBe(${expectedStatus});`,
      ];
    }
    case 'adv.networkIntercept': {
      const glob = escapeSingleQuotes(String(p.urlGlob || '**/api/**'));
      const status = Number(p.statusCode || 200);
      const body = String(p.responseJson || '{"ok":true}');
      return [
        `await page.route('${glob}', async (route) => {`,
        `  await route.fulfill({ status: ${status}, contentType: 'application/json', body: '${escapeSingleQuotes(body)}' });`,
        `});`,
      ];
    }
    case 'adv.captureScreenshot': {
      const name = escapeSingleQuotes(
        String(p.artifactName || 'evidence.png')
      );
      const fullPage = Boolean(p.fullPage ?? true);
      return [
        `await page.screenshot({ path: 'artifacts/${name}', fullPage: ${fullPage} });`,
      ];
    }
    default:
      return [`// Unmapped action: ${step.actionId}`];
  }
}

// ==================== RBAC & PERMISSIONS ====================

export interface RoleDefinition {
  role: RoleType;
  label: string;
  description: string;
  permissions: {
    canViewDashboards: boolean;
    canEditTests: boolean;
    canExecuteTests: boolean;
    canManageSopModules: boolean;
    canManageWorkers: boolean;
    canManageSecretsAndRbac: boolean;
  };
}

export const ROLE_DEFINITIONS: Record<RoleType, RoleDefinition> = {
  platform_admin: {
    role: 'platform_admin',
    label: 'Platform Administrator',
    description: 'Full control over multi-tenant workspaces, worker pools, RBAC, secrets, and test assets.',
    permissions: {
      canViewDashboards: true,
      canEditTests: true,
      canExecuteTests: true,
      canManageSopModules: true,
      canManageWorkers: true,
      canManageSecretsAndRbac: true,
    },
  },
  workspace_admin: {
    role: 'workspace_admin',
    label: 'Workspace Administrator',
    description: 'Manages projects, worker concurrency, secrets, integrations, and executions within the workspace.',
    permissions: {
      canViewDashboards: true,
      canEditTests: true,
      canExecuteTests: true,
      canManageSopModules: true,
      canManageWorkers: true,
      canManageSecretsAndRbac: true,
    },
  },
  project_admin: {
    role: 'project_admin',
    label: 'Project Administrator',
    description: 'Manages project environments, test plans, suites, SOP modules, and executions.',
    permissions: {
      canViewDashboards: true,
      canEditTests: true,
      canExecuteTests: true,
      canManageSopModules: true,
      canManageWorkers: false,
      canManageSecretsAndRbac: false,
    },
  },
  automation_engineer: {
    role: 'automation_engineer',
    label: 'Automation Engineer',
    description: 'Builds visual workflows, authors & versions SOP modules, reviews TypeScript code, and runs tests.',
    permissions: {
      canViewDashboards: true,
      canEditTests: true,
      canExecuteTests: true,
      canManageSopModules: true,
      canManageWorkers: false,
      canManageSecretsAndRbac: false,
    },
  },
  manual_qa: {
    role: 'manual_qa',
    label: 'Manual QA / Test Designer',
    description: 'Designs visual drag-and-drop test cases using actions and SOP modules and triggers test executions.',
    permissions: {
      canViewDashboards: true,
      canEditTests: true,
      canExecuteTests: true,
      canManageSopModules: false,
      canManageWorkers: false,
      canManageSecretsAndRbac: false,
    },
  },
  viewer: {
    role: 'viewer',
    label: 'Viewer / Compliance Auditor',
    description: 'Read-only access to test definitions, execution reports, analytics, and audit logs.',
    permissions: {
      canViewDashboards: true,
      canEditTests: false,
      canExecuteTests: false,
      canManageSopModules: false,
      canManageWorkers: false,
      canManageSecretsAndRbac: false,
    },
  },
};

export function canPerformAction(
  role: RoleType,
  permissionKey: keyof RoleDefinition['permissions']
): boolean {
  const def = ROLE_DEFINITIONS[role];
  if (!def) return false;
  return Boolean(def.permissions[permissionKey]);
}

// ==================== WORKER CAPACITY & ANALYTICS ====================

/**
 * Selects the optimal healthy worker from the requested pool that has available concurrency slots
 * and supports the requested browser engine, preventing resource oversubscription.
 */
export function allocateWorkerForJob(
  workers: WorkerNode[],
  requestedPool: string,
  browser: 'chromium' | 'firefox' | 'webkit'
): WorkerNode | null {
  const eligible = workers.filter(
    (w) =>
      (w.status === 'online' || w.status === 'busy') &&
      (w.pool === requestedPool || requestedPool === 'any') &&
      w.supportedBrowsers.includes(browser) &&
      w.activeJobs < w.maxConcurrency
  );
  if (eligible.length === 0) {
    return null;
  }
  // Sort by lowest utilization ratio (activeJobs / maxConcurrency), then lowest CPU usage
  eligible.sort((a, b) => {
    const ratioA = a.activeJobs / Math.max(1, a.maxConcurrency);
    const ratioB = b.activeJobs / Math.max(1, b.maxConcurrency);
    if (ratioA !== ratioB) return ratioA - ratioB;
    return a.cpuUsagePercent - b.cpuUsagePercent;
  });
  return eligible[0];
}

export interface AnalyticsSummary {
  totalTestCases: number;
  totalExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  passRatePercent: number;
  avgDurationMs: number;
  avgQueueWaitMs: number;
  flakyTestsCount: number;
  onlineWorkers: number;
  totalWorkerCapacity: number;
  occupiedWorkerCapacity: number;
}

export function calculateAnalyticsSummary(
  testCases: TestCase[],
  executions: ExecutionRun[],
  workers: WorkerNode[]
): AnalyticsSummary {
  const completedRuns = executions.filter(
    (e) =>
      e.status === 'passed' ||
      e.status === 'failed' ||
      e.status === 'timed_out' ||
      e.status === 'infra_error'
  );
  const passedExecutions = completedRuns.filter(
    (e) => e.status === 'passed'
  ).length;
  const failedExecutions = completedRuns.filter(
    (e) => e.status !== 'passed'
  ).length;
  const passRatePercent =
    completedRuns.length > 0
      ? Math.round((passedExecutions / completedRuns.length) * 1000) / 10
      : 100;

  const avgDurationMs =
    completedRuns.length > 0
      ? Math.round(
          completedRuns.reduce((sum, r) => sum + r.durationMs, 0) /
            completedRuns.length
        )
      : 0;

  const avgQueueWaitMs =
    executions.length > 0
      ? Math.round(
          executions.reduce((sum, r) => sum + (r.queueWaitMs || 0), 0) /
            executions.length
        )
      : 0;

  const flakyTestsCount = testCases.filter((tc) => tc.flakyScore >= 15).length;

  const activeWorkers = workers.filter(
    (w) => w.status === 'online' || w.status === 'busy'
  );
  const totalWorkerCapacity = activeWorkers.reduce(
    (sum, w) => sum + w.maxConcurrency,
    0
  );
  const occupiedWorkerCapacity = workers.reduce(
    (sum, w) => sum + w.activeJobs,
    0
  );

  return {
    totalTestCases: testCases.length,
    totalExecutions: executions.length,
    passedExecutions,
    failedExecutions,
    passRatePercent,
    avgDurationMs,
    avgQueueWaitMs,
    flakyTestsCount,
    onlineWorkers: activeWorkers.length,
    totalWorkerCapacity,
    occupiedWorkerCapacity,
  };
}
