import React from 'react';
import { DownloadHistoryItem } from '../types/m3u8';
import { formatBytes, formatTime } from '../utils/m3u8Engine';
import { X, History, Trash2, ExternalLink, Download, FileVideo, Clock, Layers } from 'lucide-react';

interface DownloadHistoryModalProps {
  history: DownloadHistoryItem[];
  onClearHistory: () => void;
  onLoadUrl: (url: string) => void;
  onClose: () => void;
}

export const DownloadHistoryModal: React.FC<DownloadHistoryModalProps> = ({
  history,
  onClearHistory,
  onLoadUrl,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Download History</h3>
              <p className="text-xs text-slate-400">Past downloaded stream sessions and logs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-300 text-xs font-medium transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="p-6 overflow-y-auto space-y-3">
          {history.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-3">
              <FileVideo className="w-12 h-12 mx-auto text-slate-600 opacity-60" />
              <p className="text-sm">No download history yet.</p>
              <p className="text-xs text-slate-500">Your completed stream downloads will be recorded here.</p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-700 transition"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm truncate">{item.filename}</span>
                    {item.resolution && (
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                        {item.resolution}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate max-w-lg font-mono">{item.url}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                    <span>{item.totalSegments} segments</span>
                    <span>•</span>
                    <span>{formatBytes(item.totalBytes)}</span>
                    {item.durationSeconds > 0 && (
                      <>
                        <span>•</span>
                        <span>{formatTime(item.durationSeconds)}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{new Date(item.completedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      onLoadUrl(item.url);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold transition"
                  >
                    <span>Load URL</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
