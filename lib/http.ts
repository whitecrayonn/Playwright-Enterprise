// Small helpers for route handlers.
import {NextResponse} from 'next/server';

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {status, headers: {'Cache-Control': 'no-store'}});
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return json({error: message, ...extra}, status);
}

export async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
