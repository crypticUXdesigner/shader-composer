import type { NodeInstance } from '../../data-model/types';
import {
  MAX_ARRANGEMENT_NOTES_PACKED,
  type ArrangementNote,
  type ArrangementSnapshot,
} from '../../audiotool/arrangement/types';
import { logArrangementNotesBakeDiagnostics } from '../../audiotool/arrangement/arrangementDiagnostics';
import {
  arrangementLanesGlslSuffix,
  readArrangementLanesPackOptions,
} from './packArrangementRegionsForGlsl';

export type PackedArrangementNote = {
  startSeconds: number;
  endSeconds: number;
  pitch: number;
  velocity: number;
};

export type ArrangementNotesPackResult = {
  notes: PackedArrangementNote[];
  pitchMin: number;
  pitchMax: number;
};

function parseTrackFilterList(raw: string): Set<string> {
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(ids);
}

function notePassesTrackFilter(
  note: ArrangementNote,
  snapshot: ArrangementSnapshot,
  trackFilterMode: number,
  trackFilterList: string
): boolean {
  if (trackFilterMode !== 1) return true;
  const allow = parseTrackFilterList(trackFilterList);
  if (allow.size === 0) return false;
  const track = snapshot.tracks.find((t) => t.id === note.trackId);
  return track !== undefined && track.enabled && allow.has(track.id);
}

/**
 * Filter and pack notes from an arrangement snapshot for GPU/GLSL baking.
 * Caps at {@link MAX_ARRANGEMENT_NOTES_PACKED}.
 */
export function packArrangementNotesForGlsl(
  snapshot: ArrangementSnapshot | undefined,
  options: { trackFilterMode: number; trackFilterList: string }
): ArrangementNotesPackResult {
  if (!snapshot?.notes?.length) {
    return { notes: [], pitchMin: 36, pitchMax: 84 };
  }

  const packed: PackedArrangementNote[] = [];
  let pitchMin = 127;
  let pitchMax = 0;

  for (const note of snapshot.notes) {
    if (!notePassesTrackFilter(note, snapshot, options.trackFilterMode, options.trackFilterList)) {
      continue;
    }
    const endSeconds = note.startSeconds + note.durationSeconds;
    packed.push({
      startSeconds: note.startSeconds,
      endSeconds,
      pitch: note.pitch,
      velocity: note.velocity,
    });
    pitchMin = Math.min(pitchMin, note.pitch);
    pitchMax = Math.max(pitchMax, note.pitch);
    if (packed.length >= MAX_ARRANGEMENT_NOTES_PACKED) break;
  }

  if (packed.length === 0) {
    return { notes: [], pitchMin: 36, pitchMax: 84 };
  }

  packed.sort((a, b) => a.startSeconds - b.startSeconds || a.pitch - b.pitch);
  return { notes: packed, pitchMin, pitchMax };
}

export function filterNotesForNode(
  snapshot: ArrangementSnapshot | undefined,
  node: NodeInstance
): ArrangementNotesPackResult {
  return packArrangementNotesForGlsl(snapshot, readArrangementLanesPackOptions(node));
}

function fmtGlslFloat(v: number): string {
  if (!Number.isFinite(v)) return '0.0';
  const s = v.toFixed(6);
  return s.includes('.') ? s : `${s}.0`;
}

function fmtWgslFloat(v: number): string {
  return fmtGlslFloat(v);
}

export function buildArrangementNotesGlslBake(
  nodeId: string,
  packed: ArrangementNotesPackResult
): string {
  const suffix = arrangementLanesGlslSuffix(nodeId);
  const count = packed.notes.length;
  const pitchSpan = Math.max(1, packed.pitchMax - packed.pitchMin);
  const lines: string[] = [
    `const int ARR_NOTE_COUNT_${suffix} = ${count};`,
    `const float ARR_NOTE_PITCH_MIN_${suffix} = ${fmtGlslFloat(packed.pitchMin)};`,
    `const float ARR_NOTE_PITCH_MAX_${suffix} = ${fmtGlslFloat(packed.pitchMax)};`,
    `const float ARR_NOTE_PITCH_SPAN_${suffix} = ${fmtGlslFloat(pitchSpan)};`,
  ];

  if (count === 0) {
    lines.push(`const vec4 ARR_NOTES_${suffix}[1] = vec4[1](vec4(0.0));`);
  } else {
    const entries = packed.notes.map(
      (n) =>
        `vec4(${fmtGlslFloat(n.startSeconds)}, ${fmtGlslFloat(n.endSeconds)}, ${fmtGlslFloat(n.pitch)}, ${fmtGlslFloat(n.velocity)})`
    );
    lines.push(`const vec4 ARR_NOTES_${suffix}[${count}] = vec4[${count}](${entries.join(', ')});`);
  }

  return lines.join('\n');
}

const ARRANGEMENT_NOTES_BAKE_PLACEHOLDER = '{{ARRANGEMENT_NOTES_BAKE}}';
const NODE_SUFFIX_PLACEHOLDER = '{{NODE_SUFFIX}}';

