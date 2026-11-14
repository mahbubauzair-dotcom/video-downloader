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
  Cloud,
  FolderOpen,
  ListPlus,
  ListOrdered,
  Plus,
  Loader2,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { StreamPlayerModal } from './components/StreamPlayerModal';
import { SegmentInspector } from './components/SegmentInspector';
import { VariantSelector } from './components/VariantSelector';
import { SettingsModal } from './components/SettingsModal';
import { DownloadHistoryModal } from './components/DownloadHistoryModal';
import { HelpModal } from './components/HelpModal';
import { DemoStreams } from './components/DemoStreams';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  M3U8Segment,
  M3U8Variant,
  ParsedPlaylist,
  DownloadSettings,
  DownloadProgress,
  DownloadHistoryItem,
  QueueItem,
} from './types/m3u8';
import { fetchSegmentData, formatBytes, formatTime } from './utils/m3u8Engine';
import { initAuth, googleSignIn, getAccessToken, logout } from './utils/googleAuth';
import {
  findOrCreateDriveFolder,
  verifyDriveFolderExists,
  uploadVideoToDrive,
} from './utils/googleDrive';

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
  downloadDestination: 'gdrive',
  alsoSaveLocally: false,
  googleDriveFolderId: '',
  googleDriveFolderName: 'M3U8 Downloads',
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
    if (!saved) return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(saved),
      downloadDestination: JSON.parse(saved).downloadDestination || 'gdrive',
      googleDriveFolderName: JSON.parse(saved).googleDriveFolderName || 'M3U8 Downloads',
    };
  });

  const [history, setHistory] = useState<DownloadHistoryItem[]>(() => {
    const saved = localStorage.getItem('m3u8_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Google Drive Auth State (access token stays strictly in memory)
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [isLoggingInDrive, setIsLoggingInDrive] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

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

  // Queue state & batch input
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [showBatchInput, setShowBatchInput] = useState(false);
  const [batchUrlsText, setBatchUrlsText] = useState('');

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Engine refs to coordinate abort, queue state, and chunk storage across async turns
  const abortControllerRef = useRef<AbortController | null>(null);
  const isPausedRef = useRef<boolean>(false);
  const downloadedChunksRef = useRef<Map<number, Uint8Array>>(new Map());
  const timerRef = useRef<any>(null);
  const speedBytesRef = useRef<number>(0);
  const speedTimestampRef = useRef<number>(Date.now());
  const queueRef = useRef<QueueItem[]>([]);
  const isQueueRunningRef = useRef<boolean>(false);
  const settingsRef = useRef<DownloadSettings>(settings);
  const driveTokenRef = useRef<string | null>(driveToken);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    driveTokenRef.current = driveToken;
  }, [driveToken]);

  // Save settings when changed
  useEffect(() => {
    localStorage.setItem('m3u8_settings', JSON.stringify(settings));
  }, [settings]);

  // Save history when changed
  useEffect(() => {
    localStorage.setItem('m3u8_history', JSON.stringify(history));
  }, [history]);

  // Listen to Firebase Auth state (clear in-memory token on sign-out)
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setDriveUser(user);
        setDriveToken(token);
      },
      (user) => {
        setDriveUser(user);
        setDriveToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleDriveSignIn = async (): Promise<string | null> => {
    setIsLoggingInDrive(true);
    try {
      const { user, accessToken } = await googleSignIn();
      setDriveUser(user);
      setDriveToken(accessToken);

      // Ensure default Google Drive folder exists
      const targetName = settings.googleDriveFolderName || 'M3U8 Downloads';
      let folder = settings.googleDriveFolderId
        ? await verifyDriveFolderExists(accessToken, settings.googleDriveFolderId)
        : null;
      if (!folder) {
        folder = await findOrCreateDriveFolder(accessToken, targetName);
      }

      setSettings((prev) => ({
        ...prev,
        downloadDestination: 'gdrive',
        googleDriveFolderId: folder!.id,
        googleDriveFolderName: folder!.name,
      }));
      addLog(`Connected Google Drive (${user.email}). Default folder: "${folder.name}"`, 'success');
      return accessToken;
    } catch (err: any) {
      addLog(`Google Drive sign-in failed: ${err.message}`, 'error');
      throw err;
    } finally {
      setIsLoggingInDrive(false);
    }
  };

  const handleGoogleDriveSignOut = async () => {
    await logout();
    setDriveUser(null);
    setDriveToken(null);
    addLog('Signed out of Google Drive.', 'info');
  };

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

  const triggerBrowserSave = (blob: Blob, filename: string) => {
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
  };

  const buildMergedBlob = (): { blob: Blob; filename: string; totalLength: number; segmentsCount: number } => {
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
    const filename = downloadProgress.filename || 'stream_video.ts';
    return { blob, filename, totalLength, segmentsCount };
  };

  // Merge and save to Google Drive (default) or Local Device
  const handleMergeAndSave = async (overrideToken?: string, forceLocal = false) => {
    setDownloadProgress((prev) => ({
      ...prev,
      state: 'merging',
      errorMessage: undefined,
      uploadProgressPercent: 0,
    }));
    addLog('Joining TS chunks into cohesive MPEG-TS video file...', 'info');

    try {
      const { blob, filename, totalLength, segmentsCount } = buildMergedBlob();

      const useDrive = !forceLocal && settings.downloadDestination === 'gdrive';
      if (useDrive) {
        const token = overrideToken || getAccessToken() || driveToken;
        if (!token) {
          setDownloadProgress((prev) => ({
            ...prev,
            state: 'error',
            errorMessage:
              'Video merged and ready in memory! Sign in with Google to upload to your default Google Drive folder, or download locally.',
          }));
          addLog('Google Drive upload paused: please sign in with Google to complete saving to Drive.', 'warn');
          return;
        }

        setDownloadProgress((prev) => ({ ...prev, state: 'uploading', uploadProgressPercent: 0 }));
        const folderName = settings.googleDriveFolderName || 'M3U8 Downloads';
        let folderId = settings.googleDriveFolderId;

        const verified = folderId ? await verifyDriveFolderExists(token, folderId) : null;
        if (!verified) {
          const created = await findOrCreateDriveFolder(token, folderName);
          folderId = created.id;
          setSettings((prev) => ({
            ...prev,
            googleDriveFolderId: created.id,
            googleDriveFolderName: created.name,
          }));
        }

        addLog(`Uploading "${filename}" (${formatBytes(totalLength)}) to Google Drive / ${folderName}...`, 'info');

        const uploaded = await uploadVideoToDrive(token, blob, filename, folderId, (pct) => {
          setDownloadProgress((prev) => ({ ...prev, uploadProgressPercent: pct }));
        });

        if (settings.alsoSaveLocally) {
          triggerBrowserSave(blob, filename);
        }

        setDownloadProgress((prev) => ({
          ...prev,
          state: 'completed',
          uploadProgressPercent: 100,
          driveFileLink: uploaded.webViewLink,
          driveFileName: uploaded.name,
        }));
        addLog(`Saved "${uploaded.name}" to Google Drive folder "${folderName}"!`, 'success');

        const historyItem: DownloadHistoryItem = {
          id: Math.random().toString(36).substring(2, 9),
          url: playlist?.url || streamUrl,
          filename: uploaded.name || filename,
          totalSegments: segmentsCount,
          totalBytes: totalLength,
          durationSeconds: playlist?.totalDuration || 0,
          completedAt: new Date().toISOString(),
          destination: 'gdrive',
          driveFileLink: uploaded.webViewLink,
          driveFolderName: folderName,
        };
        setHistory((prev) => [historyItem, ...prev.slice(0, 49)]);
        return;
      }

      // Local device download
      triggerBrowserSave(blob, filename);
      setDownloadProgress((prev) => ({ ...prev, state: 'completed', driveFileLink: undefined }));
      addLog(`File "${filename}" saved locally (${formatBytes(totalLength)})!`, 'success');

      const historyItem: DownloadHistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        url: playlist?.url || streamUrl,
        filename,
        totalSegments: segmentsCount,
        totalBytes: totalLength,
        durationSeconds: playlist?.totalDuration || 0,
        completedAt: new Date().toISOString(),
        destination: 'local',
      };
      setHistory((prev) => [historyItem, ...prev.slice(0, 49)]);
    } catch (err: any) {
      addLog(`Failed to save video: ${err.message}`, 'error');
      setDownloadProgress((prev) => ({
        ...prev,
        state: 'error',
        errorMessage: `Save failed: ${err.message}`,
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

  // --- SEQUENTIAL MULTI-URL QUEUE ENGINE ---
  const updateQueue = (updater: (prev: QueueItem[]) => QueueItem[]) => {
    const next = updater(queueRef.current);
    queueRef.current = next;
    setQueue(next);
  };

  const updateQueueItem = (id: string, patch: Partial<QueueItem>) => {
    updateQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const parseUrlsFromInput = (input: string | string[]): string[] => {
    const rawList = Array.isArray(input) ? input : input.split(/\r?\n/);
    return rawList
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && /^https?:\/\//i.test(line));
  };

  const handleAddToQueue = (urlsInput: string | string[], autoStart = false) => {
    const validUrls = parseUrlsFromInput(urlsInput);
    if (validUrls.length === 0) {
      setParseError('Enter at least one valid http:// or https:// M3U8 URL to queue.');
      return;
    }

    setParseError(null);
    const newItems: QueueItem[] = validUrls.map((u) => ({
      id: Math.random().toString(36).substring(2, 10),
      url: u,
      filename: generateFilename(u),
      status: 'queued',
      totalSegments: 0,
      completedSegments: 0,
      failedSegments: 0,
      totalBytes: 0,
      progressPercent: 0,
      speedBytesSec: 0,
      durationSeconds: 0,
      addedAt: new Date().toISOString(),
    }));

    updateQueue((prev) => [...prev, ...newItems]);
    addLog(`Added ${newItems.length} M3U8 stream(s) to sequential queue.`, 'info');

    if (autoStart && !isQueueRunningRef.current) {
      void runQueueLoop();
    }
  };

  const processSingleQueueItem = async (item: QueueItem) => {
    const currentSettings = settingsRef.current;
    updateQueueItem(item.id, {
      status: 'parsing',
      errorMessage: undefined,
      progressPercent: 0,
      completedSegments: 0,
      failedSegments: 0,
      totalBytes: 0,
      speedBytesSec: 0,
    });
    addLog(`[Queue] Parsing playlist: ${item.url}`, 'info');

    try {
      const fetchManifest = async (targetUrl: string): Promise<ParsedPlaylist> => {
        const res = await fetch('/api/parse-m3u8', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: targetUrl,
            headers: {
              'User-Agent': currentSettings.customUserAgent || undefined,
              Referer: currentSettings.customReferer || undefined,
              Cookie: currentSettings.customCookie || undefined,
              Authorization: currentSettings.customAuth || undefined,
            },
          }),
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `HTTP ${res.status}: Failed to parse playlist`);
        }
        const parsed: ParsedPlaylist = await res.json();
        parsed.url = targetUrl;
        return parsed;
      };

      let parsed = await fetchManifest(item.url);
      let resolvedResolution: string | undefined;

      if (parsed.type === 'master') {
        const variants = parsed.variants || [];
        if (variants.length === 0) {
          throw new Error('Master playlist contains no playable variants.');
        }
        const bestVariant = [...variants].sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0))[0];
        resolvedResolution = bestVariant.resolution || bestVariant.name;
        addLog(
          `[Queue] Master playlist detected. Auto-selected ${resolvedResolution || 'highest bitrate'} stream.`,
          'info'
        );
        parsed = await fetchManifest(bestVariant.uri);
      }

      const segments = parsed.segments || [];
      if (segments.length === 0) {
        throw new Error('Media playlist contains 0 segments.');
      }

      // Sync active dashboard & segment matrix with current queue item
      setPlaylist(parsed);
      downloadedChunksRef.current.clear();
      isPausedRef.current = false;
      abortControllerRef.current = new AbortController();

      const totalDuration = parsed.totalDuration || 0;
      const initializedSegments = segments.map((s) => ({ ...s, status: 'pending' as const }));

      updateQueueItem(item.id, {
        status: 'downloading',
        totalSegments: segments.length,
        durationSeconds: totalDuration,
        resolution: resolvedResolution,
      });

      setDownloadProgress({
        taskId: item.id,
        url: parsed.url,
        filename: item.filename,
        totalSegments: segments.length,
        completedSegments: 0,
        failedSegments: 0,
        totalBytes: 0,
        currentSpeedBytesSec: 0,
        elapsedSeconds: 0,
        etaSeconds: 0,
        state: 'downloading',
        segments: initializedSegments,
      });

      let completedCount = 0;
      let failedCount = 0;
      let totalBytesSum = 0;
      let windowBytes = 0;
      let windowTs = Date.now();

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const deltaSec = (now - windowTs) / 1000;
        const speed = deltaSec > 0 ? windowBytes / deltaSec : 0;
        windowBytes = 0;
        windowTs = now;

        const remainingSegments = segments.length - completedCount;
        const avgSegBytes = completedCount > 0 ? totalBytesSum / completedCount : 500000;
        const eta = speed > 0 ? Math.round((remainingSegments * avgSegBytes) / speed) : 0;

        updateQueueItem(item.id, { speedBytesSec: speed });
        setDownloadProgress((prev) =>
          prev.taskId === item.id && prev.state === 'downloading'
            ? {
                ...prev,
                currentSpeedBytesSec: speed,
                elapsedSeconds: prev.elapsedSeconds + 1,
                etaSeconds: eta,
              }
            : prev
        );
      }, 1000);

      const segmentQueue = segments.map((seg, idx) => ({ ...seg, index: idx }));

      const worker = async () => {
        while (segmentQueue.length > 0 && !isPausedRef.current && isQueueRunningRef.current) {
          const segment = segmentQueue.shift();
          if (!segment) break;

          setDownloadProgress((prev) => ({
            ...prev,
            segments: prev.segments.map((s) =>
              s.index === segment.index ? { ...s, status: 'downloading' } : s
            ),
          }));

          let attempt = 0;
          let success = false;
          let chunkBytes: Uint8Array | null = null;
          let lastError = '';

          while (
            attempt < currentSettings.maxRetries &&
            !success &&
            !isPausedRef.current &&
            isQueueRunningRef.current
          ) {
            attempt++;
            try {
              chunkBytes = await fetchSegmentData(
                segment,
                currentSettings,
                abortControllerRef.current?.signal || new AbortController().signal
              );
              success = true;
            } catch (err: any) {
              lastError = err.message || 'Fetch failed';
              if (err.name === 'AbortError') return;
              if (attempt < currentSettings.maxRetries) {
                await new Promise((r) => setTimeout(r, 800 * attempt));
              }
            }
          }

          if (success && chunkBytes) {
            downloadedChunksRef.current.set(segment.index, chunkBytes);
            completedCount++;
            totalBytesSum += chunkBytes.length;
            windowBytes += chunkBytes.length;
            const pct = Math.round((completedCount / segments.length) * 100);

            updateQueueItem(item.id, {
              completedSegments: completedCount,
              totalBytes: totalBytesSum,
              progressPercent: pct,
            });

            setDownloadProgress((prev) => ({
              ...prev,
              completedSegments: completedCount,
              totalBytes: totalBytesSum,
              segments: prev.segments.map((s) =>
                s.index === segment.index
                  ? { ...s, status: 'completed', sizeBytes: chunkBytes?.length }
                  : s
              ),
            }));
          } else if (!isPausedRef.current && isQueueRunningRef.current) {
            failedCount++;
            updateQueueItem(item.id, { failedSegments: failedCount });
            setDownloadProgress((prev) => ({
              ...prev,
              failedSegments: failedCount,
              segments: prev.segments.map((s) =>
                s.index === segment.index ? { ...s, status: 'failed', error: lastError } : s
              ),
            }));
          }
        }
      };

      const workers = Array.from({ length: currentSettings.concurrency }, () => worker());
      await Promise.all(workers);
      clearInterval(timerRef.current);

      if (isPausedRef.current || !isQueueRunningRef.current) {
        updateQueueItem(item.id, { status: 'paused', speedBytesSec: 0 });
        setDownloadProgress((prev) => ({ ...prev, state: 'paused', currentSpeedBytesSec: 0 }));
        addLog(`[Queue] Paused "${item.filename}".`, 'warn');
        return;
      }

      if (downloadedChunksRef.current.size < segments.length) {
        throw new Error(
          `${segments.length - downloadedChunksRef.current.size} segment(s) failed to download.`
        );
      }

      // Merge chunks
      updateQueueItem(item.id, { status: 'merging', speedBytesSec: 0, progressPercent: 100 });
      setDownloadProgress((prev) => ({ ...prev, state: 'merging', currentSpeedBytesSec: 0 }));

      let totalLength = 0;
      for (let i = 0; i < segments.length; i++) {
        totalLength += downloadedChunksRef.current.get(i)?.length || 0;
      }
      const mergedArray = new Uint8Array(totalLength);
      let offset = 0;
      for (let i = 0; i < segments.length; i++) {
        const chunk = downloadedChunksRef.current.get(i);
        if (chunk) {
          mergedArray.set(chunk, offset);
          offset += chunk.length;
        }
      }
      const blob = new Blob([mergedArray.buffer as ArrayBuffer], { type: 'video/mp2t' });

      if (currentSettings.downloadDestination === 'gdrive') {
        const token = driveTokenRef.current || getAccessToken();
        if (!token) {
          throw new Error('Google Drive sign-in required to save queued download to Drive.');
        }

        updateQueueItem(item.id, { status: 'uploading', uploadProgressPercent: 0 });
        setDownloadProgress((prev) => ({ ...prev, state: 'uploading', uploadProgressPercent: 0 }));

        const folderName = currentSettings.googleDriveFolderName || 'M3U8 Downloads';
        let folderId = currentSettings.googleDriveFolderId;
        const verified = folderId ? await verifyDriveFolderExists(token, folderId) : null;
        if (!verified) {
          const created = await findOrCreateDriveFolder(token, folderName);
          folderId = created.id;
          setSettings((prev) => ({
            ...prev,
            googleDriveFolderId: created.id,
            googleDriveFolderName: created.name,
          }));
        }

        const uploaded = await uploadVideoToDrive(token, blob, item.filename, folderId, (pct) => {
          updateQueueItem(item.id, { uploadProgressPercent: pct });
          setDownloadProgress((prev) => ({ ...prev, uploadProgressPercent: pct }));
        });

        if (currentSettings.alsoSaveLocally) {
          triggerBrowserSave(blob, item.filename);
        }

        const completedAt = new Date().toISOString();
        updateQueueItem(item.id, {
          status: 'completed',
          progressPercent: 100,
          uploadProgressPercent: 100,
          destination: 'gdrive',
          driveFileLink: uploaded.webViewLink,
          driveFolderName: folderName,
          completedAt,
        });
        setDownloadProgress((prev) => ({
          ...prev,
          state: 'completed',
          uploadProgressPercent: 100,
          driveFileLink: uploaded.webViewLink,
          driveFileName: uploaded.name,
        }));
        addLog(`[Queue] Saved "${item.filename}" to Google Drive / ${folderName}.`, 'success');

        setHistory((prev) => [
          {
            id: item.id,
            url: item.url,
            filename: uploaded.name || item.filename,
            totalSegments: segments.length,
            totalBytes: totalLength,
            durationSeconds: totalDuration,
            completedAt,
            resolution: resolvedResolution,
            destination: 'gdrive',
            driveFileLink: uploaded.webViewLink,
            driveFolderName: folderName,
          },
          ...prev.slice(0, 49),
        ]);
      } else {
        triggerBrowserSave(blob, item.filename);
        const completedAt = new Date().toISOString();
        updateQueueItem(item.id, {
          status: 'completed',
          progressPercent: 100,
          destination: 'local',
          completedAt,
        });
        setDownloadProgress((prev) => ({ ...prev, state: 'completed', driveFileLink: undefined }));
        addLog(`[Queue] Saved "${item.filename}" locally.`, 'success');

        setHistory((prev) => [
          {
            id: item.id,
            url: item.url,
            filename: item.filename,
            totalSegments: segments.length,
            totalBytes: totalLength,
            durationSeconds: totalDuration,
            completedAt,
            resolution: resolvedResolution,
            destination: 'local',
          },
          ...prev.slice(0, 49),
        ]);
      }
    } catch (err: any) {
      clearInterval(timerRef.current);
      const message = err?.message || 'Queue item failed';
      updateQueueItem(item.id, {
        status: 'failed',
        speedBytesSec: 0,
        errorMessage: message,
      });
      addLog(`[Queue] Failed "${item.filename}": ${message}`, 'error');
    }
  };

  const runQueueLoop = async () => {
    if (isQueueRunningRef.current) return;
    isQueueRunningRef.current = true;
    setIsQueueRunning(true);
    isPausedRef.current = false;

    while (isQueueRunningRef.current && !isPausedRef.current) {
      const nextItem = queueRef.current.find((q) => q.status === 'queued');
      if (!nextItem) break;
      await processSingleQueueItem(nextItem);
    }

    isQueueRunningRef.current = false;
    setIsQueueRunning(false);
    if (!isPausedRef.current && !queueRef.current.some((q) => q.status === 'queued')) {
      addLog('Sequential queue finished processing all items.', 'success');
    }
  };

  const handleStartQueue = () => {
    // Re-queue paused items when user resumes queue
    updateQueue((prev) =>
      prev.map((q) => (q.status === 'paused' ? { ...q, status: 'queued' } : q))
    );
    void runQueueLoop();
  };

  const handlePauseQueue = () => {
    isQueueRunningRef.current = false;
    isPausedRef.current = true;
    setIsQueueRunning(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    clearInterval(timerRef.current);
  };

  const handleRetryQueueItem = (id: string) => {
    updateQueueItem(id, {
      status: 'queued',
      errorMessage: undefined,
      completedSegments: 0,
      failedSegments: 0,
      totalBytes: 0,
      progressPercent: 0,
      uploadProgressPercent: 0,
    });
    if (!isQueueRunningRef.current) {
      void runQueueLoop();
    }
  };

  const handleRemoveQueueItem = (id: string) => {
    updateQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const handleClearFinishedQueue = () => {
    updateQueue((prev) => prev.filter((q) => q.status !== 'completed' && q.status !== 'failed'));
  };

  const progressPercent =
    downloadProgress.totalSegments > 0
      ? Math.round((downloadProgress.completedSegments / downloadProgress.totalSegments) * 100)
      : 0;

  const activeQueueCount = queue.filter(
    (q) => q.status !== 'completed' && q.status !== 'failed'
  ).length;
  const activeQueueItem = queue.find(
    (q) =>
      q.status === 'parsing' ||
      q.status === 'downloading' ||
      q.status === 'merging' ||
      q.status === 'uploading'
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Offline Mode Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-slate-950 font-bold px-4 py-2 text-center text-xs flex items-center justify-center gap-2 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
          <span>You are currently offline. Cached PWA assets are active. Live streaming and remote segment fetching require an internet connection.</span>
        </div>
      )}

      {/* Header with PWA install button & Google Drive indicator */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenDriveSettings={() => setIsDriveModalOpen(true)}
        driveConnected={!!driveToken}
        driveFolderName={settings.googleDriveFolderName}
        downloadDestination={settings.downloadDestination}
        activeDownloadsCount={downloadProgress.state === 'downloading' || isQueueRunning ? 1 : 0}
        queuedCount={activeQueueCount}
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
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition active:scale-95"
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

                <button
                  type="button"
                  onClick={() => {
                    if (streamUrl.trim()) {
                      handleAddToQueue(streamUrl.trim(), false);
                      setStreamUrl('');
                    }
                  }}
                  disabled={!streamUrl.trim()}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 text-xs sm:text-sm font-semibold transition"
                  title="Add this M3U8 URL to the sequential download queue"
                >
                  <Plus className="w-4 h-4 text-indigo-400" />
                  <span className="hidden md:inline">Add to Queue</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBatchInput((prev) => !prev)}
                  className={`flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl border text-xs sm:text-sm font-semibold transition ${
                    showBatchInput
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  }`}
                  title="Batch add multiple M3U8 URLs"
                >
                  <ListPlus className="w-4 h-4" />
                  <span className="hidden lg:inline">Batch URLs</span>
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

            {/* Batch Multi-URL Queue Input Panel */}
            {showBatchInput && (
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-indigo-500/40 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <ListOrdered className="w-4 h-4 text-indigo-400" />
                    <span>Sequential Multi-URL Queue (paste one M3U8 URL per line)</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {parseUrlsFromInput(batchUrlsText).length} valid URL(s)
                  </span>
                </div>

                <textarea
                  rows={4}
                  value={batchUrlsText}
                  onChange={(e) => setBatchUrlsText(e.target.value)}
                  placeholder={'https://example.com/stream1.m3u8\nhttps://example.com/stream2.m3u8\nhttps://example.com/stream3.m3u8'}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1.5 transition"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                    <span>View Queue Progress ({queue.length})</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={parseUrlsFromInput(batchUrlsText).length === 0}
                      onClick={() => {
                        handleAddToQueue(batchUrlsText, false);
                        setBatchUrlsText('');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold transition"
                    >
                      Add to Queue
                    </button>
                    <button
                      type="button"
                      disabled={parseUrlsFromInput(batchUrlsText).length === 0}
                      onClick={() => {
                        handleAddToQueue(batchUrlsText, true);
                        setBatchUrlsText('');
                        setIsHistoryOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Add & Start Sequential Queue</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

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

            {/* Default Download Folder: Google Drive Status Bar */}
            <div className="mt-4 p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <span>Default Download Folder:</span>
                    {settings.downloadDestination === 'gdrive' ? (
                      <span className="text-sky-300 font-mono">
                        Google Drive / {settings.googleDriveFolderName || 'M3U8 Downloads'}
                      </span>
                    ) : (
                      <span className="text-indigo-300 font-mono">Local Browser Downloads</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {driveToken && driveUser
                      ? `Connected as ${driveUser.email}`
                      : settings.downloadDestination === 'gdrive'
                      ? 'Sign in with Google to save downloads directly into your Drive folder'
                      : 'Downloads save locally to your device'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {settings.downloadDestination === 'gdrive' && !driveToken && (
                  <GoogleSignInButton
                    onClick={() => handleGoogleDriveSignIn().catch(() => {})}
                    disabled={isLoggingInDrive}
                    label={isLoggingInDrive ? 'Connecting...' : 'Sign in with Google'}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setIsDriveModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span>{driveToken ? 'Change Folder' : 'Folder Settings'}</span>
                </button>
              </div>
            </div>
            {/* Live Sequential Queue Status Strip */}
            {queue.length > 0 && (
              <div className="mt-3 p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/35 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                    {isQueueRunning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ListOrdered className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {activeQueueItem
                        ? `Queue Active: ${activeQueueItem.filename} (${
                            activeQueueItem.status === 'uploading'
                              ? `Uploading ${activeQueueItem.uploadProgressPercent ?? 0}%`
                              : `${activeQueueItem.progressPercent}%`
                          })`
                        : `Sequential Queue (${queue.length} item${queue.length === 1 ? '' : 's'})`}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {activeQueueCount} pending/active •{' '}
                      {queue.filter((q) => q.status === 'completed').length} completed
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isQueueRunning ? (
                    <button
                      type="button"
                      onClick={handlePauseQueue}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause Queue</span>
                    </button>
                  ) : (
                    queue.some((q) => q.status === 'queued' || q.status === 'paused') && (
                      <button
                        type="button"
                        onClick={handleStartQueue}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Queue</span>
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                  >
                    <ListOrdered className="w-3.5 h-3.5 text-indigo-400" />
                    <span>View Progress</span>
                  </button>
                </div>
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

                  {/* Google Drive Upload Progress */}
                  {downloadProgress.state === 'uploading' && (
                    <div className="mt-4 p-4 rounded-xl bg-sky-950/40 border border-sky-500/40 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs font-semibold text-sky-200">
                        <span className="flex items-center gap-2">
                          <Cloud className="w-4 h-4 text-sky-400 animate-bounce" />
                          <span>Uploading to Google Drive / {settings.googleDriveFolderName || 'M3U8 Downloads'}...</span>
                        </span>
                        <span className="font-mono">{downloadProgress.uploadProgressPercent || 0}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-indigo-400 transition-all duration-200"
                          style={{ width: `${downloadProgress.uploadProgressPercent || 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error / Auth Needed for Google Drive Upload */}
                  {downloadProgress.state === 'error' && downloadProgress.errorMessage && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-white text-sm">Action Needed to Finish Saving</h4>
                          <p className="text-xs text-amber-200 mt-0.5">{downloadProgress.errorMessage}</p>
                        </div>
                      </div>
                      {downloadedChunksRef.current.size === downloadProgress.segments.length && (
                        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                          <GoogleSignInButton
                            onClick={async () => {
                              try {
                                const token = await handleGoogleDriveSignIn();
                                if (token) {
                                  await handleMergeAndSave(token, false);
                                }
                              } catch {
                                // logged inside handleGoogleDriveSignIn
                              }
                            }}
                            disabled={isLoggingInDrive}
                            label={isLoggingInDrive ? 'Connecting...' : 'Sign in & Save to Drive'}
                          />
                          <button
                            type="button"
                            onClick={() => handleMergeAndSave(undefined, true)}
                            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                          >
                            Save Locally Instead
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Merged File Download Ready Card */}
                  {downloadProgress.state === 'completed' && (
                    <div className="mt-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                        <div>
                          <h4 className="font-bold text-white text-sm">
                            {downloadProgress.driveFileLink
                              ? 'Saved to Google Drive!'
                              : 'Download & Merge Complete!'}
                          </h4>
                          <p className="text-xs text-emerald-300">
                            {downloadProgress.driveFileLink
                              ? `Uploaded "${downloadProgress.driveFileName || downloadProgress.filename}" to ${settings.googleDriveFolderName || 'M3U8 Downloads'}`
                              : `Video saved as ${downloadProgress.filename}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {downloadProgress.driveFileLink && (
                          <a
                            href={downloadProgress.driveFileLink}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition flex items-center gap-2"
                          >
                            <Cloud className="w-4 h-4" />
                            <span>Open in Drive</span>
                          </a>
                        )}
                        <button
                          onClick={() => handleMergeAndSave(undefined, true)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center gap-2"
                        >
                          <FolderDown className="w-4 h-4" />
                          <span>Save Local Copy</span>
                        </button>
                      </div>
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
          onOpenDriveSettings={() => setIsDriveModalOpen(true)}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isDriveModalOpen && (
        <GoogleDriveModal
          user={driveUser}
          accessToken={driveToken}
          selectedFolderId={settings.googleDriveFolderId}
          selectedFolderName={settings.googleDriveFolderName}
          downloadDestination={settings.downloadDestination}
          alsoSaveLocally={settings.alsoSaveLocally}
          onSignIn={handleGoogleDriveSignIn}
          onSignOut={handleGoogleDriveSignOut}
          onSelectFolder={(folder) => {
            setSettings((prev) => ({
              ...prev,
              downloadDestination: 'gdrive',
              googleDriveFolderId: folder.id,
              googleDriveFolderName: folder.name,
            }));
            addLog(`Default Google Drive folder set to "${folder.name}".`, 'success');
          }}
          onChangeDestination={(dest, alsoLocal) => {
            setSettings((prev) => ({
              ...prev,
              downloadDestination: dest,
              alsoSaveLocally: alsoLocal,
            }));
          }}
          onClose={() => setIsDriveModalOpen(false)}
        />
      )}

      {isHistoryOpen && (
        <DownloadHistoryModal
          history={history}
          queue={queue}
          isQueueRunning={isQueueRunning}
          onStartQueue={handleStartQueue}
          onPauseQueue={handlePauseQueue}
          onRetryQueueItem={handleRetryQueueItem}
          onRemoveQueueItem={handleRemoveQueueItem}
          onClearFinishedQueue={handleClearFinishedQueue}
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
