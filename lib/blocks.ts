// Block catalog and pure logic (validation, variables, expansion).
// Safe to import in the browser and on the server.
import type {
  Block,
  BlockKind,
  Issue,
  StudioDoc,
  Target,
  TargetBy,
} from './studio-types';

export type BlockCategory = 'navigate' | 'interact' | 'check' | 'wait' | 'other';

export interface ValueField {
  label: string;
  placeholder: string;
  type: 'text' | 'url' | 'number' | 'key';
  required: boolean;
  help?: string;
}

export interface BlockDef {
  kind: BlockKind;
  category: BlockCategory;
  /** Verb shown on the block, e.g. "Click". */
  title: string;
  description: string;
  needsTarget: boolean;
  /** For 'press': a target is optional (press on the page). */
  targetOptional?: boolean;
  value?: ValueField;
}

export const CATEGORIES: {id: BlockCategory | 'saved'; label: string; hint: string}[] = [
  {id: 'navigate', label: 'Navigate', hint: 'Open pages and move between them'},
  {id: 'interact', label: 'Interact', hint: 'Click, type and choose like a user'},
  {id: 'check', label: 'Check', hint: 'Fail the test when the page is wrong'},
  {id: 'wait', label: 'Wait', hint: 'Pause until something happens'},
  {id: 'other', label: 'Capture', hint: 'Keep evidence of the run'},
  {id: 'saved', label: 'Saved blocks', hint: 'Your reusable stacks'},
];

export const BLOCK_DEFS: Record<BlockKind, BlockDef> = {
  open: {
    kind: 'open',
    category: 'navigate',
    title: 'Open page',
    description: 'Go to a path on the base URL, or a full address.',
    needsTarget: false,
    value: {label: 'Path or URL', placeholder: '/login', type: 'url', required: true, help: 'A path like /login is joined to the base URL from .env.json.'},
  },
  reload: {kind: 'reload', category: 'navigate', title: 'Reload page', description: 'Reload the current page.', needsTarget: false},
  back: {kind: 'back', category: 'navigate', title: 'Go back', description: 'Press the browser back button.', needsTarget: false},

  click: {kind: 'click', category: 'interact', title: 'Click', description: 'Click an element.', needsTarget: true},
  doubleClick: {kind: 'doubleClick', category: 'interact', title: 'Double-click', description: 'Double-click an element.', needsTarget: true},
  hover: {kind: 'hover', category: 'interact', title: 'Hover', description: 'Move the mouse over an element.', needsTarget: true},
  fill: {
    kind: 'fill',
    category: 'interact',
    title: 'Type into',
    description: 'Replace the text in an input with new text.',
    needsTarget: true,
    value: {label: 'Text', placeholder: '{{USERNAME}}', type: 'text', required: false, help: 'Leave empty to clear the field.'},
  },
  press: {
    kind: 'press',
    category: 'interact',
    title: 'Press key',
    description: 'Press a key, optionally inside an element.',
    needsTarget: true,
    targetOptional: true,
    value: {label: 'Key', placeholder: 'Enter', type: 'key', required: true, help: 'Examples: Enter, Tab, Escape, Control+A.'},
  },
  select: {
    kind: 'select',
    category: 'interact',
    title: 'Choose option',
    description: 'Pick an option in a dropdown by its label or value.',
    needsTarget: true,
    value: {label: 'Option', placeholder: 'Hardware', type: 'text', required: true},
  },
  check: {kind: 'check', category: 'interact', title: 'Tick', description: 'Tick a checkbox or radio button.', needsTarget: true},
  uncheck: {kind: 'uncheck', category: 'interact', title: 'Untick', description: 'Untick a checkbox.', needsTarget: true},

  expectVisible: {kind: 'expectVisible', category: 'check', title: 'Check visible', description: 'Fail unless the element is shown.', needsTarget: true},
  expectHidden: {kind: 'expectHidden', category: 'check', title: 'Check hidden', description: 'Fail unless the element is gone or hidden.', needsTarget: true},
  expectText: {
    kind: 'expectText',
    category: 'check',
    title: 'Check text',
    description: 'Fail unless the element contains this text.',
    needsTarget: true,
    value: {label: 'Contains', placeholder: 'Welcome back', type: 'text', required: true},
  },
  expectValue: {
    kind: 'expectValue',
    category: 'check',
    title: 'Check input value',
    description: 'Fail unless the input holds exactly this value.',
    needsTarget: true,
    value: {label: 'Equals', placeholder: '5', type: 'text', required: false},
  },
  expectCount: {
    kind: 'expectCount',
    category: 'check',
    title: 'Check count',
    description: 'Fail unless exactly this many elements match.',
    needsTarget: true,
    value: {label: 'Count', placeholder: '3', type: 'number', required: true},
  },
  expectUrl: {
    kind: 'expectUrl',
    category: 'check',
    title: 'Check address',
    description: 'Fail unless the page address contains this text.',
    needsTarget: false,
    value: {label: 'Contains', placeholder: '/dashboard', type: 'text', required: true},
  },
  expectTitle: {
    kind: 'expectTitle',
    category: 'check',
    title: 'Check page title',
    description: 'Fail unless the tab title contains this text.',
    needsTarget: false,
    value: {label: 'Contains', placeholder: 'Dashboard', type: 'text', required: true},
  },

  wait: {
    kind: 'wait',
    category: 'wait',
    title: 'Wait',
    description: 'Pause for a fixed time. Prefer "Wait for" when possible.',
    needsTarget: false,
    value: {label: 'Seconds', placeholder: '1', type: 'number', required: true},
  },
  waitFor: {kind: 'waitFor', category: 'wait', title: 'Wait for', description: 'Wait until the element appears.', needsTarget: true},

  screenshot: {kind: 'screenshot', category: 'other', title: 'Screenshot', description: 'Save a picture of the page into the run report.', needsTarget: false},

  useBlock: {kind: 'useBlock', category: 'other', title: 'Use block', description: 'Run every step of a saved block here.', needsTarget: false},
};

