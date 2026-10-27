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

export default function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'dialogue' | 'editor' | 'clone' | 'library'>('single');
  const [voices, setVoices] = useState<VoiceProfile[]>(DEFAULT_VOICES);
  const [activeAudioBuffer, setActiveAudioBuffer] = useState<AudioBuffer | null>(null);
  const [activeTrackTitle, setActiveTrackTitle] = useState<string>('Voiceover Master');
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

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
    voiceCloneService.deleteVoice(voiceId);
    setVoices((prev) => prev.filter((v) => v.id !== voiceId));
  };

  const clonedVoices = voices.filter((v) => v.isClone);

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
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'single' && (
          <SingleVoiceoverTab
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
