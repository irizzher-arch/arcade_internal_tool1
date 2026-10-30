import React, { useState } from 'react';
import { X, Check, RotateCcw, Sliders } from 'lucide-react';
import { PointSettings } from '../types/tournament';
import { OFFICIAL_BGMI_10_POINT, CLASSIC_15_POINT } from '../utils/scoring';

interface PointSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pointSettings: PointSettings;
  setPointSettings: (settings: PointSettings) => void;
}

export const PointSettingsModal: React.FC<PointSettingsModalProps> = ({
  isOpen,
  onClose,
  pointSettings,
  setPointSettings,
}) => {
  if (!isOpen) return null;

  const [current, setCurrent] = useState<PointSettings>({ ...pointSettings });

  const handlePlacementChange = (rank: number, val: string) => {
    const num = parseInt(val, 10);
    setCurrent((prev) => ({
      ...prev,
      placements: {
        ...prev.placements,
        [rank]: isNaN(num) ? 0 : num,
      },
    }));
  };

  const handleApply = () => {
    setPointSettings(current);
    onClose();
  };

  const handleLoadPreset = (preset: PointSettings) => {
    setCurrent({ ...preset });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h3 className="font-display font-bold text-lg text-white">
              Point Matrix & Scoring Rules
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Preset Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Quick Point System Presets
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleLoadPreset(OFFICIAL_BGMI_10_POINT)}
                className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-all ${
                  current.name.includes('10-Point')
                    ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                Official BGMI 10-Point
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  1st=10, 2nd=6, 3rd=5, 4th=4...
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleLoadPreset(CLASSIC_15_POINT)}
                className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-all ${
                  current.name.includes('15-Point')
                    ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                Classic 15-Point System
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  1st=15, 2nd=12, 3rd=10, 4th=8...
                </span>
              </button>
            </div>
          </div>

          {/* Kill Multiplier */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Kill Points Multiplier
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={5}
                value={current.killMultiplier}
                onChange={(e) =>
                  setCurrent({
                    ...current,
                    killMultiplier: Math.max(1, parseInt(e.target.value, 10) || 1),
                  })
                }
                className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-amber-400 focus:outline-none"
              />
              <span className="text-xs text-slate-400">point(s) awarded per kill</span>
            </div>
          </div>

          {/* Placement Points Grid */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Custom Placement Points Table
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
              {Array.from({ length: 16 }, (_, i) => i + 1).map((rank) => (
                <div
                  key={rank}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800"
                >
                  <span className="text-xs font-mono font-bold text-slate-400">#{rank}</span>
                  <input
                    type="number"
                    min={0}
                    value={current.placements[rank] ?? 0}
                    onChange={(e) => handlePlacementChange(rank, e.target.value)}
                    className="w-12 text-right bg-slate-900 border border-slate-700/60 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-amber-400 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleLoadPreset(OFFICIAL_BGMI_10_POINT)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
            >
              <Check className="w-4 h-4" />
              Apply Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
