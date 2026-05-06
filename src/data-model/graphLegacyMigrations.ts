/**
 * Ordered app-level graph migrations applied before validating graphs against current node specs.
 * Used by preset load, project JSON import, and default-state restore so legacy node types remain loadable.
 */

import type { NodeGraph } from './types';
import { migrateNoiseNodes } from './noiseNodesMigration';
import { migrateBloomSphereColors } from './bloomSphereColorsMigration';
import { migrateDriveHomeLightsSkyGradient } from './driveHomeLightsSkyGradientMigration';
import { migrateKaleidoscopeSmooth } from './kaleidoscopeMergeMigration';
import { migrateDisplace2dUnify } from './displace2dUnifyMigration';

export function migrateLegacyNodeGraph(graph: NodeGraph): NodeGraph {
  let g = migrateNoiseNodes(graph);
  g = migrateKaleidoscopeSmooth(g);
  g = migrateDisplace2dUnify(g);
  g = migrateBloomSphereColors(g);
  return migrateDriveHomeLightsSkyGradient(g);
}
