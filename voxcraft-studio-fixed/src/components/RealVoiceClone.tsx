import React, { useRef, useState } from 'react';
import { Mic, Square, RotateCcw, ShieldCheck, Loader2, Sparkles } from 'lucide-react';
import { audioEngine } from '../services/audioEngine.ts';
import { float32ArrayToBase64Wav } from '../utils/audioEncoding.ts';
import { VoiceProfile } from '../types/index.ts';

interface Recording {
  base64: string;
  seconds: number;
  url: string;
}

const CONSENT_LANGUAGES = [
  {
    id: 'en-IN',
    label: 'English',
    text: 'I am the owner of this voice and I consent to Google using this voice to create a synthetic voice model.',
  },
  {
    id: 'hi-IN',
    label: 'Hindi (हिन्दी)',
    text: 'मैं इस आवाज का मालिक हूं और मैं सिंथेटिक आवाज मॉडल बनाने के लिए Google को इस आवाज का उपयोग करने की सहमति देता हूं',
  },
];

const REFERENCE_SCRIPT =
  'Hello, my name is simply me, and I am recording this sample in my normal speaking voice. ' +
  'Today is a good day to try something new. I enjoy learning how things work, and I like to explain ideas ' +
  'in a clear and friendly way. If you listen closely, you can hear how I pause, how I breathe, and how my ' +
  'voice rises and falls when I ask a question. Do you think this will sound like me?';

const MIN_REFERENCE = 10;
const MAX_REFERENCE = 28;
const MIN_CONSENT = 3;
const MAX_CONSENT = 20;

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

interface RealVoiceCloneProps {
  onVoiceCreated: (voice: VoiceProfile) => void;
}

