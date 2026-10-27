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
    } = await readBody(req);

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return json({ error: 'Text prompt is required.' }, 400);
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
