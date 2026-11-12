import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper to perform HTTP/HTTPS request with custom headers
async function fetchWithHeaders(targetUrl: string, customHeaders: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(targetUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const headers: Record<string, string> = {
        'User-Agent': customHeaders['user-agent'] || customHeaders['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity', // avoid gzip compression issues for raw segments
      };

      if (customHeaders['referer'] || customHeaders['Referer']) {
        headers['Referer'] = customHeaders['referer'] || customHeaders['Referer'];
      }
      if (customHeaders['origin'] || customHeaders['Origin']) {
        headers['Origin'] = customHeaders['origin'] || customHeaders['Origin'];
      }
      if (customHeaders['authorization'] || customHeaders['Authorization']) {
        headers['Authorization'] = customHeaders['authorization'] || customHeaders['Authorization'];
      }
      if (customHeaders['cookie'] || customHeaders['Cookie']) {
        headers['Cookie'] = customHeaders['cookie'] || customHeaders['Cookie'];
      }

      const req = client.request(parsedUrl, { method: 'GET', headers }, (res) => {
        // Follow redirects (up to 5 redirects)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).href;
          fetchWithHeaders(redirectUrl, customHeaders).then(resolve).catch(reject);
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 200,
            headers: res.headers,
            buffer: Buffer.concat(chunks),
          });
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(30000, () => {
        req.destroy(new Error('Request timeout after 30s'));
      });
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// CORS Proxy endpoint to fetch any M3U8 playlist or TS segment without browser restrictions
app.all('/api/proxy', async (req, res) => {
  const targetUrl = (req.query.url as string) || (req.body && req.body.url);
  if (!targetUrl) {
    res.status(400).json({ error: 'Missing "url" parameter' });
    return;
  }

  try {
    const customHeaders: Record<string, string> = {};
    if (req.headers['x-target-referer']) customHeaders['Referer'] = req.headers['x-target-referer'] as string;
    if (req.headers['x-target-user-agent']) customHeaders['User-Agent'] = req.headers['x-target-user-agent'] as string;
    if (req.headers['x-target-cookie']) customHeaders['Cookie'] = req.headers['x-target-cookie'] as string;
    if (req.headers['x-target-authorization']) customHeaders['Authorization'] = req.headers['x-target-authorization'] as string;

    const { status, headers, buffer } = await fetchWithHeaders(targetUrl, customHeaders);

    res.status(status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    const contentType = headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    if (headers['content-length']) {
      res.setHeader('Content-Length', headers['content-length']);
    }

    res.send(buffer);
  } catch (error: any) {
    console.error('Proxy error:', error.message);
    res.status(502).json({ error: `Failed to fetch target URL: ${error.message}` });
  }
});

// Parse M3U8 endpoint
interface M3U8Segment {
  index: number;
  uri: string;
  duration: number;
  title: string;
  byteRange?: { length: number; offset: number };
  key?: {
    method: string;
    uri: string;
    iv?: string;
  };
  initSegment?: {
    uri: string;
    byteRange?: { length: number; offset: number };
  };
}

interface M3U8Variant {
  uri: string;
  bandwidth?: number;
  resolution?: string;
  codecs?: string;
  name?: string;
}

app.post('/api/parse-m3u8', async (req, res) => {
  const { url, content, headers: inputHeaders } = req.body;
  if (!url && !content) {
    res.status(400).json({ error: 'Either "url" or "content" is required' });
    return;
  }

  try {
    let manifestText = content;
    let baseUrl = url || '';

    if (!manifestText && url) {
      const response = await fetchWithHeaders(url, inputHeaders || {});
      manifestText = response.buffer.toString('utf-8');
    }

    if (!manifestText.startsWith('#EXTM3U')) {
      res.status(400).json({ error: 'Not a valid M3U8 playlist (missing #EXTM3U header)' });
      return;
    }

    const lines = manifestText.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    const isMaster = lines.some((l: string) => l.startsWith('#EXT-X-STREAM-INF'));

    if (isMaster) {
      // Parse master playlist variants
      const variants: M3U8Variant[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
          const attrs = line.substring(18);
          const bandwidthMatch = attrs.match(/BANDWIDTH=(\d+)/);
          const resMatch = attrs.match(/RESOLUTION=(\d+x\d+)/);
          const codecsMatch = attrs.match(/CODECS="([^"]+)"/);
          const nameMatch = attrs.match(/NAME="([^"]+)"/);

          const nextLine = lines[i + 1];
          if (nextLine && !nextLine.startsWith('#')) {
            const variantUrl = baseUrl ? new URL(nextLine, baseUrl).href : nextLine;
            variants.push({
              uri: variantUrl,
              bandwidth: bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : undefined,
              resolution: resMatch ? resMatch[1] : undefined,
              codecs: codecsMatch ? codecsMatch[1] : undefined,
              name: nameMatch ? nameMatch[1] : undefined,
            });
          }
        }
      }

      res.json({
        type: 'master',
        variants,
        raw: manifestText,
      });
      return;
    }

    // Media playlist parsing
    const segments: M3U8Segment[] = [];
    let currentKey: { method: string; uri: string; iv?: string } | undefined = undefined;
    let currentInit: { uri: string; byteRange?: { length: number; offset: number } } | undefined = undefined;
    let currentDuration = 0;
    let currentTitle = '';
    let currentByteRange: { length: number; offset: number } | undefined = undefined;
    let targetDuration = 10;
    let mediaSequence = 0;
    let isLive = true;

    for (const line of lines) {
      if (line.startsWith('#EXT-X-TARGETDURATION:')) {
        targetDuration = parseFloat(line.split(':')[1]) || 10;
      } else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
        mediaSequence = parseInt(line.split(':')[1], 10) || 0;
      } else if (line.startsWith('#EXT-X-ENDLIST')) {
        isLive = false;
      } else if (line.startsWith('#EXT-X-KEY:')) {
        const keyAttrs = line.substring(11);
        const methodMatch = keyAttrs.match(/METHOD=([^,]+)/);
        const uriMatch = keyAttrs.match(/URI="([^"]+)"/);
        const ivMatch = keyAttrs.match(/IV=(0x[0-9a-fA-F]+)/);

        if (methodMatch && methodMatch[1] !== 'NONE' && uriMatch) {
          const keyUri = baseUrl ? new URL(uriMatch[1], baseUrl).href : uriMatch[1];
          currentKey = {
            method: methodMatch[1],
            uri: keyUri,
            iv: ivMatch ? ivMatch[1] : undefined,
          };
        } else if (methodMatch && methodMatch[1] === 'NONE') {
          currentKey = undefined;
        }
      } else if (line.startsWith('#EXT-X-MAP:')) {
        const mapAttrs = line.substring(11);
        const uriMatch = mapAttrs.match(/URI="([^"]+)"/);
        const brMatch = mapAttrs.match(/BYTERANGE="?(\d+)@?(\d+)?"?/);
        if (uriMatch) {
          const initUri = baseUrl ? new URL(uriMatch[1], baseUrl).href : uriMatch[1];
          currentInit = {
            uri: initUri,
            byteRange: brMatch ? { length: parseInt(brMatch[1], 10), offset: brMatch[2] ? parseInt(brMatch[2], 10) : 0 } : undefined,
          };
        }
      } else if (line.startsWith('#EXT-X-BYTERANGE:')) {
        const parts = line.substring(17).split('@');
        currentByteRange = {
          length: parseInt(parts[0], 10),
          offset: parts[1] ? parseInt(parts[1], 10) : 0,
        };
      } else if (line.startsWith('#EXTINF:')) {
        const info = line.substring(8);
        const commaIdx = info.indexOf(',');
        if (commaIdx !== -1) {
          currentDuration = parseFloat(info.substring(0, commaIdx)) || 0;
          currentTitle = info.substring(commaIdx + 1).trim();
        } else {
          currentDuration = parseFloat(info) || 0;
          currentTitle = '';
        }
      } else if (!line.startsWith('#')) {
        const segUri = baseUrl ? new URL(line, baseUrl).href : line;
        segments.push({
          index: segments.length,
          uri: segUri,
          duration: currentDuration,
          title: currentTitle,
          byteRange: currentByteRange,
          key: currentKey ? { ...currentKey } : undefined,
          initSegment: currentInit ? { ...currentInit } : undefined,
        });
        currentByteRange = undefined;
      }
    }

    const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);

    res.json({
      type: 'media',
      targetDuration,
      mediaSequence,
      isLive,
      totalDuration,
      segmentCount: segments.length,
      hasEncryption: segments.some((s) => s.key && s.key.method !== 'NONE'),
      segments,
      raw: manifestText,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to parse M3U8: ${err.message}` });
  }
});

// Download and stream merged video chunks endpoint
app.post('/api/download-stream', async (req, res) => {
  const { segments, filename = 'video.ts', headers: customHeaders } = req.body;
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    res.status(400).json({ error: 'Valid segments array is required' });
    return;
  }

  try {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/MP2T');
    res.setHeader('Transfer-Encoding', 'chunked');

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      try {
        const { buffer } = await fetchWithHeaders(seg.uri, customHeaders || {});
        res.write(buffer);
      } catch (err: any) {
        console.error(`Failed segment ${i} (${seg.uri}):`, err.message);
        // Continue writing remaining segments rather than completely breaking stream
      }
    }

    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

// Setup Vite middlewares for development or serve dist in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const httpServer = http.createServer(app);

  if (isDev) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`M3U8 Downloader Pro server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
