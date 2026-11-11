import {NextRequest, NextResponse} from 'next/server';
import {
  PLAYWRIGHT_ACTION_REGISTRY,
  calculateAnalyticsSummary,
  canPerformAction,
  validateWorkflow,
} from '@/lib/action-registry';
import {
  appendAuditLog,
  loadPlatformState,
  runTestCaseExecution,
  savePlatformState,
} from '@/lib/server-store';
import {
  BrowserEngine,
  Project,
  RoleType,
  SOPModule,
  SecretEntry,
  TestCase,
  WorkerNode,
  WorkflowStep,
} from '@/lib/types';

export async function GET() {
  const state = loadPlatformState();
  const analytics = calculateAnalyticsSummary(
    state.testCases,
    state.executions,
    state.workers
  );
  return NextResponse.json({
    state,
    actionRegistry: PLAYWRIGHT_ACTION_REGISTRY,
    analytics,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || '');
    const role: RoleType = (body.role as RoleType) || 'automation_engineer';
    const actor = String(body.actor || 'Elena Vance');

    const state = loadPlatformState();

    switch (action) {
      case 'save_test_case': {
        if (!canPerformAction(role, 'canEditTests')) {
          return NextResponse.json(
            {
              error: `RBAC Violation: Role "${role}" does not have permission to create or modify test cases.`,
            },
            {status: 403}
          );
        }

        const tcInput = body.testCase as Partial<TestCase>;
        if (!tcInput || !tcInput.title || !tcInput.title.trim()) {
          return NextResponse.json(
            {error: 'Test case title is required.'},
            {status: 400}
          );
        }

        const steps: WorkflowStep[] = Array.isArray(tcInput.steps)
          ? tcInput.steps
          : [];
        const validationIssues = validateWorkflow(steps, state.sopModules);
        const blockingErrors = validationIssues.filter(
          (i) => i.severity === 'error'
        );
        if (blockingErrors.length > 0 && body.strictValidation) {
          return NextResponse.json(
            {
              error: blockingErrors[0].message,
              validationIssues,
            },
            {status: 400}
          );
        }

        const nowIso = new Date().toISOString();
        const existingIdx = state.testCases.findIndex(
          (t) => t.id === tcInput.id
        );

        if (existingIdx >= 0) {
          const existing = state.testCases[existingIdx];
          const nextVersion = existing.version + 1;
          const updated: TestCase = {
            ...existing,
            title: tcInput.title.trim(),
            description:
              tcInput.description !== undefined
                ? tcInput.description
                : existing.description,
            projectId: tcInput.projectId || existing.projectId,
            testPlanId: tcInput.testPlanId || existing.testPlanId,
            testSuiteId: tcInput.testSuiteId || existing.testSuiteId,
            status: tcInput.status || existing.status,
            priority: tcInput.priority || existing.priority,
            tags: tcInput.tags || existing.tags,
            targetEnvironment:
              tcInput.targetEnvironment || existing.targetEnvironment,
            browsers:
              tcInput.browsers && tcInput.browsers.length > 0
                ? tcInput.browsers
                : existing.browsers,
            steps,
            dataDrivenRows:
              tcInput.dataDrivenRows !== undefined
                ? tcInput.dataDrivenRows
                : existing.dataDrivenRows,
            version: nextVersion,
            updatedAt: nowIso,
            versionHistory: [
              {
                version: nextVersion,
                updatedAt: nowIso,
                author: actor,
                summary: String(
                  body.changeSummary ||
                    `Updated workflow (${steps.length} steps)`
                ),
                stepCount: steps.length,
              },
              ...existing.versionHistory,
            ],
          };
          state.testCases[existingIdx] = updated;
          appendAuditLog(state, {
            actor,
            role,
            action: 'UPDATE_TEST_CASE',
            resourceType: 'test_case',
            resourceId: updated.id,
            details: `Saved ${updated.code} v${nextVersion} (${steps.length} steps)`,
          });
          savePlatformState(state);
          return NextResponse.json({
            testCase: updated,
            state,
            analytics: calculateAnalyticsSummary(
              state.testCases,
              state.executions,
              state.workers
            ),
          });
        } else {
          const project =
            state.projects.find((p) => p.id === tcInput.projectId) ||
            state.projects[0];
          const codeNum = 100 + state.testCases.length + 1;
          const newTc: TestCase = {
            id: `tc-${Date.now()}`,
            code: tcInput.code || `${project.key}-TC-${codeNum}`,
            title: tcInput.title.trim(),
            description: tcInput.description || '',
            workspaceId: project.workspaceId,
            projectId: project.id,
            testPlanId:
              tcInput.testPlanId || state.testPlans[0]?.id || 'tp-release-2026-4',
            testSuiteId:
              tcInput.testSuiteId || state.testSuites[0]?.id || 'ts-checkout-e2e',
            status: tcInput.status || 'active',
            priority: tcInput.priority || 'high',
            tags: tcInput.tags || ['regression'],
            version: 1,
            versionHistory: [
              {
                version: 1,
                updatedAt: nowIso,
                author: actor,
                summary: 'Initial visual test case creation',
                stepCount: steps.length,
              },
            ],
            author: actor,
            targetEnvironment:
              tcInput.targetEnvironment || project.defaultEnvironment,
            browsers:
              tcInput.browsers && tcInput.browsers.length > 0
                ? tcInput.browsers
                : ['chromium'],
            steps:
              steps.length > 0
                ? steps
                : [
                    {
                      id: `step-${Date.now()}-1`,
                      actionId: 'nav.goto',
                      label: 'Navigate to Controlled Sample Portal',
                      enabled: true,
                      parameters: {
                        url: '/sample-app',
                        waitUntil: 'domcontentloaded',
                      },
                    },
                    {
                      id: `step-${Date.now()}-2`,
                      actionId: 'assert.visible',
                      label: 'Verify Portal Banner Is Visible',
                      enabled: true,
                      parameters: {
                        locator: 'testid=dashboard-welcome-banner',
                        shouldBeVisible: true,
                      },
                    },
                  ],
            dataDrivenRows: tcInput.dataDrivenRows || [],
            createdAt: nowIso,
            updatedAt: nowIso,
            flakyScore: 0,
            passRate: 100,
            avgDurationMs: 0,
            totalRuns: 0,
          };
          state.testCases.unshift(newTc);
          appendAuditLog(state, {
            actor,
            role,
            action: 'CREATE_TEST_CASE',
            resourceType: 'test_case',
            resourceId: newTc.id,
            details: `Created new test case ${newTc.code}: "${newTc.title}"`,
          });
          savePlatformState(state);
          return NextResponse.json({
            testCase: newTc,
            state,
            analytics: calculateAnalyticsSummary(
              state.testCases,
              state.executions,
              state.workers
            ),
          });
        }
      }

      case 'duplicate_test_case': {
        if (!canPerformAction(role, 'canEditTests')) {
          return NextResponse.json(
            {error: `Role "${role}" cannot duplicate test cases.`},
            {status: 403}
          );
        }
        const source = state.testCases.find((t) => t.id === body.testCaseId);
        if (!source) {
          return NextResponse.json(
            {error: 'Source test case not found.'},
            {status: 404}
          );
        }
        const nowIso = new Date().toISOString();
        const copyCode = `${source.code}-COPY`;
        const duplicated: TestCase = {
          ...source,
          id: `tc-${Date.now()}`,
          code: copyCode,
          title: `${source.title} (Copy)`,
          version: 1,
          versionHistory: [
            {
              version: 1,
              updatedAt: nowIso,
              author: actor,
              summary: `Cloned from ${source.code} v${source.version}`,
              stepCount: source.steps.length,
            },
          ],
          steps: source.steps.map((s, idx) => ({
            ...s,
            id: `step-${Date.now()}-${idx}`,
            parameters: {...s.parameters},
          })),
          createdAt: nowIso,
          updatedAt: nowIso,
          totalRuns: 0,
        };
        state.testCases.unshift(duplicated);
        appendAuditLog(state, {
          actor,
          role,
          action: 'DUPLICATE_TEST_CASE',
          resourceType: 'test_case',
          resourceId: duplicated.id,
          details: `Duplicated ${source.code} -> ${duplicated.code}`,
        });
        savePlatformState(state);
        return NextResponse.json({
          testCase: duplicated,
          state,
          analytics: calculateAnalyticsSummary(
            state.testCases,
            state.executions,
            state.workers
          ),
        });
      }

      case 'execute_test_case': {
        const outcome = runTestCaseExecution(state, {
          testCaseId: String(body.testCaseId || ''),
          browser: (body.browser as BrowserEngine) || undefined,
          environmentName: body.environmentName
            ? String(body.environmentName)
            : undefined,
          triggerSource: body.triggerSource || 'manual',
          actorName: actor,
          actorRole: role,
        });

        if (outcome.error) {
          return NextResponse.json({error: outcome.error}, {status: 403});
        }

        return NextResponse.json({
          run: outcome.run,
          state,
          analytics: calculateAnalyticsSummary(
            state.testCases,
            state.executions,
            state.workers
          ),
        });
      }

      case 'execute_test_suite': {
        if (!canPerformAction(role, 'canExecuteTests')) {
          return NextResponse.json(
            {error: `Role "${role}" is not permitted to execute test suites.`},
            {status: 403}
          );
        }
        const suiteId = String(body.testSuiteId || '');
        const suiteCases = state.testCases.filter(
          (tc) =>
            (suiteId === 'all' || tc.testSuiteId === suiteId) &&
            tc.status !== 'archived'
        );
        const runs = [];
        for (const tc of suiteCases) {
          const res = runTestCaseExecution(state, {
            testCaseId: tc.id,
            browser: (body.browser as BrowserEngine) || tc.browsers[0] || 'chromium',
            triggerSource: 'suite',
            actorName: actor,
            actorRole: role,
          });
          if (res.run) {
            runs.push(res.run);
          }
        }
        return NextResponse.json({
          runs,
          state,
          analytics: calculateAnalyticsSummary(
            state.testCases,
            state.executions,
            state.workers
          ),
        });
      }

      case 'cancel_execution': {
        if (!canPerformAction(role, 'canExecuteTests')) {
          return NextResponse.json(
            {error: `Role "${role}" cannot cancel executions.`},
            {status: 403}
          );
        }
        const exec = state.executions.find((e) => e.id === body.executionId);
        if (exec) {
          exec.status = 'cancelled';
          exec.completedAt = new Date().toISOString();
          exec.logs.push(
            `[${new Date().toISOString().slice(11, 23)}] Execution cancelled safely by ${actor} (${role}).`
          );
          appendAuditLog(state, {
            actor,
            role,
            action: 'CANCEL_EXECUTION',
            resourceType: 'execution',
            resourceId: exec.id,
            details: `Cancelled execution ${exec.id}`,
          });
          savePlatformState(state);
        }
        return NextResponse.json({
          state,
          analytics: calculateAnalyticsSummary(
            state.testCases,
            state.executions,
            state.workers
          ),
        });
      }

      case 'save_sop_module': {
        if (!canPerformAction(role, 'canManageSopModules')) {
          return NextResponse.json(
            {
              error: `RBAC Violation: Role "${role}" cannot create or update SOP modules.`,
            },
            {status: 403}
          );
        }
        const modInput = body.sopModule as Partial<SOPModule>;
        if (!modInput || !modInput.name || !modInput.slug) {
          return NextResponse.json(
            {error: 'SOP Module name and slug are required.'},
            {status: 400}
          );
        }
        const nowIso = new Date().toISOString();
        const existingIdx = state.sopModules.findIndex(
          (m) => m.id === modInput.id || m.slug === modInput.slug
        );

        if (existingIdx >= 0) {
          const existing = state.sopModules[existingIdx];
          const newVer = modInput.version || existing.version;
          const avail = existing.availableVersions.includes(newVer)
            ? existing.availableVersions
            : [newVer, ...existing.availableVersions];
          const updated: SOPModule = {
            ...existing,
            name: modInput.name.trim(),
            description: modInput.description ?? existing.description,
            version: newVer,
            availableVersions: avail,
            category: modInput.category || existing.category,
            repoReference: modInput.repoReference || existing.repoReference,
            validationStatus:
              modInput.validationStatus || existing.validationStatus,
            changelog: modInput.changelog || existing.changelog,
            steps: modInput.steps || existing.steps,
            updatedAt: nowIso,
          };
          state.sopModules[existingIdx] = updated;
          appendAuditLog(state, {
            actor,
            role,
            action: 'UPDATE_SOP_MODULE',
            resourceType: 'sop_module',
            resourceId: updated.id,
            details: `Updated SOP module ${updated.slug} to v${updated.version}`,
          });
        } else {
          const newSop: SOPModule = {
            id: `sop-${Date.now()}`,
            name: modInput.name.trim(),
            slug: modInput.slug
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, '-'),
            description: modInput.description || 'Reusable organizational SOP module.',
            version: modInput.version || '1.0.0',
            availableVersions: [modInput.version || '1.0.0'],
            category: modInput.category || 'Business Workflow',
            ownerRole: role,
            author: actor,
            inputParameters: modInput.inputParameters || [
              {
                name: 'targetParam',
                label: 'Input Value',
                type: 'string',
                required: true,
                defaultValue: 'default',
                description: 'Standard SOP input parameter',
              },
            ],
            outputParameters: modInput.outputParameters || ['sopResult'],
            steps: modInput.steps || [
              {
                id: `sop-step-${Date.now()}`,
                actionId: 'assert.visible',
                label: 'Verify Target Portal State',
                enabled: true,
                parameters: {
                  locator: 'testid=dashboard-welcome-banner',
                  shouldBeVisible: true,
                },
              },
            ],
            compatibleProjects: modInput.compatibleProjects || [
              'proj-acme-cloud',
            ],
            repoReference:
              modInput.repoReference ||
              `git@github.com:acme-org/playwright-sop-library.git#v${modInput.version || '1.0.0'}`,
            validationStatus: 'verified',
            usageCount: 1,
            updatedAt: nowIso,
            changelog: modInput.changelog || 'Initial verified release.',
          };
          state.sopModules.unshift(newSop);
          appendAuditLog(state, {
            actor,
            role,
            action: 'REGISTER_SOP_MODULE',
            resourceType: 'sop_module',
            resourceId: newSop.id,
            details: `Registered new SOP module ${newSop.slug} (v${newSop.version})`,
          });
        }
        savePlatformState(state);
        return NextResponse.json({
          state,
          analytics: calculateAnalyticsSummary(
            state.testCases,
            state.executions,
            state.workers
          ),
        });
      }

      case 'update_worker': {
        if (!canPerformAction(role, 'canManageWorkers')) {
          return NextResponse.json(
            {
              error: `RBAC Violation: Role "${role}" is not permitted to manage execution workers.`,
            },
            {status: 403}
          );
        }
        const worker = state.workers.find((w) => w.id === body.workerId);
        if (!worker) {
          return NextResponse.json({error: 'Worker not found.'}, {status: 404});
        }
        const nowIso = new Date().toISOString();
        if (body.status) {
          worker.status = body.status;
          worker.recentLogs.unshift(
            `[${nowIso.slice(11, 19)}] Worker state changed to ${String(body.status).toUpperCase()} by ${actor}`
          );
        }
        if (body.maxConcurrency !== undefined) {
          worker.maxConcurrency = Math.max(
            1,
            Math.min(16, Number(body.maxConcurrency))
          );
        }
        if (body.pool) {
          worker.pool = String(body.pool);
        }
        if (body.restart) {
          worker.status = 'online';
          worker.errorCount = 0;
          worker.cpuUsagePercent = 14;
          worker.lastHeartbeatAt = nowIso;
          worker.recentLogs.unshift(
            `[${nowIso.slice(11, 19)}] Container restarted cleanly; health check & browser binaries verified.`
          );
        }
        appendAuditLog(state, {
          actor,
          role,
          action: 'MANAGE_WORKER',
          resourceType: 'worker',
          resourceId: worker.id,
          details: `Updated worker ${worker.name} (status=${worker.status}, maxConcurrency=${worker.maxConcurrency})`,
        });
        savePlatformState(state);
        return NextResponse.json({
          state,
          analytics: calculateAnalyticsSummary(
            state.testCases,
            state.executions,
            state.workers
          ),
        });
      }

      case 'register_worker': {
        if (!canPerformAction(role, 'canManageWorkers')) {
          return NextResponse.json(
            {error: `Role "${role}" cannot register workers.`},
            {status: 403}
          );
        }
        const nowIso = new Date().toISOString();
        const newWorker: WorkerNode = {
          id: `worker-${Date.now()}`,
          name: String(
            body.name || `pw-runner-node-0${state.workers.length + 1}`
          ),
          pool: String(body.pool || 'core-linux-pool'),
          host: String(body.host || `10.42.10.${20 + state.workers.length}`),
          containerId: `docker://${Math.random().toString(16).slice(2, 14)}`,
          status: 'online',
          maxConcurrency: Number(body.maxConcurrency || 4),
          activeJobs: 0,
          supportedBrowsers: body.supportedBrowsers || [
            'chromium',
            'firefox',
            'webkit',
          ],
          cpuUsagePercent: 12,
          memoryUsageMb: 980,
          maxMemoryMb: 8192,
          lastHeartbeatAt: nowIso,
          uptimeSeconds: 10,
          totalExecuted: 0,
          errorCount: 0,
          currentExecutionIds: [],
          recentLogs: [
            `[${nowIso.slice(11, 19)}] Registered and joined pool ${body.pool || 'core-linux-pool'}`,
          ],
        };
        state.workers.push(newWorker);
        appendAuditLog(state, {
          actor,
          role,
          action: 'REGISTER_WORKER',
          resourceType: 'worker',
          resourceId: newWorker.id,
          details: `Registered worker ${newWorker.name} in pool ${newWorker.pool}`,
        });
        savePlatformState(state);
        return NextResponse.json({
          state,
          analytics: calculateAnalyticsSummary(
            state.testCases,
            state.executions,
            state.workers
          ),
        });
      }

      case 'create_project': {
        if (!canPerformAction(role, 'canEditTests')) {
          return NextResponse.json(
            {error: `Role "${role}" cannot create projects.`},
            {status: 403}
          );
        }
        const name = String(body.name || '').trim();
        const key = String(body.key || '')
          .trim()
          .toUpperCase();
        if (!name || !key) {
          return NextResponse.json(
            {error: 'Project name and key are required.'},
            {status: 400}
          );
        }
        const newProj: Project = {
          id: `proj-${Date.now()}`,
          workspaceId: state.workspaces[0].id,
          key,
          name,
          description: String(body.description || 'Enterprise QA Automation Project'),
          defaultEnvironment: 'Staging',
          concurrencyLimit: Number(body.concurrencyLimit || 6),
          workerPool: String(body.workerPool || 'core-linux-pool'),
          artifactRetentionDays: 30,
          createdAt: new Date().toISOString(),
          environments: [
            {
              id: `env-${Date.now()}`,
              name: 'Staging',
              slug: 'staging',
              baseUrl: String(body.baseUrl || 'http://localhost:3000'),
              variables: {PORTAL_PATH: '/sample-app'},
              defaultRetries: 1,
              timeoutMs: 30000,
            },
          ],
        };
        state.projects.push(newProj);
        appendAuditLog(state, {
          actor,
          role,
          action: 'CREATE_PROJECT',
          resourceType: 'project',
          resourceId: newProj.id,
          details: `Created project ${newProj.key} (${newProj.name})`,
        });
        savePlatformState(state);
        return NextResponse.json({
          project: newProj,
          state,
          analytics: calculateAnalyticsSummary(
            state.testCases,
            state.executions,
            state.workers
          ),
        });
      }

      case 'add_secret': {
        if (!canPerformAction(role, 'canManageSecretsAndRbac')) {
          return NextResponse.json(
            {
              error: `RBAC Violation: Role "${role}" cannot manage encrypted secrets.`,
            },
            {status: 403}
          );
        }
        const secretKey = String(body.key || '')
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_]/g, '_');
        if (!secretKey || !body.value) {
          return NextResponse.json(
            {error: 'Secret key and value are required.'},
            {status: 400}
          );
        }
        const newSecret: SecretEntry = {
          id: `sec-${Date.now()}`,
          key: secretKey,
          environmentSlug: String(body.environmentSlug || 'staging'),
          projectId: String(body.projectId || state.projects[0].id),
          maskedValue: '•••••••••••••••••••• (AES-256-GCM)',
          createdAt: new Date().toISOString(),
          createdBy: actor,
        };
        state.secrets.unshift(newSecret);
        appendAuditLog(state, {
          actor,
          role,
          action: 'CREATE_ENCRYPTED_SECRET',
          resourceType: 'secret',
          resourceId: newSecret.id,
          details: `Stored encrypted secret ${newSecret.key} for environment ${newSecret.environmentSlug}`,
        });
        savePlatformState(state);
        return NextResponse.json({state});
      }

      case 'toggle_notification_rule': {
        const rule = state.notificationRules.find((r) => r.id === body.ruleId);
        if (rule) {
          rule.enabled = !rule.enabled;
          appendAuditLog(state, {
            actor,
            role,
            action: 'UPDATE_NOTIFICATION_RULE',
            resourceType: 'integration',
            resourceId: rule.id,
            details: `${rule.enabled ? 'Enabled' : 'Disabled'} notification rule "${rule.name}"`,
          });
          savePlatformState(state);
        }
        return NextResponse.json({state});
      }

      case 'resolve_issue': {
        const iss = state.issues.find((i) => i.id === body.issueId);
        if (iss) {
          iss.status = body.status || 'Resolved';
          savePlatformState(state);
        }
        return NextResponse.json({state});
      }

      default:
        return NextResponse.json(
          {error: `Unknown action: ${action}`},
          {status: 400}
        );
    }
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Unexpected server error processing request',
      },
      {status: 500}
    );
  }
}
