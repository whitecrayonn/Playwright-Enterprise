import {fail, json, readBody} from '@/lib/http';
import {RunRejected, activeRunId, reconcileStaleRuns, startRun} from '@/lib/runner';
import {readData} from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  reconcileStaleRuns();
  const testId = new URL(req.url).searchParams.get('testId');
  const runs = readData().runs.filter((r) => !testId || r.testId === testId);
  return json({runs, activeRunId: activeRunId()});
}

export async function POST(req: Request) {
  const body = await readBody(req);
  const testId = typeof body?.testId === 'string' ? body.testId : '';
  if (!testId) return fail('Say which test to run.');
  reconcileStaleRuns();
  try {
    const {run, done} = startRun(testId);
    // The run continues after this response; the UI polls /api/runs/:id.
    done.catch((e) => console.error('[runner]', e));
    return json({run}, 202);
  } catch (e) {
    if (e instanceof RunRejected) {
      return fail(e.message, e.status, e.details ? {issues: e.details} : undefined);
    }
    return fail((e as Error).message, 500);
  }
}
