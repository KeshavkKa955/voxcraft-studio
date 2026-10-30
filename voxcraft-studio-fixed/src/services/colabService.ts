/**
 * Free voice cloning through the user's own Google Colab notebook (Chatterbox model).
 * The browser talks directly to the Colab server using a "connection code" (url|token).
 */
const CODE_KEY = 'voxcraft_colab_code';

export interface ColabConnection {
  url: string;
  token: string;
}

export const colabService = {
  parseCode(code: string): ColabConnection | null {
    const [rawUrl, token] = code.trim().split('|');
    if (!rawUrl || !token) return null;
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== 'https:') return null;
      return { url: u.origin, token: token.trim() };
    } catch {
      return null;
    }
  },

  getCode(): string {
    try {
      return localStorage.getItem(CODE_KEY) || '';
    } catch {
      return '';
    }
  },

  saveCode(code: string): void {
    try {
      localStorage.setItem(CODE_KEY, code.trim());
    } catch {
      /* storage unavailable */
    }
  },

  getConnection(): ColabConnection | null {
    return this.parseCode(this.getCode());
  },

  /** True when the Colab server answers. */
  async check(conn: ColabConnection): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(`${conn.url}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  },

  emotionToExaggeration(emotion: string): number {
    const e = (emotion || '').toLowerCase();
    if (e.includes('dramatic')) return 0.9;
    if (e.includes('enthusias')) return 0.8;
    if (e.includes('authorit')) return 0.6;
    if (e.includes('whisper') || e.includes('calm')) return 0.3;
    return 0.5;
  },

  async speak(opts: {
    text: string;
    language: string;
    referenceBase64: string;
    emotion: string;
  }): Promise<{ audioBase64: string }> {
    const conn = this.getConnection();
    if (!conn) {
      throw new Error('Colab is not connected. Open the Voice Clone tab and paste your connection code.');
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 180000);
    let res: Response;
    try {
      res = await fetch(`${conn.url}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Token': conn.token },
        body: JSON.stringify({
          text: opts.text,
          language: (opts.language || 'en').split('-')[0].toLowerCase(),
          referenceBase64: opts.referenceBase64,
          exaggeration: this.emotionToExaggeration(opts.emotion),
        }),
        signal: ctrl.signal,
      });
    } catch {
      throw new Error('Could not reach your Colab server. Make sure the notebook is still running, then reconnect.');
    } finally {
      clearTimeout(timer);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.audioBase64) {
      throw new Error(data.error || `Colab server error (status ${res.status}).`);
    }
    return { audioBase64: data.audioBase64 };
  },
};