export const RealVoiceClone: React.FC<RealVoiceCloneProps> = ({ onVoiceCreated }) => {
  const [consentLang, setConsentLang] = useState('en-IN');
  const [reference, setReference] = useState<Recording | null>(null);
  const [consent, setConsent] = useState<Recording | null>(null);
  const [recording, setRecording] = useState<'reference' | 'consent' | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [name, setName] = useState('My Real Voice');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const consentText = CONSENT_LANGUAGES.find((l) => l.id === consentLang)!.text;

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startRecording = async (kind: 'reference' | 'consent') => {
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
      recorder.onstop = () => finishRecording(kind, mimeType);
      recorder.start(100);
      recorderRef.current = recorder;
      startRef.current = Date.now();
      setSeconds(0);
      setRecording(kind);

      const max = kind === 'reference' ? MAX_REFERENCE : MAX_CONSENT;
      timerRef.current = window.setInterval(() => {
        const s = (Date.now() - startRef.current) / 1000;
        setSeconds(s);
        if (s >= max) stopRecording();
      }, 200);
    } catch {
      setError('Could not use the microphone. Please allow microphone access and try again.');
    }
  };

  const stopRecording = () => {
    stopTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const finishRecording = async (kind: 'reference' | 'consent', mimeType: string) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(null);
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const decoded = await audioEngine.decodeAudio(await blob.arrayBuffer());
      const mono = await toMono24k(decoded);
      const base64 = float32ArrayToBase64Wav(mono);
      const rec: Recording = { base64, seconds: mono.duration, url: wavUrl(base64) };

      if (kind === 'reference') {
        if (rec.seconds < MIN_REFERENCE) {
          setError(`Your sample is ${rec.seconds.toFixed(0)} seconds. Please record at least ${MIN_REFERENCE} seconds.`);
          return;
        }
        setReference(rec);
      } else {
        if (rec.seconds < MIN_CONSENT) {
          setError('The consent recording is too short. Please read the whole sentence.');
          return;
        }
        setConsent(rec);
      }
    } catch {
      setError('Could not process the recording. Please try again.');
    }
  };

  const createVoice = async () => {
    if (!reference || !consent) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/voice/replicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceAudioBase64: reference.base64,
          consentAudioBase64: consent.base64,
          displayName: name,
        }),
      });
      const type = res.headers.get('content-type') || '';
      const data = type.includes('application/json') ? await res.json() : {};
      if (!res.ok || !data.voiceId) {
        throw new Error(data.error || `Voice cloning failed (status ${res.status}).`);
      }

      onVoiceCreated({
        id: `clone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim() || 'My Real Voice',
        gender: 'neutral',
        baseVoice: 'Kore',
        language: 'en-US',
        accent: 'Natural (your own voice)',
        emotionalTone: 'Natural Conversational',
        pitchBias: 0,
        speedMultiplier: 1,
        isClone: true,
        geminiVoiceId: data.voiceId,
        description: 'Your real cloned voice. Choose it in the Voiceover tab and type any text.',
      });
      setDone(true);
      setReference(null);
      setConsent(null);
      setAgreed(false);
    } catch (e: any) {
      setError(e?.message || 'Voice cloning failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const recButton = (kind: 'reference' | 'consent') => {
    const active = recording === kind;
    return (
      <button
        onClick={() => (active ? stopRecording() : startRecording(kind))}
        disabled={recording !== null && !active}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40 ${
          active ? 'bg-rose-600 text-white' : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
        }`}
      >
        {active ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-amber-400" />}
        {active ? `Stop (${seconds.toFixed(0)}s)` : 'Record'}
      </button>
    );
  };

  return (
    <div className="bg-zinc-900/80 rounded-2xl border border-rose-500/30 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-rose-400" />
          <span>Real voice cloning (your own voice)</span>
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Record yourself reading a short text, then record a short consent sentence. After that you can type any
          text in the Voiceover tab and hear it in your voice. Only clone your own voice.
        </p>
      </div>

      {/* Step 1 */}
      <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-200">
            Step 1: Read this aloud ({MIN_REFERENCE} to {MAX_REFERENCE} seconds)
          </p>
          {recButton('reference')}
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">{REFERENCE_SCRIPT}</p>
        {reference && (
          <div className="flex items-center gap-2">
            <audio controls src={reference.url} className="h-8 flex-1" />
            <span className="text-[11px] text-emerald-400">{reference.seconds.toFixed(0)}s saved</span>
            <button onClick={() => setReference(null)} aria-label="Remove" className="text-zinc-400 hover:text-white cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Step 2 */}
      <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-medium text-zinc-200">Step 2: Read the consent sentence</p>
          <div className="flex items-center gap-2">
            <select
              value={consentLang}
              onChange={(e) => {
                setConsentLang(e.target.value);
                setConsent(null);
              }}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-200"
            >
              {CONSENT_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            {recButton('consent')}
          </div>
        </div>
        <p className="text-xs text-amber-300 leading-relaxed">{consentText}</p>
        <p className="text-[11px] text-zinc-500">
          Read it exactly as written, with the same microphone and in the same quiet place as step 1.
        </p>
        {consent && (
          <div className="flex items-center gap-2">
            <audio controls src={consent.url} className="h-8 flex-1" />
            <span className="text-[11px] text-emerald-400">{consent.seconds.toFixed(0)}s saved</span>
            <button onClick={() => setConsent(null)} aria-label="Remove" className="text-zinc-400 hover:text-white cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Step 3 */}
      <div className="rounded-xl bg-zinc-950/70 border border-zinc-800 p-3 space-y-3">
        <p className="text-xs font-medium text-zinc-200">Step 3: Create your voice</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Voice name"
          className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-rose-500"
        />
        <label className="flex items-start gap-2 text-xs text-zinc-300 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
          <span>
            This is my own voice. I agree that my recordings are sent to Google to create a synthetic copy of my voice,
            which is stored for up to a year until I delete it here.
          </span>
        </label>
        <button
          onClick={createVoice}
          disabled={!reference || !consent || !agreed || busy}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-rose-600 py-2 text-sm font-medium text-white disabled:opacity-40 cursor-pointer"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {busy ? 'Creating your voice (this can take a minute)...' : 'Create my cloned voice'}
        </button>
      </div>

      {error && <p className="text-xs text-rose-400 break-words">{error}</p>}
      {done && (
        <p className="text-xs text-emerald-400">
          Your voice is ready. Open the Voiceover tab, pick it in the voice list, and type any text.
        </p>
      )}
    </div>
  );
};
