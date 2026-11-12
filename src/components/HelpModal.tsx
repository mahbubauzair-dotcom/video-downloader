import React from 'react';
import { X, HelpCircle, Terminal, Shield, Download, Smartphone, Zap, CheckCircle2 } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">M3U8 Downloader Pro Guide</h3>
              <p className="text-xs text-slate-400">Features, tips, and troubleshooting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-300 text-xs sm:text-sm">
          {/* Section 1: Finding M3U8 */}
          <div className="space-y-2">
            <h4 className="font-bold text-white flex items-center gap-2 text-sm">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>1. How to capture an M3U8 URL from any website</span>
            </h4>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-slate-300">
              <p>1. Open the video page in Chrome, Firefox, or Edge.</p>
              <p>2. Press <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300 font-mono">F12</code> or right click and choose <strong>Inspect</strong>, then switch to the <strong>Network</strong> tab.</p>
              <p>3. Type <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300 font-mono">m3u8</code> in the filter box and start playing the video.</p>
              <p>4. Right-click the `.m3u8` request, choose <strong>Copy &gt; Copy link address</strong>, and paste it into this app!</p>
            </div>
          </div>

          {/* Section 2: Concurrency & Engine */}
          <div className="space-y-2">
            <h4 className="font-bold text-white flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>2. Multi-threaded Parallel Downloading (sylecn/m3u8downloader)</span>
            </h4>
            <p className="text-slate-400 leading-relaxed">
              Standard browsers download one chunk at a time. This app spawns a configurable worker pool (up to 16 concurrent threads) just like the original CLI tool. It fetches chunks in parallel, verifies each segment's integrity, and auto-retries on connection drops.
            </p>
          </div>

          {/* Section 3: AES-128 Encryption */}
          <div className="space-y-2">
            <h4 className="font-bold text-white flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>3. AES-128 Stream Decryption</span>
            </h4>
            <p className="text-slate-400 leading-relaxed">
              When an HLS stream specifies <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-200 font-mono">#EXT-X-KEY:METHOD=AES-128</code>, the downloader automatically acquires the decryption key and utilizes the browser's hardware-accelerated WebCrypto engine to decrypt every chunk on-the-fly before concatenation.
            </p>
          </div>

          {/* Section 4: PWA Offline */}
          <div className="space-y-2">
            <h4 className="font-bold text-white flex items-center gap-2 text-sm">
              <Smartphone className="w-4 h-4 text-sky-400" />
              <span>4. PWA Installation & Offline Access</span>
            </h4>
            <p className="text-slate-400 leading-relaxed">
              Click the <strong>Install App</strong> button in the Header or Footer to install M3U8 Downloader Pro on Windows, Mac, Linux, Android, or iOS. All core assets are cached via a Service Worker, allowing the interface to launch instantly even when you have no internet access.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
