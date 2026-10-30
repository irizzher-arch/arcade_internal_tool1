import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileImage,
  Zap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  ArrowRight,
  Eye,
  Plus,
  Layers,
  Sparkles,
  Combine,
  Split,
  Sliders,
  Check,
} from 'lucide-react';
import { BatchImageItem, MatchData, TeamRoster } from '../types/tournament';
import { compressScreenshot, formatBytes } from '../utils/imageCompressor';
import { SAMPLE_MATCHES } from '../utils/presets';
import { deduplicateAndMergeMatchStandings } from '../utils/scoring';

interface OcrUploadStepProps {
  rosters: TeamRoster[];
  setRosters?: React.Dispatch<React.SetStateAction<TeamRoster[]>>;
  matches: MatchData[];
  setMatches: React.Dispatch<React.SetStateAction<MatchData[]>>;
  onNext: () => void;
  onOpenMatchDetail: (match: MatchData) => void;
  apiKey?: string;
}

export const OcrUploadStep: React.FC<OcrUploadStepProps> = ({
  rosters,
  setRosters,
  matches,
  setMatches,
  onNext,
  onOpenMatchDetail,
  apiKey,
}) => {
  const [queue, setQueue] = useState<BatchImageItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalProgress, setGlobalProgress] = useState<number>(0);
  const [stats, setStats] = useState<{ originalTotal: number; compressedTotal: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode: single_match (combining 4-5 paginated screenshots for 1 match) vs multi_match (separate matches)
  const [mode, setMode] = useState<'single_match' | 'multi_match'>('single_match');
  
  // Calculate next recommended match number
  const nextAvailableMatchNumber =
    matches.length > 0 ? Math.max(...matches.map((m) => m.matchNumber)) + 1 : 1;
  const [targetMatchNumber, setTargetMatchNumber] = useState<number>(nextAvailableMatchNumber);
  const [selectedMap, setSelectedMap] = useState<string>('Erangel');

  // Summary feedback of merged match
  const [mergeSummary, setMergeSummary] = useState<{
    matchNumber: number;
    uniqueTeams: number;
    duplicatesRemoved: number;
    wwcdTeam?: string;
    totalKills: number;
  } | null>(null);

  // Handle files dropped or selected
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Clear previous merge summary when new files are added
    setMergeSummary(null);

    const newItems: BatchImageItem[] = [];
    let origBytes = 0;
    let compBytes = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const id = `item-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`;
      origBytes += file.size;

      // Temporary placeholder while compressing
      const tempItem: BatchImageItem = {
        id,
        name: file.name,
        file,
        originalSize: file.size,
        compressedSize: 0,
        compressedBase64: '',
        mimeType: file.type,
        status: 'compressing',
        progressMessage: 'Downscaling to 1200px...',
      };

      newItems.push(tempItem);
    }

    setQueue((prev) => [...prev, ...newItems]);

    // Perform fast client-side HTML5 canvas downscaling and WebP compression in parallel
    const processedItems = await Promise.all(
      newItems.map(async (item) => {
        if (!item.file) return item;
        try {
          const compressed = await compressScreenshot(item.file, 1200, 0.80);
          compBytes += compressed.compressedSize;

          return {
            ...item,
            compressedBase64: compressed.base64,
            mimeType: compressed.mimeType,
            compressedSize: compressed.compressedSize,
            status: 'idle' as const,
            progressMessage: `Ready (${formatBytes(compressed.compressedSize)})`,
          };
        } catch (err: any) {
          return {
            ...item,
            status: 'error' as const,
            error: err?.message || 'Failed to downscale image',
          };
        }
      })
    );

    setQueue((prev) => {
      const ids = new Set(processedItems.map((p) => p.id));
      return [...prev.filter((p) => !ids.has(p.id)), ...processedItems];
    });

    setStats((prev) => ({
      originalTotal: (prev?.originalTotal || 0) + origBytes,
      compressedTotal: (prev?.compressedTotal || 0) + compBytes,
    }));
  };

  // Run Parallel Batch Scoreboard OCR with Deduplication
  const runParallelBatchOcr = async () => {
    const pendingItems = queue.filter((q) => q.status === 'idle' || q.status === 'error');
    if (pendingItems.length === 0) return;

    setIsProcessing(true);
    setGlobalProgress(20);

    // Mark all pending as processing
    setQueue((prev) =>
      prev.map((item) =>
        pendingItems.some((p) => p.id === item.id)
          ? {
              ...item,
              status: 'processing',
              progressMessage:
                mode === 'single_match'
                  ? `Analyzing & merging page into Match #${targetMatchNumber}...`
                  : 'Gemini 3.8 Flash analyzing...',
            }
          : item
      )
    );

    try {
      // Roster hints payload to accelerate OCR accuracy
      const rosterHints = rosters.map((r) => ({
        slot: r.slot,
        teamName: r.teamName,
        players: r.players,
      }));

      if (mode === 'single_match') {
        // Build payload targeting ONE single match across all uploaded screenshots
        const imagesPayload = pendingItems.map((item, idx) => ({
          id: item.id,
          name: item.name,
          matchNumber: targetMatchNumber,
          pageNumber: idx + 1,
          base64: item.compressedBase64,
          mimeType: item.mimeType,
        }));

        setGlobalProgress(40);

        const resp = await fetch('/api/ocr/scoreboard-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: imagesPayload,
            rosterHints,
            mode: 'single_match',
            targetMatchNumber,
            mapName: selectedMap,
            apiKey,
          }),
        });

        setGlobalProgress(80);

        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(json.error || 'Server OCR batch request failed');
        }

        if (json.match && Array.isArray(json.match.standings)) {
          const finalRawStandings = json.match.standings;
          const matchNum = Number(json.match.matchNumber) || targetMatchNumber;
          const map = json.match.mapName || selectedMap || 'Erangel';
          const serverDups = Number(json.match.duplicatesRemoved) || 0;

          // Double check with client-side deduplication as well for absolute certainty
          const { standings: verifiedStandings, duplicatesRemoved: clientDups } =
            deduplicateAndMergeMatchStandings(finalRawStandings, rosters);
          const totalDups = serverDups + clientDups;

          const matchData: MatchData = {
            id: `match-${Date.now()}-${matchNum}`,
            matchNumber: matchNum,
            mapName: map,
            fileName: `${pendingItems.length} Screenshots (Merged & Deduplicated)`,
            standings: verifiedStandings,
          };

          // Mark queue items as done
          setQueue((prev) =>
            prev.map((item) =>
              pendingItems.some((p) => p.id === item.id)
                ? {
                    ...item,
                    status: 'done' as const,
                    progressMessage: `Merged into Match #${matchNum}`,
                    result: matchData,
                  }
                : item
            )
          );

          // Update matches: replace if matchNumber exists, otherwise append
          setMatches((prev) => {
            const existingIdx = prev.findIndex((m) => m.matchNumber === matchNum);
            if (existingIdx >= 0) {
              const copy = [...prev];
              copy[existingIdx] = matchData;
              return copy;
            }
            return [...prev, matchData].sort((a, b) => a.matchNumber - b.matchNumber);
          });

          // Sync detected team names to tournament rosters if placeholder was used
          if (setRosters) {
            setRosters((prevRosters) => {
              const updatedRosters = [...prevRosters];
              verifiedStandings.forEach((s) => {
                if (s.slot > 0 && s.teamName && !s.teamName.startsWith('Slot ')) {
                  const rIdx = updatedRosters.findIndex((r) => r.slot === s.slot);
                  if (rIdx >= 0) {
                    if (updatedRosters[rIdx].teamName.startsWith('Slot ')) {
                      updatedRosters[rIdx] = {
                        ...updatedRosters[rIdx],
                        teamName: s.teamName,
                      };
                    }
                  } else {
                    updatedRosters.push({
                      slot: s.slot,
                      teamName: s.teamName,
                      players: (s.players || []).map((p) => p.name),
                    });
                  }
                }
              });
              return updatedRosters.sort((a, b) => a.slot - b.slot);
            });
          }

          const wwcdWinner = verifiedStandings.find((s) => s.placement === 1);
          const totalKills = verifiedStandings.reduce((sum, s) => sum + (s.kills || 0), 0);

          setMergeSummary({
            matchNumber: matchNum,
            uniqueTeams: verifiedStandings.length,
            duplicatesRemoved: totalDups,
            wwcdTeam: wwcdWinner ? wwcdWinner.teamName : undefined,
            totalKills,
          });

          // Automatically advance target match number for next batch
          setTargetMatchNumber(matchNum + 1);
        } else {
          throw new Error('Server returned empty match standings');
        }
      } else {
        // Multi separate matches mode
        const startMatchNumber = matches.length + 1;
        const imagesPayload = pendingItems.map((item, idx) => ({
          id: item.id,
          name: item.name,
          matchNumber: startMatchNumber + idx,
          base64: item.compressedBase64,
          mimeType: item.mimeType,
        }));

        setGlobalProgress(50);

        const resp = await fetch('/api/ocr/scoreboard-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: imagesPayload,
            rosterHints,
            mode: 'multi_match',
            apiKey,
          }),
        });

        setGlobalProgress(80);

        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(json.error || 'Server OCR batch request failed');
        }

        const results = json.results || [];
        const newlyExtractedMatches: MatchData[] = [];

        setQueue((prev) =>
          prev.map((item) => {
            const matchResult = results.find((r: any) => r.id === item.id);
            if (matchResult) {
              if (matchResult.success && matchResult.data) {
                const standingsList = Array.isArray(matchResult.data.standings)
                  ? matchResult.data.standings
                  : [];

                const matchData: MatchData = {
                  id: `match-${Date.now()}-${matchResult.matchNumber}-${Math.random().toString(36).substr(2, 4)}`,
                  matchNumber: Number(matchResult.data.matchNumber) || (matches.length + newlyExtractedMatches.length + 1),
                  mapName: matchResult.data.mapName || 'Erangel',
                  fileName: item.name,
                  standings: standingsList,
                };

                return {
                  ...item,
                  status: 'done' as const,
                  progressMessage: `Done (${standingsList.length} teams extracted)`,
                  result: matchData,
                };
              } else {
                return {
                  ...item,
                  status: 'error' as const,
                  error: matchResult.error || 'OCR could not detect standings',
                };
              }
            }
            return item;
          })
        );

        results.forEach((matchResult: any) => {
          if (matchResult.success && matchResult.data) {
            const standingsList = Array.isArray(matchResult.data.standings)
              ? matchResult.data.standings
              : [];

            const matchData: MatchData = {
              id: `match-${Date.now()}-${matchResult.matchNumber}-${Math.random().toString(36).substr(2, 4)}`,
              matchNumber: Number(matchResult.data.matchNumber) || (matches.length + newlyExtractedMatches.length + 1),
              mapName: matchResult.data.mapName || 'Erangel',
              fileName: matchResult.fileName || `Match ${matchResult.matchNumber}`,
              standings: standingsList,
            };
            newlyExtractedMatches.push(matchData);
          }
        });

        if (newlyExtractedMatches.length > 0) {
          setMatches((prev) => {
            const existingNums = new Set(prev.map((m) => m.matchNumber));
            const adjustedMatches = newlyExtractedMatches.map((nm) => {
              let num = nm.matchNumber;
              while (existingNums.has(num)) {
                num++;
              }
              existingNums.add(num);
              return { ...nm, matchNumber: num };
            });
            return [...prev, ...adjustedMatches];
          });
        }
      }

      setGlobalProgress(100);
    } catch (err: any) {
      console.error('Batch OCR failure:', err);
      setQueue((prev) =>
        prev.map((item) =>
          item.status === 'processing'
            ? { ...item, status: 'error', error: err?.message || 'OCR request failed' }
            : item
        )
      );
    } finally {
      setIsProcessing(false);
      setTimeout(() => setGlobalProgress(0), 1000);
    }
  };

  const handleRemoveQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const handleRemoveMatch = (matchId: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== matchId));
  };

  const handleLoadDemoMatches = () => {
    setMatches(SAMPLE_MATCHES);
  };

  const handleClearAllMatches = () => {
    setMatches([]);
    setQueue([]);
    setStats(null);
  };

  return (
    <div className="space-y-6">
      {/* Optimization Banner & Metrics */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Ultra-Fast Scoreboard OCR Engine
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
              Gemini 3.8 Flash
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            HTML5 Canvas automatically compresses high-res screenshots before multi-thread server processing.
          </p>
        </div>

        {stats && stats.originalTotal > 0 && (
          <div className="flex items-center gap-4 bg-slate-950 p-3 rounded-lg border border-slate-800 shrink-0 text-xs font-mono">
            <div>
              <span className="text-slate-500 block">Payload Before:</span>
              <span className="text-slate-300 font-bold">{formatBytes(stats.originalTotal)}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 block">Payload After:</span>
              <span className="text-amber-400 font-bold">{formatBytes(stats.compressedTotal)}</span>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div className="text-emerald-400 font-bold">
              -{Math.round(((stats.originalTotal - stats.compressedTotal) / stats.originalTotal) * 100)}% Speedup
            </div>
          </div>
        )}
      </div>

      {/* Mode Selector: Single Match (Multi-Screenshot) vs Separate Matches */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => {
            setMode('single_match');
            setMergeSummary(null);
          }}
          className={`p-3.5 rounded-lg text-left transition-all flex items-start gap-3 cursor-pointer ${
            mode === 'single_match'
              ? 'bg-amber-500/10 border border-amber-500/40 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <div
            className={`p-2 rounded-md shrink-0 ${
              mode === 'single_match' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Combine className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Single Match (4–5 Paginated Screenshots)</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                Recommended
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Upload multiple screenshots for the same match. All pages are merged into one match, automatically removing repeating teams and resolving true ranks.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('multi_match');
            setMergeSummary(null);
          }}
          className={`p-3.5 rounded-lg text-left transition-all flex items-start gap-3 cursor-pointer ${
            mode === 'multi_match'
              ? 'bg-amber-500/10 border border-amber-500/40 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
          }`}
        >
          <div
            className={`p-2 rounded-md shrink-0 ${
              mode === 'multi_match' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Split className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Separate Matches (1 Image = 1 Match)</div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Each uploaded screenshot represents an entirely different match (Match 1, Match 2, Match 3...).
            </p>
          </div>
        </button>
      </div>

      {/* Target Match & Map Settings for Single Match Mode */}
      {mode === 'single_match' && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 shrink-0">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Target Match:
            </span>
            <div className="flex items-center gap-2">
              <select
                value={targetMatchNumber}
                onChange={(e) => {
                  setTargetMatchNumber(Number(e.target.value));
                  setMergeSummary(null);
                }}
                className="bg-slate-950 border border-slate-700 text-amber-400 font-mono text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400"
              >
                <option value={nextAvailableMatchNumber}>+ New Match #{nextAvailableMatchNumber}</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.matchNumber}>
                    Update Match #{m.matchNumber} ({m.mapName})
                  </option>
                ))}
              </select>

              <span className="text-[11px] text-slate-500 font-mono">
                {matches.some((m) => m.matchNumber === targetMatchNumber)
                  ? 'Replaces existing Match data'
                  : 'New Match'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">Map:</span>
            <div className="flex items-center gap-1">
              {['Erangel', 'Miramar', 'Sanhok', 'Vikendi'].map((map) => (
                <button
                  key={map}
                  type="button"
                  onClick={() => setSelectedMap(map)}
                  className={`px-2.5 py-1 text-xs rounded-md font-mono transition-colors cursor-pointer ${
                    selectedMap === map
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {map}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Deduplication & Merge Success Card */}
      {mergeSummary && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs shadow-lg shadow-emerald-950/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-emerald-200 font-bold text-sm">
                Match #{mergeSummary.matchNumber} Consolidated & Deduplicated!
              </span>
            </div>
            <p className="text-emerald-300/80 text-xs">
              Recorded <strong className="text-white font-mono">{mergeSummary.uniqueTeams} unique teams</strong> with{' '}
              <strong className="text-white font-mono">{mergeSummary.totalKills} total kills</strong>.
              {mergeSummary.duplicatesRemoved > 0 ? (
                <>
                  {' '}
                  Consolidated and filtered{' '}
                  <strong className="text-amber-300 font-mono">
                    {mergeSummary.duplicatesRemoved} duplicate team rows
                  </strong>{' '}
                  from overlapping screenshots.
                </>
              ) : (
                ' No duplicate teams found; ordered sequentially.'
              )}
              {mergeSummary.wwcdTeam && (
                <>
                  {' '}
                  Winner (WWCD): <strong className="text-amber-400">{mergeSummary.wwcdTeam}</strong>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const m = matches.find((x) => x.matchNumber === mergeSummary.matchNumber);
                if (m) onOpenMatchDetail(m);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              View Scoreboard
            </button>
            <button
              type="button"
              onClick={() => {
                setQueue([]);
                setMergeSummary(null);
                setTargetMatchNumber(mergeSummary.matchNumber + 1);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Next Match #{mergeSummary.matchNumber + 1}
            </button>
          </div>
        </div>
      )}

      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-amber-400 bg-amber-500/10 scale-[1.005]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-900'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-black/40">
          <UploadCloud className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">
          {mode === 'single_match'
            ? `Drop 4–5 Screenshots of Match #${targetMatchNumber} Here`
            : 'Drop BGMI Match Result Screenshots Here'}
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md">
          {mode === 'single_match'
            ? 'Upload all scrolled screenshots for this match. Overlapping teams will be merged cleanly into a single points record.'
            : 'Upload 1 or multiple match scoreboards. Canvas will auto-downscale and dispatch parallel OCR in seconds.'}
        </p>
        <span className="mt-3 text-xs font-semibold px-3 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
          Select Screenshots from Computer
        </span>
      </div>

      {/* Global Progress Bar if Processing */}
      {isProcessing && (
        <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/30 space-y-2 animate-pulse">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-amber-400 font-bold flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              {mode === 'single_match'
                ? `Merging & deduplicating ${queue.length} screenshots for Match #${targetMatchNumber}...`
                : 'Processing Parallel Batch OCR with Gemini 3.8 Flash...'}
            </span>
            <span className="text-amber-300">{globalProgress}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${globalProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Queue Chips & Batch Action */}
      {queue.length > 0 && (
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                {mode === 'single_match'
                  ? `Match #${targetMatchNumber} Screenshot Queue (${queue.length} Pages)`
                  : 'Upload Queue & Real-Time Match Status'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {mode === 'single_match'
                  ? `${queue.length} screenshots ready to compile for Match #${targetMatchNumber}`
                  : `${queue.filter((q) => q.status === 'done').length} of ${queue.length} processed`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={runParallelBatchOcr}
                disabled={isProcessing || !queue.some((q) => q.status === 'idle' || q.status === 'error')}
                className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                  isProcessing || !queue.some((q) => q.status === 'idle' || q.status === 'error')
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                {isProcessing
                  ? 'Processing & Merging...'
                  : mode === 'single_match'
                  ? `Merge & Process ${queue.length} Screenshots for Match #${targetMatchNumber}`
                  : 'Run Parallel Batch OCR'}
              </button>

              <button
                onClick={() => {
                  setQueue([]);
                  setMergeSummary(null);
                }}
                className="px-2.5 py-2 text-xs rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                title="Clear Queue"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Individual Match Status Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {queue.map((item, idx) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-xs transition-all ${
                  item.status === 'done'
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : item.status === 'processing'
                    ? 'bg-amber-950/20 border-amber-500/40 ring-1 ring-amber-500/20'
                    : item.status === 'error'
                    ? 'bg-red-950/20 border-red-500/30'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileImage className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-slate-200 block truncate">
                      {mode === 'single_match'
                        ? `Match #${targetMatchNumber} • Page ${idx + 1}`
                        : `Match ${idx + 1}: ${item.name}`}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {item.progressMessage || (item.error ? item.error : 'Ready for OCR')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {item.status === 'processing' && <Clock className="w-4 h-4 text-amber-400 animate-spin" />}
                  {item.status === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}

                  <button
                    onClick={() => handleRemoveQueueItem(item.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors ml-1 cursor-pointer"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Extracted Match Leaderboards List */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-display font-bold text-white">Extracted Tournament Matches</h3>
            <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {matches.length} Matches Loaded
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadDemoMatches}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Load 3 Demo Matches
            </button>

            {matches.length > 0 && (
              <button
                onClick={handleClearAllMatches}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 transition-all"
              >
                Clear Matches
              </button>
            )}
          </div>
        </div>

        {matches.length > 0 && (
          <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-emerald-300 font-medium">
                {matches.length} Match scoreboard(s) loaded. All placements, WWCDs, and kill points are synced to the Points Table.
              </span>
            </div>
            <button
              onClick={onNext}
              className="px-3.5 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-sm shadow-amber-500/20"
            >
              Open Points Table
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {matches.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-lg border border-dashed border-slate-800">
            <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-300">No Matches Added</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Upload scoreboard screenshots above, or click "Load 3 Demo Matches" to simulate instant results.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map((match) => {
              const winner = match.standings.find((s) => s.placement === 1);
              const totalKills = match.standings.reduce((sum, s) => sum + (s.kills || 0), 0);

              return (
                <div
                  key={match.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/40 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      Match #{match.matchNumber}
                    </span>
                    <span className="text-xs font-semibold text-slate-300 font-mono">
                      {match.mapName}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>WWCD Winner:</span>
                      <span className="font-semibold text-amber-300">{winner ? winner.teamName : 'Slot 1'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Teams Recorded:</span>
                      <span className="font-mono text-slate-200">{match.standings.length} teams</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Total Match Kills:</span>
                      <span className="font-mono text-slate-200">{totalKills} kills</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <button
                      onClick={() => onOpenMatchDetail(match)}
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View / Edit Scoreboard
                    </button>

                    <button
                      onClick={() => handleRemoveMatch(match.id)}
                      className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                      title="Delete Match"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Next Step CTA */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {matches.length > 0
              ? 'Results aggregated! Proceed to the official points table.'
              : 'Add at least one match to generate the points table.'}
          </span>
          <button
            onClick={onNext}
            disabled={matches.length === 0}
            className={`px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-all ${
              matches.length > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            Generate Points Table
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
