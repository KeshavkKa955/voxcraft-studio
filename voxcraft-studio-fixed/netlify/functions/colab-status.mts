import { json } from '../lib/gemini.mts';
import { isFresh, isService, readEntry } from '../lib/registry.mts';

export default async (req: Request) => {
  const service = new URL(req.url).searchParams.get('service');
  if (!isService(service)) return json({ error: 'Unknown service.' }, 400);
  return json({ online: isFresh(await readEntry(service)) });
};

export const config = { path: '/api/colab-status' };
