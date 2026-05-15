import type { NodeSpec } from '../../types/nodeSpec';
import { MAX_ARRANGEMENT_NOTES_PACKED } from '../../audiotool/arrangement/types';

/**
 * Pillar 2: MIDI notes baked from `audioSetup.arrangementSnapshot` at compile time.
 * Placeholder `{{ARRANGEMENT_NOTES_BAKE}}` is replaced per node instance in FunctionGenerator.
 */
export const arrangementNotesNodeSpec: NodeSpec = {
  id: 'arrangement-notes',
  category: 'Patterns',
  displayName: 'Arrangement Notes',
  description:
    'Draws MIDI notes by pitch and time vs the playhead. Requires an imported arrangement snapshot on the playlist primary.',
  icon: 'music-notes',
  inputs: [
    {
      name: 'in',
      type: 'vec2',
      label: 'UV',
    },
    {
      name: 'time',
      type: 'float',
      label: 'Time',
      fallbackExpression: 'uTimelineTime',
    },
  ],
  outputs: [
    {
      name: 'out',
      type: 'vec4',
      label: 'Color',
    },
  ],
  parameters: {
    uvInputMode: {
      type: 'int',
      default: 1,
      min: 0,
      max: 1,
      step: 1,
      label: 'UV in',
    },
    viewportMode: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Viewport',
    },
    windowSeconds: {
      type: 'float',
      default: 32.0,
      min: 1.0,
      max: 600.0,
      step: 0.5,
      label: 'Window',
    },
    fixedStartSeconds: {
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 3600.0,
      step: 0.1,
      label: 'Fixed start',
    },
    trackFilterMode: {
      type: 'int',
      default: 0,
      min: 0,
      max: 1,
      step: 1,
      label: 'Tracks',
    },
    trackFilterList: {
      type: 'string',
      default: '',
      label: 'Track ids',
    },
    noteSize: {
      type: 'float',
      default: 0.04,
      min: 0.005,
      max: 0.25,
      step: 0.001,
      label: 'Note size',
    },
    velocityScale: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 2.0,
      step: 0.01,
      label: 'Velocity',
    },
    edgeFade: {
      type: 'float',
      default: 0.08,
      min: 0.0,
      max: 0.5,
      step: 0.01,
      label: 'Edge fade',
    },
    opacity: {
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Opacity',
    },
    backgroundR: {
      type: 'float',
      default: 0.03,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Bg R',
    },
    backgroundG: {
      type: 'float',
      default: 0.04,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Bg G',
    },
    backgroundB: {
      type: 'float',
      default: 0.07,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: 'Bg B',
    },
  },
  parameterGroups: [
    {
      id: 'arr-notes-view',
      label: 'View',
      parameters: ['uvInputMode', 'viewportMode', 'windowSeconds', 'fixedStartSeconds'],
      collapsible: true,
      defaultCollapsed: false,
    },
    {
      id: 'arr-notes-tracks',
      label: 'Tracks',
      parameters: ['trackFilterMode'],
      collapsible: true,
      defaultCollapsed: true,
    },
    {
      id: 'arr-notes-style',
      label: 'Style',
      parameters: ['noteSize', 'velocityScale', 'edgeFade', 'opacity'],
      collapsible: true,
      defaultCollapsed: false,
    },
    {
      id: 'arr-notes-bg',
      label: 'Background',
      parameters: ['backgroundR', 'backgroundG', 'backgroundB'],
      collapsible: true,
      defaultCollapsed: true,
    },
  ],
  parameterLayout: {
    elements: [
      {
        type: 'grid',
        label: 'View',
        parameters: ['uvInputMode', 'viewportMode', 'windowSeconds', 'fixedStartSeconds'],
        layout: { columns: 'auto' },
      },
      {
        type: 'grid',
        label: 'Tracks',
        parameters: ['trackFilterMode'],
        layout: { columns: 'auto' },
      },
      {
        type: 'grid',
        label: 'Style',
        parameters: ['noteSize', 'velocityScale', 'edgeFade', 'opacity'],
        layout: { columns: 'auto' },
      },
      {
        type: 'grid',
        label: 'Background',
        parameters: ['backgroundR', 'backgroundG', 'backgroundB'],
        layout: { columns: 'auto' },
      },
    ],
    parametersWithoutPorts: ['trackFilterList', 'backgroundR', 'backgroundG', 'backgroundB'],
    minColumns: 3,
  },
  functions: `
{{ARRANGEMENT_NOTES_BAKE}}

float arrangementNotesEdgeFade(vec2 uv, float fadeAmount) {
  if (fadeAmount <= 0.0001) return 1.0;
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  return smoothstep(0.0, fadeAmount, edge);
}

float arrangementNotesPlayheadX(float timelineTime, int viewportMode, float windowSeconds, float fixedStart) {
  if (viewportMode == 0) return 0.5;
  return clamp((timelineTime - fixedStart) / max(windowSeconds, 0.0001), 0.0, 1.0);
}

bool arrangementNotesPlayheadVisible(float timelineTime, int viewportMode, float windowSeconds, float fixedStart) {
  if (viewportMode == 0) return true;
  float windowEnd = fixedStart + max(windowSeconds, 0.0001);
  return timelineTime >= fixedStart && timelineTime <= windowEnd;
}

float arrangementNotesPlayheadLine(vec2 uv, float playheadX) {
  float dist = abs(uv.x - playheadX);
  float lineWidth = max(fwidth(uv.x), 0.001) * 1.25;
  return 1.0 - smoothstep(lineWidth * 0.5, lineWidth, dist);
}

vec2 arrangementNotesScreenUv(vec2 inUv, int uvInputMode) {
  if (uvInputMode == 0) return inUv;
  float aspect = uResolution.x / uResolution.y;
  return vec2(inUv.x / (2.0 * aspect) + 0.5, inUv.y * 0.5 + 0.5);
}

vec3 arrangementNotesPaletteColor(float pitch) {
  float hue = fract(pitch * 0.024 + 0.12);
  return vec3(
    0.55 + 0.45 * cos(6.28318 * (hue + 0.0)),
    0.55 + 0.45 * cos(6.28318 * (hue + 0.33)),
    0.55 + 0.45 * cos(6.28318 * (hue + 0.66))
  );
}

vec4 evalArrangementNotes(
  vec2 uv,
  float timelineTime,
  int viewportMode,
  float windowSeconds,
  float fixedStart,
  float noteSize,
  float velocityScale,
  float edgeFade,
  float opacity,
  vec3 backgroundRgb
) {
  float windowStart = (viewportMode == 0) ? (timelineTime - windowSeconds * 0.5) : fixedStart;
  float timeAtX = windowStart + clamp(uv.x, 0.0, 1.0) * max(windowSeconds, 0.0001);
  float halfNote = noteSize * 0.5;
  vec3 color = backgroundRgb;
  float alpha = 0.0;

  for (int i = 0; i < ${MAX_ARRANGEMENT_NOTES_PACKED}; i++) {
    if (i >= ARR_NOTE_COUNT_{{NODE_SUFFIX}}) break;
    vec4 note = ARR_NOTES_{{NODE_SUFFIX}}[i];
    if (timeAtX < note.x || timeAtX > note.y) continue;
    float pitchY = (note.z - ARR_NOTE_PITCH_MIN_{{NODE_SUFFIX}}) / ARR_NOTE_PITCH_SPAN_{{NODE_SUFFIX}};
    float rowDist = abs(uv.y - pitchY);
    if (rowDist > halfNote) continue;
    float vel = clamp(note.w * velocityScale, 0.0, 1.0);
    float rowFade = (1.0 - smoothstep(halfNote * 0.55, halfNote, rowDist)) * vel;
    vec3 noteRgb = arrangementNotesPaletteColor(note.z);
    color = mix(color, noteRgb, rowFade);
    alpha = max(alpha, rowFade);
  }

  float playheadX = arrangementNotesPlayheadX(timelineTime, viewportMode, windowSeconds, fixedStart);
  if (arrangementNotesPlayheadVisible(timelineTime, viewportMode, windowSeconds, fixedStart)) {
    float playheadLine = arrangementNotesPlayheadLine(uv, playheadX);
    if (playheadLine > 0.0) {
      vec3 playheadRgb = vec3(0.92, 0.78, 0.42);
      color = mix(color, playheadRgb, playheadLine);
      alpha = max(alpha, playheadLine);
    }
  }

  float edge = arrangementNotesEdgeFade(uv, edgeFade);
  return vec4(color, alpha * opacity * edge);
}
`,
  mainCode: `
  vec2 noteUv = arrangementNotesScreenUv($input.in, int($param.uvInputMode));
  float timelineTime = $input.time;
  vec4 notes = evalArrangementNotes(
    noteUv,
    timelineTime,
    int($param.viewportMode),
    $param.windowSeconds,
    $param.fixedStartSeconds,
    $param.noteSize,
    $param.velocityScale,
    $param.edgeFade,
    $param.opacity,
    vec3($param.backgroundR, $param.backgroundG, $param.backgroundB)
  );
  $output.out = notes;
`,
};
