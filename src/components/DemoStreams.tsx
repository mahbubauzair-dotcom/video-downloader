import React from 'react';
import { Film, Sparkles, Play, Download, ShieldCheck } from 'lucide-react';

interface DemoStream {
  title: string;
  category: string;
  url: string;
  desc: string;
  isMultiQuality?: boolean;
}

const DEMO_STREAMS: DemoStream[] = [
  {
    title: 'Big Buck Bunny (Master)',
    category: 'Multi-Bitrate HLS',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    desc: 'Full adaptive master playlist with 5 resolutions (1080p, 720p, 540p, 360p, 270p)',
    isMultiQuality: true,
  },
  {
    title: 'Tears of Steel (720p)',
    category: 'Sci-Fi Short Film',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    desc: 'High dynamic range multi-chunk MPEG-TS video stream',
    isMultiQuality: true,
  },
  {
    title: 'Sintel Animated Film',
    category: 'Animation HLS',
    url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    desc: 'Open movie standard HLS stream with multi-audio & subtitles',
    isMultiQuality: true,
  },
  {
    title: 'Akamai Test Stream (Single Bitrate)',
    category: 'VOD Stream',
    url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    desc: 'Fast test stream with clean 6-second segments for quick download tests',
    isMultiQuality: true,
  },
];

interface DemoStreamsProps {
  onSelectStream: (url: string) => void;
  onPreviewStream: (url: string, title: string) => void;
}

export const DemoStreams: React.FC<DemoStreamsProps> = ({
  onSelectStream,
  onPreviewStream,
}) => {
  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-indigo-400" />
          <h3 className="font-semibold text-white text-sm">Need a test stream? Try these 1-click samples:</h3>
        </div>
        <span className="text-[11px] text-slate-500 hidden sm:inline">Verified public HLS streams</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {DEMO_STREAMS.map((demo, idx) => (
          <div
            key={idx}
            className="group relative bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-3.5 transition-all flex flex-col justify-between"
          >
            <div className="space-y-1 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-indigo-400 font-semibold uppercase tracking-wider">
                  {demo.category}
                </span>
                {demo.isMultiQuality && (
                  <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                    Adaptive
                  </span>
                )}
              </div>
              <h4 className="font-bold text-white text-xs group-hover:text-indigo-300 transition-colors">
                {demo.title}
              </h4>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {demo.desc}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
              <button
                onClick={() => onPreviewStream(demo.url, demo.title)}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs transition"
                title="Preview in video player"
              >
                <Play className="w-3 h-3" />
              </button>
              <button
                onClick={() => onSelectStream(demo.url)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-medium transition"
              >
                <Download className="w-3 h-3" />
                <span>Load Stream</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
