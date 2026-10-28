import React, { useState, useEffect, useRef } from 'react';
import { RealVoiceClone } from './RealVoiceClone.tsx';
import {
  Sparkles,
  Mic,
  Square,
  Upload,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  Sliders,
  Volume2,
  RefreshCw,
  Activity,
  ArrowRight,
  Info,
} from 'lucide-react';
import { VoiceProfile, VoiceCloneSample, AcousticFeatures } from '../types/index.ts';
import { CLONING_SAMPLE_SCRIPTS, ACCENTS, EMOTIONAL_TONES } from '../data/constants.ts';
import { voiceCloneService } from '../services/voiceCloneService.ts';
import { audioEngine } from '../services/audioEngine.ts';
import { formatDuration } from '../utils/audioEncoding.ts';

interface VoiceCloningTabProps {
  onVoiceCreated: (newVoice: VoiceProfile) => void;
  onSelectVoiceForStudio: (voiceId: string) => void;
  clonedVoices: VoiceProfile[];
  onDeleteVoice: (voiceId: string) => void;
}

export const VoiceCloningTab: React.FC<VoiceCloningTabProps> = ({
  onVoiceCreated,
  onSelectVoiceForStudio,
  clonedVoices,
  onDeleteVoice,
}) => {
  // Wizard state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedScriptIndex, setSelectedScriptIndex] = useState<number>(0);
  const [recordedSamples, setRecordedSamples] = useState<VoiceCloneSample[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const recordingTimerRef = useRef<any>(null);

  // Cloned profile fields
  const [cloneName, setCloneName] = useState<string>('My Custom Voice');
  const [cloneAccent, setCloneAccent] = useState<string>('General American');
  const [cloneEmotion, setCloneEmotion] = useState<string>('Natural Conversational');

  // Test synthesis
  const [isSynthesizingTest, setIsSynthesizingTest] = useState<boolean>(false);
  const [testAudioBuffer, setTestAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlayingTest, setIsPlayingTest] = useState<boolean>(false);
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);

  // Computed acoustic features summary
  const [aggregatedFeatures, setAggregatedFeatures] = useState<AcousticFeatures | null>(null);

  useEffect(() => {
    if (recordedSamples.length > 0) {
      const validFeatures = recordedSamples
        .map((s) => s.features)
        .filter((f): f is AcousticFeatures => !!f);

      if (validFeatures.length > 0) {
        const avgF0 = Math.round(
          validFeatures.reduce((acc, f) => acc + f.f0Hz, 0) / validFeatures.length
        );
        const avgRms = Number(
          (
            validFeatures.reduce((acc, f) => acc + f.rmsDb, 0) / validFeatures.length
          ).toFixed(1)
        );
        const avgCentroid = Math.round(
          validFeatures.reduce((acc, f) => acc + f.spectralCentroid, 0) / validFeatures.length
        );
        const avgClarity = Math.round(
          validFeatures.reduce((acc, f) => acc + f.clarityScore, 0) / validFeatures.length
        );

        setAggregatedFeatures({
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
        });
      }
    } else {
      setAggregatedFeatures(null);
    }
  }, [recordedSamples]);

  // Handle start mic recording
  const handleStartRecording = async () => {
    try {
      await voiceCloneService.startRecording();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert(err.message || 'Could not access microphone.');
    }
  };

  // Handle stop mic recording
  const handleStopRecording = async () => {
    if (!isRecording) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    try {
      const currentScript = CLONING_SAMPLE_SCRIPTS[selectedScriptIndex].text;
      const sample = await voiceCloneService.stopRecording(currentScript);
      setRecordedSamples((prev) => [...prev, sample]);
      // Advance to next sample script if available
      if (selectedScriptIndex < CLONING_SAMPLE_SCRIPTS.length - 1) {
        setSelectedScriptIndex(selectedScriptIndex + 1);
      }
    } catch (err: any) {
      alert(err.message || 'Error saving sample.');
    } finally {
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  };

  // Handle local file upload as sample
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuf = await file.arrayBuffer();
      const audioBuffer = await audioEngine.decodeAudio(arrayBuf);
      const channelData = audioBuffer.getChannelData(0);

      // Acoustic analysis
      const { extractAcousticFeatures } = await import('../utils/voiceCloning.ts');
      const features = extractAcousticFeatures(channelData, audioBuffer.sampleRate);

      const sample: VoiceCloneSample = {
        id: `sample-upload-${Date.now()}`,
        blobUrl: URL.createObjectURL(file),
        duration: Math.max(0.5, Number(audioBuffer.duration.toFixed(2))),
        recordedAt: Date.now(),
        textPrompt: file.name,
        features,
      };

      setRecordedSamples((prev) => [...prev, sample]);
    } catch (err: any) {
      alert('Could not decode audio file: ' + err.message);
    }
  };

  // Play sample
  const handlePlaySample = (sample: VoiceCloneSample) => {
    if (playingSampleId === sample.id) {
      audioEngine.stop();
      setPlayingSampleId(null);
      return;
    }

    const audio = new Audio(sample.blobUrl);
    setPlayingSampleId(sample.id);
    audio.play();
    audio.onended = () => setPlayingSampleId(null);
  };

  // Delete sample
  const handleDeleteSample = (id: string) => {
    setRecordedSamples((prev) => prev.filter((s) => s.id !== id));
  };

  // Test synthesize cloned voice
  const handleTestClone = async () => {
    if (!cloneName.trim()) {
      alert('Please enter a name for your cloned voice.');
      return;
    }

    setIsSynthesizingTest(true);
    setTestAudioBuffer(null);

    const builtProfile = voiceCloneService.buildClonedProfile(
      cloneName,
      recordedSamples,
      cloneAccent,
      cloneEmotion
    );

    const testText = `Hello! This is a real-time calibration test of ${cloneName}. My vocal timbre, accent, and speech rhythm have been captured and synthesized.`;

    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          language: 'en-US',
          accent: cloneAccent,
          emotion: cloneEmotion,
          voiceName: builtProfile.baseVoice,
          customStylePrompt: builtProfile.customStylePrompt,
          speed: 1.0,
          pitchShift: builtProfile.pitchBias,
        }),
      });

      if (!res.ok) throw new Error('Test generation failed');
      const data = await res.json();
      const buffer = await audioEngine.decodeAudio(data.audioBase64);
      setTestAudioBuffer(buffer);

      // Play test
      audioEngine.setActiveBuffer(buffer);
      audioEngine.onEnded(() => setIsPlayingTest(false));
      audioEngine.play({
        trimStart: 0,
        trimEnd: buffer.duration,
        playbackRate: 1.0,
        pitchShiftSemitones: 0,
        volume: 1.0,
        eqBass: 0,
        eqMid: 0,
        eqTreble: 0,
        reverbAmount: 0,
        noiseGate: false,
      });
      setIsPlayingTest(true);
    } catch (err) {
      console.warn('Test synthesis fallback:', err);
      const synth = audioEngine.generateDemoVoiceoverBuffer(
        4.0,
        aggregatedFeatures?.f0Hz || 170
      );
      setTestAudioBuffer(synth);
      audioEngine.setActiveBuffer(synth);
      audioEngine.onEnded(() => setIsPlayingTest(false));
      audioEngine.play({
        trimStart: 0,
        trimEnd: synth.duration,
        playbackRate: 1.0,
        pitchShiftSemitones: 0,
        volume: 1.0,
        eqBass: 0,
        eqMid: 0,
        eqTreble: 0,
        reverbAmount: 0,
        noiseGate: false,
      });
      setIsPlayingTest(true);
    } finally {
      setIsSynthesizingTest(false);
    }
  };

  // Save voice profile
  const handleSaveProfile = () => {
    if (!cloneName.trim()) {
      alert('Please provide a name for this cloned voice.');
      return;
    }

    const builtProfile = voiceCloneService.buildClonedProfile(
      cloneName,
      recordedSamples,
      cloneAccent,
      cloneEmotion
    );

    voiceCloneService.saveVoice(builtProfile);
    onVoiceCreated(builtProfile);
    alert(`Voice profile "${cloneName}" created successfully! It is now active in your voiceover studio.`);
  };

  return (
    <div className="space-y-6">
      <RealVoiceClone onVoiceCreated={onVoiceCreated} />

      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span>Voice Cloning & Acoustic Persona Studio</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Approximate style matching: picks the closest built-in voice to yours. For a real copy of your voice, use the section above.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs">
          <span
            className={`font-medium ${
              currentStep === 1 ? 'text-amber-400 font-bold' : 'text-zinc-400'
            }`}
          >
            1. Capture Samples ({recordedSamples.length}/3)
          </span>
          <span className="text-zinc-600">→</span>
          <span
            className={`font-medium ${
              currentStep === 2 ? 'text-rose-400 font-bold' : 'text-zinc-400'
            }`}
          >
            2. Calibrate & Save
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step 1: Sample Capture (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Mic className="w-4 h-4 text-amber-400" />
                <span>Voice Calibration Recording</span>
              </h3>
              <span className="text-xs text-zinc-400 font-mono">
                Sample {selectedScriptIndex + 1} of {CLONING_SAMPLE_SCRIPTS.length}
              </span>
            </div>

            {/* Calibration Script to Read */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-400">
                  {CLONING_SAMPLE_SCRIPTS[selectedScriptIndex].title}
                </span>
                <span className="text-[11px] text-zinc-500">Read out loud naturally:</span>
              </div>
              <p className="text-sm text-zinc-200 font-serif italic leading-relaxed">
                "{CLONING_SAMPLE_SCRIPTS[selectedScriptIndex].text}"
              </p>
            </div>

            {/* Recording Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                {isRecording ? (
                  <button
                    onClick={handleStopRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-lg shadow-rose-900/30 animate-pulse cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Recording ({recordingSeconds}s)</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStartRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Start Recording Sample</span>
                  </button>
                )}

                {/* Upload audio file alternative */}
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs border border-zinc-700 transition-colors cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Upload Audio File</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Sample script switcher */}
              <div className="flex items-center gap-1">
                {CLONING_SAMPLE_SCRIPTS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedScriptIndex(idx)}
                    className={`w-6 h-6 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                      selectedScriptIndex === idx
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Recorded Samples List */}
            <div className="border-t border-zinc-800/80 pt-4 space-y-2">
              <label className="text-xs font-medium text-zinc-400 block">
                Recorded Voice Samples ({recordedSamples.length})
              </label>

              {recordedSamples.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-xs">
                  No samples recorded yet. Click "Start Recording Sample" above to calibrate your voice.
                </div>
              ) : (
                <div className="space-y-2">
                  {recordedSamples.map((sample, idx) => (
                    <div
                      key={sample.id}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handlePlaySample(sample)}
                          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-200 cursor-pointer"
                        >
                          {playingSampleId === sample.id ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                        </button>
                        <div>
                          <div className="text-xs font-medium text-white flex items-center gap-2">
                            <span>Sample #{idx + 1}</span>
                            <span className="text-[11px] text-zinc-500">
                              ({formatDuration(sample.duration)})
                            </span>
                          </div>
                          {sample.features && (
                            <p className="text-[10px] text-zinc-400 font-mono">
                              F0: {sample.features.f0Hz}Hz ({sample.features.pitchCategory}) • Clarity: {sample.features.clarityScore}%
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteSample(sample.id)}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Acoustic Analysis & Persona Save (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Real-time Acoustic Analysis Card */}
          <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Acoustic Timbre Fingerprint</span>
            </h3>

            {aggregatedFeatures ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                      Vocal Pitch (F0)
                    </span>
                    <span className="text-base font-bold text-white font-mono">
                      {aggregatedFeatures.f0Hz} Hz
                    </span>
                    <span className="text-[10px] text-emerald-400 capitalize block mt-0.5">
                      {aggregatedFeatures.pitchCategory} Register
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                      Clarity Score
                    </span>
                    <span className="text-base font-bold text-amber-400 font-mono">
                      {aggregatedFeatures.clarityScore}%
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      Acoustic Headroom
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Timbre Warmth:</span>
                    <span className="text-zinc-200 font-medium">
                      {aggregatedFeatures.spectralCentroid > 2000 ? 'Bright & Crisp' : 'Warm & Resonant'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">RMS Dynamic Energy:</span>
                    <span className="text-zinc-200 font-mono">{aggregatedFeatures.rmsDb} dBFS</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-center text-xs text-zinc-500">
                Record or upload at least 1 sample to calculate your acoustic fingerprint.
              </div>
            )}

            {/* Persona Setup Form */}
            <div className="space-y-3 border-t border-zinc-800/80 pt-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Cloned Voice Profile Name
                </label>
                <input
                  type="text"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="e.g. My Voice - Alex"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Native Accent
                  </label>
                  <select
                    value={cloneAccent}
                    onChange={(e) => setCloneAccent(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200"
                  >
                    {ACCENTS.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Default Tone
                  </label>
                  <select
                    value={cloneEmotion}
                    onChange={(e) => setCloneEmotion(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200"
                  >
                    {EMOTIONAL_TONES.map((em) => (
                      <option key={em.id} value={em.name}>
                        {em.name.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Test & Save Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestClone}
                  disabled={isSynthesizingTest || recordedSamples.length === 0}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                    isSynthesizingTest || recordedSamples.length === 0
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed'
                      : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-white'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>{isSynthesizingTest ? 'Testing...' : 'Test Cloned Voice'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={recordedSamples.length === 0 || !cloneName.trim()}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer ${
                    recordedSamples.length === 0 || !cloneName.trim()
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white shadow-rose-900/30'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Clone</span>
                </button>
              </div>
            </div>
          </div>

          {/* Saved Clones Library */}
          {clonedVoices.length > 0 && (
            <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 space-y-3">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Saved Voice Clones ({clonedVoices.length})
              </h4>
              <div className="space-y-2">
                {clonedVoices.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span>{v.name}</span>
                        <span className="text-[10px] text-rose-400 font-mono">
                          • {v.accent.split(' ')[0]}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 line-clamp-1">{v.description}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSelectVoiceForStudio(v.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium cursor-pointer"
                        title="Use in Voiceover Studio"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => onDeleteVoice(v.id)}
                        className="p-1 text-zinc-500 hover:text-rose-400 cursor-pointer"
                        title="Delete Clone"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
