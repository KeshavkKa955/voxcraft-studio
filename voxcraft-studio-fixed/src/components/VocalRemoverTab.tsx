import React, { useEffect, useRef, useState } from 'react';
import { Upload, Link2, Loader2, CheckCircle2, AlertCircle, Download, Music } from 'lucide-react';
import { colabService } from '../services/colabService.ts';

const CODE_KEY = 'voxcraft_sep_code';
type Mode = 'vocals' | 'stems';
interface Stem {
  name: string;
  url: string;
}
interface Conn {
  url: string;
  token: string;
}

const LABELS: Record<string, string> = {
  instrumental: 'Instrumental (no vocals)',
  vocals: 'Acapella (vocals only)',
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other (melody, keys, guitars)',
};

const readCode = () => {
  try {
    return localStorage.getItem(CODE_KEY) || '';
  } catch {
    return '';
  }
};

interface Props {
  isLoggedIn?: boolean;
  onLoginRequired?: (reason?: 'vocal') => void;
}

export const VocalRemoverTab: React.FC<Props> = ({ isLoggedIn = false, onLoginRequired }) => {
  const [useOwn, setUseOwn] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [code, setCode] = useState<string>(readCode());
  const [conn, setConn] = useState<'unknown' | 'checking' | 'ok' | 'bad'>('unknown');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>('vocals');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stems, setStems] = useState<Stem[]>([]);
  const stopRef = useRef(false);
  const urlsRef = useRef<string[]>([]);

  // Is the shared Colab online? (checked every 30 s)
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch('/api/colab-status?service=separator');
        const d = await r.json();
        if (alive) setOnline(!!d.online);
      } catch {
        if (alive) setOnline(null);
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const connectOwn = async () => {
    const c = colabService.parseCode(code);
    if (!c) return setConn('bad');
    try {
      localStorage.setItem(CODE_KEY, code.trim());
    } catch {
      /* ignore */
    }
    setConn('checking');
    setConn((await colabService.check(c)) ? 'ok' : 'bad');
  };

  useEffect(() => {
    return () => {
      stopRef.current = true;
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const clearResults = () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setStems([]);
  };

  /** Address of the Colab to use: your own (pasted code) or the shared one from the site. */
  const getConn = async (): Promise<Conn | null> => {
    if (useOwn) {
      const c = colabService.parseCode(code);
      if (!c) throw new Error('Paste your connection code first.');
      return c;
    }
    const res = await fetch('/api/colab-ticket?service=separator');
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      onLoginRequired?.('vocal');
      return null;
    }
    if (!res.ok || !data.url) throw new Error(data.error || 'The Vocal Remover is not available right now.');
    return { url: data.url, token: data.token };
  };

  const upload = (c: Conn, f: File, m: Mode) =>
    new Promise<string>((resolve, reject) => {
      const form = new FormData();
      form.append('file', f);
      form.append('mode', m);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${c.url}/separate`);
      xhr.setRequestHeader('X-Token', c.token);
      xhr.upload.onprogress = (e) => e.lengthComputable && setPercent(Math.round((e.loaded / e.total) * 100));
      xhr.onerror = () => reject(new Error('Could not reach the Vocal Remover server. It may have just gone offline.'));
      xhr.onload = () => {
        let data: any = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* ignore */
        }
        if (xhr.status >= 200 && xhr.status < 300 && data.jobId) resolve(data.jobId);
        else reject(new Error(data.error || `Upload failed (status ${xhr.status}).`));
      };
      xhr.send(form);
    });

  const start = async () => {
    if (!file) return;
    if (!useOwn && !isLoggedIn) {
      onLoginRequired?.('vocal');
      return;
    }
    stopRef.current = false;
    setError(null);
    clearResults();
    setBusy(true);
    setPercent(0);
    setMessage('Getting ready...');
    try {
      const c = await getConn();
      if (!c) return;
      setMessage('Uploading your song...');
      const jobId = await upload(c, file, mode);
      setMessage('Waiting for the GPU...');
      const began = Date.now();
      for (;;) {
        if (stopRef.current) return;
        if (Date.now() - began > 25 * 60 * 1000) throw new Error('This is taking too long. Please try again.');
        await new Promise((r) => setTimeout(r, 2500));
        const res = await fetch(`${c.url}/status/${jobId}`, { headers: { 'X-Token': c.token } });
        const st = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(st.error || 'Lost connection to the server.');
        setMessage(st.message || '');
        if (st.state === 'error') throw new Error(st.message || 'Separation failed.');
        if (st.state === 'done') {
          const out: Stem[] = [];
          for (const name of st.stems as string[]) {
            const r = await fetch(`${c.url}/download/${jobId}/${name}`, { headers: { 'X-Token': c.token } });
            if (!r.ok) throw new Error('Could not download a result.');
            const url = URL.createObjectURL(await r.blob());
            urlsRef.current.push(url);
            out.push({ name, url });
          }
          const order = ['instrumental', 'vocals', 'drums', 'bass', 'other'];
          out.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
          setStems(out);
          setMessage('');
          return;
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const base = (file?.name || 'track').replace(/\.[^.]+$/, '');
  const ready = useOwn ? conn === 'ok' : online !== false;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 space-y-1">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Music className="w-4 h-4 text-amber-400" /> AI Vocal Remover & Stem Splitter
        </h2>
        <p className="text-xs text-zinc-400">
          Upload a song and get a clean instrumental, the acapella, or separate drums, bass and other parts, using
          open-source AI models. Free with a login. Only use music you own or have permission to use.
        </p>
      </div>

      {!useOwn ? (
        <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs">
            {online === null && <span className="text-zinc-400">Checking the server...</span>}
            {online === true && (
              <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Vocal Remover is online</span>
            )}
            {online === false && (
              <span className="flex items-center gap-1 text-amber-300"><AlertCircle className="w-3.5 h-3.5" /> Vocal Remover is offline right now. Please try again later.</span>
            )}
          </div>
          <button onClick={() => setUseOwn(true)} className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer">
            Use my own Colab instead
          </button>
        </div>
      ) : (
        <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 space-y-2">
          <p className="text-xs font-medium text-zinc-200">Your own Colab: paste its connection code</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="https://....trycloudflare.com|code"
              className="flex-1 min-w-0 rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
            />
            <button onClick={connectOwn} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100 cursor-pointer">
              <Link2 className="w-3.5 h-3.5 text-amber-400" /> Connect
            </button>
          </div>
          {conn === 'ok' && <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Connected</span>}
          {conn === 'checking' && <span className="flex items-center gap-1 text-zinc-400 text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking...</span>}
          {conn === 'bad' && <span className="flex items-center gap-1 text-rose-400 text-xs"><AlertCircle className="w-3.5 h-3.5" /> Not connected. Check that the notebook is running.</span>}
          <button onClick={() => setUseOwn(false)} className="text-[11px] text-zinc-400 hover:text-zinc-200 underline cursor-pointer">
            Back to the shared Vocal Remover
          </button>
        </div>
      )}

      <div className="bg-zinc-900/80 rounded-2xl border border-zinc-800 p-5 space-y-3">
        <p className="text-xs font-medium text-zinc-200">Choose your song and what you want</p>
        <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 py-6 text-sm text-zinc-300 cursor-pointer hover:border-zinc-500">
          <Upload className="w-4 h-4 text-amber-400" />
          <span className="truncate max-w-[80%]">{file ? file.name : 'Choose an audio file (MP3, WAV, FLAC, M4A)'}</span>
          <input type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); clearResults(); setError(null); }} />
        </label>
        <div className="grid sm:grid-cols-2 gap-2">
          {([
            ['vocals', 'Instrumental + Acapella', 'Best quality for removing vocals'],
            ['stems', '4 stems', 'Vocals, drums, bass and other'],
          ] as [Mode, string, string][]).map(([id, title, sub]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`text-left rounded-xl border px-3 py-2.5 cursor-pointer ${mode === id ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-600'}`}
            >
              <p className="text-sm font-medium text-white">{title}</p>
              <p className="text-[11px] text-zinc-400">{sub}</p>
            </button>
          ))}
        </div>
        <button
          onClick={start}
          disabled={!file || !ready || busy}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-rose-600 py-2.5 text-sm font-medium text-white disabled:opacity-40 cursor-pointer"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {busy ? 'Working...' : !useOwn && !isLoggedIn ? 'Log in to separate audio' : 'Separate audio'}
        </button>
        {busy && (
          <p className="text-xs text-zinc-400">
            {message} {message.startsWith('Uploading') ? `${percent}%` : ''}
          </p>
        )}
        {error && <p className="text-xs text-rose-400 break-words">{error}</p>}
      </div>

      {stems.length > 0 && (
        <div className="bg-zinc-900/80 rounded-2xl border border-emerald-500/30 p-5 space-y-3">
          <p className="text-sm font-semibold text-white">Your results</p>
          {stems.map((s) => (
            <div key={s.name} className="rounded-xl bg-zinc-950/70 border border-zinc-800 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-zinc-200">{LABELS[s.name] || s.name}</p>
                <a href={s.url} download={`${base}-${s.name}.mp3`} className="flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200">
                  <Download className="w-3.5 h-3.5" /> Download MP3
                </a>
              </div>
              <audio controls src={s.url} className="w-full h-9" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
