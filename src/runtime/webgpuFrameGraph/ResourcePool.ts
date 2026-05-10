type ResourceRecord<T> = {
  resource: T;
  key: string;
  lastUsedFrame: number;
};

/**
 * Minimal per-frame resource pool.
 *
 * - Caller provides a key function and create/destroy callbacks.
 * - Supports a "frame" concept so unused resources can be retired if desired.
 * - Resize invalidation is handled by having the caller include size in the key (see textureDescKey).
 */
export class ResourcePool<TResource extends object> {
  private readonly freeByKey = new Map<string, TResource[]>();
  private readonly live = new Set<TResource>();
  private readonly meta = new WeakMap<TResource, ResourceRecord<TResource>>();

  private frameIndex = 0;

  constructor(
    private readonly ops: {
      create: (key: string) => TResource;
      destroy: (resource: TResource) => void;
    }
  ) {}

  public beginFrame(frameIndex: number): void {
    this.frameIndex = frameIndex;
  }

  public acquire(key: string): TResource {
    const bucket = this.freeByKey.get(key);
    const res = bucket && bucket.length > 0 ? bucket.pop()! : this.ops.create(key);
    this.live.add(res);
    this.meta.set(res, { resource: res, key, lastUsedFrame: this.frameIndex });
    return res;
  }

  public release(resource: TResource): void {
    if (!this.live.has(resource)) return;
    this.live.delete(resource);
    const rec = this.meta.get(resource);
    const key = rec?.key ?? 'unknown';
    if (rec) {
      // Update last-used on release so `retireFreeResources()` ages based on the most recent use,
      // not the original acquire frame.
      rec.lastUsedFrame = this.frameIndex;
    }
    const bucket = this.freeByKey.get(key) ?? [];
    bucket.push(resource);
    this.freeByKey.set(key, bucket);
  }

  public destroyAll(): void {
    for (const res of this.live) {
      this.ops.destroy(res);
    }
    this.live.clear();
    for (const bucket of this.freeByKey.values()) {
      for (const res of bucket) this.ops.destroy(res);
    }
    this.freeByKey.clear();
  }

  /**
   * Optionally retire free resources older than `maxAgeFrames`.
   * This is conservative; it never destroys "live" resources.
   */
  public retireFreeResources(maxAgeFrames: number): void {
    for (const [key, bucket] of this.freeByKey) {
      const keep: TResource[] = [];
      for (const res of bucket) {
        const rec = this.meta.get(res);
        const age = rec ? this.frameIndex - rec.lastUsedFrame : maxAgeFrames + 1;
        if (age > maxAgeFrames) {
          this.ops.destroy(res);
        } else {
          keep.push(res);
        }
      }
      if (keep.length > 0) this.freeByKey.set(key, keep);
      else this.freeByKey.delete(key);
    }
  }
}

