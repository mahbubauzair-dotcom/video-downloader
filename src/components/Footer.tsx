import React, { useState } from 'react';
import { Smartphone, Download, ShieldCheck, Zap, Monitor, Cpu, CheckCircle2, Info, ArrowUpRight, Github } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const Footer: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  return (
    <footer className="mt-16 border-t border-slate-800/80 bg-slate-950/90 py-10 px-4 sm:px-6 text-slate-400">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* PWA INSTALL CALL-TO-ACTION SECTION (FOOTER REQUIREMENT) */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/50 via-slate-900/90 to-sky-950/50 p-6 sm:p-8 backdrop-blur shadow-2xl">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span>Progressive Web App (PWA) Enabled</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Install M3U8 Downloader Pro on Your Device
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Enjoy seamless cross-platform usage and offline access. Install directly to your desktop or mobile home screen without app store downloads. Works 100% offline with zero latency and full file system integration.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> AES-128 Decryption</span>
                <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-400" /> Parallel Worker Pool</span>
                <span className="flex items-center gap-1.5"><Monitor className="w-4 h-4 text-sky-400" /> Windows / macOS / Linux / Android / iOS</span>
              </div>
            </div>

            {/* Install Button in Footer */}
            <div className="flex-shrink-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              {isInstallable && (
                <button
                  onClick={install}
                  className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white font-semibold shadow-lg shadow-indigo-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Download className="w-5 h-5 animate-bounce" />
                  <span>Install Our App (PWA)</span>
                </button>
              )}

              {isIOS && !isInstalled && (
                <button
                  onClick={() => setShowIOSModal(true)}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-700 transition"
                >
                  <Smartphone className="w-4 h-4 text-indigo-400" />
                  <span>Install on iPhone/iPad</span>
                </button>
              )}

              {isInstalled && (
                <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-sm font-medium">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Installed & Running as Standalone PWA</span>
                </div>
              )}

              {!isInstallable && !isIOS && !isInstalled && (
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 px-4 py-2.5 rounded-xl border border-slate-700/50">
                  <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span>Browser PWA ready. Look for the install badge in your browser address bar or use Chrome/Edge/Safari.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Technical Specs & Footer Links */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-4 text-xs">
          <div className="space-y-2 md:col-span-2">
            <h4 className="font-semibold text-white text-sm">About M3U8 Downloader Pro</h4>
            <p className="text-slate-400 leading-relaxed pr-6">
              A modern, GUI adaptation inspired by the command-line <a href="https://github.com/sylecn/m3u8downloader" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">sylecn/m3u8downloader</a> project. Features multi-stream variant extraction, real-time chunk visualization, in-memory stream joining, client/server CORS handling, and instant offline caching.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-white text-sm">Capabilities</h4>
            <ul className="space-y-1.5 text-slate-400">
              <li>• Multi-threaded worker pool (1–16 workers)</li>
              <li>• AES-128 on-the-fly decryption</li>
              <li>• Master playlist multi-quality selection</li>
              <li>• Segment inspector & individual chunk retry</li>
              <li>• In-browser HLS stream player preview</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-white text-sm">Resources</h4>
            <ul className="space-y-1.5 text-slate-400">
              <li>
                <a
                  href="https://github.com/sylecn/m3u8downloader"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-slate-300 hover:text-indigo-400 transition"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>Original Repository</span>
                  <ArrowUpRight className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>• RFC 8216 - HTTP Live Streaming specification</li>
              <li>• PWA Offline Service Worker (CacheFirst / Workbox)</li>
              <li>• In-browser MPEG-TS to MP4 stream remuxing</li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="border-t border-slate-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} M3U8 Downloader Pro GUI. Distributed under Apache-2.0 / MIT.</p>
          <p className="flex items-center gap-1">
            <span>Seamless Cross-Platform PWA</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mx-1"></span>
            <span>Offline Capable</span>
          </p>
        </div>
      </div>

      {/* iOS Modal fallback */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-slate-200">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <h3 className="font-semibold text-white text-base mb-2">Install on iPhone / iPad</h3>
            <p className="text-xs text-slate-400 mb-4">
              Tap the <strong>Share</strong> button in Safari toolbar, then scroll and select <strong>Add to Home Screen</strong>.
            </p>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </footer>
  );
};
