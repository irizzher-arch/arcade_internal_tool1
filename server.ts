import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// High body limit for base64 screenshots
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Initialize server-side Gemini client helper
function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const key = (customApiKey || '').trim() || process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check and API key validation endpoint
app.post('/api/validate-key', async (req, res) => {
  const clientKey = (req.body.apiKey || '').trim() || process.env.GEMINI_API_KEY || '';
  if (!clientKey) {
    return res.status(400).json({ valid: false, error: 'No API key provided' });
  }

  try {
    const testAi = getGeminiClient(clientKey);
    const result = await testAi.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: 'ping',
    });
    if (result && result.text) {
      return res.json({ valid: true, message: 'API key is valid and working!' });
    }
    return res.json({ valid: true, message: 'Key validated successfully' });
  } catch (err: any) {
    console.error('API key validation error:', err?.message || err);
    return res.status(401).json({
      valid: false,
      error: err?.message || 'Invalid Gemini API key or connection error',
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

interface TeamRosterHint {
  slot: number;
  teamName: string;
  players?: string[];
}

// Helper to safely parse JSON from Gemini responses even with code fences or stray text
function safeParseJson(rawText: string | undefined): any {
  if (!rawText) return {};
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {}
    }
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0]);
      } catch {}
    }
    return {};
  }
}

// Timeout helper ensuring OCR calls never hang past safety ceiling
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]);
}

