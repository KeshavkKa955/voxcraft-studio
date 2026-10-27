import { getAi, json, noKey, readBody } from '../lib/gemini.mts';

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const { audioBase64, mimeType = 'audio/wav', speakerName = 'User' } = await readBody(req);

    if (!audioBase64) {
      return json({ error: 'Audio sample base64 is required.' }, 400);
    }

    const ai = getAi();
    if (!ai) return noKey();

    const audioPart = {
      inlineData: {
        mimeType: String(mimeType).includes('webm') ? 'audio/webm' : 'audio/wav',
        data: audioBase64,
      },
    };

    const prompt = `Analyze this audio sample of speaker "${speakerName}".
Provide a concise analysis in JSON format with:
1. "accent": Primary accent detected (e.g., "British RP", "American General", "Australian", "French", "Indian", etc.)
2. "vocalCharacteristics": Pitch register ("bass", "baritone", "tenor", "alto", "soprano"), timbre texture (e.g. "warm and resonant", "husky", "crisp and bright")
3. "recommendedBaseVoice": One of "Puck", "Charon", "Kore", "Fenrir", "Zephyr"
4. "stylePrompt": A 1-2 sentence detailed directive for text-to-speech to clone this exact vocal tone, cadence, and breath control.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: [audioPart, { text: prompt }] },
      config: { responseMimeType: 'application/json' },
    });

    const analysis = JSON.parse(response.text || '{}');
    return json({ success: true, analysis });
  } catch (error: any) {
    console.error('Error analyzing voice sample:', error);
    return json(
      { error: error?.message || 'Error analyzing voice sample', fallbackNeeded: true },
      500
    );
  }
};

export const config = { path: '/api/voice/analyze-sample' };
