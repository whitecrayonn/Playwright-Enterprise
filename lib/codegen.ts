// Turns a block stack into a standalone @playwright/test spec for export.
// Pure: safe in the browser.
import {expandBlocks, variablesIn} from './blocks';
import type {Block, StudioDoc, StudioEnv, Target} from './studio-types';

const q = (s: string) => JSON.stringify(s);

/** A string literal, or a template literal reading process.env for {{VARS}}. */
function lit(text: string): string {
  if (variablesIn(text).length === 0) return q(text);
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  return (
    '`' +
    escaped.replace(
      /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g,
      (_m, name: string) => `\${process.env.${name} ?? ''}`
    ) +
    '`'
  );
}

export function locatorCode(t: Target): string {
  const exact = t.exact ? ', exact: true' : '';
  switch (t.by) {
    case 'text':
      return `page.getByText(${lit(t.value)}${t.exact ? ', { exact: true }' : ''})`;
    case 'role':
      return `page.getByRole(${q(t.role ?? 'button')}, { name: ${lit(t.value)}${exact} })`;
    case 'label':
      return `page.getByLabel(${lit(t.value)}${t.exact ? ', { exact: true }' : ''})`;
    case 'placeholder':
      return `page.getByPlaceholder(${lit(t.value)})`;
    case 'testid':
      return `page.getByTestId(${lit(t.value)})`;
    case 'css':
      return `page.locator(${lit(t.value)})`;
  }
}

function stepCode(b: Block): string {
  const loc = b.target?.value ? `${locatorCode(b.target)}.first()` : '';
  const v = b.value ?? '';
  switch (b.kind) {
    case 'open':
      // Relative to baseURL (keeps a path prefix such as /app/), like the runner.
      return `await page.goto(${lit(/^https?:\/\//i.test(v) ? v : v.replace(/^\//, ''))});`;
    case 'reload':
      return 'await page.reload();';
    case 'back':
      return 'await page.goBack();';
    case 'click':
      return `await ${loc}.click();`;
    case 'doubleClick':
      return `await ${loc}.dblclick();`;
    case 'hover':
      return `await ${loc}.hover();`;
    case 'fill':
      return `await ${loc}.fill(${lit(v)});`;
    case 'press':
      return loc ? `await ${loc}.press(${lit(v)});` : `await page.keyboard.press(${lit(v)});`;
    case 'select':
      return `await ${loc}.selectOption(${lit(v)});`;
    case 'check':
      return `await ${loc}.check();`;
    case 'uncheck':
      return `await ${loc}.uncheck();`;
    case 'expectVisible':
      return `await expect(${loc}).toBeVisible();`;
    case 'expectHidden':
      return `await expect(${locatorCode(b.target!)}).toBeHidden();`;
    case 'expectText':
      return `await expect(${loc}).toContainText(${lit(v)});`;
    case 'expectValue':
      return `await expect(${loc}).toHaveValue(${lit(v)});`;
    case 'expectCount':
      return `await expect(${locatorCode(b.target!)}).toHaveCount(${Number(v) || 0});`;
    case 'expectUrl':
      return `await expect(page).toHaveURL(new RegExp(${q(escapeRegExp(v))}));`;
    case 'expectTitle':
      return `await expect(page).toHaveTitle(new RegExp(${q(escapeRegExp(v))}));`;
    case 'wait':
      return `await page.waitForTimeout(${Math.round((Number(v) || 0) * 1000)});`;
    case 'waitFor':
      return `await ${loc}.waitFor({ state: 'visible' });`;
    case 'screenshot':
      return `await page.screenshot({ path: 'screenshots/' + Date.now() + '.png' });`;
    case 'useBlock':
      return '// (saved block expanded above)';
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateSpec(
  doc: StudioDoc,
  docs: StudioDoc[],
  env: StudioEnv | null
): string {
  let steps;
  try {
    steps = expandBlocks(doc.blocks, docs);
  } catch (e) {
    return `// Cannot generate: ${(e as Error).message}`;
  }
  const vars = new Set<string>();
  for (const s of steps) {
    variablesIn(s.block.value).forEach((v) => vars.add(v));
    variablesIn(s.block.target?.value).forEach((v) => vars.add(v));
  }

  const lines: string[] = [];
  lines.push("import { test, expect } from '@playwright/test';");
  lines.push('');
  if (vars.size > 0) {
    lines.push(`// Set these before running: ${[...vars].join(', ')}`);
    lines.push('// (Playwright Studio reads them from .env.json → variables.)');
  }
  if (env) {
    lines.push('test.use({');
    lines.push(`  baseURL: ${q(env.baseUrl.endsWith('/') ? env.baseUrl : env.baseUrl + '/')},`);
    lines.push(`  viewport: { width: ${env.viewport.width}, height: ${env.viewport.height} },`);
    lines.push(`  actionTimeout: ${env.timeoutMs},`);
    lines.push('});');
    lines.push('');
  }
  lines.push(`test(${q(doc.name)}, async ({ page }) => {`);
  let lastVia: string | undefined;
  steps.forEach((s, i) => {
    if (s.via !== lastVia) {
      if (s.via) lines.push(`  // ── from saved block "${s.via}"`);
      lastVia = s.via;
    }
    lines.push(`  ${stepCode(s.block)} // ${i + 1}`);
  });
  lines.push('});');
  lines.push('');
  return lines.join('\n');
}
