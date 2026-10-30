import {
  PointSettings,
  TeamRoster,
  MatchData,
  LeaderboardEntry,
  PlayerLeaderboardEntry,
  TeamMatchRecord,
  TeamMatchStanding,
  PlayerKill,
} from '../types/tournament';

export const OFFICIAL_BGMI_10_POINT: PointSettings = {
  name: 'Official BGMI 10-Point (BGIS / BMPS)',
  killMultiplier: 1,
  placements: {
    1: 10,
    2: 6,
    3: 5,
    4: 4,
    5: 3,
    6: 2,
    7: 1,
    8: 1,
    9: 0,
    10: 0,
    11: 0,
    12: 0,
    13: 0,
    14: 0,
    15: 0,
    16: 0,
    17: 0,
    18: 0,
    19: 0,
    20: 0,
  },
};

export const CLASSIC_15_POINT: PointSettings = {
  name: 'Classic 15-Point System',
  killMultiplier: 1,
  placements: {
    1: 15,
    2: 12,
    3: 10,
    4: 8,
    5: 6,
    6: 4,
    7: 2,
    8: 1,
    9: 1,
    10: 1,
    11: 1,
    12: 1,
    13: 0,
    14: 0,
    15: 0,
    16: 0,
    17: 0,
    18: 0,
    19: 0,
    20: 0,
  },
};

/**
 * Normalizes clan tag prefixes and special characters from gaming names
 * e.g., "SOUL・Manya" -> "Manya", "GodL Jonathan" -> "Jonathan", "TX_Ninja" -> "Ninja"
 */
export function cleanGamerTag(name: string): string {
  if (!name) return '';
  return name
    .replace(/^([a-zA-Z0-9]{2,6}[・\-_|\s]+)/i, '')
    .replace(/[^\w\s]/gi, '')
    .trim()
    .toLowerCase();
}

/**
 * Fast Levenshtein distance for fuzzy matching
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Fuzzy matches an OCR team name or slot against registered rosters
 */
export function matchTeamRoster(
  ocrSlot: number,
  ocrTeamName: string,
  rosters: TeamRoster[]
): TeamRoster | undefined {
  // 1. Direct slot match if slot is valid and matches
  if (ocrSlot > 0) {
    const slotMatch = rosters.find((r) => r.slot === ocrSlot);
    if (slotMatch) return slotMatch;
  }

  // 2. Exact or substring name match
  const cleanOcrName = cleanGamerTag(ocrTeamName);
  for (const r of rosters) {
    const cleanRosterName = cleanGamerTag(r.teamName);
    if (
      cleanRosterName === cleanOcrName ||
      cleanRosterName.includes(cleanOcrName) ||
      cleanOcrName.includes(cleanRosterName)
    ) {
      return r;
    }
  }

  // 3. Levenshtein closest match (threshold <= 3)
  let bestMatch: TeamRoster | undefined = undefined;
  let minDistance = 999;
  for (const r of rosters) {
    const dist = levenshteinDistance(cleanGamerTag(r.teamName), cleanOcrName);
    if (dist < minDistance && dist <= 3) {
      minDistance = dist;
      bestMatch = r;
    }
  }

  return bestMatch;
}

/**
 * Compute Points Table Leaderboard with official tiebreaker rules:
 * 1. Total Points (Placement Points + Kill Points)
 * 2. Total Kill Points
 * 3. WWCD (1st place finishes)
 * 4. Best single-match placement
 */
