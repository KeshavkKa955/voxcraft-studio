import { LanguageOption, AccentOption, EmotionOption, VoiceProfile } from '../types/index.ts';

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)', flag: '🇺🇸', sampleText: 'The future of voice technology is here, natural and expressive.' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)', flag: '🇬🇧', sampleText: 'Good day. Welcome to the world of expressive speech generation.' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', sampleText: 'La tecnología de clonación y síntesis de voz transforma la creatividad.' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français', flag: '🇫🇷', sampleText: 'Bienvenue dans le studio de doublage vocal nouvelle génération.' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', sampleText: 'Präzise Sprachausgabe und individuelle Stimmmodelle für jedes Projekt.' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', sampleText: 'La voce umana incontra la precisione acustica digitale.' },
  { code: 'pt-BR', name: 'Portuguese (BR)', nativeName: 'Português', flag: '🇧🇷', sampleText: 'Crie dublagens e locuções perfeitas em qualquer tom emocional.' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', sampleText: '最新の音声合成技術で、表現力豊かなナレーションをお届けします。' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', sampleText: 'अपनी आवाज और भावनाओं को किसी भी भाषा में जीवंत बनाएं।' },
  { code: 'zh-CN', name: 'Chinese (Mandarin)', nativeName: '中文', flag: '🇨🇳', sampleText: '体验多语种智能配音与自然情感语调合成。' },
  { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', sampleText: 'مرحباً بكم في استوديو التعليق الصوتي الذكي متعدد اللغات.' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', sampleText: '자연스러운 억양과 감정을 담은 차세대 AI 보이스오버 스튜디오.' },
  { code: 'ru-RU', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', sampleText: 'Создавайте профессиональные озвучки с любым акцентом и эмоцией.' },
];

export const ACCENTS: AccentOption[] = [
  { id: 'general-american', name: 'General American', region: 'North America', description: 'Standard, neutral broadcast clarity' },
  { id: 'british-rp', name: 'British RP (Received Pronunciation)', region: 'United Kingdom', description: 'Refined, authoritative BBC style' },
  { id: 'london-cockney', name: 'London / Cockney', region: 'United Kingdom', description: 'Warm, colloquial urban British' },
  { id: 'scottish', name: 'Scottish Highlands', region: 'United Kingdom', description: 'Melodic, rhythmic with rich rhotics' },
  { id: 'irish', name: 'Irish Brogue', region: 'Ireland', description: 'Lyrical, friendly, poetic cadence' },
  { id: 'australian', name: 'Australian', region: 'Oceania', description: 'Upbeat, friendly with rising inflections' },
  { id: 'us-southern', name: 'American Southern', region: 'North America', description: 'Warm, drawling, hospitable storytelling' },
  { id: 'new-york', name: 'New York / Brooklyn', region: 'North America', description: 'Punchy, confident metropolitan tone' },
  { id: 'french-accent', name: 'French Accent', region: 'Europe', description: 'Chic, soft consonants and romantic cadence' },
  { id: 'german-accent', name: 'German Accent', region: 'Europe', description: 'Structured, crisp, articulate articulation' },
  { id: 'spanish-castilian', name: 'Spanish / Iberian', region: 'Europe', description: 'Passionate, clear, rhythmic flow' },
  { id: 'latin-american', name: 'Latin American', region: 'Americas', description: 'Vibrant, melodic, welcoming warmth' },
  { id: 'indian-english', name: 'Indian English', region: 'Asia', description: 'Expressive, articulate, precise syllables' },
  { id: 'japanese-accent', name: 'Japanese Accent', region: 'Asia', description: 'Polite, measured, gentle cadence' },
  { id: 'italian-accent', name: 'Italian Accent', region: 'Europe', description: 'Expressive, musical, dynamic vocal peaks' },
  { id: 'nordic', name: 'Nordic / Scandinavian', region: 'Europe', description: 'Clean, minimalist, cool resonance' },
];

export const EMOTIONAL_TONES: EmotionOption[] = [
  { id: 'conversational', name: 'Natural Conversational', description: 'Balanced, organic daily human dialogue', icon: 'Smile', color: 'from-blue-500 to-indigo-600' },
  { id: 'enthusiastic', name: 'Enthusiastic & Upbeat', description: 'High energy, vibrant, uplifting optimism', icon: 'Sparkles', color: 'from-amber-400 to-orange-500' },
  { id: 'authoritative', name: 'Authoritative & Serious', description: 'Executive, trustworthy news anchor clarity', icon: 'Shield', color: 'from-slate-600 to-slate-800' },
  { id: 'whispering', name: 'Whispering & Intimate', description: 'Soft ASMR breathiness, gentle closeness', icon: 'Feather', color: 'from-teal-400 to-emerald-600' },
  { id: 'dramatic', name: 'Dramatic & Movie Trailer', description: 'Deep, cinematic, intense suspenseful gravity', icon: 'Film', color: 'from-purple-600 to-rose-700' },
  { id: 'cheerful', name: 'Warm & Friendly', description: 'Heartfelt, approachable, inviting podcast co-host', icon: 'Heart', color: 'from-rose-400 to-pink-600' },
  { id: 'calming', name: 'Calming Meditation', description: 'Slow pace, deep breaths, soothing mindfulness', icon: 'Compass', color: 'from-cyan-400 to-blue-500' },
  { id: 'urgent', name: 'Urgent & Breaking News', description: 'Fast tempo, high alert, rapid informative delivery', icon: 'Bell', color: 'from-red-500 to-amber-600' },
  { id: 'commercial', name: 'High-Conversion Commercial', description: 'Punchy sales pitch, polished advertising cadence', icon: 'Zap', color: 'from-emerald-500 to-teal-700' },
  { id: 'melancholic', name: 'Melancholic & Reflective', description: 'Emotional depth, thoughtful pauses, soft sorrow', icon: 'CloudRain', color: 'from-indigo-400 to-violet-600' },
];