export const PALETTE_ORDER: BlockKind[] = [
  'open', 'reload', 'back',
  'click', 'fill', 'press', 'select', 'check', 'uncheck', 'hover', 'doubleClick',
  'expectVisible', 'expectText', 'expectUrl', 'expectTitle', 'expectValue', 'expectCount', 'expectHidden',
  'waitFor', 'wait',
  'screenshot',
];

export const TARGET_BY: {id: TargetBy; label: string; placeholder: string; help: string}[] = [
  {id: 'text', label: 'text', placeholder: 'Sign in', help: 'Visible text on the element.'},
  {id: 'role', label: 'role', placeholder: 'Sign in', help: 'Accessible name of a button, link, textbox, …'},
  {id: 'label', label: 'label', placeholder: 'Email', help: 'The label of a form field.'},
  {id: 'placeholder', label: 'placeholder', placeholder: 'you@company.com', help: 'Grey hint text inside an input.'},
  {id: 'testid', label: 'test id', placeholder: 'login-submit', help: 'Value of data-testid.'},
  {id: 'css', label: 'CSS', placeholder: '#login button[type=submit]', help: 'Any CSS selector.'},
];

export const ROLES = [
  'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'heading',
  'tab', 'menuitem', 'option', 'listitem', 'row', 'cell', 'img', 'dialog', 'alert',
];

