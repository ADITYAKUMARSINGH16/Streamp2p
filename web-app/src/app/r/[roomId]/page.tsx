"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  DownloadCloud,
  HardDrive,
  Pause,
  Play,
  Wifi,
  Globe,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileArchive,
  Film,
  Music,
  Image as ImageIcon,
  Code,
  File,
  Loader2,
  ArrowLeft,
  SunMedium,
  Sparkles,
  Cpu,
  Clock,
  Activity,
  Layers,
} from "lucide-react";

import { PinModal } from "@/components/PinModal";
import { getSignalingSocket } from "@/lib/signaling";
import {
  WebRtcClientEngine,
  ReceiverProgressInfo,
} from "@/lib/webrtcClient";
import { ScreenWakeLockManager, setupBeforeUnloadGuard } from "@/lib/wakeLock";
import {
  ManifestFileItem,
  PeerConnectionMode,
} from "@/types/protocol";
import { formatBytes, formatSpeed, formatDuration } from "@/lib/formatters";

function ReceiverPageContent() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  // Connection & Auth state
  const [statusMessage, setStatusMessage] = useState<string>("Connecting to Signaling...");
  const [connectionMode, setConnectionMode] = useState<PeerConnectionMode>("unknown");
  const [iceState, setIceState] = useState<RTCIceConnectionState | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hostDisconnected, setHostDisconnected] = useState<boolean>(false);

  // File Manifest state
  const [manifestFiles, setManifestFiles] = useState<ManifestFileItem[]>([]);
  const [totalSize, setTotalSize] = useState<number>(0);

  // Streaming progress state
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [progressInfo, setProgressInfo] = useState<ReceiverProgressInfo | null>(null);
  const [completedFileIndices, setCompletedFileIndices] = useState<Set<number>>(new Set());

  // Hardware wake lock
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);

  // Native File System Access API capability check
  const [hasNativeFSA, setHasNativeFSA] = useState<boolean>(true);

  const clientEngineRef = useRef<WebRtcClientEngine | null>(null);
  const wakeLockRef = useRef<ScreenWakeLockManager | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHasNativeFSA("showSaveFilePicker" in window);
    }
  }, []);

  // Guard against closing tab while downloading
  useEffect(() => {
    const unbind = setupBeforeUnloadGuard(() => isDownloading && !isCompleted);
    return () => unbind();
  }, [isDownloading, isCompleted]);

  // Initialize WebRTC client engine on mount
  useEffect(() => {
    if (!roomId) return;

    let socket;
    try {
      socket = getSignalingSocket();
    } catch (err: any) {
      setErrorMessage("Could not connect to signaling network");
      return;
    }

    wakeLockRef.current = new ScreenWakeLockManager();

    const engine = new WebRtcClientEngine(roomId, socket, {
      onStatusChange: (status) => setStatusMessage(status),
      onConnectionMode: (mode) => setConnectionMode(mode),
      onIceStateChange: (state) => setIceState(state),
      onPinRequired: (_salt) => {
        setIsPinModalOpen(true);
      },
      onAuthResult: (success, message) => {
        if (success) {
          setIsPinModalOpen(false);
          setPinError(undefined);
        } else {
          setPinError(message || "Invalid PIN entered.");
        }
      },
      onManifestReceived: (files, total) => {
        setManifestFiles(files);
        setTotalSize(total);
      },
      onProgress: (info) => {
        setProgressInfo(info);
      },
      onFileCompleted: (fileIndex, _fileName) => {
        setCompletedFileIndices((prev) => new Set(prev).add(fileIndex));
      },
      onTransferComplete: () => {
        setIsCompleted(true);
        setIsDownloading(false);
        try {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
          });
        } catch (e) {}
      },
      onHostDisconnected: () => {
        setHostDisconnected(true);
        setIsDownloading(false);
        setStatusMessage("Host closed transfer session");
      },
      onError: (err) => {
        setErrorMessage(err);
      },
    });

    engine.init();
    clientEngineRef.current = engine;

    return () => {
      if (clientEngineRef.current) {
        clientEngineRef.current.destroy();
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, [roomId]);

  const handlePinSubmit = async (pin: string) => {
    if (clientEngineRef.current) {
      await clientEngineRef.current.submitPin(pin);
    }
  };

  const handleStartDownload = async () => {
    if (!clientEngineRef.current) return;
    setErrorMessage(null);

    if (wakeLockRef.current) {
      const lockOk = await wakeLockRef.current.acquire();
      setIsWakeLockActive(lockOk);
    }

    setIsDownloading(true);
    setIsPaused(false);
    await clientEngineRef.current.startDownload();
  };

  const handlePause = () => {
    if (clientEngineRef.current) {
      clientEngineRef.current.pauseDownload();
      setIsPaused(true);
    }
  };

  const handleResume = () => {
    if (clientEngineRef.current) {
      clientEngineRef.current.resumeDownload();
      setIsPaused(false);
    }
  };

  const getFileIcon = (mimeType: string, name: string) => {
    const lname = name.toLowerCase();
    if (mimeType.startsWith("image/") || lname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
      return <ImageIcon className="w-4 h-4 text-emerald-400" />;
    }
    if (mimeType.startsWith("video/") || lname.match(/\.(mp4|mkv|mov|webm|avi)$/)) {
      return <Film className="w-4 h-4 text-indigo-400" />;
    }
    if (mimeType.startsWith("audio/") || lname.match(/\.(mp3|wav|flac|ogg)$/)) {
      return <Music className="w-4 h-4 text-pink-400" />;
    }
    if (lname.match(/\.(zip|tar|gz|7z|rar)$/)) {
      return <FileArchive className="w-4 h-4 text-amber-400" />;
    }
    if (lname.match(/\.(ts|tsx|js|jsx|json|py|go|rs|c|cpp|html|css)$/)) {
      return <Code className="w-4 h-4 text-cyan-400" />;
    }
    if (mimeType.startsWith("text/") || lname.match(/\.(pdf|txt|md|doc|docx)$/)) {
      return <FileText className="w-4 h-4 text-blue-400" />;
    }
    return <File className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-6">
      {/* Cryptographic PIN Challenge Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        onSubmit={handlePinSubmit}
        errorMessage={pinError}
      />

      {/* Top Console Navigation & Traversal Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-cyan-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO COCKPIT</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Disk Write Pipeline Badge */}
          {hasNativeFSA ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/35 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
              title="HTML5 File System Access API: direct disk streaming without intermediate memory buffering"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>NATIVE DISK STREAM // ZERO-RAM WRITE</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/35"
              title="Service Worker ReadableStream interception for Safari / Firefox direct disk pipes"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-amber-400" />
              <span>SW STREAM CONDUIT // DIRECT DOWNLOAD</span>
            </span>
          )}

          {/* Network Connection Mode Badge */}
          {connectionMode === "p2p" ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/35">
              <Wifi className="w-3 h-3 text-[#00F0FF]" />
              <span>DIRECT P2P LINK</span>
            </span>
          ) : connectionMode === "relay" ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/35">
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              <span>TURN 443 RELAY</span>
            </span>
          ) : null}

          {/* Wake Lock Active Badge */}
          {isWakeLockActive && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <SunMedium className="w-3 h-3 text-amber-400" />
              <span>WAKE LOCK</span>
            </span>
          )}
        </div>
      </div>

      {/* Temporary ICE Disconnected Grace Period Recovery Banner */}
      {iceState === "disconnected" && !hostDisconnected && (
        <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/35 text-xs text-amber-200 flex items-center gap-3 animate-in fade-in duration-200 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="font-mono font-bold text-amber-300 uppercase tracking-wider">
              RE-BINDING ICE / TURN RELAY (10s GRACE)...
            </p>
            <p className="text-[11px] text-amber-200/80 mt-0.5 font-mono">
              Temporary mobile or network handoff detected. WebRTC is negotiating alternate STUN/TURN paths without corrupting in-flight disk chunks.
            </p>
          </div>
        </div>
      )}

      {/* Host Disconnected Alert */}
      {hostDisconnected && (
        <div className="p-6 rounded-2xl bg-rose-500/15 border border-rose-500/30 space-y-3 text-center animate-in fade-in duration-300">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <h3 className="text-base font-bold font-sans text-rose-200">
            Sender Tab Was Closed
          </h3>
          <p className="text-xs text-rose-300/80 max-w-md mx-auto font-sans leading-relaxed">
            StreamP2P operates with strictly zero cloud storage. Slices stream directly from the sender&apos;s open tab. Because the sender closed their tab, the ephemeral session has terminated.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-mono font-bold transition inline-block border border-rose-500/30"
            >
              Start New Transfer
            </Link>
          </div>
        </div>
      )}

      {/* General Error Message */}
      {errorMessage && !hostDisconnected && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-mono text-rose-300 text-center">
          {errorMessage}
        </div>
      )}

      {/* Main Conduit Receiver Console */}
      <div className="frosted-carbon border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-bold">
                DIRECT-TO-DISK STREAM RECEIVER // ROOM {roomId}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-sans tracking-tight mt-1 flex items-center gap-2.5">
              {manifestFiles.length > 0 ? (
                `${manifestFiles.length} ${manifestFiles.length === 1 ? "File" : "Files"} Ready for Stream`
              ) : (
                <>
                  <Loader2 className="w-6 h-6 text-[#00F0FF] animate-spin" />
                  <span>Connecting to Sender Swarm...</span>
                </>
              )}
            </h1>

            <p className="text-xs font-mono text-slate-400 mt-1 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00F0FF]" />
              </span>
              <span>
                Status: <strong className="text-cyan-300 font-semibold">{statusMessage}</strong>
              </span>
            </p>
          </div>

          {manifestFiles.length > 0 && (
            <div className="sm:text-right font-mono">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">
                Total Payload Size
              </span>
              <p className="text-2xl font-bold text-white tabular-nums">
                {formatBytes(totalSize)}
              </p>
            </div>
          )}
        </div>

        {/* Live Stream Telemetry & Throughput Card (During Active Download) */}
        {isDownloading && progressInfo && (
          <div className="p-5 rounded-2xl bg-black/60 border border-white/[0.08] space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Active Slice Conduit
                </span>
                <p className="text-sm font-semibold text-slate-100 truncate max-w-sm">
                  {progressInfo.fileName}
                </p>
                <p className="text-[11px] text-cyan-400 tabular-nums">
                  [SLOT #{progressInfo.fileIndex.toString().padStart(2, "0")}] OFFSET: {formatBytes(progressInfo.fileBytesReceived)} / {formatBytes(progressInfo.fileTotalBytes)}
                </p>
              </div>

              <div className="text-right space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Throughput Rate
                </span>
                <p className="font-mono text-xl font-bold text-cyan-300 tabular-nums">
                  {formatSpeed(progressInfo.bytesPerSecond)}
                </p>
                <p className="text-slate-400 text-[11px] font-mono flex items-center justify-end gap-1 tabular-nums">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>ETA: {formatDuration(progressInfo.etaSeconds)}</span>
                </p>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1.5 font-mono">
              <div className="w-full bg-black/80 rounded-full h-3 overflow-hidden border border-white/[0.08]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isPaused
                      ? "bg-amber-500"
                      : "bg-gradient-to-r from-brand-600 via-indigo-500 to-[#00F0FF] shadow-[0_0_15px_#00F0FF]"
                  }`}
                  style={{ width: `${progressInfo.overallProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                <span className="text-cyan-300 font-semibold">
                  {progressInfo.overallProgress.toFixed(1)}% STREAMED
                </span>
                <span>
                  {formatBytes(progressInfo.totalBytesReceived)} of {formatBytes(progressInfo.totalSize)}
                </span>
              </div>
            </div>

            {/* Pull-Based Stream Controls */}
            <div className="flex items-center gap-3 pt-2">
              {isPaused ? (
                <button
                  type="button"
                  onClick={handleResume}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-mono font-semibold text-xs flex items-center gap-2 transition shadow-md shadow-brand-600/30"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume Streaming</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 font-mono font-semibold text-xs flex items-center gap-2 border border-white/[0.1] transition"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              )}
              <span className="text-[11px] text-slate-500 font-mono italic">
                Pull-based byte offsets guarantee zero data corruption on pause/resume.
              </span>
            </div>
          </div>
        )}

        {/* Transfer Complete Celebration Card */}
        {isCompleted && (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-center space-y-3 animate-in fade-in zoom-in-95 duration-300 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold font-sans text-emerald-200">
              Transfer Completed Successfully!
            </h3>
            <p className="text-xs text-emerald-300/80 max-w-md mx-auto font-mono leading-relaxed">
              All {manifestFiles.length} {manifestFiles.length === 1 ? "file was" : "files were"} streamed directly to your local disk with zero memory buildup or cloud intermediate storage.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold transition shadow-lg shadow-emerald-600/25 inline-block"
              >
                Send Files Yourself
              </Link>
            </div>
          </div>
        )}

        {/* Incoming Session Manifest with Per-File Progress & Telemetry */}
        {manifestFiles.length > 0 && (
          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between pb-1 text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                INCOMING FILE MANIFEST ({manifestFiles.length})
              </span>
              <span className="text-[10px] text-slate-500">
                12-BYTE CHUNK INDEXING
              </span>
            </div>

            <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-xl max-h-72 overflow-y-auto bg-black/50">
              {manifestFiles.map((file) => {
                const isFinished = completedFileIndices.has(file.index);
                const isCurrent = progressInfo?.fileIndex === file.index && isDownloading;
                const fileProgress = isFinished
                  ? 100
                  : isCurrent && progressInfo
                  ? Math.min(100, (progressInfo.fileBytesReceived / file.size) * 100)
                  : 0;

                return (
                  <div
                    key={file.index}
                    className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition ${
                      isCurrent ? "bg-cyan-950/30" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-500/25 text-[10px] tabular-nums font-bold shrink-0">
                        [SLOT #{file.index.toString().padStart(2, "0")}]
                      </span>
                      <div className="shrink-0">
                        {getFileIcon(file.mimeType, file.name)}
                      </div>
                      <div className="truncate">
                        <p className="font-medium text-slate-200 truncate group-hover:text-cyan-200">
                          {file.relativePath || file.name}
                        </p>
                        <p className="text-[10px] text-slate-500 tabular-nums mt-0.5">
                          {formatBytes(file.size)} &bull; {Math.ceil(file.size / 65536).toLocaleString()} slices (64 KB)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      {isCurrent && (
                        <div className="w-24 bg-black/60 rounded-full h-1.5 overflow-hidden border border-white/[0.1] hidden sm:block">
                          <div
                            className="bg-cyan-400 h-full rounded-full transition-all"
                            style={{ width: `${fileProgress}%` }}
                          />
                        </div>
                      )}

                      {isFinished ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Saved to Disk</span>
                        </span>
                      ) : isCurrent ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Streaming ({fileProgress.toFixed(0)}%)</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          Queued
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Primary Action Button (Save Directly to Disk & Start Stream) */}
        {!isDownloading && !isCompleted && manifestFiles.length > 0 && !hostDisconnected && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleStartDownload}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-[#00F0FF] hover:opacity-95 text-white font-mono font-bold text-sm tracking-wide flex items-center justify-center gap-3 transition shadow-[0_0_25px_rgba(0,240,255,0.25)] transform active:scale-[0.99]"
            >
              <HardDrive className="w-5 h-5 text-white" />
              <span>SAVE DIRECTLY TO DISK & START STREAM</span>
            </button>
            <p className="text-center text-[11px] font-mono text-slate-500 mt-2">
              Prompts OS native file save handle &bull; Zero memory accumulation &bull; Direct pipe to disk
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiverLoadingFallback() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in duration-300">
      <div className="frosted-carbon border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <div className="h-5 w-48 bg-white/[0.1] rounded animate-pulse" />
            <div className="h-3.5 w-32 bg-white/[0.05] rounded animate-pulse" />
          </div>
        </div>
        <div className="h-28 bg-black/40 rounded-xl border border-white/[0.06] animate-pulse" />
      </div>
    </div>
  );
}

export default function ReceiverPage() {
  return (
    <Suspense fallback={<ReceiverLoadingFallback />}>
      <ReceiverPageContent />
    </Suspense>
  );
}
