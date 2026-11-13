import {envPath, readEnv, writeEnv} from '@/lib/env-config';
import {fail, json, readBody} from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return json({...readEnv(), file: envPath()});
}

export async function PUT(req: Request) {
  const body = await readBody(req);
  if (!body) return fail('Send the settings as a JSON object.');
  const result = writeEnv(body);
  if (!result.ok) return fail('Some settings need fixing.', 400, {errors: result.errors});
  return json({state: 'ok', env: result.env, file: envPath()});
}
