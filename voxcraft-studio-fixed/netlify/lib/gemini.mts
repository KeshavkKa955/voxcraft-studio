import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;

export function getAi(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return client;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const noKey = () =>
  json(
    {
      error: 'Gemini API Key is not configured on the server.',
      fallbackNeeded: true,
    },
    503
  );

export async function readBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/**
 * Gemini TTS returns raw 16-bit PCM (24 kHz, mono). Browsers cannot decode raw PCM,
 * so wrap it in a WAV header. If it already is a WAV (starts with "RIFF"), pass through.
 */
export function pcmBase64ToWavBase64(base64: string, sampleRate = 24000): string {
  const pcm = Buffer.from(base64, 'base64');
  if (pcm.length >= 4 && pcm.toString('ascii', 0, 4) === 'RIFF') return base64;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString('base64');
}
