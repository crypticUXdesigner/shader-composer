import { describe, it, expect } from 'vitest';
import type {
  SignalBinding,
  SignalBindingList,
  SignalValue,
} from './signals';
import {
  addSignalBinding,
  createAudioSignalBinding,
  createAutomationSignalBinding,
  createBaseSignalBinding,
  createLfoSignalBinding,
  getEnabledSignalBindings,
  removeSignalBinding,
  updateSignalBinding,
} from './signals';

describe('signals data model', () => {
  const baseId = 'base-1';
  const audioId = 'audio-1';
  const automationId = 'auto-1';
  const lfoId = 'lfo-1';

  function asList<TValue extends SignalValue>(
    ...bindings: SignalBinding<TValue>[]
  ): SignalBindingList<TValue> {
    return bindings;
  }

  it('creates base, audio, automation, and lfo bindings', () => {
    const base = createBaseSignalBinding(baseId, 1.0);
    const audio = createAudioSignalBinding(audioId, 'band-1', 1, 0.5);
    const automation = createAutomationSignalBinding(
      automationId,
      'lane-1',
      2,
      0.0,
    );
    const lfo = createLfoSignalBinding(lfoId, 'lfo-config-1', 3);

    expect(base.id).toBe(baseId);
    expect(base.enabled).toBe(true);
    expect(base.priority).toBe(0);
    expect(base.source.kind).toBe('base');
    expect(base.source.value).toBe(1.0);

    expect(audio.source.kind).toBe('audio');
    if (audio.source.kind === 'audio') {
      expect(audio.source.audioSignalId).toBe('band-1');
      expect(audio.source.weight).toBe(0.5);
    }

    expect(automation.source.kind).toBe('automation');
    if (automation.source.kind === 'automation') {
      expect(automation.source.automationId).toBe('lane-1');
      expect(automation.source.fallbackValue).toBe(0.0);
    }

    expect(lfo.source.kind).toBe('lfo');
    if (lfo.source.kind === 'lfo') {
      expect(lfo.source.lfoId).toBe('lfo-config-1');
    }
  });

  it('adds and removes bindings immutably', () => {
    const base = createBaseSignalBinding(baseId, 0.5);
    const audio = createAudioSignalBinding(audioId, 'band-1');

    const list1 = asList<SignalValue>(base);
    const list2 = addSignalBinding(list1, audio);

    expect(list1).not.toBe(list2);
    expect(list1.length).toBe(1);
    expect(list2.length).toBe(2);

    const list3 = removeSignalBinding(list2, baseId);
    expect(list3.length).toBe(1);
    expect(list3[0].id).toBe(audioId);

    const list4 = removeSignalBinding(list3, 'missing-id');
    expect(list4).toBe(list3);
  });

  it('updates bindings immutably when id exists', () => {
    const base = createBaseSignalBinding(baseId, 0.5, 0);
    const audio = createAudioSignalBinding(audioId, 'band-1', 1);
    const list1 = asList<SignalValue>(base, audio);

    const list2 = updateSignalBinding(list1, audioId, binding => ({
      ...binding,
      enabled: false,
      priority: 5,
    }));

    expect(list2).not.toBe(list1);

    const originalAudio = list1[1];
    const updatedAudio = list2[1];
    expect(originalAudio.enabled).toBe(true);
    expect(updatedAudio.enabled).toBe(false);
    expect(updatedAudio.priority).toBe(5);

    const list3 = updateSignalBinding(list2, 'missing-id', binding => binding);
    expect(list3).toBe(list2);
  });

  it('returns enabled bindings sorted by priority', () => {
    const low = createBaseSignalBinding('low', 0.0, 0);
    const mid = createBaseSignalBinding('mid', 0.5, 5);
    const high = createBaseSignalBinding('high', 1.0, 10);

    const bindings = asList<SignalValue>(
      { ...high, enabled: false },
      mid,
      low,
    );

    const enabled = getEnabledSignalBindings(bindings);
    expect(enabled.length).toBe(2);
    expect(enabled[0].id).toBe('low');
    expect(enabled[1].id).toBe('mid');
  });
});

