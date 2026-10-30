import React, { useState } from 'react';
import {
  Waves,
  Plus,
  Trash2,
  Play,
  Pause,
  Sliders,
  Sparkles,
  ArrowRight,
  Clock,
  User,
  AudioWaveform,
  RotateCcw,
} from 'lucide-react';
import { ScriptSegment, VoiceProfile } from '../types/index.ts';
import { ACCENTS, EMOTIONAL_TONES, SAMPLE_DIALOGUE_SCRIPT } from '../data/constants.ts';
import { parseScriptToSegments } from '../utils/scriptParser.ts';
import { audioEngine } from '../services/audioEngine.ts';
import { formatDuration } from '../utils/audioEncoding.ts';

interface MultiSpeakerDialogueTabProps {
  voices: VoiceProfile[];
  onDialogueMasterGenerated: (
    audioBuffer: AudioBuffer,
    title: string
  ) => void;
  onOpenInEditor: () => void;
  isLoggedIn?: boolean;
  onLoginRequired?: (reason?: 'free' | 'multi') => void;
}

export const MultiSpeakerDialogueTab: React.FC<MultiSpeakerDialogueTabProps> = ({
  voices,
  onDialogueMasterGenerated,
  onOpenInEditor,
  isLoggedIn = false,
  onLoginRequired,
}) => {
  const [segments, setSegments] = useState<ScriptSegment[]>(() =>
    parseScriptToSegments(SAMPLE_DIALOGUE_SCRIPT, voices)
  );

  const [isGeneratingAll, setIsGeneratingAll] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [masterBuffer, setMasterBuffer] = useState<AudioBuffer | null>(null);
  const [isPlayingMaster, setIsPlayingMaster] = useState<boolean>(false);

  // Add new segment
  const handleAddSegment = () => {
    const newSegment: ScriptSegment = {
      id: `seg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      speakerId: voices[0]?.id || 'voice-kore',
      text: '',
      language: 'en-US',
      accent: 'General American',
      emotion: 'Natural Conversational',
      speed: 1.0,
      pitchShift: 0,
      pauseAfterMs: 400,
    };
    setSegments([...segments, newSegment]);
  };

  // Remove segment
  const handleRemoveSegment = (id: string) => {
    if (segments.length <= 1) return;
    setSegments(segments.filter((s) => s.id !== id));
  };

  // Update segment field
  const handleUpdateSegment = (id: string, updates: Partial<ScriptSegment>) => {
    setSegments(
      segments.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  // Reset to default sample script
  const handleResetSample = () => {
    setSegments(parseScriptToSegments(SAMPLE_DIALOGUE_SCRIPT, voices));
    setMasterBuffer(null);
  };

  // Play a single segment preview
  const handlePlaySegment = async (segment: ScriptSegment) => {
    if (!isLoggedIn) {
      onLoginRequired?.('multi');
      return;
    }
    if (playingSegmentId === segment.id) {
      audioEngine.stop();
      setPlayingSegmentId(null);
      return;
    }

    setPlayingSegmentId(segment.id);
    const speaker = voices.find((v) => v.id === segment.speakerId) || voices[0];

    try {
      // Fetch single line audio from server
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: segment.text || 'Dialogue sample line',
          language: segment.language,
          accent: segment.accent,
          emotion: segment.emotion,
          voiceName: speaker?.baseVoice || 'Puck',
          customStylePrompt: speaker?.isClone ? speaker.customStylePrompt : '',
          speed: segment.speed,
          pitchShift: segment.pitchShift,
        }),
      });

      if (!res.ok) throw new Error('Preview synthesis failed');
      const data = await res.json();
      const buffer = await audioEngine.decodeAudio(data.audioBase64);

      audioEngine.setActiveBuffer(buffer);
      audioEngine.onEnded(() => setPlayingSegmentId(null));
      audioEngine.play({
        trimStart: 0,
        trimEnd: buffer.duration,
        playbackRate: segment.speed,
        pitchShiftSemitones: segment.pitchShift,
        volume: 1.0,
        eqBass: 0,
        eqMid: 0,
        eqTreble: 0,
        reverbAmount: 0,
        noiseGate: false,
      });
    } catch (err) {
      console.warn('Using acoustic preview fallback:', err);
      const synthBuffer = audioEngine.generateDemoVoiceoverBuffer(
        Math.max(2.0, segment.text.length * 0.05),
        speaker?.gender === 'female' ? 230 : 130
      );
      audioEngine.setActiveBuffer(synthBuffer);
      audioEngine.onEnded(() => setPlayingSegmentId(null));
      audioEngine.play({
        trimStart: 0,
        trimEnd: synthBuffer.duration,
        playbackRate: segment.speed,
        pitchShiftSemitones: segment.pitchShift,
        volume: 1.0,
        eqBass: 0,
        eqMid: 0,
        eqTreble: 0,
        reverbAmount: 0,
        noiseGate: false,
      });
    }
  };

  // Generate complete stitched multi-speaker audio master
  const handleGenerateFullDialogue = async () => {
    if (!isLoggedIn) {
      onLoginRequired?.('multi');
      return;
    }
    setIsGeneratingAll(true);
    setGenerationProgress('Synthesizing dialogue lines...');

    try {
      const generatedAudioBuffers: { buffer: AudioBuffer; pauseAfterMs: number }[] = [];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (!seg.text.trim()) continue;

        setGenerationProgress(`Rendering line ${i + 1} of ${segments.length}...`);
        const speaker = voices.find((v) => v.id === seg.speakerId) || voices[0];

        try {
          const res = await fetch('/api/tts/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: seg.text,
              language: seg.language,
              accent: seg.accent,
              emotion: seg.emotion,
              voiceName: speaker?.baseVoice || 'Kore',
              customStylePrompt: speaker?.isClone ? speaker.customStylePrompt : '',
              speed: seg.speed,
              pitchShift: seg.pitchShift,
            }),
          });

          if (!res.ok) throw new Error('Line synthesis error');
          const data = await res.json();
          const buf = await audioEngine.decodeAudio(data.audioBase64);
          generatedAudioBuffers.push({ buffer: buf, pauseAfterMs: seg.pauseAfterMs });
        } catch (err) {
          // Synthetic line
          const fallbackBuf = audioEngine.generateDemoVoiceoverBuffer(
            Math.max(2.2, seg.text.length * 0.055),
            speaker?.gender === 'female' ? 235 : 125
          );
          generatedAudioBuffers.push({ buffer: fallbackBuf, pauseAfterMs: seg.pauseAfterMs });
        }
      }

      if (generatedAudioBuffers.length === 0) {
        throw new Error('Please enter text for at least one line.');
      }

      setGenerationProgress('Assembling and mastering multi-voice timeline...');

      // Combine into one master AudioBuffer with precise pause spacing
      const ctx = audioEngine.getContext();
      const sampleRate = ctx.sampleRate;

      // Calculate total sample length
      let totalSamples = 0;
      for (const item of generatedAudioBuffers) {
        totalSamples += Math.floor((item.buffer.duration * sampleRate) / 1);
        totalSamples += Math.floor((item.pauseAfterMs / 1000) * sampleRate);
      }

      const master = ctx.createBuffer(1, totalSamples, sampleRate);
      const masterChannel = master.getChannelData(0);

      let writeOffset = 0;
      for (const item of generatedAudioBuffers) {
        const srcChannel = item.buffer.getChannelData(0);
        masterChannel.set(srcChannel, writeOffset);
        writeOffset += srcChannel.length;
        // Pause gap is already zeroed in new Float32Array
        writeOffset += Math.floor((item.pauseAfterMs / 1000) * sampleRate);
      }

      setMasterBuffer(master);
      onDialogueMasterGenerated(master, 'Multi-Speaker Dialogue Master');
    } catch (e: any) {
      console.error('Error generating dialogue master:', e);
      alert(e.message || 'Failed to generate dialogue master.');
    } finally {
      setIsGeneratingAll(false);
      setGenerationProgress('');
    }
  };

  const handleTogglePlayMaster = () => {
    if (!masterBuffer) return;
    if (isPlayingMaster) {
      audioEngine.stop();
      setIsPlayingMaster(false);
    } else {
      audioEngine.setActiveBuffer(masterBuffer);
      audioEngine.onEnded(() => setIsPlayingMaster(false));
      audioEngine.play({
        trimStart: 0,
        trimEnd: masterBuffer.duration,
        playbackRate: 1.0,
        pitchShiftSemitones: 0,
        volume: 1.0,
        eqBass: 0,
        eqMid: 0,
        eqTreble: 0,
        reverbAmount: 0,
        noiseGate: false,
      });
      setIsPlayingMaster(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Waves className="w-4 h-4 text-indigo-400" />
            <span>Multi-Voice Dialogue & Script Studio</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Direct multi-character scenes, podcast interviews, and screenplays with distinct accents and timing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetSample}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Load Demo Script</span>
          </button>

          <button
            onClick={handleAddSegment}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-900/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Speaker Line</span>
          </button>
        </div>
      </div>

      {/* Segments List */}
      <div className="space-y-3">
        {segments.map((segment, index) => {
          const currentSpeaker = voices.find((v) => v.id === segment.speakerId) || voices[0];
          const isPlayingThis = playingSegmentId === segment.id;

          return (
            <div
              key={segment.id}
              className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3"
            >
              {/* Speaker Header & Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 text-[11px] font-mono flex items-center justify-center">
                    {index + 1}
                  </span>

                  {/* Speaker Selector */}
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    <select
                      value={segment.speakerId}
                      onChange={(e) => handleUpdateSegment(segment.id, { speakerId: e.target.value })}
                      className="bg-zinc-950 border border-zinc-800 text-xs font-semibold text-white rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      {voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} {v.isClone ? '(Clone)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Accent Selector */}
                  <select
                    value={segment.accent}
                    onChange={(e) => handleUpdateSegment(segment.id, { accent: e.target.value })}
                    className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2 py-1 focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    {ACCENTS.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>

                  {/* Emotion Selector */}
                  <select
                    value={segment.emotion}
                    onChange={(e) => handleUpdateSegment(segment.id, { emotion: e.target.value })}
                    className="bg-zinc-950 border border-zinc-800 text-xs text-rose-300 rounded-lg px-2 py-1 focus:ring-1 focus:ring-rose-500 cursor-pointer"
                  >
                    {EMOTIONAL_TONES.map((em) => (
                      <option key={em.id} value={em.name}>
                        {em.name.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions & Pause Slider */}
                <div className="flex items-center gap-3">
                  {/* Pause After Line */}
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    <span>Pause:</span>
                    <input
                      type="number"
                      min="100"
                      max="3000"
                      step="100"
                      value={segment.pauseAfterMs}
                      onChange={(e) =>
                        handleUpdateSegment(segment.id, {
                          pauseAfterMs: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-14 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-xs text-zinc-200 font-mono text-center"
                    />
                    <span className="text-[10px]">ms</span>
                  </div>

                  {/* Play Line */}
                  <button
                    onClick={() => handlePlaySegment(segment)}
                    disabled={!segment.text.trim()}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      isPlayingThis
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300'
                    }`}
                    title="Preview this line"
                  >
                    {isPlayingThis ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                  </button>

                  {/* Delete Line */}
                  {segments.length > 1 && (
                    <button
                      onClick={() => handleRemoveSegment(segment.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete line"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Text Input */}
              <textarea
                value={segment.text}
                onChange={(e) => handleUpdateSegment(segment.id, { text: e.target.value })}
                rows={2}
                placeholder={`Dialogue line for ${currentSpeaker.name}...`}
                className="w-full bg-zinc-950 border border-zinc-800/90 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans resize-y"
              />
            </div>
          );
        })}
      </div>

      {/* Master Generation Bar */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Full Multi-Speaker Stitched Master</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Render all {segments.length} lines seamlessly with calibrated character pauses and export to editor.
            </p>
          </div>

          <button
            onClick={handleGenerateFullDialogue}
            disabled={isGeneratingAll}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
              isGeneratingAll
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 via-rose-500 to-amber-500 hover:from-indigo-500 hover:to-amber-400 text-white shadow-indigo-900/30'
            }`}
          >
            {isGeneratingAll ? (
              <>
                <AudioWaveform className="w-4 h-4 animate-pulse" />
                <span>{generationProgress || 'Rendering Dialogue...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Generate Master Dialogue</span>
              </>
            )}
          </button>
        </div>

        {/* Master Output Ready Banner */}
        {masterBuffer && (
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Waves className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <span className="text-xs font-semibold text-white">Master Dialogue Assembled</span>
                <p className="text-[11px] text-zinc-400">
                  Total Runtime: {formatDuration(masterBuffer.duration)} • {segments.length} segments
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePlayMaster}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-medium text-xs transition-colors cursor-pointer"
              >
                {isPlayingMaster ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play Master</span>
                  </>
                )}
              </button>

              <button
                onClick={onOpenInEditor}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs border border-zinc-700 transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Open in Audio Lab</span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
