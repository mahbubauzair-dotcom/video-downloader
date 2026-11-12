import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { X, Play, Pause, Volume2, VolumeX, Maximize2, AlertTriangle, Layers, Download, Check } from 'lucide-react';

interface StreamPlayerModalProps {
  url: string;
  title?: string;
  onClose: () => void;
  onDownloadStream?: (url: string) => void;
}

export const StreamPlayerModal: React.FC<StreamPlayerModalProps> = ({
  url,
  title = 'Stream Preview',
  onClose,
  onDownloadStream,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<{ id: number; name: string; resolution: string; bitrate: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = auto
  const [isLive, setIsLive] = useState(false);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const qualityLevels = data.levels.map((lvl, idx) => ({
          id: idx,
          name: lvl.name || `${lvl.height || lvl.width || 'Stream'}p`,
          resolution: lvl.width && lvl.height ? `${lvl.width}x${lvl.height}` : 'Unknown',
          bitrate: Math.round(lvl.bitrate / 1000),
        }));
        setLevels(qualityLevels);
        video.play().catch(() => {
          // Autoplay was prevented by browser policy
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error encountered while loading stream. Make sure CORS is allowed or use Proxy.');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Media error encountered. Attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              setError(`Fatal stream error: ${data.details}`);
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
        setError('Error loading stream in native player.');
      });
    } else {
      setError('HLS playback is not supported in this browser.');
    }
  }, [url]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const handleQualityChange = (levelIndex: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIndex;
    setCurrentLevel(levelIndex);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <div>
              <h3 className="font-semibold text-white text-sm sm:text-base">{title}</h3>
              <p className="text-xs text-slate-400 truncate max-w-md">{url}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onDownloadStream && (
              <button
                onClick={() => {
                  onDownloadStream(url);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download This</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Canvas Container */}
        <div className="relative bg-black aspect-video flex items-center justify-center group">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            playsInline
          />

          {error && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
              <p className="text-sm font-semibold text-white max-w-md">{error}</p>
              <p className="text-xs text-slate-400 mt-2 max-w-sm">
                If the stream has CORS headers blocked by the provider, you can still download it via the Server Proxy mode in the main downloader tab!
              </p>
            </div>
          )}

          {/* Quick overlay controls on hover */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button onClick={toggleMute} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-3">
              {levels.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <select
                    value={currentLevel}
                    onChange={(e) => handleQualityChange(Number(e.target.value))}
                    className="bg-transparent text-white outline-none cursor-pointer"
                  >
                    <option value={-1} className="bg-slate-900 text-white">Auto Quality</option>
                    {levels.map((lvl) => (
                      <option key={lvl.id} value={lvl.id} className="bg-slate-900 text-white">
                        {lvl.resolution} ({lvl.bitrate} kbps)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button onClick={handleFullscreen} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer info in player */}
        <div className="p-3 bg-slate-950 text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span>HLS.js Live Media Engine</span>
          </div>
          <span className="text-slate-500">Click anywhere to play / pause</span>
        </div>
      </div>
    </div>
  );
};
