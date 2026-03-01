import { describe, it, expect } from 'vitest';
import { nodeSystemSpecs } from './index';
import { SDF_RAYMARCHER_NODE_IDS as SDF_RAYMARCHER_NODE_IDS_TOKEN } from '../../utils/cssTokens';

const byId = new Map(nodeSystemSpecs.map((spec) => [spec.id, spec]));

const SDF_NODE_IDS = [
  'hex-prism-sdf',
  'repeated-hex-prism-sdf',
  'radial-repeat-sdf',
  'kifs-sdf',
  'ether-sdf',
  'generic-raymarcher',
];

const SHAPES_2D_MASK_NODE_IDS = ['shapes-2d', 'star-2d', 'star-shape-2d', 'superellipse'];

const NON_SDF_SHAPES_NODE_IDS = [
  'sphere-raymarch',
  'spherical-fibonacci',
  'bloom-sphere',
  'bloom-sphere-effect',
  'hex-voxel',
  'metaballs',
  'cylinder-cone',
  'iridescent-tunnel',
  'inflated-icosahedron',
  'sky-dome',
  'bokeh-point',
  'drive-home-lights',
];

describe('SDF vs Shapes categories', () => {
  it('marks SDF core nodes (3D primitives + raymarcher) as SDF category', () => {
    for (const id of SDF_NODE_IDS) {
      const spec = byId.get(id);
      expect(spec, `missing spec for ${id}`).toBeTruthy();
      expect(spec?.category).toBe('SDF');
    }
  });

  it('keeps 2D shape/mask nodes in Shapes category', () => {
    for (const id of SHAPES_2D_MASK_NODE_IDS) {
      const spec = byId.get(id);
      expect(spec, `missing spec for ${id}`).toBeTruthy();
      expect(spec?.category).toBe('Shapes');
    }
  });

  it('keeps box-torus-sdf (Primitives) in Shapes category', () => {
    const spec = byId.get('box-torus-sdf');
    expect(spec).toBeTruthy();
    expect(spec?.category).toBe('Shapes');
  });

  it('keeps displacement-3d in Distort category', () => {
    const spec = byId.get('displacement-3d');
    expect(spec).toBeTruthy();
    expect(spec?.category).toBe('Distort');
  });

  it('keeps non-SDF shape and bokeh nodes in Shapes category', () => {
    for (const id of NON_SDF_SHAPES_NODE_IDS) {
      const spec = byId.get(id);
      expect(spec, `missing spec for ${id}`).toBeTruthy();
      expect(spec?.category).toBe('Shapes');
    }
  });

  it('palette grouping puts only SDF core nodes in SDF group', () => {
    const byCategory = new Map<string, typeof nodeSystemSpecs>();
    for (const spec of nodeSystemSpecs) {
      if (!byCategory.has(spec.category)) byCategory.set(spec.category, []);
      byCategory.get(spec.category)!.push(spec);
    }
    const sdfGroup = byCategory.get('SDF');
    expect(sdfGroup).toBeDefined();
    const ids = sdfGroup!.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(SDF_NODE_IDS));
    expect(ids).toHaveLength(SDF_NODE_IDS.length);
  });

  it('SDF_RAYMARCHER_NODE_IDS in cssTokens matches expected raymarcher list', () => {
    const expected = new Set(['generic-raymarcher']);
    expect(SDF_RAYMARCHER_NODE_IDS_TOKEN).toEqual(expected);
  });
});