// Single match scoreboard extraction helper
async function extractScoreboardWithGemini(
  imagePart: { inlineData: { mimeType: string; data: string } },
  matchNumber: number,
  rosterHints: TeamRosterHint[],
  customApiKey?: string
) {
  const ai = getGeminiClient(customApiKey);
  const hintsSummary = rosterHints && rosterHints.length > 0
    ? `Registered tournament slots:\n` +
      rosterHints
        .slice(0, 20)
        .map(
          (t) =>
            `- Slot ${t.slot}: "${t.teamName}" ${
              t.players && t.players.length ? `(Players: ${t.players.slice(0, 4).join(', ')})` : ''
            }`
        )
        .join('\n')
    : 'No slot hints provided. Extract all visible teams, slots, and player kills.';

  const prompt = `You are a high-speed BGMI (Battlegrounds Mobile India) esports referee AI analyzing an end-game scoreboard for Match #${matchNumber}.
TASK: Extract team placement ranks (1st to 20th), team names, slot numbers, team kills, and player kills.

${hintsSummary}

RULES:
1. Placement #1 = Winner Winner Chicken Dinner (WWCD).
2. Match teams to registered slots if similar names/clan tags appear.
3. Extract exact kills per team and per player if visible.
Return clean JSON matching the schema with zero markdown commentary.`;

  const getScoreboardParams = (modelName: string) => ({
    model: modelName,
    contents: {
      parts: [imagePart, { text: prompt }],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matchNumber: { type: Type.INTEGER, description: 'Match sequence number' },
          mapName: { type: Type.STRING, description: 'Map e.g. Erangel, Miramar, Sanhok, Vikendi' },
          standings: {
            type: Type.ARRAY,
            description: 'Standings for each team in this match',
            items: {
              type: Type.OBJECT,
              properties: {
                placement: { type: Type.INTEGER, description: 'Final placement rank in the match (1 to 20)' },
                slot: { type: Type.INTEGER, description: 'Team slot number (1-20). If unknown, 0' },
                teamName: { type: Type.STRING, description: 'Team Name' },
                kills: { type: Type.INTEGER, description: 'Total kills secured by the team' },
                players: {
                  type: Type.ARRAY,
                  description: 'Player kill breakdown if visible',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING, description: 'Player IGN' },
                      kills: { type: Type.INTEGER, description: 'Kills by this player' },
                    },
                    required: ['name', 'kills'],
                  },
                },
              },
              required: ['placement', 'teamName', 'kills'],
            },
          },
        },
        required: ['standings'],
      },
    },
  });

  try {
    // Models fallback order: gemini-flash-lite-latest (fastest & highest availability) -> gemini-3.1-flash-lite -> gemini-3.8-flash -> gemini-flash-latest
    let response;
    const modelsToTry = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let lastErr: any = null;

    for (const modelName of modelsToTry) {
      try {
        response = await withTimeout(
          ai.models.generateContent(getScoreboardParams(modelName)),
          22000,
          `${modelName} timeout for match #${matchNumber}`
        );
        if (response && response.text) break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`Model ${modelName} failed for match #${matchNumber}: ${err?.message || err}. Trying next model...`);
      }
    }

    if (!response || !response.text) {
      throw lastErr || new Error(`All Gemini models failed for match #${matchNumber}`);
    }

    const parsed = safeParseJson(response.text);

    // Support any shape Gemini returns: { standings: [...] }, { teams: [...] }, array directly, or nested in data
    let rawStandings: any[] = [];
    if (Array.isArray(parsed)) {
      rawStandings = parsed;
    } else if (Array.isArray(parsed?.standings)) {
      rawStandings = parsed.standings;
    } else if (Array.isArray(parsed?.teams)) {
      rawStandings = parsed.teams;
    } else if (parsed?.data && Array.isArray(parsed.data.standings)) {
      rawStandings = parsed.data.standings;
    } else if (Array.isArray(parsed?.scoreboard)) {
      rawStandings = parsed.scoreboard;
    } else if (Array.isArray(parsed?.results)) {
      rawStandings = parsed.results;
    }

    // Sanitize and normalize standings
    const sanitizedStandings = rawStandings.map((s: any, idx: number) => {
      const placementNum = Number(String(s.placement || s.rank || idx + 1).replace(/[^\d]/g, '')) || (idx + 1);
      const killsNum = Number(String(s.kills || s.killCount || 0).replace(/[^\d]/g, '')) || 0;
      let slotNum = Number(String(s.slot || 0).replace(/[^\d]/g, '')) || 0;
      let teamName = (s.teamName || s.name || s.team || `Slot ${placementNum}`).trim();

      // Normalize slot using rosterHints if slot is 0 or unassigned
      if (slotNum === 0 && rosterHints && rosterHints.length > 0) {
        const hint = rosterHints.find((h) => {
          if (!h.teamName) return false;
          const hName = h.teamName.toLowerCase();
          const tName = teamName.toLowerCase();
          return (
            hName === tName ||
            hName.includes(tName) ||
            tName.includes(hName) ||
            (h.players && h.players.some((p) => tName.includes(p.toLowerCase())))
          );
        });
        if (hint) {
          slotNum = hint.slot;
          teamName = hint.teamName;
        }
      }

      // If still 0, assign placement rank as slot
      if (slotNum === 0) {
        slotNum = placementNum;
      }

      const players = Array.isArray(s.players)
        ? s.players.map((p: any) => ({
            name: String(p.name || p.ign || 'Player').trim(),
            kills: Number(String(p.kills || 0).replace(/[^\d]/g, '')) || 0,
          }))
        : [];

      return {
        placement: placementNum,
        slot: slotNum,
        teamName,
        kills: killsNum,
        players,
      };
    });

    console.log(`Match #${matchNumber} scoreboard OCR: extracted ${sanitizedStandings.length} team standings`);

    return {
      success: true,
      data: {
        matchNumber: Number(parsed?.matchNumber) || matchNumber,
        mapName: parsed?.mapName || 'Erangel',
        standings: sanitizedStandings,
      },
    };
  } catch (err: any) {
    console.error(`Gemini OCR error for match ${matchNumber}:`, err?.message || err);
    return {
      success: false,
      error: err?.message || 'Failed to extract scoreboard data within 25 seconds',
    };
  }
}

// Helper to clean clan tags and gaming symbols
function cleanTagName(name: string): string {
  if (!name) return '';
  return name
    .replace(/^([a-zA-Z0-9]{2,6}[・\-_|\s]+)/i, '')
    .replace(/[^\w\s]/gi, '')
    .trim()
    .toLowerCase();
}

