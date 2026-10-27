/**
 * Professional Web Audio API engine for real-time playback, DSP effects,
 * pitch shifting, equalization, trimming, waveform visualization, and offline rendering export.
 */

import { encodeWav, SimpleAudioBuffer } from '../utils/audioEncoding.ts';
import { AudioEditState } from '../types/index.ts';

class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private eqBassNode: BiquadFilterNode | null = null;
  private eqMidNode: BiquadFilterNode | null = null;
  private eqTrebleNode: BiquadFilterNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private activeAudioBuffer: AudioBuffer | null = null;
  private playbackStartTime = 0;
  private pausedAtOffset = 0;
  private isPlaying = false;
  private loop = false;

  private onEndedCallback: (() => void) | null = null;
  private onTimeUpdateCallback: ((timeSec: number) => void) | null = null;
  private animFrameId: number | null = null;

  public getContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public async decodeAudio(data: ArrayBuffer | Uint8Array | string): Promise<AudioBuffer> {
    const ctx = this.getContext();
    let arrayBuffer: ArrayBuffer;

    if (typeof data === 'string') {
      // Base64 string
      const cleanBase64 = data.replace(/^data:audio\/[^;]+;base64,/, '');
      const binaryString = atob(cleanBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      arrayBuffer = bytes.buffer;
    } else if (data instanceof Uint8Array) {
      arrayBuffer = data.buffer;
    } else {
      arrayBuffer = data;
    }

    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  }

  public setActiveBuffer(buffer: AudioBuffer) {
    this.stop();
    this.activeAudioBuffer = buffer;
    this.pausedAtOffset = 0;
  }

  public getActiveBuffer(): AudioBuffer | null {
    return this.activeAudioBuffer;
  }

  public setLoop(loop: boolean) {
    this.loop = loop;
    if (this.currentSource) {
      this.currentSource.loop = loop;
    }
  }

  public onEnded(cb: () => void) {
    this.onEndedCallback = cb;
  }

  public onTimeUpdate(cb: (timeSec: number) => void) {
    this.onTimeUpdateCallback = cb;
  }

  /**
   * Starts or resumes playback with real-time DSP parameters
   */
  public play(
    editState: AudioEditState,
    startOffsetSec?: number
  ) {
    if (!this.activeAudioBuffer) return;
    const ctx = this.getContext();

    // Stop existing playback if any
    this.stopPlaybackOnly();

    const buffer = this.activeAudioBuffer;
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // 1. Equalizer nodes
    const bass = ctx.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 250;
    bass.gain.value = editState.eqBass;

    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1500;
    mid.Q.value = 1.0;
    mid.gain.value = editState.eqMid;

    const treble = ctx.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = 4500;
    treble.gain.value = editState.eqTreble;

    // 2. Volume Gain
    const gain = ctx.createGain();
    gain.gain.value = editState.volume;

    // 3. Analyser for VU and visualizer
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;

    // 4. Pitch & Speed settings:
    // Detune in cents: 1 semitone = 100 cents
    source.detune.value = editState.pitchShiftSemitones * 100;
    source.playbackRate.value = editState.playbackRate;

    // Connect node chain: source -> bass -> mid -> treble -> gain -> analyser -> destination
    source.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    treble.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);

    this.currentSource = source;
    this.gainNode = gain;
    this.eqBassNode = bass;
    this.eqMidNode = mid;
    this.eqTrebleNode = treble;
    this.analyserNode = analyser;

    // Timing
    const trimStart = Math.max(0, editState.trimStart || 0);
    const trimEnd = editState.trimEnd > 0 ? Math.min(buffer.duration, editState.trimEnd) : buffer.duration;
    const duration = Math.max(0.1, trimEnd - trimStart);

    let offset = startOffsetSec !== undefined ? startOffsetSec : this.pausedAtOffset;
    if (offset < trimStart || offset >= trimEnd) {
      offset = trimStart;
    }

    this.playbackStartTime = ctx.currentTime - (offset - trimStart) / editState.playbackRate;
    this.pausedAtOffset = offset;
    this.isPlaying = true;

    source.loop = this.loop;
    if (this.loop) {
      source.loopStart = trimStart;
      source.loopEnd = trimEnd;
    }

    const playDuration = (trimEnd - offset) / editState.playbackRate;
    source.start(0, offset, this.loop ? undefined : playDuration);

    source.onended = () => {
      if (this.isPlaying && !this.loop) {
        this.isPlaying = false;
        this.pausedAtOffset = trimStart;
        if (this.onEndedCallback) this.onEndedCallback();
      }
    };

    this.startTracking(editState, trimStart, trimEnd);
  }

  private startTracking(editState: AudioEditState, trimStart: number, trimEnd: number) {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);

    const track = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      const elapsed = (this.audioCtx.currentTime - this.playbackStartTime) * editState.playbackRate;
      const currentPos = trimStart + elapsed;

      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(Math.min(trimEnd, currentPos));
      }

      if (currentPos >= trimEnd && !this.loop) {
        this.stop();
        return;
      }

      this.animFrameId = requestAnimationFrame(track);
    };

    this.animFrameId = requestAnimationFrame(track);
  }

  public updateLiveParams(editState: AudioEditState) {
    if (!this.currentSource || !this.gainNode || !this.eqBassNode || !this.eqMidNode || !this.eqTrebleNode) {
      return;
    }
    this.gainNode.gain.setValueAtTime(editState.volume, this.audioCtx?.currentTime || 0);
    this.eqBassNode.gain.setValueAtTime(editState.eqBass, this.audioCtx?.currentTime || 0);
    this.eqMidNode.gain.setValueAtTime(editState.eqMid, this.audioCtx?.currentTime || 0);
    this.eqTrebleNode.gain.setValueAtTime(editState.eqTreble, this.audioCtx?.currentTime || 0);
    this.currentSource.detune.setValueAtTime(editState.pitchShiftSemitones * 100, this.audioCtx?.currentTime || 0);
    this.currentSource.playbackRate.setValueAtTime(editState.playbackRate, this.audioCtx?.currentTime || 0);
  }

  public pause(currentTimeSec?: number) {
    if (!this.isPlaying) return;
    if (currentTimeSec !== undefined) {
      this.pausedAtOffset = currentTimeSec;
    }
    this.stopPlaybackOnly();
    this.isPlaying = false;
  }

  public stop() {
    this.stopPlaybackOnly();
    this.isPlaying = false;
    this.pausedAtOffset = 0;
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(0);
    }
    if (this.onEndedCallback) {
      this.onEndedCallback();
    }
  }

  private stopPlaybackOnly() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
      this.currentSource = null;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getAnalyserData(): Uint8Array | null {
    if (!this.analyserNode || !this.isPlaying) return null;
    const freqData = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(freqData);
    return freqData;
  }

  /**
   * Offline rendering: applies exact trimming, speed, pitch shift, EQ, and master gain
   * and renders into a clean, uncompressed AudioBuffer for lossless download.
   */
  public async renderOfflineExport(
    sourceBuffer: AudioBuffer,
    editState: AudioEditState,
    targetSampleRate = 44100
  ): Promise<AudioBuffer> {
    const trimStart = Math.max(0, editState.trimStart || 0);
    const trimEnd = editState.trimEnd > 0 ? Math.min(sourceBuffer.duration, editState.trimEnd) : sourceBuffer.duration;
    const trimmedDuration = Math.max(0.1, trimEnd - trimStart);

    // Duration scaled by playback speed
    const outputDuration = trimmedDuration / editState.playbackRate;
    const length = Math.ceil(outputDuration * targetSampleRate);

    const offlineCtx = new OfflineAudioContext(
      sourceBuffer.numberOfChannels,
      length,
      targetSampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = sourceBuffer;
    source.detune.value = editState.pitchShiftSemitones * 100;
    source.playbackRate.value = editState.playbackRate;

    // Filters
    const bass = offlineCtx.createBiquadFilter();
    bass.type = 'lowshelf';
    bass.frequency.value = 250;
    bass.gain.value = editState.eqBass;

    const mid = offlineCtx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1500;
    mid.Q.value = 1.0;
    mid.gain.value = editState.eqMid;

    const treble = offlineCtx.createBiquadFilter();
    treble.type = 'highshelf';
    treble.frequency.value = 4500;
    treble.gain.value = editState.eqTreble;

    const gain = offlineCtx.createGain();
    gain.gain.value = editState.volume;

    source.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    treble.connect(gain);
    gain.connect(offlineCtx.destination);

    source.start(0, trimStart, outputDuration);

    return await offlineCtx.startRendering();
  }

  /**
   * Exports rendered audio buffer into a downloadable Blob with selected format.
   */
  public async exportAudioBlob(
    buffer: AudioBuffer,
    format: 'wav' | 'mp3' | 'webm' | 'ogg' | 'flac' = 'wav'
  ): Promise<{ blob: Blob; filename: string; mimeType: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const simpleBuffer: SimpleAudioBuffer = {
      numberOfChannels: buffer.numberOfChannels,
      sampleRate: buffer.sampleRate,
      length: buffer.length,
      getChannelData: (ch: number) => buffer.getChannelData(ch),
    };

    if (format === 'wav') {
      const wavBytes = encodeWav(simpleBuffer);
      const blob = new Blob([wavBytes], { type: 'audio/wav' });
      return { blob, filename: `voxcraft-${timestamp}.wav`, mimeType: 'audio/wav' };
    }

    // For WebM or OGG/MP3 in modern browser:
    // Create an audio stream from an in-memory AudioBuffer and record via MediaRecorder
    if (typeof MediaRecorder !== 'undefined') {
      const mime = format === 'webm' ? 'audio/webm' : 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported(mime)) {
        try {
          const blob = await this.renderToMediaRecorderBlob(buffer, mime);
          return {
            blob,
            filename: `voxcraft-${timestamp}.${format === 'mp3' ? 'mp3' : format}`,
            mimeType: mime,
          };
        } catch (e) {
          console.warn('MediaRecorder encoding fallback to WAV:', e);
        }
      }
    }

    // Default fallback to high quality WAV (safe in all browsers)
    const wavBytes = encodeWav(simpleBuffer);
    const blob = new Blob([wavBytes], { type: 'audio/wav' });
    return { blob, filename: `voxcraft-${timestamp}.wav`, mimeType: 'audio/wav' };
  }

  private renderToMediaRecorderBlob(buffer: AudioBuffer, mimeType: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const ctx = this.getContext();
      const dest = ctx.createMediaStreamDestination();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(dest);

      const recorder = new MediaRecorder(dest.stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(chunks, { type: mimeType });
        resolve(fullBlob);
      };

      recorder.onerror = (err) => reject(err);

      recorder.start();
      source.start(0);

      setTimeout(() => {
        try {
          recorder.stop();
          source.stop();
        } catch (e) {
          // ignore
        }
      }, (buffer.duration + 0.2) * 1000);
    });
  }

  /**
   * Generates a synthetic demo voiceover audio buffer in case of offline testing.
   */
  public generateDemoVoiceoverBuffer(durationSec = 3.5, baseHz = 210): AudioBuffer {
    const ctx = this.getContext();
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(durationSec * sampleRate);
    const audioBuffer = ctx.createBuffer(1, length, sampleRate);
    const channel = audioBuffer.getChannelData(0);

    // Creates an acoustic modulated voice-like harmonic formant series
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Speech syllable rhythm envelope (~3-4 syllables per second)
      const syllable = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3.5 * t);
      // Intonation contour (rises and falls naturally)
      const pitchMod = 1 + 0.15 * Math.sin(2 * Math.PI * 0.8 * t);
      const f = baseHz * pitchMod;

      // Formants (harmonics)
      const h1 = Math.sin(2 * Math.PI * f * t);
      const h2 = 0.5 * Math.sin(2 * Math.PI * (f * 2) * t);
      const h3 = 0.25 * Math.sin(2 * Math.PI * (f * 3) * t);
      const h4 = 0.15 * Math.sin(2 * Math.PI * (f * 4) * t);

      // Soft breathiness
      const breath = (Math.random() - 0.5) * 0.04;

      channel[i] = (h1 + h2 + h3 + h4 + breath) * 0.3 * syllable;
    }

    return audioBuffer;
  }
}

export const audioEngine = new AudioEngine();
