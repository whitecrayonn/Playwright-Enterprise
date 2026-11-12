import {fail, json} from '@/lib/http';
import {reconcileStaleRuns} from '@/lib/runner';
import {readData} from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  reconcileStaleRuns();
  const run = readData().runs.find((r) => r.id === id);
  return run ? json({run}) : fail('Run not found.', 404);
}
