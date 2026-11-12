// Browser-side fetch wrappers. Every call throws ApiError with a readable message.
import type {EnvErrors} from './env-schema';
import type {Issue, RunRecord, StudioDoc, StudioEnv} from './studio-types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: Record<string, unknown>
  ) {
    super(message);
  }
  get issues(): Issue[] {
    return Array.isArray(this.body.issues) ? (this.body.issues as Issue[]) : [];
  }
  get envErrors(): EnvErrors {
    return (this.body.errors as EnvErrors) ?? {};
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {'Content-Type': 'application/json', ...(init?.headers ?? {})},
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Cannot reach the studio server. Is `npm run dev` still running?', 0, {});
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(String(body.error ?? `Request failed (${res.status})`), res.status, body);
  }
  return body as T;
}

export type ConfigResponse =
  | {state: 'missing'; file: string}
  | {state: 'invalid'; errors: EnvErrors; raw: unknown; file: string}
  | {state: 'ok'; env: StudioEnv; file: string};

export const api = {
  getConfig: () => call<ConfigResponse>('/api/config'),
  saveConfig: (env: StudioEnv) =>
    call<{state: 'ok'; env: StudioEnv; file: string}>('/api/config', {
      method: 'PUT',
      body: JSON.stringify(env),
    }),
  checkUrl: (baseUrl: string) =>
    call<{ok: boolean; status?: number; finalUrl?: string; error?: string; ms: number}>(
      '/api/config/check',
      {method: 'POST', body: JSON.stringify({baseUrl})}
    ),

  listDocs: () => call<{docs: StudioDoc[]}>('/api/docs'),
  createDoc: (input: {kind: StudioDoc['kind']; name: string; blocks?: StudioDoc['blocks']}) =>
    call<{doc: StudioDoc}>('/api/docs', {method: 'POST', body: JSON.stringify(input)}),
  duplicateDoc: (id: string) =>
    call<{doc: StudioDoc}>('/api/docs', {method: 'POST', body: JSON.stringify({duplicateOf: id})}),
  saveDoc: (id: string, patch: Partial<Pick<StudioDoc, 'name' | 'description' | 'blocks'>>) =>
    call<{doc: StudioDoc}>(`/api/docs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  deleteDoc: (id: string) =>
    call<{ok: true}>(`/api/docs/${encodeURIComponent(id)}`, {method: 'DELETE'}),

  listRuns: (testId?: string) =>
    call<{runs: RunRecord[]; activeRunId: string | null}>(
      `/api/runs${testId ? `?testId=${encodeURIComponent(testId)}` : ''}`
    ),
  getRun: (id: string) => call<{run: RunRecord}>(`/api/runs/${encodeURIComponent(id)}`),
  startRun: (testId: string) =>
    call<{run: RunRecord}>('/api/runs', {method: 'POST', body: JSON.stringify({testId})}),
};

export function artifactUrl(runId: string, file: string): string {
  return `/api/artifacts/${encodeURIComponent(runId)}/${encodeURIComponent(file)}`;
}
