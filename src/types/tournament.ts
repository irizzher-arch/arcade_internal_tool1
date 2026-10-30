export interface PlayerKill {
  name: string;
  kills: number;
}

export interface TeamRoster {
  slot: number;
  teamName: string;
  tag?: string;
  players: string[];
}

export interface TeamMatchStanding {
  placement: number;
  slot: number;
  teamName: string;
  kills: number;
  players?: PlayerKill[];
}

export interface MatchData {
  id: string;
  matchNumber: number;
  mapName: string;
  fileName?: string;
  standings: TeamMatchStanding[];
}

export interface TeamMatchRecord {
  matchNumber: number;
  placement: number;
  kills: number;
  placementPoints: number;
  killPoints: number;
  totalPoints: number;
}

export interface LeaderboardEntry {
  rank: number;
  slot: number;
  teamName: string;
  matchesPlayed: number;
  wwcdCount: number;
  placementPoints: number;
  killPoints: number;
  totalPoints: number;
  bestPlacement: number;
  matches: TeamMatchRecord[];
  playerKills: PlayerKill[];
}

export interface PointSettings {
  name: string;
  killMultiplier: number;
  placements: Record<number, number>;
}

export interface BatchImageItem {
  id: string;
  name: string;
  file?: File;
  originalSize: number;
  compressedSize: number;
  compressedBase64: string;
  mimeType: string;
  status: 'idle' | 'compressing' | 'processing' | 'done' | 'error';
  error?: string;
  result?: MatchData;
  progressMessage?: string;
}

export interface PlayerLeaderboardEntry {
  rank: number;
  playerName: string;
  teamName: string;
  slot: number;
  kills: number;
}
