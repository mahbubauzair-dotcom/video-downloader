import React from 'react';
import { DownloadSettings } from '../types/m3u8';
import { X, Sliders, Shield, Globe, Key, Clock, FileCode, Check, Cloud, HardDrive, FolderOpen } from 'lucide-react';

interface SettingsModalProps {
  settings: DownloadSettings;
  onSave: (newSettings: DownloadSettings) => void;
  onOpenDriveSettings: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSave,
  onOpenDriveSettings,
  onClose,
}) => {
  const [formData, setFormData] = React.useState<DownloadSettings>({ ...settings });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Downloader Engine Settings</h3>
              <p className="text-xs text-slate-400">Configure concurrency, retries, proxy & headers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* Worker Pool Concurrency */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>Parallel Concurrency Workers</span>
                <span className="text-indigo-400 font-mono">({formData.concurrency} workers)</span>
              </label>
              <span className="text-[11px] text-slate-400">Default: 6</span>
            </div>
            <input
              type="range"
              min={1}
              max={16}
              value={formData.concurrency}
              onChange={(e) => setFormData({ ...formData, concurrency: Number(e.target.value) })}
              className="w-full accent-indigo-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-400">
              Controls simultaneous segment downloads. Higher values increase speed but require more bandwidth.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Max Retries */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200">Max Retries per Segment</label>
              <input
                type="number"
                min={1}
                max={10}
                value={formData.maxRetries}
                onChange={(e) => setFormData({ ...formData, maxRetries: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Timeout in seconds */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200">Timeout (Seconds)</label>
              <input
                type="number"
                min={5}
                max={120}
                value={Math.round(formData.timeoutMs / 1000)}
                onChange={(e) => setFormData({ ...formData, timeoutMs: Number(e.target.value) * 1000 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* CORS Proxy Mode */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-400" />
                <div>
                  <span className="text-xs font-semibold text-white block">Server-Side CORS Proxy</span>
                  <span className="text-[11px] text-slate-400">Bypasses browser cross-origin blocks</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.useProxy}
                  onChange={(e) => setFormData({ ...formData, useProxy: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Default Download Destination */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-sky-400" />
                <div>
                  <span className="text-xs font-semibold text-white block">Default Download Destination</span>
                  <span className="text-[11px] text-slate-400">
                    {formData.downloadDestination === 'gdrive'
                      ? `Google Drive / ${formData.googleDriveFolderName || 'M3U8 Downloads'}`
                      : 'Local Browser Downloads'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSave(formData);
                  onClose();
                  onOpenDriveSettings();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-semibold transition"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Configure Drive</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, downloadDestination: 'gdrive' })}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                  formData.downloadDestination === 'gdrive'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cloud className="w-3.5 h-3.5 text-sky-400" />
                <span>Google Drive</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, downloadDestination: 'local' })}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                  formData.downloadDestination === 'local'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                <span>Local Device</span>
              </button>
            </div>

            {formData.downloadDestination === 'gdrive' && (
              <label className="flex items-center justify-between pt-1 cursor-pointer">
                <span className="text-[11px] text-slate-300">Also save a local copy to device</span>
                <input
                  type="checkbox"
                  checked={formData.alsoSaveLocally}
                  onChange={(e) => setFormData({ ...formData, alsoSaveLocally: e.target.checked })}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                />
              </label>
            )}
          </div>

          {/* Custom Headers */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>Anti-Hotlinking & Custom Headers</span>
            </h4>

            <div className="space-y-2">
              <label className="text-xs text-slate-300">Custom Referer (e.g. streaming site URL)</label>
              <input
                type="text"
                placeholder="https://example.com/player"
                value={formData.customReferer}
                onChange={(e) => setFormData({ ...formData, customReferer: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-300">Custom User-Agent</label>
              <input
                type="text"
                placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
                value={formData.customUserAgent}
                onChange={(e) => setFormData({ ...formData, customUserAgent: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-300">Cookie / Session Token (Optional)</label>
              <input
                type="text"
                placeholder="session_id=...; auth_token=..."
                value={formData.customCookie}
                onChange={(e) => setFormData({ ...formData, customCookie: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Apply Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
