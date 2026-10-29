"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Radio,
  Lock,
  Unlock,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  Zap,
  HardDrive,
  Users,
  StopCircle,
  Sparkles,
  Layers,
  Cpu,
  Binary,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { ShareCard } from "@/components/ShareCard";
import { PeerTelemetryList } from "@/components/PeerTelemetryList";
import { getSignalingSocket } from "@/lib/signaling";
import { WebRtcHostEngine } from "@/lib/webrtcHost";
import { ScreenWakeLockManager, setupBeforeUnloadGuard } from "@/lib/wakeLock";
import { PeerTransferState } from "@/types/protocol";
import { formatBytes } from "@/lib/formatters";

function generateRoomId(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  const randomBytes = new Uint8Array(8);
  window.crypto.getRandomValues(randomBytes);
  for (let i = 0; i < 8; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

function generateShortCode(): string {
  // 6 random digits: 100000 - 999999
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  const code = 100000 + (array[0] % 900000);
  return code.toString();
}

/**
 * Visual Live Architecture Pipeline Component
 * Demonstrates: [Disk Slice 64KB] -> [12B Frame Header] -> [SCTP DataChannel] -> [Peer Local Disk]
 */
function ArchitecturePipelineCard() {
  return (
    <div className="frosted-carbon border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200">
            SCTP Backpressure Streaming Pipeline
          </h4>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          RAM &lt; 50 MB
        </span>
      </div>

      {/* Visual Pipeline Conduits */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-center font-mono">
        {/* Node 1 */}
        <div className="p-3 rounded-xl bg-black/60 border border-white/[0.08] flex flex-col items-center justify-center space-y-1 relative group hover:border-cyan-400/40 transition">
          <HardDrive className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] font-bold text-slate-100">Disk Slice</span>
          <span className="text-[9px] text-emerald-300/80">64 KB Blob</span>
        </div>

        {/* Node 2 */}
        <div className="p-3 rounded-xl bg-black/60 border border-white/[0.08] flex flex-col items-center justify-center space-y-1 relative group hover:border-indigo-400/40 transition">
          <Binary className="w-4 h-4 text-indigo-400" />
          <span className="text-[11px] font-bold text-slate-100">12B Frame</span>
          <span className="text-[9px] text-indigo-300/80">4B Idx + 8B Off</span>
        </div>

        {/* Node 3 */}
        <div className="p-3 rounded-xl bg-black/60 border border-white/[0.08] flex flex-col items-center justify-center space-y-1 relative group hover:border-cyan-400/40 transition">
          <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-[11px] font-bold text-slate-100">SCTP Channel</span>
          <span className="text-[9px] text-cyan-300/80">256KB High Valve</span>
        </div>

        {/* Node 4 */}
        <div className="p-3 rounded-xl bg-black/60 border border-white/[0.08] flex flex-col items-center justify-center space-y-1 relative group hover:border-emerald-400/40 transition">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] font-bold text-slate-100">Peer Disk</span>
          <span className="text-[9px] text-emerald-300/80">Native FSA Write</span>
        </div>
      </div>

      <div className="pt-1 text-[11px] font-mono text-slate-400 leading-relaxed flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0" />
        <span>
          End-to-end encrypted DTLS. Zero cloud storage. Chunks are self-describing, enabling pause/resume with zero disk corruption.
        </span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();

  // Active Tab: 'send' | 'receive'
  const [activeTab, setActiveTab] = useState<"send" | "receive">("send");

  // Host configuration
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinValue, setPinValue] = useState("");

  // Host active session state
  const [isHosting, setIsHosting] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [peers, setPeers] = useState<PeerTransferState[]>([]);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);

  // Quick Join (Receive) state
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [isResolvingCode, setIsResolvingCode] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const hostEngineRef = useRef<WebRtcHostEngine | null>(null);
  const wakeLockRef = useRef<ScreenWakeLockManager | null>(null);

  const totalStagedSize = useMemo(
    () => stagedFiles.reduce((acc, f) => acc + f.size, 0),
    [stagedFiles]
  );

  // Tab close guard when hosting
  useEffect(() => {
    const unbindGuard = setupBeforeUnloadGuard(() => isHosting);
    return () => unbindGuard();
  }, [isHosting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hostEngineRef.current) {
        hostEngineRef.current.destroy();
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, []);

  const handleStartHosting = async () => {
    if (stagedFiles.length === 0) return;
    setHostError(null);

    const newRoomId = generateRoomId();
    const newShortCode = generateShortCode();

    try {
      const socket = getSignalingSocket();
      wakeLockRef.current = new ScreenWakeLockManager();
      const lockAcquired = await wakeLockRef.current.acquire();
      setWakeLockActive(lockAcquired);

      const engine = new WebRtcHostEngine(
        stagedFiles,
        newRoomId,
        newShortCode,
        socket,
        {
          onPeerUpdate: (updatedPeers) => {
            setPeers(updatedPeers);
          },
          onError: (err) => {
            setHostError(err);
          },
        },
        pinEnabled ? pinValue : undefined
      );

      engine.init();
      hostEngineRef.current = engine;
      setRoomId(newRoomId);
      setShortCode(newShortCode);
      setIsHosting(true);
    } catch (err: any) {
      setHostError(err?.message || "Failed to initialize host engine");
    }
  };

  const handleStopHosting = () => {
    if (hostEngineRef.current) {
      hostEngineRef.current.destroy();
      hostEngineRef.current = null;
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
    setIsHosting(false);
    setPeers([]);
    setWakeLockActive(false);
    setHostError(null);
  };

  const handleResolveCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCodeInput.replace(/\D/g, "");
    if (cleaned.length !== 6) {
      setResolveError("Please enter a valid 6-digit room code");
      return;
    }

    setResolveError(null);
    setIsResolvingCode(true);

    try {
      const socket = getSignalingSocket();
      socket.emit(
        "resolve-code",
        { shortCode: cleaned },
        (res: { success: boolean; roomId?: string; error?: string }) => {
          setIsResolvingCode(false);
          if (res.success && res.roomId) {
            router.push(`/r/${res.roomId}`);
          } else {
            setResolveError(res.error || "Transfer session not found or host offline");
          }
        }
      );
    } catch (err: any) {
      setIsResolvingCode(false);
      setResolveError("Signaling connection error");
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      {/* 1. Hero & Mission Control Mode Switcher (Visible when not actively broadcasting) */}
      {!isHosting && (
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold shadow-[0_0_15px_rgba(0,240,255,0.2)]">
            <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span> ZERO-CLOUD WEBRTC SWARM</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-sans">
            Direct High-Throughput <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] via-indigo-300 to-emerald-400">
              Browser-to-Browser File Streaming
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto font-sans leading-relaxed">
            Files stream in 64 KB slices directly from your disk to recipient disks. Zero intermediate cloud storage. Unlimited file sizes. RAM bounded under 50 MB.
          </p>

          {/* Mode Switcher Tabs */}
          <div className="inline-flex p-1 bg-black/60 border border-white/[0.08] rounded-xl mt-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("send")}
              className={`px-5 py-2.5 rounded-lg font-semibold transition ${
                activeTab === "send"
                  ? "bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/40 shadow-[0_0_15px_rgba(0,240,255,0.25)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Send Files (Host Swarm)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("receive")}
              className={`px-5 py-2.5 rounded-lg font-semibold transition ${
                activeTab === "receive"
                  ? "bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/40 shadow-[0_0_15px_rgba(0,240,255,0.25)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Receive via Code
            </button>
          </div>
        </div>
      )}

      {/* 2. Host Broadcast Workspace */}
      {activeTab === "send" && (
        <>
          {isHosting ? (
            /* ACTIVE MISSION CONTROL 2-COLUMN GRID */
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Mission Control Header Bar */}
              <div className="frosted-carbon border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#00F0FF]" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-slate-100 font-sans tracking-tight">
                        SWARM HUB BROADCASTING // ROOM #{shortCode}
                      </h2>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                        LIVE
                      </span>
                    </div>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      {stagedFiles.length} {stagedFiles.length === 1 ? "File" : "Files"} Staged &bull; {formatBytes(totalStagedSize)} Payload
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStopHosting}
                  className="px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-mono font-semibold flex items-center gap-2 transition shadow-sm"
                >
                  <StopCircle className="w-4 h-4 text-rose-400" />
                  <span>Terminate Swarm Hub</span>
                </button>
              </div>

              {/* 2-Column Orbital Mission Control Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: File Staging Dock & Architecture Pipeline */}
                <div className="lg:col-span-5 space-y-6">
                  <FileDropzone
                    files={stagedFiles}
                    onFilesChanged={setStagedFiles}
                    disabled={true}
                  />
                  <ArchitecturePipelineCard />
                </div>

                {/* Right Column: Dispatch Radar & Active Swarm Telemetry */}
                <div className="lg:col-span-7 space-y-6">
                  <ShareCard
                    roomId={roomId}
                    shortCode={shortCode}
                    pin={pinEnabled ? pinValue : undefined}
                    isWakeLockActive={wakeLockActive}
                  />

                  <PeerTelemetryList
                    peers={peers}
                    onPausePeer={(peerId) => hostEngineRef.current?.pausePeer(peerId)}
                    onResumePeer={(peerId) => hostEngineRef.current?.resumePeer(peerId)}
                    onKickPeer={(peerId) => hostEngineRef.current?.kickPeer(peerId)}
                  />
                </div>
              </div>

              {/* Ephemeral Session Notice Footer Pill */}
              <div className="pt-4 flex justify-center">
                <div className="frosted-carbon rounded-full px-4 sm:px-6 py-2 border border-white/[0.08] shadow-md inline-flex items-center gap-2.5 text-center text-[11px] font-mono text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    <strong>EPHEMERAL SESSION NOTICE:</strong> All transfer sessions run strictly in-memory. Closing this tab immediately terminates the session with zero cloud footprint.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* PRE-HOSTING STAGING VIEW */
            <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
              <FileDropzone
                files={stagedFiles}
                onFilesChanged={setStagedFiles}
                disabled={isHosting}
              />

              {/* Security & Configuration Options */}
              {stagedFiles.length > 0 && (
                <div className="frosted-carbon border border-white/[0.08] rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center justify-center">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100 font-sans">
                          HMAC-SHA256 Airlock Shield (Optional PIN)
                        </h4>
                        <p className="text-xs text-slate-400 font-sans">
                          Require receivers to verify an HMAC challenge before unlocking the file stream
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const next = !pinEnabled;
                        setPinEnabled(next);
                        if (next && !pinValue) {
                          setPinValue(
                            Math.floor(100000 + Math.random() * 900000).toString()
                          );
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        pinEnabled ? "bg-[#00F0FF]" : "bg-white/[0.1]"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow transition duration-200 ease-in-out ${
                          pinEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {pinEnabled && (
                    <div className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-3 text-xs font-mono">
                      <label className="text-slate-400 font-semibold">
                        SET 6-DIGIT PIN:
                      </label>
                      <input
                        type="text"
                        maxLength={8}
                        value={pinValue}
                        onChange={(e) => setPinValue(e.target.value)}
                        placeholder="e.g. 592841"
                        className="w-36 px-3 py-1.5 bg-black/60 border border-white/[0.12] rounded-lg text-sm font-mono tracking-widest text-center text-cyan-300 focus:outline-none focus:border-[#00F0FF]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPinValue(
                            Math.floor(100000 + Math.random() * 900000).toString()
                          )
                        }
                        className="text-xs text-cyan-300 hover:text-cyan-200 font-medium"
                      >
                        Generate Random PIN
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Start Broadcasting Primary CTA */}
              {stagedFiles.length > 0 && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleStartHosting}
                    className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-[#00F0FF] hover:opacity-95 text-white font-mono font-bold text-sm tracking-wide shadow-[0_0_30px_rgba(0,240,255,0.3)] flex items-center justify-center gap-3 transition transform active:scale-[0.99]"
                  >
                    <Radio className="w-5 h-5 text-white animate-pulse" />
                    <span>CREATE SWARM HUB & START STREAMING</span>
                    <ArrowRight className="w-5 h-5 text-white" />
                  </button>
                </div>
              )}

              {hostError && (
                <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-mono text-rose-300 text-center">
                  {hostError}
                </div>
              )}

              {/* Architecture Pipeline Preview */}
              <ArchitecturePipelineCard />
            </div>
          )}
        </>
      )}

      {/* 3. Tab 2: Receive via Code Console */}
      {activeTab === "receive" && (
        <div className="max-w-md mx-auto frosted-carbon border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in duration-300">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(0,240,255,0.2)]">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-slate-100 font-sans tracking-tight">
              Join P2P Swarm via Code
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              Enter the 6-digit room code shown on the sender&apos;s screen to establish a direct WebRTC stream.
            </p>
          </div>

          {resolveError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-mono text-rose-300 text-center">
              {resolveError}
            </div>
          )}

          <form onSubmit={handleResolveCode} className="space-y-4">
            <div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 849-201"
                autoFocus
                value={joinCodeInput}
                onChange={(e) => {
                  let raw = e.target.value.replace(/\D/g, "");
                  if (raw.length > 6) raw = raw.slice(0, 6);
                  if (raw.length > 3) {
                    setJoinCodeInput(`${raw.slice(0, 3)}-${raw.slice(3)}`);
                  } else {
                    setJoinCodeInput(raw);
                  }
                }}
                className="w-full text-center text-3xl font-mono tracking-widest py-3.5 bg-black/60 border border-white/[0.12] rounded-xl text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-[#00F0FF] focus:shadow-[0_0_20px_rgba(0,240,255,0.25)] transition tabular-nums"
              />
            </div>

            <button
              type="submit"
              disabled={
                joinCodeInput.replace(/\D/g, "").length !== 6 || isResolvingCode
              }
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-[#00F0FF] hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition shadow-lg shadow-brand-500/25"
            >
              <span>{isResolvingCode ? "RESOLVING SWARM ROUTE..." : "CONNECT & STREAM"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 text-center text-[11px] font-mono text-slate-500">
            Or scan the sender&apos;s QR code with your mobile camera.
          </div>
        </div>
      )}

      {/* 4. Three Technical Guarantee Pillars */}
      {!isHosting && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/[0.06]">
          <div className="p-5 rounded-2xl frosted-carbon border border-white/[0.08] space-y-2">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <h4 className="text-sm font-bold text-slate-200 font-sans">
              Direct-to-Disk Streaming
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Slices written directly to disk handles via HTML5 File System Access API. Zero RAM accumulation even with 50 GB+ transfers.
            </p>
          </div>

          <div className="p-5 rounded-2xl frosted-carbon border border-white/[0.08] space-y-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h4 className="text-sm font-bold text-slate-200 font-sans">
              1-to-Many Swarm Hub
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Broadcast to multiple peers simultaneously. Each receiver streams independently at their own link capacity over SCTP.
            </p>
          </div>

          <div className="p-5 rounded-2xl frosted-carbon border border-white/[0.08] space-y-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-slate-200 font-sans">
              Zero Cloud Storage & NAT Traversal
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              End-to-end DTLS encrypted WebRTC. Auto-traverses firewalls via local LAN direct, Google STUN, and integrated TURN fallback.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
