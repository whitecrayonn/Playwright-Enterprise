// Server-only (uses node:fs): reads and writes `.env.json` in the project root.
import fs from 'node:fs';
import path from 'node:path';
import {validateEnv, type EnvValidation} from './env-schema';
import type {StudioEnv} from './studio-types';

export function envPath(): string {
  return process.env.STUDIO_ENV_PATH ?? path.join(process.cwd(), '.env.json');
}

export type EnvReadResult =
  | {state: 'missing'}
  | {state: 'invalid'; errors: Exclude<EnvValidation, {ok: true}>['errors']; raw: unknown}
  | {state: 'ok'; env: StudioEnv};

export function readEnv(): EnvReadResult {
  const file = envPath();
  if (!fs.existsSync(file)) return {state: 'missing'};
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return {
      state: 'invalid',
      errors: {file: `.env.json is not valid JSON: ${(e as Error).message}`},
      raw: null,
    };
  }
  const v = validateEnv(raw);
  return v.ok ? {state: 'ok', env: v.env} : {state: 'invalid', errors: v.errors, raw};
}

/** Validates, then writes atomically (temp file + rename). */
export function writeEnv(input: unknown): EnvValidation {
  const v = validateEnv(input);
  if (!v.ok) return v;
  const file = envPath();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(v.env, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
  return v;
}
