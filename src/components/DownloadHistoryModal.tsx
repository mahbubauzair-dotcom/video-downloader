import React from 'react';
import { DownloadHistoryItem, QueueItem } from '../types/m3u8';
import { formatBytes, formatTime } from '../utils/m3u8Engine';
import {
  X,
  History,
  Trash2,
  ExternalLink,
  FileVideo,
  Cloud,
  Play,
  Pause,
  RotateCcw,
  ListOrdered,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
} from 'lucide-react';

interface DownloadHistoryModalProps {
  history: DownloadHistoryItem[];
  queue: QueueItem[];
  isQueueRunning: boolean;
  onStartQueue: () => void;
  onPauseQueue: () => void;
  onRetryQueueItem: (id: string) => void;
  onRemoveQueueItem: (id: string) => void;
  onClearFinishedQueue: () => void;
  onClearHistory: () => void;
  onLoadUrl: (url: string) => void;
  onClose: () => void;
}

const STATUS_BADGE_MAP: Record<
  QueueItem['status'],
  { label: string; classes: string }
> = {
  queued: {
    label: 'Queued',
    classes: 'bg-slate-800 text-slate-300 border-slate-700',
  },
  parsing: {
    label: 'Parsing Playlist',
    classes: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  },
  downloading: {
    label: 'Downloading',
    classes: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  merging: {
    label: 'Merging Chunks',
    classes: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  },
  uploading: {
    label: 'Uploading to Drive',
    classes: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  completed: {
    label: 'Completed',
    classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  paused: {
    label: 'Paused',
    classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  failed: {
    label: 'Failed',
    classes: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
};

export const DownloadHistoryModal: React.FC<DownloadHistoryModalProps> = ({
  history,
  queue,
  isQueueRunning,
  onStartQueue,
  onPauseQueue,
  onRetryQueueItem,
  onRemoveQueueItem,
  onClearFinishedQueue,
  onClearHistory,
  onLoadUrl,
  onClose,
}) => {
  const pendingCount = queue.filter((q) => q.status === 'queued' || q.status === 'paused').length;
  const activeItem = queue.find(
    (q) =>
      q.status === 'parsing' ||
      q.status === 'downloading' ||
      q.status === 'merging' ||
      q.status === 'uploading'
  );
  const finishedInQueueCount = queue.filter(
    (q) => q.status === 'completed' || q.status === 'failed'
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Download Queue & History</h3>
              <p className="text-xs text-slate-400">
                Sequential batch queue progress and completed stream downloads
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-8">
          {/* SECTION 1: SEQUENTIAL DOWNLOAD QUEUE */}
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-indigo-400" />
                <h4 className="font-bold text-white text-sm">
                  Batch Queue ({queue.length})
                </h4>
                {activeItem && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Processing</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isQueueRunning ? (
                  <button
                    onClick={onPauseQueue}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause Queue</span>
                  </button>
                ) : (
                  pendingCount > 0 && (
                    <button
                      onClick={onStartQueue}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-md shadow-indigo-600/20"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Queue ({pendingCount})</span>
                    </button>
                  )
                )}

                {finishedInQueueCount > 0 && (
                  <button
                    onClick={onClearFinishedQueue}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Finished</span>
                  </button>
                )}
              </div>
            </div>

            {queue.length === 0 ? (
              <div className="bg-slate-950/50 border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
                No URLs in the batch queue. Use <strong>Add to Queue</strong> or{' '}
                <strong>Batch Add URLs</strong> on the main screen to process multiple M3U8 streams sequentially.
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((item, idx) => {
                  const badge = STATUS_BADGE_MAP[item.status];
                  const isActive =
                    item.status === 'parsing' ||
                    item.status === 'downloading' ||
                    item.status === 'merging' ||
                    item.status === 'uploading';
                  const barPct =
                    item.status === 'uploading'
                      ? item.uploadProgressPercent ?? 0
                      : item.status === 'completed'
                      ? 100
                      : item.progressPercent;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 space-y-3 transition ${
                        isActive
                          ? 'bg-indigo-950/25 border-indigo-500/50 shadow-lg shadow-indigo-500/5'
                          : 'bg-slate-950/70 border-slate-800'
                      }`}
                    >
                      {/* Top Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-white text-sm truncate max-w-xs sm:max-w-sm">
                              {item.filename}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${badge.classes}`}
                            >
                              {isActive && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                              {item.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5" />}
                              {item.status === 'failed' && <AlertCircle className="w-2.5 h-2.5" />}
                              {item.status === 'queued' && <Clock className="w-2.5 h-2.5" />}
                              <span>{badge.label}</span>
                            </span>
                            {item.resolution && (
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                                {item.resolution}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate font-mono">{item.url}</p>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {item.driveFileLink && (
                            <a
                              href={item.driveFileLink}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 text-xs font-semibold transition"
                            >
                              <Cloud className="w-3.5 h-3.5" />
                              <span>Drive</span>
                            </a>
                          )}
                          {(item.status === 'failed' || item.status === 'paused') && (
                            <button
                              onClick={() => onRetryQueueItem(item.id)}
                              className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 transition"
                              title="Retry item in queue"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isActive && (
                            <button
                              onClick={() => onRemoveQueueItem(item.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 transition"
                              title="Remove from queue"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar & Live Stats */}
                      <div className="space-y-1.5">
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full transition-all duration-300 ${
                              item.status === 'completed'
                                ? 'bg-emerald-500'
                                : item.status === 'failed'
                                ? 'bg-rose-500'
                                : item.status === 'uploading'
                                ? 'bg-gradient-to-r from-sky-500 to-indigo-400'
                                : 'bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400'
                            }`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                          <div className="flex items-center gap-3">
                            <span>
                              {item.totalSegments > 0
                                ? `${item.completedSegments}/${item.totalSegments} segments`
                                : 'Awaiting parse'}
                            </span>
                            {item.totalBytes > 0 && <span>• {formatBytes(item.totalBytes)}</span>}
                            {item.status === 'downloading' && item.speedBytesSec > 0 && (
                              <span className="text-sky-300">
                                • {formatBytes(item.speedBytesSec)}/s
                              </span>
                            )}
                            {item.status === 'uploading' && (
                              <span className="text-sky-300">
                                • Uploading {item.uploadProgressPercent ?? 0}%
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-slate-200">{barPct}%</span>
                        </div>
                      </div>

                      {item.errorMessage && (
                        <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                          {item.errorMessage}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* SECTION 2: COMPLETED DOWNLOAD HISTORY */}
          <section className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                <h4 className="font-bold text-white text-sm">
                  Completed History ({history.length})
                </h4>
              </div>
              {history.length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-300 text-xs font-medium transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <FileVideo className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                <p className="text-xs">No completed downloads recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-slate-700 transition"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm truncate">
                          {item.filename}
                        </span>
                        {item.destination === 'gdrive' && (
                          <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                            <Cloud className="w-3 h-3" />
                            <span>{item.driveFolderName || 'Google Drive'}</span>
                          </span>
                        )}
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
                      {item.driveFileLink && (
                        <a
                          href={item.driveFileLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 text-xs font-semibold transition"
                        >
                          <Cloud className="w-3.5 h-3.5" />
                          <span>Open in Drive</span>
                        </a>
                      )}
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
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
