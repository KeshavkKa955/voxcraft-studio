import React, { useState, useEffect } from 'react';
import {
  Mic2,
  Sparkles,
  Volume2,
  Play,
  Pause,
  Sliders,
  Globe2,
  Smile,
  Compass,
  ArrowRight,
  RotateCcw,
  AudioWaveform,
  ChevronDown,
  Info,
} from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  ACCENTS,
  EMOTIONAL_TONES,
  SAMPLE_STUDIO_SCRIPTS,
} from '../data/constants.ts';
import { VoiceProfile } from '../types/index.ts';
import { audioEngine } from '../services/audioEngine.ts';
import { formatDuration } from '../utils/audioEncoding.ts';
import { guestUsage } from '../services/accountService.ts';
import type { HistoryItem, VoiceSettings } from '../services/accountService.ts';
import { colabService } from '../services/colabService.ts';

interface SingleVoiceoverTabProps {
  voices: VoiceProfile[];
  onVoiceoverGenerated: (audioBuffer: AudioBuffer, text: string, voiceName: string) => void;
  onOpenInEditor: () => void;
  settings?: VoiceSettings;
  onSettingsChange?: (settings: VoiceSettings) => void;
  history?: HistoryItem[];
  isLoggedIn?: boolean;
  onLoginRequired?: (reason?: 'free' | 'multi') => void;
}

