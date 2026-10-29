"use client";

import React, { useRef, useState } from "react";
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
} from "lucide-react";
import { formatBytes } from "@/lib/formatters";

interface FileDropzoneProps {
  files: File[];
  onFilesChanged: (files: File[]) => void;
  disabled?: boolean;
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
    // Deduplicate by name and size
    const merged = [...files];
    for (const newFile of addedArray) {
      if (!merged.some((f) => f.name === newFile.name && f.size === newFile.size)) {
        merged.push(newFile);
      }
    }
    onFilesChanged(merged);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeFile = (index: number) => {
    if (disabled) return;
    const updated = files.filter((_, i) => i !== index);
    onFilesChanged(updated);
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="w-full space-y-4">
      {/* Hidden Inputs */}
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

      {/* Drop Target Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer select-none ${
          disabled
            ? "border-slate-800 bg-slate-950/40 opacity-70 cursor-not-allowed"
            : isDragOver
            ? "border-brand-500 bg-brand-500/10 scale-[1.01]"
            : "border-slate-800 hover:border-brand-500/50 bg-slate-900/40 hover:bg-slate-900/70"
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
              isDragOver
                ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
                : "bg-surface-card text-brand-400 border border-slate-800"
            }`}
          >
            <UploadCloud className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              Drag & Drop files or folders here
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Direct streaming from your browser disk &bull; No file size limits &bull; Zero server storage
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
              className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              Browse Files
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition flex items-center gap-1.5"
            >
              <FolderUp className="w-3.5 h-3.5" />
              Upload Folder
            </button>
          </div>
        </div>
      </div>

      {/* Selected File Manifest List */}
      {files.length > 0 && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">
                Staged Manifest ({files.length} {files.length === 1 ? "file" : "files"})
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-mono">
                {formatBytes(totalSize)}
              </span>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={() => onFilesChanged([])}
                className="text-xs text-rose-400 hover:text-rose-300 transition"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/50 mt-2 pr-1">
            {files.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="py-2.5 flex items-center justify-between text-xs text-slate-300 group hover:bg-slate-800/30 px-2 rounded-lg transition"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  {getFileIcon(file)}
                  <div className="truncate">
                    <p className="font-medium text-slate-200 truncate">
                      {(file as any).webkitRelativePath || file.name}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                </div>

                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition opacity-0 group-hover:opacity-100"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

