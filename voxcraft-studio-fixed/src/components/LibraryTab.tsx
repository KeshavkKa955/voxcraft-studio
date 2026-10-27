import React from 'react';
import { Play, Pause, Sliders, Download, Trash2, Volume2, Clock } from 'lucide-react';
import { formatDuration } from '../utils/audioEncoding.ts';

export interface LibraryItem {
  id: string;
  title: string;
  buffer: AudioBuffer;
  createdAt: number;
  duration: number;
  speakerName: string;
}

interface LibraryTabProps {
  items: LibraryItem[];
  onLoadIntoEditor: (item: LibraryItem) => void;
  onDeleteItem: (id: string) => void;
  onQuickExport: (item: LibraryItem) => void;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({
  items,
  onLoadIntoEditor,
  onDeleteItem,
  onQuickExport,
}) => {
  const [playingId, setPlayingId] = React.useState<string | null>(null);

  const handlePlayToggle = (item: LibraryItem) => {
    if (playingId === item.id) {
      // stop
      setPlayingId(null);
    } else {
      setPlayingId(item.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>Voiceover Library & History</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Access, re-edit, and export previously synthesized takes and audio masters.
          </p>
        </div>
        <span className="text-xs font-mono text-zinc-400 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700">
          {items.length} track{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 p-8 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400 mx-auto">
            <Volume2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">No Generated Audio Yet</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Synthesize a voiceover in the Voiceover Studio or assemble a multi-speaker script to save tracks here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handlePlayToggle(item)}
                    className="w-9 h-9 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    {playingId === item.id ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                  <div>
                    <h4 className="text-xs font-semibold text-white line-clamp-1">{item.title}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5">
                      <span>{item.speakerName}</span>
                      <span>•</span>
                      <span>{formatDuration(item.duration)}</span>
                      <span>•</span>
                      <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteItem(item.id)}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 border-t border-zinc-800/80 pt-2.5">
                <button
                  onClick={() => onLoadIntoEditor(item)}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white flex items-center justify-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Edit Pitch & Timing</span>
                </button>

                <button
                  onClick={() => onQuickExport(item)}
                  className="py-1.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-xs font-medium text-amber-300 flex items-center justify-center gap-1.5 border border-amber-500/30 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
