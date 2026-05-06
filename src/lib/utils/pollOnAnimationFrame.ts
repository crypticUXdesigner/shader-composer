/**
 * Invokes `callback` on each animation frame until the returned disposer runs.
 * Use for lightweight transport/UI reads where ~60 Hz is smoother than setInterval
 * without meaningful CPU cost (typical callback: read a few numbers from runtime).
 */
export function pollOnAnimationFrame(callback: () => void): () => void {
  let id = 0;
  function tick(): void {
    callback();
    id = requestAnimationFrame(tick);
  }
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}