export const CATEGORY_STYLE: Record<BlockCategory | 'saved', {block: string; chip: string; dot: string}> = {
  navigate: {
    block: 'bg-sky-50 border-sky-300 dark:bg-sky-950/40 dark:border-sky-800',
    chip: 'bg-sky-600 text-white',
    dot: 'bg-sky-500',
  },
  interact: {
    block: 'bg-violet-50 border-violet-300 dark:bg-violet-950/40 dark:border-violet-800',
    chip: 'bg-violet-600 text-white',
    dot: 'bg-violet-500',
  },
  check: {
    block: 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800',
    chip: 'bg-emerald-700 text-white',
    dot: 'bg-emerald-500',
  },
  wait: {
    block: 'bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800',
    chip: 'bg-amber-600 text-white',
    dot: 'bg-amber-500',
  },
  other: {
    block: 'bg-slate-50 border-slate-300 dark:bg-slate-800/60 dark:border-slate-700',
    chip: 'bg-slate-600 text-white',
    dot: 'bg-slate-500',
  },
  saved: {
    block: 'bg-rose-50 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800',
    chip: 'bg-rose-600 text-white',
    dot: 'bg-rose-500',
  },
};

export function styleFor(kind: BlockKind) {
  return kind === 'useBlock' ? CATEGORY_STYLE.saved : CATEGORY_STYLE[BLOCK_DEFS[kind].category];
}

