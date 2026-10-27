import React, { useState } from 'react';
import { X, Download, FileAudio, Check, Sparkles, AudioWaveform } from 'lucide-react';
import { ExportAudioFormat, AudioEditState } from '../types/index.ts';
import { audioEngine } from '../services/audioEngine.ts';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioBuffer: AudioBuffer | null;
  trackTitle: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  audioBuffer,
  trackTitle,
}) => {
  const [format, setFormat] = useState<ExportAudioFormat>('wav');
  const [sampleRate, setSampleRate] = useState<number>(44100);
  const [bitrate, setBitrate] = useState<'320' | '192' | '128'>('320');
  const [filename, setFilename] = useState<string>(
    trackTitle ? trackTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'voxcraft-master'
  );
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  if (!isOpen || !audioBuffer) return null;

  const handleDownload = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      // 1. Render offline with DSP applied
      const editState: AudioEditState = {
        trimStart: 0,
        trimEnd: audioBuffer.duration,
        playbackRate: 1.0,
        pitchShiftSemitones: 0,
        volume: 1.0,
        eqBass: 0,
        eqMid: 0,
        eqTreble: 0,
        reverbAmount: 0,
        noiseGate: false,
      };

      const renderedBuffer = await audioEngine.renderOfflineExport(
        audioBuffer,
        editState,
        sampleRate
      );

      // 2. Export blob
      const { blob } = await audioEngine.exportAudioBlob(renderedBuffer, format);

      // 3. Trigger download in browser
      const cleanName = `${filename.trim() || 'voxcraft-master'}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => {
        setIsExporting(false);
        setExportSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Export failed: ' + err.message);
      setIsExporting(false);
    }
  };

  const estimatedSizeMb = (
    (audioBuffer.duration * (format === 'wav' ? sampleRate * 2 * 2 : (parseInt(bitrate, 10) * 1000) / 8)) /
    (1024 * 1024)
  ).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileAudio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Export High-Quality Audio</h3>
              <p className="text-[11px] text-zinc-400">Lossless & High-Bitrate Master Downloads</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selector */}
        <div>
          <label className="text-xs font-semibold text-zinc-300 block mb-2">
            Target Audio Format
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'wav', name: 'WAV', badge: 'Lossless PCM' },
              { id: 'mp3', name: 'MP3', badge: '320k Studio' },
              { id: 'webm', name: 'WebM / Opus', badge: 'Broadcast' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id as ExportAudioFormat)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  format === f.id
                    ? 'bg-amber-500/10 border-amber-500/60 text-white shadow-sm'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="text-xs font-bold">{f.name}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{f.badge}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Sample Rate & Quality */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              Sample Rate
            </label>
            <select
              value={sampleRate}
              onChange={(e) => setSampleRate(parseInt(e.target.value, 10))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="48000">48,000 Hz (Studio / Film)</option>
              <option value="44100">44,100 Hz (CD Standard)</option>
              <option value="24000">24,000 Hz (Gemini Native)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              Encoding Bitrate
            </label>
            <select
              value={bitrate}
              onChange={(e) => setBitrate(e.target.value as any)}
              disabled={format === 'wav'}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white disabled:opacity-50"
            >
              <option value="320">320 kbps (Maximum High-Res)</option>
              <option value="192">192 kbps (Standard HQ)</option>
              <option value="128">128 kbps (Compact Web)</option>
            </select>
          </div>
        </div>

        {/* File Name */}
        <div>
          <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
            File Name
          </label>
          <div className="flex items-center">
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-l-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
            />
            <span className="bg-zinc-800 border border-l-0 border-zinc-800 px-3 py-2 text-xs text-zinc-400 font-mono rounded-r-xl">
              .{format}
            </span>
          </div>
        </div>

        {/* Estimated Stats */}
        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span>Est. File Size: ~{estimatedSizeMb} MB</span>
          <span>Duration: ~{audioBuffer.duration.toFixed(1)}s</span>
        </div>

        {/* Download Action Button */}
        <button
          onClick={handleDownload}
          disabled={isExporting}
          className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
            isExporting
              ? 'bg-zinc-800 text-zinc-400 cursor-wait'
              : exportSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-amber-500/20 active:scale-[0.99]'
          }`}
        >
          {isExporting ? (
            <>
              <AudioWaveform className="w-4 h-4 animate-spin text-amber-300" />
              <span>Rendering Lossless Audio...</span>
            </>
          ) : exportSuccess ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>Downloaded Successfully!</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 text-white" />
              <span>Download High-Quality .{format.toUpperCase()}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
