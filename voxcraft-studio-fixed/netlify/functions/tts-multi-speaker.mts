import { getAi, json, noKey, readBody, pcmBase64ToWavBase64 } from '../lib/gemini.mts';

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const { dialogues, speakerA, speakerB } = await readBody(req);

    if (!Array.isArray(dialogues) || dialogues.length === 0) {
      return json({ error: 'Dialogues array is required.' }, 400);
    }

    const ai = getAi();
    if (!ai) return noKey();

    const spkA = speakerA || { name: 'Speaker1', voiceName: 'Puck' };
    const spkB = speakerB || { name: 'Speaker2', voiceName: 'Kore' };

    const parts = dialogues.map((d: any) => ({
      text: `${d.speaker || spkA.name}: ${d.text}`,
      speechMetadata: {
        speaker: d.speaker || spkA.name,
        style: d.style || 'Natural conversational',
      },
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [{ role: 'user', parts: parts as any }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: spkA.name,
                voiceConfig: { prebuiltVoiceConfig: { voiceName: spkA.voiceName || 'Puck' } },
              },
              {
                speaker: spkB.name,
                voiceConfig: { prebuiltVoiceConfig: { voiceName: spkB.voiceName || 'Kore' } },
              },
            ],
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return json({ error: 'Failed to generate multi-speaker speech audio.' }, 500);
    }

    return json({
      audioBase64: pcmBase64ToWavBase64(base64Audio),
      mimeType: 'audio/wav',
      sampleRate: 24000,
      modelUsed: 'gemini-3.8-flash-tts',
    });
  } catch (error: any) {
    console.error('Error in multi-speaker TTS:', error);
    return json(
      { error: error?.message || 'Multi-speaker generation failed.', fallbackNeeded: true },
      500
    );
  }
};

export const config = { path: '/api/tts/multi-speaker' };
