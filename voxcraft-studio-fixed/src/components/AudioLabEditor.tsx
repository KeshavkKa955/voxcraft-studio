import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  Repeat,
  Sliders,
  Scissors,
  Music2,
  Volume2,
  VolumeX,
  RotateCcw,
  Download,
  FastForward,
  Sparkles,
  Layers,
} from 'lucide-react';
import { AudioEditState } from '../types/index.ts';
import { audioEngine } from '../services/audioEngine.ts';
import { formatDuration } from '../utils/audioEncoding.ts';

interface AudioLabEditorProps {
  audioBuffer: AudioBuffer | null;
  trackTitle: string;
  onOpenExport: () => void;
}

export const AudioLabEditor: React.FC<AudioLabEditorProps> = ({
  audioBuffer,
  trackTitle,
  onOpenExport,
}) => {
  // Master Edit State
  const [editState, setEditState] = useState<AudioEditState>({
    trimStart: 0,
    trimEnd: audioBuffer ? audioBuffer.duration : 10,
    playbackRate: 1.0,
    pitchShiftSemitones: 0,
    volume: 1.0,
    eqBass: 0,
    eqMid: 0,
    eqTreble: 0,
    reverbAmount: 0,
    noiseGate: false,
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isBypass, setIsBypass] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize trimEnd when new buffer is loaded
  useEffect(() => {
    if (audioBuffer) {
      setEditState((prev) => ({
        ...prev,
        trimStart: 0,
        trimEnd: audioBuffer.duration,
      }));
      setCurrentTime(0);
      audioEngine.setActiveBuffer(audioBuffer);
    }
  }, [audioBuffer]);

  // Sync AudioEngine callbacks
  useEffect(() => {
    audioEngine.onTimeUpdate((timeSec) => {
      setCurrentTime(timeSec);
    });

    audioEngine.onEnded(() => {
      setIsPlaying(false);
    });

    return () => {
      audioEngine.stop();
    };
  }, []);

  // Update live parameters on the fly
  useEffect(() => {
    if (isBypass) {
      audioEngine.updateLiveParams({
        ...editState,
        playbackRate: 1.0,
        pitchShiftSemitones: 0,
        eqBass: 0,
        eqMid: 0,
        eqTreble: 0,
      });
    } else {
      audioEngine.updateLiveParams(editState);
    }
  }, [editState, isBypass]);

  // Handle loop change
  useEffect(() => {
    audioEngine.setLoop(isLooping);
  }, [isLooping]);

  // Canvas Waveform rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    // Dynamically match canvas internal coordinate system to container clientWidth
    if (canvas.parentElement) {
      const containerWidth = canvas.parentElement.clientWidth;
      if (containerWidth > 100 && canvas.width !== containerWidth) {
        canvas.width = containerWidth;
      }
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const channelData = audioBuffer.getChannelData(0);
    const step = Math.ceil(channelData.length / width);
    const duration = audioBuffer.duration;

    // Draw background grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Active trim range in pixels
    const trimStartPx = (editState.trimStart / duration) * width;
    const trimEndPx = (editState.trimEnd / duration) * width;

    // Dim regions outside trim
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, trimStartPx, height);
    ctx.fillRect(trimEndPx, 0, width - trimEndPx, height);

    // Waveform drawing
    const amp = height / 2;
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = channelData[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      const inActiveRange = i >= trimStartPx && i <= trimEndPx;

      // Gradient color for waveform
      if (inActiveRange) {
        ctx.fillStyle = '#f59e0b'; // Amber 500 for active
      } else {
        ctx.fillStyle = '#52525b'; // Zinc 600 for trimmed out
      }

      const barHeight = Math.max(2, (max - min) * amp * 0.9);
      const y = (height - barHeight) / 2;
      ctx.fillRect(i, y, 1, barHeight);
    }

    // Draw Trim handles
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    // Trim Start line
    ctx.beginPath();
    ctx.moveTo(trimStartPx, 0);
    ctx.lineTo(trimStartPx, height);
    ctx.stroke();

    // Trim End line
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(trimEndPx, 0);
    ctx.lineTo(trimEndPx, height);
    ctx.stroke();

    // Draw current playhead
    const playheadPx = (currentTime / duration) * width;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(playheadPx, 0);
    ctx.lineTo(playheadPx, height);
    ctx.stroke();
    ctx.shadowBlur = 0; // reset
  }, [audioBuffer, currentTime, editState.trimStart, editState.trimEnd]);

  // Scrub timeline on canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioBuffer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * audioBuffer.duration;

    setCurrentTime(targetTime);
    if (isPlaying) {
      audioEngine.play(editState, targetTime);
    }
  };

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    if (!audioBuffer) return;
    if (isPlaying) {
      audioEngine.pause(currentTime);
      setIsPlaying(false);
    } else {
      audioEngine.setActiveBuffer(audioBuffer);
      audioEngine.play(editState, currentTime);
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setCurrentTime(editState.trimStart);
  };

  const handleResetDSP = () => {
    if (!audioBuffer) return;
    setEditState({
      trimStart: 0,
      trimEnd: audioBuffer.duration,
      playbackRate: 1.0,
      pitchShiftSemitones: 0,
      volume: 1.0,
      eqBass: 0,
      eqMid: 0,
      eqTreble: 0,
      reverbAmount: 0,
      noiseGate: false,
    });
  };

  if (!audioBuffer) {
    return (
      <div className="p-12 text-center rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700 mx-auto flex items-center justify-center text-zinc-400">
          <Sliders className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">No Audio Loaded in Editor</h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Generate a voiceover from the "Voiceover" or "Multi-Voice" tab first, or calibrate a cloned voice to begin precision timing and pitch editing.
        </p>
      </div>
    );
  }

  const duration = audioBuffer.duration;
  const activeDuration = Math.max(0, editState.trimEnd - editState.trimStart);
  const effectivePlayDuration = activeDuration / editState.playbackRate;

  return (
    <div className="space-y-6">
      {/* Top Bar with Track Title & Export Action */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">{trackTitle || 'Voiceover Master Track'}</h2>
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
              <span>Original: {formatDuration(duration)}</span>
              <span>•</span>
              <span className="text-amber-400">Active Output: {formatDuration(effectivePlayDuration)}</span>
              <span>•</span>
              <span>{audioBuffer.sampleRate}Hz</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* A/B Bypass DSP Toggle */}
          <button
            onClick={() => setIsBypass(!isBypass)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              isBypass
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
            }`}
            title="Toggle between Raw audio and Processed DSP"
          >
            {isBypass ? 'Bypass Active (Raw)' : 'DSP Active (Processed)'}
          </button>

          <button
            onClick={handleResetDSP}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
            title="Reset all EQ, Pitch, Speed, and Trims"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-950/40 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Master</span>
          </button>
        </div>
      </div>

      {/* Main Waveform & Transport Deck */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        {/* Canvas Visualizer */}
        <div className="relative rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800/90 shadow-inner">
          <canvas
            ref={canvasRef}
            width={850}
            height={160}
            onClick={handleCanvasClick}
            className="w-full h-36 cursor-pointer block"
          />

          {/* Time floating indicator */}
          <div className="absolute top-2 left-3 text-[11px] font-mono text-zinc-300 bg-zinc-900/90 px-2 py-0.5 rounded border border-zinc-700/60 pointer-events-none">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </div>
        </div>

        {/* Transport Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Play, Stop, Loop */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePlay}
              className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={handleStop}
              className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
              title="Stop and return to start"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>

            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors cursor-pointer ${
                isLooping
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
              title="Loop Region"
            >
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          {/* Volume Gain Slider */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextMute = !isMuted;
                setIsMuted(nextMute);
                setEditState((prev) => ({ ...prev, volume: nextMute ? 0 : 1.0 }));
              }}
              className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
            >
              {isMuted || editState.volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-zinc-300" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={editState.volume}
              onChange={(e) => setEditState({ ...editState, volume: parseFloat(e.target.value) })}
              className="w-24 accent-amber-500 cursor-pointer"
            />
            <span className="text-xs font-mono text-zinc-400 w-10 text-right">
              {Math.round(editState.volume * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Editor Control Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Module 1: Timing & Playback Speed */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FastForward className="w-4 h-4 text-amber-400" />
              <span>Timing & Playback Speed</span>
            </h3>
            <span className="text-xs font-mono font-bold text-amber-400">
              {editState.playbackRate.toFixed(2)}x
            </span>
          </div>

          {/* Speed Slider */}
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
              <span>Tempo Multiplier</span>
              <span>{Math.round(editState.playbackRate * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.05"
              value={editState.playbackRate}
              onChange={(e) =>
                setEditState({ ...editState, playbackRate: parseFloat(e.target.value) })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />

            {/* Quick Presets */}
            <div className="flex gap-1.5 mt-2">
              {[0.8, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setEditState({ ...editState, playbackRate: rate })}
                  className={`flex-1 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                    editState.playbackRate === rate
                      ? 'bg-amber-500 text-zinc-950 font-bold'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Trimming Controls */}
          <div className="space-y-2 border-t border-zinc-800/80 pt-3">
            <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-zinc-400" />
              <span>Boundary Trimming</span>
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">Start Trim (s)</label>
                <input
                  type="number"
                  min="0"
                  max={editState.trimEnd - 0.1}
                  step="0.1"
                  value={Number(editState.trimStart.toFixed(1))}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      trimStart: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">End Trim (s)</label>
                <input
                  type="number"
                  min={editState.trimStart + 0.1}
                  max={duration}
                  step="0.1"
                  value={Number(editState.trimEnd.toFixed(1))}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      trimEnd: Math.min(duration, parseFloat(e.target.value) || duration),
                    })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Module 2: Pitch Shifting & Formant Register */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Music2 className="w-4 h-4 text-indigo-400" />
              <span>Pitch Shifter (DSP)</span>
            </h3>
            <span className="text-xs font-mono font-bold text-indigo-400">
              {editState.pitchShiftSemitones > 0
                ? `+${editState.pitchShiftSemitones}`
                : editState.pitchShiftSemitones}{' '}
              st
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
              <span>Semitones Shift</span>
              <span>-12 to +12 st</span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="1"
              value={editState.pitchShiftSemitones}
              onChange={(e) =>
                setEditState({
                  ...editState,
                  pitchShiftSemitones: parseInt(e.target.value, 10),
                })
              }
              className="w-full accent-indigo-500 cursor-pointer"
            />

            {/* Pitch Presets */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              <button
                onClick={() => setEditState({ ...editState, pitchShiftSemitones: -5 })}
                className="py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 transition-colors cursor-pointer"
              >
                Deep (-5)
              </button>
              <button
                onClick={() => setEditState({ ...editState, pitchShiftSemitones: 0 })}
                className="py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 transition-colors cursor-pointer"
              >
                Natural (0)
              </button>
              <button
                onClick={() => setEditState({ ...editState, pitchShiftSemitones: 4 })}
                className="py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 transition-colors cursor-pointer"
              >
                Crisp (+4)
              </button>
              <button
                onClick={() => setEditState({ ...editState, pitchShiftSemitones: 8 })}
                className="py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 transition-colors cursor-pointer"
              >
                High (+8)
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
            Real-time Web Audio DSP phase-shifted detune. Shifts fundamental harmonics without introducing distortion artifacts.
          </div>
        </div>

        {/* Module 3: 3-Band Parametric EQ */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>3-Band Studio EQ</span>
            </h3>
            <span className="text-xs text-zinc-500 font-mono">-12dB to +12dB</span>
          </div>

          {/* Bass Band */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400">Bass (250Hz Low-Shelf)</span>
              <span className="text-zinc-200 font-mono">{editState.eqBass > 0 ? `+${editState.eqBass}` : editState.eqBass} dB</span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={editState.eqBass}
              onChange={(e) => setEditState({ ...editState, eqBass: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Mid Band */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400">Mid (1.5kHz Presence)</span>
              <span className="text-zinc-200 font-mono">{editState.eqMid > 0 ? `+${editState.eqMid}` : editState.eqMid} dB</span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={editState.eqMid}
              onChange={(e) => setEditState({ ...editState, eqMid: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Treble Band */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400">Treble (4.5kHz Air)</span>
              <span className="text-zinc-200 font-mono">{editState.eqTreble > 0 ? `+${editState.eqTreble}` : editState.eqTreble} dB</span>
            </div>
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={editState.eqTreble}
              onChange={(e) => setEditState({ ...editState, eqTreble: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
