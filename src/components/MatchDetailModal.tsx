import React, { useState } from 'react';
import { X, Check, Trash2, Plus, Crosshair, MapPin } from 'lucide-react';
import { MatchData, TeamMatchStanding } from '../types/tournament';

interface MatchDetailModalProps {
  match: MatchData | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveMatch: (updatedMatch: MatchData) => void;
}

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  match,
  isOpen,
  onClose,
  onSaveMatch,
}) => {
  if (!isOpen || !match) return null;

  const [mapName, setMapName] = useState(match.mapName || 'Erangel');
  const [standings, setStandings] = useState<TeamMatchStanding[]>(
    [...match.standings].sort((a, b) => a.placement - b.placement)
  );

  const handleUpdatePlacement = (index: number, val: string) => {
    const num = parseInt(val, 10);
    const updated = [...standings];
    updated[index].placement = isNaN(num) ? 0 : num;
    setStandings(updated);
  };

  const handleUpdateKills = (index: number, val: string) => {
    const num = parseInt(val, 10);
    const updated = [...standings];
    updated[index].kills = isNaN(num) ? 0 : num;
    setStandings(updated);
  };

  const handleUpdateTeamName = (index: number, name: string) => {
    const updated = [...standings];
    updated[index].teamName = name;
    setStandings(updated);
  };

  const handleRemoveRow = (index: number) => {
    setStandings(standings.filter((_, i) => i !== index));
  };

  const handleAddRow = () => {
    const nextPlace = standings.length + 1;
    setStandings([
      ...standings,
      {
        placement: nextPlace,
        slot: nextPlace,
        teamName: `Slot ${nextPlace}`,
        kills: 0,
        players: [],
      },
    ]);
  };

  const handleSave = () => {
    onSaveMatch({
      ...match,
      mapName,
      standings: standings.sort((a, b) => a.placement - b.placement),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 font-mono font-bold flex items-center justify-center border border-amber-500/30">
              #{match.matchNumber}
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-white">
                Match #{match.matchNumber} Scoreboard
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {match.fileName || 'Screenshot OCR Result'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Map selection */}
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-amber-400" />
            <label className="text-xs font-semibold text-slate-300">Map Name:</label>
            <select
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-400"
            >
              <option value="Erangel">Erangel</option>
              <option value="Miramar">Miramar</option>
              <option value="Sanhok">Sanhok</option>
              <option value="Vikendi">Vikendi</option>
              <option value="Nusa">Nusa</option>
            </select>
          </div>

          {/* Standings table */}
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5 px-3 text-center w-14">Place</th>
                  <th className="py-2.5 px-2 text-center w-12">Slot</th>
                  <th className="py-2.5 px-3">Team Name</th>
                  <th className="py-2.5 px-3 text-center w-20">Kills</th>
                  <th className="py-2.5 px-2 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono-nums">
                {standings.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        value={s.placement}
                        onChange={(e) => handleUpdatePlacement(idx, e.target.value)}
                        className="w-10 bg-slate-900 border border-slate-800 rounded text-center text-xs font-bold text-amber-400 p-0.5"
                      />
                    </td>
                    <td className="py-2 px-2 text-center text-slate-400">{s.slot || idx + 1}</td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={s.teamName}
                        onChange={(e) => handleUpdateTeamName(idx, e.target.value)}
                        className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-400 text-white font-sans font-semibold text-xs p-0.5 focus:outline-none"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        value={s.kills}
                        onChange={(e) => handleUpdateKills(idx, e.target.value)}
                        className="w-12 bg-slate-900 border border-slate-800 rounded text-center text-xs text-slate-200 font-bold p-0.5"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => handleRemoveRow(idx)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleAddRow}
            className="w-full py-2 rounded-lg border border-dashed border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-400 hover:text-amber-400 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Team Row to Match
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
          >
            <Check className="w-4 h-4" />
            Save Match Changes
          </button>
        </div>
      </div>
    </div>
  );
};
