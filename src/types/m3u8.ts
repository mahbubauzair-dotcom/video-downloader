export interface M3U8Key {
  method: string;
  uri: string;
  iv?: string;
  keyBuffer?: ArrayBuffer;
}

export interface M3U8Segment {
  index: number;
  uri: string;
  duration: number;
  title: string;
  byteRange?: { length: number; offset: number };
  key?: M3U8Key;
  initSegment?: {
    uri: string;
    byteRange?: { length: number; offset: number };
  };
  status?: 'pending' | 'downloading' | 'completed' | 'failed';
  retryCount?: number;
  error?: string;
  sizeBytes?: number;
}

export interface M3U8Variant {
  uri: string;
  bandwidth?: number;
  resolution?: string;
  codecs?: string;
  name?: string;
}

export interface ParsedPlaylist {
  type: 'master' | 'media';
  url: string;
  targetDuration?: number;
  mediaSequence?: number;
  isLive?: boolean;
  totalDuration?: number;
  segmentCount?: number;
  hasEncryption?: boolean;
  segments?: M3U8Segment[];
  variants?: M3U8Variant[];
  raw?: string;
}

export interface DownloadSettings {
  concurrency: number; // 1 to 16 parallel threads
  maxRetries: number;  // 1 to 10
  timeoutMs: number;   // e.g. 15000ms
  useProxy: boolean;   // bypass CORS via backend proxy
  customReferer: string;
  customUserAgent: string;
  customCookie: string;
  customAuth: string;
  outputFormat: 'ts' | 'mp4';
  filenameTemplate: string;
  downloadDestination: 'gdrive' | 'local';
  alsoSaveLocally: boolean;
  googleDriveFolderId: string;
  googleDriveFolderName: string;
}

export interface DownloadProgress {
  taskId: string;
  url: string;
  filename: string;
  totalSegments: number;
  completedSegments: number;
  failedSegments: number;
  totalBytes: number;
  currentSpeedBytesSec: number;
  elapsedSeconds: number;
  etaSeconds: number;
  state: 'idle' | 'parsing' | 'downloading' | 'paused' | 'merging' | 'uploading' | 'completed' | 'error';
  uploadProgressPercent?: number;
  driveFileLink?: string;
  driveFileName?: string;
  errorMessage?: string;
  segments: M3U8Segment[];
}

export interface DownloadHistoryItem {
  id: string;
  url: string;
  filename: string;
  totalSegments: number;
  totalBytes: number;
  durationSeconds: number;
  completedAt: string;
  resolution?: string;
  destination?: 'gdrive' | 'local';
  driveFileLink?: string;
  driveFolderName?: string;
}

export type QueueItemStatus =
  | 'queued'
  | 'parsing'
  | 'downloading'
  | 'merging'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'paused';

export interface QueueItem {
  id: string;
  url: string;
  filename: string;
  status: QueueItemStatus;
  totalSegments: number;
  completedSegments: number;
  failedSegments: number;
  totalBytes: number;
  progressPercent: number;
  uploadProgressPercent?: number;
  speedBytesSec: number;
  durationSeconds: number;
  resolution?: string;
  destination?: 'gdrive' | 'local';
  driveFileLink?: string;
  driveFolderName?: string;
  errorMessage?: string;
  addedAt: string;
  completedAt?: string;
}

