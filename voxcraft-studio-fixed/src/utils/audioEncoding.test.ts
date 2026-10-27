import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeWav,
  createSyntheticBuffer,
  sliceAudioBuffer,
  formatDuration,
  calculatePlaybackDuration,
} from './audioEncoding.ts';

test('encodeWav creates a valid RIFF 16-bit WAV with correct headers', () => {
  const buffer = createSyntheticBuffer(1.0, 440, 24000);
  const wavBytes = encodeWav(buffer);

  assert.ok(wavBytes.length > 44, 'WAV bytes must include 44-byte header plus data');

  // Check RIFF header
  const header = String.fromCharCode(...wavBytes.slice(0, 4));
  assert.equal(header, 'RIFF');

  // Check WAVE format
  const wave = String.fromCharCode(...wavBytes.slice(8, 12));
  assert.equal(wave, 'WAVE');

  // Check fmt subchunk
  const fmt = String.fromCharCode(...wavBytes.slice(12, 16));
  assert.equal(fmt, 'fmt ');

  // Check sample rate at byte offset 24 (Uint32)
  const view = new DataView(wavBytes.buffer);
  const sampleRate = view.getUint32(24, true);
  assert.equal(sampleRate, 24000);

  // Check 16-bit
  const bitsPerSample = view.getUint16(34, true);
  assert.equal(bitsPerSample, 16);
});

test('sliceAudioBuffer extracts correct slice of audio', () => {
  const buffer = createSyntheticBuffer(2.0, 440, 24000); // 2 seconds = 48000 samples
  assert.equal(buffer.length, 48000);

  // Slice from 0.5s to 1.5s (1.0 second duration = 24000 samples)
  const sliced = sliceAudioBuffer(buffer, 0.5, 1.5);
  assert.equal(sliced.length, 24000);
  assert.equal(sliced.sampleRate, 24000);
});

test('formatDuration formats seconds accurately', () => {
  assert.equal(formatDuration(0), '00:00.0');
  assert.equal(formatDuration(65.4), '01:05.4');
  assert.equal(formatDuration(125.8), '02:05.8');
});

test('calculatePlaybackDuration handles speed scaling', () => {
  assert.equal(calculatePlaybackDuration(10, 1.0), 10);
  assert.equal(calculatePlaybackDuration(10, 2.0), 5);
  assert.equal(calculatePlaybackDuration(10, 0.5), 20);
});
