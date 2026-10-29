"use client";

import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Check,
  Share2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  SunMedium,
  Wifi,
  Globe,
  Monitor,
  Edit2,
} from "lucide-react";

interface ShareCardProps {
  roomId: string;
  shortCode: string;
  pin?: string;
  isWakeLockActive?: boolean;
}

export function ShareCard({
  roomId,
  shortCode,
  pin,
  isWakeLockActive = false,
}: ShareCardProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Link Modes: "network" (Wi-Fi/LAN IP) | "public" (Custom Tunnel / Domain) | "local" (localhost)
  const [linkMode, setLinkMode] = useState<"network" | "public" | "local">("network");
  const [localIp, setLocalIp] = useState<string>("");
  const [customPublicOrigin, setCustomPublicOrigin] = useState<string>("");
  const [isEditingCustom, setIsEditingCustom] = useState<boolean>(false);

  useEffect(() => {
    // Fetch host machine's actual LAN IPv4 (e.g. 192.168.29.7)
    fetch("/api/network-info")
      .then((res) => res.json())
      .then((data) => {
        if (data.localIp && data.localIp !== "localhost") {
          setLocalIp(data.localIp);
          setLinkMode("network");
        }
      })
      .catch(() => {});
  }, []);

  // Compute the current active base origin
  const getBaseOrigin = (): string => {
    if (typeof window === "undefined") return "";

    const currentOrigin = window.location.origin;
    const currentPort = window.location.port ? `:${window.location.port}` : "";
    const protocol = window.location.protocol;

    if (linkMode === "public" && customPublicOrigin.trim()) {
      return customPublicOrigin.trim().replace(/\/+$/, "");
    }

    if (linkMode === "network" && localIp) {
      return `${protocol}//${localIp}${currentPort || ":3000"}`;
    }

    return currentOrigin;
  };

  const shareUrl = `${getBaseOrigin()}/r/${roomId}`;

  // Format shortcode with hyphen: 849201 -> 849-201
  const formattedCode =
    shortCode.length === 6
      ? `${shortCode.slice(0, 3)}-${shortCode.slice(3)}`
      : shortCode;

  const copyToClipboard = async (text: string, type: "url" | "code") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "url") {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch (err) {
      console.warn("Failed to copy:", err);
    }
  };

  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-sm font-semibold text-slate-100">
            Swarm Hub Live & Broadcasting
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isWakeLockActive && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20"
              title="Screen Wake Lock is active to prevent device sleeping"
            >
              <SunMedium className="w-3 h-3 text-amber-400" />
              Wake Lock Active
            </span>
          )}

          {pin ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
              <Lock className="w-3 h-3 text-brand-400" />
              PIN Protected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              <Unlock className="w-3 h-3" />
              Open Access
            </span>
          )}
        </div>
      </div>

      {/* Share Mode Switcher */}
      <div className="p-1 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 w-full sm:w-auto">
          {localIp && (
            <button
              type="button"
              onClick={() => setLinkMode("network")}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition ${
                linkMode === "network"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Wi-Fi / LAN IP</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setLinkMode("public");
              if (!customPublicOrigin) setIsEditingCustom(true);
            }}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition ${
              linkMode === "public"
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>Public / Tunnel</span>
          </button>

          <button
            type="button"
            onClick={() => setLinkMode("local")}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition ${
              linkMode === "local"
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-slate-400" />
            <span>Localhost</span>
          </button>
        </div>

        {linkMode === "public" && (
          <button
            type="button"
            onClick={() => setIsEditingCustom(!isEditingCustom)}
            className="hidden sm:flex items-center gap-1 text-[11px] text-brand-300 hover:text-brand-200 px-2 py-1"
          >
            <Edit2 className="w-3 h-3" />
            {isEditingCustom ? "Done" : "Configure Domain"}
          </button>
        )}
      </div>

      {/* Public Domain Configuration Input (When Public mode is selected) */}
      {linkMode === "public" && isEditingCustom && (
        <div className="p-3 bg-slate-900/90 border border-brand-500/30 rounded-xl space-y-2 animate-in fade-in duration-200">
          <label className="text-xs font-semibold text-brand-300 block">
            Public Tunnel / Domain URL (e.g. ngrok, Cloudflare, localtunnel):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="https://xyz.loca.lt or https://p2p.yourdomain.com"
              value={customPublicOrigin}
              onChange={(e) => setCustomPublicOrigin(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
            <button
              type="button"
              onClick={() => setIsEditingCustom(false)}
              className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white"
            >
              Apply
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Tip: Run <code className="text-brand-300 font-mono">npm run tunnel</code> in your terminal to get a free public HTTPS address.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* QR Code Presentation */}
        <div className="flex flex-col items-center justify-center p-5 bg-white rounded-2xl shadow-inner space-y-2">
          <QRCodeSVG
            value={shareUrl}
            size={180}
            level="H"
            includeMargin={true}
            className="rounded-lg"
          />
          <p className="text-xs font-semibold text-slate-700 tracking-wider text-center">
            {linkMode === "network"
              ? "SCAN ON ANY DEVICE ON YOUR WI-FI"
              : linkMode === "public"
              ? "SCAN ANYWHERE ACROSS THE INTERNET"
              : "SCAN ON LOCAL MACHINE"}
          </p>
        </div>

        {/* Room Code & URL Actions */}
        <div className="space-y-4">
          {/* 6-Digit Room Code */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              6-Digit Room Code
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 font-mono text-2xl font-bold tracking-widest text-brand-300 text-center select-all">
                {formattedCode}
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(shortCode, "code")}
                className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                title="Copy 6-Digit Code"
              >
                {copiedCode ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Real Direct Share Link */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {linkMode === "network"
                  ? "Real Wi-Fi Network Link"
                  : linkMode === "public"
                  ? "Public Internet Link"
                  : "Direct Local Link"}
              </label>
              <span className="text-[11px] text-emerald-400 font-mono">
                {linkMode === "network" ? "Wi-Fi Ready" : linkMode === "public" ? "Global Ready" : "Localhost"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 truncate focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(shareUrl, "url")}
                className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-lg shadow-brand-600/30 shrink-0"
                title="Copy Link"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    Copied
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    Share
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Optional PIN Reveal */}
          {pin && (
            <div className="p-3 rounded-xl bg-brand-950/40 border border-brand-900/40 flex items-center justify-between">
              <div>
                <p className="text-xs text-brand-200 font-medium">Room Security PIN</p>
                <p className="text-sm font-mono font-bold text-brand-300">
                  {showPin ? pin : "••••"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="p-1.5 rounded-lg text-brand-400 hover:text-brand-300 transition"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
