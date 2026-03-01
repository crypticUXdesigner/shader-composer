/**
 * Synthetic transport for timeline when no audio is loaded.
 * Advances currentTime 0→duration when playing; loops at duration.
 * Used by RuntimeManager when getGlobalAudioState() returns null.
 */

export interface SyntheticTransportState {
  currentTime: number;
  isPlaying: boolean;
}

export class SyntheticTransport {
  private currentTime = 0;
  private isPlaying = false;
  private duration = 30;
  private rafId: number | null = null;
  private lastTime = 0;
  private readonly loop = true;

  setDuration(seconds: number): void {
    this.duration = Math.max(0, seconds);
    this.currentTime = Math.min(this.currentTime, this.duration);
  }

  getState(): SyntheticTransportState {
    return { currentTime: this.currentTime, isPlaying: this.isPlaying };
  }

  play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTime = performance.now() / 1000;
    this.tick();
  }

  pause(): void {
    this.isPlaying = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  seek(time: number): void {
    this.currentTime = Math.max(0, Math.min(time, this.duration));
  }

  private tick = (): void => {
    if (!this.isPlaying) return;
    const now = performance.now() / 1000;
    const delta = now - this.lastTime;
    this.lastTime = now;
    this.currentTime += delta;
    if (this.currentTime >= this.duration) {
      if (this.loop) {
        this.currentTime = this.currentTime % this.duration;
      } else {
        this.currentTime = this.duration;
        this.pause();
      }
    }
    this.rafId = requestAnimationFrame(this.tick);
  };
}
