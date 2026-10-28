import { getAi, json, noKey, readBody, pcmBase64ToWavBase64 } from '../lib/gemini.mts';

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const {
      text,
      accent = 'General American',
      emotion = 'Natural Conversational',
      voiceName = 'Kore',
      customStylePrompt = '',
      speed = 1.0,
      pitchShift = 0,
      voiceId = '',
    } = await readBody(req);

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return json({ error: 'Text prompt is required.' }, 400);
    }

    // Cloned voice (created by /api/voice/replicate) -> Gemini interactions endpoint
    if (voiceId) {
      if (!/^voice(key)?_[A-Za-z0-9_-]{3,}$/.test(String(voiceId))) {
        return json({ error: 'Invalid cloned voice id.' }, 400);
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return noKey();

      let style = `Tone: ${emotion}.`;
      if (customStylePrompt) style = `${customStylePrompt}. ${style}`;
      if (speed && speed !== 1.0) style += ` Pace: ${speed > 1.0 ? 'brisk' : 'relaxed'}.`;

      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.CLONE_TTS_MODEL || 'gemini-3.8-flash-tts',
          input: [
            {
              type: 'user_input',
              content: [
                {
                  type: 'text',
                  text: text.trim(),
                  annotations: [{ type: 'speech_metadata', style }],
                },
              ],
            },
          ],
          response_format: { type: 'audio' },
          generation_config: { speech_config: [{ voice: voiceId }] },
        }),
      });

      const payload: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('Cloned voice TTS failed:', res.status, JSON.stringify(payload).slice(0, 500));
        return json(
          { error: payload?.error?.message || `Gemini returned status ${res.status}.`, fallbackNeeded: true },
          502
        );
      }

      const audioParts = (payload.steps || [])
        .filter((st: any) => st.type === 'model_output')
        .flatMap((st: any) => st.content || [])
        .filter((c: any) => c.type === 'audio' && c.data);
      const clonedAudio = audioParts.length ? audioParts[audioParts.length - 1].data : null;
      if (!clonedAudio) {
        return json({ error: 'Gemini returned no audio for the cloned voice.', fallbackNeeded: true }, 502);
      }
      return json({
        audioBase64: pcmBase64ToWavBase64(clonedAudio),
        mimeType: 'audio/wav',
        sampleRate: 24000,
        modelUsed: 'cloned-voice',
      });
    }

    const ai = getAi();
    if (!ai) return noKey();

    let styleDescription = customStylePrompt
      ? `${customStylePrompt}. Accent: ${accent}. Tone: ${emotion}.`
      : `Accent: ${accent}. Tone: ${emotion}. Delivery: Clear, authentic, studio audio quality.`;

    if (speed && speed !== 1.0) {
      styleDescription += ` Pace: ${speed > 1.0 ? 'brisk' : 'relaxed'}.`;
    }
    if (pitchShift && pitchShift !== 0) {
      styleDescription += ` Pitch register: ${pitchShift > 0 ? 'slightly higher' : 'deeper resonant'}.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [{ text: text.trim(), speechMetadata: { style: styleDescription } } as any],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return json({ error: 'Failed to generate speech audio from Gemini model.' }, 500);
    }

    return json({
      audioBase64: pcmBase64ToWavBase64(base64Audio),
      mimeType: 'audio/wav',
      sampleRate: 24000,
      modelUsed: 'gemini-3.8-flash-lite-tts',
    });
  } catch (error: any) {
    console.error('Error generating speech:', error);
    return json(
      {
        error: error?.message || 'Internal server error while generating voiceover.',
        fallbackNeeded: true,
      },
      500
    );
  }
};

export const config = { path: '/api/tts/generate' };