export function calculateLeaderboard(
  rosters: TeamRoster[],
  matches: MatchData[],
  pointSettings: PointSettings
): LeaderboardEntry[] {
  // 1. Build an active roster list accounting for both pre-registered rosters and match standings
  const activeRosters: TeamRoster[] = rosters.map((r) => ({
    ...r,
    players: [...(r.players || [])],
  }));

  const usedSlots = new Set<number>(activeRosters.map((r) => r.slot));

  // Inspect all match standings: ensure all teams appearing in any match have a corresponding active roster
  matches.forEach((m) => {
    (m.standings || []).forEach((s) => {
      // Find matching roster
      let matched = activeRosters.find(
        (r) =>
          (s.slot > 0 && r.slot === s.slot) ||
          r.teamName.toLowerCase() === s.teamName.toLowerCase()
      );

      if (!matched) {
        matched = matchTeamRoster(s.slot, s.teamName, activeRosters);
      }

      if (matched) {
        // If the matched roster has a generic placeholder name like "Slot 1" and the standing has a real name
        if (
          matched.teamName.startsWith('Slot ') &&
          s.teamName &&
          !s.teamName.startsWith('Slot ')
        ) {
          matched.teamName = s.teamName;
        }
      } else {
        // New team found in scoreboard that wasn't in roster
        let slotToUse = s.slot > 0 && !usedSlots.has(s.slot) ? s.slot : 1;
        while (usedSlots.has(slotToUse)) {
          slotToUse++;
        }
        usedSlots.add(slotToUse);

        const newRoster: TeamRoster = {
          slot: slotToUse,
          teamName: s.teamName || `Slot ${slotToUse}`,
          players: s.players ? s.players.map((p) => p.name) : [],
        };
        activeRosters.push(newRoster);
      }
    });
  });

  // If still empty (no rosters and no matches), return empty list
  if (activeRosters.length === 0) return [];

  const entries: LeaderboardEntry[] = activeRosters.map((roster) => {
    let placementPoints = 0;
    let killPoints = 0;
    let wwcdCount = 0;
    let bestPlacement = 99;
    const matchBreakdowns: TeamMatchRecord[] = [];
    const playerKillMap: Record<string, number> = {};

    matches.forEach((m) => {
      // Find standing for this team in this match
      let standing = m.standings.find((s) => s.slot > 0 && s.slot === roster.slot);
      if (!standing) {
        standing = m.standings.find(
          (s) => s.teamName.toLowerCase() === roster.teamName.toLowerCase()
        );
      }
      if (!standing) {
        standing = m.standings.find(
          (s) => matchTeamRoster(s.slot, s.teamName, [roster]) !== undefined
        );
      }

      if (standing) {
        const place = Number(standing.placement) || 16;
        const kills = Number(standing.kills) || 0;
        const pts = pointSettings.placements[place] ?? 0;
        const kPts = kills * (pointSettings.killMultiplier ?? 1);

        placementPoints += pts;
        killPoints += kPts;
        if (place === 1) wwcdCount += 1;
        if (place < bestPlacement) bestPlacement = place;

        matchBreakdowns.push({
          matchNumber: m.matchNumber,
          placement: place,
          kills,
          placementPoints: pts,
          killPoints: kPts,
          totalPoints: pts + kPts,
        });

        // Tally player kills
        if (standing.players && standing.players.length > 0) {
          standing.players.forEach((p) => {
            const pName = p.name?.trim() || 'Unknown';
            playerKillMap[pName] = (playerKillMap[pName] || 0) + (Number(p.kills) || 0);
          });
        }
      }
    });

    const playerKills = Object.entries(playerKillMap)
      .map(([name, kills]) => ({ name, kills }))
      .sort((a, b) => b.kills - a.kills);

    return {
      rank: 0,
      slot: roster.slot,
      teamName: roster.teamName,
      matchesPlayed: matchBreakdowns.length,
      wwcdCount,
      placementPoints,
      killPoints,
      totalPoints: placementPoints + killPoints,
      bestPlacement: bestPlacement === 99 ? 0 : bestPlacement,
      matches: matchBreakdowns,
      playerKills,
    };
  });

  // Sort by official tiebreaker rules: Total Pts -> Kill Pts -> WWCD -> Best Placement
  entries.sort((a, b) => {
    // 1. Total Points
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    // 2. Kill Points
    if (b.killPoints !== a.killPoints) {
      return b.killPoints - a.killPoints;
    }
    // 3. WWCD (1st place count)
    if (b.wwcdCount !== a.wwcdCount) {
      return b.wwcdCount - a.wwcdCount;
    }
    // 4. Best Placement (lower number is better rank e.g. 2nd > 4th)
    return a.bestPlacement - b.bestPlacement;
  });

  // Assign ranks
  entries.forEach((e, idx) => {
    e.rank = idx + 1;
  });

  return entries;
}

/**
 * Calculate top fraggers across all tournament matches
 */
