import type { PortType } from '../../types/nodeSpec';

/** Photoshop-style scalar blend primitives (shared GLSL `functions` block). */
export const BLEND_MODE_PHOTOSHOP_FLOAT_GLSL = `
    float blendMultiply(float base, float blend) {
      return base * blend;
    }
    
    float blendScreen(float base, float blend) {
      return 1.0 - (1.0 - base) * (1.0 - blend);
    }
    
    float blendOverlay(float base, float blend) {
      return base < 0.5 
        ? 2.0 * base * blend 
        : 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
    }
    
    float blendSoftLight(float base, float blend) {
      return (blend < 0.5) 
        ? base - (1.0 - 2.0 * blend) * base * (1.0 - base)
        : base + (2.0 * blend - 1.0) * (sqrt(base) - base);
    }
    
    float blendHardLight(float base, float blend) {
      return blend < 0.5 
        ? 2.0 * base * blend 
        : 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
    }
    
    float blendColorDodge(float base, float blend) {
      return base / (1.0 - blend + 0.001);
    }
    
    float blendColorBurn(float base, float blend) {
      return 1.0 - (1.0 - base) / (blend + 0.001);
    }
    
    float blendLinearDodge(float base, float blend) {
      return min(base + blend, 1.0);
    }
    
    float blendLinearBurn(float base, float blend) {
      return max(base + blend - 1.0, 0.0);
    }
    
    float blendDifference(float base, float blend) {
      return abs(base - blend);
    }
    
    float blendExclusion(float base, float blend) {
      return base + blend - 2.0 * base * blend;
    }
    
    float applyBlendMode(float base, float blend, int mode) {
      if (mode == 0) return blend;
      else if (mode == 1) return blendMultiply(base, blend);
      else if (mode == 2) return blendScreen(base, blend);
      else if (mode == 3) return blendOverlay(base, blend);
      else if (mode == 4) return blendSoftLight(base, blend);
      else if (mode == 5) return blendHardLight(base, blend);
      else if (mode == 6) return blendColorDodge(base, blend);
      else if (mode == 7) return blendColorBurn(base, blend);
      else if (mode == 8) return blendLinearDodge(base, blend);
      else if (mode == 9) return blendLinearBurn(base, blend);
      else if (mode == 10) return blendDifference(base, blend);
      else if (mode == 11) return blendExclusion(base, blend);
      else return base;
    }
  `;

export type BlendResolvedPortType = Exclude<PortType, 'any' | 'int' | 'bool'>;

/** 0 = lerp alpha (legacy Blend Color); 1 = apply blend mode to alpha as well. */
export type BlendAlphaMode = 0 | 1;

export function buildBlendMainCode(
  resolvedType: BlendResolvedPortType,
  alphaMode: BlendAlphaMode
): string {
  switch (resolvedType) {
    case 'float':
      return `
    float blended = applyBlendMode($input.base, $input.blend, $param.mode);
    $output.out = mix($input.base, blended, $param.opacity);
  `;
    case 'vec2':
      return `
    vec2 baseV = $input.base;
    vec2 blendV = $input.blend;
    vec2 blended = vec2(
      applyBlendMode(baseV.x, blendV.x, $param.mode),
      applyBlendMode(baseV.y, blendV.y, $param.mode)
    );
    $output.out = mix(baseV, blended, $param.opacity);
  `;
    case 'vec3':
      return `
    vec3 baseV = $input.base;
    vec3 blendV = $input.blend;
    vec3 blended = vec3(
      applyBlendMode(baseV.x, blendV.x, $param.mode),
      applyBlendMode(baseV.y, blendV.y, $param.mode),
      applyBlendMode(baseV.z, blendV.z, $param.mode)
    );
    $output.out = mix(baseV, blended, $param.opacity);
  `;
    case 'vec4':
      if (alphaMode === 1) {
        return `
    vec4 baseV = $input.base;
    vec4 blendV = $input.blend;
    vec4 blended = vec4(
      applyBlendMode(baseV.r, blendV.r, $param.mode),
      applyBlendMode(baseV.g, blendV.g, $param.mode),
      applyBlendMode(baseV.b, blendV.b, $param.mode),
      applyBlendMode(baseV.a, blendV.a, $param.mode)
    );
    $output.out = mix(baseV, blended, $param.opacity);
  `;
      }
      return `
    vec4 baseColor = $input.base;
    vec4 blendLayer = $input.blend;
    vec3 blended = vec3(
      applyBlendMode(baseColor.r, blendLayer.r, $param.mode),
      applyBlendMode(baseColor.g, blendLayer.g, $param.mode),
      applyBlendMode(baseColor.b, blendLayer.b, $param.mode)
    );
    vec3 rgb = mix(baseColor.rgb, blended, $param.opacity);
    float alpha = mix(baseColor.a, blendLayer.a, $param.opacity);
    $output.out = vec4(rgb, alpha);
  `;
    default:
      return buildBlendMainCode('float', 0);
  }
}
