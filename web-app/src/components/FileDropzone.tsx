"use client";

import React, { useRef, useState, useMemo } from "react";
import {
  UploadCloud,
  File,
  FileText,
  FileArchive,
  Film,
  Music,
  Image as ImageIcon,
  Code,
  X,
  FolderUp,
  ShieldCheck,
  Plus,
  Trash2,
  Cpu,
} from "lucide-react";
import { formatBytes } from "@/lib/formatters";
import { CHUNK_SIZE, BINARY_HEADER_SIZE } from "@/types/protocol";

interface FileDropzoneProps {
  files: File[];
  onFilesChanged: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Traverses entries dropped into the dropzone to support complete folder trees
 * without ever buffering file data into RAM.
 */
async function traverseEntry(entry: any, path = ""): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file: File) => {
          if (path) {
            Object.defineProperty(file, "webkitRelativePath", {
              value: path + file.name,
              writable: false,
              configurable: true,
            });
          }
          resolve([file]);
        },
        () => resolve([])
      );
    });
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const readAllEntries = async (): Promise<any[]> => {
      const all: any[] = [];
      let batch: any[];
      do {
        batch = await new Promise((resolve) => {
          dirReader.readEntries(
            (entries: any[]) => resolve(entries || []),
            () => resolve([])
          );
        });
        all.push(...batch);
      } while (batch.length > 0);
      return all;
    };

    const entries = await readAllEntries();
    const nested = await Promise.all(
      entries.map((child) => traverseEntry(child, `${path}${entry.name}/`))
    );
    return nested.flat();
  }
  return [];
}

