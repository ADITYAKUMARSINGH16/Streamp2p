"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap,
  Activity,
  Cpu,
  Eye,
  Radio,
  Plus,
} from "lucide-react";
import { getSignalingSocket } from "@/lib/signaling";
import { useWakeLockStatus } from "@/lib/wakeLock";

export function Navbar() {
  const isWakeLockActive = useWakeLockStatus();

  // Live Signaling connection state
  const [signalingStatus, setSignalingStatus] = useState<"connecting" | "online" | "offline">("connecting");

  // Live RAM measurement (Chromium only)
  const [ramUsageMB, setRamUsageMB] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Signaling status observer
    try {
      const socket = getSignalingSocket();
      if (socket.connected) {
        setSignalingStatus("online");
      } else {
        setSignalingStatus("connecting");
      }

      const handleConnect = () => setSignalingStatus("online");
      const handleDisconnect = () => setSignalingStatus("offline");
      const handleConnectError = () => setSignalingStatus("offline");

      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);
      socket.on("connect_error", handleConnectError);

      // 2. RAM guard live telemetry polling (every 2s)
      const updateMemoryTelemetry = () => {
        if (
          typeof window !== "undefined" &&
          (window.performance as any)?.memory?.usedJSHeapSize
        ) {
          const usedBytes = (window.performance as any).memory.usedJSHeapSize;
          const mb = (usedBytes / (1024 * 1024)).toFixed(1);
          setRamUsageMB(mb);
        } else {
          setRamUsageMB(null);
        }
      };

      updateMemoryTelemetry();
      const memoryInterval = setInterval(updateMemoryTelemetry, 2000);

      return () => {
        socket.off("connect", handleConnect);
        socket.off("disconnect", handleDisconnect);
        socket.off("connect_error", handleConnectError);
        clearInterval(memoryInterval);
      };
    } catch (err) {
      setSignalingStatus("offline");
    }
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full px-3 sm:px-6 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto rounded-2xl frosted-carbon px-3.5 sm:px-5 h-14 sm:h-16 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/[0.08]">
        
        {/* Left Side: Brand & Telemetry Identifiers */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-[0_0_16px_rgba(99,102,241,0.4)] group-hover:scale-105 transition-transform">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-slate-100 text-base sm:text-lg tracking-tight font-sans">
                StreamP2P
              </span>
            </div>
          </Link>

          {/* Glowing ZERO-CLOUD Badge */}
          <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider uppercase bg-brand-500/10 text-brand-300 border border-brand-500/30 shadow-[0_0_15px_rgba(99,102,241,0.25)]">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            ZERO-CLOUD
          </div>

          {/* Live Signaling Connection Indicator Pill */}
          <div
            className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider uppercase transition-colors ${
              signalingStatus === "online"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                : signalingStatus === "connecting"
                ? "bg-amber-500/10 text-amber-300 border border-amber-500/25"
                : "bg-rose-500/10 text-rose-400 border border-rose-500/25"
            }`}
            title="Live WebSocket Signaling Network State"
          >
            <span className="relative flex h-2 w-2">
              {signalingStatus === "online" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  signalingStatus === "online"
                    ? "bg-emerald-400"
                    : signalingStatus === "connecting"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-rose-500"
                }`}
              />
            </span>
            <span className="hidden sm:inline">SIGNALING:</span>
            <span>{signalingStatus.toUpperCase()}</span>
          </div>
        </div>

        {/* Right Side: Live System Status Pills */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          
          {/* RAM Invariant Badge */}
          <div
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-emerald-950/25 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.1)]"
            title="SCTP Flow-Controlled RAM Guard Invariant (< 50 MB)"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>
              {ramUsageMB ? `${ramUsageMB} MB / < 50 MB` : "< 50 MB"}{" "}
              <strong className="text-emerald-300 font-semibold">RAM GUARD</strong>
            </span>
          </div>

          {/* Chunk Engine Badge */}
          <div
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-cyan-950/20 text-cyan-300 border border-cyan-500/20"
            title="12-Byte Binary Frame Layout: 4B fileIndex + 8B byteOffset + 64KB Slices"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>64 KB SLICER // 12B FRAME</span>
          </div>

          {/* Wake Lock Indicator Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
              isWakeLockActive
                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_14px_rgba(245,158,11,0.2)]"
                : "bg-white/[0.03] text-slate-400 border border-white/[0.06]"
            }`}
            title={
              isWakeLockActive
                ? "Hardware Screen Wake Lock Active (Screen will not sleep during transfer)"
                : "Screen Wake Lock in Standby (Activates automatically during host/transfer sessions)"
            }
          >
            <Eye
              className={`w-3.5 h-3.5 ${
                isWakeLockActive ? "text-amber-400 animate-pulse" : "text-slate-500"
              }`}
            />
            <span className="hidden sm:inline">WAKE LOCK:</span>
            <span className={isWakeLockActive ? "font-bold text-amber-200" : ""}>
              {isWakeLockActive ? "ENGAGED" : "STANDBY"}
            </span>
          </div>

          {/* Action: New Transfer Button */}
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 text-xs font-medium border border-white/[0.1] hover:border-brand-500/40 hover:text-white transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-brand-400" />
            <span className="hidden sm:inline">New Transfer</span>
          </Link>
        </div>

      </div>
    </header>
  );
}
