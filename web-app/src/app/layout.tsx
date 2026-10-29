import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

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
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}

