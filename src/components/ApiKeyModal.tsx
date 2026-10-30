import React, { useState, useEffect } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, X, ExternalLink, ShieldCheck } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
}) => {
  if (!isOpen) return null;

  const [inputKey, setInputKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  useEffect(() => {
    setInputKey(apiKey);
    setStatus({ type: null, message: '' });
  }, [apiKey, isOpen]);

  const handleTestAndSave = async () => {
    const trimmed = inputKey.trim();
    if (!trimmed) {
      onSaveApiKey('');
      setStatus({ type: 'success', message: 'Cleared custom key. Using server environment default.' });
      setTimeout(() => onClose(), 1200);
      return;
    }

    setIsValidating(true);
    setStatus({ type: null, message: '' });

    try {
      const resp = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = await resp.json();

      if (resp.ok && data.valid) {
        onSaveApiKey(trimmed);
        setStatus({
          type: 'success',
          message: 'Key validated successfully! Stored securely in your browser.',
        });
        setTimeout(() => onClose(), 1200);
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to validate API key. Please check the key.',
        });
      }
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: err?.message || 'Network error while validating key.',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleClear = () => {
    setInputKey('');
    onSaveApiKey('');
    setStatus({ type: 'success', message: 'Custom API key removed.' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#3e0c0d] border border-[#cb7349]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#f5b76f]">
        {/* Header */}
        <div className="p-5 border-b border-[#4a0e13] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#140404] text-[#f5b76f] flex items-center justify-center border border-[#cb7349]/40">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-white tracking-wider">
                Custom Gemini API Key
              </h3>
              <p className="text-[11px] text-[#cb7349]">
                Use your own Google AI key for unlimited OCR scans
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#cb7349] hover:text-white hover:bg-[#4a0e13] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs font-sans">
          <div className="space-y-1.5">
            <label className="font-semibold text-[#f5b76f] flex items-center justify-between">
              <span>Google Gemini API Key</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#cb7349] hover:text-white flex items-center gap-1 underline underline-offset-2"
              >
                Get Free Key <ExternalLink className="w-3 h-3" />
              </a>
            </label>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="AIzaSy... or AQ.Ab8..."
                className="w-full pl-3 pr-10 py-2.5 bg-[#140404] border border-[#cb7349]/40 rounded-lg text-white placeholder-[#cb7349]/40 font-mono text-xs focus:outline-none focus:border-[#f5b76f]"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#cb7349] hover:text-white p-1"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="p-3 rounded-lg bg-[#140404]/80 border border-[#4a0e13] flex items-start gap-2.5 text-[11px] text-[#cb7349]">
            <ShieldCheck className="w-4 h-4 text-[#f5b76f] shrink-0 mt-0.5" />
            <div>
              <span className="text-[#f5b76f] font-semibold block">Client-Side Storage:</span>
              Your key is saved only in your local browser (<code className="text-[#f5b76f]">localStorage</code>). It is never permanently stored on any server.
            </div>
          </div>

          {/* Status feedback */}
          {status.type && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                status.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/60 border-red-500/40 text-red-300'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{status.message}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-[#cb7349] hover:text-white hover:bg-[#4a0e13] border border-transparent transition-all"
            >
              Clear Key
            </button>

            <button
              type="button"
              onClick={handleTestAndSave}
              disabled={isValidating}
              className="px-5 py-2 rounded-lg text-xs font-bold diya-button-glow flex items-center gap-2 transition-all"
            >
              {isValidating ? 'Validating Key...' : 'Validate & Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

