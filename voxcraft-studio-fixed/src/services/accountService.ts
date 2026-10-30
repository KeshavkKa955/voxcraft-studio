/**
 * Optional account support (Netlify Identity) + cloud sync of small user data.
 * The app works fully without logging in; data then stays in this browser.
 */
import { getUser, login, signup, logout, handleAuthCallback, getSettings, oauthLogin } from '@netlify/identity';
import { VoiceProfile } from '../types/index.ts';

export interface HistoryItem {
  id: string;
  text: string;
  voiceName: string;
  createdAt: number;
}

export interface VoiceSettings {
  language?: string;
  voiceId?: string;
  accent?: string;
  emotion?: string;
  speed?: number;
  pitchShift?: number;
  customDirectives?: string;
}

export interface CloudData {
  voices: VoiceProfile[];
  history: HistoryItem[];
  settings: VoiceSettings;
  updatedAt?: number;
}

export interface AccountUser {
  id: string;
  email: string;
}

const toAccountUser = (u: any): AccountUser | null =>
  u ? { id: u.id, email: u.email || '' } : null;

export const accountService = {
  async init(): Promise<AccountUser | null> {
    try {
      // Completes email-confirmation / recovery links, if the page was opened from one
      await handleAuthCallback();
    } catch (e) {
      console.warn('Auth callback note:', e);
    }
    try {
      return toAccountUser(await getUser());
    } catch {
      return null;
    }
  },

  async signIn(email: string, password: string): Promise<AccountUser | null> {
    return toAccountUser(await login(email, password));
  },

  /** Returns the user, or null when an email confirmation is required first. */
  async signUp(email: string, password: string): Promise<AccountUser | null> {
    const u: any = await signup(email, password);
    return u && u.confirmedAt !== undefined && !u.confirmedAt ? null : toAccountUser(u);
  },

  /** Login providers (google, github...) that are switched on in Netlify Identity settings. */
  async getProviders(): Promise<string[]> {
    try {
      const st: any = await getSettings();
      return Object.entries(st.providers || {})
        .filter(([, on]) => !!on)
        .map(([name]) => name);
    } catch {
      return [];
    }
  },

  oauth(provider: string): void {
    oauthLogin(provider as any); // redirects the browser to the provider
  },

  async signOut(): Promise<void> {
    await logout();
  },

  async load(): Promise<CloudData | null> {
    const res = await fetch('/api/user-data');
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.includes('application/json')) {
      throw new Error('Could not load saved data.');
    }
    const body = await res.json();
    return body.data || null;
  },

  async save(data: CloudData): Promise<void> {
    // Cloned-voice sample links only work in the browser that made them, so don't upload them
    const voices = data.voices.map((v) => ({ ...v, cloneSamples: undefined, colabRefAudio: undefined }));
    const res = await fetch('/api/user-data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, voices }),
    });
    if (!res.ok) throw new Error('Could not save data.');
  },
};

/** Remembers in this browser that the one free voice was already used. */
const FREE_KEY = 'voxcraft_free_voice_used';
export const guestUsage = {
  used(): boolean {
    try {
      return localStorage.getItem(FREE_KEY) === '1';
    } catch {
      return false;
    }
  },
  markUsed(): void {
    try {
      localStorage.setItem(FREE_KEY, '1');
    } catch {
      /* storage unavailable */
    }
  },
};
