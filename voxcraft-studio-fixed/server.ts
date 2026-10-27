import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Increase JSON body limit for audio uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: Date.now(),
  });
});

// Single speaker TTS endpoint
app.post('/api/tts/generate', async (req, res) => {
  try {
    const {
      text,
      language = 'en-US',
      accent = 'General American',
      emotion = 'Natural Conversational',
      voiceName = 'Kore',
      customStylePrompt = '',
      speed = 1.0,
      pitchShift = 0,
    } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text prompt is required.' });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API Key is not configured on the server.',
        fallbackNeeded: true,
      });
    }

    // Build speech style instruction
    let styleDescription = customStylePrompt
      ? `${customStylePrompt}. Accent: ${accent}. Tone: ${emotion}.`
      : `Accent: ${accent}. Tone: ${emotion}. Delivery: Clear, authentic, studio audio quality.`;

    if (speed && speed !== 1.0) {
      styleDescription += ` Pace: ${speed > 1.0 ? 'brisk' : 'relaxed'}.`;
    }
    if (pitchShift && pitchShift !== 0) {
      styleDescription += ` Pitch register: ${pitchShift > 0 ? 'slightly higher' : 'deeper resonant'}.`;
    }

    // Call Gemini 3.8 Flash Lite TTS
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim(),
              speechMetadata: {
                style: styleDescription,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            // Valid prebuilt voices: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(500).json({
        error: 'Failed to generate speech audio from Gemini model.',
      });
    }

    return res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      sampleRate: 24000,
      modelUsed: 'gemini-3.8-flash-lite-tts',
    });
  } catch (error: any) {
    console.error('Error generating speech:', error);
    return res.status(500).json({
      error: error?.message || 'Internal server error while generating voiceover.',
      fallbackNeeded: true,
    });
  }
});

// Multi-speaker / Dialogue TTS endpoint
app.post('/api/tts/multi-speaker', async (req, res) => {
  try {
    const { dialogues, speakerA, speakerB } = req.body;
    // dialogues: [{ speaker: "Alex", text: "...", style: "..." }, { speaker: "Sam", text: "...", style: "..." }]

    if (!Array.isArray(dialogues) || dialogues.length === 0) {
      return res.status(400).json({ error: 'Dialogues array is required.' });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API Key is not configured on the server.',
        fallbackNeeded: true,
      });
    }

    // Default 2 speakers for gemini-3.8-flash-tts multiSpeakerVoiceConfig
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
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: spkA.name,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: spkA.voiceName || 'Puck' },
                },
              },
              {
                speaker: spkB.name,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: spkB.voiceName || 'Kore' },
                },
              },
            ],
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(500).json({
        error: 'Failed to generate multi-speaker speech audio.',
      });
    }

    return res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
      sampleRate: 24000,
      modelUsed: 'gemini-3.8-flash-tts',
    });
  } catch (error: any) {
    console.error('Error in multi-speaker TTS:', error);
    return res.status(500).json({
      error: error?.message || 'Multi-speaker generation failed.',
      fallbackNeeded: true,
    });
  }
});

// Voice Clone Sample Analysis endpoint (analyzes audio sample to create detailed clone prompt)
app.post('/api/voice/analyze-sample', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/wav', speakerName = 'User' } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio sample base64 is required.' });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API Key is not configured on the server.',
        fallbackNeeded: true,
      });
    }

    // Use Gemini 3.8 Flash to analyze speech characteristics
    const audioPart = {
      inlineData: {
        mimeType: mimeType.includes('webm') ? 'audio/webm' : 'audio/wav',
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
      config: {
        responseMimeType: 'application/json',
      },
    });

    const jsonText = response.text || '{}';
    const analysis = JSON.parse(jsonText);

    return res.json({
      success: true,
      analysis,
    });
  } catch (error: any) {
    console.error('Error analyzing voice sample:', error);
    return res.status(500).json({
      error: error?.message || 'Error analyzing voice sample',
      fallbackNeeded: true,
    });
  }
});

// Setup Vite middleware in dev or static serving in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VoxCraft Studio Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
