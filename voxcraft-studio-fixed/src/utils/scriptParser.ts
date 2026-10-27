/**
 * Script parsing utilities for multi-speaker voiceovers and dialogue scripts.
 */

import { ScriptSegment, VoiceProfile } from '../types/index.ts';

export interface ParsedDialogueLine {
  speakerName: string;
  emotion?: string;
  accent?: string;
  text: string;
  pauseAfterMs: number;
}

/**
 * Parses script lines like:
 * "Alex [Excited, British]: Welcome to the future of voice technology!"
 * "Elena [Calm]: Thanks Alex. We are excited to demonstrate real-time cloning."
 * "Narrator: Episode 1 begins now. [pause:800ms]"
 */
export function parseScriptToSegments(
  rawScript: string,
  voices: VoiceProfile[],
  defaultVoiceId?: string
): ScriptSegment[] {
  const lines = rawScript
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  const fallbackSpeaker = voices[0] || {
    id: 'voice-default',
    name: 'Narrator',
    baseVoice: 'Kore',
    language: 'en-US',
    accent: 'General American',
    emotionalTone: 'Natural Conversational',
  };

  const segments: ScriptSegment[] = [];

  // Match pattern: "Speaker Name [Emotion, Accent]: text" or "Speaker Name: text"
  const speakerRegex = /^([A-Za-z0-9_\s]+)(?:\[([^\]]+)\])?\s*:\s*(.*)$/;
  const pauseRegex = /\[pause(?::(\d+)(?:ms)?)?\]/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let speakerName = '';
    let modifiers = '';
    let text = line;
    let pauseAfterMs = 400; // default 400ms pause between dialogue lines

    const match = line.match(speakerRegex);
    if (match) {
      speakerName = match[1].trim();
      modifiers = match[2]?.trim() || '';
      text = match[3].trim();
    }

    // Check for inline pause tag like [pause:600ms]
    const pauseMatch = text.match(pauseRegex);
    if (pauseMatch) {
      if (pauseMatch[1]) {
        pauseAfterMs = parseInt(pauseMatch[1], 10);
      } else {
        pauseAfterMs = 600;
      }
      text = text.replace(pauseRegex, '').trim();
    }

    // Find matching voice or create/select speaker
    let matchedVoice: VoiceProfile | undefined;
    if (speakerName) {
      matchedVoice = voices.find(
        (v) => v.name.toLowerCase() === speakerName.toLowerCase()
      );
    }

    if (!matchedVoice && defaultVoiceId) {
      matchedVoice = voices.find((v) => v.id === defaultVoiceId);
    }

    const effectiveVoice = matchedVoice || fallbackSpeaker;

    // Parse modifiers (e.g. "Excited, British" or "Whispering")
    let emotion = effectiveVoice.emotionalTone;
    let accent = effectiveVoice.accent;

    if (modifiers) {
      const parts = modifiers.split(',').map((p) => p.trim());
      if (parts[0]) emotion = parts[0];
      if (parts[1]) accent = parts[1];
    }

    segments.push({
      id: `seg-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      speakerId: effectiveVoice.id,
      text,
      language: effectiveVoice.language || 'en-US',
      accent,
      emotion,
      speed: effectiveVoice.speedMultiplier || 1.0,
      pitchShift: effectiveVoice.pitchBias || 0,
      pauseAfterMs,
    });
  }

  // If no lines found, provide a single default segment
  if (segments.length === 0 && rawScript.trim().length > 0) {
    segments.push({
      id: `seg-${Date.now()}-0`,
      speakerId: fallbackSpeaker.id,
      text: rawScript.trim(),
      language: fallbackSpeaker.language || 'en-US',
      accent: fallbackSpeaker.accent,
      emotion: fallbackSpeaker.emotionalTone,
      speed: 1.0,
      pitchShift: 0,
      pauseAfterMs: 400,
    });
  }

  return segments;
}

/**
 * Builds the speech prompt style instruction for Gemini TTS
 */
export function buildSpeechStylePrompt(params: {
  voice: VoiceProfile;
  accent?: string;
  emotion?: string;
  speed?: number;
  pitchShift?: number;
}): string {
  const { voice, accent, emotion, speed, pitchShift } = params;

  const styleParts: string[] = [];

  if (voice.isClone && voice.customStylePrompt) {
    styleParts.push(voice.customStylePrompt);
  } else {
    styleParts.push(`Accent: ${accent || voice.accent}`);
    styleParts.push(`Emotional delivery: ${emotion || voice.emotionalTone}`);
  }

  if (speed && speed !== 1.0) {
    styleParts.push(`Pacing: ${speed > 1 ? 'brisk and swift' : 'measured and relaxed'}`);
  }

  if (pitchShift && pitchShift !== 0) {
    styleParts.push(
      `Pitch register: ${pitchShift > 0 ? 'higher vocal register' : 'deep and resonant register'}`
    );
  }

  return styleParts.join('. ') + '.';
}
