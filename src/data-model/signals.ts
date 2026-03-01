/**
 * Signal model for parameter modulation.
 *
 * This module defines core types for time-varying signals and bindings that can
 * be used to represent base parameter values, audio-reactive inputs, timeline
 * automation, and future modulators (e.g. LFOs).
 *
 * At this stage, these types are not yet wired into the existing evaluation or
 * serialization paths; they are designed to be adopted incrementally by other
 * tasks.
 */

export type SignalId = string;

/**
 * Common value shape for signals. Concrete usages can further constrain this
 * via generics where needed.
 */
export type SignalValue =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number];

export type SignalSourceKind = 'base' | 'audio' | 'automation' | 'lfo';

export interface BaseSignalSource<TValue extends SignalValue = SignalValue> {
  kind: 'base';
  /** Static value for the parameter when no other modulation is applied. */
  value: TValue;
}

export interface AudioSignalSource {
  kind: 'audio';
  /**
   * Identifier of the audio signal (e.g. band/remap id or named signal id)
   * coming from the audio runtime.
   */
  audioSignalId: string;
  /**
   * Optional weight applied when combining this signal with others. The
   * evaluation layer is responsible for interpreting this.
   */
  weight?: number;
}

export interface AutomationSignalSource<TValue extends SignalValue = SignalValue> {
  kind: 'automation';
  /**
   * Identifier of the automation lane or region that drives this signal.
   */
  automationId: string;
  /**
   * Optional default value when automation is inactive for the current time.
   */
  fallbackValue?: TValue;
}

export interface LfoSignalSource {
  kind: 'lfo';
  /**
   * Identifier of the low-frequency oscillator configuration.
   */
  lfoId: string;
}

export type SignalSource<TValue extends SignalValue = SignalValue> =
  | BaseSignalSource<TValue>
  | AudioSignalSource
  | AutomationSignalSource<TValue>
  | LfoSignalSource;

/**
 * One binding between a parameter and a signal source. Multiple bindings can be
 * combined in order (e.g. base value, then audio, then automation).
 */
export interface SignalBinding<TValue extends SignalValue = SignalValue> {
  id: SignalId;
  source: SignalSource<TValue>;
  /**
   * Priority determines ordering when multiple bindings are evaluated; higher
   * numbers are applied later. Evaluation semantics are defined by the
   * consumer.
   */
  priority: number;
  /**
   * Whether this binding is currently active. Inactive bindings are preserved
   * structurally but skipped during evaluation.
   */
  enabled: boolean;
}

export type SignalBindingList<TValue extends SignalValue = SignalValue> =
  readonly SignalBinding<TValue>[];

/**
 * Create a binding for a static base value.
 */
export function createBaseSignalBinding<TValue extends SignalValue>(
  id: SignalId,
  value: TValue,
  priority = 0,
): SignalBinding<TValue> {
  return {
    id,
    priority,
    enabled: true,
    source: {
      kind: 'base',
      value,
    },
  };
}

/**
 * Create a binding that derives its value from an audio signal.
 */
export function createAudioSignalBinding<TValue extends SignalValue>(
  id: SignalId,
  audioSignalId: string,
  priority = 0,
  weight?: number,
): SignalBinding<TValue> {
  return {
    id,
    priority,
    enabled: true,
    source: {
      kind: 'audio',
      audioSignalId,
      weight,
    },
  };
}

/**
 * Create a binding that derives its value from an automation source.
 */
export function createAutomationSignalBinding<TValue extends SignalValue>(
  id: SignalId,
  automationId: string,
  priority = 0,
  fallbackValue?: TValue,
): SignalBinding<TValue> {
  return {
    id,
    priority,
    enabled: true,
    source: {
      kind: 'automation',
      automationId,
      fallbackValue,
    },
  };
}

/**
 * Create a binding that derives its value from an LFO configuration.
 */
export function createLfoSignalBinding<TValue extends SignalValue>(
  id: SignalId,
  lfoId: string,
  priority = 0,
): SignalBinding<TValue> {
  return {
    id,
    priority,
    enabled: true,
    source: {
      kind: 'lfo',
      lfoId,
    },
  };
}

/**
 * Add a binding to an existing immutable list, returning a new list with the
 * binding appended.
 */
export function addSignalBinding<TValue extends SignalValue>(
  bindings: SignalBindingList<TValue>,
  binding: SignalBinding<TValue>,
): SignalBindingList<TValue> {
  if (bindings.length === 0) {
    return [binding];
  }
  return [...bindings, binding];
}

/**
 * Remove a binding by id from a list, returning a new list. If the id does not
 * exist, the original list is returned unchanged.
 */
export function removeSignalBinding<TValue extends SignalValue>(
  bindings: SignalBindingList<TValue>,
  id: SignalId,
): SignalBindingList<TValue> {
  const next = bindings.filter(binding => binding.id !== id);
  return next.length === bindings.length ? bindings : next;
}

/**
 * Update a binding in a list by id using the provided updater. If the id does
 * not exist, the original list is returned unchanged.
 */
export function updateSignalBinding<TValue extends SignalValue>(
  bindings: SignalBindingList<TValue>,
  id: SignalId,
  updater: (binding: SignalBinding<TValue>) => SignalBinding<TValue>,
): SignalBindingList<TValue> {
  let changed = false;
  const next = bindings.map(binding => {
    if (binding.id !== id) {
      return binding;
    }
    changed = true;
    return updater(binding);
  });
  return changed ? next : bindings;
}

/**
 * Return only the bindings that are currently enabled, sorted by priority
 * ascending (lowest priority first).
 */
export function getEnabledSignalBindings<TValue extends SignalValue>(
  bindings: SignalBindingList<TValue>,
): SignalBindingList<TValue> {
  const enabled = bindings.filter(binding => binding.enabled);
  if (enabled.length <= 1) {
    return enabled;
  }
  return [...enabled].sort((a, b) => a.priority - b.priority);
}

