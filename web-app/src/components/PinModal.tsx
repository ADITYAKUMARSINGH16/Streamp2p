"use client";

import React, { useState, useRef, useEffect } from "react";
import { Lock, ArrowRight, ShieldCheck, AlertCircle, KeyRound, Sparkles } from "lucide-react";

interface PinModalProps {
  isOpen: boolean;
  onSubmit: (pin: string) => void;
  errorMessage?: string;
}

export function PinModal({ isOpen, onSubmit, errorMessage }: PinModalProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isShaking, setIsShaking] = useState(false);

  // Trigger smooth horizontal shake animation on invalid PIN attempts
  useEffect(() => {
    if (errorMessage) {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 550);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Focus the first empty slot when opened
  useEffect(() => {
    if (isOpen) {
      setDigits(["", "", "", "", "", ""]);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, value: string) => {
    // Keep last character entered (supports numbers & alphanumeric)
    const char = value.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 6 digits are populated
    const combined = newDigits.join("");
    if (combined.length === 6) {
      onSubmit(combined);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = "";
        setDigits(newDigits);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pin = digits.join("");
      if (pin.length >= 4) {
        onSubmit(pin);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    if (!pasted) return;

    const chars = pasted.slice(0, 6).split("");
    const newDigits = ["", "", "", "", "", ""];
    chars.forEach((c, i) => {
      newDigits[i] = c;
    });
    setDigits(newDigits);

    const nextFocus = Math.min(chars.length, 5);
    inputRefs.current[nextFocus]?.focus();

    if (chars.length >= 4) {
      onSubmit(chars.join(""));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = digits.join("");
    if (pin.length >= 4) {
      onSubmit(pin);
    }
  };

  const enteredPin = digits.join("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg frosted-carbon border rounded-2xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] space-y-6 transition-all duration-300 ${
          isShaking
            ? "animate-airlock-shake border-rose-500/60 shadow-[0_0_35px_rgba(244,63,94,0.35)]"
            : "border-white/[0.12] hover:border-cyan-500/30"
        }`}
      >
        {/* Header Airlock Badge */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-brand-500/10 to-indigo-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.2)]">
              <Lock className="w-7 h-7" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center shadow-md">
              <KeyRound className="w-3 h-3" />
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 mb-2">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Zero-Knowledge Vault Airlock</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 font-sans tracking-tight">
              Cryptographic PIN Challenge
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Enter the host security PIN to solve the HMAC challenge and unlock the direct file stream.
            </p>
          </div>
        </div>

        {/* Invalid Attempt Error Display */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-mono">{errorMessage}</span>
          </div>
        )}

        {/* 6-Digit Auto-Advancing Keypad Slots */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center items-center gap-2 sm:gap-3" onPaste={handlePaste}>
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                autoFocus={idx === 0}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-11 h-14 sm:w-14 sm:h-16 rounded-xl text-center text-2xl font-mono font-bold outline-none tabular-nums transition-all ${
                  digit
                    ? "bg-cyan-950/40 text-cyan-300 border-2 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.3)]"
                    : "bg-black/50 text-slate-300 border border-white/[0.12] focus:border-cyan-400 focus:bg-cyan-950/20 focus:shadow-[0_0_15px_rgba(0,240,255,0.25)]"
                }`}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={enteredPin.length < 4}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition shadow-lg shadow-brand-500/25 active:scale-[0.99]"
          >
            <span>VERIFY & UNLOCK STREAM</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Visual Status Indicator: HMAC-SHA256 Challenge-Response */}
        <div className="pt-2 border-t border-white/[0.06] flex flex-col items-center gap-1.5 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-400">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold tracking-wider">
              HMAC-SHA256 CHALLENGE-RESPONSE VERIFICATION
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono max-w-xs leading-relaxed">
            Salt signed locally with Web Crypto API. Plaintext PIN is never exposed over signaling.
          </p>
        </div>
      </div>
    </div>
  );
}
