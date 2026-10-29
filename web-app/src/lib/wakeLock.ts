import { useState, useEffect } from "react";

/**
 * Hardware & UX Safeguards:
 * 1. Screen Wake Lock API to prevent devices from sleeping during large transfers.
 * 2. beforeunload listener to warn users against accidental tab closures.
 * 3. Reactive state subscription for UI telemetry indicators.
 */

let activeLocksCount = 0;
const wakeLockListeners = new Set<(active: boolean) => void>();

function notifyWakeLockListeners() {
  const isActive = activeLocksCount > 0;
  wakeLockListeners.forEach((listener) => {
    try {
      listener(isActive);
    } catch (e) {
      console.warn("Error in wakeLock listener:", e);
    }
  });
}

export function subscribeWakeLock(listener: (active: boolean) => void): () => void {
  wakeLockListeners.add(listener);
  listener(activeLocksCount > 0);
  return () => {
    wakeLockListeners.delete(listener);
  };
}

export function useWakeLockStatus(): boolean {
  const [isActive, setIsActive] = useState<boolean>(activeLocksCount > 0);

  useEffect(() => {
    return subscribeWakeLock(setIsActive);
  }, []);

  return isActive;
}

export class ScreenWakeLockManager {
  private sentinel: any = null;
  private isRequested: boolean = false;
  private hasCounted: boolean = false;
  private onVisibilityChangeBound: () => void;

  constructor() {
    this.onVisibilityChangeBound = this.handleVisibilityChange.bind(this);
  }

  public async acquire(): Promise<boolean> {
    this.isRequested = true;
    if (typeof window === "undefined" || !("wakeLock" in navigator)) {
      return false;
    }

    try {
      this.sentinel = await (navigator as any).wakeLock.request("screen");
      if (!this.hasCounted) {
        activeLocksCount++;
        this.hasCounted = true;
        notifyWakeLockListeners();
      }

      this.sentinel.addEventListener("release", () => {
        if (this.hasCounted) {
          activeLocksCount = Math.max(0, activeLocksCount - 1);
          this.hasCounted = false;
          notifyWakeLockListeners();
        }
        // If release was unexpected and still requested, try re-acquiring on next focus
        if (this.isRequested) {
          this.sentinel = null;
        }
      });

      document.addEventListener("visibilitychange", this.onVisibilityChangeBound);
      return true;
    } catch (err) {
      console.warn("Screen wake lock request failed or rejected:", err);
      return false;
    }
  }

  public async release(): Promise<void> {
    this.isRequested = false;
    document.removeEventListener("visibilitychange", this.onVisibilityChangeBound);
    if (this.hasCounted) {
      activeLocksCount = Math.max(0, activeLocksCount - 1);
      this.hasCounted = false;
      notifyWakeLockListeners();
    }
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (e) {
        // Ignored
      }
      this.sentinel = null;
    }
  }

  private async handleVisibilityChange(): Promise<void> {
    if (this.isRequested && document.visibilityState === "visible" && !this.sentinel) {
      await this.acquire();
    }
  }
}

/**
 * Attaches a beforeunload listener that alerts the user if transfers or hosting are active.
 */
export function setupBeforeUnloadGuard(isBusyCheck: () => boolean): () => void {
  if (typeof window === "undefined") return () => {};

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (isBusyCheck()) {
      event.preventDefault();
      event.returnValue =
        "An active file transfer or host session is in progress. Are you sure you want to leave?";
      return event.returnValue;
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  };
}