// Deterministic deduplication & merge for standings across multiple screenshots
function deduplicateAndMergeStandings(
  standingsList: any[],
  rosterHints: TeamRosterHint[] = []
): { standings: any[]; duplicatesRemoved: number } {
  const mergedMap = new Map<string, any>();
  let duplicatesRemoved = 0;

  // Build lookup maps for roster hints if provided
  const slotToHint = new Map<number, TeamRosterHint>();
  const playerToHint = new Map<string, TeamRosterHint>();

  if (rosterHints && rosterHints.length > 0) {
    for (const h of rosterHints) {
      if (h.slot > 0) slotToHint.set(h.slot, h);
      if (h.players && Array.isArray(h.players)) {
        for (const p of h.players) {
          const cleanP = cleanTagName(p);
          if (cleanP) playerToHint.set(cleanP, h);
        }
      }
    }
  }

  for (const s of standingsList) {
    if (!s) continue;
    let rawName = (s.teamName || s.name || '').trim();
    let cleanName = cleanTagName(rawName);
    let slot = Number(s.slot) || 0;
    const placement = Number(s.placement) || 0;
    const kills = Number(s.kills) || 0;
    let players = Array.isArray(s.players) ? s.players : [];

    // Match against registered roster hints
    let matchedHint: TeamRosterHint | undefined;
    if (slot > 0 && slotToHint.has(slot)) {
      matchedHint = slotToHint.get(slot);
    }

    if (!matchedHint && cleanName && rosterHints.length > 0) {
      matchedHint = rosterHints.find((h) => {
        if (!h.teamName) return false;
        const hClean = cleanTagName(h.teamName);
        return (
          hClean === cleanName ||
          (cleanName.length >= 3 && hClean.includes(cleanName)) ||
          (hClean.length >= 3 && cleanName.includes(hClean))
        );
      });
    }

    if (!matchedHint && players.length > 0) {
      for (const p of players) {
        const cp = cleanTagName(p.name);
        if (cp && playerToHint.has(cp)) {
          matchedHint = playerToHint.get(cp);
          break;
        }
      }
    }

    // Apply matched roster hint info
    if (matchedHint) {
      slot = matchedHint.slot;
      rawName = matchedHint.teamName;
      cleanName = cleanTagName(matchedHint.teamName);

      // Strict enforcement: only players registered for this team are allowed
      if (matchedHint.players && matchedHint.players.length > 0) {
        const allowedPlayers = new Set(
          matchedHint.players.map((p) => cleanTagName(p)).filter(Boolean)
        );
        players = players.filter((p: any) => {
          const cp = cleanTagName(p.name);
          return allowedPlayers.has(cp);
        });
      }
    }

    let existingKey: string | null = null;

    // 1. Direct slot match
    if (slot > 0) {
      for (const [key, val] of mergedMap.entries()) {
        if (val.slot > 0 && val.slot === slot) {
          existingKey = key;
          break;
        }
      }
    }

    // 2. Exact or substring clean name match
    if (!existingKey && cleanName) {
      for (const [key, val] of mergedMap.entries()) {
        const valClean = cleanTagName(val.teamName);
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
    // stay visible or persist across scrolled scoreboard pages.
    // Ensure ranks 1 and 2 are never registered multiple times under different entries.
    if (!existingKey && (placement === 1 || placement === 2)) {
      for (const [key, val] of mergedMap.entries()) {
        if (val.placement === placement) {
          existingKey = key;
          break;
        }
      }
    }

    // 4. Common player IGN
    if (!existingKey && players.length > 0) {
      const incomingPNames = new Set(
        players.map((p: any) => cleanTagName(p.name)).filter(Boolean)
      );
      for (const [key, val] of mergedMap.entries()) {
        if (val.players && val.players.length > 0) {
          const hasCommon = val.players.some((p: any) =>
            incomingPNames.has(cleanTagName(p.name))
          );
          if (hasCommon) {
            existingKey = key;
            break;
          }
        }
      }
    }

    if (existingKey) {
      duplicatesRemoved++;
      const existing = mergedMap.get(existingKey)!;

      // Placement: lower rank number = better placement (e.g. 1 is WWCD)
      if (placement > 0 && (existing.placement <= 0 || placement < existing.placement)) {
        existing.placement = placement;
      }
      if (existing.slot <= 0 && slot > 0) {
        existing.slot = slot;
      }
      if (
        (existing.teamName.startsWith('Slot ') || existing.teamName.length < rawName.length) &&
        rawName &&
        !rawName.startsWith('Slot ')
      ) {
        existing.teamName = rawName;
      }
      existing.kills = Math.max(existing.kills, kills);

      // Merge players
      const playerMap = new Map<string, { name: string; kills: number }>();
      (existing.players || []).forEach((p: any) => {
        playerMap.set(cleanTagName(p.name) || p.name, {
          name: p.name,
          kills: Number(p.kills) || 0,
        });
      });
      players.forEach((p: any) => {
        const pKey = cleanTagName(p.name) || p.name;
        if (playerMap.has(pKey)) {
          const ep = playerMap.get(pKey)!;
          ep.kills = Math.max(ep.kills, Number(p.kills) || 0);
        } else {
          playerMap.set(pKey, {
            name: p.name?.trim() || 'Player',
            kills: Number(p.kills) || 0,
          });
        }
      });
      existing.players = Array.from(playerMap.values());
    } else {
      const key = (slot > 0 ? `slot-${slot}` : '') || cleanName || `team-${mergedMap.size + 1}`;
      mergedMap.set(key, {
        placement: placement || (mergedMap.size + 1),
        slot: slot || (mergedMap.size + 1),
        teamName: rawName || `Slot ${slot || mergedMap.size + 1}`,
        kills,
        players: players.map((p: any) => ({
          name: String(p.name || 'Player').trim(),
          kills: Number(p.kills) || 0,
        })),
      });
    }
  }

  // Sort strictly by placement ascending (1st place first)
  const sorted = Array.from(mergedMap.values()).sort((a, b) => {
    if (a.placement !== b.placement) {
      return a.placement - b.placement;
    }
    return b.kills - a.kills;
  });

  // Strict rule: NO POSITION/PLACEMENT CAN BE REPEATED. Each position belongs to EXACTLY ONE team.
  // Enforce unique, distinct 1-to-N ranks:
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

// Parallel Batch Scoreboard OCR Route with Single-Match Multi-Screenshot Deduplication
app.post('/api/ocr/scoreboard-batch', async (req, res) => {
  const { images, rosterHints, mode, targetMatchNumber, mapName, apiKey } = req.body;
  const customApiKey = (apiKey || '').trim();
  const ai = getGeminiClient(customApiKey);

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'No images provided for OCR' });
  }

  const isSingleMatchMode = mode !== 'multi_match';
  const matchNum = Number(targetMatchNumber) || 1;

  try {
    if (isSingleMatchMode && images.length > 1) {
      console.log(
        `Processing ${images.length} paginated screenshots for single Match #${matchNum} with deduplication...`
      );

      // Construct Multi-Image parts
      const imageParts = images.map((imgObj: any) => {
        const base64Data = (imgObj.base64 || '').replace(/^data:image\/\w+;base64,/, '');
        const mimeType = imgObj.mimeType || 'image/jpeg';
        return {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        };
      });

      const hintsSummary =
        rosterHints && rosterHints.length > 0
          ? `Registered tournament slots:\n` +
            rosterHints
              .slice(0, 20)
              .map(
                (t: TeamRosterHint) =>
                  `- Slot ${t.slot}: "${t.teamName}" ${
                    t.players && t.players.length ? `(Players: ${t.players.slice(0, 4).join(', ')})` : ''
                  }`
              )
              .join('\n')
          : 'No slot hints provided. Extract all visible teams, slots, and player kills.';

      const multiPrompt = `You are an elite BGMI (Battlegrounds Mobile India) referee OCR AI analyzing ${images.length} paginated/scrolled screenshots of the SAME match scoreboard (#${matchNum}).
The user scrolled down the scoreboard to capture all teams.
CRITICAL BGMI SCOREBOARD RULES:
1. FIXED TOP 2 TEAMS: In BGMI match summary screens, the #1 WWCD winner and #2 runner-up teams remain pinned at the top across multiple scrolled images. They WILL appear again and again in every single image. COUNT THEM EXACTLY ONCE!
2. UNIQUE POSITIONS ONLY: NO POSITION / PLACEMENT CAN BE REPEATED in a single match. Exactly one team can occupy rank 1, exactly one team can occupy rank 2, rank 3, rank 4, and so on. Never assign the same rank to multiple teams.
3. ROSTER MATCHING & PLAYER ASSIGNMENT:
   - Match teams to the provided tournament slot list.
   - ONLY include players that are registered for that specific team as per the slot list. Do not attribute kills or player names to the wrong team.
4. ORDERING: Return teams ordered strictly by placement rank (1, 2, 3, 4...).
${hintsSummary}`;

      const getMultiParams = (modelName: string) => ({
        model: modelName,
        contents: {
          parts: [...imageParts, { text: multiPrompt }],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchNumber: { type: Type.INTEGER, description: 'Match number' },
              mapName: { type: Type.STRING, description: 'Map e.g. Erangel, Miramar, Sanhok, Vikendi' },
              standings: {
                type: Type.ARRAY,
                description: 'Unified standings with all duplicates resolved',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    placement: { type: Type.INTEGER, description: 'Final placement rank (1 to 20)' },
                    slot: { type: Type.INTEGER, description: 'Slot number' },
                    teamName: { type: Type.STRING, description: 'Team Name' },
                    kills: { type: Type.INTEGER, description: 'Total team kills' },
                    players: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING, description: 'Player IGN' },
                          kills: { type: Type.INTEGER, description: 'Kills' },
                        },
                        required: ['name', 'kills'],
                      },
                    },
                  },
                  required: ['placement', 'teamName', 'kills'],
                },
              },
            },
            required: ['standings'],
          },
        },
      });

      let response: any = null;
      let multiSuccess = false;

      // Try multi-image synthesis with automatic model failover
      const multiModels = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
      for (const mName of multiModels) {
        try {
          response = await withTimeout(
            ai.models.generateContent(getMultiParams(mName)),
            22000,
            `Multi-image ${mName} timeout`
          );
          if (response && response.text) {
            multiSuccess = true;
            break;
          }
        } catch (mErr: any) {
          console.warn(`Multi-image ${mName} failed: ${mErr?.message || mErr}. Trying next model...`);
        }
      }

      let allStandings: any[] = [];
      let detectedMap = mapName || 'Erangel';

      if (multiSuccess && response?.text) {
        const parsed = safeParseJson(response?.text);
        if (parsed?.mapName) detectedMap = parsed.mapName;
        if (Array.isArray(parsed?.standings)) {
          allStandings = parsed.standings;
        } else if (Array.isArray(parsed?.teams)) {
          allStandings = parsed.teams;
        }
      }

      // If multi-image synthesis didn't yield enough teams, extract individual pages and merge
      if (allStandings.length === 0) {
        console.log(`Running parallel single-image extraction on ${images.length} pages...`);
        const extractionPromises = images.map(async (imgObj: any) => {
          const base64Data = (imgObj.base64 || '').replace(/^data:image\/\w+;base64,/, '');
          const mimeType = imgObj.mimeType || 'image/jpeg';
          const imagePart = { inlineData: { mimeType, data: base64Data } };
          const res = await extractScoreboardWithGemini(imagePart, matchNum, rosterHints || [], customApiKey);
          return res;
        });

        const singleResults = await Promise.all(extractionPromises);
        singleResults.forEach((sr) => {
          if (sr.success && sr.data?.standings) {
            allStandings.push(...sr.data.standings);
            if (sr.data.mapName && !detectedMap) detectedMap = sr.data.mapName;
          }
        });
      }

      // Run our deterministic deduplication and merging algorithm
      const { standings: mergedStandings, duplicatesRemoved } = deduplicateAndMergeStandings(
        allStandings,
        rosterHints || []
      );

      console.log(
        `Match #${matchNum} merged: ${mergedStandings.length} unique teams, ${duplicatesRemoved} duplicate entries removed.`
      );

      return res.json({
        mode: 'single_match',
        success: true,
        match: {
          matchNumber: matchNum,
          mapName: detectedMap,
          standings: mergedStandings,
          duplicatesRemoved,
          pagesProcessed: images.length,
        },
        results: images.map((img: any, i: number) => ({
          id: img.id,
          matchNumber: matchNum,
          fileName: img.name || `Page ${i + 1}`,
          success: true,
        })),
      });
    }

    // Default / Multiple separate matches mode
    const extractionPromises = images.map(async (imgObj: any, index: number) => {
      const thisMatchNum = imgObj.matchNumber || index + 1;
      const base64Data = imgObj.base64.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = imgObj.mimeType || 'image/jpeg';

      const imagePart = {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      };

      const result = await extractScoreboardWithGemini(imagePart, thisMatchNum, rosterHints || [], customApiKey);
      return {
        id: imgObj.id || `match-${thisMatchNum}`,
        matchNumber: thisMatchNum,
        fileName: imgObj.name || `Match ${thisMatchNum}`,
        ...result,
      };
    });

    const results = await Promise.all(extractionPromises);
    return res.json({ mode: 'multi_match', results });
  } catch (err: any) {
    console.error('Batch OCR error:', err);
    return res.status(500).json({ error: err?.message || 'Server batch processing failed' });
  }
});


