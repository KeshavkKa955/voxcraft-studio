import React, { useEffect, useRef } from 'react';

export type StudioTab = 'single' | 'dialogue' | 'editor' | 'clone';

interface LandingPageProps {
  onEnter: (tab?: StudioTab) => void;
}

const CSS = `
.lp{--ink:#15171c;--muted:#656c7a;--a:#ff7a2f;--b:#e8456b;--c:#12a594;--card:rgba(255,255,255,.72);position:relative;min-height:100vh;color:var(--ink);font-family:'Space Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;background:#eceef1}
.lp *{box-sizing:border-box}
.lp canvas{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
.lp-nav{position:fixed;left:0;right:0;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;padding:14px 22px;background:rgba(236,238,241,.7);backdrop-filter:blur(10px)}
.lp-brand{font-weight:700;letter-spacing:-.02em;font-size:18px;color:var(--ink);background:none;border:0;cursor:pointer;font-family:inherit;padding:0}
.lp-links{display:flex;gap:22px;align-items:center}
.lp-l{color:var(--muted);font-size:14px;background:none;border:0;cursor:pointer;font-family:inherit;padding:0}
.lp-l:hover{color:var(--ink)}
.lp-btn{display:inline-block;padding:12px 24px;border-radius:999px;color:#fff;background:var(--ink);font-weight:700;font-size:14px;border:0;cursor:pointer;font-family:inherit;box-shadow:0 10px 28px rgba(20,24,35,.22)}
.lp-btn.ghost{background:rgba(255,255,255,.7);color:var(--ink);box-shadow:none;border:1px solid rgba(20,24,35,.14)}
.lp-main{position:relative;z-index:1}
.lp-hero{min-height:100vh;min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 24px 11vh;animation:lpup .9s 1.7s cubic-bezier(.2,.7,.2,1) both}
.lp-cue{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--muted);text-align:center}
.lp-cue i{display:block;width:1px;height:34px;margin:10px auto 0;background:linear-gradient(var(--ink),transparent);animation:lpdrip 1.8s infinite}
@keyframes lpdrip{0%{transform:scaleY(0);transform-origin:top}50%{transform:scaleY(1);transform-origin:top}51%{transform-origin:bottom}100%{transform:scaleY(0);transform-origin:bottom}}
@keyframes lpup{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.lp-kick{font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:var(--c);margin:0 0 14px;font-weight:600}
.lp h1,.lp h2{margin:0 auto;font-weight:700;letter-spacing:-.035em;line-height:1.02;text-wrap:balance}
.lp h1{font-size:clamp(36px,7vw,92px);max-width:14ch}
.lp h2{font-size:clamp(28px,4.4vw,56px);max-width:18ch}
.lp-grad{background:linear-gradient(95deg,var(--a),var(--b));-webkit-background-clip:text;background-clip:text;color:transparent}
.lp-sub{margin:16px auto 0;color:var(--muted);font-size:clamp(15px,1.8vw,19px);max-width:40ch;line-height:1.5}
.lp-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:26px}
.lp-sec{padding:14vh 24px;max-width:1100px;margin:0 auto;text-align:center}
.lp-head{margin-bottom:44px}
.lp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;text-align:left}
.lp-card{background:var(--card);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.9);border-radius:22px;padding:26px;box-shadow:0 18px 40px rgba(40,50,70,.12);display:flex;flex-direction:column;gap:10px;color:var(--ink);cursor:pointer;font-family:inherit;text-align:left;transition:transform .25s,box-shadow .25s}
.lp-card:hover{transform:translateY(-6px);box-shadow:0 26px 50px rgba(40,50,70,.18)}
.lp-card i{font-style:normal;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:var(--ink);color:#fff;font-weight:700;font-size:15px}
.lp-card b{font-size:20px;letter-spacing:-.02em}.lp-card p{margin:0;color:var(--muted);font-size:14.5px;line-height:1.5}.lp-card span{margin-top:auto;font-weight:700;font-size:14px;color:var(--b)}
.lp-foot{position:relative;z-index:1;text-align:center;padding:30px 24px 40px;color:var(--muted);font-size:13px}
.lp .rv{opacity:0;transform:translateY(34px);transition:opacity .8s,transform .8s cubic-bezier(.2,.7,.2,1)}.lp .rv.in{opacity:1;transform:none}
@media(max-width:640px){.lp-l{display:none}}
`;

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // page font, light background and smooth scrolling while the landing page is open
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap';
    document.head.appendChild(font);
    const prevBg = document.body.style.background;
    document.body.style.background = '#eceef1';
    document.documentElement.style.scrollBehavior = 'smooth';
    window.scrollTo(0, 0);

    const cv = cvRef.current!;
    const ctx = cv.getContext('2d')!;
    let W = 0, H = 0, p = 0, tp = 0, rp = 0, raf = 0;
    const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
    const ss = (x: number) => { x = clamp(x); return x * x * (3 - 2 * x); };
    const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const size = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cv.width = W * d; cv.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    const onScroll = () => { tp = clamp(scrollY / (H * 0.9)); };
    addEventListener('resize', size);
    addEventListener('scroll', onScroll, { passive: true });
    size(); onScroll(); p = tp;

    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      (ctx as any).roundRect ? (ctx as any).roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
    };

    const waves = (t: number, amp: number, a: number, more: number) => {
      const base = H * 0.74, n = 6 + Math.round(10 * more);
      for (let k = 0; k < n; k++) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 5) {
          const u = x / W, env = Math.pow(Math.sin(Math.PI * u), 0.8);
          const y = base + k * (14 - more * 5) + (Math.sin(u * Math.PI * (2 + k * 0.7) + t * (0.7 + k * 0.15)) * 0.5 + Math.sin(u * Math.PI * 7 + t * 1.3 + k) * 0.18) * (26 + H * 0.06) * amp * env * Math.max(0.3, 1 - k * 0.06);
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        const g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, 'rgba(18,165,148,0)'); g.addColorStop(0.3, 'rgba(18,165,148,.9)');
        g.addColorStop(0.7, 'rgba(255,122,47,.9)'); g.addColorStop(1, 'rgba(232,69,107,0)');
        ctx.strokeStyle = g; ctx.globalAlpha = a * Math.max(0.1, 0.9 - k * 0.07);
        ctx.lineWidth = Math.max(0.9, 2.2 - k * 0.1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const flute = (t: number, e: number, s: number, rot: number) => {
      const bs = Math.min(W * 0.7, 900), sc = (2 - 0.6 * e) * (1 - 0.62 * s), FL = bs * sc, T = clamp(bs * 0.04, 16, 36) * sc;
      const cy = H * (0.5 - 0.04 * e) - s * H * 0.26, a = (0.25 + 0.75 * e) * (1 - 0.6 * s);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, cy); ctx.rotate(-0.06 - rot * 0.62);
      const holes: number[] = [];
      for (let k = 0; k < 6; k++) holes.push(FL * (-0.04 + k * 0.085));
      const nr = 3 + Math.round(4 * s);
      holes.forEach((hx, k) => {
        for (let q = 0; q < nr; q++) {
          const ph = ((t * 0.4 + k * 0.17 + q / nr) % 1), rad = ph * (FL * 0.2 + T * 3 + s * FL * 0.15) + T * 0.4;
          ctx.beginPath(); ctx.arc(hx, 0, rad, 0, 7);
          ctx.strokeStyle = 'rgba(18,165,148,' + Math.pow(1 - ph, 2) * (0.18 + 0.5 * s) * e + ')';
          ctx.lineWidth = 1.6; ctx.stroke();
        }
      });
      const bg = ctx.createLinearGradient(0, -T / 2, 0, T / 2);
      bg.addColorStop(0, '#f3cf93'); bg.addColorStop(0.5, '#c0782b'); bg.addColorStop(1, '#7a4813');
      rr(-FL / 2, -T / 2, FL, T, T / 2); ctx.fillStyle = bg;
      ctx.shadowColor = 'rgba(60,40,10,.35)'; ctx.shadowBlur = 22 + (1 - e) * 50; ctx.shadowOffsetY = T * (0.5 + (1 - e));
      ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(60,28,6,.5)';
      [-0.34, -0.05, 0.22, 0.47].forEach((q) => ctx.fillRect(FL * q, -T / 2, Math.max(2, 3 * sc), T));
      ctx.fillStyle = '#2a1406'; ctx.beginPath(); ctx.ellipse(-FL / 2 + FL * 0.17, 0, T * 0.34, T * 0.2, 0, 0, 7); ctx.fill();
      holes.forEach((hx) => { ctx.beginPath(); ctx.arc(hx, 0, T * 0.2, 0, 7); ctx.fill(); });
      ctx.restore(); ctx.globalAlpha = 1;
    };

    const t0 = performance.now();
    const frame = (now: number) => {
      const t = (now - t0) / 1000, e = reduce ? 1 : ease(t / 2.4);
      p += (tp - p) * 0.1;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#f4f5f7'); g.addColorStop(1, '#dbe0e6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const s = ss(p);
      rp += (scrollY / H - rp) * 0.08;
      waves(reduce ? 0 : t, 0.12 + 1.1 * s, 0.35 + 0.65 * s, s);
      flute(t, e, s, rp);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const io = new IntersectionObserver((es) => es.forEach((x) => {
      if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); }
    }), { threshold: 0.15 });
    rootRef.current?.querySelectorAll('.rv').forEach((el, i) => {
      (el as HTMLElement).style.transitionDelay = (i % 4) * 0.08 + 's';
      io.observe(el);
    });

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', size);
      removeEventListener('scroll', onScroll);
      io.disconnect();
      font.remove();
      document.body.style.background = prevBg;
      document.documentElement.style.scrollBehavior = '';
      window.scrollTo(0, 0);
    };
  }, []);

  const go = (id: string) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const cards: { tab: StudioTab; n: string; title: string; text: string }[] = [
    { tab: 'single', n: '01', title: 'Voiceover', text: 'Type a script, pick a voice, language, accent and emotion, then generate speech.' },
    { tab: 'dialogue', n: '02', title: 'Multi-Voice', text: 'Write a dialogue between two speakers and get one finished audio file.' },
    { tab: 'editor', n: '03', title: 'Audio Editor', text: 'Trim, fade, change speed and pitch, and check the waveform before exporting.' },
    { tab: 'clone', n: '04', title: 'Voice Clone', text: 'Record a short sample of your own voice and use it to speak new words.' },
  ];

  return (
    <div className="lp" ref={rootRef}>
      <style>{CSS}</style>
      <canvas ref={cvRef} />
      <nav className="lp-nav">
        <button className="lp-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>VoxCraft</button>
        <div className="lp-links">
          <button className="lp-l" onClick={go('lp-options')}>Options</button>
          <button className="lp-l" onClick={go('lp-start')}>Get started</button>
          <button className="lp-btn" onClick={() => onEnter()}>Open VoxCraft</button>
        </div>
      </nav>
      <main className="lp-main">
        <div className="lp-hero"><div className="lp-cue">Scroll<i /></div></div>
        <section className="lp-sec" style={{ paddingTop: '8vh' }}>
          <div className="rv">
            <p className="lp-kick">Open-source · Voice AI</p>
            <h1>Every voice starts <span className="lp-grad">as a wave.</span></h1>
            <p className="lp-sub">Turn any script into natural speech, shape it with emotion and accent, and clone your own voice.</p>
            <div className="lp-row">
              <button className="lp-btn" onClick={() => onEnter()}>Open VoxCraft</button>
              <button className="lp-btn ghost" onClick={go('lp-options')}>See options</button>
            </div>
          </div>
        </section>
        <section className="lp-sec" id="lp-options">
          <div className="lp-head rv"><p className="lp-kick">Options</p><h2>Everything your voice <span className="lp-grad">needs.</span></h2></div>
          <div className="lp-grid">
            {cards.map((c) => (
              <button key={c.tab} className="lp-card rv" onClick={() => onEnter(c.tab)}>
                <i>{c.n}</i><b>{c.title}</b><p>{c.text}</p><span>Open →</span>
              </button>
            ))}
          </div>
        </section>
        <section className="lp-sec" id="lp-start">
          <div className="rv">
            <p className="lp-kick">Get started</p>
            <h2>Hear your words in <span className="lp-grad">a new voice.</span></h2>
            <p className="lp-sub">Free to try in your browser. Export your audio as WAV or MP3.</p>
            <div className="lp-row"><button className="lp-btn" onClick={() => onEnter()}>Open VoxCraft</button></div>
          </div>
        </section>
      </main>
      <footer className="lp-foot">VoxCraft · Clone only your own voice, or one you have permission to use.</footer>
    </div>
  );
};
