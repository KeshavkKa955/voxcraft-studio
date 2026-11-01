import { getStore } from '@netlify/blobs';

export const SERVICES = ['separator'] as const;
export type Service = (typeof SERVICES)[number];
export const FRESH_MS = 180_000; // Colab sends a heartbeat every 60 s; older than 3 min = offline

// Tests can replace this to use an in-memory store
export const storeFactory = { make: (name: string): any => getStore(name) };

export const isService = (s: string | null): s is Service => !!s && (SERVICES as readonly string[]).includes(s);

export async function readEntry(service: Service): Promise<{ url: string; token: string; t: number } | null> {
  try {
    return (await storeFactory.make('colab-registry').get(service, { type: 'json' })) || null;
  } catch {
    return null;
  }
}

export const isFresh = (e: { t: number } | null) => !!e && Date.now() - e.t < FRESH_MS;
