import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, RotateCcw, Loader2, Link2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { audioEngine } from '../services/audioEngine.ts';
import { colabService } from '../services/colabService.ts';
import { float32ArrayToBase64Wav } from '../utils/audioEncoding.ts';
import { VoiceProfile } from '../types/index.ts';

interface Recording {
  base64: string;
  seconds: number;
  url: string;
}

const REFERENCE_SCRIPT =
  'Hello, this is my natural speaking voice. Today is a good day to try something new. I like to explain ' +
  'ideas in a clear and friendly way, and when I ask a question, my voice goes up a little. ' +
  'Do you think this will sound like me?';

const MIN_SECONDS = 8;
const MAX_SECONDS = 15;

async function toMono24k(buffer: AudioBuffer): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil(buffer.duration * 24000));
  const ctx = new OfflineAudioContext(1, length, 24000);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  return ctx.startRendering();
}

function wavUrl(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}

function storageUsedChars(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) total += k.length + (localStorage.getItem(k)?.length || 0);
    }
    return total;
  } catch {
    return 0;
  }
}

interface ColabCloneProps {
  onVoiceCreated: (voice: VoiceProfile) => void;
}

export const ColabClone: React.FC<ColabCloneProps> = ({ onVoiceCreated }) => {
  const [code, setCode] = useState<string>(colabService.getCode());
  const [connState, setConnState] = useState<'unknown' | 'checking' | 'ok' | 'bad'>('unknown');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sample, setSample] = useState<Recording | null>(null);
  const [name, setName] = useState('My Voice');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const connect = async (value: string) => {
    const conn = colabService.parseCode(value);
    if (!conn) {
      setConnState('bad');
      return;
    }
    setConnState('checking');
    colabService.saveCode(value);
    setConnState((await colabService.check(conn)) ? 'ok' : 'bad');
  };

  useEffect(() => {
    if (colabService.getConnection()) connect(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startRecording = async () => {
    setError(null);
    setDone(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => finishRecording(mimeType);
      recorder.start(100);
      recorderRef.current = recorder;
      startRef.current = Date.now();
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        const s = (Date.now() - startRef.current) / 1000;
        setSeconds(s);
        if (s >= MAX_SECONDS) stopRecording();
      }, 200);
    } catch {
      setError('Could not use the microphone. Please allow microphone access and try again.');
    }
  };

  const stopRecording = () => {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  };

  const finishRecording = async (mimeType: string) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const decoded = await audioEngine.decodeAudio(await blob.arrayBuffer());
      const mono = await toMono24k(decoded);
      const base64 = float32ArrayToBase64Wav(mono);
      if (mono.duration < MIN_SECONDS) {
        setError(`Your sample is ${mono.duration.toFixed(0)} seconds. Please record at least ${MIN_SECONDS} seconds.`);
        return;
      }
      setSample({ base64, seconds: mono.duration, url: wavUrl(base64) });
    } catch {
      setError('Could not process the recording. Please try again.');
    }
  };

  const saveVoice = () => {
    if (!sample) return;
    setError(null);
    if (storageUsedChars() + sample.base64.length > 4_200_000) {
      setError('Your browser storage is almost full. Delete an old cloned voice below, then try again.');
      return;
    }
    onVoiceCreated({
      id: `colab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || 'My Voice',
      gender: 'neutral',
      baseVoice: 'Kore',
      language: 'en-US',
      accent: 'Natural (your own voice)',
      emotionalTone: 'Natural Conversational',
      pitchBias: 0,
      speedMultiplier: 1,
      isClone: true,
      colabRefAudio: sample.base64,
      description: 'Your cloned voice (free Colab cloning). Choose it in the Voiceover tab and type any text.',
    });
    setDone(true);
    setSample(null);
    setAgreed(false);
  };

  const status =
    connState === 'ok' ? (
      <span className="flex items-center gap-1 text-emerald-400 text-xs">
        <CheckCircle2 className="w-3.5 h-3.5" /> Connected to your Colab
      </span>
    ) : connState === 'checking' ? (
      <span className="flex items-center gap-1 text-zinc-400 text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking...
      </span>
    ) : connState === 'bad' ? (
      <span className="flex items-center gap-1 text-rose-400 text-xs">
        <AlertCircle className="w-3.5 h-3.5" /> Not connected. Check that the notebook is running and the code is complete.
      </span>
    ) : null;

  return (
    <div className="bg-zinc-900/80 rounded-2xl border border-rose-500/30 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-rose-400" />
          <span>Free voice cloning (your own voice)</span>
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Runs on your own free Google Colab notebook. Record a short sample once, then type any text in the Voiceover
          tab and hear it in your voice. Only clone your own voice.
        </p>
      </div>

      {/* Step 1: connect */}
      <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 p-3 space-y-2">
        <p className="text-xs font-medium text-zinc-200">
          Step 1: Start the Colab notebook and paste its connection code
        </p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="https://....trycloudflare.com|code"
            className="flex-1 min-w-0 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-rose-500"
          />
          <button
            onClick={() => connect(code)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100 cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5 text-amber-400" /> Connect
          </button>
        </div>
        {status}
      </div>

      {/* Step 2: record */}
      <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-200">
            Step 2: Read this aloud ({MIN_SECONDS} to {MAX_SECONDS} seconds)
          </p>
          <button
            onClick={() => (recording ? stopRecording() : startRecording())}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              recording ? 'bg-rose-600 text-white' : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
            }`}
          >
            {recording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-amber-400" />}
            {recording ? `Stop (${seconds.toFixed(0)}s)` : 'Record'}
          </button>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">{REFERENCE_SCRIPT}</p>
        <p className="text-[11px] text-zinc-500">
          Tip: speak naturally with expression, in a quiet room, close to the microphone.
        </p>
        {sample && (
          <div className="flex items-center gap-2">
            <audio controls src={sample.url} className="h-8 flex-1" />
            <span className="text-[11px] text-emerald-400">{sample.seconds.toFixed(0)}s</span>
            <button onClick={() => setSample(null)} aria-label="Remove" className="text-zinc-400 hover:text-white cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Step 3: save */}
      <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 p-3 space-y-3">
        <p className="text-xs font-medium text-zinc-200">Step 3: Save your voice</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Voice name"
          className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-rose-500"
        />
        <label className="flex items-start gap-2 text-xs text-zinc-300 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
          <span>This is my own voice (or I have permission to use it). It is saved in this browser only.</span>
        </label>
        <button
          onClick={saveVoice}
          disabled={!sample || !agreed}
          className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-rose-600 py-2 text-sm font-medium text-white disabled:opacity-40 cursor-pointer"
        >
          Save my cloned voice
        </button>
      </div>

      {error && <p className="text-xs text-rose-400 break-words">{error}</p>}
      {done && (
        <p className="text-xs text-emerald-400">
          Saved. Open the Voiceover tab, pick your voice in the list, and type any text. Keep the Colab tab open.
        </p>
      )}
    </div>
  );
};
