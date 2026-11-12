import { M3U8Segment, DownloadSettings } from '../types/m3u8';

export interface ChunkProgressEvent {
  segmentIndex: number;
  status: 'downloading' | 'completed' | 'failed';
  bytes?: number;
  error?: string;
}

// Convert hex string (e.g. "0x00010203...") to Uint8Array
export function hexToBytes(hexStr: string): Uint8Array {
  const cleanHex = hexStr.startsWith('0x') || hexStr.startsWith('0X') ? hexStr.slice(2) : hexStr;
  const padded = cleanHex.length % 2 !== 0 ? '0' + cleanHex : cleanHex;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < padded.length; i += 2) {
    bytes[i / 2] = parseInt(padded.substring(i, i + 2), 16);
  }
  return bytes;
}

// Create 16-byte IV from sequence number (big-endian)
export function sequenceToIV(seq: number): Uint8Array {
  const iv = new Uint8Array(16);
  const view = new DataView(iv.buffer);
  view.setUint32(12, seq, false); // Big endian
  return iv;
}

// Key cache to avoid refetching the exact same key for 1000s of segments
const keyCache = new Map<string, CryptoKey>();

export async function getCryptoKey(keyUri: string, useProxy: boolean, headers: Record<string, string>): Promise<CryptoKey> {
  if (keyCache.has(keyUri)) {
    return keyCache.get(keyUri)!;
  }

  const fetchUrl = useProxy ? `/api/proxy?url=${encodeURIComponent(keyUri)}` : keyUri;
  const reqHeaders: Record<string, string> = {};
  if (useProxy) {
    if (headers.customReferer) reqHeaders['x-target-referer'] = headers.customReferer;
    if (headers.customUserAgent) reqHeaders['x-target-user-agent'] = headers.customUserAgent;
    if (headers.customCookie) reqHeaders['x-target-cookie'] = headers.customCookie;
    if (headers.customAuth) reqHeaders['x-target-authorization'] = headers.customAuth;
  }

  const res = await fetch(fetchUrl, { headers: reqHeaders });
  if (!res.ok) {
    throw new Error(`Failed to fetch decryption key from ${keyUri} (HTTP ${res.status})`);
  }
  const keyBuffer = await res.arrayBuffer();

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );

  keyCache.set(keyUri, cryptoKey);
  return cryptoKey;
}

// Decrypt AES-128 segment buffer
export async function decryptSegment(
  encryptedBuffer: ArrayBuffer,
  keyUri: string,
  ivHex: string | undefined,
  seqNumber: number,
  useProxy: boolean,
  headers: Record<string, string>
): Promise<ArrayBuffer> {
  const cryptoKey = await getCryptoKey(keyUri, useProxy, headers);

  let iv: Uint8Array;
  if (ivHex) {
    iv = hexToBytes(ivHex);
  } else {
    iv = sequenceToIV(seqNumber);
  }

  // Ensure IV is exactly 16 bytes
  if (iv.length !== 16) {
    const adjusted = new Uint8Array(16);
    adjusted.set(iv.subarray(0, 16));
    iv = adjusted;
  }

  return await window.crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: iv.buffer as ArrayBuffer },
    cryptoKey,
    encryptedBuffer
  );
}

// Fetch a single segment with byteRange and optional decryption
export async function fetchSegmentData(
  segment: M3U8Segment,
  settings: DownloadSettings,
  signal: AbortSignal
): Promise<Uint8Array> {
  const targetUrl = segment.uri;
  const fetchUrl = settings.useProxy ? `/api/proxy?url=${encodeURIComponent(targetUrl)}` : targetUrl;

  const reqHeaders: Record<string, string> = {};
  if (segment.byteRange) {
    const start = segment.byteRange.offset;
    const end = start + segment.byteRange.length - 1;
    reqHeaders['Range'] = `bytes=${start}-${end}`;
  }

  if (settings.useProxy) {
    if (settings.customReferer) reqHeaders['x-target-referer'] = settings.customReferer;
    if (settings.customUserAgent) reqHeaders['x-target-user-agent'] = settings.customUserAgent;
    if (settings.customCookie) reqHeaders['x-target-cookie'] = settings.customCookie;
    if (settings.customAuth) reqHeaders['x-target-authorization'] = settings.customAuth;
  }

  const res = await fetch(fetchUrl, { headers: reqHeaders, signal });
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status} ${res.statusText}`);
  }

  let arrayBuf = await res.arrayBuffer();

  // If encrypted with AES-128, decrypt
  if (segment.key && segment.key.method === 'AES-128') {
    const headersMap: Record<string, string> = {
      customReferer: settings.customReferer,
      customUserAgent: settings.customUserAgent,
      customCookie: settings.customCookie,
      customAuth: settings.customAuth,
    };
    arrayBuf = await decryptSegment(
      arrayBuf,
      segment.key.uri,
      segment.key.iv,
      segment.index,
      settings.useProxy,
      headersMap
    );
  }

  return new Uint8Array(arrayBuf);
}

// Format bytes into human readable format
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Format seconds into HH:MM:SS or MM:SS
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