export function calculateTopFraggers(
  leaderboard: LeaderboardEntry[],
  rosters: TeamRoster[]
): PlayerLeaderboardEntry[] {
  const playerMap: Record<string, { kills: number; teamName: string; slot: number }> = {};

  leaderboard.forEach((entry) => {
    entry.playerKills.forEach((p) => {
      if (!playerMap[p.name]) {
        playerMap[p.name] = {
          kills: p.kills,
          teamName: entry.teamName,
          slot: entry.slot,
        };
      } else {
        playerMap[p.name].kills += p.kills;
      }
    });
  });

  const players: PlayerLeaderboardEntry[] = Object.entries(playerMap).map(
    ([playerName, data]) => ({
      rank: 0,
      playerName,
      teamName: data.teamName,
      slot: data.slot,
      kills: data.kills,
    })
  );

  players.sort((a, b) => b.kills - a.kills);
  players.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  return players;
}

/**
 * Deduplicates and merges multiple paginated/scrolled scoreboard screenshots for the SAME match.
 * Resolves repeated teams by slot, normalized team name, and player IGNs.
 * Merges placement rank, consistent kills, and player kill breakdown.
 */
export function deduplicateAndMergeMatchStandings(
  standingsList: TeamMatchStanding[],
  rosters: TeamRoster[] = []
): { standings: TeamMatchStanding[]; duplicatesRemoved: number } {
  const mergedMap = new Map<string, TeamMatchStanding>();
  let duplicatesRemoved = 0;

  // Build lookup maps for roster hints if provided
  const slotToRoster = new Map<number, TeamRoster>();
  const playerToRoster = new Map<string, TeamRoster>();

  if (rosters && rosters.length > 0) {
    for (const r of rosters) {
      if (r.slot > 0) slotToRoster.set(r.slot, r);
      if (r.players && Array.isArray(r.players)) {
        for (const p of r.players) {
          const cleanP = cleanGamerTag(p);
          if (cleanP) playerToRoster.set(cleanP, r);
        }
      }
    }
  }

  for (const s of standingsList) {
    if (!s) continue;
    let rawName = (s.teamName || '').trim();
    let cleanName = cleanGamerTag(rawName);
    let slot = Number(s.slot) || 0;
    const placement = Number(s.placement) || 0;
    const kills = Number(s.kills) || 0;
    let players = Array.isArray(s.players) ? s.players : [];

    // Match against registered rosters
    let matchedRoster: TeamRoster | undefined;
    if (slot > 0 && slotToRoster.has(slot)) {
      matchedRoster = slotToRoster.get(slot);
    }

    if (!matchedRoster && cleanName && rosters.length > 0) {
      matchedRoster = rosters.find((r) => {
        if (!r.teamName) return false;
        const rClean = cleanGamerTag(r.teamName);
        return (
          rClean === cleanName ||
          (cleanName.length >= 3 && rClean.includes(cleanName)) ||
          (rClean.length >= 3 && cleanName.includes(rClean))
        );
      });
    }

    if (!matchedRoster && players.length > 0) {
      for (const p of players) {
        const cp = cleanGamerTag(p.name);
        if (cp && playerToRoster.has(cp)) {
          matchedRoster = playerToRoster.get(cp);
          break;
        }
      }
    }

    // Apply matched roster details and strictly enforce that only registered players remain in this team
    if (matchedRoster) {
      slot = matchedRoster.slot;
      rawName = matchedRoster.teamName;
      cleanName = cleanGamerTag(matchedRoster.teamName);

      if (matchedRoster.players && matchedRoster.players.length > 0) {
        const allowedPlayers = new Set(
          matchedRoster.players.map((p) => cleanGamerTag(p)).filter(Boolean)
        );
        players = players.filter((p: PlayerKill) => {
          const cp = cleanGamerTag(p.name);
          return allowedPlayers.has(cp);
        });
      }
    }

    let existingKey: string | null = null;

    // 1. Direct non-zero slot match
    if (slot > 0) {
      for (const [key, val] of mergedMap.entries()) {
        if (val.slot > 0 && val.slot === slot) {
          existingKey = key;
          break;
        }
      }
    }

    // 2. Name match (exact, clean, or substring)
    if (!existingKey && cleanName) {
      for (const [key, val] of mergedMap.entries()) {
        const valClean = cleanGamerTag(val.teamName);
        if (
          valClean === cleanName ||
          (cleanName.length >= 3 && valClean.includes(cleanName)) ||
          (valClean.length >= 3 && cleanName.includes(valClean))
        ) {
          existingKey = key;
          break;
        }
      }
    }

    // 3. Match #1 and #2 specifically: In BGMI, the top 2 teams (rank 1 WWCD and rank 2)
    // persist across scrolled scoreboard pages. Count them only 1 time.
    if (!existingKey && (placement === 1 || placement === 2)) {
      for (const [key, val] of mergedMap.entries()) {
        if (val.placement === placement) {
          existingKey = key;
          break;
        }
      }
    }

    // 4. Match by player names
    if (!existingKey && players.length > 0) {
      const incomingPlayerNames = new Set(
        players.map((p: PlayerKill) => cleanGamerTag(p.name)).filter(Boolean)
      );
      for (const [key, val] of mergedMap.entries()) {
        if (val.players && val.players.length > 0) {
          const hasCommonPlayer = val.players.some((p: PlayerKill) =>
            incomingPlayerNames.has(cleanGamerTag(p.name))
          );
          if (hasCommonPlayer) {
            existingKey = key;
            break;
          }
        }
      }
    }

    if (existingKey) {
      duplicatesRemoved++;
      const existing = mergedMap.get(existingKey)!;

      // Better placement: if incoming has valid placement and either existing doesn't or incoming is lower rank number (e.g. 1 vs 0)
      if (placement > 0 && (existing.placement <= 0 || placement < existing.placement)) {
        existing.placement = placement;
      }
      // Non-zero slot
      if (existing.slot <= 0 && slot > 0) {
        existing.slot = slot;
      }
      // Better team name
      if (
        (existing.teamName.startsWith('Slot ') || existing.teamName.length < rawName.length) &&
        rawName &&
        !rawName.startsWith('Slot ')
      ) {
        existing.teamName = rawName;
      }
      // Highest/verified kills
      existing.kills = Math.max(existing.kills, kills);

      // Merge players
      const playerMap = new Map<string, { name: string; kills: number }>();
      (existing.players || []).forEach((p: PlayerKill) => {
        playerMap.set(cleanGamerTag(p.name) || p.name, { ...p });
      });
      players.forEach((p: PlayerKill) => {
        const key = cleanGamerTag(p.name) || p.name;
        if (playerMap.has(key)) {
          const ep = playerMap.get(key)!;
          ep.kills = Math.max(ep.kills, p.kills);
        } else {
          playerMap.set(key, { ...p });
        }
      });
      existing.players = Array.from(playerMap.values());
    } else {
      const newKey = (slot > 0 ? `slot-${slot}` : '') || cleanName || `team-${mergedMap.size + 1}`;
      mergedMap.set(newKey, {
        placement: placement || (mergedMap.size + 1),
        slot: slot || (mergedMap.size + 1),
        teamName: rawName || `Slot ${slot || mergedMap.size + 1}`,
        kills,
        players: players.map((p: PlayerKill) => ({
          name: p.name?.trim() || 'Player',
          kills: Number(p.kills) || 0,
        })),
      });
    }
  }

  // Sort ascending by placement rank (1, 2, 3...)
  const sorted = Array.from(mergedMap.values()).sort((a, b) => {
    if (a.placement !== b.placement) {
      return a.placement - b.placement;
    }
    return b.kills - a.kills;
  });

  // Strict rule: NO POSITION CAN BE REPEATED. Exactly one team per rank.
  // Reconcile any duplicate or missing placement ranks so every team has a distinct 1..N rank
  const usedRanks = new Set<number>();
  let nextRank = 1;
  const finalStandings = sorted.map((s) => {
    let finalRank = s.placement;
    if (usedRanks.has(finalRank) || finalRank <= 0) {
      while (usedRanks.has(nextRank)) {
        nextRank++;
      }
      finalRank = nextRank;
    }
    usedRanks.add(finalRank);
    nextRank = finalRank + 1;
    return {
      ...s,
      placement: finalRank,
    };
  });

  return {
    standings: finalStandings,
    duplicatesRemoved,
  };
}

