// Runs real Chromium against a tiny local site. Needs: npx playwright install chromium
import test, {after, before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import type {Block, StudioDoc} from '../lib/studio-types';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-studio-'));
process.env.STUDIO_DATA_DIR = path.join(tmp, 'data');
process.env.STUDIO_ENV_PATH = path.join(tmp, '.env.json');

const LOGIN_PAGE = `<!doctype html><html><head><title>Sign in · Demo</title></head><body>
<form onsubmit="event.preventDefault(); location.href='/home?user=' + encodeURIComponent(document.getElementById('email').value)">
  <label for="email">Email</label><input id="email" placeholder="you@company.com">
  <label for="pw">Password</label><input id="pw" type="password">
  <select data-testid="team"><option value="a">Alpha</option><option value="b">Beta</option></select>
  <label><input type="checkbox" id="remember"> Remember me</label>
  <button type="submit">Sign in</button>
</form></body></html>`;

const HOME_PAGE = `<!doctype html><html><head><title>Home · Demo</title></head><body>
<h1 data-testid="greeting">Welcome</h1><ul><li>One</li><li>Two</li><li>Three</li></ul>
<script>document.querySelector('h1').textContent = 'Welcome ' + new URLSearchParams(location.search).get('user');</script>
</body></html>`;

let server: http.Server;
let baseUrl = '';

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (url.pathname === '/login') res.end(LOGIN_PAGE);
    else if (url.pathname === '/home') res.end(HOME_PAGE);
    else {
      res.statusCode = 404;
      res.end('<title>Not found</title>missing');
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fs.writeFileSync(
    process.env.STUDIO_ENV_PATH!,
    JSON.stringify({
      baseUrl,
      browser: 'chromium',
      headless: true,
      timeoutMs: 3000,
      viewport: {width: 1024, height: 700},
      variables: {USERNAME: 'qa@example.com', PASSWORD: 'pw'},
    })
  );
});

after(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(tmp, {recursive: true, force: true});
});

let seq = 0;
const b = (kind: Block['kind'], extra: Partial<Block> = {}): Block => ({id: `b${++seq}`, kind, ...extra});

async function addDoc(d: Omit<StudioDoc, 'createdAt' | 'updatedAt' | 'description'>) {
  const {updateData} = await import('../lib/store');
  updateData((data) => {
    data.docs.push({...d, description: '', createdAt: '', updatedAt: ''});
  });
}

test('a passing test runs in real Chromium, using a saved block and variables', async () => {
  const {startRun} = await import('../lib/runner');
  await addDoc({
    id: 'sb-login',
    kind: 'block',
    name: 'Log in',
    blocks: [
      b('open', {value: '/login'}),
      b('fill', {target: {by: 'label', value: 'Email'}, value: '{{USERNAME}}'}),
      b('fill', {target: {by: 'placeholder', value: 'you@company.com'}, value: '{{USERNAME}}'}),
      b('select', {target: {by: 'testid', value: 'team'}, value: 'Beta'}),
      b('check', {target: {by: 'label', value: 'Remember me'}}),
      b('click', {target: {by: 'role', role: 'button', value: 'Sign in'}}),
    ],
  });
  await addDoc({
    id: 't-pass',
    kind: 'test',
    name: 'Login lands on home',
    blocks: [
      b('useBlock', {ref: 'sb-login'}),
      b('expectUrl', {value: '/home'}),
      b('expectTitle', {value: 'Home'}),
      b('expectText', {target: {by: 'testid', value: 'greeting'}, value: 'Welcome qa@example.com'}),
      b('expectCount', {target: {by: 'css', value: 'li'}, value: '3'}),
      b('expectHidden', {target: {by: 'text', value: 'Sign in'}}),
      b('reload', {disabled: true}),
      b('screenshot'),
    ],
  });

  const {run, done} = startRun('t-pass');
  assert.equal(run.status, 'running');
  assert.equal(run.steps.length, 12, 'saved block expanded, disabled block dropped');
  const final = await done;

  const failed = final.steps.filter((s) => s.status !== 'passed');
  assert.equal(final.status, 'passed', JSON.stringify(failed, null, 2));
  assert.equal(final.steps[0].via, 'Log in');
  assert.ok(final.durationMs! > 0);
  assert.match(final.finalUrl!, /\/home\?user=qa%40example\.com$/);
  const dir = path.join(process.env.STUDIO_DATA_DIR!, 'artifacts', final.id);
  assert.ok(fs.existsSync(path.join(dir, 'final.png')));
  assert.ok(fs.existsSync(path.join(dir, final.steps[11].screenshot!)));
});

test('a failing check stops the run, explains why and keeps a screenshot', async () => {
  const {startRun} = await import('../lib/runner');
  await addDoc({
    id: 't-fail',
    kind: 'test',
    name: 'Wrong greeting',
    blocks: [
      b('open', {value: '/home?user=bob'}),
      b('expectText', {target: {by: 'testid', value: 'greeting'}, value: 'Goodbye'}),
      b('click', {target: {by: 'text', value: 'One'}}),
    ],
  });
  const final = await startRun('t-fail').done;
  assert.equal(final.status, 'failed');
  assert.equal(final.steps[0].status, 'passed');
  assert.equal(final.steps[1].status, 'failed');
  assert.match(final.steps[1].error!, /Expected text containing "Goodbye", found "Welcome bob"/);
  assert.equal(final.steps[2].status, 'skipped');
  const shot = path.join(process.env.STUDIO_DATA_DIR!, 'artifacts', final.id, final.steps[1].screenshot!);
  assert.ok(fs.existsSync(shot));
});

test('missing element gives a plain-language timeout; 404s are recorded', async () => {
  const {startRun} = await import('../lib/runner');
  await addDoc({
    id: 't-missing',
    kind: 'test',
    name: 'Missing button',
    blocks: [b('open', {value: '/nowhere'}), b('click', {target: {by: 'text', value: 'Does not exist'}})],
  });
  const final = await startRun('t-missing').done;
  assert.equal(final.status, 'failed');
  assert.match(final.steps[1].error!, /Could not find text "Does not exist" within 3 s/);
  assert.ok(final.failedRequests.some((r) => r.startsWith('404 GET')));
});

test('runs are refused while one is active, and for invalid stacks', async () => {
  const {startRun, RunRejected} = await import('../lib/runner');
  await addDoc({id: 't-slow', kind: 'test', name: 'Slow', blocks: [b('wait', {value: '1'})]});
  await addDoc({id: 't-bad', kind: 'test', name: 'Bad', blocks: [b('click')]});
  const first = startRun('t-slow');
  assert.throws(() => startRun('t-slow'), (e: unknown) => e instanceof RunRejected && e.status === 409);
  await first.done;
  assert.throws(() => startRun('t-bad'), (e: unknown) => e instanceof RunRejected && e.status === 400);
  assert.throws(() => startRun('nope'), (e: unknown) => e instanceof RunRejected && e.status === 404);
});
