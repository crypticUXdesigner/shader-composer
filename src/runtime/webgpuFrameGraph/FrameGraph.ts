export type FrameGraphResourceId = string;

export type FrameGraphPassKind = 'render' | 'compute' | 'copy';

export type FrameGraphPass<TCtx = void> = {
  id: string;
  kind: FrameGraphPassKind;
  reads?: FrameGraphResourceId[];
  writes?: FrameGraphResourceId[];
  execute: (ctx: TCtx) => void;
};

/**
 * Minimal frame graph:
 * - Passes declare reads/writes by logical resource ids.
 * - Graph computes an execution order by write→read dependencies.
 * - No scheduling heuristics; it’s purely correctness wiring for Task 09 MVP.
 */
export class FrameGraph<TCtx = void> {
  private readonly passes: FrameGraphPass<TCtx>[] = [];

  public addPass(pass: FrameGraphPass<TCtx>): void {
    if (this.passes.some((p) => p.id === pass.id)) {
      throw new Error(`FrameGraph already has a pass with id "${pass.id}"`);
    }
    this.passes.push(pass);
  }

  public getPasses(): readonly FrameGraphPass<TCtx>[] {
    return this.passes;
  }

  public compile(): FrameGraphPass<TCtx>[] {
    // Build writer map. MVP enforces single-writer semantics for each logical resource id.
    const writers = new Map<FrameGraphResourceId, string>();
    for (const p of this.passes) {
      for (const w of p.writes ?? []) {
        const existing = writers.get(w);
        if (existing && existing !== p.id) {
          throw new Error(`FrameGraph resource "${w}" written by multiple passes ("${existing}", "${p.id}").`);
        }
        writers.set(w, p.id);
      }
    }

    // Build adjacency / indegree based on reads depending on writers.
    const adj = new Map<string, Set<string>>();
    const indeg = new Map<string, number>();
    for (const p of this.passes) {
      indeg.set(p.id, 0);
      adj.set(p.id, new Set());
    }

    for (const p of this.passes) {
      for (const r of p.reads ?? []) {
        const w = writers.get(r);
        if (!w) continue;
        if (w === p.id) continue;
        const set = adj.get(w)!;
        if (!set.has(p.id)) {
          set.add(p.id);
          indeg.set(p.id, (indeg.get(p.id) ?? 0) + 1);
        }
      }
    }

    // Kahn.
    const queue: string[] = [];
    for (const [id, d] of indeg) if (d === 0) queue.push(id);

    const out: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift()!;
      out.push(id);
      for (const next of adj.get(id) ?? []) {
        const nd = (indeg.get(next) ?? 0) - 1;
        indeg.set(next, nd);
        if (nd === 0) queue.push(next);
      }
    }

    if (out.length !== this.passes.length) {
      throw new Error('FrameGraph has a cycle or unresolved dependency.');
    }

    const byId = new Map(this.passes.map((p) => [p.id, p] as const));
    return out.map((id) => {
      const p = byId.get(id);
      if (!p) throw new Error(`Missing pass ${id}`);
      return p;
    });
  }

  public execute(): void;
  public execute(ctx: TCtx): void;
  public execute(ctx?: TCtx): void {
    const order = this.compile();
    for (const p of order) p.execute(ctx as TCtx);
  }
}

