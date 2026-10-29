/**
 * Hardware & UX Safeguards:
 * 1. Screen Wake Lock API to prevent devices from sleeping during large transfers.
 * 2. beforeunload listener to warn users against accidental tab closures.
 */

export class ScreenWakeLockManager {
  private sentinel: any = null;
  private isRequested: boolean = false;
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
      this.sentinel.addEventListener("release", () => {
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

