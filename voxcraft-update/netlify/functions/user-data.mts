import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import { json } from '../lib/gemini.mts';

const MAX_BYTES = 500_000; // keep each user's saved data small (profiles, settings, script history)

export default async (req: Request) => {
  let user: Awaited<ReturnType<typeof getUser>> = null;
  try {
    user = await getUser();
  } catch {
    user = null;
  }
  if (!user) return json({ error: 'Please log in to use cloud saving.' }, 401);

  const store = getStore('user-data');
  const key = `user/${user.id}`;

  if (req.method === 'GET') {
    const data = await store.get(key, { type: 'json' });
    return json({ data: data ?? null });
  }

  if (req.method === 'PUT') {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return json({ error: 'Saved data is too large.' }, 413);

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'Invalid JSON.' }, 400);
    }

    // Only keep the fields the app uses
    const clean = {
      voices: Array.isArray(body.voices) ? body.voices.slice(0, 50) : [],
      history: Array.isArray(body.history) ? body.history.slice(0, 100) : [],
      settings: body.settings && typeof body.settings === 'object' ? body.settings : {},
      updatedAt: Date.now(),
    };
    await store.setJSON(key, clean);
    return json({ ok: true, updatedAt: clean.updatedAt });
  }

  return json({ error: 'Method not allowed.' }, 405);
};

export const config = { path: '/api/user-data' };
