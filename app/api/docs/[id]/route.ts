import {fail, json, readBody} from '@/lib/http';
import {cleanName, readData, sanitizeBlocks, updateData} from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = {params: Promise<{id: string}>};

export async function GET(_req: Request, {params}: Ctx) {
  const {id} = await params;
  const doc = readData().docs.find((d) => d.id === id);
  return doc ? json({doc}) : fail('Not found.', 404);
}

export async function PUT(req: Request, {params}: Ctx) {
  const {id} = await params;
  const body = await readBody(req);
  if (!body) return fail('Send a JSON object.');
  const doc = updateData((d) => {
    const found = d.docs.find((x) => x.id === id);
    if (!found) return null;
    if (body.name !== undefined) found.name = cleanName(body.name, found.name);
    if (typeof body.description === 'string') found.description = body.description.slice(0, 500);
    if (body.blocks !== undefined) {
      const blocks = sanitizeBlocks(body.blocks);
      // A saved block may not use itself.
      found.blocks =
        found.kind === 'block' ? blocks.filter((b) => b.ref !== found.id) : blocks;
    }
    found.updatedAt = new Date().toISOString();
    return found;
  });
  return doc ? json({doc}) : fail('Not found.', 404);
}

export async function DELETE(_req: Request, {params}: Ctx) {
  const {id} = await params;
  const data = readData();
  const doc = data.docs.find((d) => d.id === id);
  if (!doc) return fail('Not found.', 404);
  if (doc.kind === 'block') {
    const users = data.docs.filter((d) =>
      d.blocks.some((b) => b.kind === 'useBlock' && b.ref === id)
    );
    if (users.length > 0) {
      return fail(
        `Still used by: ${users.map((u) => u.name).join(', ')}. Remove it there first.`,
        409
      );
    }
  }
  updateData((d) => {
    d.docs = d.docs.filter((x) => x.id !== id);
  });
  return json({ok: true});
}
