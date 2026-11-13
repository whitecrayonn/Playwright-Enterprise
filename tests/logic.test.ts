import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blockLabel,
  createBlock,
  expandBlocks,
  resolveUrl,
  substitute,
  validateBlocks,
  variablesIn,
} from '../lib/blocks';
import {generateSpec} from '../lib/codegen';
import {validateEnv} from '../lib/env-schema';
import type {Block, StudioDoc, StudioEnv} from '../lib/studio-types';

const now = '2026-11-12T00:00:00.000Z';
const doc = (id: string, kind: StudioDoc['kind'], blocks: Block[], name = id): StudioDoc => ({
  id,
  kind,
  name,
  description: '',
  blocks,
  createdAt: now,
  updatedAt: now,
});

const env: StudioEnv = {
  baseUrl: 'https://staging.example.com/app',
  browser: 'chromium',
  headless: true,
  timeoutMs: 5000,
  viewport: {width: 1280, height: 720},
  variables: {USERNAME: 'qa@example.com', PASSWORD: 's3cret'},
};

/* ---------------- .env.json validation ---------------- */

test('env: valid file normalises trailing slash and defaults', () => {
  const v = validateEnv({baseUrl: 'https://staging.example.com/app/'});
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.equal(v.env.baseUrl, 'https://staging.example.com/app');
  assert.equal(v.env.browser, 'chromium');
  assert.equal(v.env.timeoutMs, 10000);
  assert.deepEqual(v.env.variables, {});
});

test('env: rejects missing, non-http and malformed base URLs', () => {
  for (const baseUrl of ['', '   ', 'ftp://x.com', 'not a url', 'javascript:alert(1)']) {
    const v = validateEnv({baseUrl});
    assert.equal(v.ok, false, baseUrl);
    if (!v.ok) assert.ok(v.errors.baseUrl, baseUrl);
  }
});

test('env: timeout and viewport boundaries', () => {
  const base = {baseUrl: 'http://localhost:3000'};
  assert.equal(validateEnv({...base, timeoutMs: 999}).ok, false);
  assert.equal(validateEnv({...base, timeoutMs: 1000}).ok, true);
  assert.equal(validateEnv({...base, timeoutMs: 120000}).ok, true);
  assert.equal(validateEnv({...base, timeoutMs: 120001}).ok, false);
  assert.equal(validateEnv({...base, timeoutMs: 'abc'}).ok, false);
  assert.equal(validateEnv({...base, viewport: {width: 319, height: 800}}).ok, false);
  assert.equal(validateEnv({...base, viewport: {width: 320, height: 240}}).ok, true);
  assert.equal(validateEnv({...base, viewport: {width: 3841, height: 800}}).ok, false);
});

test('env: variable names and values', () => {
  const base = {baseUrl: 'http://localhost:3000'};
  assert.equal(validateEnv({...base, variables: {'1BAD': 'x'}}).ok, false);
  assert.equal(validateEnv({...base, variables: {'has space': 'x'}}).ok, false);
  assert.equal(validateEnv({...base, variables: {OK: {nested: true}}}).ok, false);
  const v = validateEnv({...base, variables: {RETRIES: 3, FLAG: true, NAME: 'a'}});
  assert.equal(v.ok, true);
  if (v.ok) assert.deepEqual(v.env.variables, {RETRIES: '3', FLAG: 'true', NAME: 'a'});
  assert.equal(validateEnv([]).ok, false);
  assert.equal(validateEnv(null).ok, false);
});

/* ---------------- variables & URLs ---------------- */

test('variables: found, substituted, unknown left visible', () => {
  assert.deepEqual(variablesIn('{{A}} and {{ B_2 }} and {{a-b}}'), ['A', 'B_2']);
  assert.equal(substitute('Hi {{USERNAME}} / {{MISSING}}', env.variables), 'Hi qa@example.com / {{MISSING}}');
  assert.equal(substitute('', env.variables), '');
});

test('resolveUrl keeps the base path prefix and passes full URLs through', () => {
  assert.equal(resolveUrl('/login', env.baseUrl), 'https://staging.example.com/app/login');
  assert.equal(resolveUrl('login?x=1', env.baseUrl), 'https://staging.example.com/app/login?x=1');
  assert.equal(resolveUrl('', env.baseUrl), 'https://staging.example.com/app/');
  assert.equal(resolveUrl('https://other.test/a', env.baseUrl), 'https://other.test/a');
});

/* ---------------- block validation ---------------- */

test('validate: empty stack and all-disabled stack are rejected', () => {
  assert.equal(validateBlocks([], [], env.variables).length, 1);
  const b = {...createBlock('reload'), disabled: true};
  assert.equal(validateBlocks([b], [], env.variables).length, 1);
});

