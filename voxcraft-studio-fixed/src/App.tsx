import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { SingleVoiceoverTab } from './components/SingleVoiceoverTab.tsx';
import { MultiSpeakerDialogueTab } from './components/MultiSpeakerDialogueTab.tsx';
import { VoiceCloningTab } from './components/VoiceCloningTab.tsx';
import { AudioLabEditor } from './components/AudioLabEditor.tsx';
import { ExportModal } from './components/ExportModal.tsx';
import { LibraryTab, LibraryItem } from './components/LibraryTab.tsx';
import { VoiceProfile } from './types/index.ts';
import { DEFAULT_VOICES } from './data/constants.ts';
import { voiceCloneService } from './services/voiceCloneService.ts';
import { audioEngine } from './services/audioEngine.ts';
import { accountService, AccountUser, HistoryItem, VoiceSettings } from './services/accountService.ts';
import { AccountModal } from './components/AccountModal.tsx';
import { LandingPage } from './components/LandingPage.tsx';

const HISTORY_KEY = 'voxcraft_history';
const SETTINGS_KEY = 'voxcraft_settings';

const readLocal = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeLocal = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'dialogue' | 'editor' | 'clone' | 'library'>('single');
  const [showLanding, setShowLanding] = useState<boolean>(true);
  const [voices, setVoices] = useState<VoiceProfile[]>(DEFAULT_VOICES);
  const [activeAudioBuffer, setActiveAudioBuffer] = useState<AudioBuffer | null>(null);
  const [activeTrackTitle, setActiveTrackTitle] = useState<string>('Voiceover Master');
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [showAccount, setShowAccount] = useState<boolean>(false);
  const [cloudReady, setCloudReady] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => readLocal<HistoryItem[]>(HISTORY_KEY, []));
  const [settings, setSettings] = useState<VoiceSettings>(() => readLocal<VoiceSettings>(SETTINGS_KEY, {}));
  const [settingsVersion, setSettingsVersion] = useState<number>(0);

  // Initialize saved cloned voices and check API health
  useEffect(() => {
    // 1. Check API health
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.hasApiKey) {
          setHasApiKey(true);
        }
      })
      .catch((e) => console.warn('Health check note:', e));

    // 2. Load custom cloned voices from localStorage
    const savedClones = voiceCloneService.getSavedVoices();
    if (savedClones.length > 0) {
      setVoices([...savedClones, ...DEFAULT_VOICES]);
    }

    // 3. Pre-seed default demo audio buffer so editor is instantly interactive
    try {
      const demoBuffer = audioEngine.generateDemoVoiceoverBuffer(3.8, 220);
      setActiveAudioBuffer(demoBuffer);
      setActiveTrackTitle('Demo Studio Take (Kore 24kHz)');
      audioEngine.setActiveBuffer(demoBuffer);
    } catch (e) {
      console.warn('Could not pre-seed audio context:', e);
    }
  }, []);

  // Pull saved data from the account after login and merge it with what is in this browser
  const loadCloud = async () => {
    try {
      const cloud = await accountService.load();
      if (cloud) {
        const localClones = voiceCloneService.getSavedVoices();
        const merged = [...localClones];
        (cloud.voices || []).forEach((v) => {
          if (!merged.some((m) => m.id === v.id)) merged.push(v);
        });
        merged.forEach((v) => voiceCloneService.saveVoice(v));
        setVoices([...merged, ...DEFAULT_VOICES]);

        const localHistory = readLocal<HistoryItem[]>(HISTORY_KEY, []);
        const mergedHistory = [...localHistory];
        (cloud.history || []).forEach((h) => {
          if (!mergedHistory.some((m) => m.id === h.id)) mergedHistory.push(h);
        });
        mergedHistory.sort((a, b) => b.createdAt - a.createdAt);
        setHistory(mergedHistory.slice(0, 50));

        if (cloud.settings && Object.keys(cloud.settings).length > 0) {
          setSettings(cloud.settings);
          setSettingsVersion((n) => n + 1);
        }
      }
    } catch (e) {
      console.warn('Cloud load note:', e);
    } finally {
      setCloudReady(true);
    }
  };

  useEffect(() => {
    accountService.init().then((u) => {
      if (u) {
        setUser(u);
        loadCloud();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep browser copy up to date
  useEffect(() => writeLocal(HISTORY_KEY, history), [history]);
  useEffect(() => writeLocal(SETTINGS_KEY, settings), [settings]);

  // Save to the account (debounced) while logged in
  useEffect(() => {
    if (!user || !cloudReady) return;
    const t = setTimeout(() => {
      accountService
        .save({ voices: voices.filter((v) => v.isClone), history, settings })
        .catch((e) => console.warn('Cloud save note:', e));
    }, 1500);
    return () => clearTimeout(t);
  }, [user, cloudReady, voices, history, settings]);

  const handleSignIn = async (email: string, password: string) => {
    const u = await accountService.signIn(email, password);
    setUser(u);
    setCloudReady(false);
    await loadCloud();
  };

  const handleSignUp = async (email: string, password: string): Promise<string | null> => {
    const u = await accountService.signUp(email, password);
    if (!u) return 'Account created. Check your email and click the confirmation link, then log in.';
    setUser(u);
    setCloudReady(false);
    await loadCloud();
    return null;
  };

  const handleSignOut = async () => {
    try {
      await accountService.signOut();
    } finally {
      setUser(null);
      setCloudReady(false);
    }
  };

  // When a new voiceover is generated
  const handleVoiceoverGenerated = (
    audioBuffer: AudioBuffer,
    text: string,
    voiceName: string
  ) => {
    setActiveAudioBuffer(audioBuffer);
    const shortTitle = text.slice(0, 35) + (text.length > 35 ? '...' : '');
    setActiveTrackTitle(shortTitle);

    const newItem: LibraryItem = {
      id: `lib-${Date.now()}`,
      title: shortTitle,
      buffer: audioBuffer,
      createdAt: Date.now(),
      duration: audioBuffer.duration,
      speakerName: voiceName,
    };
    setLibraryItems((prev) => [newItem, ...prev]);
    setHistory((prev) =>
      [{ id: `h-${Date.now()}`, text, voiceName, createdAt: Date.now() }, ...prev.filter((h) => h.text !== text)].slice(0, 50)
    );
  };

  // When a multi-speaker master is generated
  const handleDialogueMasterGenerated = (
    audioBuffer: AudioBuffer,
    title: string
  ) => {
    setActiveAudioBuffer(audioBuffer);
    setActiveTrackTitle(title);

    const newItem: LibraryItem = {
      id: `lib-dialogue-${Date.now()}`,
      title,
      buffer: audioBuffer,
      createdAt: Date.now(),
      duration: audioBuffer.duration,
      speakerName: 'Multi-Speaker Ensemble',
    };
    setLibraryItems((prev) => [newItem, ...prev]);
  };

  // When a voice clone is created
  const handleVoiceCreated = (newVoice: VoiceProfile) => {
    setVoices((prev) => [newVoice, ...prev]);
  };

  // Delete voice clone
  const handleDeleteVoice = (voiceId: string) => {
    const toDelete = voices.find((v) => v.id === voiceId);
    if (toDelete?.geminiVoiceId) {
      // Also remove the stored voice model on Google's side
      fetch(`/api/voice/replicate?id=${encodeURIComponent(toDelete.geminiVoiceId)}`, { method: 'DELETE' }).catch(() => {});
    }
    voiceCloneService.deleteVoice(voiceId);
    setVoices((prev) => prev.filter((v) => v.id !== voiceId));
  };

  const clonedVoices = voices.filter((v) => v.isClone);

  if (showLanding) {
    return (
      <LandingPage
        onEnter={(tab) => {
          if (tab) setActiveTab(tab);
          setShowLanding(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasAudioInEditor={!!activeAudioBuffer}
        onOpenExport={() => setIsExportOpen(true)}
        hasApiKey={hasApiKey}
        clonedVoicesCount={clonedVoices.length}
        accountEmail={user?.email || null}
        onOpenAccount={() => setShowAccount(true)}
        onSignOut={handleSignOut}
      />

      {showAccount && (
        <AccountModal
          onClose={() => setShowAccount(false)}
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
        />
      )}

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'single' && (
          <SingleVoiceoverTab
            key={settingsVersion}
            settings={settings}
            onSettingsChange={setSettings}
            history={history}
            voices={voices}
            onVoiceoverGenerated={handleVoiceoverGenerated}
            onOpenInEditor={() => setActiveTab('editor')}
          />
        )}

        {activeTab === 'dialogue' && (
          <MultiSpeakerDialogueTab
            voices={voices}
            onDialogueMasterGenerated={handleDialogueMasterGenerated}
            onOpenInEditor={() => setActiveTab('editor')}
          />
        )}

        {activeTab === 'editor' && (
          <AudioLabEditor
            audioBuffer={activeAudioBuffer}
            trackTitle={activeTrackTitle}
            onOpenExport={() => setIsExportOpen(true)}
          />
        )}

        {activeTab === 'clone' && (
          <VoiceCloningTab
            clonedVoices={clonedVoices}
            onVoiceCreated={handleVoiceCreated}
            onDeleteVoice={handleDeleteVoice}
            onSelectVoiceForStudio={(voiceId) => {
              setActiveTab('single');
            }}
          />
        )}

        {activeTab === 'library' && (
          <LibraryTab
            items={libraryItems}
            onLoadIntoEditor={(item) => {
              setActiveAudioBuffer(item.buffer);
              setActiveTrackTitle(item.title);
              audioEngine.setActiveBuffer(item.buffer);
              setActiveTab('editor');
            }}
            onDeleteItem={(id) => {
              setLibraryItems((prev) => prev.filter((i) => i.id !== id));
            }}
            onQuickExport={(item) => {
              setActiveAudioBuffer(item.buffer);
              setActiveTrackTitle(item.title);
              setIsExportOpen(true);
            }}
          />
        )}
      </main>

      {/* Export / Download High-Quality Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        audioBuffer={activeAudioBuffer}
        trackTitle={activeTrackTitle}
      />

      {/* Studio Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950/60 py-4 text-center text-xs text-zinc-500 font-mono">
        VoxCraft Studio • Multilingual Generative Voiceovers & Acoustic Timbre Cloning • 24kHz / 48kHz Lossless
      </footer>
    </div>
  );
}
