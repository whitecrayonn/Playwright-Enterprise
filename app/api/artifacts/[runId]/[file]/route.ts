import fs from 'node:fs';
import path from 'node:path';
import {fail} from '@/lib/http';
import {artifactsDir} from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SAFE_RUN = /^run-[A-Za-z0-9-]+$/;
const SAFE_FILE = /^[A-Za-z0-9_-]+\.png$/;

export async function GET(
  _req: Request,
  {params}: {params: Promise<{runId: string; file: string}>}
) {
  const {runId, file} = await params;
  if (!SAFE_RUN.test(runId) || !SAFE_FILE.test(file)) return fail('Not found.', 404);
  const full = path.resolve(artifactsDir(runId), file);
  // Defence in depth: the resolved path must stay inside the artifacts folder.
  if (!full.startsWith(path.resolve(artifactsDir()) + path.sep)) return fail('Not found.', 404);
  if (!fs.existsSync(full)) return fail('Not found.', 404);
  return new Response(new Uint8Array(fs.readFileSync(full)), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