test('validate: missing target, missing value, bad numbers, unknown variable', () => {
  const click = createBlock('click');
  const open = createBlock('open');
  const wait = {...createBlock('wait'), value: '61'};
  const count = {...createBlock('expectCount'), target: {by: 'css' as const, value: 'li'}, value: '-1'};
  const fill = {...createBlock('fill'), target: {by: 'label' as const, value: 'Email'}, value: '{{NOPE}}'};
  const role = {...createBlock('click'), target: {by: 'role' as const, value: 'Save'}};
  const issues = validateBlocks([click, open, wait, count, fill, role], [], env.variables);
  const byBlock = (id: string) => issues.filter((i) => i.blockId === id).map((i) => i.message);
  assert.match(byBlock(click.id)[0], /which element/);
  assert.match(byBlock(open.id)[0], /Path or URL/);
  assert.match(byBlock(wait.id)[0], /60 seconds/);
  assert.match(byBlock(count.id)[0], /not a positive number/);
  assert.match(byBlock(fill.id)[0], /NOPE/);
  assert.match(byBlock(role.id)[0], /pick a role/);
});

test('validate: press works without a target; fill may be empty', () => {
  const press = {...createBlock('press'), value: 'Enter'};
  const fill = {...createBlock('fill'), target: {by: 'label' as const, value: 'Search'}, value: ''};
  assert.deepEqual(validateBlocks([press, fill], [], env.variables), []);
});

test('saved blocks: expansion, missing reference and cycles', () => {
  const login = doc('sb-login', 'block', [
    {...createBlock('open'), value: '/login'},
    {...createBlock('fill'), target: {by: 'label', value: 'Email'}, value: '{{USERNAME}}'},
  ], 'Login');
  const use = {...createBlock('useBlock', 'sb-login')};
  const t = doc('t-1', 'test', [use, {...createBlock('expectUrl'), value: '/home'}]);
  const steps = expandBlocks(t.blocks, [login, t]);
  assert.equal(steps.length, 3);
  assert.equal(steps[0].via, 'Login');
  assert.equal(steps[0].rootId, use.id);
  assert.equal(steps[2].via, undefined);

  const dangling = createBlock('useBlock', 'sb-gone');
  assert.match(validateBlocks([dangling], [login], null)[0].message, /no longer exists/);
  assert.throws(() => expandBlocks([dangling], [login]));

  const a = doc('sb-a', 'block', [createBlock('useBlock', 'sb-b')], 'A');
  const b = doc('sb-b', 'block', [createBlock('useBlock', 'sb-a')], 'B');
  const cycle = validateBlocks(a.blocks, [a, b], null, 'sb-a');
  assert.ok(cycle.some((i) => /loop/.test(i.message)));
  const self = validateBlocks([createBlock('useBlock', 'sb-a')], [a, b], null, 'sb-a');
  assert.ok(self.some((i) => /loop/.test(i.message)));
});

test('labels read like sentences', () => {
  const fill = {...createBlock('fill'), target: {by: 'label' as const, value: 'Email'}, value: 'x'};
  assert.equal(blockLabel(fill), 'Type "x" into label "Email"');
  const click = {...createBlock('click'), target: {by: 'role' as const, role: 'button', value: 'Save'}};
  assert.equal(blockLabel(click), 'Click button "Save"');
});

/* ---------------- code generation ---------------- */

test('codegen: locators, variables via process.env, base path kept', () => {
  const t = doc('t-1', 'test', [
    {...createBlock('open'), value: '/login'},
    {...createBlock('fill'), target: {by: 'label', value: 'Email'}, value: '{{USERNAME}}'},
    {...createBlock('click'), target: {by: 'role', role: 'button', value: 'Sign in'}},
    {...createBlock('expectText'), target: {by: 'testid', value: 'greeting'}, value: 'Hello `you` ${x}'},
    {...createBlock('expectUrl'), value: '/home?tab=1'},
  ], 'Login works');
  const code = generateSpec(t, [t], env);
  assert.match(code, /test\("Login works"/);
  assert.match(code, /baseURL: "https:\/\/staging\.example\.com\/app\/"/);
  assert.match(code, /page\.goto\("login"\)/);
  assert.match(code, /getByLabel\("Email"\)\.first\(\)\.fill\(`\$\{process\.env\.USERNAME \?\? ''\}`\)/);
  assert.match(code, /getByRole\("button", \{ name: "Sign in" \}\)/);
  assert.match(code, /toContainText\("Hello `you` \$\{x\}"\)/);
  assert.match(code, /toHaveURL\(new RegExp\("\/home\\\\\?tab=1"\)\)/);
  assert.ok(!code.includes('s3cret'), 'variable values never appear in exported code');
});
