"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { ShareCard } from "@/components/ShareCard";
import { PeerTelemetryList } from "@/components/PeerTelemetryList";
import { getSignalingSocket } from "@/lib/signaling";
import { WebRtcHostEngine } from "@/lib/webrtcHost";
import { ScreenWakeLockManager, setupBeforeUnloadGuard } from "@/lib/wakeLock";
import { PeerTransferState } from "@/types/protocol";

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
      setResolveError("Please enter a valid 6-digit code");
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
    <div className="w-full max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-10">
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          Zero Cloud Storage &bull; Real-Time WebRTC Swarm
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
          Stream Files Directly from <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-300">
            Browser to Browser
          </span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400">
          Files remain strictly on your local disk. Stream gigabytes or terabytes directly to one or multiple receivers at full wire speed.
        </p>

        {/* Tab Switcher */}
        {!isHosting && (
          <div className="inline-flex p-1 bg-surface-card border border-surface-border rounded-xl mt-4">
            <button
              type="button"
              onClick={() => setActiveTab("send")}
              className={`px-5 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === "send"
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Send Files (Host)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("receive")}
              className={`px-5 py-2 rounded-lg text-xs font-semibold transition ${
                activeTab === "receive"
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Receive via Code
            </button>
          </div>
        )}
      </div>

      {/* Tab 1: Send Files (Host) */}
      {activeTab === "send" && (
        <div className="space-y-6">
          {!isHosting ? (
            <div className="space-y-6">
              <FileDropzone
                files={stagedFiles}
                onFilesChanged={setStagedFiles}
                disabled={isHosting}
              />

              {/* Security & Configuration Options */}
              {stagedFiles.length > 0 && (
                <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-200">
                          Transfer Security PIN
                        </h4>
                        <p className="text-xs text-slate-400">
                          Require receivers to verify an HMAC challenge before accessing files
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
                            Math.floor(1000 + Math.random() * 9000).toString()
                          );
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        pinEnabled ? "bg-brand-600" : "bg-slate-800"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          pinEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {pinEnabled && (
                    <div className="pt-2 border-t border-slate-800 flex items-center gap-3">
                      <label className="text-xs text-slate-400 font-medium">
                        Set PIN:
                      </label>
                      <input
                        type="text"
                        maxLength={8}
                        value={pinValue}
                        onChange={(e) => setPinValue(e.target.value)}
                        placeholder="e.g. 4829"
                        className="w-32 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono tracking-widest text-center text-white focus:outline-none focus:border-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPinValue(
                            Math.floor(1000 + Math.random() * 9000).toString()
                          )
                        }
                        className="text-xs text-brand-400 hover:text-brand-300 font-medium"
                      >
                        Generate Random PIN
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Start Broadcasting Button */}
              {stagedFiles.length > 0 && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleStartHosting}
                    className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-base shadow-xl shadow-brand-500/25 flex items-center justify-center gap-3 transition transform active:scale-[0.98]"
                  >
                    <Radio className="w-5 h-5 animate-pulse" />
                    <span>Create Swarm Hub & Start Streaming</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {hostError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 text-center">
                  {hostError}
                </div>
              )}
            </div>
          ) : (
            /* Live Hosting Session View */
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between bg-surface-card border border-surface-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      Broadcasting {stagedFiles.length} {stagedFiles.length === 1 ? "file" : "files"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Keep this tab open while receivers are downloading
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStopHosting}
                  className="px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <StopCircle className="w-4 h-4 text-rose-400" />
                  Close Room
                </button>
              </div>

              {/* Share Card with QR Code and 6-Digit code */}
              <ShareCard
                roomId={roomId}
                shortCode={shortCode}
                pin={pinEnabled ? pinValue : undefined}
                isWakeLockActive={wakeLockActive}
              />

              {/* Multi-Peer Live Telemetry Dashboard */}
              <PeerTelemetryList
                peers={peers}
                onPausePeer={(peerId) => hostEngineRef.current?.pausePeer(peerId)}
                onResumePeer={(peerId) => hostEngineRef.current?.resumePeer(peerId)}
                onKickPeer={(peerId) => hostEngineRef.current?.kickPeer(peerId)}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Receive via 6-Digit Code */}
      {activeTab === "receive" && (
        <div className="max-w-md mx-auto bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center mx-auto">
              <Zap className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-100">Join Transfer Session</h2>
            <p className="text-xs text-slate-400">
              Enter the 6-digit room code displayed on the sender&apos;s screen to initiate direct P2P streaming.
            </p>
          </div>

          {resolveError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 text-center">
              {resolveError}
            </div>
          )}

          <form onSubmit={handleResolveCode} className="space-y-4">
            <div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={7}
                placeholder="000-000"
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
                className="w-full text-center text-3xl font-mono tracking-widest py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={
                joinCodeInput.replace(/\D/g, "").length !== 6 || isResolvingCode
              }
              className="w-full py-3.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-brand-600/30"
            >
              <span>{isResolvingCode ? "Looking up swarm..." : "Connect & Download"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 text-center">
            <span className="text-xs text-slate-500">
              Or simply scan the sender&apos;s QR code with your mobile camera.
            </span>
          </div>
        </div>
      )}

      {/* Feature Guarantee Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-surface-border">
        <div className="p-5 rounded-2xl bg-surface-card/60 border border-surface-border space-y-2">
          <HardDrive className="w-5 h-5 text-emerald-400" />
          <h4 className="text-sm font-semibold text-slate-200">
            Direct-to-Disk Streaming
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Streams written directly to filesystem handles via HTML5 File System Access API. Zero RAM accumulation even with 50 GB+ transfers.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-surface-card/60 border border-surface-border space-y-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <h4 className="text-sm font-semibold text-slate-200">
            1-to-Many Swarm Hub
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Broadcast to multiple colleagues or devices simultaneously. Each receiver streams independently at their own link capacity.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-surface-card/60 border border-surface-border space-y-2">
          <ShieldCheck className="w-5 h-5 text-brand-400" />
          <h4 className="text-sm font-semibold text-slate-200">
            Zero Cloud Storage & NAT Traversal
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            End-to-end DTLS encrypted WebRTC. Auto-traverses firewalls and symmetric NATs via Google STUN and integrated TURN fallback.
          </p>
        </div>
      </div>
    </div>
  );
}

