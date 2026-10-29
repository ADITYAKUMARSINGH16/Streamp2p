"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Wifi,
  Globe,
  ShieldAlert,
  Pause,
  Play,
  UserX,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Activity,
  Gauge,
  Clock,
  Sparkles,
} from "lucide-react";
import { PeerTransferState } from "@/types/protocol";
import { formatBytes, formatSpeed, formatDuration } from "@/lib/formatters";

interface PeerTelemetryListProps {
  peers: PeerTransferState[];
  onPausePeer: (peerId: string) => void;
  onResumePeer: (peerId: string) => void;
  onKickPeer: (peerId: string) => void;
}

/**
 * Lightweight SVG Throughput Oscilloscope Sparkline
 * Pure SVG polyline calculation updated at throttled intervals
 */
function ThroughputOscilloscope({ history }: { history: number[] }) {
  const max = Math.max(...history, 500 * 1024); // Minimum 500 KB/s ceiling
  const points = history
    .map((val, idx) => {
      const x = (idx / (history.length - 1)) * 100;
      const y = 92 - (val / max) * 78;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="flex items-center gap-1.5" title="Throughput Oscilloscope Waveform">
      <svg
        className="w-20 sm:w-28 h-6 overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke="#00F0FF"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
}

export function PeerTelemetryList({
  peers,
  onPausePeer,
  onResumePeer,
  onKickPeer,
}: PeerTelemetryListProps) {
  // Speed history buffer per peer (clamped to 10 samples)
  const [speedHistories, setSpeedHistories] = useState<Record<string, number[]>>({});

  useEffect(() => {
    setSpeedHistories((prev) => {
      const next = { ...prev };
      peers.forEach((peer) => {
        const existing = next[peer.peerId] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        next[peer.peerId] = [...existing.slice(1), peer.bytesPerSecond];
      });
      return next;
    });
  }, [peers]);

  // 1. 3-Tier NAT Traversal Badge
  const getNatTierBadge = (natTier?: string, connectionType?: string) => {
    if (natTier === "tier1_lan") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/35 shadow-[0_0_12px_rgba(0,240,255,0.25)]">
          <Wifi className="w-3 h-3 text-[#00F0FF]" />
          TIER 1 // LAN DIRECT
        </span>
      );
    }
    if (natTier === "tier3_turn" || connectionType === "relay") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/35 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
          <ShieldAlert className="w-3 h-3 text-amber-400" />
          TIER 3 // TURN 5G RELAY
        </span>
      );
    }
    if (natTier === "tier2_stun" || connectionType === "p2p") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
          <Globe className="w-3 h-3 text-emerald-400" />
          TIER 2 // STUN P2P
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.04] text-slate-400 border border-white/[0.08]">
        <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
        <span>ANALYZING TIER...</span>
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "transferring":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-300 font-semibold animate-pulse">
            <Activity className="w-3 h-3 text-[#00F0FF]" />
            STREAMING
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 font-semibold">
            <Pause className="w-3 h-3" />
            PAUSED
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </span>
        );
      case "authenticating":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-brand-300 font-semibold">
            <Loader2 className="w-3 h-3 animate-spin" />
            VERIFYING PIN
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-rose-400 font-semibold">
            <AlertCircle className="w-3 h-3" />
            ERROR
          </span>
        );
      default:
        return (
          <span className="text-[11px] font-mono text-slate-400 uppercase">
            {status}
          </span>
        );
    }
  };

  const computeEta = (byteOffset: number, totalBytes: number, bytesPerSecond: number): string => {
    if (bytesPerSecond <= 0 || byteOffset >= totalBytes) return "--";
    const remaining = totalBytes - byteOffset;
    const secs = remaining / bytesPerSecond;
    return formatDuration(secs);
  };

  return (
    <div className="frosted-carbon border border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 font-sans tracking-tight">
              Active Swarm Receivers ({peers.length})
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Independent 1-to-Many Direct WebRTC Slices
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/30 border border-cyan-500/20">
          64 KB CHUNK PIPELINE
        </span>
      </div>

      {/* Empty State */}
      {peers.length === 0 ? (
        <div className="py-12 text-center space-y-2 select-none">
          <Users className="w-10 h-10 text-slate-700 mx-auto" />
          <p className="text-sm text-slate-300 font-mono font-semibold">
            No receivers connected yet
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Scan the QR code or send the 6-digit room code to stream files directly from your disk.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {peers.map((peer) => {
            const bufferedAmount = peer.bufferedAmount || 0;
            const bufferedKB = (bufferedAmount / 1024).toFixed(1);
            const percent = Math.min(100, Math.max(0, (bufferedAmount / 262144) * 100));
            const isValvePaused = peer.isValvePaused || bufferedAmount >= 262144;
            const history = speedHistories[peer.peerId] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            const eta = computeEta(peer.byteOffset, peer.totalBytes, peer.bytesPerSecond);

            return (
              <div
                key={peer.peerId}
                className="p-4 sm:p-5 rounded-xl bg-black/50 border border-white/[0.08] hover:border-cyan-500/30 transition-all space-y-3.5 shadow-lg group"
              >
                {/* 1. Peer Card Header & Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-500/25 font-mono text-[10px] font-bold tabular-nums">
                      PEER #{peer.peerId.slice(0, 8)}
                    </span>
                    {getNatTierBadge(peer.natTier, peer.connectionType)}
                    {getStatusBadge(peer.status)}
                  </div>

                  <div className="flex items-center gap-2">
                    {peer.status === "transferring" && (
                      <button
                        type="button"
                        onClick={() => onPausePeer(peer.peerId)}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-white/[0.1] hover:border-amber-500/30 text-xs font-mono transition flex items-center gap-1"
                        title="Pause Peer Stream"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    )}

                    {peer.status === "paused" && (
                      <button
                        type="button"
                        onClick={() => onResumePeer(peer.peerId)}
                        className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-mono transition flex items-center gap-1 shadow-md shadow-brand-500/25"
                        title="Resume Peer Stream"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onKickPeer(peer.peerId)}
                      className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/[0.08] hover:border-rose-500/30 transition"
                      title="Disconnect Peer"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 2. Oscilloscope Speedometer & Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center p-3 rounded-lg bg-black/40 border border-white/[0.05]">
                  {/* Speedometer */}
                  <div className="flex items-center justify-between sm:justify-start gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                        Transfer Rate
                      </span>
                      <span className="font-mono text-base sm:text-lg font-bold text-slate-100 tabular-nums">
                        {formatSpeed(peer.bytesPerSecond)}
                      </span>
                    </div>
                    {/* Live Throughput Sparkline */}
                    <ThroughputOscilloscope history={history} />
                  </div>

                  {/* Active File Name */}
                  <div className="truncate">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                      Target File
                    </span>
                    <span className="text-xs font-mono font-medium text-slate-200 truncate block">
                      {peer.currentFileName}
                    </span>
                  </div>

                  {/* ETA & Completion */}
                  <div className="sm:text-right">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                      Time Remaining
                    </span>
                    <span className="text-xs font-mono font-semibold text-cyan-300 flex items-center sm:justify-end gap-1 tabular-nums">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>{eta}</span>
                    </span>
                  </div>
                </div>

                {/* 3. Live SCTP Backpressure Valve Visualizer (0 KB -> 256 KB) */}
                <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        SCTP Backpressure Valve
                      </span>
                    </div>

                    {isValvePaused ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.2 rounded-full animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        VALVE PAUSED (DRAINING BUFFER)
                      </span>
                    ) : peer.status === "transferring" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.2 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse" />
                        PUMPING (64KB SLICE)
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">
                        VALVE STANDBY
                      </span>
                    )}
                  </div>

                  {/* Meter Track with 64 KB and 256 KB Watermark lines */}
                  <div className="relative w-full h-2 rounded-full bg-black/80 border border-white/[0.08] overflow-hidden">
                    {/* 64 KB Low Threshold Tick (25%) */}
                    <div
                      className="absolute top-0 bottom-0 w-[1px] bg-cyan-400/50 z-10"
                      style={{ left: "25%" }}
                      title="64 KB Low Watermark"
                    />
                    {/* Fill Bar */}
                    <div
                      className={`h-full transition-all duration-150 rounded-full ${
                        isValvePaused
                          ? "bg-gradient-to-r from-amber-500 to-rose-500 shadow-[0_0_12px_#F59E0B]"
                          : "bg-gradient-to-r from-cyan-600 via-cyan-400 to-[#00F0FF] shadow-[0_0_10px_#00F0FF]"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
                    <span className="text-cyan-300 font-semibold">{bufferedKB} KB BUFFERED</span>
                    <span>LOW: 64 KB &bull; HIGH: 256 KB WATERMARK</span>
                  </div>
                </div>

                {/* 4. Cumulative Transfer Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums">
                    <span className="text-slate-300">
                      {formatBytes(peer.byteOffset)} / {formatBytes(peer.totalBytes)}
                    </span>
                    <span className="font-bold text-slate-200">
                      {peer.progress.toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full bg-black/80 rounded-full h-2 overflow-hidden border border-white/[0.08]">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        peer.status === "completed"
                          ? "bg-emerald-500 shadow-[0_0_10px_#10B981]"
                          : peer.status === "paused"
                          ? "bg-amber-500"
                          : "bg-gradient-to-r from-brand-600 via-indigo-500 to-cyan-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                      }`}
                      style={{ width: `${peer.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
