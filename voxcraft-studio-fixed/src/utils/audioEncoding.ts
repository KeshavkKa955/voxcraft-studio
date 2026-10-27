/**
 * Audio encoding utilities for pure WAV generation, buffer slicing, and audio transformations.
 * Compatible with both Node.js and browser environments.
 */

export interface SimpleAudioBuffer {
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  getChannelData: (channel: number) => Float32Array;
}

/**
 * Creates a valid RIFF 16-bit PCM WAV file from an audio buffer or raw Float32 channel data.
 */
export function encodeWav(buffer: SimpleAudioBuffer): Uint8Array {
  const numChannels = Math.max(1, Math.min(2, buffer.numberOfChannels));
  const sampleRate = buffer.sampleRate || 24000;
  const numSamples = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // Helper to write ASCII string
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // 1. RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // chunkSize = 36 + SubChunk2Size
  writeString(8, 'WAVE');

  // 2. "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bitsPerSample

  // 3. "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave and quantize channel samples to 16-bit signed integers [-32768, 32767]
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = channelData[c][i] || 0;
      // Clamp between -1.0 and 1.0
      const clamped = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit PCM integer
      const intSample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
      view.setInt16(offset, Math.floor(intSample), true);
      offset += 2;
    }
  }

  return out;
}

/**
 * Creates a synthetic tone/silence audio buffer (helpful for testing and preview fallbacks)
 */
export function createSyntheticBuffer(
  durationSeconds: number,
  frequencyHz = 440,
  sampleRate = 24000
): SimpleAudioBuffer {
  const length = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const samples = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Harmonic decaying sine wave with gentle envelope
    const envelope = Math.min(1, Math.sin((Math.PI * i) / length) * 1.5);
    samples[i] = Math.sin(2 * Math.PI * frequencyHz * t) * 0.4 * envelope;
  }

  return {
    numberOfChannels: 1,
    sampleRate,
    length,
    getChannelData: () => samples,
  };
}

/**
 * Slices an audio buffer between start and end timestamps in seconds.
 */
export function sliceAudioBuffer(
  buffer: SimpleAudioBuffer,
  startTimeSec: number,
  endTimeSec: number
): SimpleAudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.max(0, Math.floor(startTimeSec * sampleRate));
  const endSample = Math.min(buffer.length, Math.floor(endTimeSec * sampleRate));
  const newLength = Math.max(0, endSample - startSample);

  const slicedChannels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const original = buffer.getChannelData(c);
    const slice = new Float32Array(newLength);
    slice.set(original.subarray(startSample, endSample));
    slicedChannels.push(slice);
  }

  return {
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
    length: newLength,
    getChannelData: (c: number) => slicedChannels[c] || new Float32Array(newLength),
  };
}

/**
 * Formats a duration in seconds to standard MM:SS.ms string.
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor(Math.round((seconds % 1) * 10)) % 10;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(mins)}:${pad(secs)}.${tenths}`;
}

/**
 * Calculates output duration with speed factor.
 */
export function calculatePlaybackDuration(originalDuration: number, speed: number): number {
  if (speed <= 0) return originalDuration;
  return Number((originalDuration / speed).toFixed(2));
}

/**
 * Converts a Float32Array PCM to base64 string
 */
export function float32ArrayToBase64Wav(buffer: SimpleAudioBuffer): string {
  const wavBytes = encodeWav(buffer);
  let binary = '';
  const len = wavBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(wavBytes[i]);
  }
  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  } else if (typeof Buffer !== 'undefined') {
    return Buffer.from(wavBytes).toString('base64');
  }
  return '';
}
