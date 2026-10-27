export type BaseVoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface AcousticFeatures {
  f0Hz: number;
  pitchCategory: 'bass' | 'baritone' | 'tenor' | 'alto' | 'soprano';
  rmsDb: number;
  spectralCentroid: number;
  clarityScore: number;
  detectedTempoWpm?: number;
}

export interface VoiceCloneSample {
  id: string;
  blobUrl: string;
  duration: number;
  recordedAt: number;
  textPrompt: string;
  features?: AcousticFeatures;
}

export interface VoiceProfile {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  baseVoice: BaseVoiceName;
  language: string;
  accent: string;
  emotionalTone: string;
  pitchBias: number; // semitones offset (-12 to +12)
  speedMultiplier: number; // 0.7x to 1.5x
  isClone: boolean;
  cloneSamples?: VoiceCloneSample[];
  customStylePrompt?: string;
  description: string;
}

export interface ScriptSegment {
  id: string;
  speakerId: string;
  text: string;
  language: string;
  accent: string;
  emotion: string;
  speed: number;
  pitchShift: number; // semitones
  pauseAfterMs: number;
  audioBlobUrl?: string;
  audioDuration?: number;
  isGenerating?: boolean;
  error?: string;
}

export interface AudioEditState {
  trimStart: number; // seconds
  trimEnd: number; // seconds
  playbackRate: number; // 0.5 to 2.5
  pitchShiftSemitones: number; // -12 to 12
  volume: number; // 0 to 2 (1 = 100%)
  eqBass: number; // -12dB to +12dB
  eqMid: number; // -12dB to +12dB
  eqTreble: number; // -12dB to +12dB
  reverbAmount: number; // 0 to 1
  noiseGate: boolean;
}

export type ExportAudioFormat = 'wav' | 'mp3' | 'webm' | 'ogg' | 'flac';

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  sampleText: string;
}

export interface AccentOption {
  id: string;
  name: string;
  region: string;
  description: string;
}

export interface EmotionOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}
