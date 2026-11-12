/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Play,
  Pause,
  RotateCcw,
  Square,
  Globe,
  Layers,
  Shield,
  Zap,
  Clock,
  HardDrive,
  FileVideo,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Sliders,
  Sparkles,
  RefreshCw,
  FolderDown,
  Check,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { StreamPlayerModal } from './components/StreamPlayerModal';
import { SegmentInspector } from './components/SegmentInspector';
import { VariantSelector } from './components/VariantSelector';
import { SettingsModal } from './components/SettingsModal';
import { DownloadHistoryModal } from './components/DownloadHistoryModal';
import { HelpModal } from './components/HelpModal';
import { DemoStreams } from './components/DemoStreams';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  M3U8Segment,
  M3U8Variant,
  ParsedPlaylist,
  DownloadSettings,
  DownloadProgress,
  DownloadHistoryItem,
} from './types/m3u8';
import { fetchSegmentData, formatBytes, formatTime } from './utils/m3u8Engine';

const DEFAULT_SETTINGS: DownloadSettings = {
  concurrency: 6,
  maxRetries: 3,
  timeoutMs: 25000,
  useProxy: true,
  customReferer: '',
  customUserAgent: '',
  customCookie: '',
  customAuth: '',
  outputFormat: 'ts',
  filenameTemplate: 'video_{timestamp}.ts',
};

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export default function App() {
  const isOnline = useOnlineStatus();

  // Input states
  const [streamUrl, setStreamUrl] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Settings & History
  const [settings, setSettings] = useState<DownloadSettings>(() => {
    const saved = localStorage.getItem('m3u8_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [history, setHistory] = useState<DownloadHistoryItem[]>(() => {
    const saved = localStorage.getItem('m3u8_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Current parsed playlist state
  const [playlist, setPlaylist] = useState<ParsedPlaylist | null>(null);
  const [selectedVariantUrl, setSelectedVariantUrl] = useState<string | null>(null);

  // Active Download Progress State
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    taskId: '',
    url: '',
    filename: '',
    totalSegments: 0,
    completedSegments: 0,
    failedSegments: 0,
    totalBytes: 0,
    currentSpeedBytesSec: 0,
    elapsedSeconds: 0,
    etaSeconds: 0,
    state: 'idle',
    segments: [],
  });

  // Modals state
  const [playerModal, setPlayerModal] = useState<{ open: boolean; url: string; title: string }>({
    open: false,
    url: '',
    title: '',
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'inspector' | 'logs'>('inspector');

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Engine refs to coordinate abort and chunk storage across turns
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef<boolean>(false);
  const downloadedChunksRef = useRef<Map<number, Uint8Array>>(new Map());
  const timerRef = useRef<any>(null);
  const speedBytesRef = useRef<number>(0);
  const speedTimestampRef = useRef<number>(Date.now());

  // Save settings when changed
  useEffect(() => {
    localStorage.setItem('m3u8_settings', JSON.stringify(settings));
  }, [settings]);

  // Save history when changed
  useEffect(() => {
    localStorage.setItem('m3u8_history', JSON.stringify(history));
  }, [history]);

  const addLog = (message: string, level: LogEntry['level'] = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    setLogs((prev) => [...prev.slice(-300), newLog]);
  };

  // Scroll logs to bottom
  useEffect(() => {
    if (activeTab === 'logs' && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, activeTab]);

  // Parse M3U8 URL
  const handleParseUrl = async (targetUrlToParse?: string) => {
    const url = targetUrlToParse || streamUrl.trim();
    if (!url) {
      setParseError('Please enter a valid M3U8 stream URL.');
      return;
    }

    setParseError(null);
    setIsParsing(true);
    addLog(`Fetching playlist from: ${url}`);

    try {
      let endpoint = '/api/parse-m3u8';
      let payload = {
        url,
        headers: {
          'User-Agent': settings.customUserAgent || undefined,
          Referer: settings.customReferer || undefined,
          Cookie: settings.customCookie || undefined,
          Authorization: settings.customAuth || undefined,
        },
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to parse playlist`);
      }

      const data: ParsedPlaylist = await res.json();
      data.url = url;
      setPlaylist(data);

      if (data.type === 'master') {
        addLog(`Master playlist parsed. Found ${data.variants?.length || 0} stream qualities.`, 'success');
        if (data.variants && data.variants.length > 0) {
          // Auto select highest resolution / bitrate variant
          setSelectedVariantUrl(data.variants[0].uri);
        }
      } else {
        addLog(`Media playlist parsed. ${data.segmentCount} segments, duration: ${formatTime(data.totalDuration || 0)}`, 'success');
        if (data.hasEncryption) {
          addLog('Stream is AES-128 encrypted. Hardware-accelerated decryption enabled.', 'warn');
        }

        // Initialize progress segments
        setDownloadProgress((prev) => ({
          ...prev,
          url,
          filename: generateFilename(url),
          totalSegments: data.segments?.length || 0,
          completedSegments: 0,
          failedSegments: 0,
          totalBytes: 0,
          state: 'idle',
          segments: (data.segments || []).map((s) => ({ ...s, status: 'pending' })),
        }));
      }
    } catch (err: any) {
      console.error(err);
      setParseError(err.message || 'Failed to load M3U8 stream');
      addLog(`Error parsing playlist: ${err.message}`, 'error');
    } finally {
      setIsParsing(false);
    }
  };

  // Helper to generate a clean filename
  const generateFilename = (url: string) => {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const lastPart = pathname.substring(pathname.lastIndexOf('/') + 1) || 'stream';
      const cleanName = lastPart.replace(/\.m3u8$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      return `${cleanName}_${Date.now()}.ts`;
    } catch {
      return `video_${Date.now()}.ts`;
    }
  };

  // Select Master Playlist Variant
  const handleSelectVariant = async (variantUrl: string) => {
    setSelectedVariantUrl(variantUrl);
    setStreamUrl(variantUrl);
    await handleParseUrl(variantUrl);
  };

  // Start / Resume Parallel Download
  const handleStartDownload = async () => {
    if (!playlist || !playlist.segments || playlist.segments.length === 0) {
      addLog('No segments loaded to download.', 'error');
      return;
    }

    const segments = [...(downloadProgress.segments.length > 0 ? downloadProgress.segments : playlist.segments)];
    isPausedRef.current = false;
    abortControllerRef.current = new AbortController();

    addLog(`Initiating parallel download with ${settings.concurrency} worker threads...`, 'info');

    setDownloadProgress((prev) => ({
      ...prev,
      state: 'downloading',
      totalSegments: segments.length,
      filename: prev.filename || generateFilename(playlist.url),
    }));

    // Setup speed timer
    speedTimestampRef.current = Date.now();
    speedBytesRef.current = 0;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev.state !== 'downloading') return prev;
        const now = Date.now();
        const deltaSec = (now - speedTimestampRef.current) / 1000;
        const speed = deltaSec > 0 ? speedBytesRef.current / deltaSec : 0;

        // Reset speed measurement window
        speedBytesRef.current = 0;
        speedTimestampRef.current = now;

        const remainingSegments = prev.totalSegments - prev.completedSegments;
        const avgSegmentBytes = prev.completedSegments > 0 ? prev.totalBytes / prev.completedSegments : 500000;
        const remainingBytes = remainingSegments * avgSegmentBytes;
        const eta = speed > 0 ? Math.round(remainingBytes / speed) : 0;

        return {
          ...prev,
          currentSpeedBytesSec: speed,
          elapsedSeconds: prev.elapsedSeconds + 1,
          etaSeconds: eta,
        };
      });
    }, 1000);

    // Parallel Worker Pool
    const queue = segments
      .map((seg, idx) => ({ ...seg, index: idx }))
      .filter((seg) => !downloadedChunksRef.current.has(seg.index));

    const totalToDownload = queue.length;
    let completedCount = downloadedChunksRef.current.size;
    let totalBytesSum = downloadProgress.totalBytes;

    const worker = async () => {
      while (queue.length > 0 && !isPausedRef.current) {
        const segment = queue.shift();
        if (!segment) break;

        // Mark segment as downloading
        setDownloadProgress((prev) => ({
          ...prev,
          segments: prev.segments.map((s) => (s.index === segment.index ? { ...s, status: 'downloading' } : s)),
        }));

        let attempt = 0;
        let success = false;
        let chunkBytes: Uint8Array | null = null;
        let lastError = '';

        while (attempt < settings.maxRetries && !success && !isPausedRef.current) {
          attempt++;
          try {
            chunkBytes = await fetchSegmentData(segment, settings, abortControllerRef.current?.signal || new AbortController().signal);
            success = true;
          } catch (err: any) {
            lastError = err.message || 'Fetch failed';
            if (err.name === 'AbortError') {
              return; // Stopped
            }
            if (attempt < settings.maxRetries) {
              await new Promise((r) => setTimeout(r, 800 * attempt)); // Exponential backoff
            }
          }
        }

        if (success && chunkBytes) {
          downloadedChunksRef.current.set(segment.index, chunkBytes);
          completedCount++;
          totalBytesSum += chunkBytes.length;
          speedBytesRef.current += chunkBytes.length;

          setDownloadProgress((prev) => ({
            ...prev,
            completedSegments: completedCount,
            totalBytes: totalBytesSum,
            segments: prev.segments.map((s) =>
              s.index === segment.index ? { ...s, status: 'completed', sizeBytes: chunkBytes?.length } : s
            ),
          }));
        } else {
          setDownloadProgress((prev) => ({
            ...prev,
            failedSegments: prev.failedSegments + 1,
            segments: prev.segments.map((s) =>
              s.index === segment.index ? { ...s, status: 'failed', error: lastError } : s
            ),
          }));
          addLog(`Failed segment #${segment.index + 1}: ${lastError}`, 'warn');
        }
      }
    };

    // Spawn concurrent workers
    const workers = Array.from({ length: settings.concurrency }, () => worker());
    await Promise.all(workers);

    if (isPausedRef.current) {
      addLog('Download paused by user.', 'warn');
      return;
    }

    if (downloadedChunksRef.current.size === segments.length) {
      clearInterval(timerRef.current);
      addLog(`All ${segments.length} segments downloaded successfully! Concatenating video...`, 'success');
      handleMergeAndSave();
    } else {
      setDownloadProgress((prev) => ({
        ...prev,
        state: 'error',
        errorMessage: 'Some segments failed to download. You can retry them using the inspector.',
      }));
    }
  };

  // Pause download
  const handlePauseDownload = () => {
    isPausedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    clearInterval(timerRef.current);
    setDownloadProgress((prev) => ({
      ...prev,
      state: 'paused',
      currentSpeedBytesSec: 0,
    }));
    addLog('Download paused. Existing completed chunks preserved in memory.', 'info');
  };

  // Cancel / Reset download
  const handleCancelDownload = () => {
    isPausedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    clearInterval(timerRef.current);
    downloadedChunksRef.current.clear();

    setDownloadProgress((prev) => ({
      ...prev,
      state: 'idle',
      completedSegments: 0,
      failedSegments: 0,
      totalBytes: 0,
      currentSpeedBytesSec: 0,
      elapsedSeconds: 0,
      etaSeconds: 0,
      segments: prev.segments.map((s) => ({ ...s, status: 'pending' })),
    }));
    addLog('Download cancelled and reset.', 'info');
  };

  // Merge and trigger direct browser save
  const handleMergeAndSave = () => {
    setDownloadProgress((prev) => ({ ...prev, state: 'merging' }));
    addLog('Joining TS chunks into cohesive MPEG-TS video file...', 'info');

    try {
      const segmentsCount = downloadProgress.segments.length;
      let totalLength = 0;

      for (let i = 0; i < segmentsCount; i++) {
        const chunk = downloadedChunksRef.current.get(i);
        if (chunk) {
          totalLength += chunk.length;
        }
      }

      const mergedArray = new Uint8Array(totalLength);
      let offset = 0;
      for (let i = 0; i < segmentsCount; i++) {
        const chunk = downloadedChunksRef.current.get(i);
        if (chunk) {
          mergedArray.set(chunk, offset);
          offset += chunk.length;
        }
      }

      const blob = new Blob([mergedArray.buffer as ArrayBuffer], { type: 'video/mp2t' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = downloadProgress.filename || 'stream_video.ts';
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);

      setDownloadProgress((prev) => ({ ...prev, state: 'completed' }));
      addLog(`File "${filename}" saved successfully (${formatBytes(totalLength)})!`, 'success');

      // Record to history
      const historyItem: DownloadHistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        url: playlist?.url || streamUrl,
        filename,
        totalSegments: segmentsCount,
        totalBytes: totalLength,
        durationSeconds: playlist?.totalDuration || 0,
        completedAt: new Date().toISOString(),
      };
      setHistory((prev) => [historyItem, ...prev.slice(0, 49)]);
    } catch (err: any) {
      addLog(`Failed to merge video: ${err.message}`, 'error');
      setDownloadProgress((prev) => ({
        ...prev,
        state: 'error',
        errorMessage: `Merge failed: ${err.message}`,
      }));
    }
  };

  // Download a single segment directly
  const handleDownloadSingleSegment = async (segment: M3U8Segment) => {
    try {
      addLog(`Downloading single segment #${segment.index + 1}...`);
      const bytes = await fetchSegmentData(segment, settings, new AbortSignal());
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'video/mp2t' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `segment_${segment.index + 1}.ts`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog(`Segment #${segment.index + 1} downloaded successfully!`, 'success');
    } catch (err: any) {
      addLog(`Failed to download segment #${segment.index + 1}: ${err.message}`, 'error');
    }
  };

  // Retry an individual segment
  const handleRetrySegment = async (segmentIndex: number) => {
    const segment = downloadProgress.segments.find((s) => s.index === segmentIndex);
    if (!segment) return;

    setDownloadProgress((prev) => ({
      ...prev,
      segments: prev.segments.map((s) => (s.index === segmentIndex ? { ...s, status: 'downloading', error: undefined } : s)),
    }));

    try {
      const bytes = await fetchSegmentData(segment, settings, new AbortSignal());
      downloadedChunksRef.current.set(segmentIndex, bytes);
      setDownloadProgress((prev) => ({
        ...prev,
        completedSegments: downloadedChunksRef.current.size,
        segments: prev.segments.map((s) => (s.index === segmentIndex ? { ...s, status: 'completed', sizeBytes: bytes.length } : s)),
      }));
      addLog(`Segment #${segmentIndex + 1} retry succeeded!`, 'success');
    } catch (err: any) {
      setDownloadProgress((prev) => ({
        ...prev,
        segments: prev.segments.map((s) => (s.index === segmentIndex ? { ...s, status: 'failed', error: err.message } : s)),
      }));
      addLog(`Segment #${segmentIndex + 1} retry failed: ${err.message}`, 'error');
    }
  };

  // Retry all failed segments
  const handleRetryAllFailed = () => {
    const failedIndices = downloadProgress.segments.filter((s) => s.status === 'failed').map((s) => s.index);
    if (failedIndices.length === 0) return;
    addLog(`Retrying ${failedIndices.length} failed segments...`, 'info');
    handleStartDownload();
  };

  const progressPercent =
    downloadProgress.totalSegments > 0
      ? Math.round((downloadProgress.completedSegments / downloadProgress.totalSegments) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Offline Mode Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-slate-950 font-bold px-4 py-2 text-center text-xs flex items-center justify-center gap-2 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
          <span>You are currently offline. Cached PWA assets are active. Live streaming and remote segment fetching require an internet connection.</span>
        </div>
      )}

      {/* Header with PWA install button */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        activeDownloadsCount={downloadProgress.state === 'downloading' ? 1 : 0}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero Section & Stream Input */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 p-6 sm:p-10 shadow-2xl">
          <div className="absolute top-0 right-1/4 -mt-16 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

          <div className="max-w-3xl space-y-3 mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Multi-Threaded HLS Stream Downloader & Decryptor</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Download, Inspect, and Decrypt <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-indigo-200">
                Any M3U8 Video Stream
              </span>
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Based on the robust architecture of <code className="text-indigo-300 font-mono">sylecn/m3u8downloader</code>. Inspect video chunks, decrypt AES-128 keys in real-time, preview before downloading, and merge seamlessly on your device.
            </p>
          </div>

          {/* URL Input Form */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800 shadow-inner focus-within:border-indigo-500/80 transition-all">
              <div className="flex items-center gap-2 pl-3 flex-1 min-w-0">
                <Globe className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                <input
                  type="url"
                  placeholder="Paste M3U8 stream URL (e.g. https://.../playlist.m3u8)"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleParseUrl()}
                  className="w-full bg-transparent py-2.5 text-sm sm:text-base text-white placeholder:text-slate-600 focus:outline-none"
                />
                {streamUrl && (
                  <button
                    onClick={() => setStreamUrl('')}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
                    title="Clear URL"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleParseUrl()}
                  disabled={isParsing || !streamUrl.trim()}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition active:scale-95"
                >
                  {isParsing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Parsing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Parse & Inspect</span>
                    </>
                  )}
                </button>

                {streamUrl && (
                  <button
                    onClick={() => setPlayerModal({ open: true, url: streamUrl, title: 'Stream Preview' })}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                    title="Live stream preview player"
                  >
                    <Play className="w-4 h-4 text-emerald-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick option toggles below bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 px-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer hover:text-slate-200 transition">
                  <input
                    type="checkbox"
                    checked={settings.useProxy}
                    onChange={(e) => setSettings({ ...settings, useProxy: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                  />
                  <span>Bypass CORS via Proxy</span>
                </label>

                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="hover:text-indigo-400 transition flex items-center gap-1"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Workers: {settings.concurrency} • Retries: {settings.maxRetries}</span>
                </button>
              </div>

              <div className="text-slate-500">
                Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">Enter</kbd> to analyze
              </div>
            </div>

            {parseError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        </section>

        {/* 1-Click Demo Streams */}
        {!playlist && (
          <DemoStreams
            onSelectStream={(url) => {
              setStreamUrl(url);
              handleParseUrl(url);
            }}
            onPreviewStream={(url, title) => setPlayerModal({ open: true, url, title })}
          />
        )}

        {/* Master Playlist Variant Selector */}
        {playlist && playlist.type === 'master' && playlist.variants && (
          <VariantSelector
            variants={playlist.variants}
            selectedVariantUrl={selectedVariantUrl}
            onSelectVariant={handleSelectVariant}
            onPreviewVariant={(url, title) => setPlayerModal({ open: true, url, title })}
          />
        )}

        {/* Media Playlist Dashboard */}
        {playlist && playlist.type === 'media' && (
          <div className="space-y-6">
            {/* Stream Overview Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold uppercase tracking-wider">
                      {playlist.isLive ? 'Live Stream' : 'VOD Ready'}
                    </span>
                    {playlist.hasEncryption && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span>AES-128 Encrypted</span>
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-white text-lg tracking-tight">Stream Analysis Completed</h3>
                  <p className="text-xs text-slate-400 truncate max-w-xl font-mono">{playlist.url}</p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={() => setPlayerModal({ open: true, url: playlist.url, title: 'Video Stream Preview' })}
                    className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Live Preview</span>
                  </button>

                  {downloadProgress.state === 'downloading' ? (
                    <button
                      onClick={handlePauseDownload}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition shadow-md shadow-amber-600/20"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStartDownload}
                      disabled={downloadProgress.state === 'merging'}
                      className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30"
                    >
                      <Download className="w-4 h-4" />
                      <span>{downloadProgress.completedSegments > 0 ? 'Resume Download' : 'Start Download'}</span>
                    </button>
                  )}

                  {downloadProgress.state !== 'idle' && (
                    <button
                      onClick={handleCancelDownload}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition"
                      title="Cancel & Reset Download"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Stream Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">Total Segments</span>
                  <span className="text-lg font-bold text-white font-mono">{playlist.segmentCount || 0}</span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">Total Duration</span>
                  <span className="text-lg font-bold text-white font-mono">
                    {formatTime(playlist.totalDuration || 0)}
                  </span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">Target Segment Time</span>
                  <span className="text-lg font-bold text-white font-mono">~{playlist.targetDuration}s</span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block mb-1">Workers Configured</span>
                  <span className="text-lg font-bold text-indigo-400 font-mono">{settings.concurrency} parallel</span>
                </div>
              </div>

              {/* Real-time Progress Bar & Speed Section */}
              {downloadProgress.state !== 'idle' && (
                <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-white flex items-center gap-2">
                      <span className="capitalize font-bold text-indigo-400">{downloadProgress.state}...</span>
                      <span className="text-slate-400">
                        ({downloadProgress.completedSegments} / {downloadProgress.totalSegments} segments)
                      </span>
                    </span>
                    <span className="font-mono text-indigo-300 font-bold text-sm">{progressPercent}%</span>
                  </div>

                  {/* Progress track */}
                  <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 rounded-full transition-all duration-300 shadow-sm"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Speed & ETA stats */}
                  <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 pt-1 font-mono">
                    <div className="flex items-center gap-4">
                      <span>Speed: <strong className="text-white">{formatBytes(downloadProgress.currentSpeedBytesSec)}/s</strong></span>
                      <span>Downloaded: <strong className="text-white">{formatBytes(downloadProgress.totalBytes)}</strong></span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span>Elapsed: <strong className="text-slate-200">{formatTime(downloadProgress.elapsedSeconds)}</strong></span>
                      {downloadProgress.etaSeconds > 0 && downloadProgress.state === 'downloading' && (
                        <span>ETA: <strong className="text-emerald-400">{formatTime(downloadProgress.etaSeconds)}</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Merged File Download Ready Card */}
                  {downloadProgress.state === 'completed' && (
                    <div className="mt-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-4 animate-in fade-in">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                        <div>
                          <h4 className="font-bold text-white text-sm">Download & Merge Complete!</h4>
                          <p className="text-xs text-emerald-300">Video saved as {downloadProgress.filename}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleMergeAndSave}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-2"
                      >
                        <FolderDown className="w-4 h-4" />
                        <span>Save Again</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Segment Inspector & Live Logs Tabs */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setActiveTab('inspector')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'inspector'
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Segment Matrix & Inspector</span>
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                    activeTab === 'logs'
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  <span>Live Engine Logs</span>
                  {logs.length > 0 && (
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full font-mono">
                      {logs.length}
                    </span>
                  )}
                </button>
              </div>

              {activeTab === 'inspector' ? (
                <SegmentInspector
                  segments={downloadProgress.segments.length > 0 ? downloadProgress.segments : playlist.segments || []}
                  onRetrySegment={handleRetrySegment}
                  onDownloadSingleSegment={handleDownloadSingleSegment}
                  onRetryAllFailed={handleRetryAllFailed}
                />
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800 text-[11px]">
                    <span>Real-time Download Stream Console</span>
                    <button
                      onClick={() => setLogs([])}
                      className="text-slate-500 hover:text-slate-300 transition"
                    >
                      Clear Logs
                    </button>
                  </div>
                  <div ref={logContainerRef} className="h-64 overflow-y-auto space-y-1.5 p-2 bg-slate-950 rounded-lg">
                    {logs.map((log) => {
                      let color = 'text-slate-300';
                      if (log.level === 'success') color = 'text-emerald-400';
                      else if (log.level === 'warn') color = 'text-amber-400';
                      else if (log.level === 'error') color = 'text-rose-400';

                      return (
                        <div key={log.id} className="leading-relaxed">
                          <span className="text-slate-500">[{log.timestamp}]</span>{' '}
                          <span className={color}>{log.message}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER WITH PROMINENT PWA INSTALL SECTION */}
      <Footer />

      {/* Modals */}
      {playerModal.open && (
        <StreamPlayerModal
          url={playerModal.url}
          title={playerModal.title}
          onClose={() => setPlayerModal({ open: false, url: '', title: '' })}
          onDownloadStream={(url) => {
            setStreamUrl(url);
            handleParseUrl(url);
          }}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={(newSettings) => {
            setSettings(newSettings);
            addLog(`Settings updated: Concurrency=${newSettings.concurrency}, Retries=${newSettings.maxRetries}`, 'info');
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isHistoryOpen && (
        <DownloadHistoryModal
          history={history}
          onClearHistory={() => setHistory([])}
          onLoadUrl={(url) => {
            setStreamUrl(url);
            handleParseUrl(url);
          }}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}
    </div>
  );
}
