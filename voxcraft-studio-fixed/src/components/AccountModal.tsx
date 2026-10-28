import React, { useState } from 'react';
import { X, LogIn, UserPlus } from 'lucide-react';

interface AccountModalProps {
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<string | null>;
}

export const AccountModal: React.FC<AccountModalProps> = ({ onClose, onSignIn, onSignUp }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || password.length < 6) {
      setError('Enter your email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await onSignIn(email.trim(), password);
        onClose();
      } else {
        const msg = await onSignUp(email.trim(), password);
        if (msg) setNotice(msg);
        else onClose();
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-white">
            {mode === 'login' ? 'Log in' : 'Create account'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-zinc-400 mb-4">
          Optional. Log in to save your voices, settings and script history to your account.
        </p>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Password (min 6 characters)"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
        </div>

        {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
        {notice && <p className="mt-3 text-xs text-emerald-400">{notice}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-rose-600 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
            setNotice(null);
          }}
          className="mt-3 w-full text-xs text-zinc-400 hover:text-zinc-200"
        >
          {mode === 'login' ? "No account? Sign up" : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  );
};
