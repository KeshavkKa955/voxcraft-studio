import { json, noKey, readBody } from '../lib/gemini.mts';

const GOOGLE = 'https://generativelanguage.googleapis.com/v1beta';
const VOICE_MODEL = process.env.CLONE_VOICE_MODEL || 'gemini-3.8-flash-tts';
const MAX_BASE64 = 4_500_000; // Netlify functions accept ~6 MB requests; stay safely below
const ID_PATTERN = /^voice_[A-Za-z0-9_-]{3,200}$/;

const googleError = (payload: any, status: number) =>
  payload?.error?.message || `Google returned status ${status}.`;

export default async (req: Request) => {
  const apiKey = process.env.GEMINI_API_KEY;

  // ---- Delete a stored cloned voice ----
  if (req.method === 'DELETE') {
    if (!apiKey) return noKey();
    const id = new URL(req.url).searchParams.get('id') || '';
    if (!ID_PATTERN.test(id)) return json({ error: 'Invalid voice id.' }, 400);
    const res = await fetch(`${GOOGLE}/voices/${id}`, {
      method: 'DELETE',
      headers: { 'x-goog-api-key': apiKey },
    });
    if (!res.ok && res.status !== 404) {
      const payload = await res.json().catch(() => ({}));
      return json({ error: googleError(payload, res.status) }, 502);
    }
    return json({ ok: true });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  // ---- Create a cloned voice from reference + consent recordings ----
  try {
    const { sourceAudioBase64, consentAudioBase64, displayName } = await readBody(req);

    if (typeof sourceAudioBase64 !== 'string' || typeof consentAudioBase64 !== 'string') {
      return json({ error: 'Both the voice sample and the consent recording are required.' }, 400);
    }
    if (sourceAudioBase64.length + consentAudioBase64.length > MAX_BASE64) {
      return json({ error: 'Recordings are too large. Use shorter recordings.' }, 413);
    }
    if (!apiKey) return noKey();

    const res = await fetch(`${GOOGLE}/voices`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store: true,
        voice: {
          model: VOICE_MODEL,
          type: 'replicated',
          display_name: String(displayName || 'My Voice').slice(0, 60),
          replicated: {
            source_audio: { mime_type: 'audio/wav', data: sourceAudioBase64 },
            consent_audio: { mime_type: 'audio/wav', data: consentAudioBase64 },
          },
        },
      }),
    });

    const payload: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Voice replication failed:', res.status, JSON.stringify(payload).slice(0, 500));
      return json({ error: googleError(payload, res.status) }, res.status === 400 ? 400 : 502);
    }

    const voiceId: string | undefined = payload.id || payload.voice?.id || payload.name?.split('/').pop();
    if (!voiceId) {
      return json({ error: 'Google did not return a voice ID.' }, 502);
    }
    return json({ voiceId });
  } catch (error: any) {
    console.error('Voice replication error:', error);
    return json({ error: error?.message || 'Voice cloning failed.' }, 500);
  }
};

export const config = { path: '/api/voice/replicate' };