export function newId(prefix = 'b'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

export function createBlock(kind: BlockKind, ref?: string): Block {
  const def = BLOCK_DEFS[kind];
  const block: Block = {id: newId(), kind};
  if (def.needsTarget && !def.targetOptional) block.target = {by: 'text', value: ''};
  if (def.value) block.value = kind === 'wait' ? '1' : '';
  if (kind === 'useBlock') block.ref = ref;
  return block;
}

/* ------------------------------------------------------------------ */
/* Variables                                                           */
/* ------------------------------------------------------------------ */

const VAR_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

export function variablesIn(text: string | undefined): string[] {
  if (!text) return [];
  return [...text.matchAll(VAR_PATTERN)].map((m) => m[1]);
}

export function substitute(text: string, vars: Record<string, string>): string {
  return text.replace(VAR_PATTERN, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : whole
  );
}

/* ------------------------------------------------------------------ */
/* Human-readable labels                                               */
/* ------------------------------------------------------------------ */

export function describeTarget(t: Target | undefined): string {
  if (!t || !t.value) return 'element';
  switch (t.by) {
    case 'role':
      return `${t.role ?? 'element'} "${t.value}"`;
    case 'testid':
      return `[test id ${t.value}]`;
    case 'css':
      return t.value;
    default:
      return `${t.by} "${t.value}"`;
  }
}

export function blockLabel(block: Block, docs: StudioDoc[] = []): string {
  const def = BLOCK_DEFS[block.kind];
  const v = block.value ?? '';
  switch (block.kind) {
    case 'open':
      return `Open ${v || 'page'}`;
    case 'fill':
      return `Type "${v}" into ${describeTarget(block.target)}`;
    case 'press':
      return block.target?.value
        ? `Press ${v} in ${describeTarget(block.target)}`
        : `Press ${v}`;
    case 'select':
      return `Choose "${v}" in ${describeTarget(block.target)}`;
    case 'expectText':
      return `Check ${describeTarget(block.target)} contains "${v}"`;
    case 'expectValue':
      return `Check ${describeTarget(block.target)} value is "${v}"`;
    case 'expectCount':
      return `Check ${v} × ${describeTarget(block.target)}`;
    case 'expectUrl':
      return `Check address contains "${v}"`;
    case 'expectTitle':
      return `Check title contains "${v}"`;
    case 'wait':
      return `Wait ${v || '?'} s`;
    case 'useBlock': {
      const doc = docs.find((d) => d.id === block.ref);
      return `Use block "${doc?.name ?? 'missing'}"`;
    }
    default:
      return def.needsTarget
        ? `${def.title} ${describeTarget(block.target)}`
        : def.title;
  }
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** Saved blocks referenced (directly or nested) by `blocks`; detects cycles. */
function findCycle(
  startId: string | null,
  blocks: Block[],
  docs: StudioDoc[],
  trail: string[]
): string[] | null {
  for (const b of blocks) {
    if (b.kind !== 'useBlock' || !b.ref) continue;
    if (b.ref === startId || trail.includes(b.ref)) return [...trail, b.ref];
    const doc = docs.find((d) => d.id === b.ref && d.kind === 'block');
    if (!doc) continue;
    const found = findCycle(startId, doc.blocks, docs, [...trail, b.ref]);
    if (found) return found;
  }
  return null;
}

/**
 * Returns problems that would stop a run. `selfId` is the document being
 * edited, so a saved block cannot include itself.
 */
export function validateBlocks(
  blocks: Block[],
  docs: StudioDoc[],
  variables: Record<string, string> | null,
  selfId: string | null = null
): Issue[] {
  const issues: Issue[] = [];
  const active = blocks.filter((b) => !b.disabled);
  if (active.length === 0) {
    issues.push({blockId: '', message: 'Add at least one enabled block.'});
  }

  for (const b of blocks) {
    if (b.disabled) continue;
    const def = BLOCK_DEFS[b.kind];
    if (!def) {
      issues.push({blockId: b.id, message: `Unknown block type "${b.kind}".`});
      continue;
    }
    if (def.needsTarget && !def.targetOptional && !b.target?.value?.trim()) {
      issues.push({blockId: b.id, message: `${def.title}: say which element.`});
    }
    if (b.target?.by === 'role' && b.target.value && !b.target.role) {
      issues.push({blockId: b.id, message: `${def.title}: pick a role (button, link, …).`});
    }
    if (def.value?.required && !(b.value ?? '').trim()) {
      issues.push({blockId: b.id, message: `${def.title}: fill in "${def.value.label}".`});
    }
    if (def.value?.type === 'number' && (b.value ?? '').trim() !== '') {
      const n = Number(b.value);
      if (!Number.isFinite(n) || n < 0) {
        issues.push({blockId: b.id, message: `${def.title}: "${b.value}" is not a positive number.`});
      } else if (b.kind === 'wait' && n > 60) {
        issues.push({blockId: b.id, message: 'Wait: keep fixed waits at 60 seconds or less.'});
      }
    }
    if (b.kind === 'useBlock') {
      const doc = docs.find((d) => d.id === b.ref && d.kind === 'block');
      if (!doc) {
        issues.push({blockId: b.id, message: 'Use block: the saved block no longer exists.'});
      }
    }
    if (variables) {
      for (const name of [...variablesIn(b.value), ...variablesIn(b.target?.value)]) {
        if (!(name in variables)) {
          issues.push({blockId: b.id, message: `{{${name}}} is not defined in .env.json.`});
        }
      }
    }
  }

  const cycle = findCycle(selfId, blocks, docs, selfId ? [selfId] : []);
  if (cycle) {
    const names = cycle.map((id) => docs.find((d) => d.id === id)?.name ?? id);
    issues.push({blockId: '', message: `Saved blocks include each other in a loop: ${names.join(' → ')}.`});
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* Expansion: saved blocks are inlined into a flat list of steps       */
/* ------------------------------------------------------------------ */

export interface ExpandedStep {
  block: Block;
  /** Top-level block id in the test. */
  rootId: string;
  /** Name of the saved block this step came from, if any. */
  via?: string;
}

export function expandBlocks(
  blocks: Block[],
  docs: StudioDoc[],
  depth = 0,
  rootId?: string,
  via?: string
): ExpandedStep[] {
  if (depth > 8) throw new Error('Saved blocks are nested too deeply (more than 8 levels).');
  const out: ExpandedStep[] = [];
  for (const b of blocks) {
    if (b.disabled) continue;
    const root = rootId ?? b.id;
    if (b.kind === 'useBlock') {
      const doc = docs.find((d) => d.id === b.ref && d.kind === 'block');
      if (!doc) throw new Error('A "Use block" points to a saved block that no longer exists.');
      out.push(...expandBlocks(doc.blocks, docs, depth + 1, root, doc.name));
    } else {
      out.push({block: b, rootId: root, via});
    }
  }
  return out;
}

/** Joins a path to the base URL; full http(s) URLs pass through. */
export function resolveUrl(value: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const path = value.startsWith('/') ? value.slice(1) : value;
  return new URL(path, base).toString();
}
