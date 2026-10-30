import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldAlert, Sparkles, KeyRound } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === 'arcadexbgmi') {
      localStorage.setItem('arcsoc_auth_token', 'authenticated');
      onLoginSuccess();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="min-h-screen diwali-lantern-bg diwali-lantern-pattern text-[#f5b76f] flex flex-col justify-center items-center p-4">
      {/* Glow Orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-[#cb7349]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-[#4a0e13]/40 rounded-full blur-3xl pointer-events-none" />

      <div
        className={`w-full max-w-md lantern-glow-card rounded-2xl p-8 relative z-10 space-y-6 shadow-2xl transition-transform ${
          shake ? 'animate-bounce' : ''
        }`}
      >
        {/* Brand Logo & Header */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden border-2 border-[#cb7349]/60 shadow-xl shadow-[#cb7349]/20 bg-[#140404] p-1">
            <img
              src="/logo.jpg"
              alt="Arcade Society Logo"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div>
            <h1 className="font-heading font-black text-2xl sm:text-3xl tracking-wider text-white uppercase">
              ARCADE SOCIETY
            </h1>
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-[#cb7349]/20 border border-[#cb7349]/40 text-[11px] font-mono text-[#f5b76f] mt-1 font-semibold uppercase">
              Internal Authorized Access
            </div>
          </div>
          <p className="text-xs text-[#cb7349] max-w-xs mx-auto">
            Authorized personnel only. Enter the team access key to unlock the BGMI points table engine.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#f5b76f] block">
              Access Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="Enter access password..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#140404] border border-[#cb7349]/40 rounded-xl text-white placeholder-[#cb7349]/40 font-mono text-sm focus:outline-none focus:border-[#f5b76f] transition-all"
                autoFocus
              />
              <Lock className="w-4 h-4 text-[#cb7349] absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-950/70 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Incorrect access password. Please try again.</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl font-heading font-bold text-base diya-button-glow flex items-center justify-center gap-2 tracking-wider uppercase transition-all shadow-lg"
          >
            <span>Authorize & Enter</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer info */}
        <div className="text-center pt-2 border-t border-[#4a0e13]">
          <span className="text-[11px] font-mono text-[#cb7349]/70">
            arcsoc internal tool · BGMI OCR Suite
          </span>
        </div>
      </div>
    </div>
  );
};

