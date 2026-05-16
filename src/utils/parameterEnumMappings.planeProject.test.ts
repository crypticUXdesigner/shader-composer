import { describe, it, expect } from 'vitest';
import { getParameterEnumMappings } from './parameterEnumMappings';

describe('plane-project enum labels', () => {
  it('maps cameraSource, uvMode, and clipRect', () => {
    expect(getParameterEnumMappings('plane-project', 'cameraSource')).toEqual({
      0: 'Built-in',
      1: 'External',
    });
    expect(getParameterEnumMappings('plane-project', 'uvMode')).toEqual({
      0: 'World',
      1: 'Normalized',
      2: 'Centered',
    });
    expect(getParameterEnumMappings('plane-project', 'clipRect')).toEqual({
      0: 'Off',
      1: 'On',
    });
  });
});
