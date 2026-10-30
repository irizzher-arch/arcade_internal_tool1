import React, { useState } from 'react';
import {
  Trophy,
  Flame,
  Crown,
  Download,
  Share2,
  Crosshair,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import {
  LeaderboardEntry,
  MatchData,
  PlayerLeaderboardEntry,
} from '../types/tournament';
import { exportElementToHDImage } from '../utils/exportUtils';

interface StreamerGraphicCardProps {
  leaderboard: LeaderboardEntry[];
  matches: MatchData[];
  topFraggers: PlayerLeaderboardEntry[];
  tournamentName: string;
  onBackToTable: () => void;
}

export const StreamerGraphicCard: React.FC<StreamerGraphicCardProps> = ({
  leaderboard,
  matches,
  topFraggers,
  tournamentName,
  onBackToTable,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const mvpPlayer = topFraggers.length > 0 ? topFraggers[0] : null;
  const rank1 = leaderboard[0];
  const rank2 = leaderboard[1];
  const rank3 = leaderboard[2];

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      await exportElementToHDImage('streamer-card-target', `${tournamentName}_Streamer_Card`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between p-4 rounded-xl lantern-glow-card">
        <button
          onClick={onBackToTable}
          className="text-xs font-semibold text-[#f5b76f] hover:text-white flex items-center gap-1.5 transition-colors font-sans"
        >
          <ArrowLeft className="w-4 h-4 text-[#cb7349]" />
          Back to Editable Table
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg text-xs font-bold diya-button-glow flex items-center gap-2 transition-all font-sans"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting HD PNG...' : 'Download Full HD Graphic'}
          </button>
        </div>
      </div>

      {/* The Printable / Downloadable Esports Broadcast Graphic Container */}
      <div className="overflow-x-auto pb-4">
        <div
          id="streamer-card-target"
          className="min-w-[960px] max-w-[1200px] mx-auto p-8 rounded-2xl bg-[#140404] border-2 border-[#cb7349]/50 shadow-2xl relative overflow-hidden space-y-6"
          style={{
            backgroundImage: `
              radial-gradient(circle at 10% 10%, rgba(203, 115, 73, 0.18) 0%, transparent 45%),
              radial-gradient(circle at 90% 10%, rgba(245, 183, 111, 0.15) 0%, transparent 45%),
              radial-gradient(circle at 50% 90%, rgba(76, 10, 21, 0.6) 0%, transparent 60%)
            `,
          }}
        >
          {/* Diwali Diya & Lantern Glowing Orbs */}
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#cb7349]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-[#4a0e13]/50 rounded-full blur-3xl pointer-events-none" />

          {/* 1. Header Banner */}
          <div className="relative z-10 flex items-center justify-between border-b border-[#3e0c0d] pb-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#cb7349] to-[#4a0e13] flex items-center justify-center shadow-lg shadow-[#cb7349]/40 ring-2 ring-[#f5b76f]/50">
                <Trophy className="w-7 h-7 text-[#f5b76f]" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold tracking-widest text-[#f5b76f] uppercase">
                  BGMI Esports Official Standings
                </span>
                <h1 className="text-3xl sm:text-4xl font-heading font-black tracking-wider text-white uppercase">
                  {tournamentName}
                </h1>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono text-[#cb7349] block">
                {matches.length} Matches Tabulated
              </span>
              <span className="text-xs font-mono font-bold text-[#f5b76f]">
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* 2. Podium Champions Showcase & MVP Spotlight */}
          <div className="grid grid-cols-12 gap-5 relative z-10">
            {/* Top 3 Podium Cards */}
            <div className="col-span-8 grid grid-cols-3 gap-3">
              {/* 2nd Place */}
              {rank2 ? (
                <div className="p-4 rounded-xl bg-[#3e0c0d]/90 border border-[#cb7349]/40 flex flex-col justify-between relative mt-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#f5b76f]">#2 RUNNER UP</span>
                    <span className="text-xs font-mono text-[#cb7349]">Slot {rank2.slot}</span>
                  </div>
                  <div className="py-2">
                    <h3 className="font-heading font-bold text-lg text-white truncate">
                      {rank2.teamName}
                    </h3>
                    <div className="text-xs text-[#cb7349] font-mono mt-1">
                      🪔 {rank2.wwcdCount} WWCD · {rank2.killPoints} Kills
                    </div>
                  </div>
                  <div className="text-right pt-2 border-t border-[#4a0e13]">
                    <span className="text-xl font-mono font-black text-[#f5b76f]">
                      {rank2.totalPoints}{' '}
                      <span className="text-[10px] font-sans text-[#cb7349]">PTS</span>
                    </span>
                  </div>
                </div>
              ) : null}

              {/* 1st Place (Gold Champion) */}
              {rank1 ? (
                <div className="p-4 rounded-xl bg-gradient-to-b from-[#cb7349]/30 via-[#3e0c0d] to-[#140404] border-2 border-[#f5b76f] shadow-xl shadow-[#cb7349]/30 flex flex-col justify-between relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-extrabold text-[#f5b76f] flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-[#f5b76f]" />
                      #1 CHAMPION
                    </span>
                    <span className="text-xs font-mono text-[#f5b76f]">Slot {rank1.slot}</span>
                  </div>
                  <div className="py-3 text-center">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#f5b76f] to-[#cb7349] text-[#140404] flex items-center justify-center font-black mx-auto mb-1 text-sm shadow-md font-heading">
                      WWCD
                    </div>
                    <h3 className="font-heading font-black text-xl text-white truncate">
                      {rank1.teamName}
                    </h3>
                    <div className="text-xs text-amber-300 font-mono mt-1">
                      🍗 {rank1.wwcdCount} Chicken Dinners
                    </div>
                  </div>
                  <div className="text-center pt-2 border-t border-amber-500/30">
                    <span className="text-2xl font-mono font-black text-amber-400">
                      {rank1.totalPoints}{' '}
                      <span className="text-xs font-sans text-amber-200">PTS</span>
                    </span>
                  </div>
                </div>
              ) : null}

              {/* 3rd Place */}
              {rank3 ? (
                <div className="p-4 rounded-xl bg-[#3e0c0d]/90 border border-[#cb7349]/30 flex flex-col justify-between relative mt-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#cb7349]">#3 PODIUM</span>
                    <span className="text-xs font-mono text-[#cb7349]/70">Slot {rank3.slot}</span>
                  </div>
                  <div className="py-2">
                    <h3 className="font-heading font-bold text-lg text-white truncate">
                      {rank3.teamName}
                    </h3>
                    <div className="text-xs text-[#cb7349] font-mono mt-1">
                      🪔 {rank3.wwcdCount} WWCD · {rank3.killPoints} Kills
                    </div>
                  </div>
                  <div className="text-right pt-2 border-t border-[#4a0e13]">
                    <span className="text-xl font-mono font-black text-[#f5b76f]">
                      {rank3.totalPoints}{' '}
                      <span className="text-[10px] font-sans text-[#cb7349]">PTS</span>
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* MVP / Top Fragger Card */}
            <div className="col-span-4 p-4 rounded-xl bg-gradient-to-br from-[#4a0e13] via-[#3e0c0d] to-[#140404] border border-[#cb7349]/50 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-[#4a0e13]">
                  <span className="text-xs font-mono font-bold text-[#f5b76f] flex items-center gap-1.5 uppercase">
                    <Flame className="w-4 h-4 text-[#cb7349]" />
                    Tournament MVP Fragger
                  </span>
                  <Crosshair className="w-4 h-4 text-[#cb7349]" />
                </div>

                {mvpPlayer ? (
                  <div className="py-3">
                    <div className="text-xs text-[#cb7349] font-mono">
                      {mvpPlayer.teamName} · Slot {mvpPlayer.slot}
                    </div>
                    <div className="font-heading font-black text-2xl text-white tracking-wide mt-0.5 truncate">
                      {mvpPlayer.playerName}
                    </div>
                    <div className="text-xs text-[#cb7349] mt-2 font-mono flex items-center gap-3">
                      <span>Total Frags:</span>
                      <span className="text-base font-bold text-[#f5b76f]">
                        {mvpPlayer.kills} KILLS
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-[#cb7349]/70 italic">
                    Player stats will display once scoreboard player kills are processed.
                  </div>
                )}
              </div>

              {/* Secondary Fraggers List */}
              {topFraggers.length > 1 && (
                <div className="pt-2 border-t border-[#4a0e13] space-y-1">
                  <div className="text-[10px] font-mono text-[#cb7349] uppercase tracking-wider">
                    Next Top Fraggers:
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono text-[#f5b76f]">
                    <span className="truncate max-w-[140px]">
                      #2 {topFraggers[1].playerName} ({topFraggers[1].teamName})
                    </span>
                    <span className="font-bold text-[#f5b76f]">{topFraggers[1].kills}k</span>
                  </div>
                  {topFraggers[2] && (
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span className="truncate max-w-[140px]">
                        #3 {topFraggers[2].playerName} ({topFraggers[2].teamName})
                      </span>
                      <span className="font-bold text-amber-400">{topFraggers[2].kills}k</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Overall Standings Grid (Compact Esports Broadcast Strip) */}
          <div className="relative z-10 pt-2">
            <div className="rounded-xl border border-[#3e0c0d] overflow-hidden bg-[#140404]/90 shadow-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-[#3e0c0d]/90 text-[#cb7349] border-b border-[#4a0e13] uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-2 text-center w-10">Slot</th>
                    <th className="py-2.5 px-4 font-heading text-sm text-[#f5b76f]">Team Name</th>
                    <th className="py-2.5 px-3 text-center">WWCD</th>
                    <th className="py-2.5 px-3 text-right">Place Pts</th>
                    <th className="py-2.5 px-3 text-right">Kill Pts</th>
                    <th className="py-2.5 px-4 text-right font-bold text-[#f5b76f]">Total Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3e0c0d]/50">
                  {leaderboard.slice(0, 16).map((entry) => (
                    <tr
                      key={entry.slot}
                      className={
                        entry.rank === 1
                          ? 'bg-[#cb7349]/15'
                          : entry.rank <= 3
                          ? 'bg-[#3e0c0d]/30'
                          : ''
                      }
                    >
                      <td className="py-2 px-3 text-center font-bold">
                        {entry.rank === 1 ? (
                          <span className="text-[#f5b76f]">#1</span>
                        ) : entry.rank === 2 ? (
                          <span className="text-[#cb7349]">#2</span>
                        ) : entry.rank === 3 ? (
                          <span className="text-[#cb7349]/80">#3</span>
                        ) : (
                          <span className="text-[#cb7349]/50">#{entry.rank}</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center text-[#cb7349]">{entry.slot}</td>
                      <td className="py-2 px-4 font-heading font-bold text-white text-base tracking-wide truncate">
                        {entry.teamName}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {entry.wwcdCount > 0 ? (
                          <span className="text-[#f5b76f] font-bold">🪔 {entry.wwcdCount}</span>
                        ) : (
                          <span className="text-[#cb7349]/40">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-[#f5b76f]/90">{entry.placementPoints}</td>
                      <td className="py-2 px-3 text-right text-[#f5b76f]/90">{entry.killPoints}</td>
                      <td className="py-2 px-4 text-right font-black text-[#f5b76f] text-sm">
                        {entry.totalPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer watermark */}
          <div className="relative z-10 pt-3 border-t border-[#3e0c0d] flex items-center justify-between text-[11px] font-mono text-[#cb7349]/70">
            <span>Generated with BGMI Points Matrix · Diwali Diya & Lanterns Edition</span>
            <span>Tiebreaker: Pts → Kills → WWCD → Placement</span>
          </div>
        </div>
      </div>
    </div>
  );
};