export const DEFAULT_VOICES: VoiceProfile[] = [
  {
    id: 'voice-kore',
    name: 'Kore (Warm Narrative)',
    gender: 'female',
    baseVoice: 'Kore',
    language: 'en-US',
    accent: 'General American',
    emotionalTone: 'Natural Conversational',
    pitchBias: 0,
    speedMultiplier: 1.0,
    isClone: false,
    description: 'Balanced, warm, and highly articulate female voice. Ideal for audiobooks and storytelling.',
  },
  {
    id: 'voice-puck',
    name: 'Puck (Lively & Dynamic)',
    gender: 'neutral',
    baseVoice: 'Puck',
    language: 'en-US',
    accent: 'General American',
    emotionalTone: 'Enthusiastic & Upbeat',
    pitchBias: 0,
    speedMultiplier: 1.0,
    isClone: false,
    description: 'Crisp, youthful, energetic cadence with excellent dynamic range. Ideal for promos and tutorials.',
  },
  {
    id: 'voice-fenrir',
    name: 'Fenrir (Deep Cinematic)',
    gender: 'male',
    baseVoice: 'Fenrir',
    language: 'en-US',
    accent: 'British RP (Received Pronunciation)',
    emotionalTone: 'Dramatic & Movie Trailer',
    pitchBias: -2,
    speedMultiplier: 0.95,
    isClone: false,
    description: 'Low baritone with rich sub-harmonics and commanding weight. Perfect for movie trailers.',
  },
  {
    id: 'voice-charon',
    name: 'Charon (Executive Anchor)',
    gender: 'male',
    baseVoice: 'Charon',
    language: 'en-US',
    accent: 'General American',
    emotionalTone: 'Authoritative & Serious',
    pitchBias: -1,
    speedMultiplier: 1.0,
    isClone: false,
    description: 'Mature, resonant, trustworthy broadcast tone. Ideal for documentaries, corporate, and news.',
  },
  {
    id: 'voice-zephyr',
    name: 'Zephyr (Soothing & Air)',
    gender: 'female',
    baseVoice: 'Zephyr',
    language: 'en-US',
    accent: 'General American',
    emotionalTone: 'Calming Meditation',
    pitchBias: 1,
    speedMultiplier: 0.9,
    isClone: false,
    description: 'Gentle, airy soprano with relaxing timbre and smooth transitions. Perfect for wellness and sleep.',
  },
];

export const CLONING_SAMPLE_SCRIPTS = [
  {
    title: 'Phonetic Diversity & Clarity',
    text: 'The quick brown fox jumps over the lazy dog near the bank of the shimmering river. I believe technology should empower human creativity rather than replace it.',
  },
  {
    title: 'Dynamic Pitch & Intonation',
    text: 'Can you hear the subtleties in every spoken word? Today we explore uncharted territories of acoustic expression, where every syllable carries genuine feeling.',
  },
  {
    title: 'Conversational Pace',
    text: 'Honestly, having an AI recreate my exact speech style is unbelievable. I want this voice to sound natural, comfortable, and undeniably like me.',
  },
];

export const SAMPLE_STUDIO_SCRIPTS = [
  {
    name: 'Tech Keynote & Future Vision',
    language: 'en-US',
    accent: 'General American',
    emotion: 'Enthusiastic & Upbeat',
    text: 'Welcome everyone! Today marks a monumental leap in generative acoustic design. For the very first time, studio-grade multilingual voiceovers can be synthesized and sculpted with microsecond precision right inside your browser.',
  },
  {
    name: 'Cinematic Movie Teaser',
    language: 'en-US',
    accent: 'British RP (Received Pronunciation)',
    emotion: 'Dramatic & Movie Trailer',
    text: 'In a world where echoes shape destiny, one whispered secret could unravel centuries of silence. Prepare yourself... for what lies beyond the horizon.',
  },
  {
    name: 'Peaceful Mindfulness Guide',
    language: 'en-US',
    accent: 'General American',
    emotion: 'Calming Meditation',
    text: 'Take a gentle, deep breath in through your nose. Hold it for just a moment. And softly exhale, letting go of any tension in your shoulders.',
  },
  {
    name: 'Multilingual Travel & Culture (Spanish)',
    language: 'es-ES',
    accent: 'Spanish / Iberian',
    emotion: 'Warm & Friendly',
    text: 'Bienvenidos a las calles empedradas de Sevilla, donde cada esquina guarda una melodía y la luz dorada del atardecer ilumina los tejados antiguos.',
  },
];

export const SAMPLE_DIALOGUE_SCRIPT = `Narrator [Authoritative, British RP]: Deep inside the audio engineering research facility, two visionaries prepared their breakthrough demo. [pause:600ms]
Alex [Enthusiastic, General American]: Sam, look at these spectral harmonics! The latency dropped under forty milliseconds!
Sam [Warm, London Cockney]: Unbelievable! It captured my exact vocal resonance in less than three short samples.
Narrator [Dramatic]: And so, a new era of personalized audio creation had officially begun.`;
