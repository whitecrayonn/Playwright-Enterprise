export type ActionCategory =
  | 'navigation'
  | 'interaction'
  | 'assertion'
  | 'synchronization'
  | 'logic'
  | 'advanced';

export type ParameterType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'locator'
  | 'json'
  | 'secret';

export interface ActionParameterSchema {
  name: string;
  label: string;
  type: ParameterType;
  required: boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  options?: {label: string; value: string}[];
  description: string;
  example?: string;
}

export interface ActionRegistryEntry {
  id: string;
  version: string;
  name: string;
  category: ActionCategory;
  description: string;
  parameters: ActionParameterSchema[];
  supportedContexts: ('page' | 'frame' | 'browserContext' | 'apiRequest')[];
  errorBehavior: 'fail_fast' | 'retry_auto_wait' | 'soft_assert';
  dependencies: string[];
  outputVariableSupported?: boolean;
}

export interface WorkflowStep {
  id: string;
  actionId: string;
  label: string;
  enabled: boolean;
  parameters: Record<string, string | number | boolean>;
  variableOutput?: string;
  continueOnError?: boolean;
  retryCount?: number;
  timeoutMs?: number;
  branchCondition?: string;
  parentStepId?: string;
  sopModuleId?: string;
  sopModuleVersion?: string;
  notes?: string;
}