export function FileDropzone({
  files,
  onFilesChanged,
  disabled = false,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (file: File) => {
    const type = file.type;
    const name = file.name.toLowerCase();

    if (type.startsWith("image/") || name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
      return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    }
    if (type.startsWith("video/") || name.match(/\.(mp4|mkv|mov|webm|avi)$/)) {
      return <Film className="w-5 h-5 text-indigo-400" />;
    }
    if (type.startsWith("audio/") || name.match(/\.(mp3|wav|flac|ogg)$/)) {
      return <Music className="w-5 h-5 text-pink-400" />;
    }
    if (
      name.match(/\.(zip|tar|gz|7z|rar|bz2)$/) ||
      type.includes("zip") ||
      type.includes("compressed")
    ) {
      return <FileArchive className="w-5 h-5 text-amber-400" />;
    }
    if (name.match(/\.(ts|tsx|js|jsx|json|py|go|rs|cpp|c|html|css)$/)) {
      return <Code className="w-5 h-5 text-cyan-400" />;
    }
    if (type.startsWith("text/") || name.match(/\.(pdf|txt|md|docx|doc)$/)) {
      return <FileText className="w-5 h-5 text-blue-400" />;
    }
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const handleFilesAdded = (newFileList: FileList | File[]) => {
    const addedArray = Array.from(newFileList);
    // Deduplicate by name and size while preserving handles without loading to memory
    const merged = [...files];
    for (const newFile of addedArray) {
      const relativePath = (newFile as any).webkitRelativePath || newFile.name;
      if (
        !merged.some(
          (f) =>
            ((f as any).webkitRelativePath || f.name) === relativePath &&
            f.size === newFile.size
        )
      ) {
        merged.push(newFile);
      }
    }
    onFilesChanged(merged);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    // Check for directory item support via webkitGetAsEntry
    const items = e.dataTransfer.items;
    if (items && items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === "function") {
      const promises: Promise<File[]>[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = (items[i] as any).webkitGetAsEntry();
        if (entry) {
          promises.push(traverseEntry(entry));
        }
      }
      const resolved = await Promise.all(promises);
      const flattened = resolved.flat();
      if (flattened.length > 0) {
        handleFilesAdded(flattened);
        return;
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    if (disabled) return;
    const updated = files.filter((_, i) => i !== index);
    onFilesChanged(updated);
  };

  // 64 KB Binary Protocol Math (Computed strictly from file metadata)
  const totalBytes = useMemo(
    () => files.reduce((acc, f) => acc + f.size, 0),
    [files]
  );

  const totalSlices = useMemo(() => {
    if (totalBytes === 0) return files.length > 0 ? files.length : 0;
    return Math.ceil(totalBytes / CHUNK_SIZE);
  }, [totalBytes, files.length]);

  const totalHeaderOverhead = useMemo(
    () => totalSlices * BINARY_HEADER_SIZE,
    [totalSlices]
  );

  const getFileSlices = (file: File) => {
    return file.size === 0 ? 1 : Math.ceil(file.size / CHUNK_SIZE);
  };

  return (
    <div className="w-full space-y-4">
      {/* Hidden Native File & Folder Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files) handleFilesAdded(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={folderInputRef}
        // @ts-ignore - directory support
        webkitdirectory="true"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files) handleFilesAdded(e.target.files);
          e.target.value = "";
        }}
      />

      {/* 1. Interactive Gravity Well Dropzone with Zero-G Warp Reactive State */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative rounded-2xl p-8 sm:p-10 text-center transition-all duration-300 cursor-pointer select-none overflow-hidden ${
          disabled
            ? "border-2 border-dashed border-white/[0.05] bg-black/20 opacity-60 cursor-not-allowed"
            : isDragOver
            ? "border-2 border-[#00F0FF] bg-[#00F0FF]/[0.08] shadow-[0_0_40px_rgba(0,240,255,0.35)] scale-[1.01]"
            : "border-2 border-dashed border-white/[0.1] hover:border-[#00F0FF]/50 bg-black/40 hover:bg-black/60 shadow-lg"
        }`}
      >
        {/* Zero-G Warp Background Accents */}
        <div
          className={`absolute inset-0 bg-grid-dots transition-opacity pointer-events-none ${
            isDragOver ? "opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_70%,transparent_95%)]" : "opacity-20"
          }`}
        />

        {isDragOver && (
          <>
            {/* Animated expanding orbital ring */}
            <div className="absolute inset-0 rounded-2xl border-2 border-[#00F0FF]/40 animate-ping pointer-events-none" />
            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-[#00F0FF]/25 via-indigo-500/20 to-[#00F0FF]/25 blur-xl pointer-events-none" />
          </>
        )}

        <div className="relative z-10 flex flex-col items-center justify-center space-y-3.5">
          {/* Gravitational Dock Core Icon with orbital spinner */}
          <div className="relative">
            <div
              className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                isDragOver
                  ? "bg-[#00F0FF] text-black shadow-[0_0_30px_#00F0FF] scale-110 rotate-1"
                  : "bg-surface-card text-cyan-400 border border-white/[0.08] shadow-[0_0_15px_rgba(0,240,255,0.15)]"
              }`}
            >
              <UploadCloud className="w-8 h-8" />
            </div>

            {isDragOver && (
              <div
                className="absolute -inset-3 rounded-full border-2 border-[#00F0FF]/60 border-t-transparent animate-spin pointer-events-none"
                style={{ animationDuration: "3s" }}
              />
            )}
          </div>

          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight font-sans">
              {isDragOver ? "Zero-G Gravity Field Engaged" : "Magnetic Zero-G Staging Dock"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-lg mx-auto">
              Drag & drop files or full folders here &bull; Streamed directly from disk &bull; Zero server storage
            </p>
          </div>

          <div
            className="flex items-center gap-3 pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-mono font-medium rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/[0.1] hover:border-cyan-400/40 hover:text-white transition shadow-sm"
            >
              Browse Files
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 text-xs font-mono font-medium rounded-xl bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 border border-cyan-500/30 transition flex items-center gap-1.5 shadow-sm"
            >
              <FolderUp className="w-3.5 h-3.5" />
              Upload Folder
            </button>
          </div>
        </div>
      </div>

      {/* 2. Live 64 KB Protocol Math Summary Bar */}
      {files.length > 0 && (
        <div className="frosted-carbon rounded-xl p-3.5 border border-white/[0.08] shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200">
                PROTOCOL TELEMETRY SPEC // 64 KB SLICES
              </span>
            </div>
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
              title="Browser RAM stays bounded under 256 KB SCTP high watermark regardless of file size"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>RAM BUFFER: &lt; 256 KB SCTP HIGH-WATERMARK</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2.5 text-xs font-mono tabular-nums">
            <div className="bg-black/40 border border-white/[0.06] rounded-lg p-2.5 flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total Payload</span>
              <span className="text-sm font-semibold text-slate-100 mt-0.5">{formatBytes(totalBytes)}</span>
            </div>
            <div className="bg-black/40 border border-white/[0.06] rounded-lg p-2.5 flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">64 KB Slices</span>
              <span className="text-sm font-semibold text-cyan-400 mt-0.5">
                {totalSlices.toLocaleString()} Chunks
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-black/40 border border-white/[0.06] rounded-lg p-2.5 flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">12B Frame Overhead</span>
              <span className="text-sm font-semibold text-indigo-300 mt-0.5">
                +{formatBytes(totalHeaderOverhead)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Tactile File Manifest Cards */}
      {files.length > 0 && (
        <div className="frosted-carbon rounded-xl border border-white/[0.08] p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] font-mono">
                STAGED MANIFEST
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono tabular-nums">
                {files.length} {files.length === 1 ? "FILE" : "FILES"}
              </span>
            </div>

            {!disabled && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-cyan-300 border border-white/[0.08] hover:border-cyan-500/30 transition flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Add More Files</span>
                </button>
                <button
                  type="button"
                  onClick={() => onFilesChanged([])}
                  className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Manifest</span>
                </button>
              </div>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {files.map((file, idx) => {
              const slices = getFileSlices(file);
              return (
                <div
                  key={`${(file as any).webkitRelativePath || file.name}-${idx}`}
                  className="p-2.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/[0.06] hover:border-cyan-500/30 flex items-center justify-between text-xs transition group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {/* Zero-based fileIndex slot matching Bytes 0..3 of 12-byte binary frame */}
                    <span
                      className="px-1.5 py-0.5 rounded bg-cyan-950/40 text-cyan-400 border border-cyan-500/25 font-mono text-[10px] tabular-nums shrink-0 font-semibold"
                      title={`Bytes 0..3 Uint32 fileIndex: ${idx}`}
                    >
                      [SLOT {idx.toString().padStart(2, "0")}]
                    </span>

                    <div className="shrink-0">{getFileIcon(file)}</div>

                    <div className="truncate">
                      <p className="font-medium text-slate-200 truncate group-hover:text-cyan-200 transition-colors">
                        {(file as any).webkitRelativePath || file.name}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                        <span>{formatBytes(file.size)}</span>
                        <span>&bull;</span>
                        <span className="text-cyan-400/90">
                          {slices.toLocaleString()} {slices === 1 ? "slice" : "slices"} (64 KB)
                        </span>
                      </div>
                    </div>
                  </div>

                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition opacity-70 group-hover:opacity-100 shrink-0"
                      title="Remove file from manifest"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