export function injectArrangementNotesNodeFunctions(
  funcCode: string,
  node: NodeInstance,
  snapshot: ArrangementSnapshot | undefined
): string {
  const suffix = arrangementLanesGlslSuffix(node.id);
  const options = readArrangementLanesPackOptions(node);
  const packed = packArrangementNotesForGlsl(snapshot, options);
  logArrangementNotesBakeDiagnostics(
    node.id,
    snapshot,
    packed,
    options.trackFilterMode,
    options.trackFilterList
  );
  const bake = buildArrangementNotesGlslBake(node.id, packed);
  return funcCode
    .replace(ARRANGEMENT_NOTES_BAKE_PLACEHOLDER, bake)
    .replaceAll(NODE_SUFFIX_PLACEHOLDER, suffix);
}

export function buildArrangementNotesWgslNodeHelper(
  nodeId: string,
  packed: ArrangementNotesPackResult
): string {
  const suffix = arrangementLanesGlslSuffix(nodeId);
  const count = packed.notes.length;
  const arraySize = Math.max(1, count);
  const pitchSpan = Math.max(1, packed.pitchMax - packed.pitchMin);
  const lines: string[] = [
    `const ARR_NOTE_COUNT_${suffix}: i32 = ${count};`,
    `const ARR_NOTE_PITCH_MIN_${suffix}: f32 = ${fmtWgslFloat(packed.pitchMin)};`,
    `const ARR_NOTE_PITCH_MAX_${suffix}: f32 = ${fmtWgslFloat(packed.pitchMax)};`,
    `const ARR_NOTE_PITCH_SPAN_${suffix}: f32 = ${fmtWgslFloat(pitchSpan)};`,
  ];

  if (count === 0) {
    lines.push(`const ARR_NOTES_${suffix}: array<vec4<f32>, 1> = array<vec4<f32>, 1>(vec4<f32>(0.0));`);
  } else {
    const entries = packed.notes.map(
      (n) =>
        `vec4<f32>(${fmtWgslFloat(n.startSeconds)}, ${fmtWgslFloat(n.endSeconds)}, ${fmtWgslFloat(n.pitch)}, ${fmtWgslFloat(n.velocity)})`
    );
    lines.push(
      `const ARR_NOTES_${suffix}: array<vec4<f32>, ${arraySize}> = array<vec4<f32>, ${arraySize}>(${entries.join(', ')});`
    );
  }

  lines.push(`
fn evalArrangementNotes_${suffix}(
  uv: vec2<f32>,
  timelineTime: f32,
  viewportMode: f32,
  windowSeconds: f32,
  fixedStart: f32,
  noteSize: f32,
  velocityScale: f32,
  edgeFade: f32,
  opacity: f32,
  backgroundRgb: vec3<f32>
) -> vec4<f32> {
  let windowStart = select(fixedStart, timelineTime - windowSeconds * 0.5, viewportMode < 0.5);
  let timeAtX = windowStart + clamp(uv.x, 0.0, 1.0) * max(windowSeconds, 0.0001);
  var color = backgroundRgb;
  var alpha: f32 = 0.0;
  let halfNote = noteSize * 0.5;

  for (var i: i32 = 0; i < ${MAX_ARRANGEMENT_NOTES_PACKED}; i++) {
    if (i >= ARR_NOTE_COUNT_${suffix}) {
      break;
    }
    let note = ARR_NOTES_${suffix}[i];
    if (timeAtX < note.x || timeAtX > note.y) {
      continue;
    }
    let pitchY = (note.z - ARR_NOTE_PITCH_MIN_${suffix}) / ARR_NOTE_PITCH_SPAN_${suffix};
    let rowDist = abs(uv.y - pitchY);
    if (rowDist > halfNote) {
      continue;
    }
    let vel = clamp(note.w * velocityScale, 0.0, 1.0);
    let rowFade = (1.0 - smoothstep(halfNote * 0.55, halfNote, rowDist)) * vel;
    let hue = fract(note.z * 0.024 + 0.12);
    let noteRgb = vec3<f32>(
      0.55 + 0.45 * cos(6.28318 * (hue + 0.0)),
      0.55 + 0.45 * cos(6.28318 * (hue + 0.33)),
      0.55 + 0.45 * cos(6.28318 * (hue + 0.66))
    );
    color = mix(color, noteRgb, rowFade);
    alpha = max(alpha, rowFade);
  }

  let playheadX = select(
    clamp((timelineTime - fixedStart) / max(windowSeconds, 0.0001), 0.0, 1.0),
    0.5,
    viewportMode < 0.5
  );
  let playheadVisible = select(
    timelineTime >= fixedStart && timelineTime <= fixedStart + max(windowSeconds, 0.0001),
    true,
    viewportMode < 0.5
  );
  if (playheadVisible) {
    let playheadDist = abs(uv.x - playheadX);
    let playheadWidth = max(fwidth(uv.x), 0.001) * 1.25;
    let playheadLine = 1.0 - smoothstep(playheadWidth * 0.5, playheadWidth, playheadDist);
    if (playheadLine > 0.0) {
      let playheadRgb = vec3<f32>(0.92, 0.78, 0.42);
      color = mix(color, playheadRgb, playheadLine);
      alpha = max(alpha, playheadLine);
    }
  }

  let edge = arrangementLanesEdgeFadeWgsl(uv, edgeFade);
  return vec4<f32>(color, alpha * opacity * edge);
}
`);

  return lines.join('\n');
}
