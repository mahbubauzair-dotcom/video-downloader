# M3U8 Stream & Video Downloader Pro (PWA)

Graphical M3U8 HLS video downloader, segment matrix inspector, AES-128 decryptor, and live stream previewer built with React, Vite, Tailwind CSS, Express / Vercel Serverless Functions, and full offline PWA support.

## Features
- **Master & Media Playlist Parsing**: Automatic extraction of adaptive bitrate qualities and segment lists (`#EXTM3U`, `#EXT-X-STREAM-INF`, `#EXT-X-KEY`, `#EXT-X-BYTERANGE`, `#EXT-X-MAP`).
- **Multi-Threaded Worker Pool**: Configurable 1–16 parallel chunk downloads with automatic retry & exponential backoff.
- **AES-128 Decryption**: Client-side WebCrypto decryption for encrypted HLS streams.
- **CORS Bypass Proxy**: Serverless/Node proxy endpoints (`/api/proxy`, `/api/parse-m3u8`, `/api/download-stream`) supporting custom `Referer`, `User-Agent`, `Cookie`, and `Authorization` headers.
- **Segment Matrix Inspector & Live Preview**: Color-coded segment grid, per-segment inspection/download, live HLS.js preview modal, and engine logs.
- **Progressive Web App (PWA)**: Installable on Windows, macOS, Linux, Android, and iOS via Header and Footer install prompts with offline caching.

## Local Development
```bash
npm install
npm run dev
```
Runs at `http://localhost:3000`.

## Production Build
```bash
npm run lint
npm run build
npm start
```

## Deploying to Vercel via GitHub (Auto-Deploy)
1. Push this repository to GitHub (`main` branch).
2. In the [Vercel Dashboard](https://vercel.com/new), import the GitHub repository.
3. Vercel automatically detects `vercel.json` and Vite:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Serverless API**: `/api/proxy.ts`, `/api/parse-m3u8.ts`, `/api/download-stream.ts`
4. Every subsequent `git push` to `main` automatically triggers a new production deployment on Vercel.
