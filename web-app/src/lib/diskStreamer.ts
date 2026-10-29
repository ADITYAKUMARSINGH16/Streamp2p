/**
 * Zero-RAM Direct-to-Disk Streaming Writer
 * - Primary: HTML5 File System Access API (window.showSaveFilePicker -> FileSystemWritableFileStream)
 *   Supports zero-RAM direct disk writing and random-access seek() on pause/resume.
 * - Fallback: Service Worker ReadableStream interception (/download-stream/...) for Safari/Firefox/Mobile.
 */

import { ManifestFileItem } from "@/types/protocol";

export interface StreamWriteTarget {
  init(file: ManifestFileItem, initialOffset?: number): Promise<void>;
  write(byteOffset: number, chunk: Uint8Array): Promise<void>;
  seek(byteOffset: number): Promise<void>;
  close(): Promise<void>;
  abort(reason?: string): Promise<void>;
  getCurrentOffset(): number;
  isNativeFSA(): boolean;
}

export class NativeFileSystemWriter implements StreamWriteTarget {
  private fileHandle: any = null;
  private writableStream: any = null;
  private currentOffset: number = 0;

  constructor(fileHandle?: any) {
    this.fileHandle = fileHandle;
  }

  isNativeFSA(): boolean {
    return true;
  }

  public async init(file: ManifestFileItem, initialOffset: number = 0): Promise<void> {
    if (!this.fileHandle) {
      if (typeof window === "undefined" || !("showSaveFilePicker" in window)) {
        throw new Error("File System Access API is not supported on this browser.");
      }

      this.fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: file.name,
        types: [
          {
            description: file.name,
            accept: {
              [file.mimeType || "application/octet-stream"]: [],
            },
          },
        ],
      });
    }

    this.writableStream = await this.fileHandle.createWritable({
      keepExistingData: true,
    });

    if (initialOffset > 0) {
      await this.writableStream.seek(initialOffset);
      this.currentOffset = initialOffset;
    } else {
      this.currentOffset = 0;
    }
  }

  public async write(byteOffset: number, chunk: Uint8Array): Promise<void> {
    if (!this.writableStream) {
      throw new Error("Writer stream is not initialized");
    }

    // Seek if incoming byte offset does not match current write pointer
    if (byteOffset !== this.currentOffset) {
      await this.writableStream.seek(byteOffset);
      this.currentOffset = byteOffset;
    }

    await this.writableStream.write(chunk);
    this.currentOffset += chunk.byteLength;
  }

  public async seek(byteOffset: number): Promise<void> {
    if (this.writableStream) {
      await this.writableStream.seek(byteOffset);
      this.currentOffset = byteOffset;
    }
  }

  public async close(): Promise<void> {
    if (this.writableStream) {
      try {
        await this.writableStream.close();
      } finally {
        this.writableStream = null;
      }
    }
  }

  public async abort(reason?: string): Promise<void> {
    if (this.writableStream) {
      try {
        await this.writableStream.abort(reason || "Transfer aborted");
      } catch (e) {
        // Ignored
      } finally {
        this.writableStream = null;
      }
    }
  }

  public getCurrentOffset(): number {
    return this.currentOffset;
  }
}

/**
 * Service Worker / Blob Fallback Writer for iOS/Safari/Firefox
 */
export class ServiceWorkerStreamWriter implements StreamWriteTarget {
  private streamId: string;
  private currentOffset: number = 0;
  private isSWActive: boolean = false;
  private memoryFallbackChunks: BlobPart[] = [];
  private currentFile: ManifestFileItem | null = null;

  constructor() {
    this.streamId = "stream-" + Math.random().toString(36).substring(2, 10);
  }

  isNativeFSA(): boolean {
    return false;
  }

  public async init(file: ManifestFileItem, initialOffset: number = 0): Promise<void> {
    this.currentFile = file;
    this.currentOffset = initialOffset;
    this.memoryFallbackChunks = [];

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("/sw-stream.js");
        await navigator.serviceWorker.ready;

        if (registration.active) {
          const channel = new MessageChannel();
          const initPromise = new Promise<void>((resolve) => {
            channel.port1.onmessage = () => resolve();
          });

          registration.active.postMessage(
            {
              type: "INIT_STREAM",
              streamId: this.streamId,
              filename: file.name,
              size: file.size,
              mimeType: file.mimeType,
            },
            [channel.port2]
          );

          await initPromise;
          this.isSWActive = true;

          // Trigger download stream via hidden iframe
          const iframe = document.createElement("iframe");
          iframe.style.display = "none";
          iframe.src = `/download-stream/${this.streamId}`;
          document.body.appendChild(iframe);
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch (e) {}
          }, 30000);

          return;
        }
      } catch (swErr) {
        console.warn("ServiceWorker stream fallback unavailable, using chunk accumulator:", swErr);
      }
    }

    this.isSWActive = false;
  }

  public async write(byteOffset: number, chunk: Uint8Array): Promise<void> {
    if (this.isSWActive && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "PUSH_CHUNK",
        streamId: this.streamId,
        chunk: chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength),
      });
    } else {
      // Memory fallback accumulator
      this.memoryFallbackChunks.push(new Uint8Array(chunk));
    }
    this.currentOffset = byteOffset + chunk.byteLength;
  }

  public async seek(byteOffset: number): Promise<void> {
    this.currentOffset = byteOffset;
  }

  public async close(): Promise<void> {
    if (this.isSWActive && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "END_STREAM",
        streamId: this.streamId,
      });
    } else if (this.memoryFallbackChunks.length > 0 && this.currentFile) {
      // Create Blob and trigger browser download
      const blob = new Blob(this.memoryFallbackChunks, {
        type: this.currentFile.mimeType || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = this.currentFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      this.memoryFallbackChunks = [];
    }
  }

  public async abort(reason?: string): Promise<void> {
    if (this.isSWActive && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "ABORT_STREAM",
        streamId: this.streamId,
      });
    }
    this.memoryFallbackChunks = [];
  }

  public getCurrentOffset(): number {
    return this.currentOffset;
  }
}

/**
 * Creates the optimal stream writer based on browser capability
 */
export function createOptimalStreamWriter(): StreamWriteTarget {
  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    return new NativeFileSystemWriter();
  }
  return new ServiceWorkerStreamWriter();
}

