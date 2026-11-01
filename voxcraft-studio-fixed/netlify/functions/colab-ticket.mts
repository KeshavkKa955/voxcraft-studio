import { json } from '../lib/gemini.mts';
import { currentUser } from '../lib/guard.mts';
import { isFresh, isService, readEntry, storeFactory } from '../lib/registry.mts';

const LIMITS: Record<string, number> = { separator: Number(process.env.SEP_DAILY_LIMIT || 5) };

// Logged-in users ask for the current Colab address before each job; this also counts their daily use.
export default async (req: Request) => {
  const service = new URL(req.url).searchParams.get('service');
  if (!isService(service)) return json({ error: 'Unknown service.' }, 400);

  const user: any = await currentUser();
  if (!user) return json({ error: 'Please log in to use this tool.', loginRequired: true }, 401);

  const entry = await readEntry(service);
  if (!entry || !isFresh(entry)) {
    return json({ error: 'The Vocal Remover is offline right now. Please try again later.', offline: true }, 503);
  }

  const day = new Date().toISOString().slice(0, 10);
  const key = `${service}/${user.id}/${day}`;
  let count = 0;
  let store: any = null;
  try {
    store = storeFactory.make('daily-usage');
    count = ((await store.get(key, { type: 'json' })) as any)?.n || 0;
  } catch {
    store = null;
  }
  const limit = LIMITS[service];
  if (count >= limit) {
    return json({ error: `Daily limit reached (${limit} songs per day). Please try again tomorrow.`, limitReached: true }, 429);
  }
  try {
    await store?.setJSON(key, { n: count + 1 });
  } catch {
    /* storage unavailable */
  }
  return json({ url: entry.url, token: entry.token });
};

export const config = { path: '/api/colab-ticket' };
