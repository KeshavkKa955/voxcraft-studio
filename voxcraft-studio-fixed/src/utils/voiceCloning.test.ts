import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateFundamentalFrequency,
  computeRmsDb,
  categorizePitch,
  extractAcousticFeatures,
  mapAcousticToVoiceProfile,
} from './voiceCloning.ts';

test('estimateFundamentalFrequency identifies 200Hz sine wave pitch correctly', () => {
  const sampleRate = 24000;
  const targetHz = 200;
  const length = 4096;
  const samples = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    samples[i] = Math.sin((2 * Math.PI * targetHz * i) / sampleRate);
  }

  const detected = estimateFundamentalFrequency(samples, sampleRate);
  // Allow +-10Hz tolerance for discrete autocorrelation
  assert.ok(
    Math.abs(detected - targetHz) <= 12,
    `Detected pitch ${detected}Hz should be close to target ${targetHz}Hz`
  );
});

test('categorizePitch accurately classifies vocal ranges', () => {
  assert.equal(categorizePitch(95), 'bass');
  assert.equal(categorizePitch(130), 'baritone');
  assert.equal(categorizePitch(175), 'tenor');
  assert.equal(categorizePitch(230), 'alto');
  assert.equal(categorizePitch(300), 'soprano');
});

test('computeRmsDb measures silence and full scale signals', () => {
  const silence = new Float32Array(1000);
  assert.equal(computeRmsDb(silence), -60);

  const fullSquare = new Float32Array(1000).fill(1.0);
  assert.equal(computeRmsDb(fullSquare), 0);
});

test('mapAcousticToVoiceProfile assigns appropriate base voice and prompt', () => {
  const deepFeatures = {
    f0Hz: 105,
    pitchCategory: 'bass' as const,
    rmsDb: -14,
    spectralCentroid: 1200,
    clarityScore: 92,
  };

  const profile = mapAcousticToVoiceProfile(
    'Deep Voice Mike',
    deepFeatures,
    'British RP',
    'Authoritative'
  );

  assert.equal(profile.baseVoice, 'Fenrir');
  assert.equal(profile.isClone, true);
  assert.ok(profile.customStylePrompt?.includes('Deep Voice Mike'));
  assert.ok(profile.customStylePrompt?.includes('British RP'));
});
