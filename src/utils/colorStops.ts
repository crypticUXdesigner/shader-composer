import type { ColorConfig, OKLCHColor, CubicBezier } from '../types';

// Evaluate cubic bezier curve - uses all 4 parameters (x1, y1, x2, y2)
// Input: x (0-1) - the input value to remap through the curve
// Returns: y value at the point where x(t) = x
function cubicBezier(x: number, curve: CubicBezier): number {
  // Handle edge cases
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  
  // Binary search to find t where x(t) = x
  let t0 = 0;
  let t1 = 1;
  
  // Binary search with 12 iterations for good precision
  for (let i = 0; i < 12; i++) {
    const t = (t0 + t1) / 2;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    
    // Evaluate x(t) = 3*(1-t)²*t*x1 + 3*(1-t)*t²*x2 + t³
    const xt = 3 * uu * t * curve.x1 + 3 * u * tt * curve.x2 + tt * t;
    
    if (xt < x) {
      t0 = t;
    } else {
      t1 = t;
    }
  }
  
  // Use final t value to compute y(t)
  const t = (t0 + t1) / 2;
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  
  // Evaluate y(t) = 3*(1-t)²*t*y1 + 3*(1-t)*t²*y2 + t³
  return 3 * uu * t * curve.y1 + 3 * u * tt * curve.y2 + tt * t;
}

// Interpolate hue with circular wrapping
function interpolateHue(startH: number, endH: number, t: number): number {
  // Handle circular hue interpolation - always go "up" (increasing direction)
  let adjustedEndH = endH;
  if (endH < startH) {
    adjustedEndH = endH + 360.0;
  }
  
  // Interpolate hue
  let h = startH + (adjustedEndH - startH) * t;
  
  // Normalize hue back to 0-360 range
  h = h % 360.0;
  if (h < 0) {
    h += 360.0;
  }
  
  return h;
}

// Generate color stops from config
export function generateColorStops(config: ColorConfig): OKLCHColor[] {
  const stops: OKLCHColor[] = [];
  const numStops = config.stops;
  
  for (let i = 0; i < numStops; i++) {
    const t = i / (numStops - 1); // 0 to 1
    
    // Evaluate bezier curves
    const lT = cubicBezier(t, config.lCurve);
    const cT = cubicBezier(t, config.cCurve);
    const hT = cubicBezier(t, config.hCurve);
    
    // Interpolate L and C
    const l = config.startColor.l + (config.endColor.l - config.startColor.l) * lT;
    const c = config.startColor.c + (config.endColor.c - config.startColor.c) * cT;
    
    // Interpolate hue with circular wrapping
    const h = interpolateHue(config.startColor.h, config.endColor.h, hT);
    
    stops.push({ l, c, h });
  }
  
  return stops;
}
