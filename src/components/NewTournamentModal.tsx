import React, { useState } from 'react';
import { X, PlusCircle, Trophy, Sparkles, Check, AlertCircle } from 'lucide-react';
import { PointSettings, TeamRoster } from '../types/tournament';
import { OFFICIAL_BGMI_10_POINT, CLASSIC_15_POINT } from '../utils/scoring';
import { SAMPLE_BGIS_ROSTERS, SAMPLE_20_TEAM_ROSTERS } from '../utils/presets';

interface NewTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmNewTournament: (config: {
    tournamentName: string;
    stageName: string;
    pointSettings: PointSettings;
    rosters: TeamRoster[];
    clearMatches: boolean;
  }) => void;
}

export const NewTournamentModal: React.FC<NewTournamentModalProps> = ({
  isOpen,
  onClose,
  onConfirmNewTournament,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('BGMI Community Scrims');
  const [stage, setStage] = useState('Grand Finals · Day 1');
  const [format, setFormat] = useState<'16-teams' | '20-teams' | 'blank'>('16-teams');
  const [scoringPreset, setScoringPreset] = useState<'10-point' | '15-point'>('10-point');
  const [clearMatches, setClearMatches] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let initialRosters: TeamRoster[] = [];
    if (format === '16-teams') {
      initialRosters = SAMPLE_BGIS_ROSTERS;
    } else if (format === '20-teams') {
      initialRosters = SAMPLE_20_TEAM_ROSTERS;
    } else {
      // Create empty slots 1 to 16
      initialRosters = Array.from({ length: 16 }, (_, i) => ({
        slot: i + 1,
        teamName: `Slot ${i + 1}`,
        players: [],
      }));
    }

    const points = scoringPreset === '10-point' ? OFFICIAL_BGMI_10_POINT : CLASSIC_15_POINT;

    onConfirmNewTournament({
      tournamentName: name.trim(),
      stageName: stage.trim(),
      pointSettings: points,
      rosters: initialRosters,
      clearMatches,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-white">
                Start New Tournament
              </h3>
              <p className="text-xs text-slate-400">
                Configure event details, lobby sizing, and scoring rules
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tournament Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Tournament / Event Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BGIS 2026 Semifinals, Tier 1 Night Scrims"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Stage / Day / Subtitle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Stage / Round / Subtitle (Optional)
            </label>
            <input
              type="text"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              placeholder="e.g. Grand Finals · Day 1 or Group A Matches"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Lobby Sizing Format */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Initial Lobby Setup
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('16-teams')}
                className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                  format === '16-teams'
                    ? 'border-amber-400 bg-amber-500/10 text-amber-300 font-bold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                16-Team Preset
                <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                  BGIS Rosters
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('20-teams')}
                className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                  format === '20-teams'
                    ? 'border-amber-400 bg-amber-500/10 text-amber-300 font-bold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                20-Team Preset
                <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                  Extended Scrims
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('blank')}
                className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                  format === 'blank'
                    ? 'border-amber-400 bg-amber-500/10 text-amber-300 font-bold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                Blank Slots
                <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                  Slot 1 - 16 Empty
                </span>
              </button>
            </div>
          </div>

          {/* Scoring Rules Preset */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Scoring System
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScoringPreset('10-point')}
                className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-all ${
                  scoringPreset === '10-point'
                    ? 'border-amber-400 bg-amber-500/10 text-amber-300 font-bold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                Official 10-Point System
                <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                  10-6-5-4-3-2-1-1-0 (Standard)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScoringPreset('15-point')}
                className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-all ${
                  scoringPreset === '15-point'
                    ? 'border-amber-400 bg-amber-500/10 text-amber-300 font-bold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                Classic 15-Point System
                <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                  15-12-10-8-6-4-2-1
                </span>
              </button>
            </div>
          </div>

          {/* Clear Previous Matches Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={clearMatches}
                onChange={(e) => setClearMatches(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500/30 bg-slate-900 border-slate-700"
              />
              <div>
                <span className="text-xs font-semibold text-white block">
                  Clear existing match scoreboards
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Start fresh with 0 matches recorded for this tournament.
                </span>
              </div>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
            >
              <Check className="w-4 h-4" />
              Start Tournament
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
