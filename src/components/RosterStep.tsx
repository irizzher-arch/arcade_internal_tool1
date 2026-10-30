import React, { useState, useRef } from 'react';
import {
  Users,
  ClipboardPaste,
  Sparkles,
  Upload,
  Plus,
  PlusCircle,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Camera,
  ArrowRight,
  Files,
  FileImage,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { TeamRoster } from '../types/tournament';
import { SAMPLE_BGIS_ROSTERS, SAMPLE_20_TEAM_ROSTERS } from '../utils/presets';
import { compressScreenshot, formatBytes } from '../utils/imageCompressor';

interface RosterStepProps {
  rosters: TeamRoster[];
  setRosters: React.Dispatch<React.SetStateAction<TeamRoster[]>>;
  onNext: () => void;
  onOpenNewTournament?: () => void;
  apiKey?: string;
}

export const RosterStep: React.FC<RosterStepProps> = ({
  rosters,
  setRosters,
  onNext,
  onOpenNewTournament,
  apiKey,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [playerInputMode, setPlayerInputMode] = useState<'text' | 'image'>('text');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [ocrProgressText, setOcrProgressText] = useState<string>('');
  const [uploadedRosterFiles, setUploadedRosterFiles] = useState<{ name: string; size: number }[]>([]);
  const [isRosterDragActive, setIsRosterDragActive] = useState<boolean>(false);
  const rosterFileInputRef = useRef<HTMLInputElement>(null);

  // Quick paste format handler: "Slot, Team Name" or "1. Team Soul" or "1 - Team Soul"
  const handleQuickPaste = (textToParse?: string) => {
    const raw = textToParse !== undefined ? textToParse : pasteText;
    if (!raw.trim()) return;

    const lines = raw.split('\n');
    const parsedTeams: TeamRoster[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Match patterns like: "1, Team Soul", "1. Team Soul", "1 - Team Soul", or "Team Soul"
      const match = trimmed.match(/^(\d+)[\s,.\-:]+(.+)$/);
      if (match) {
        const slot = parseInt(match[1], 10);
        const teamName = match[2].trim();
        parsedTeams.push({
          slot,
          teamName,
          players: [],
        });
      } else {
        // Fallback: assign incremental slot
        parsedTeams.push({
          slot: index + 1,
          teamName: trimmed,
          players: [],
        });
      }
    });

    if (parsedTeams.length > 0) {
      // Sort by slot
      parsedTeams.sort((a, b) => a.slot - b.slot);
      setRosters(parsedTeams);
      setStatusMsg(`Successfully loaded ${parsedTeams.length} teams into slots.`);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  // Quick player roster text parse:
  // Format:
  // Slot 1: Player1, Player2, Player3, Player4
  // or
  // 1: Manya, Nakul, Rony, Spower
  const handlePlayerTextParse = (text: string) => {
    if (!text.trim()) return;
    const lines = text.split('\n');
    const updated = [...rosters];

    lines.forEach((line) => {
      const match = line.match(/^(\d+)[\s,.\-:]+(.+)$/);
      if (match) {
        const slotNum = parseInt(match[1], 10);
        const playerNames = match[2]
          .split(/[,/|]+/)
          .map((p) => p.trim())
          .filter(Boolean);

        const target = updated.find((r) => r.slot === slotNum);
        if (target) {
          target.players = playerNames;
        }
      }
    });

    setRosters(updated);
    setStatusMsg('Player IGNs updated.');
    setTimeout(() => setStatusMsg(null), 3000);
  };

  // Handle multi-image lobby/roster screenshot upload
  const handleRosterImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileList: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        fileList.push(files[i]);
      }
    }

    if (fileList.length === 0) return;

    setIsOcrProcessing(true);
    setOcrError(null);
    setOcrProgressText(`Downscaling ${fileList.length} image(s) on canvas...`);

    try {
      // Preprocess all screenshots concurrently on canvas
      const compressedList = await Promise.all(
        fileList.map((file) => compressScreenshot(file, 1200, 0.80))
      );

      setOcrProgressText(`Gemini 3.8 Flash analyzing ${fileList.length} screenshot(s) in parallel...`);

      const payload = compressedList.map((c, idx) => ({
        name: fileList[idx].name,
        base64: c.base64,
        mimeType: c.mimeType,
      }));

      // Pass existing slot-to-team assignments so Gemini attaches the players directly to the registered teams
      const slotHints = rosters.map((r) => ({
        slot: r.slot,
        teamName: r.teamName,
      }));

      const resp = await fetch('/api/ocr/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: payload,
          slotHints,
          apiKey,
        }),
      });

      const data = await resp.json();
      if (data.success && data.teams && data.teams.length > 0) {
        // Merge with existing rosters
        const existingRosters = [...rosters];
        const newTeams: TeamRoster[] = data.teams.map((t: any) => ({
          slot: Number(t.slot),
          teamName: t.teamName,
          players: Array.isArray(t.players) ? t.players : [],
        }));

        // Merge or replace by slot
        const mergedMap = new Map<number, TeamRoster>();
        // If all existing slots were default or if user is loading fresh OCR, populate cleanly
        existingRosters.forEach((r) => mergedMap.set(r.slot, { ...r }));

        newTeams.forEach((t) => {
          // Strictly enforce maximum 4 players per team
          const cleanPlayers = (Array.isArray(t.players) ? t.players : []).slice(0, 4);

          if (mergedMap.has(t.slot)) {
            const current = mergedMap.get(t.slot)!;
            // Overwrite with extracted OCR team name if detected and not a generic placeholder
            if (t.teamName && t.teamName.trim() !== '' && (!current.teamName || current.teamName.startsWith('Slot '))) {
              current.teamName = t.teamName.trim();
            }
            // Overwrite with extracted OCR player IGNs (max 4)
            if (cleanPlayers.length > 0) {
              current.players = cleanPlayers;
            }
          } else {
            mergedMap.set(t.slot, {
              ...t,
              players: cleanPlayers,
            });
          }
        });

        const sorted = Array.from(mergedMap.values()).sort((a, b) => a.slot - b.slot);
        setRosters(sorted);

        setUploadedRosterFiles((prev) => [
          ...prev,
          ...fileList.map((f) => ({ name: f.name, size: f.size })),
        ]);

        setStatusMsg(
          `Detected ${data.teams.length} team slots across ${fileList.length} screenshot(s)!`
        );
        setTimeout(() => setStatusMsg(null), 4000);
      } else {
        setOcrError(data.error || 'Could not detect teams clearly. You can paste text directly.');
      }
    } catch (err: any) {
      setOcrError(err?.message || 'Error uploading or analyzing roster images.');
    } finally {
      setIsOcrProcessing(false);
      setOcrProgressText('');
    }
  };

  const handleAddSlot = () => {
    const nextSlot = rosters.length > 0 ? Math.max(...rosters.map((r) => r.slot)) + 1 : 1;
    setRosters([...rosters, { slot: nextSlot, teamName: `Team Slot ${nextSlot}`, players: [] }]);
  };

  const handleRemoveSlot = (slotToRemove: number) => {
    setRosters(rosters.filter((r) => r.slot !== slotToRemove));
  };

  const handleUpdateTeamName = (slot: number, name: string) => {
    setRosters(rosters.map((r) => (r.slot === slot ? { ...r, teamName: name } : r)));
  };

  const handleUpdatePlayer = (slot: number, playerIndex: number, playerName: string) => {
    setRosters(
      rosters.map((r) => {
        if (r.slot === slot) {
          const players = [...(r.players || [])];
          players[playerIndex] = playerName;
          return { ...r, players: players.filter((p, idx) => p !== '' || idx < 4) };
        }
        return r;
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Presets */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            Tournament Roster & Lobby Slots
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure tournament slot numbers and team names. Dynamic capacity automatically adapts to your lobby.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenNewTournament && (
            <button
              onClick={onOpenNewTournament}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all flex items-center gap-1.5 shadow-sm shadow-amber-500/20"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New Tournament
            </button>
          )}

          <button
            onClick={() => {
              setRosters(SAMPLE_BGIS_ROSTERS);
              setStatusMsg('Loaded Official 16-Team BGIS Lobby.');
              setTimeout(() => setStatusMsg(null), 3000);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            BGIS 16-Team Preset
          </button>

          <button
            onClick={() => {
              setRosters(SAMPLE_20_TEAM_ROSTERS);
              setStatusMsg('Loaded 20-Team Extended Scrim Lobby.');
              setTimeout(() => setStatusMsg(null), 3000);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5"
          >
            20-Team Scrim Preset
          </button>

          <button
            onClick={() => {
              setRosters([]);
              setPasteText('');
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 transition-all"
          >
            Clear All
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {ocrError && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{ocrError}</span>
        </div>
      )}

      {/* Two-Column Setup Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Quick Paste & Ingestion */}
        <div className="lg:col-span-5 space-y-5">
          {/* Step 1: Quick Paste Teams */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <ClipboardPaste className="w-4 h-4 text-amber-400" />
                Step 1: Quick Paste Teams
              </span>
              <span className="text-xs text-slate-500 font-mono">Slot, Team Name</span>
            </div>

            <textarea
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="1, Team Soul&#10;2, GodLike Esports&#10;3, Carnival Gaming&#10;4, Team XSpark&#10;5, Global Esports..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 font-mono resize-none"
            />

            <button
              onClick={() => handleQuickPaste()}
              className="w-full py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              Parse Teams & Slots
            </button>
          </div>

          {/* Step 2: Player Rosters (Quick Text vs Image OCR) */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                Step 2: Player IGNs (Optional)
              </span>

              {/* Mode Toggle */}
              <div className="flex items-center p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                <button
                  onClick={() => setPlayerInputMode('text')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    playerInputMode === 'text'
                      ? 'bg-slate-800 text-amber-400 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Quick Text
                </button>
                <button
                  onClick={() => setPlayerInputMode('image')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    playerInputMode === 'image'
                      ? 'bg-slate-800 text-amber-400 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  OCR Image
                </button>
              </div>
            </div>

            {playerInputMode === 'text' ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">
                  Paste player IGNs (e.g. <code className="text-amber-300 font-mono">1: Manya, Nakul, Rony, Spower</code>)
                </p>
                <textarea
                  rows={4}
                  placeholder="1: Manya, Nakul, Rony, Spower&#10;2: Jonathan, Admino, Punkk, Zgod"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 font-mono resize-none"
                  onBlur={(e) => handlePlayerTextParse(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Upload multiple lobby/roster screenshots (e.g. Page 1, Page 2) for automatic player & slot detection:
                </p>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsRosterDragActive(true);
                  }}
                  onDragLeave={() => setIsRosterDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsRosterDragActive(false);
                    handleRosterImageUpload(e.dataTransfer.files);
                  }}
                  onClick={() => rosterFileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                    isRosterDragActive
                      ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
                      : 'border-slate-700 hover:border-amber-500/50 bg-slate-950/60'
                  }`}
                >
                  <input
                    ref={rosterFileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleRosterImageUpload(e.target.files)}
                    disabled={isOcrProcessing}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 mb-2">
                    <Files className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-slate-200 font-semibold text-center">
                    {isOcrProcessing ? ocrProgressText : 'Drop multiple roster/lobby screenshots or click to browse'}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1">
                    Select multiple screenshots at once (Slots 1-8, 9-16, etc.)
                  </span>
                </div>

                {/* List of uploaded roster screenshots */}
                {uploadedRosterFiles.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{uploadedRosterFiles.length} screenshot(s) analyzed:</span>
                      <button
                        type="button"
                        onClick={() => setUploadedRosterFiles([])}
                        className="text-slate-500 hover:text-red-400 text-[10px]"
                      >
                        Clear list
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {uploadedRosterFiles.map((file, fIdx) => (
                        <div
                          key={fIdx}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono"
                        >
                          <FileImage className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="truncate max-w-[130px]">{file.name}</span>
                          <span className="text-[10px] text-slate-500 font-sans">({formatBytes(file.size)})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dynamic Slot Table */}
        <div className="lg:col-span-7 p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-display font-bold text-white">Active Lobby Slots</h3>
                <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {rosters.length} Teams Registered
                </span>
              </div>

              <button
                onClick={handleAddSlot}
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Slot
              </button>
            </div>

            {rosters.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-lg border border-dashed border-slate-800">
                <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-300">No Teams Added Yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Paste your slot list on the left or click "BGIS 16-Team Preset" above to load an instant tournament lineup.
                </p>
              </div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto pr-1 space-y-2">
                {rosters.map((roster) => (
                  <div
                    key={roster.slot}
                    className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-800 text-amber-400 flex items-center justify-center font-mono font-bold text-xs shrink-0 ring-1 ring-slate-700">
                        {roster.slot}
                      </div>

                      <div className="space-y-1">
                        <input
                          type="text"
                          value={roster.teamName}
                          onChange={(e) => handleUpdateTeamName(roster.slot, e.target.value)}
                          className="text-sm font-semibold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-amber-400 focus:outline-none px-1 py-0.5"
                          placeholder="Team Name"
                        />

                        {/* Player tags */}
                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400 font-mono">
                          {roster.players && roster.players.length > 0 ? (
                            roster.players.map((p, pIdx) => (
                              <input
                                key={pIdx}
                                type="text"
                                value={p}
                                onChange={(e) => handleUpdatePlayer(roster.slot, pIdx, e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 text-[11px] w-20 focus:outline-none focus:border-amber-500"
                                placeholder={`P${pIdx + 1}`}
                              />
                            ))
                          ) : (
                            <span className="text-slate-600 text-xs italic">No player IGNs recorded</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveSlot(roster.slot)}
                      className="text-slate-500 hover:text-red-400 p-1.5 transition-colors self-end sm:self-center"
                      title="Remove Slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next Step CTA */}
          <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Ready to process match scoreboards with ultra-fast Gemini OCR.
            </span>
            <button
              onClick={onNext}
              disabled={rosters.length === 0}
              className={`px-5 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-all ${
                rosters.length > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Continue to Match OCR
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
