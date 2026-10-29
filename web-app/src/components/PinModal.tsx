"use client";

import React, { useState } from "react";
import { Lock, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

interface PinModalProps {
  isOpen: boolean;
  onSubmit: (pin: string) => void;
  errorMessage?: string;
}

export function PinModal({ isOpen, onSubmit, errorMessage }: PinModalProps) {
  const [pin, setPin] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim().length > 0) {
      onSubmit(pin.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-surface-card border border-surface-border rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">PIN Protected Transfer</h2>
          <p className="text-xs text-slate-400 max-w-xs">
            The sender has protected this file stream with a security PIN. Enter the PIN to authenticate and decrypt the manifest.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              autoFocus
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full text-center text-2xl font-mono tracking-widest py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={pin.trim().length === 0}
            className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-brand-600/30"
          >
            <span>Authenticate & Connect</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Zero plaintext exposure &bull; Web Crypto HMAC-SHA256</span>
        </div>
      </div>
    </div>
  );
}

