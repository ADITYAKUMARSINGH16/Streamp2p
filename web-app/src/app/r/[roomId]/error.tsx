"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, ArrowLeft, WifiOff } from "lucide-react";

export default function ReceiverErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[StreamP2P Receiver Error Boundary caught]:", error);
  }, [error]);

  const handleRetry = () => {
    // If it's a chunk load or network failure, a full page reload fetches fresh assets
    if (
      error.message?.includes("Loading chunk") ||
      error.name === "ChunkLoadError" ||
      error.message?.includes("502")
    ) {
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-surface-card border border-rose-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
        <div className="inline-flex p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
          <WifiOff className="w-10 h-10 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Connection Temporarily Interrupted
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            The network or tunnel proxy experienced a temporary delay loading the transfer room assets (such as a 502 Bad Gateway or chunk timeout).
          </p>
        </div>

        {error.message && (
          <div className="bg-surface-elevated/70 border border-surface-border rounded-xl p-3 text-left">
            <p className="text-xs font-mono text-rose-300/80 break-words line-clamp-3">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={handleRetry}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-white font-medium text-sm transition-all shadow-lg shadow-primary/25 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>

          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-surface-elevated hover:bg-surface-border active:scale-[0.98] text-slate-300 font-medium text-sm border border-surface-border transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}

