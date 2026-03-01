import { describe, it, expect } from 'vitest';
import {
  isVirtualNodeId,
  getSignalIdFromVirtualNodeId,
  getVirtualNodeId,
  getNamedSignalsFromAudioSetup,
  getVirtualNodeIdsFromAudioSetup,
  VIRTUAL_NODE_PREFIX,
} from './virtualNodes';
import type { AudioSetup } from '../data-model/audioSetupTypes';

describe('virtualNodes', () => {
  describe('isVirtualNodeId', () => {
    it('returns true for valid virtual node ids', () => {
      expect(isVirtualNodeId('audio-signal:band-1-raw')).toBe(true);
      expect(isVirtualNodeId('audio-signal:remap-abc')).toBe(true);
    });
    it('returns false for non-virtual node ids', () => {
      expect(isVirtualNodeId('node-123')).toBe(false);
      expect(isVirtualNodeId('audio-signal:')).toBe(false);
      expect(isVirtualNodeId('')).toBe(false);
    });
  });

  describe('getSignalIdFromVirtualNodeId', () => {
    it('extracts signal id from virtual node id', () => {
      expect(getSignalIdFromVirtualNodeId('audio-signal:band-1-raw')).toBe('band-1-raw');
      expect(getSignalIdFromVirtualNodeId('audio-signal:remap-bass-kick')).toBe('remap-bass-kick');
    });
    it('returns empty string for non-virtual node id', () => {
      expect(getSignalIdFromVirtualNodeId('node-123')).toBe('');
    });
  });

  describe('getVirtualNodeId', () => {
    it('builds virtual node id from signal id', () => {
      expect(getVirtualNodeId('band-1-raw')).toBe(`${VIRTUAL_NODE_PREFIX}band-1-raw`);
      expect(getVirtualNodeId('remap-xyz')).toBe(`${VIRTUAL_NODE_PREFIX}remap-xyz`);
    });
  });

  describe('getNamedSignalsFromAudioSetup', () => {
    it('returns band raw signal for each band (remappers listed separately)', () => {
      const setup: AudioSetup = {
        files: [],
        bands: [
          {
            id: 'band-1',
            name: 'Bass',
            sourceFileId: 'file-1',
            frequencyBands: [[20, 200]],
            smoothing: 0.5,
            fftSize: 2048,
          },
        ],
        remappers: [],
      };
      const signals = getNamedSignalsFromAudioSetup(setup);
      expect(signals).toHaveLength(1);
      expect(signals[0]).toEqual({
        id: 'band-band-1-raw',
        name: 'Bass',
        virtualNodeId: 'audio-signal:band-band-1-raw',
      });
    });

    it('returns remapper signals for each remapper', () => {
      const setup: AudioSetup = {
        files: [],
        bands: [
          {
            id: 'band-1',
            name: 'Bass',
            sourceFileId: 'file-1',
            frequencyBands: [[20, 200]],
            smoothing: 0.5,
            fftSize: 2048,
          },
        ],
        remappers: [
          {
            id: 'remap-1',
            name: 'Kick',
            bandId: 'band-1',
            inMin: 0,
            inMax: 1,
            outMin: 0,
            outMax: 1,
          },
        ],
      };
      const signals = getNamedSignalsFromAudioSetup(setup);
      expect(signals).toHaveLength(2); // band raw + one remapper
      const remapSignal = signals.find((s) => s.id === 'remap-remap-1');
      expect(remapSignal).toEqual({
        id: 'remap-remap-1',
        name: 'Bass: Kick',
        virtualNodeId: 'audio-signal:remap-remap-1',
      });
    });

    it('returns empty list for empty audioSetup', () => {
      const setup: AudioSetup = { files: [], bands: [], remappers: [] };
      expect(getNamedSignalsFromAudioSetup(setup)).toEqual([]);
    });
  });

  describe('getVirtualNodeIdsFromAudioSetup', () => {
    it('returns all virtual node ids (band raw only when no remappers)', () => {
      const setup: AudioSetup = {
        files: [],
        bands: [
          {
            id: 'b1',
            name: 'Band 1',
            sourceFileId: 'f1',
            frequencyBands: [[100, 500]],
            smoothing: 0,
            fftSize: 512,
          },
        ],
        remappers: [],
      };
      const ids = getVirtualNodeIdsFromAudioSetup(setup);
      expect(ids).toEqual(['audio-signal:band-b1-raw']);
    });
  });
});
