/**
 * EffectiveValueUpdateRunner - Periodically marks nodes with connected float parameters
 * or automation lanes as dirty and requests a render for smooth audio-reactive and
 * automation-driven animation.
 * Extracted from NodeEditorCanvas to reduce its size.
 */

import type { NodeGraph } from '../../data-model/types';
import type { TimelineState } from '../../runtime/types';

export interface EffectiveValueUpdateRunnerDeps {
  getGraph: () => NodeGraph;
  nodeSpecs: Map<string, import('../../types/nodeSpec').NodeSpec>;
  markNodesDirty: (nodeIds: string[]) => void;
  requestRender: () => void;
  /** When timeline is playing, nodes with automation lanes are also marked dirty. */
  getTimelineState?: () => TimelineState | null;
}

const INTERVAL_MS = 100;

export class EffectiveValueUpdateRunner {
  private intervalId: number | null = null;
  private deps: EffectiveValueUpdateRunnerDeps;

  constructor(deps: EffectiveValueUpdateRunnerDeps) {
    this.deps = deps;
  }

  start(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = window.setInterval(() => {
      const graph = this.deps.getGraph();
      const nodesWithAnimatedParams = new Set<string>();
      for (const node of graph.nodes) {
        const spec = this.deps.nodeSpecs.get(node.type);
        if (!spec) continue;
        for (const [paramName, paramSpec] of Object.entries(spec.parameters)) {
          if (paramSpec.type === 'float') {
            const hasConnection = graph.connections.some(
              (conn) => conn.targetNodeId === node.id && conn.targetParameter === paramName
            );
            if (hasConnection) {
              nodesWithAnimatedParams.add(node.id);
              break;
            }
          }
        }
      }
      const timelineState = this.deps.getTimelineState?.() ?? null;
      if (timelineState?.isPlaying && graph.automation?.lanes) {
        for (const lane of graph.automation.lanes) {
          nodesWithAnimatedParams.add(lane.nodeId);
        }
      }
      if (nodesWithAnimatedParams.size > 0) {
        this.deps.markNodesDirty(Array.from(nodesWithAnimatedParams));
        this.deps.requestRender();
      }
    }, INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
