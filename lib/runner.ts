// Server-only: executes a test's blocks in a real Playwright browser.
import fs from 'node:fs';
import path from 'node:path';
import {chromium, firefox, webkit, type Browser, type Locator, type Page} from 'playwright';
import {
  blockLabel,
  describeTarget,
  expandBlocks,
  resolveUrl,
  substitute,
  validateBlocks,
  type ExpandedStep,
} from './blocks';
import {readEnv} from './env-config';
import {artifactsDir, readData, updateData} from './store';
import type {RunRecord, StepResult, StudioEnv, Target} from './studio-types';

/* ------------------------------------------------------------------ */
/* Single active run per server process                                */
/* ------------------------------------------------------------------ */

const ACTIVE = Symbol.for('playwright-studio.activeRun');
type GlobalWithRun = typeof globalThis & {[ACTIVE]?: string | null};
const g = globalThis as GlobalWithRun;

export function activeRunId(): string | null {
  return g[ACTIVE] ?? null;
}

/** Runs left as "running" by a crashed or restarted server are closed out. */
export function reconcileStaleRuns(): void {
  const active = activeRunId();
  const data = readData();
  if (!data.runs.some((r) => r.status === 'running' && r.id !== active)) return;
  updateData((d) => {
    for (const r of d.runs) {
      if (r.status === 'running' && r.id !== active) {
        r.status = 'error';
        r.error = 'The server stopped while this run was in progress.';
        r.finishedAt = r.finishedAt ?? new Date().toISOString();
        for (const s of r.steps) {
          if (s.status === 'running' || s.status === 'pending') s.status = 'skipped';
        }
      }
    }
  });
}

export class RunRejected extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

