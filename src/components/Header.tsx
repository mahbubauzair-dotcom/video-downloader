import React, { useState } from 'react';
import { Download, Wifi, WifiOff, Settings, History, HelpCircle, Sparkles, Smartphone, Check, ExternalLink } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenHelp: () => void;
  activeDownloadsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenHistory,
  onOpenHelp,
  activeDownloadsCount,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showIOSModal, setShowIOSModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Download className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
              {activeDownloadsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-md">
                  {activeDownloadsCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
                  M3U8 Downloader <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono font-medium">Pro GUI</span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Based on <a href="https://github.com/sylecn/m3u8downloader" target="_blank" rel="noreferrer" className="text-slate-300 hover:text-indigo-400 underline decoration-slate-600 underline-offset-2 transition-colors">sylecn/m3u8downloader</a> with high-speed parallel workers
              </p>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Online / Offline status */}
            <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
            }`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'Network Online' : 'Offline Mode'}</span>
            </div>

            {/* HEADER PWA INSTALL BUTTON (USER SPECIFIED REQUIREMENT) */}
            {isInstallable && (
              <button
                onClick={install}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-600 hover:to-sky-600 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-500/25 transition-all active:scale-95"
                title="Install M3U8 Downloader Pro on your device for seamless offline access"
              >
                <Smartphone className="w-4 h-4" />
                <span className="font-medium">Install App</span>
                <span className="hidden lg:inline text-[11px] bg-white/20 px-1.5 py-0.2 rounded font-mono">PWA</span>
              </button>
            )}

            {isIOS && !isInstalled && (
              <button
                onClick={() => setShowIOSModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 text-xs font-medium transition"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Install on iOS</span>
              </button>
            )}

            {isInstalled && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 text-xs font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>PWA Installed</span>
              </div>
            )}

            {/* History Button */}
            <button
              onClick={onOpenHistory}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition"
              title="Download History"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition"
              title="Downloader Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Help / Guide */}
            <button
              onClick={onOpenHelp}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition"
              title="How to use & Tips"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* iOS Safari Installation Instruction Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Install on iPhone / iPad</h3>
                <p className="text-xs text-slate-400">Native fullscreen webapp</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center text-xs font-bold">1</span>
                <span>Tap the <strong>Share</strong> icon in the bottom Safari toolbar.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center text-xs font-bold">2</span>
                <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center text-xs font-bold">3</span>
                <span>Launch directly from your home screen with offline capability!</span>
              </div>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-sm font-medium text-white transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
