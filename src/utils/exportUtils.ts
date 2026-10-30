import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { LeaderboardEntry, MatchData, PlayerLeaderboardEntry } from '../types/tournament';

/**
 * Exports comprehensive tournament data to Excel (.xlsx)
 */
export function exportTournamentToExcel(
  leaderboard: LeaderboardEntry[],
  matches: MatchData[],
  topFraggers: PlayerLeaderboardEntry[],
  tournamentName: string = 'BGMI_Tournament'
) {
  const wb = XLSX.utils.book_new();

  // 1. Overall Points Table Sheet
  const overallData = leaderboard.map((entry) => ({
    Rank: entry.rank,
    Slot: entry.slot,
    'Team Name': entry.teamName,
    'Matches Played': entry.matchesPlayed,
    WWCD: entry.wwcdCount,
    'Placement Points': entry.placementPoints,
    'Kill Points': entry.killPoints,
    'Total Points': entry.totalPoints,
    'Best Placement': entry.bestPlacement > 0 ? `#${entry.bestPlacement}` : '-',
  }));
  const wsOverall = XLSX.utils.json_to_sheet(overallData);
  XLSX.utils.book_append_sheet(wb, wsOverall, 'Overall Standings');

  // 2. Match Breakdown Sheet
  if (matches.length > 0) {
    const matchHeaders = ['Rank', 'Slot', 'Team Name'];
    matches.forEach((m) => {
      matchHeaders.push(`M${m.matchNumber} (${m.mapName}) Pts`);
      matchHeaders.push(`M${m.matchNumber} Kills`);
    });
    matchHeaders.push('Total Points');

    const matchRows = leaderboard.map((entry) => {
      const row: Record<string, any> = {
        Rank: entry.rank,
        Slot: entry.slot,
        'Team Name': entry.teamName,
      };

      matches.forEach((m) => {
        const record = entry.matches.find((rec) => rec.matchNumber === m.matchNumber);
        row[`M${m.matchNumber} (${m.mapName}) Pts`] = record ? record.totalPoints : 0;
        row[`M${m.matchNumber} Kills`] = record ? record.kills : 0;
      });

      row['Total Points'] = entry.totalPoints;
      return row;
    });

    const wsMatches = XLSX.utils.json_to_sheet(matchRows);
    XLSX.utils.book_append_sheet(wb, wsMatches, 'Match Breakdown');
  }

  // 3. Top Fraggers Sheet
  if (topFraggers.length > 0) {
    const fraggerData = topFraggers.map((f) => ({
      Rank: f.rank,
      'Player IGN': f.playerName,
      'Team Name': f.teamName,
      Slot: f.slot,
      'Total Kills': f.kills,
    }));
    const wsFraggers = XLSX.utils.json_to_sheet(fraggerData);
    XLSX.utils.book_append_sheet(wb, wsFraggers, 'Top Fraggers');
  }

  // Write and trigger download
  const dateStr = new Date().toISOString().split('T')[0];
  const safeTitle = tournamentName.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `${safeTitle}_Points_Table_${dateStr}.xlsx`);
}

/**
 * Downloads a DOM element as a crisp Full-HD 2x resolution PNG
 */
export async function exportElementToHDImage(
  elementId: string,
  filename: string = 'BGMI_Leaderboard'
): Promise<boolean> {
  const node = document.getElementById(elementId);
  if (!node) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  try {
    const dataUrl = await toPng(node, {
      pixelRatio: 2, // 2x density for ultra-sharp esports graphics
      quality: 0.95,
      cacheBust: true,
      backgroundColor: '#090d16',
    });

    const link = document.createElement('a');
    link.download = `${filename}_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    return true;
  } catch (err) {
    console.error('Failed to export HD image:', err);
    throw err;
  }
}

/**
 * Print / Save as PDF
 */
export function exportToPDF() {
  window.print();
}