export function startRun(testId: string): {run: RunRecord; done: Promise<RunRecord>} {
  if (activeRunId()) {
    throw new RunRejected('Another test is running. Wait for it to finish.', 409);
  }
  const envResult = readEnv();
  if (envResult.state !== 'ok') {
    throw new RunRejected('Set up .env.json first (Settings).', 400);
  }
  const env = envResult.env;
  const data = readData();
  const doc = data.docs.find((d) => d.id === testId);
  if (!doc) throw new RunRejected('Test not found.', 404);

  const issues = validateBlocks(doc.blocks, data.docs, env.variables, doc.id);
  if (issues.length > 0) {
    throw new RunRejected('Fix the highlighted blocks before running.', 400, issues);
  }
  const steps = expandBlocks(doc.blocks, data.docs);

  const run = updateData((d) => {
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const record: RunRecord = {
      id: `run-${stamp}-${Math.random().toString(36).slice(2, 6)}`,
      number: d.nextRunNumber++,
      testId: doc.id,
      testName: doc.name,
      status: 'running',
      startedAt: now.toISOString(),
      env: {
        baseUrl: env.baseUrl,
        browser: env.browser,
        headless: env.headless,
        viewport: env.viewport,
      },
      steps: steps.map((s, index) => ({
        index,
        blockId: s.rootId,
        via: s.via,
        kind: s.block.kind,
        label: blockLabel(s.block, d.docs),
        status: 'pending',
      })),
      consoleErrors: [],
      failedRequests: [],
    };
    d.runs.unshift(record);
    return record;
  });

  g[ACTIVE] = run.id;
  const done = execute(run, steps, env).finally(() => {
    g[ACTIVE] = null;
  });
  return {run, done};
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

function patchRun(runId: string, fn: (r: RunRecord) => void): RunRecord | undefined {
  return updateData((d) => {
    const r = d.runs.find((x) => x.id === runId);
    if (r) fn(r);
    return r ? structuredClone(r) : undefined;
  });
}

const LAUNCHERS = {chromium, firefox, webkit};

async function execute(
  run: RunRecord,
  steps: ExpandedStep[],
  env: StudioEnv
): Promise<RunRecord> {
  const dir = artifactsDir(run.id);
  fs.mkdirSync(dir, {recursive: true});
  const started = Date.now();
  let browser: Browser | null = null;
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const push = (list: string[], line: string) => {
    if (list.length < 30) list.push(line.slice(0, 500));
  };

  try {
    try {
      browser = await LAUNCHERS[env.browser].launch({headless: env.headless});
    } catch (e) {
      const msg = (e as Error).message;
      if (/Executable doesn't exist|browserType\.launch/i.test(msg) && /install/i.test(msg)) {
        throw new Error(
          `${env.browser} is not installed on this machine. Run: npx playwright install ${env.browser}`
        );
      }
      throw e;
    }
    const context = await browser.newContext({
      viewport: env.viewport,
      ignoreHTTPSErrors: false,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(env.timeoutMs);
    page.setDefaultNavigationTimeout(Math.max(env.timeoutMs, 15_000));
    page.on('console', (m) => {
      if (m.type() === 'error') push(consoleErrors, m.text());
    });
    page.on('pageerror', (err) => push(consoleErrors, err.message));
    page.on('requestfailed', (req) =>
      push(failedRequests, `${req.method()} ${req.url()} — ${req.failure()?.errorText ?? 'failed'}`)
    );
    page.on('response', (res) => {
      if (res.status() >= 400) push(failedRequests, `${res.status()} ${res.request().method()} ${res.url()}`);
    });

    let failed = false;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      patchRun(run.id, (r) => {
        r.steps[i].status = 'running';
      });
      const t0 = Date.now();
      try {
        const outcome = await runStep(page, step, env, dir, i);
        patchRun(run.id, (r) => {
          Object.assign(r.steps[i], {
            status: 'passed',
            durationMs: Date.now() - t0,
            note: outcome.note,
            screenshot: outcome.screenshot,
          } satisfies Partial<StepResult>);
        });
      } catch (e) {
        failed = true;
        const shot = `step-${i + 1}-failed.png`;
        const ok = await page
          .screenshot({path: path.join(dir, shot)})
          .then(() => true)
          .catch(() => false);
        patchRun(run.id, (r) => {
          Object.assign(r.steps[i], {
            status: 'failed',
            durationMs: Date.now() - t0,
            error: friendlyError(e, step, env),
            screenshot: ok ? shot : undefined,
          } satisfies Partial<StepResult>);
          for (const s of r.steps.slice(i + 1)) s.status = 'skipped';
        });
        break;
      }
    }

    const finalShot = 'final.png';
    const finalOk = await page
      .screenshot({path: path.join(dir, finalShot)})
      .then(() => true)
      .catch(() => false);
    const finalUrl = page.url();

    return patchRun(run.id, (r) => {
      r.status = failed ? 'failed' : 'passed';
      r.finishedAt = new Date().toISOString();
      r.durationMs = Date.now() - started;
      r.finalScreenshot = finalOk ? finalShot : undefined;
      r.finalUrl = finalUrl;
      r.consoleErrors = consoleErrors;
      r.failedRequests = failedRequests;
    })!;
  } catch (e) {
    return patchRun(run.id, (r) => {
      r.status = 'error';
      r.error = (e as Error).message.split('\n')[0];
      r.finishedAt = new Date().toISOString();
      r.durationMs = Date.now() - started;
      r.consoleErrors = consoleErrors;
      r.failedRequests = failedRequests;
      for (const s of r.steps) {
        if (s.status === 'pending' || s.status === 'running') s.status = 'skipped';
      }
    })!;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

function locate(page: Page, t: Target, vars: Record<string, string>): Locator {
  const value = substitute(t.value, vars);
  switch (t.by) {
    case 'text':
      return page.getByText(value, {exact: Boolean(t.exact)});
    case 'role':
      return page.getByRole((t.role ?? 'button') as Parameters<Page['getByRole']>[0], {
        name: value,
        exact: Boolean(t.exact),
      });
    case 'label':
      return page.getByLabel(value, {exact: Boolean(t.exact)});
    case 'placeholder':
      return page.getByPlaceholder(value);
    case 'testid':
      return page.getByTestId(value);
    case 'css':
      return page.locator(value);
  }
}

/** Polls until `check` passes or the timeout elapses. */
async function until(
  timeoutMs: number,
  check: () => Promise<{ok: boolean; actual: string}>,
  describe: (actual: string) => string
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  for (;;) {
    try {
      const r = await check();
      if (r.ok) return;
      last = r.actual;
    } catch (e) {
      last = (e as Error).message.split('\n')[0];
    }
    if (Date.now() > deadline) throw new Error(describe(last));
    await new Promise((res) => setTimeout(res, 150));
  }
}

async function runStep(
  page: Page,
  step: ExpandedStep,
  env: StudioEnv,
  dir: string,
  index: number
): Promise<{note?: string; screenshot?: string}> {
  const b = step.block;
  const vars = env.variables;
  const value = substitute(b.value ?? '', vars);
  const timeout = env.timeoutMs;
  const all = b.target?.value ? locate(page, b.target, vars) : null;
  const el = all?.first() ?? null;

  // Note when a target is ambiguous; the first match is used.
  let note: string | undefined;
  const noteAmbiguity = async () => {
    if (!all) return;
    const n = await all.count().catch(() => 0);
    if (n > 1) note = `${n} elements matched; used the first. Make the target more specific if this is wrong.`;
  };

  switch (b.kind) {
    // Wait for "load" (all scripts ran), not just "domcontentloaded": on SPA
    // sites typing before hydration is silently overwritten by the framework.
    case 'open':
      await page.goto(resolveUrl(value, env.baseUrl), {waitUntil: 'load'});
      break;
    case 'reload':
      await page.reload({waitUntil: 'load'});
      break;
    case 'back':
      await page.goBack({waitUntil: 'load'});
      break;
    case 'click':
      await el!.click();
      await noteAmbiguity();
      break;
    case 'doubleClick':
      await el!.dblclick();
      await noteAmbiguity();
      break;
    case 'hover':
      await el!.hover();
      await noteAmbiguity();
      break;
    case 'fill':
      await el!.fill(value);
      await noteAmbiguity();
      break;
    case 'press':
      if (el) await el.press(value);
      else await page.keyboard.press(value);
      break;
    case 'select':
      await el!.selectOption(value).catch(async (e) => {
        // Fall back to matching the visible label.
        const res = await el!.selectOption({label: value}).catch(() => null);
        if (!res) throw e;
      });
      break;
    case 'check':
      await el!.check();
      break;
    case 'uncheck':
      await el!.uncheck();
      break;
    case 'expectVisible':
      await el!.waitFor({state: 'visible', timeout});
      await noteAmbiguity();
      break;
    case 'expectHidden':
      await all!.first().waitFor({state: 'hidden', timeout});
      break;
    case 'expectText':
      await until(
        timeout,
        async () => {
          const text = (await el!.innerText({timeout: 1000})).replace(/\s+/g, ' ').trim();
          return {ok: text.includes(value), actual: text};
        },
        (actual) => `Expected text containing "${value}", found "${actual.slice(0, 200)}".`
      );
      break;
    case 'expectValue':
      await until(
        timeout,
        async () => {
          const v = await el!.inputValue({timeout: 1000});
          return {ok: v === value, actual: v};
        },
        (actual) => `Expected value "${value}", found "${actual}".`
      );
      break;
    case 'expectCount': {
      const want = Number(value);
      await until(
        timeout,
        async () => {
          const n = await all!.count();
          return {ok: n === want, actual: String(n)};
        },
        (actual) => `Expected ${want} matching elements, found ${actual}.`
      );
      break;
    }
    case 'expectUrl':
      await until(
        timeout,
        async () => ({ok: page.url().includes(value), actual: page.url()}),
        (actual) => `Expected the address to contain "${value}", it is ${actual}.`
      );
      break;
    case 'expectTitle':
      await until(
        timeout,
        async () => {
          const t = await page.title();
          return {ok: t.includes(value), actual: t};
        },
        (actual) => `Expected the title to contain "${value}", it is "${actual}".`
      );
      break;
    case 'wait':
      await page.waitForTimeout(Math.min(60, Number(value) || 0) * 1000);
      break;
    case 'waitFor':
      await el!.waitFor({state: 'visible', timeout});
      break;
    case 'screenshot': {
      const file = `step-${index + 1}.png`;
      await page.screenshot({path: path.join(dir, file)});
      return {screenshot: file};
    }
    case 'useBlock':
      // Expanded before execution; never reached.
      break;
  }
  return {note};
}

/** Short, plain-language error for the report. */
function friendlyError(e: unknown, step: ExpandedStep, env: StudioEnv): string {
  const raw = e instanceof Error ? e.message : String(e);
  const first = raw.split('\n')[0].replace(/^(locator|page|elementHandle)\.\w+:\s*/, '');
  const secs = Math.round(env.timeoutMs / 1000);
  const target = describeTarget(step.block.target);
  if (/Timeout \d+ms exceeded/.test(raw)) {
    if (step.block.kind === 'open') return `The page did not load within the time limit (${first}).`;
    if (/not visible|hidden|waiting for .*to be visible/i.test(raw) || step.block.target) {
      return `Could not find ${target} within ${secs} s. Check the target, or add "Wait for" before this block.`;
    }
  }
  if (/net::ERR_|NS_ERROR_|Could not connect/i.test(raw)) {
    return `Could not reach the site: ${first}. Is the base URL in .env.json correct and running?`;
  }
  if (/strict mode violation/i.test(raw)) {
    return `${target} matches more than one element. Make the target more specific.`;
  }
  return first.slice(0, 400);
}
