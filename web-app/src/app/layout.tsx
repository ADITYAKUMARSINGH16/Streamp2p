import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StreamP2P - Zero-Storage Real-Time P2P File Streamer",
  description:
    "Direct browser-to-browser WebRTC file streaming. Zero cloud storage, unlimited file sizes, 1-to-Many Swarm Hub, and direct-to-disk streaming.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-background text-slate-100 flex flex-col min-h-screen relative font-sans antialiased selection:bg-brand-500/30 selection:text-white">
        {/* Ambient Top Radial Glow & Dot-Matrix Grid Overlay */}
        <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden" aria-hidden="true">
          {/* Subtle radial dot-matrix grid */}
          <div className="absolute inset-0 bg-grid-dots [mask-image:radial-gradient(ellipse_at_top,black_45%,transparent_85%)] opacity-35" />
          {/* Top ambient radial glow */}
          <div className="absolute top-[-140px] left-1/2 -translate-x-1/2 w-[900px] h-[460px] bg-gradient-to-b from-brand-600/15 via-emerald-500/5 to-transparent blur-[120px] rounded-full pointer-events-none" />
        </div>

        <Navbar />
        <main className="flex-1 flex flex-col relative z-0">{children}</main>
      </body>
    </html>
  );
}
