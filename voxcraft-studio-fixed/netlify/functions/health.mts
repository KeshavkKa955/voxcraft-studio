import { json } from '../lib/gemini.mts';

export default async () =>
  json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: Date.now(),
  });

export const config = { path: '/api/health' };
