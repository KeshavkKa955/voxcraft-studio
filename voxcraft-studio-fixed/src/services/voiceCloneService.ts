/**
 * Service for microphone recording, voice sample capture, acoustic analysis,
 * and custom cloned voice profile management.
 */

import { VoiceProfile, VoiceCloneSample, AcousticFeatures } from '../types/index.ts';
import { extractAcousticFeatures, mapAcousticToVoiceProfile } from '../utils/voiceCloning.ts';
import { audioEngine } from './audioEngine.ts';

const LOCAL_STORAGE_KEY = 'voxcraft_cloned_voices';

class VoiceCloneService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private recordingStartTime = 0;

  /**
   * Loads saved custom voice clones from local storage
   */
  public getSavedVoices(): VoiceProfile[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Could not read saved voices from localStorage:', e);
    }
    return [];
  }

  /**
   * Saves a new or updated voice profile
   */
  public saveVoice(voice: VoiceProfile): void {
    const existing = this.getSavedVoices();
    const index = existing.findIndex((v) => v.id === voice.id);
    if (index >= 0) {
      existing[index] = voice;
    } else {
      existing.unshift(voice);
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {
      console.warn('Could not save voice to localStorage:', e);
    }
  }

  /**
   * Deletes a voice profile
   */
  public deleteVoice(id: string): void {
    const existing = this.getSavedVoices().filter((v) => v.id !== id);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {
      console.warn('Could not delete voice from localStorage:', e);
    }
  }

  /**
   * Starts microphone recording
   */
  public async startRecording(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone access is not supported in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.mediaStream = stream;
    this.audioChunks = [];
    this.recordingStartTime = Date.now();

    const mimeType = MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';

    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    recorder.start(100);
    this.mediaRecorder = recorder;
  }

  /**
   * Stops microphone recording and extracts acoustic features
   */
  public async stopRecording(textPrompt = ''): Promise<VoiceCloneSample> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording in progress.'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.audioChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });
          const duration = (Date.now() - this.recordingStartTime) / 1000;
          const blobUrl = URL.createObjectURL(blob);

          // Stop mic tracks
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = null;
          }

          // Decode and analyze audio features
          const arrayBuffer = await blob.arrayBuffer();
          let features: AcousticFeatures | undefined;
          try {
            const audioBuffer = await audioEngine.decodeAudio(arrayBuffer);
            const channelData = audioBuffer.getChannelData(0);
            features = extractAcousticFeatures(channelData, audioBuffer.sampleRate);
          } catch (decodeErr) {
            console.warn('Could not decode audio for acoustic features:', decodeErr);
          }

          const sample: VoiceCloneSample = {
            id: `sample-${Date.now()}`,
            blobUrl,
            duration: Math.max(0.5, Number(duration.toFixed(2))),
            recordedAt: Date.now(),
            textPrompt,
            features,
          };

          resolve(sample);
        } catch (err) {
          reject(err);
        }
      };

      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    });
  }

  /**
   * Analyzes an uploaded or recorded audio sample via Gemini server API
   */
  public async analyzeSampleWithAi(
    audioBlob: Blob,
    speakerName: string
  ): Promise<{
    accent?: string;
    vocalCharacteristics?: string;
    recommendedBaseVoice?: string;
    stylePrompt?: string;
  } | null> {
    try {
      const buffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );

      const res = await fetch('/api/voice/analyze-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType: audioBlob.type || 'audio/wav',
          speakerName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.analysis;
      }
    } catch (e) {
      console.warn('AI sample analysis fallback:', e);
    }
    return null;
  }

  /**
   * Creates a full Voice Profile from acoustic samples
   */
  public buildClonedProfile(
    name: string,
    samples: VoiceCloneSample[],
    accent = 'General American',
    emotionalTone = 'Natural Conversational',
    aiAnalysis?: any
  ): VoiceProfile {
    // Average acoustic features across samples
    let avgF0 = 160;
    let avgRms = -18;
    let avgCentroid = 1600;
    let avgClarity = 85;

    const validFeatures = samples
      .map((s) => s.features)
      .filter((f): f is AcousticFeatures => !!f);

    if (validFeatures.length > 0) {
      avgF0 = Math.round(
        validFeatures.reduce((acc, f) => acc + f.f0Hz, 0) / validFeatures.length
      );
      avgRms = Number(
        (
          validFeatures.reduce((acc, f) => acc + f.rmsDb, 0) /
          validFeatures.length
        ).toFixed(1)
      );
      avgCentroid = Math.round(
        validFeatures.reduce((acc, f) => acc + f.spectralCentroid, 0) /
          validFeatures.length
      );
      avgClarity = Math.round(
        validFeatures.reduce((acc, f) => acc + f.clarityScore, 0) /
          validFeatures.length
      );
    }

    const aggregatedFeatures: AcousticFeatures = {
      f0Hz: avgF0,
      pitchCategory:
        avgF0 < 115
          ? 'bass'
          : avgF0 < 155
          ? 'baritone'
          : avgF0 < 200
          ? 'tenor'
          : avgF0 < 265
          ? 'alto'
          : 'soprano',
      rmsDb: avgRms,
      spectralCentroid: avgCentroid,
      clarityScore: avgClarity,
    };

    const baseProfile = mapAcousticToVoiceProfile(
      name,
      aggregatedFeatures,
      aiAnalysis?.accent || accent,
      emotionalTone
    );

    const voice: VoiceProfile = {
      id: `clone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      gender: baseProfile.gender || 'neutral',
      baseVoice: (aiAnalysis?.recommendedBaseVoice as any) || baseProfile.baseVoice || 'Puck',
      language: 'en-US',
      accent: aiAnalysis?.accent || accent,
      emotionalTone,
      pitchBias: baseProfile.pitchBias || 0,
      speedMultiplier: 1.0,
      isClone: true,
      cloneSamples: samples,
      customStylePrompt: aiAnalysis?.stylePrompt || baseProfile.customStylePrompt,
      description: `Cloned voice of ${name} (${samples.length} sample${samples.length > 1 ? 's' : ''}, ${aggregatedFeatures.f0Hz}Hz F0)`,
    };

    return voice;
  }
}

export const voiceCloneService = new VoiceCloneService();
