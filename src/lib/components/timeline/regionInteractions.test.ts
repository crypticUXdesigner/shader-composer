import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createRegionDragState,
  resolveLaneIdAtClientPoint,
} from './regionInteractions';

describe('createRegionDragState', () => {
  it('initializes targetLaneId to source lane', () => {
    const drag = createRegionDragState({
      laneId: 'lane-a',
      regionId: 'region-1',
      regionStartTime: 2,
      cursorTime: 3,
      isDuplicate: true,
    });
    expect(drag.targetLaneId).toBe('lane-a');
    expect(drag.isDuplicate).toBe(true);
  });
});

describe('resolveLaneIdAtClientPoint', () => {
  const elementsFromPoint = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('document', { elementsFromPoint });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    elementsFromPoint.mockReset();
  });

  function mockTrackElement(laneId: string, contained: boolean): void {
    const track = {
      getAttribute: (name: string) => (name === 'data-lane-id' ? laneId : null),
    } as unknown as HTMLElement;

    const el = {
      closest: (selector: string) =>
        selector === '.track[data-lane-id]' ? track : null,
    } as unknown as Element;

    const container = {
      contains: () => contained,
    } as unknown as HTMLElement;

    elementsFromPoint.mockReturnValue([el]);
    expect(resolveLaneIdAtClientPoint(0, 0, container)).toBe(contained ? laneId : null);
  }

  it('returns lane id when pointer hits a track inside the container', () => {
    mockTrackElement('lane-b', true);
  });

  it('returns null when track is outside the lanes container', () => {
    mockTrackElement('lane-out', false);
  });

  it('returns null when lanes container is null', () => {
    expect(resolveLaneIdAtClientPoint(0, 0, null)).toBeNull();
  });
});
