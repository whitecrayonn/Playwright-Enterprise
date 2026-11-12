// Shared, framework-free types used by both the browser UI and the server.

export type BrowserName = 'chromium' | 'firefox' | 'webkit';

/** Shape of `.env.json` in the project root. */
export interface StudioEnv {
  baseUrl: string;
  browser: BrowserName;
  /** false opens a visible browser window on this machine while running. */
  headless: boolean;
  /** Default wait for every action and check, in milliseconds. */
  timeoutMs: number;
  viewport: {width: number; height: number};
  /** Free key/value pairs, referenced in blocks as {{NAME}}. */
  variables: Record<string, string>;
}

/** How a block finds an element on the page. */
export type TargetBy = 'text' | 'role' | 'label' | 'placeholder' | 'testid' | 'css';

export interface Target {
  by: TargetBy;
  value: string;
  /** ARIA role, only used when by === 'role' (button, link, textbox, …). */
  role?: string;
  /** Match the whole text instead of a substring (text / role / label). */
  exact?: boolean;
}

export type BlockKind =
  | 'open'
  | 'reload'
  | 'back'
  | 'click'
  | 'doubleClick'
  | 'hover'
  | 'fill'
  | 'press'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'expectVisible'
  | 'expectHidden'
  | 'expectText'
  | 'expectValue'
  | 'expectCount'
  | 'expectUrl'
  | 'expectTitle'
  | 'wait'
  | 'waitFor'
  | 'screenshot'
  | 'useBlock';

export interface Block {
  id: string;
  kind: BlockKind;
  target?: Target;
  /** Text / URL / key / number depending on the kind. */
  value?: string;
  /** For kind 'useBlock': id of the saved block document to insert. */
  ref?: string;
  /** Disabled blocks stay in the stack but are skipped when running. */
  disabled?: boolean;
}

/** A test, or a reusable saved block (a named stack used inside tests). */
export interface StudioDoc {
  id: string;
  kind: 'test' | 'block';
  name: string;
  description: string;
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
}

export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type RunStatus = 'running' | 'passed' | 'failed' | 'error';

export interface StepResult {
  index: number;
  /** Top-level block in the test this step came from. */
  blockId: string;
  /** Saved block name when the step was expanded from a "Use block". */
  via?: string;
  kind: BlockKind;
  label: string;
  status: StepStatus;
  durationMs?: number;
  error?: string;
  note?: string;
  screenshot?: string;
}

export interface RunRecord {
  id: string;
  number: number;
  testId: string;
  testName: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  env: {
    baseUrl: string;
    browser: BrowserName;
    headless: boolean;
    viewport: {width: number; height: number};
  };
  steps: StepResult[];
  /** Run-level failure (browser could not start, server restarted, …). */
  error?: string;
  finalScreenshot?: string;
  finalUrl?: string;
  consoleErrors: string[];
  failedRequests: string[];
}

export interface Issue {
  blockId: string;
  message: string;
}
