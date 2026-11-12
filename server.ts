import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import {
  handleProxyRequest,
  handleParseM3U8Request,
  handleDownloadStreamRequest,
  type ApiRequest,
  type ApiResponse,
} from './lib/m3u8Server.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS Proxy endpoint to fetch any M3U8 playlist or TS segment without browser restrictions
app.all('/api/proxy', async (req, res) => {
  await handleProxyRequest(req as unknown as ApiRequest, res as unknown as ApiResponse);
});

// Parse M3U8 endpoint
app.post('/api/parse-m3u8', async (req, res) => {
  await handleParseM3U8Request(req as unknown as ApiRequest, res as unknown as ApiResponse);
});

// Download and stream merged video chunks endpoint
app.post('/api/download-stream', async (req, res) => {
  await handleDownloadStreamRequest(req as unknown as ApiRequest, res as unknown as ApiResponse);
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
