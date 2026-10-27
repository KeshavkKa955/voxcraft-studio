import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScriptToSegments, buildSpeechStylePrompt } from './scriptParser.ts';
import { VoiceProfile } from '../types/index.ts';

const mockVoices: VoiceProfile[] = [
  {
    id: 'voice-1',
    name: 'Narrator',
    gender: 'neutral',
    baseVoice: 'Kore',
    language: 'en-US',
    accent: 'General American',
    emotionalTone: 'Natural Conversational',
    pitchBias: 0,
    speedMultiplier: 1.0,
    isClone: false,
    description: 'Standard narrator',
  },
  {
    id: 'voice-2',
    name: 'Alex',
    gender: 'male',
    baseVoice: 'Puck',
    language: 'en-US',
    accent: 'British RP',
    emotionalTone: 'Enthusiastic',
    pitchBias: 0,
    speedMultiplier: 1.0,
    isClone: false,
    description: 'Lively co-host',
  },
];

test('parseScriptToSegments parses multi-speaker script accurately', () => {
  const script = `
Narrator: Welcome to the studio demonstration.
Alex [Excited, Cockney]: Cheers everyone! [pause:500ms]
Narrator [Whispering]: Keep your voices low.
  `.trim();

  const segments = parseScriptToSegments(script, mockVoices);

  assert.equal(segments.length, 3);
  assert.equal(segments[0].speakerId, 'voice-1');
  assert.equal(segments[0].text, 'Welcome to the studio demonstration.');

  assert.equal(segments[1].speakerId, 'voice-2');
  assert.equal(segments[1].text, 'Cheers everyone!');
  assert.equal(segments[1].accent, 'Cockney');
  assert.equal(segments[1].emotion, 'Excited');
  assert.equal(segments[1].pauseAfterMs, 500);

  assert.equal(segments[2].speakerId, 'voice-1');
  assert.equal(segments[2].emotion, 'Whispering');
});

test('buildSpeechStylePrompt constructs descriptive prompt', () => {
  const prompt = buildSpeechStylePrompt({
    voice: mockVoices[1],
    accent: 'Australian',
    emotion: 'Dramatic',
    speed: 1.2,
    pitchShift: 2,
  });

  assert.ok(prompt.includes('Accent: Australian'));
  assert.ok(prompt.includes('Emotional delivery: Dramatic'));
  assert.ok(prompt.includes('swift'));
  assert.ok(prompt.includes('higher vocal register'));
});