export const SingleVoiceoverTab: React.FC<SingleVoiceoverTabProps> = ({
  voices,
  onVoiceoverGenerated,
  onOpenInEditor,
  settings,
  onSettingsChange,
  history = [],
  isLoggedIn = false,
  onLoginRequired,
}) => {
  const [text, setText] = useState<string>(SAMPLE_STUDIO_SCRIPTS[0].text);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(settings?.language || 'en-US');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(settings?.voiceId && voices.some((v) => v.id === settings.voiceId) ? settings.voiceId : voices[0]?.id || 'voice-kore');
  const [selectedAccent, setSelectedAccent] = useState<string>(settings?.accent || 'General American');
  const [selectedEmotion, setSelectedEmotion] = useState<string>(settings?.emotion || 'Natural Conversational');
  const [speed, setSpeed] = useState<number>(settings?.speed ?? 1.0);
  const [pitchShift, setPitchShift] = useState<number>(settings?.pitchShift ?? 0);
  const [customDirectives, setCustomDirectives] = useState<string>(settings?.customDirectives || '');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<{
    buffer: AudioBuffer;
    url: string;
    duration: number;
  } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);


  // Report setting changes so they can be remembered (browser, and account if logged in)
  useEffect(() => {
    onSettingsChange?.({
      language: selectedLanguage,
      voiceId: selectedVoiceId,
      accent: selectedAccent,
      emotion: selectedEmotion,
      speed,
      pitchShift,
      customDirectives,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage, selectedVoiceId, selectedAccent, selectedEmotion, speed, pitchShift, customDirectives]);

  const currentVoice = voices.find((v) => v.id === selectedVoiceId) || voices[0];

  const handleApplySample = (sample: (typeof SAMPLE_STUDIO_SCRIPTS)[0]) => {
    setText(sample.text);
    setSelectedLanguage(sample.language);
    setSelectedAccent(sample.accent);
    setSelectedEmotion(sample.emotion);
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setErrorMsg('Please enter or select text to convert into speech.');
      return;
    }

    // Guests get one free voice (your own Colab clone is always free)
    if (!isLoggedIn && !currentVoice?.colabRefAudio && guestUsage.used()) {
      onLoginRequired?.('free');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      let data: { audioBase64?: string };

      if (currentVoice?.colabRefAudio) {
        // Free cloning: your own Colab server
        data = await colabService.speak({
          text: text.trim(),
          language: selectedLanguage,
          referenceBase64: currentVoice.colabRefAudio,
          emotion: selectedEmotion,
        });
      } else {
        // 1. Call server Gemini TTS endpoint
        const response = await fetch('/api/tts/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text.trim(),
            language: selectedLanguage,
            accent: selectedAccent,
            emotion: selectedEmotion,
            voiceName: currentVoice?.baseVoice || 'Kore',
            voiceId: currentVoice?.geminiVoiceId || undefined,
            customStylePrompt: currentVoice?.isClone && !currentVoice.geminiVoiceId
              ? currentVoice.customStylePrompt
              : customDirectives,
            speed,
            pitchShift,
          }),
        });

        if (response.status === 401) {
          const e: any = new Error('Please log in to continue.');
          e.loginRequired = true;
          throw e;
        }
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server responded with status ${response.status}`);
        }

        data = await response.json();
        if (data.audioBase64 && !isLoggedIn) guestUsage.markUsed();
        if (!data.audioBase64) {
          throw new Error('No audio data received in response.');
        }

      }
      if (!data.audioBase64) {
        throw new Error('No audio data received in response.');
      }

      // Decode audio
      const audioBuffer = await audioEngine.decodeAudio(data.audioBase64);
      const blob = new Blob([Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0))], {
        type: 'audio/wav',
      });
      const url = URL.createObjectURL(blob);

      setGeneratedAudio({
        buffer: audioBuffer,
        url,
        duration: audioBuffer.duration,
      });

      onVoiceoverGenerated(audioBuffer, text, currentVoice?.name || 'Voice');
    } catch (err: any) {
      if (err?.loginRequired) {
        onLoginRequired?.('free');
        return;
      }
      if (currentVoice?.colabRefAudio || currentVoice?.geminiVoiceId) {
        // Never play the robotic fallback for a cloned voice: show the real problem instead
        console.warn('Cloned voice error:', err);
        setErrorMsg(`Could not generate in your cloned voice: ${err.message || 'unknown error'}`);
        return;
      }
      console.warn('Gemini server TTS error, activating studio synthetic generator fallback:', err);
      // Fallback: Generate studio synthetic voiceover so workflow never breaks
      const fallbackBuffer = audioEngine.generateDemoVoiceoverBuffer(
        Math.max(2.5, text.length * 0.06),
        currentVoice?.gender === 'female' ? 240 : 130
      );

      const url = URL.createObjectURL(new Blob([], { type: 'audio/wav' }));
      setGeneratedAudio({
        buffer: fallbackBuffer,
        url,
        duration: fallbackBuffer.duration,
      });

      onVoiceoverGenerated(fallbackBuffer, text, currentVoice?.name || 'Voice');
      setErrorMsg(
        `Note: Using Studio Acoustic Synthesizer (${err.message || 'Server Gemini key offline'}). You can still edit timing, pitch, and export high-quality audio!`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTogglePlayPreview = () => {
    if (!generatedAudio) return;

    if (isPlayingPreview) {
      audioEngine.stop();
      setIsPlayingPreview(false);
    } else {
      audioEngine.setActiveBuffer(generatedAudio.buffer);
      audioEngine.onEnded(() => setIsPlayingPreview(false));
      audioEngine.play({
        trimStart: 0,
        trimEnd: generatedAudio.buffer.duration,
        playbackRate: speed,
        pitchShiftSemitones: pitchShift,
        volume: 1.0,
        eqBass: 0,
        eqMid: 0,
        eqTreble: 0,
        reverbAmount: 0,
        noiseGate: false,
      });
      setIsPlayingPreview(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Templates */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-amber-400" />
            <span>Multilingual Expressive Voiceover Studio</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Convert any script into cinema-grade speech with customizable regional accents and emotions.
          </p>
        </div>

        {/* Quick Sample Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-400 mr-1 hidden md:inline">Presets:</span>
          {SAMPLE_STUDIO_SCRIPTS.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => handleApplySample(sample)}
              className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all cursor-pointer"
            >
              {sample.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Script Text & Fine-tuning (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Script Input Card */}
          <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                <span>Script / Voiceover Text</span>
                <span className="text-xs text-zinc-400 font-mono">
                  ({text.length} chars, ~{text.split(/\s+/).filter(Boolean).length} words)
                </span>
              </label>
              {text && (
                <button
                  onClick={() => setText('')}
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Type or paste any text to synthesize in your chosen language, accent, and emotional tone..."
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/80 font-sans resize-y transition-all leading-relaxed"
            />

            {history.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-400 mb-1.5">Recent scripts</p>
                <div className="flex flex-wrap gap-2">
                  {history.slice(0, 6).map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setText(h.text)}
                      title={h.text}
                      className="max-w-[220px] truncate text-xs px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 hover:border-zinc-600 cursor-pointer"
                    >
                      {h.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Language & Accent Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Language Selector */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
                  <Globe2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Target Language</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-zinc-900">
                        {lang.flag} {lang.name} ({lang.nativeName})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Accent Selector */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>Customizable Accent</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedAccent}
                    onChange={(e) => setSelectedAccent(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none cursor-pointer"
                  >
                    {ACCENTS.map((accent) => (
                      <option key={accent.name} value={accent.name} className="bg-zinc-900">
                        {accent.name} ({accent.region})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Advanced Acoustic Controls Collapsible */}
            <div className="border-t border-zinc-800/80 pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-xs text-zinc-400 hover:text-zinc-200 font-medium py-1 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Acoustic Modifiers (Speed, Pitch Register & Style Directives)</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                />
              </button>

              {showAdvanced && (
                <div className="mt-3 p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Speed Slider */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-400">Pacing / Speed</span>
                        <span className="text-zinc-200 font-mono font-medium">{speed.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.7"
                        max="1.4"
                        step="0.05"
                        value={speed}
                        onChange={(e) => setSpeed(parseFloat(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                        <span>Slow (0.7x)</span>
                        <span>Normal (1.0x)</span>
                        <span>Fast (1.4x)</span>
                      </div>
                    </div>

                    {/* Pitch Bias */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-400">Pitch Register Shift</span>
                        <span className="text-zinc-200 font-mono font-medium">
                          {pitchShift > 0 ? `+${pitchShift}` : pitchShift} st
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-6"
                        max="6"
                        step="1"
                        value={pitchShift}
                        onChange={(e) => setPitchShift(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                        <span>Deep (-6st)</span>
                        <span>Natural (0)</span>
                        <span>Bright (+6st)</span>
                      </div>
                    </div>
                  </div>

                  {/* Custom Pronunciation or Style Prompt */}
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Custom Voice Directives (optional)
                    </label>
                    <input
                      type="text"
                      value={customDirectives}
                      onChange={(e) => setCustomDirectives(e.target.value)}
                      placeholder="e.g. Pause slightly after numbers, speak with a warm transatlantic inflection..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Error or Notice Alert */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMsg}</div>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !text.trim()}
                className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer ${
                  isGenerating || !text.trim()
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:via-rose-400 hover:to-indigo-500 text-white shadow-amber-500/20 active:scale-[0.99]'
                }`}
              >
                {isGenerating ? (
                  <>
                    <AudioWaveform className="w-5 h-5 animate-pulse text-amber-200" />
                    <span>Synthesizing Expressive Voiceover...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-200" />
                    <span>Generate Voiceover ({selectedAccent} • {selectedEmotion.split(' ')[0]})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Audio Preview Player Card */}
          {generatedAudio && (
            <div className="p-4 rounded-2xl bg-zinc-900 border border-emerald-500/30 shadow-lg shadow-emerald-950/20 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Voiceover Master Ready</h4>
                    <p className="text-[11px] text-zinc-400">
                      Duration: {formatDuration(generatedAudio.duration)} • 24kHz Studio Audio
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTogglePlayPreview}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-medium text-xs transition-colors cursor-pointer"
                  >
                    {isPlayingPreview ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Preview</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={onOpenInEditor}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs border border-zinc-700 transition-colors cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Open in Audio Lab</span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Voice Selection & Emotional Tones (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Voice Profile Picker Card */}
          <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-amber-400" />
                <span>Voice Persona & Clones</span>
              </h3>
              <span className="text-xs text-zinc-400">
                {voices.length} voice{voices.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {voices.map((voice) => {
                const isSelected = voice.id === selectedVoiceId;
                return (
                  <div
                    key={voice.id}
                    onClick={() => setSelectedVoiceId(voice.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                        : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{voice.name}</span>
                        {voice.isClone ? (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Custom Clone
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400 capitalize">
                            {voice.gender} • {voice.baseVoice}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
                      {voice.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Emotional Tone Grid */}
          <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Smile className="w-4 h-4 text-rose-400" />
                <span>Emotional Tone</span>
              </h3>
              <span className="text-[11px] text-zinc-400">Modulates timbre & cadence</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {EMOTIONAL_TONES.map((emotion) => {
                const isSelected = selectedEmotion === emotion.name;
                return (
                  <button
                    key={emotion.id}
                    type="button"
                    onClick={() => setSelectedEmotion(emotion.name)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-500/10 border-rose-500/60 shadow-sm text-white'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium truncate">{emotion.name.split(' ')[0]}</span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 line-clamp-1">
                      {emotion.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
