export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return "0 KB/s";
  const mbps = bytesPerSecond / (1024 * 1024);
  if (mbps >= 1) {
    return `${mbps.toFixed(2)} MB/s`;
  }
  const kbps = bytesPerSecond / 1024;
  return `${kbps.toFixed(1)} KB/s`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return "--";
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins < 60) {
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

