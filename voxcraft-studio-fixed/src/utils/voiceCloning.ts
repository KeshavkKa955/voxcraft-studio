/**
 * Acoustic analysis and voice timbre profiling for Voice Cloning.
 * Computes fundamental frequency (F0), zero-crossing rate, energy RMS,
 * and maps features to optimal Gemini TTS base personas and style modifiers.
 */

import { AcousticFeatures, BaseVoiceName, VoiceProfile } from '../types/index.ts';

/**
 * Autocorrelation algorithm to estimate fundamental frequency (F0 in Hz)
 * of human vocal pitch (typically 65Hz to 500Hz).
 */
export function estimateFundamentalFrequency(
  samples: Float32Array,
  sampleRate: number
): number {
  if (samples.length === 0) return 150;

  // Window for analysis: take center portion up to 4096 samples
  const windowSize = Math.min(4096, samples.length);
  const startIdx = Math.max(0, Math.floor((samples.length - windowSize) / 2));
  const segment = samples.subarray(startIdx, startIdx + windowSize);

  // Pitch search bounds (65Hz to 450Hz)
  const minPeriod = Math.floor(sampleRate / 450);
  const maxPeriod = Math.floor(sampleRate / 65);

  let bestPeriod = 0;
  let maxCorr = -1;

  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    let corr = 0;
    let norm1 = 0;
    let norm2 = 0;
    const limit = windowSize - lag;

    for (let i = 0; i < limit; i++) {
      corr += segment[i] * segment[i + lag];
      norm1 += segment[i] * segment[i];
      norm2 += segment[i + lag] * segment[i + lag];
    }

    const denom = Math.sqrt(norm1 * norm2);
    if (denom > 0) {
      const normalizedCorr = corr / denom;
      if (normalizedCorr > maxCorr) {
        maxCorr = normalizedCorr;
        bestPeriod = lag;
      }
    }
  }

  if (bestPeriod > 0 && maxCorr > 0.3) {
    return Math.round(sampleRate / bestPeriod);
  }

  // Fallback default voice pitch
  return 155;
}

/**
 * Computes Root Mean Square (RMS) energy in decibels (dBFS)
 */
export function computeRmsDb(samples: Float32Array): number {
  if (samples.length === 0) return -60;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sum / samples.length);
  if (rms <= 0.00001) return -60;
  const db = 20 * Math.log10(rms);
  return Number(Math.max(-60, Math.min(0, db)).toFixed(1));
}

/**
 * Computes Spectral Centroid (timbre brightness / formant center)
 */
export function computeSpectralCentroid(
  samples: Float32Array,
  sampleRate: number
): number {
  if (samples.length < 64) return 1500;
  // Approximation using absolute differences and power
  let weightedSum = 0;
  let totalEnergy = 0;
  const step = 4;
  for (let i = 0; i < samples.length - step; i += step) {
    const freqEstimate = (Math.abs(samples[i + step] - samples[i]) * sampleRate) / 2;
    const energy = samples[i] * samples[i];
    weightedSum += freqEstimate * energy;
    totalEnergy += energy;
  }
  if (totalEnergy === 0) return 1500;
  return Math.round(weightedSum / totalEnergy);
}

/**
 * Categorizes vocal range from F0 in Hz
 */
export function categorizePitch(
  f0Hz: number
): 'bass' | 'baritone' | 'tenor' | 'alto' | 'soprano' {
  if (f0Hz < 110) return 'bass';
  if (f0Hz < 150) return 'baritone';
  if (f0Hz < 195) return 'tenor';
  if (f0Hz < 260) return 'alto';
  return 'soprano';
}

/**
 * Performs full acoustic feature extraction on raw PCM audio samples
 */
export function extractAcousticFeatures(
  samples: Float32Array,
  sampleRate: number
): AcousticFeatures {
  const f0Hz = estimateFundamentalFrequency(samples, sampleRate);
  const rmsDb = computeRmsDb(samples);
  const spectralCentroid = computeSpectralCentroid(samples, sampleRate);
  const pitchCategory = categorizePitch(f0Hz);

  // Clarity score based on SNR / dynamic headroom
  const clarityScore = Math.min(99, Math.max(70, Math.round(85 + (rmsDb + 25) * 0.5)));

  return {
    f0Hz,
    pitchCategory,
    rmsDb,
    spectralCentroid,
    clarityScore,
  };
}

/**
 * Maps extracted voice characteristics to the closest Gemini prebuilt voice anchor
 * (Puck, Charon, Kore, Fenrir, Zephyr) with custom pitch and style offset.
 */
export function mapAcousticToVoiceProfile(
  name: string,
  features: AcousticFeatures,
  accent = 'General American',
  emotionalTone = 'Natural Conversational'
): Partial<VoiceProfile> {
  let baseVoice: BaseVoiceName = 'Puck';
  let gender: 'male' | 'female' | 'neutral' = 'neutral';
  let pitchBias = 0;

  // Fenrir / Charon = Deep male; Puck = Natural tenor; Kore = Rich female; Zephyr = Light/airy female
  if (features.f0Hz < 125) {
    baseVoice = 'Fenrir';
    gender = 'male';
    pitchBias = -2;
  } else if (features.f0Hz < 165) {
    baseVoice = 'Charon';
    gender = 'male';
    pitchBias = 0;
  } else if (features.f0Hz < 210) {
    baseVoice = 'Puck';
    gender = 'neutral';
    pitchBias = Math.round((features.f0Hz - 170) / 15);
  } else if (features.f0Hz < 270) {
    baseVoice = 'Kore';
    gender = 'female';
    pitchBias = 0;
  } else {
    baseVoice = 'Zephyr';
    gender = 'female';
    pitchBias = 1;
  }

  const brightnessDesc =
    features.spectralCentroid > 2200 ? 'crisp, bright resonance' : 'warm, resonant low-mids';

  const customStylePrompt = `Voice clone of ${name}. Vocal profile: ${features.pitchCategory} (${features.f0Hz}Hz baseline F0), ${brightnessDesc}, ${accent} accent, speaking in a ${emotionalTone.toLowerCase()} cadence. Maintain steady breathing and natural human articulation.`;

  return {
    name,
    gender,
    baseVoice,
    accent,
    emotionalTone,
    pitchBias,
    speedMultiplier: 1.0,
    isClone: true,
    customStylePrompt,
    description: `Cloned voice (${features.pitchCategory.toUpperCase()} ~${features.f0Hz}Hz, ${brightnessDesc})`,
  };
}
