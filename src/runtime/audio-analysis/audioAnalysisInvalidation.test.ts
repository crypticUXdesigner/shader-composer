import { describe, it, expect } from 'vitest';
import type { AudioSetup } from '../../data-model/audioSetupTypes';
import {
  bandAnalysisDigest,
  bandIdsWithAnalysisChange,
  classifyAudioSetupChange,
  fileBufferDigest,
  remapperMapDigest,
  structuralDigest,
} from './audioAnalysisInvalidation';

const FILE_A = 'file-a';
const FILE_B = 'file-b';

function baseSetup(): AudioSetup {
  return {
    files: [],
    bands: [
      {
        id: 'band-1',
        name: 'Bass',
        sourceFileId: FILE_A,
        frequencyBands: [[60, 250]],
        fftSize: 2048,
        smoothingHalfLifeSeconds: 1 / 120,
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
}

function mockBuffer(length: number): AudioBuffer {
  return {
    sampleRate: 48000,
    duration: length / 48000,
    length,
    numberOfChannels: 2,
  } as AudioBuffer;
}

describe('audioAnalysisInvalidation', () => {
  it('classifies remapper range-only edit as remapper tier', () => {
    const prev = baseSetup();
    const next: AudioSetup = {
      ...prev,
      remappers: [{ ...prev.remappers[0]!, inMin: 0.1, inMax: 0.9, outMin: 0.2, outMax: 0.8 }],
    };
    expect(classifyAudioSetupChange(prev, next, FILE_A)).toBe('remapper');
    expect(structuralDigest(prev, FILE_A)).toBe(structuralDigest(next, FILE_A));
    expect(bandAnalysisDigest(prev, FILE_A)).toBe(bandAnalysisDigest(next, FILE_A));
    expect(remapperMapDigest(prev, FILE_A)).not.toBe(remapperMapDigest(next, FILE_A));
  });

  it('bandIdsWithAnalysisChange lists only bands whose analysis fields changed', () => {
    const prev = baseSetup();
    const next: AudioSetup = {
      ...prev,
      bands: [
        { ...prev.bands[0]!, fftSize: 4096 },
        {
          id: 'band-2',
          name: 'High',
          sourceFileId: FILE_A,
          frequencyBands: [[2000, 8000]],
          fftSize: 2048,
        },
      ],
    };
    expect(bandIdsWithAnalysisChange(prev, next, FILE_A)).toEqual(['band-1']);
  });

  it('classifies fftSize change as band tier', () => {
    const prev = baseSetup();
    const next: AudioSetup = {
      ...prev,
      bands: [{ ...prev.bands[0]!, fftSize: 4096 }],
    };
    expect(classifyAudioSetupChange(prev, next, FILE_A)).toBe('band');
    expect(remapperMapDigest(prev, FILE_A)).toBe(remapperMapDigest(next, FILE_A));
  });

  it('classifies add remapper as structural tier', () => {
    const prev = baseSetup();
    const next: AudioSetup = {
      ...prev,
      remappers: [
        ...prev.remappers,
        {
          id: 'remap-2',
          name: 'Snare',
          bandId: 'band-1',
          inMin: 0,
          inMax: 1,
          outMin: 0,
          outMax: 1,
        },
      ],
    };
    expect(classifyAudioSetupChange(prev, next, FILE_A)).toBe('structural');
  });

  it('classifies buffer length change as file tier', () => {
    const prev = baseSetup();
    const next = baseSetup();
    expect(
      classifyAudioSetupChange(prev, next, FILE_A, {
        prev: mockBuffer(48000),
        next: mockBuffer(96000),
      })
    ).toBe('file');
    expect(classifyAudioSetupChange(prev, next, FILE_A)).toBe('none');
  });

  it('does not classify remapper edit on file A as change for file B', () => {
    const prev: AudioSetup = {
      files: [],
      bands: [
        {
          id: 'band-a',
          name: 'A',
          sourceFileId: FILE_A,
          frequencyBands: [[60, 250]],
          fftSize: 2048,
        },
        {
          id: 'band-b',
          name: 'B',
          sourceFileId: FILE_B,
          frequencyBands: [[250, 2000]],
          fftSize: 2048,
        },
      ],
      remappers: [
        {
          id: 'remap-a',
          name: 'A',
          bandId: 'band-a',
          inMin: 0,
          inMax: 1,
          outMin: 0,
          outMax: 1,
        },
      ],
    };
    const next: AudioSetup = {
      ...prev,
      remappers: [{ ...prev.remappers[0]!, outMax: 0.5 }],
    };
    expect(classifyAudioSetupChange(prev, next, FILE_A)).toBe('remapper');
    expect(classifyAudioSetupChange(prev, next, FILE_B)).toBe('none');
  });

  it('fileBufferDigest is stable for identical buffers', () => {
    const buf = mockBuffer(48000);
    expect(fileBufferDigest(buf)).toBe(fileBufferDigest(buf));
    expect(fileBufferDigest(null)).toBe('missing');
  });
});
