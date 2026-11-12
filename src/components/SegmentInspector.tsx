import React, { useState } from 'react';
import { M3U8Segment } from '../types/m3u8';
import { formatBytes, formatTime } from '../utils/m3u8Engine';
import { Search, Filter, RotateCcw, Download, Copy, Check, Shield, FileText, ChevronRight } from 'lucide-react';

interface SegmentInspectorProps {
  segments: M3U8Segment[];
  onRetrySegment?: (segmentIndex: number) => void;
  onDownloadSingleSegment?: (segment: M3U8Segment) => void;
  onRetryAllFailed?: () => void;
}

export const SegmentInspector: React.FC<SegmentInspectorProps> = ({
  segments,
  onRetrySegment,
  onDownloadSingleSegment,
  onRetryAllFailed,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'downloading' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<M3U8Segment | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const filteredSegments = segments.filter((seg) => {
    if (filterStatus !== 'all' && (seg.status || 'pending') !== filterStatus) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        seg.index.toString().includes(q) ||
        seg.uri.toLowerCase().includes(q) ||
        seg.title.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const failedCount = segments.filter((s) => s.status === 'failed').length;
  const completedCount = segments.filter((s) => s.status === 'completed').length;
  const downloadingCount = segments.filter((s) => s.status === 'downloading').length;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search segments by # index or URI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filterStatus === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({segments.length})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filterStatus === 'completed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Done ({completedCount})
            </button>
            <button
              onClick={() => setFilterStatus('downloading')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filterStatus === 'downloading' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Active ({downloadingCount})
            </button>
            <button
              onClick={() => setFilterStatus('failed')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filterStatus === 'failed' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Failed ({failedCount})
            </button>
          </div>

          {failedCount > 0 && onRetryAllFailed && (
            <button
              onClick={onRetryAllFailed}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry {failedCount} Failed</span>
            </button>
          )}
        </div>
      </div>

      {/* Visual Chunk Grid */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
          <span className="font-semibold text-slate-200">Segment Grid Matrix</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-700"></span> Pending</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 animate-pulse"></span> Downloading</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Completed</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span> Failed</span>
          </div>
        </div>

        {/* The Matrix */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(28px,1fr))] gap-1.5 max-h-60 overflow-y-auto p-2 bg-slate-950/70 rounded-lg border border-slate-800/80">
          {segments.map((seg) => {
            const status = seg.status || 'pending';
            let bgClass = 'bg-slate-800 text-slate-400 hover:bg-slate-700';
            if (status === 'completed') bgClass = 'bg-emerald-600/90 text-white hover:bg-emerald-500';
            else if (status === 'downloading') bgClass = 'bg-amber-500 text-slate-950 font-bold animate-pulse hover:bg-amber-400';
            else if (status === 'failed') bgClass = 'bg-rose-600 text-white hover:bg-rose-500';

            const isSelected = selectedSegment?.index === seg.index;

            return (
              <button
                key={seg.index}
                onClick={() => setSelectedSegment(seg)}
                className={`h-7 rounded-sm text-[10px] font-mono flex items-center justify-center transition-all ${bgClass} ${
                  isSelected ? 'ring-2 ring-indigo-400 scale-105 z-10' : ''
                }`}
                title={`Segment #${seg.index + 1} (${seg.duration.toFixed(1)}s) - ${status}`}
              >
                {seg.index + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Segment Inspector Drawer/Card */}
      {selectedSegment && (
        <div className="bg-slate-900 border border-indigo-500/40 rounded-xl p-4 shadow-xl animate-in fade-in duration-150">
          <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-mono font-bold text-sm">
                #{selectedSegment.index + 1}
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">
                  Segment Details <span className="text-slate-400 font-normal">({formatTime(selectedSegment.duration)})</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Status: <span className="capitalize font-semibold text-indigo-300">{selectedSegment.status || 'pending'}</span>
                  {selectedSegment.sizeBytes ? ` • ${formatBytes(selectedSegment.sizeBytes)}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onRetrySegment && (
                <button
                  onClick={() => onRetrySegment(selectedSegment.index)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
                  title="Retry downloading this segment"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
              {onDownloadSingleSegment && (
                <button
                  onClick={() => onDownloadSingleSegment(selectedSegment)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                  title="Download this single .ts chunk directly"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .ts</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400">Target Segment URI:</span>
              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                <span className="font-mono text-slate-300 truncate text-[11px] flex-1">{selectedSegment.uri}</span>
                <button
                  onClick={() => copyToClipboard(selectedSegment.uri)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Copy URL"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {selectedSegment.key ? (
              <div className="space-y-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Encryption: {selectedSegment.key.method}</span>
                </span>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 truncate">
                  Key: {selectedSegment.key.uri}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="text-slate-400">Encryption:</span>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                  None (Clear unencrypted MPEG-TS)
                </div>
              </div>
            )}
          </div>

          {selectedSegment.error && (
            <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <strong>Error:</strong> {selectedSegment.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
