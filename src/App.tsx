import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { RosterStep } from './components/RosterStep';
import { OcrUploadStep } from './components/OcrUploadStep';
import { LeaderboardTable } from './components/LeaderboardTable';
import { StreamerGraphicCard } from './components/StreamerGraphicCard';
import { PointSettingsModal } from './components/PointSettingsModal';
import { MatchDetailModal } from './components/MatchDetailModal';
import { NewTournamentModal } from './components/NewTournamentModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { LoginPage } from './components/LoginPage';
import { TeamRoster, MatchData, PointSettings } from './types/tournament';
import { OFFICIAL_BGMI_10_POINT, calculateLeaderboard, calculateTopFraggers } from './utils/scoring';
import { SAMPLE_BGIS_ROSTERS, SAMPLE_MATCHES } from './utils/presets';
import { Trophy, Zap, ShieldAlert, Sparkles } from 'lucide-react';

export default function App() {
  const [tournamentName, setTournamentName] = useState<string>('BGIS 2026 GRAND FINALS');
  const [activeTab, setActiveTab] = useState<'roster' | 'upload' | 'table' | 'graphic'>('table');
  const [rosters, setRosters] = useState<TeamRoster[]>(SAMPLE_BGIS_ROSTERS);
  const [matches, setMatches] = useState<MatchData[]>(SAMPLE_MATCHES);
  const [pointSettings, setPointSettings] = useState<PointSettings>(OFFICIAL_BGMI_10_POINT);

  // Authentication state for arcsoc internal tool
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('arcsoc_auth_token') === 'authenticated';
  });

  const handleLogout = () => {
    localStorage.removeItem('arcsoc_auth_token');
    setIsAuthenticated(false);
  };

  // Client-side API key management via localStorage
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('arcsoc_gemini_api_key') || '';
  });
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  const handleSaveApiKey = (newKey: string) => {
    setApiKey(newKey);
    if (newKey) {
      localStorage.setItem('arcsoc_gemini_api_key', newKey);
    } else {
      localStorage.removeItem('arcsoc_gemini_api_key');
    }
  };

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNewTournamentModalOpen, setIsNewTournamentModalOpen] = useState(false);
  const [selectedMatchForDetail, setSelectedMatchForDetail] = useState<MatchData | null>(null);
  const [isMatchDetailModalOpen, setIsMatchDetailModalOpen] = useState(false);

  // Derived Leaderboard with tiebreaker calculation
  const leaderboard = useMemo(() => {
    return calculateLeaderboard(rosters, matches, pointSettings);
  }, [rosters, matches, pointSettings]);

  // Derived Top Fraggers
  const topFraggers = useMemo(() => {
    return calculateTopFraggers(leaderboard, rosters);
  }, [leaderboard, rosters]);

  // Direct cell editing handler for instant points recalculation
  const handleUpdateTeamMatchStat = (
    slot: number,
    matchNumber: number,
    newPlacement: number,
    newKills: number
  ) => {
    setMatches((prevMatches) => {
      return prevMatches.map((match) => {
        if (match.matchNumber !== matchNumber) return match;

        const existingStandingIndex = match.standings.findIndex((s) => s.slot === slot);
        const updatedStandings = [...match.standings];

        if (existingStandingIndex >= 0) {
          updatedStandings[existingStandingIndex] = {
            ...updatedStandings[existingStandingIndex],
            placement: newPlacement,
            kills: newKills,
          };
        } else {
          const teamRoster = rosters.find((r) => r.slot === slot);
          updatedStandings.push({
            placement: newPlacement,
            slot,
            teamName: teamRoster ? teamRoster.teamName : `Slot ${slot}`,
            kills: newKills,
            players: [],
          });
        }

        return {
          ...match,
          standings: updatedStandings,
        };
      });
    });
  };

  const handleSaveMatchDetail = (updatedMatch: MatchData) => {
    setMatches((prev) =>
      prev.map((m) => (m.id === updatedMatch.id ? updatedMatch : m))
    );
  };

  const handleOpenMatchDetail = (match: MatchData) => {
    setSelectedMatchForDetail(match);
    setIsMatchDetailModalOpen(true);
  };

  const handleLoadSampleData = () => {
    setRosters(SAMPLE_BGIS_ROSTERS);
    setMatches(SAMPLE_MATCHES);
    setTournamentName('BGIS 2026 GRAND FINALS');
    setActiveTab('table');
  };

  const handleConfirmNewTournament = (config: {
    tournamentName: string;
    stageName: string;
    pointSettings: PointSettings;
    rosters: TeamRoster[];
    clearMatches: boolean;
  }) => {
    const fullName = config.stageName
      ? `${config.tournamentName} · ${config.stageName}`
      : config.tournamentName;

    setTournamentName(fullName);
    setPointSettings(config.pointSettings);
    setRosters(config.rosters);
    if (config.clearMatches) {
      setMatches([]);
    }
    setActiveTab('roster');
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen diwali-lantern-bg diwali-lantern-pattern text-[#f5b76f] flex flex-col selection:bg-[#cb7349]/40 selection:text-[#f5b76f]">
      {/* Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        matchCount={matches.length}
        teamCount={rosters.length}
        apiKey={apiKey}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onLoadSampleData={handleLoadSampleData}
        onOpenNewTournament={() => setIsNewTournamentModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'roster' && (
          <RosterStep
            rosters={rosters}
            setRosters={setRosters}
            onNext={() => setActiveTab('upload')}
            onOpenNewTournament={() => setIsNewTournamentModalOpen(true)}
            apiKey={apiKey}
          />
        )}

        {activeTab === 'upload' && (
          <OcrUploadStep
            rosters={rosters}
            setRosters={setRosters}
            matches={matches}
            setMatches={setMatches}
            onNext={() => setActiveTab('table')}
            onOpenMatchDetail={handleOpenMatchDetail}
            apiKey={apiKey}
          />
        )}

        {activeTab === 'table' && (
          <LeaderboardTable
            leaderboard={leaderboard}
            matches={matches}
            topFraggers={topFraggers}
            pointSettings={pointSettings}
            tournamentName={tournamentName}
            setTournamentName={setTournamentName}
            onUpdateTeamMatchStat={handleUpdateTeamMatchStat}
            onViewGraphicCard={() => setActiveTab('graphic')}
            onOpenNewTournament={() => setIsNewTournamentModalOpen(true)}
          />
        )}

        {activeTab === 'graphic' && (
          <StreamerGraphicCard
            leaderboard={leaderboard}
            matches={matches}
            topFraggers={topFraggers}
            tournamentName={tournamentName}
            onBackToTable={() => setActiveTab('table')}
          />
        )}
      </main>

      {/* Modals */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />

      <NewTournamentModal
        isOpen={isNewTournamentModalOpen}
        onClose={() => setIsNewTournamentModalOpen(false)}
        onConfirmNewTournament={handleConfirmNewTournament}
      />

      <PointSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        pointSettings={pointSettings}
        setPointSettings={setPointSettings}
      />

      <MatchDetailModal
        isOpen={isMatchDetailModalOpen}
        match={selectedMatchForDetail}
        onClose={() => {
          setIsMatchDetailModalOpen(false);
          setSelectedMatchForDetail(null);
        }}
        onSaveMatch={handleSaveMatchDetail}
      />

      {/* Esports Footer */}
      <footer className="border-t border-[#3e0c0d] bg-[#140404]/90 py-4 text-center text-xs text-[#cb7349]/70 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[#f5b76f]/80">arcsoc internal tool · BGMI Points Table Matrix</span>
          <div className="flex items-center gap-4 text-[#cb7349]">
            <span>Official 10-Point Scoring</span>
            <span>·</span>
            <span>1920x1080 HD Export</span>
            <span>·</span>
            <span>Client-Side Canvas Downscaling</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