export interface ValidationIssue {
  stepId?: string;
  stepIndex?: number;
  field?: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface CodeGenerationResult {
  code: string;
  valid: boolean;
  issues: ValidationIssue[];
  stepLineMap: Record<string, {startLine: number; endLine: number}>;
  importedSopModules: string[];
  referencedSecrets: string[];
}

export interface SOPModuleParameter {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'secret';
  required: boolean;
  defaultValue?: string;
  description: string;
}

export interface SOPModule {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  availableVersions: string[];
  category: string;
  ownerRole: RoleType;
  author: string;
  inputParameters: SOPModuleParameter[];
  outputParameters: string[];
  steps: WorkflowStep[];
  compatibleProjects: string[];
  repoReference: string;
  validationStatus: 'verified' | 'draft' | 'deprecated';
  usageCount: number;
  updatedAt: string;
  changelog: string;
}

export type TestStatus = 'draft' | 'active' | 'deprecated' | 'archived';
export type TestPriority = 'critical' | 'high' | 'medium' | 'low';
export type BrowserEngine = 'chromium' | 'firefox' | 'webkit';

export interface TestVersionRecord {
  version: number;
  updatedAt: string;
  author: string;
  summary: string;
  stepCount: number;
}

export interface TestCase {
  id: string;
  code: string;
  title: string;
  description: string;
  workspaceId: string;
  projectId: string;
  testPlanId: string;
  testSuiteId: string;
  status: TestStatus;
  priority: TestPriority;
  tags: string[];
  version: number;
  versionHistory: TestVersionRecord[];
  author: string;
  targetEnvironment: string;
  browsers: BrowserEngine[];
  steps: WorkflowStep[];
  dataDrivenRows: Record<string, string>[];
  createdAt: string;
  updatedAt: string;
  flakyScore: number;
  passRate: number;
  avgDurationMs: number;
  totalRuns: number;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  projectId: string;
  testPlanId: string;
  tags: string[];
  parallelism: number;
}

export interface TestPlan {
  id: string;
  name: string;
  description: string;
  projectId: string;
  targetRelease: string;
  scheduleCron?: string;
}

export interface EnvironmentConfig {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  variables: Record<string, string>;
  defaultRetries: number;
  timeoutMs: number;
}

export interface Project {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string;
  defaultEnvironment: string;
  concurrencyLimit: number;
  workerPool: string;
  artifactRetentionDays: number;
  environments: EnvironmentConfig[];
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  tier: 'Enterprise Multi-Tenant';
}

export type WorkerStatus =
  | 'online'
  | 'busy'
  | 'draining'
  | 'offline'
  | 'unhealthy';

export interface WorkerNode {
  id: string;
  name: string;
  pool: string;
  host: string;
  containerId: string;
  status: WorkerStatus;
  maxConcurrency: number;
  activeJobs: number;
  supportedBrowsers: BrowserEngine[];
  cpuUsagePercent: number;
  memoryUsageMb: number;
  maxMemoryMb: number;
  lastHeartbeatAt: string;
  uptimeSeconds: number;
  totalExecuted: number;
  errorCount: number;
  currentExecutionIds: string[];
  recentLogs: string[];
}

export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'passed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'
  | 'infra_error';

export interface StepExecutionResult {
  stepId: string;
  stepIndex: number;
  actionId: string;
  label: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'skipped';
  durationMs: number;
  startedAt: string;
  completedAt?: string;
  generatedCodeLine: string;
  locatorResolved?: string;
  actualValue?: string;
  expectedValue?: string;
  errorMessage?: string;
  stackTrace?: string;
  logLines: string[];
  domSnapshotSnippet?: string;
}

export interface ExecutionRun {
  id: string;
  runNumber: number;
  workspaceId: string;
  projectId: string;
  testPlanId: string;
  testSuiteId: string;
  testCaseId: string;
  testCaseCode: string;
  testCaseTitle: string;
  triggerSource: 'manual' | 'suite' | 'schedule' | 'ci_webhook';
  triggeredBy: string;
  triggeredByRole: RoleType;
  environmentName: string;
  baseUrl: string;
  browser: BrowserEngine;
  workerId: string;
  workerName: string;
  status: ExecutionStatus;
  retryAttempt: number;
  maxRetries: number;
  queuedAt: string;
  startedAt: string;
  completedAt?: string;
  durationMs: number;
  queueWaitMs: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  totalSteps: number;
  stepResults: StepExecutionResult[];
  logs: string[];
  generatedSpecCode: string;
  traceArtifactId: string;
  videoArtifactId?: string;
  screenshotArtifactId?: string;
  cpuPeakPercent: number;
  memoryPeakMb: number;
  failureFingerprint?: string;
  linkedIssueKey?: string;
}

export type RoleType =
  | 'platform_admin'
  | 'workspace_admin'
  | 'project_admin'
  | 'automation_engineer'
  | 'manual_qa'
  | 'viewer';

export interface SecretEntry {
  id: string;
  key: string;
  environmentSlug: string;
  projectId: string;
  maskedValue: string;
  createdAt: string;
  createdBy: string;
  lastUsedAt?: string;
}

export interface NotificationRule {
  id: string;
  name: string;
  channel: 'slack' | 'teams' | 'email' | 'jira';
  targetDestination: string;
  events: (
    | 'execution_failed'
    | 'execution_completed'
    | 'worker_unhealthy'
    | 'queue_congestion'
    | 'flaky_threshold'
  )[];
  enabled: boolean;
  deduplicateFailures: boolean;
  projectId: string;
}

export interface NotificationDispatchRecord {
  id: string;
  ruleId: string;
  channel: 'slack' | 'teams' | 'email' | 'jira';
  destination: string;
  subject: string;
  message: string;
  executionId?: string;
  issueKey?: string;
  createdAt: string;
  deduplicated: boolean;
}

export interface IssueTicket {
  id: string;
  key: string;
  title: string;
  projectId: string;
  testCaseId: string;
  executionId: string;
  failureFingerprint: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  occurrenceCount: number;
  createdAt: string;
  lastSeenAt: string;
  assignee: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: RoleType;
  action: string;
  resourceType:
    | 'test_case'
    | 'sop_module'
    | 'execution'
    | 'worker'
    | 'secret'
    | 'rbac'
    | 'integration'
    | 'project';
  resourceId: string;
  details: string;
  ipAddress: string;
}

export interface PlatformState {
  workspaces: Workspace[];
  projects: Project[];
  testPlans: TestPlan[];
  testSuites: TestSuite[];
  testCases: TestCase[];
  sopModules: SOPModule[];
  workers: WorkerNode[];
  executions: ExecutionRun[];
  secrets: SecretEntry[];
  notificationRules: NotificationRule[];
  notificationHistory: NotificationDispatchRecord[];
  issues: IssueTicket[];
  auditLogs: AuditLogEntry[];
}
