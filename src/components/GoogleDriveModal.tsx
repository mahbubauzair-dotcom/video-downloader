import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  X,
  FolderOpen,
  FolderPlus,
  Check,
  RefreshCw,
  LogOut,
  ExternalLink,
  HardDrive,
  Cloud,
  AlertCircle,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  createDriveFolder,
  findOrCreateDriveFolder,
  listDriveFolders,
  type DriveFolder,
} from '../utils/googleDrive';

interface GoogleDriveModalProps {
  user: User | null;
  accessToken: string | null;
  selectedFolderId: string;
  selectedFolderName: string;
  downloadDestination: 'gdrive' | 'local';
  alsoSaveLocally: boolean;
  onSignIn: () => Promise<string | null>;
  onSignOut: () => Promise<void>;
  onSelectFolder: (folder: { id: string; name: string }) => void;
  onChangeDestination: (dest: 'gdrive' | 'local', alsoLocal: boolean) => void;
  onClose: () => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  user,
  accessToken,
  selectedFolderId,
  selectedFolderName,
  downloadDestination,
  alsoSaveLocally,
  onSignIn,
  onSignOut,
  onSelectFolder,
  onChangeDestination,
  onClose,
}) => {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const loadFolders = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      let list = await listDriveFolders(token);
      if (list.length === 0) {
        const defaultFolder = await findOrCreateDriveFolder(token, selectedFolderName || 'M3U8 Downloads');
        list = [defaultFolder];
        onSelectFolder({ id: defaultFolder.id, name: defaultFolder.name });
      }
      setFolders(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load Google Drive folders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadFolders(accessToken);
    }
  }, [accessToken]);

  const handleConnect = async () => {
    setSigningIn(true);
    setError(null);
    try {
      const token = await onSignIn();
      if (token) {
        await loadFolders(token);
      }
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newFolderName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const folder = await createDriveFolder(accessToken, newFolderName.trim());
      setFolders((prev) => [folder, ...prev]);
      onSelectFolder({ id: folder.id, name: folder.name });
      setNewFolderName('');
    } catch (err: any) {
      setError(err.message || 'Failed to create folder in Google Drive.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Google Drive Default Folder</h3>
              <p className="text-xs text-slate-400">
                Save downloaded videos directly into your Google Drive folder
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Default Destination Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChangeDestination('gdrive', alsoSaveLocally)}
              className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                downloadDestination === 'gdrive'
                  ? 'bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Cloud className={`w-5 h-5 mt-0.5 ${downloadDestination === 'gdrive' ? 'text-sky-400' : 'text-slate-500'}`} />
              <div>
                <div className="text-xs font-bold text-white">Google Drive (Default)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Uploads directly to /{selectedFolderName || 'M3U8 Downloads'}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onChangeDestination('local', alsoSaveLocally)}
              className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                downloadDestination === 'local'
                  ? 'bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <HardDrive className={`w-5 h-5 mt-0.5 ${downloadDestination === 'local' ? 'text-indigo-400' : 'text-slate-500'}`} />
              <div>
                <div className="text-xs font-bold text-white">Local Device</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Saves directly to browser Downloads folder
                </div>
              </div>
            </button>
          </div>

          {downloadDestination === 'gdrive' && (
            <label className="flex items-center justify-between bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-white block">Also save a local copy</span>
                <span className="text-[11px] text-slate-400">
                  Downloads the merged file to your device in addition to Google Drive
                </span>
              </div>
              <input
                type="checkbox"
                checked={alsoSaveLocally}
                onChange={(e) => onChangeDestination('gdrive', e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4"
              />
            </label>
          )}

          {/* Account Connection Section */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            {!accessToken ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {user ? `Reconnect Google Drive (${user.email})` : 'Connect Your Google Account'}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sign in with Google to choose or create your default Google Drive download folder.
                  </p>
                </div>
                <GoogleSignInButton
                  onClick={handleConnect}
                  disabled={signingIn}
                  label={signingIn ? 'Connecting...' : 'Sign in with Google'}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Google User'}
                      className="w-9 h-9 rounded-full border border-slate-700"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
                      {(user?.email || 'G')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {user?.displayName || 'Google Drive Connected'}
                    </div>
                    <div className="text-[11px] text-emerald-400 truncate">{user?.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadFolders(accessToken)}
                    disabled={loading}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Refresh folders"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 text-xs font-medium transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Folder Management when connected */}
          {accessToken && (
            <div className="space-y-3">
              {/* Create New Folder */}
              <form onSubmit={handleCreateFolder} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Create a new Drive folder (e.g. M3U8 Downloads)"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={creating || !newFolderName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>{creating ? 'Creating...' : 'New Folder'}</span>
                </button>
              </form>

              {/* Folder List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">Select Default Download Folder</span>
                  <span>{folders.length} folder{folders.length === 1 ? '' : 's'}</span>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                  {loading && folders.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">Loading Google Drive folders...</div>
                  ) : (
                    folders.map((folder) => {
                      const isSelected = selectedFolderId === folder.id;
                      return (
                        <div
                          key={folder.id}
                          onClick={() => onSelectFolder({ id: folder.id, name: folder.name })}
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? 'bg-indigo-950/50 border-indigo-500'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FolderOpen
                              className={`w-4 h-4 flex-shrink-0 ${
                                isSelected ? 'text-indigo-400' : 'text-slate-400'
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate">{folder.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">ID: {folder.id}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {folder.webViewLink && (
                              <a
                                href={folder.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                title="Open folder in Google Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {isSelected && (
                              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold">
                                <Check className="w-3 h-3" />
                                <span>Default</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
