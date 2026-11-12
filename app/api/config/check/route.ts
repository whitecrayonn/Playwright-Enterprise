import {fail, json, readBody} from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Checks that the base URL answers, so setup mistakes show before the first run. */
export async function POST(req: Request) {
  const body = await readBody(req);
  const raw = typeof body?.baseUrl === 'string' ? body.baseUrl.trim() : '';
  let url: URL;
  try {
    url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
  } catch {
    return fail('Enter a full http:// or https:// address.');
  }
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: {'User-Agent': 'PlaywrightStudio-check'},
    });
    await res.body?.cancel();
    return json({
      ok: res.status < 500,
      status: res.status,
      finalUrl: res.url,
      ms: Date.now() - started,
    });
  } catch (e) {
    const err = e as Error & {cause?: {code?: string}};
    const code = err.cause?.code;
    const message =
      err.name === 'TimeoutError'
        ? 'No answer within 8 seconds.'
        : code === 'ENOTFOUND'
          ? 'That host name does not exist.'
          : code === 'ECONNREFUSED'
            ? 'Nothing is listening at that address. Is the site running?'
            : err.message;
    return json({ok: false, error: message, ms: Date.now() - started});
  }
}
