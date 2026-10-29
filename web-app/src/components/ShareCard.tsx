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
  Radio,
  ShieldCheck,
  Sparkles,
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
  const [copiedPin, setCopiedPin] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Link Modes: "network" (Wi-Fi/LAN IP) | "public" (Custom Tunnel / Domain) | "local" (localhost)
  const [linkMode, setLinkMode] = useState<"network" | "public" | "local">("network");
  const [localIp, setLocalIp] = useState<string>("");
  const [customPublicOrigin, setCustomPublicOrigin] = useState<string>("");
  const [isEditingCustom, setIsEditingCustom] = useState<boolean>(false);

  useEffect(() => {
    // Query host machine's actual LAN IPv4 (e.g. 192.168.1.10)
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

  // Compute active base origin
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

  const copyToClipboard = async (text: string, type: "url" | "code" | "pin") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "url") {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else if (type === "code") {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedPin(true);
        setTimeout(() => setCopiedPin(false), 2000);
      }
    } catch (err) {
      console.warn("Clipboard write failed:", err);
    }
  };

  // Web Share API support check
  const canShareNative =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleNativeShare = async () => {
    if (!canShareNative) return;
    try {
      await navigator.share({
        title: "StreamP2P Zero-Storage File Stream",
        text: `Stream files directly from my browser: Room #${shortCode}`,
        url: shareUrl,
      });
    } catch (err) {
      // User dismissed share dialog
    }
  };

  // Radar reticle styles based on active tier
  const isLanTier = linkMode === "network";
  const isGlobalTier = linkMode === "public";

  const accentReticle = isLanTier
    ? "border-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.4)]"
    : isGlobalTier
    ? "border-[#10B981] shadow-[0_0_12px_rgba(16,185,129,0.4)]"
    : "border-slate-500";

  const accentDot = isLanTier
    ? "bg-[#00F0FF]"
    : isGlobalTier
    ? "bg-[#10B981]"
    : "bg-slate-400";

  const radarLabel = isLanTier
    ? "SCAN FOR DIRECT LAN P2P (200-300 MB/s)"
    : isGlobalTier
    ? "SCAN ANYWHERE • STUN / TURN 443 READY"
    : "SCAN ON LOCAL MACHINE";

  // Split digits for split-flap display
  const shortCodeDigits = shortCode.split("");

  return (
    <div className="frosted-carbon border border-white/[0.08] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6">
      
      {/* 1. Radar Header & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00F0FF]" />
          </span>
          <span className="text-sm font-bold text-slate-100 font-sans tracking-tight">
            Dual-Horizon Dispatch Radar
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isWakeLockActive && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/25"
              title="Screen Wake Lock is active"
            >
              <SunMedium className="w-3 h-3 text-amber-400" />
              <span>WAKE LOCK</span>
            </span>
          )}

          {pin ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>HMAC SHIELD ACTIVE</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-white/[0.04] text-slate-400 border border-white/[0.06]">
              <Unlock className="w-3 h-3" />
              <span>OPEN ACCESS</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Dual-Horizon Segmented Mode Switcher */}
      <div className="space-y-2">
        <div className="p-1 bg-black/60 border border-white/[0.08] rounded-xl flex flex-wrap items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1 w-full sm:w-auto">
            {localIp && (
              <button
                type="button"
                onClick={() => setLinkMode("network")}
                className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
                  linkMode === "network"
                    ? "bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/40 shadow-[0_0_15px_rgba(0,240,255,0.25)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Wifi className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>Tier 1: Local Wi-Fi Direct</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setLinkMode("public");
                if (!customPublicOrigin) setIsEditingCustom(true);
              }}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
                linkMode === "public"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tier 2/3: Global WAN / Tunnel</span>
            </button>

            <button
              type="button"
              onClick={() => setLinkMode("local")}
              className={`flex-1 sm:flex-initial px-3 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition ${
                linkMode === "local"
                  ? "bg-white/[0.1] text-white border border-white/[0.15]"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Localhost</span>
            </button>
          </div>

          {linkMode === "public" && (
            <button
              type="button"
              onClick={() => setIsEditingCustom(!isEditingCustom)}
              className="text-[11px] text-cyan-300 hover:text-cyan-200 px-3 py-1 flex items-center gap-1.5"
            >
              <Edit2 className="w-3 h-3" />
              <span>{isEditingCustom ? "Done" : "Configure Domain"}</span>
            </button>
          )}
        </div>

        {/* Dynamic Tier Badge */}
        <div className="flex items-center gap-2 text-[11px] font-mono px-1">
          {linkMode === "network" ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/25 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse" />
              ZERO-INTERNET • 200-300 MB/s LAN
            </span>
          ) : linkMode === "public" ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              STUN / TURN 443 RELAY READY
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
              LOCAL HOST TESTING MODE
            </span>
          )}
        </div>
      </div>

      {/* Public Domain Configuration */}
      {linkMode === "public" && isEditingCustom && (
        <div className="p-3.5 bg-black/60 border border-emerald-500/30 rounded-xl space-y-2 animate-in fade-in duration-200">
          <label className="text-xs font-mono font-semibold text-emerald-300 block">
            Public Tunnel / Domain URL (e.g. Pinggy, Cloudflare, Localtunnel):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="https://xyz.a.pinggy.link or https://p2p.yourdomain.com"
              value={customPublicOrigin}
              onChange={(e) => setCustomPublicOrigin(e.target.value)}
              className="flex-1 bg-black/80 border border-white/[0.15] rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => setIsEditingCustom(false)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-mono font-semibold text-white transition"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Radar Grid: HUD Scanner Reticle & Split-Flap Room Code */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
        
        {/* HUD Scanner Reticle for QR Code */}
        <div className="relative p-6 sm:p-7 rounded-2xl bg-black/50 border border-white/[0.08] flex flex-col items-center justify-center select-none group">
          {/* Active Mode Corner Reticles */}
          <div className={`absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 transition-all duration-300 ${accentReticle}`} />
          <div className={`absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 transition-all duration-300 ${accentReticle}`} />
          <div className={`absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 transition-all duration-300 ${accentReticle}`} />
          <div className={`absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 transition-all duration-300 ${accentReticle}`} />

          {/* QR Code Canvas */}
          <div className="relative p-3 bg-white rounded-xl shadow-2xl transition-transform group-hover:scale-[1.02]">
            <QRCodeSVG
              value={shareUrl}
              size={180}
              level="H"
              includeMargin={false}
              className="rounded"
            />
          </div>

          <div className="mt-3.5 flex items-center gap-2 text-[10px] font-mono tracking-wider uppercase text-slate-300">
            <span className={`w-2 h-2 rounded-full ${accentDot} animate-pulse`} />
            <span>{radarLabel}</span>
          </div>
        </div>

        {/* 4. Split-Flap Room Code & Direct URL Actions */}
        <div className="space-y-4">
          
          {/* Split-Flap 6-Digit Code */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                6-Digit Room Code
              </label>
              <span className="text-[10px] font-mono text-cyan-400">
                Click Digits to Copy
              </span>
            </div>

            <div
              onClick={() => copyToClipboard(shortCode, "code")}
              className="relative group cursor-pointer"
              title="Click to copy 6-digit room code"
            >
              <div className="flex items-center justify-between gap-1 sm:gap-2 p-2 sm:p-2.5 rounded-xl bg-black/60 border border-white/[0.1] hover:border-cyan-400/50 transition-all shadow-inner">
                {shortCodeDigits.map((digit, i) => (
                  <React.Fragment key={i}>
                    {i === 3 && (
                      <span className="text-slate-600 font-mono text-xl font-bold px-0.5 select-none">
                        -
                      </span>
                    )}
                    <div className="relative flex-1 h-13 sm:h-15 rounded-lg bg-black/80 border border-white/[0.08] group-hover:border-cyan-400/30 transition-all flex flex-col items-center justify-center shadow-inner overflow-hidden">
                      {/* Split-flap horizontal divider */}
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-black/90 z-10 pointer-events-none" />
                      <span className="font-mono text-2xl sm:text-3xl font-bold text-cyan-300 tabular-nums select-none group-hover:text-cyan-200">
                        {digit}
                      </span>
                    </div>
                  </React.Fragment>
                ))}

                <div className="p-2.5 rounded-lg bg-white/[0.05] group-hover:bg-cyan-500/10 text-slate-400 group-hover:text-cyan-300 transition shrink-0 ml-1">
                  {copiedCode ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </div>
              </div>

              {/* Tactile Micro-Feedback Toast */}
              {copiedCode && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold tracking-wider uppercase animate-in fade-in zoom-in-95 duration-150">
                  COPIED TO CLIPBOARD
                </div>
              )}
            </div>
          </div>

          {/* Direct Shareable URL */}
          <div>
            <label className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Direct Streaming Link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-black/60 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 truncate focus:outline-none select-all"
              />

              <button
                type="button"
                onClick={() => copyToClipboard(shareUrl, "url")}
                className="px-3.5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 hover:text-white border border-white/[0.1] font-mono text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-sm"
                title="Copy Link"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              {/* Mobile Native Web Share API */}
              {canShareNative && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="px-3.5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-brand-500/25 shrink-0"
                  title="Share via Mobile Sheet"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              )}
            </div>
          </div>

          {/* 5. HMAC-SHA256 Airlock Shield Card */}
          {pin ? (
            <div className="frosted-carbon rounded-xl p-3 sm:p-3.5 border border-amber-500/30 bg-amber-950/20 flex items-center justify-between shadow-[0_0_15px_rgba(245,158,11,0.12)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber-300">
                      HMAC-SHA256 AIRLOCK SHIELD
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-200 font-mono">
                      ARMED
                    </span>
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-100 tracking-widest mt-0.5">
                    PIN: {showPin ? pin : "••••"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="p-1.5 rounded-lg text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 transition"
                  title={showPin ? "Hide PIN" : "Reveal PIN"}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(pin, "pin")}
                  className="p-1.5 rounded-lg text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 transition"
                  title="Copy PIN"
                >
                  {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-2.5 border border-white/[0.06] bg-black/40 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <Unlock className="w-3.5 h-3.5 text-slate-500" />
                <span>AIRLOCK: OPEN ACCESS (NO PIN REQUIRED)</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
