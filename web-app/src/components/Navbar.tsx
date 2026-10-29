"use client";

import React from "react";
import Link from "next/link";
import { Zap, ShieldCheck, HardDrive, Share2 } from "lucide-react";

export function Navbar() {
  return (
    <header className="border-b border-surface-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <span className="font-bold text-slate-100 text-lg tracking-tight">
              StreamP2P
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
              Zero-Storage
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <div className="hidden md:flex items-center gap-4">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              Direct-to-Disk
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              DTLS Encrypted
            </span>
            <span className="flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              1-to-Many Swarm
            </span>
          </div>

          <Link
            href="/"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            New Transfer
          </Link>
        </div>
      </div>
    </header>
  );
}

