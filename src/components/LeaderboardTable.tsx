import React, { useState } from 'react';
import {
  Trophy,
  Download,
  FileSpreadsheet,
  Printer,
  Search,
  ChevronDown,
  ChevronRight,
  Flame,
  Crosshair,
  Sparkles,
  Edit2,
  Check,
  RotateCcw,
  PlusCircle,
} from 'lucide-react';
import {
  LeaderboardEntry,
  MatchData,
  PlayerLeaderboardEntry,
  PointSettings,
} from '../types/tournament';
import { exportTournamentToExcel, exportElementToHDImage, exportToPDF } from '../utils/exportUtils';
import confetti from 'canvas-confetti';

interface LeaderboardTableProps {
  leaderboard: LeaderboardEntry[];
  matches: MatchData[];
  topFraggers: PlayerLeaderboardEntry[];
  pointSettings: PointSettings;
  tournamentName: string;
  setTournamentName: (name: string) => void;
  onUpdateTeamMatchStat: (
    slot: number,
    matchNumber: number,
    newPlacement: number,
    newKills: number
  ) => void;
  onViewGraphicCard: () => void;
  onOpenNewTournament?: () => void;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  leaderboard,
  matches,
  topFraggers,
  pointSettings,
  tournamentName,
  setTournamentName,
  onUpdateTeamMatchStat,
  onViewGraphicCard,
  onOpenNewTournament,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSlots, setExpandedSlots] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{
    slot: number;
    matchNumber: number;
    type: 'placement' | 'kills';
    value: string;
  } | null>(null);
  const [isExportingImage, setIsExportingImage] = useState(false);

  const toggleExpand = (slot: number) => {
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  };

  const filteredEntries = leaderboard.filter(
    (e) =>
      e.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.slot.toString() === searchTerm
  );

  const handleStartEdit = (
    slot: number,
    matchNumber: number,
    type: 'placement' | 'kills',
    currentVal: number
  ) => {
    setEditingCell({
      slot,
      matchNumber,
      type,
      value: currentVal.toString(),
    });
  };

  const handleSaveEdit = (slot: number, matchNumber: number) => {
    if (!editingCell) return;
    const num = parseInt(editingCell.value, 10);
    if (isNaN(num) || num < 0) {
      setEditingCell(null);
      return;
    }

    const teamEntry = leaderboard.find((e) => e.slot === slot);
    const matchRecord = teamEntry?.matches.find((m) => m.matchNumber === matchNumber);
    const currentPlacement = matchRecord?.placement || 16;
    const currentKills = matchRecord?.kills || 0;

    if (editingCell.type === 'placement') {
      onUpdateTeamMatchStat(slot, matchNumber, num, currentKills);
      if (num === 1) {
        // Trigger celebratory confetti for 1st place / WWCD
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      }
    } else {
      onUpdateTeamMatchStat(slot, matchNumber, currentPlacement, num);
    }
    setEditingCell(null);
  };

  const handleExportImage = async () => {
    setIsExportingImage(true);
    try {
      await exportElementToHDImage('leaderboard-export-container', `${tournamentName}_Points_Table`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExportingImage(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar with Tournament Title & Instant Export Actions */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              className="font-display font-extrabold text-xl sm:text-2xl text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-400 focus:outline-none max-w-md"
              title="Click to rename tournament"
            />
            <Edit2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          </div>
          <p className="text-xs text-slate-400">
            Official Scoring: <span className="text-amber-400 font-medium">{pointSettings.name}</span> · {matches.length} matches tabulated
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenNewTournament && (
            <button
              onClick={onOpenNewTournament}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 shadow-sm shadow-amber-500/20 transition-all"
              title="Start a new tournament"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New Tournament
            </button>
          )}

          <button
            onClick={onViewGraphicCard}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Streamer Graphic Card
          </button>

          <button
            onClick={handleExportImage}
            disabled={isExportingImage}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all"
            title="Download Full HD PNG image for Discord / WhatsApp"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            {isExportingImage ? 'Generating...' : 'HD Image'}
          </button>

          <button
            onClick={() => exportTournamentToExcel(leaderboard, matches, topFraggers, tournamentName)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 flex items-center gap-1.5 transition-all"
            title="Download multi-sheet Excel file (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Excel (.xlsx)
          </button>

          <button
            onClick={exportToPDF}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-all"
            title="Print or save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search team name or slot number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-3">
          <span>
            Click on any <span className="text-amber-400 font-semibold underline">kills</span> or{' '}
            <span className="text-amber-400 font-semibold underline">placement</span> to edit cell directly.
          </span>
        </div>
      </div>

      {/* Main Leaderboard Table Container (Target for HD Screenshot) */}
      <div
        id="leaderboard-export-container"
        className="p-5 rounded-xl lantern-glow-card shadow-2xl overflow-hidden"
      >
        {/* Esports Brand Header on Card */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#3e0c0d]">
          <div>
            <span className="text-[11px] font-mono tracking-widest text-[#f5b76f] font-bold uppercase">
              Official Points Standings
            </span>
            <h3 className="text-xl font-heading font-extrabold text-white tracking-wider">
              {tournamentName}
            </h3>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-mono text-[#cb7349] block">
              Tiebreaker: Total Pts → Kills → WWCDs → Best Finish
            </span>
            <span className="text-xs font-mono font-semibold text-[#f5b76f]">
              Matches Completed: {matches.length}
            </span>
          </div>
        </div>

        {/* Tabular Numerals Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px] font-mono uppercase tracking-wider bg-slate-950/60">
                <th className="py-3 px-3 text-center w-12">Rank</th>
                <th className="py-3 px-2 text-center w-12">Slot</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-3 text-center">Matches</th>
                <th className="py-3 px-3 text-center">WWCD</th>
                {matches.map((m) => (
                  <th key={m.id} className="py-3 px-2 text-center font-mono" title={`Match ${m.matchNumber} (${m.mapName})`}>
                    M{m.matchNumber}
                  </th>
                ))}
                <th className="py-3 px-3 text-right">Place Pts</th>
                <th className="py-3 px-3 text-right">Kill Pts</th>
                <th className="py-3 px-4 text-right font-bold text-amber-400">Total Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono-nums">
              {filteredEntries.map((entry) => {
                const isPodium = entry.rank <= 3;
                const isExpanded = expandedSlots.has(entry.slot);

                // Podium styles
                let rankBadge = (
                  <span className="font-mono text-slate-400 font-bold text-xs">{entry.rank}</span>
                );
                if (entry.rank === 1) {
                  rankBadge = (
                    <div className="w-6 h-6 rounded bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center mx-auto shadow-md shadow-amber-500/40">
                      1
                    </div>
                  );
                } else if (entry.rank === 2) {
                  rankBadge = (
                    <div className="w-6 h-6 rounded bg-slate-300 text-slate-950 font-black text-xs flex items-center justify-center mx-auto shadow-md shadow-slate-300/30">
                      2
                    </div>
                  );
                } else if (entry.rank === 3) {
                  rankBadge = (
                    <div className="w-6 h-6 rounded bg-amber-700 text-slate-100 font-black text-xs flex items-center justify-center mx-auto shadow-md shadow-amber-700/30">
                      3
                    </div>
                  );
                }

                return (
                  <React.Fragment key={entry.slot}>
                    <tr
                      className={`hover:bg-slate-800/40 transition-colors ${
                        entry.rank === 1 ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-3 text-center">{rankBadge}</td>

                      {/* Slot */}
                      <td className="py-3.5 px-2 text-center font-mono text-xs text-slate-400">
                        {entry.slot}
                      </td>

                      {/* Team Name */}
                      <td className="py-3.5 px-4 font-sans">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleExpand(entry.slot)}
                            className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                            title="Expand player kills breakdown"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="font-bold text-white tracking-wide text-xs sm:text-sm">
                            {entry.teamName}
                          </span>
                        </div>
                      </td>

                      {/* Matches */}
                      <td className="py-3.5 px-3 text-center text-xs text-slate-400">
                        {entry.matchesPlayed}
                      </td>

                      {/* WWCD Chicken Dinners */}
                      <td className="py-3.5 px-3 text-center">
                        {entry.wwcdCount > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-400 text-xs px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                            🍗 {entry.wwcdCount}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">-</span>
                        )}
                      </td>

                      {/* Match-by-match columns (Editable inline!) */}
                      {matches.map((m) => {
                        const rec = entry.matches.find((r) => r.matchNumber === m.matchNumber);
                        const place = rec ? rec.placement : '-';
                        const kills = rec ? rec.kills : 0;

                        const isEditingPlace =
                          editingCell?.slot === entry.slot &&
                          editingCell?.matchNumber === m.matchNumber &&
                          editingCell?.type === 'placement';

                        const isEditingKills =
                          editingCell?.slot === entry.slot &&
                          editingCell?.matchNumber === m.matchNumber &&
                          editingCell?.type === 'kills';

                        return (
                          <td key={m.id} className="py-3.5 px-2 text-center text-xs">
                            {rec ? (
                              <div className="inline-flex flex-col items-center">
                                {/* Placement */}
                                {isEditingPlace ? (
                                  <input
                                    type="number"
                                    autoFocus
                                    value={editingCell.value}
                                    onChange={(e) =>
                                      setEditingCell({ ...editingCell, value: e.target.value })
                                    }
                                    onBlur={() => handleSaveEdit(entry.slot, m.matchNumber)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit(entry.slot, m.matchNumber);
                                      if (e.key === 'Escape') setEditingCell(null);
                                    }}
                                    className="w-12 bg-slate-950 border border-amber-400 rounded text-center text-amber-300 font-bold text-xs p-0.5 focus:outline-none"
                                  />
                                ) : (
                                  <span
                                    onClick={() =>
                                      handleStartEdit(entry.slot, m.matchNumber, 'placement', rec.placement)
                                    }
                                    className={`font-semibold cursor-pointer hover:underline ${
                                      rec.placement === 1
                                        ? 'text-amber-400'
                                        : rec.placement <= 3
                                        ? 'text-slate-200'
                                        : 'text-slate-400'
                                    }`}
                                    title="Click to edit match placement"
                                  >
                                    #{rec.placement}
                                  </span>
                                )}

                                {/* Kills */}
                                {isEditingKills ? (
                                  <input
                                    type="number"
                                    autoFocus
                                    value={editingCell.value}
                                    onChange={(e) =>
                                      setEditingCell({ ...editingCell, value: e.target.value })
                                    }
                                    onBlur={() => handleSaveEdit(entry.slot, m.matchNumber)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEdit(entry.slot, m.matchNumber);
                                      if (e.key === 'Escape') setEditingCell(null);
                                    }}
                                    className="w-12 bg-slate-950 border border-amber-400 rounded text-center text-amber-300 font-bold text-xs p-0.5 focus:outline-none"
                                  />
                                ) : (
                                  <span
                                    onClick={() =>
                                      handleStartEdit(entry.slot, m.matchNumber, 'kills', rec.kills)
                                    }
                                    className="text-[10px] text-slate-500 cursor-pointer hover:text-amber-300"
                                    title="Click to edit team kills"
                                  >
                                    ({rec.kills}k)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-700 text-xs">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Placement Points */}
                      <td className="py-3.5 px-3 text-right font-medium text-slate-300">
                        {entry.placementPoints}
                      </td>

                      {/* Kill Points */}
                      <td className="py-3.5 px-3 text-right font-medium text-slate-300">
                        {entry.killPoints}
                      </td>

                      {/* Total Points */}
                      <td className="py-3.5 px-4 text-right font-extrabold text-sm text-amber-400">
                        {entry.totalPoints}
                      </td>
                    </tr>

                    {/* Expandable Player Kill Breakdown Row */}
                    {isExpanded && (
                      <tr className="bg-slate-950/70 border-b border-slate-800/80">
                        <td colSpan={6 + matches.length} className="py-3 px-6">
                          <div className="flex flex-wrap items-center gap-4 text-xs font-sans">
                            <span className="text-slate-400 font-semibold flex items-center gap-1.5 font-mono">
                              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                              Player Kills Breakdown:
                            </span>

                            {entry.playerKills.length > 0 ? (
                              entry.playerKills.map((p) => (
                                <div
                                  key={p.name}
                                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono"
                                >
                                  <span>{p.name}</span>
                                  <span className="font-bold text-amber-400">({p.kills}k)</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-slate-500 italic">
                                No individual player scoreboard details captured.
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={7 + matches.length} className="py-12 text-center text-slate-500 font-mono text-xs">
                    No teams or match records found. Upload scoreboard screenshots in the "Scoreboard OCR" tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
