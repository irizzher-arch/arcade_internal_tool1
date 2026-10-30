import React from 'react';
import { Trophy, Settings, Sparkles, PlusCircle, KeyRound, LogOut } from 'lucide-react';

interface HeaderProps {
  activeTab: 'roster' | 'upload' | 'table' | 'graphic';
  setActiveTab: (tab: 'roster' | 'upload' | 'table' | 'graphic') => void;
  matchCount: number;
  teamCount: number;
  apiKey: string;
  onOpenApiKeyModal: () => void;
  onOpenSettings: () => void;
  onLoadSampleData: () => void;
  onOpenNewTournament: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  matchCount,
  teamCount,
  apiKey,
  onOpenApiKeyModal,
  onOpenSettings,
  onLoadSampleData,
  onOpenNewTournament,
  onLogout,
}) => {
  return (
    <header className="border-b border-[#3e0c0d] bg-[#140404]/95 backdrop-blur-md sticky top-0 z-40 shadow-lg shadow-[#140404]/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#cb7349]/60 shadow-lg shadow-[#cb7349]/30 bg-[#140404] p-0.5 shrink-0">
            <img
              src="/logo.jpg"
              alt="Arcade Society"
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-heading font-extrabold text-xl tracking-wider text-white whitespace-nowrap leading-tight">
              ARCADE SOCIETY
            </span>
            <span className="text-[10px] font-mono text-[#cb7349] tracking-wider uppercase">
              arcsoc internal tool · BGMI Matrix
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2 text-sm font-medium">
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap shrink-0 text-xs sm:text-sm font-medium ${
              activeTab === 'roster'
                ? 'bg-[#3e0c0d] text-[#f5b76f] font-semibold shadow-inner ring-1 ring-[#f5b76f]/40'
                : 'text-[#cb7349] hover:text-[#f5b76f] hover:bg-[#3e0c0d]/50'
            }`}
          >
            1. Rosters {teamCount > 0 && <span className="ml-1 opacity-75 font-mono">({teamCount})</span>}
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap shrink-0 text-xs sm:text-sm font-medium ${
              activeTab === 'upload'
                ? 'bg-[#3e0c0d] text-[#f5b76f] font-semibold shadow-inner ring-1 ring-[#f5b76f]/40'
                : 'text-[#cb7349] hover:text-[#f5b76f] hover:bg-[#3e0c0d]/50'
            }`}
          >
            2. Match OCR {matchCount > 0 && <span className="ml-1 opacity-75 font-mono">({matchCount})</span>}
          </button>

          <button
            onClick={() => setActiveTab('table')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap shrink-0 text-xs sm:text-sm font-medium ${
              activeTab === 'table'
                ? 'bg-[#3e0c0d] text-[#f5b76f] font-semibold shadow-inner ring-1 ring-[#f5b76f]/40'
                : 'text-[#cb7349] hover:text-[#f5b76f] hover:bg-[#3e0c0d]/50'
            }`}
          >
            3. Points Table
          </button>

          <button
            onClick={() => setActiveTab('graphic')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap shrink-0 text-xs sm:text-sm font-medium ${
              activeTab === 'graphic'
                ? 'bg-[#3e0c0d] text-[#f5b76f] font-semibold shadow-inner ring-1 ring-[#f5b76f]/40'
                : 'text-[#cb7349] hover:text-[#f5b76f] hover:bg-[#3e0c0d]/50'
            }`}
          >
            4. Broadcast Graphic
          </button>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* API Key Modal Button */}
          <button
            onClick={onOpenApiKeyModal}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
              apiKey
                ? 'bg-[#3e0c0d] border-[#f5b76f]/60 text-[#f5b76f]'
                : 'bg-[#140404] border-[#cb7349]/40 text-[#cb7349] hover:border-[#f5b76f] hover:text-[#f5b76f]'
            }`}
            title={apiKey ? 'Custom Gemini API Key Connected' : 'Set Custom Gemini API Key'}
          >
            <KeyRound className="w-3.5 h-3.5 text-[#f5b76f]" />
            <span className="hidden sm:inline font-mono">
              {apiKey ? 'Custom API Active' : 'API Key'}
            </span>
          </button>

          <button
            onClick={onOpenNewTournament}
            className="px-3 py-1.5 text-xs font-bold text-[#140404] diya-button-glow rounded-lg transition-all shadow-md shadow-[#cb7349]/30 flex items-center gap-1.5 whitespace-nowrap shrink-0 font-sans"
            title="Start a new tournament setup"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Tournament</span>
          </button>

          <button
            onClick={onOpenSettings}
            title="Point Matrix Rules"
            className="p-2 text-[#cb7349] hover:text-[#f5b76f] hover:bg-[#3e0c0d] rounded-lg transition-colors border border-[#3e0c0d]"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onLoadSampleData}
            title="Load sample tournament matches and rosters"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#f5b76f] bg-[#3e0c0d] hover:bg-[#4a0e13] border border-[#cb7349]/40 rounded-lg transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#f5b76f]" />
            <span className="whitespace-nowrap">Load Demo</span>
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Lock / Logout from arcsoc internal tool"
              className="p-2 text-[#cb7349] hover:text-red-400 hover:bg-[#3e0c0d] rounded-lg transition-colors border border-[#3e0c0d]"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
