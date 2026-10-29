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
  const [statusMessage, setStatusMessage] = useState<string>("Connecting...");
  const [connectionMode, setConnectionMode] = useState<PeerConnectionMode>("unknown");
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

  const clientEngineRef = useRef<WebRtcClientEngine | null>(null);
  const wakeLockRef = useRef<ScreenWakeLockManager | null>(null);

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
            particleCount: 100,
            spread: 70,
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
    <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8">
      {/* PIN Challenge Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        onSubmit={handlePinSubmit}
        errorMessage={pinError}
      />

      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        {/* Live Network & Wake Lock Status */}
        <div className="flex items-center gap-2">
          {isWakeLockActive && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20"
              title="Screen Wake Lock is active"
            >
              <SunMedium className="w-3 h-3 text-amber-400" />
              Wake Lock
            </span>
          )}

          {connectionMode === "p2p" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              Direct P2P
            </span>
          )}

          {connectionMode === "relay" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              TURN Relay
            </span>
          )}
        </div>
      </div>

      {/* Host Disconnected Alert */}
      {hostDisconnected && (
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2 text-center">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <h3 className="text-base font-bold text-rose-200">
            Sender Tab Was Closed
          </h3>
          <p className="text-xs text-rose-300/80 max-w-md mx-auto">
            Because this application uses zero cloud storage, files only stream while the sender has their browser open.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold transition inline-block"
            >
              Start New Transfer
            </Link>
          </div>
        </div>
      )}

      {/* General Error Message */}
      {errorMessage && !hostDisconnected && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 text-center">
          {errorMessage}
        </div>
      )}

      {/* Main Download Card */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-surface-border">
          <div>
            <span className="text-xs font-mono text-brand-400 uppercase tracking-wider font-semibold">
              Incoming Stream &bull; Room {roomId}
            </span>
            <h1 className="text-2xl font-bold text-slate-100 mt-1 flex items-center gap-2">
              {manifestFiles.length > 0 ? (
                `${manifestFiles.length} ${manifestFiles.length === 1 ? "File" : "Files"} Ready`
              ) : (
                <>
                  <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
                  <span>Connecting to Sender...</span>
                </>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
              </span>
              <span>Status: <strong className="text-brand-300 font-medium">{statusMessage}</strong></span>
            </p>

            {statusMessage.toLowerCase().includes("failed") && (
              <div className="mt-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200/90 space-y-2">
                <p className="font-semibold flex items-center gap-1.5 text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Direct Connection Blocked by Carrier/Firewall NAT
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Mobile carrier networks (5G/LTE) use Symmetric NAT which blocks direct P2P hole-punching unless a TURN relay is reached.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-200 font-semibold text-xs transition cursor-pointer"
                  >
                    Retry Handshake
                  </button>
                  <span className="text-[11px] text-slate-400">
                    💡 If nearby, connect both devices to the <strong>same Wi-Fi</strong> for instant 100% direct speed.
                  </span>
                </div>
              </div>
            )}
          </div>

          {manifestFiles.length > 0 && (
            <div className="sm:text-right">
              <span className="text-xs text-slate-400">Total Payload</span>
              <p className="text-xl font-mono font-bold text-white">
                {formatBytes(totalSize)}
              </p>
            </div>
          )}
        </div>

        {/* Live Progress Card (During Active Download) */}
        {isDownloading && progressInfo && (
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-700/60 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <p className="text-slate-400 font-medium">Currently Streaming:</p>
                <p className="text-sm font-semibold text-slate-100 truncate max-w-xs sm:max-w-md">
                  {progressInfo.fileName}
                </p>
              </div>

              <div className="text-right space-y-0.5">
                <p className="font-mono text-base font-bold text-brand-300">
                  {formatSpeed(progressInfo.bytesPerSecond)}
                </p>
                <p className="text-slate-400 text-[11px] font-mono">
                  ETA: {formatDuration(progressInfo.etaSeconds)}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isPaused
                      ? "bg-amber-500"
                      : "bg-gradient-to-r from-brand-500 via-indigo-500 to-emerald-400"
                  }`}
                  style={{ width: `${progressInfo.overallProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>{progressInfo.overallProgress.toFixed(1)}% complete</span>
                <span>
                  {formatBytes(progressInfo.totalBytesReceived)} of {formatBytes(progressInfo.totalSize)}
                </span>
              </div>
            </div>

            {/* Stream Controls */}
            <div className="flex items-center gap-3 pt-2">
              {isPaused ? (
                <button
                  type="button"
                  onClick={handleResume}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs flex items-center gap-2 transition shadow-md shadow-brand-600/30"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume Streaming</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 border border-slate-700 transition"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </button>
              )}
              <span className="text-xs text-slate-500 italic">
                Pull-based byte offset guarantees zero data corruption on pause/resume.
              </span>
            </div>
          </div>
        )}

        {/* Transfer Complete Celebration */}
        {isCompleted && (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-emerald-200">
              Transfer Completed Successfully!
            </h3>
            <p className="text-xs text-emerald-300/80 max-w-sm mx-auto">
              All {manifestFiles.length} {manifestFiles.length === 1 ? "file was" : "files were"} streamed directly to your local disk without cloud storage or RAM buildup.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 inline-block"
              >
                Send Files Yourself
              </Link>
            </div>
          </div>
        )}

        {/* File Manifest List */}
        {manifestFiles.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              File Manifest ({manifestFiles.length})
            </h4>

            <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl max-h-72 overflow-y-auto bg-slate-950/40">
              {manifestFiles.map((file) => {
                const isFinished = completedFileIndices.has(file.index);
                const isCurrent =
                  progressInfo?.fileIndex === file.index && isDownloading;

                return (
                  <div
                    key={file.index}
                    className={`p-3 flex items-center justify-between text-xs transition ${
                      isCurrent
                        ? "bg-brand-500/10"
                        : "hover:bg-slate-900/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      {getFileIcon(file.mimeType, file.name)}
                      <div className="truncate">
                        <p className="font-medium text-slate-200 truncate">
                          {file.relativePath || file.name}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>

                    <div>
                      {isFinished ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Saved
                        </span>
                      ) : isCurrent ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Streaming...
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Primary Action Button (When not downloading and not finished) */}
        {!isDownloading && !isCompleted && manifestFiles.length > 0 && !hostDisconnected && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleStartDownload}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-3 transition shadow-xl shadow-brand-500/25 transform active:scale-[0.99]"
            >
              <HardDrive className="w-5 h-5" />
              <span>Save Directly to Disk & Start Stream</span>
            </button>
            <p className="text-center text-[11px] text-slate-500 mt-2">
              Opens OS native file save handle &bull; Zero memory accumulation
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
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center text-primary">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <div className="h-5 w-48 bg-surface-elevated rounded animate-pulse" />
            <div className="h-3.5 w-32 bg-surface-elevated/60 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-28 bg-surface-elevated/40 rounded-xl border border-surface-border/50 animate-pulse" />
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

