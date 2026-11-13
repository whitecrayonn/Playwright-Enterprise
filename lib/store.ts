// Server-only (node:fs): tests, saved blocks and run history in
// `.data/studio.json`. Starts empty. Every call reads from disk so separate
// route bundles in Next.js never see stale in-memory copies.
import fs from 'node:fs';
import path from 'node:path';
import {newId} from './blocks';
import type {
  Block,
  BlockKind,
  RunRecord,
  StudioDoc,
  TargetBy,
} from './studio-types';
import {BLOCK_DEFS} from './blocks';

export interface StudioData {
  version: 1;
  docs: StudioDoc[];
  runs: RunRecord[];
  nextRunNumber: number;
}

const MAX_RUNS = 200;

export function dataDir(): string {
  return process.env.STUDIO_DATA_DIR ?? path.join(process.cwd(), '.data');
}

export function artifactsDir(runId?: string): string {
  const base = path.join(dataDir(), 'artifacts');
  return runId ? path.join(base, runId) : base;
}

function storeFile(): string {
  return path.join(dataDir(), 'studio.json');
}

function emptyData(): StudioData {
  return {version: 1, docs: [], runs: [], nextRunNumber: 1};
}

export function readData(): StudioData {
  const file = storeFile();
  if (!fs.existsSync(file)) return emptyData();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<StudioData>;
    return {
      version: 1,
      docs: Array.isArray(parsed.docs) ? parsed.docs : [],
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      nextRunNumber:
        typeof parsed.nextRunNumber === 'number' ? parsed.nextRunNumber : 1,
    };
  } catch {
    // Keep the broken file for inspection instead of silently overwriting it.
    const backup = `${file}.broken-${Date.now()}`;
    fs.copyFileSync(file, backup);
    return emptyData();
  }
}

function writeData(data: StudioData): void {
  fs.mkdirSync(dataDir(), {recursive: true});
  const file = storeFile();
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/** Read-modify-write. Synchronous, so calls in one process never interleave. */
export function updateData<T>(fn: (data: StudioData) => T): T {
  const data = readData();
  const result = fn(data);
  if (data.runs.length > MAX_RUNS) {
    const dropped = data.runs.splice(MAX_RUNS);
    for (const r of dropped) {
      fs.rmSync(artifactsDir(r.id), {recursive: true, force: true});
    }
  }
  writeData(data);
  return result;
}

/* ------------------------------------------------------------------ */
/* Input sanitising for documents coming from the browser              */
/* ------------------------------------------------------------------ */

const TARGET_BY = new Set(['text', 'role', 'label', 'placeholder', 'testid', 'css']);

export function sanitizeBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  const out: Block[] = [];
  for (const raw of input.slice(0, 500)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const kind = r.kind as BlockKind;
    if (!(kind in BLOCK_DEFS)) continue;
    const block: Block = {
      id: typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : newId(),
      kind,
    };
    if (typeof r.value === 'string') block.value = r.value.slice(0, 2000);
    if (typeof r.ref === 'string') block.ref = r.ref.slice(0, 40);
    if (r.disabled === true) block.disabled = true;
    if (typeof r.target === 'object' && r.target !== null) {
      const t = r.target as Record<string, unknown>;
      if (typeof t.by === 'string' && TARGET_BY.has(t.by)) {
        block.target = {
          by: t.by as TargetBy,
          value: typeof t.value === 'string' ? t.value.slice(0, 1000) : '',
        };
        if (typeof t.role === 'string') block.target.role = t.role.slice(0, 40);
        if (t.exact === true) block.target.exact = true;
      }
    }
    out.push(block);
  }
  return out;
}

export function cleanName(input: unknown, fallback: string): string {
  const s = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
  return (s || fallback).slice(0, 120);
}
