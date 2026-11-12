import React from 'react';
import { M3U8Variant } from '../types/m3u8';
import { Layers, Play, Download, Sparkles, Check } from 'lucide-react';

interface VariantSelectorProps {
  variants: M3U8Variant[];
  selectedVariantUrl: string | null;
  onSelectVariant: (variantUrl: string) => void;
  onPreviewVariant: (variantUrl: string, title: string) => void;
}

export const VariantSelector: React.FC<VariantSelectorProps> = ({
  variants,
  selectedVariantUrl,
  onSelectVariant,
  onPreviewVariant,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Multi-Quality Master Stream Detected</h3>
            <p className="text-xs text-slate-400">
              Select your desired stream resolution and bitrate to inspect or download
            </p>
          </div>
        </div>
        <span className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-full font-mono">
          {variants.length} Qualities Available
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {variants.map((v, idx) => {
          const isSelected = selectedVariantUrl === v.uri;
          const bitrateKbps = v.bandwidth ? Math.round(v.bandwidth / 1000) : null;
          const bitrateDisplay = bitrateKbps
            ? bitrateKbps > 1000
              ? `${(bitrateKbps / 1000).toFixed(1)} Mbps`
              : `${bitrateKbps} kbps`
            : 'Variable';

          const resolution = v.resolution || 'Auto / Audio';
          const isHighest = idx === 0 || (v.resolution && v.resolution.includes('1080'));

          return (
            <div
              key={idx}
              className={`relative rounded-xl border p-4 transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/30'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
              }`}
            >
              {isHighest && (
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  <span>HQ</span>
                </div>
              )}

              <div className="space-y-1 mb-3">
                <span className="text-lg font-bold text-white tracking-tight">{resolution}</span>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span className="font-mono text-indigo-300">{bitrateDisplay}</span>
                  {v.codecs && <span className="truncate max-w-[120px] text-slate-500 font-mono text-[10px]">({v.codecs})</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                <button
                  onClick={() => onPreviewVariant(v.uri, `${resolution} Stream Preview`)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                  title="Preview in video player"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onSelectVariant(v.uri)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800 hover:bg-indigo-600/30 text-slate-200 hover:text-white'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Selected</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Select Stream</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
