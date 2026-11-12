import {newId} from '@/lib/blocks';
import {fail, json, readBody} from '@/lib/http';
import {cleanName, readData, sanitizeBlocks, updateData} from '@/lib/store';
import type {StudioDoc} from '@/lib/studio-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return json({docs: readData().docs});
}

/** Create a test or saved block; `duplicateOf` copies an existing one. */
export async function POST(req: Request) {
  const body = await readBody(req);
  if (!body) return fail('Send a JSON object.');
  const data = readData();
  const source =
    typeof body.duplicateOf === 'string'
      ? data.docs.find((d) => d.id === body.duplicateOf)
      : undefined;
  if (body.duplicateOf && !source) return fail('Nothing to copy: it was deleted.', 404);

  const kind = source?.kind ?? (body.kind === 'block' ? 'block' : 'test');
  const now = new Date().toISOString();
  const doc: StudioDoc = {
    id: newId(kind === 'test' ? 't' : 'sb'),
    kind,
    name: source
      ? `${source.name} (copy)`.slice(0, 120)
      : cleanName(body.name, kind === 'test' ? 'Untitled test' : 'Untitled block'),
    description: source?.description ?? '',
    blocks: source
      ? source.blocks.map((b) => ({...b, id: newId()}))
      : sanitizeBlocks(body.blocks),
    createdAt: now,
    updatedAt: now,
  };
  updateData((d) => {
    d.docs.push(doc);
  });
  return json({doc}, 201);
}
