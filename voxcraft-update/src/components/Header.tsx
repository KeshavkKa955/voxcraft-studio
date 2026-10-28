import React from 'react';
import { Mic2, Sliders, Waves, Sparkles, Download, CheckCircle2, AlertCircle, User, LogOut } from 'lucide-react';

interface HeaderProps {
  activeTab: 'single' | 'dialogue' | 'editor' | 'clone' | 'library';
  setActiveTab: (tab: 'single' | 'dialogue' | 'editor' | 'clone' | 'library') => void;
  hasAudioInEditor: boolean;
  onOpenExport: () => void;
  hasApiKey: boolean;
  clonedVoicesCount: number;
  accountEmail: string | null;
  onOpenAccount: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  hasAudioInEditor,
  onOpenExport,
  hasApiKey,
  clonedVoicesCount,
  accountEmail,
  onOpenAccount,
  onSignOut,
}) => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/10 shrink-0">
              <Mic2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base sm:text-lg text-white tracking-tight">VoxCraft</span>
                <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 hidden xs:inline-block">
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Multilingual AI Voiceover & Acoustic Cloning Lab
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 overflow-x-auto max-w-[55vw] sm:max-w-none scrollbar-none">
            <button
              onClick={() => setActiveTab('single')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'single'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Mic2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              <span>Voiceover</span>
            </button>

            <button
              onClick={() => setActiveTab('dialogue')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'dialogue'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Waves className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
              <span>Multi-Voice</span>
            </button>

            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all relative whitespace-nowrap shrink-0 ${
                activeTab === 'editor'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              <span>Audio Editor</span>
              {hasAudioInEditor && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('clone')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all relative whitespace-nowrap shrink-0 ${
                activeTab === 'clone'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
              <span>Voice Clone</span>
              {clonedVoicesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono">
                  {clonedVoicesCount}
                </span>
              )}
            </button>
          </nav>

          {/* Quick Actions & Status */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800">
              {hasApiKey ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-zinc-300 font-mono text-[11px]">Gemini 3.8 TTS Active</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-zinc-400 font-mono text-[11px]">Studio Acoustic Engine</span>
                </>
              )}
            </div>

            {accountEmail ? (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-zinc-300 max-w-[110px] truncate hidden sm:inline">{accountEmail}</span>
                <button onClick={onSignOut} aria-label="Log out" title="Log out" className="text-zinc-400 hover:text-white cursor-pointer">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAccount}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 hover:border-zinc-600 cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>Log in</span>
              </button>
            )}

            {hasAudioInEditor && (
              <button
                onClick={onOpenExport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-medium text-xs sm:text-sm rounded-lg shadow-md shadow-rose-950/40 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export Audio</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
