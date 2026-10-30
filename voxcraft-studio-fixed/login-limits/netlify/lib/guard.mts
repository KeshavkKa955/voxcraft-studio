import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import { createHash } from 'node:crypto';
import { json } from './gemini.mts';

const WINDOW_MS = 24 * 60 * 60 * 1000; // one free voice per visitor (IP) per 24 hours
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 30); // voices per logged-in user per day

export async function currentUser() {
  try {
    return await getUser();
  } catch {
    return null;
  }
}

/**
 * Logged-in users pass. Guests get ONE free generation per 24 hours (counted per IP).
 * Call markUsed() only after a successful generation so failures do not use up the free try.
 */
export async function guestGate(req: Request, context: any) {
  const user: any = await currentUser();
  if (user) {
    // Logged-in users: a daily limit protects your Gemini quota
    const day = new Date().toISOString().slice(0, 10);
    const ukey = `user/${user.id}/${day}`;
    let ustore: ReturnType<typeof getStore> | null = null;
    let count = 0;
    try {
      ustore = getStore('daily-usage');
      const r: any = await ustore.get(ukey, { type: 'json' });
      count = r?.n || 0;
    } catch {
      return { block: null as Response | null, markUsed: async () => {} };
    }
    if (count >= DAILY_LIMIT) {
      return {
        block: json({ error: `Daily limit reached (${DAILY_LIMIT} voices per day). Please try again tomorrow.`, limitReached: true }, 429),
        markUsed: async () => {},
      };
    }
    return {
      block: null as Response | null,
      markUsed: async () => {
        try {
          await ustore!.setJSON(ukey, { n: count + 1 });
        } catch {
          /* storage unavailable */
        }
      },
    };
  }

  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const key = 'ip/' + createHash('sha256').update(String(ip) + (process.env.GUEST_SALT || 'voxcraft')).digest('hex').slice(0, 32);
  let store: ReturnType<typeof getStore> | null = null;
  let rec: any = null;
  try {
    store = getStore('guest-usage');
    rec = await store.get(key, { type: 'json' });
  } catch {
    // Storage not available (for example when testing locally): do not block
    return { block: null as Response | null, markUsed: async () => {} };
  }
  if (rec && Date.now() - rec.t < WINDOW_MS) {
    return {
      block: json({ error: 'You have used your free voice. Please log in or sign up to keep creating.', loginRequired: true }, 401),
      markUsed: async () => {},
    };
  }
  return {
    block: null as Response | null,
    markUsed: async () => {
      try {
        await store!.setJSON(key, { t: Date.now() });
      } catch {
        /* storage unavailable */
      }
    },
  };
}