// Multi-image Roster & Player IGN OCR Route
app.post('/api/ocr/roster', async (req, res) => {
  const images = req.body.images || (req.body.image ? [req.body.image] : []);
  const slotHints: Array<{ slot: number; teamName: string }> = req.body.slotHints || [];
  const customApiKey = (req.body.apiKey || '').trim();
  const ai = getGeminiClient(customApiKey);

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'No image(s) provided for roster OCR' });
  }

  const slotHintsText =
    slotHints.length > 0
      ? `USER PROVIDED SLOT AND TEAM NAME LIST:\n` +
        slotHints.map((sh) => `- Slot ${sh.slot}: "${sh.teamName}"`).join('\n') +
        `\nWhen you recognize a slot number in the image, attach that slot number directly to the corresponding team name above.`
      : '';

  const prompt = `You are a specialized BGMI (Battlegrounds Mobile India / PUBG Mobile) esports referee OCR system.
Analyze this in-game custom room / spectator lobby player slot screen.

VISUAL LAYOUT & BOUNDING GUIDELINES (Refer to standard BGMI custom room layout):
1. EACH TEAM CARD (Red-box area in visual guide):
   - The screen is arranged in a grid of rectangular team cards (e.g. 3x3 layout).
   - In each team card, there is a SLOT NUMBER badge in the top-left corner (highlighted in sky blue / colored box, e.g. "03", "06", "07", "08", "09", "10", "11", "12", "13").
   - Extract this 2-digit or 1-digit number as the slot number (e.g. "03" -> 3, "11" -> 11).

2. PLAYER NAMES / IGNS (Green-box area in visual guide):
   - Inside each team card, there is a list of up to 4 player rows stacked vertically.
   - Each row has a PLAYER IN-GAME NAME (IGN) on the left (e.g., "RLxVAYU", "RLxELEVEN", "RLxAnmoL", "RLxAkshitttOp").
   - Extract the player names accurately, preserving special characters, symbols, or clan tags (e.g., '4CloverJOYBOY', '亥乙口尺口★', 'CAPTAIN ￢MANU', 'SHANKYजाट').
   - MAXIMUM 4 PLAYERS PER TEAM: Each team can have at most 4 players (can be 1, 2, 3, or 4). Never extract more than 4 players for a single team.

3. IGNORE KILLS / STATUS:
   - On the right side of each player row, there is a kill/status section like "/ 0 Finished", "/ 1 Finished", etc.
   - COMPLETELY IGNORE this kills/status section during roster analysis. DO NOT include "Finished" or kill numbers in player names.

4. TEAM NAMES:
   ${slotHintsText ? slotHintsText : 'If the user provided team names for slots, attach them. Otherwise, infer from clan prefix or use "Slot <SlotNumber>".'}

Return clean JSON matching the schema with zero markdown commentary.`;

  try {
    // Process all roster screenshots in parallel using Promise.all
    const ocrPromises = images.map(async (img: any, idx: number) => {
      try {
        const base64Data = (img.base64 || '').replace(/^data:image\/\w+;base64,/, '');
        const mimeType = img.mimeType || 'image/jpeg';

        if (!base64Data) {
          console.warn(`Empty base64 data for roster image index ${idx}`);
          return [];
        }

        const getRosterParams = (modelName: string) => ({
          model: modelName,
          contents: {
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: prompt },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                teams: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      slot: { type: Type.INTEGER, description: 'Slot number (1 to 25)' },
                      teamName: { type: Type.STRING, description: 'Team name or inferred clan tag' },
                      players: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: 'List of player in-game names (IGNs), maximum 4 players per team',
                      },
                    },
                    required: ['slot', 'teamName', 'players'],
                  },
                },
              },
              required: ['teams'],
            },
          },
        });

        // Multi-tier model fallback for roster OCR
        let response;
        const rosterModels = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
        for (const mName of rosterModels) {
          try {
            response = await withTimeout(
              ai.models.generateContent(getRosterParams(mName)),
              22000,
              `Roster image #${idx + 1} ${mName} timeout`
            );
            if (response && response.text) break;
          } catch (mErr: any) {
            console.warn(
              `Roster image #${idx + 1} model ${mName} failed: ${mErr?.message || mErr}. Trying next model...`
            );
          }
        }

        const parsed = safeParseJson(response?.text);
        const teams = Array.isArray(parsed?.teams) ? parsed.teams : [];
        console.log(`Roster image #${idx + 1} extracted ${teams.length} teams.`);
        return teams;
      } catch (err: any) {
        console.error(`Error processing roster image #${idx + 1}:`, err?.message || err);
        return [];
      }
    });

    const batchResults = await Promise.all(ocrPromises);

    // Merge teams and player IGNs across all uploaded images by slot number
    const mergedMap = new Map<number, { slot: number; teamName: string; players: string[] }>();

    // Pre-populate with slotHints if provided
    if (slotHints && slotHints.length > 0) {
      slotHints.forEach((sh) => {
        if (sh.slot > 0) {
          mergedMap.set(sh.slot, {
            slot: sh.slot,
            teamName: sh.teamName,
            players: [],
          });
        }
      });
    }

    batchResults.flat().forEach((team: any, index: number) => {
      const slotNum = Number(team.slot) || index + 1;
      // Cap at 4 players per team
      const rawPlayers: string[] = (Array.isArray(team.players)
        ? team.players.map((p: any) => String(p).trim()).filter(Boolean)
        : []
      ).slice(0, 4);

      // Check if user provided a team name for this slot
      const userHint = slotHints.find((sh) => sh.slot === slotNum);
      const rawTeamName = userHint?.teamName || (team.teamName || '').trim() || `Slot ${slotNum}`;

      if (!mergedMap.has(slotNum)) {
        mergedMap.set(slotNum, {
          slot: slotNum,
          teamName: rawTeamName,
          players: rawPlayers,
        });
      } else {
        const existing = mergedMap.get(slotNum)!;
        // Upgrade team name if existing was default 'Slot X' and we have a valid name
        if (rawTeamName && (!existing.teamName || existing.teamName.startsWith('Slot '))) {
          existing.teamName = rawTeamName;
        }
        // Merge player IGNs without duplicates, capped at 4 players
        const combined = Array.from(new Set([...existing.players, ...rawPlayers]))
          .filter(Boolean)
          .slice(0, 4);
        existing.players = combined;
      }
    });

    const finalTeams = Array.from(mergedMap.values()).sort((a, b) => a.slot - b.slot);

    if (finalTeams.length === 0) {
      return res.status(422).json({
        error:
          'Could not detect player IGNs in the uploaded image(s). Ensure the screenshot clearly shows slot boxes or player names, or use Quick Text Input.',
      });
    }

    const totalPlayers = finalTeams.reduce((sum, t) => sum + (t.players?.length || 0), 0);

    return res.json({
      success: true,
      teams: finalTeams,
      imagesProcessed: images.length,
      totalPlayers,
    });
  } catch (err: any) {
    console.error('Roster OCR critical error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to extract roster' });
  }
});

// Setup Vite or static serving
async function setupServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');
  const indexPath = path.resolve(distPath, 'index.html');
  const hasDist = fs.existsSync(indexPath);

  if (isProduction || hasDist) {
    console.log(`Serving static production build from ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(indexPath);
    });
  } else {
    console.log('Starting development Vite server...');
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`BGMI Points Table Server running at http://localhost:${port}`);
  });
}

setupServer();
