"use client";

import React from "react";
import {
  Users,
  Wifi,
  ShieldAlert,
  Pause,
  Play,
  UserX,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Activity,
} from "lucide-react";
import { PeerTransferState } from "@/types/protocol";
import { formatBytes, formatSpeed } from "@/lib/formatters";

interface PeerTelemetryListProps {
  peers: PeerTransferState[];
  onPausePeer: (peerId: string) => void;
  onResumePeer: (peerId: string) => void;
  onKickPeer: (peerId: string) => void;
}

export function PeerTelemetryList({
  peers,
  onPausePeer,
  onResumePeer,
  onKickPeer,
}: PeerTelemetryListProps) {
  const getConnectionBadge = (mode: string) => {
    switch (mode) {
      case "p2p":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Wifi className="w-3 h-3 text-emerald-400" />
            Direct P2P
          </span>
        );
      case "relay":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            TURN Relay
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400">
            Detecting...
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "transferring":
        return (
          <span className="inline-flex items-center gap-1 text-xs text-indigo-400 font-medium animate-pulse">
            <Activity className="w-3.5 h-3.5" />
            Streaming
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-medium">
            <Pause className="w-3.5 h-3.5" />
            Paused
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      case "authenticating":
        return (
          <span className="inline-flex items-center gap-1 text-xs text-brand-300 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Verifying PIN
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            Error
          </span>
        );
      default:
        return (
          <span className="text-xs text-slate-400 capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-400" />
          <h3 className="font-semibold text-slate-100">
            Active Swarm Receivers ({peers.length})
          </h3>
        </div>
        <span className="text-xs text-slate-400">
          Independent 1-to-Many Streaming
        </span>
      </div>

      {peers.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <Users className="w-10 h-10 text-slate-700 mx-auto" />
          <p className="text-sm text-slate-400 font-medium">
            No receivers connected yet
          </p>
          <p className="text-xs text-slate-500">
            Share the QR Code or Room Link above to begin streaming files directly.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80 space-y-3 pt-1">
          {peers.map((peer) => (
            <div
              key={peer.peerId}
              className="pt-3 space-y-3 first:pt-0"
            >
              {/* Peer top bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-medium text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    ID: {peer.peerId.slice(0, 8)}
                  </span>
                  {getConnectionBadge(peer.connectionType)}
                  {getStatusBadge(peer.status)}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-200">
                    {formatSpeed(peer.bytesPerSecond)}
                  </span>

                  {peer.status === "transferring" && (
                    <button
                      type="button"
                      onClick={() => onPausePeer(peer.peerId)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      title="Pause Peer Stream"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {peer.status === "paused" && (
                    <button
                      type="button"
                      onClick={() => onResumePeer(peer.peerId)}
                      className="p-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition"
                      title="Resume Peer Stream"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onKickPeer(peer.peerId)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                    title="Disconnect Peer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress bar and details */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="truncate max-w-[240px] font-medium text-slate-300">
                    {peer.currentFileName}
                  </span>
                  <span className="font-mono">
                    {formatBytes(peer.byteOffset)} / {formatBytes(peer.totalBytes)} ({peer.progress.toFixed(1)}%)
                  </span>
                </div>

                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      peer.status === "completed"
                        ? "bg-emerald-500"
                        : peer.status === "paused"
                        ? "bg-amber-500"
                        : "bg-gradient-to-r from-brand-600 to-indigo-400"
                    }`}
                    style={{ width: `${peer.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

