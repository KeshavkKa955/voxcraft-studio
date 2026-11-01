import { json, readBody } from '../lib/gemini.mts';
import { isService, storeFactory } from '../lib/registry.mts';

// Called by your Colab notebook every minute: "I am online at this address".
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const secret = process.env.COLAB_PUBLISH_KEY;
  if (!secret) return json({ error: 'COLAB_PUBLISH_KEY is not set on the site.' }, 503);
  if (req.headers.get('x-publish-key') !== secret) return json({ error: 'Wrong publish key.' }, 401);

  const { service, url, token } = await readBody(req);
  if (!isService(service)) return json({ error: 'Unknown service.' }, 400);
  if (typeof token !== 'string' || token.length < 8 || token.length > 200) return json({ error: 'Invalid token.' }, 400);
  let origin = '';
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'https:') throw new Error('not https');
    origin = u.origin;
  } catch {
    return json({ error: 'Invalid address.' }, 400);
  }

  await storeFactory.make('colab-registry').setJSON(service, { url: origin, token, t: Date.now() });
  return json({ ok: true });
};

export const config = { path: '/api/colab-register' };
