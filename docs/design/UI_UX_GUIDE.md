# UI/UX Guide - Node-Based Shader System

**Version:** 1.0  
**Date:** 2024  
**Status:** Reference Documentation

This document provides a comprehensive guide to the user interface and user experience of the node-based shader editor, including layout, interactions, visual design, and behavior.

---

## Table of Contents

1. [Overview](#overview)
2. [Layout System](#layout-system)
3. [Node Editor Canvas](#node-editor-canvas)
4. [Node System](#node-system)
5. [Connection System](#connection-system)
6. [Parameter Controls](#parameter-controls)
7. [Selection and Editing](#selection-and-editing)
8. [Visual Feedback](#visual-feedback)
9. [Keyboard Shortcuts](#keyboard-shortcuts)
10. [Performance Requirements](#performance-requirements)
11. [Coordinate Systems](#coordinate-systems)
12. [Port Hit Testing](#port-hit-testing)
13. [Connection Hit Testing](#connection-hit-testing)
14. [Parameter Drag Calculation](#parameter-drag-calculation)
15. [Bezier Curve Rendering](#bezier-curve-rendering)
16. [Node Overlap Detection](#node-overlap-detection)
17. [Context Menu Structure](#context-menu-structure)
18. [Search Dialog Structure](#search-dialog-structure)
19. [Corner Widget Resize](#corner-widget-resize)
20. [Debouncing Parameter Updates](#debouncing-parameter-updates)
21. [Z-Index and Layering](#z-index-and-layering)

---

## Overview

The node-based shader editor provides a visual interface for creating shader graphs by connecting nodes. The interface consists of:

1. **Node Editor Canvas**: Main editing area where nodes are placed and connected
2. **Shader Preview**: Live preview of the compiled shader result
3. **Layout System**: Split-screen with collapsible preview

### Key Principles
- **Immediate Feedback**: All changes reflect instantly in preview
- **Intuitive Interaction**: Drag-and-drop, visual connections
- **Visual Clarity**: Clear node types, connection states, parameter values
- **Performance**: Smooth interaction even with 100+ nodes

---

## Layout System

### Default Layout

**Split-Screen Layout:**
- **Left Panel**: Node Editor Canvas (50% width, full height)
- **Right Panel**: Shader Preview (50% width, full height)
- **Divider**: Resizable vertical divider between panels (default: center)

### Shader Preview States

#### State 1: Expanded (Default)
- **Position**: Right side of screen
- **Width**: 50% of viewport (adjustable via divider)
- **Height**: 100% of viewport
- **Visibility**: Fully visible

#### State 2: Collapsed (Corner Widget)
- **Trigger**: Click "Close" button on preview panel
- **Position**: Bottom-right corner (overlay)
- **Initial Size**: 320px × 240px
- **Resizable**: Yes (drag corner/edges)
- **Min Size**: 160px × 120px
- **Max Size**: 50% of viewport width/height
- **Behavior**: 
  - Floats above node editor
  - Can be dragged to reposition
  - Click "Expand" button to return to split-screen

### Layout Controls

**Divider (Split-Screen Mode):**
- **Visual**: Vertical line between panels
- **Interaction**: Drag to resize panels
- **Range**: Left panel 20% - 80% of viewport width
- **Cursor**: `col-resize` when hovering

**Close Button (Preview Panel):**
- **Location**: Top-right corner of preview panel
- **Icon**: "×" or close icon
- **Action**: Collapse preview to corner widget

**Expand Button (Corner Widget):**
- **Location**: Top-right corner of corner widget
- **Icon**: Expand/fullscreen icon
- **Action**: Expand preview to split-screen mode

### Responsive Behavior

- **Minimum Viewport**: 800px × 600px
- **Node Editor Minimum**: 400px width (when preview expanded)
- **Corner Widget**: Scales with viewport (maintains aspect ratio when resizing)

---

## Node Editor Canvas

### Canvas Properties

- **Coordinate System**: Pixel-based, origin at top-left
- **Zoom Range**: 0.1x to 10x (default: 1.0x)
- **Pan Range**: Unlimited (constrained by content bounds)
- **Background**: Grid pattern (optional, toggleable)

### Grid System

**Grid Pattern:**
- **Type**: Dotted or dashed lines
- **Spacing**: 20px at 1.0x zoom (scales with zoom)
- **Color**: Light gray (#E0E0E0)
- **Visibility**: Toggleable via settings

**Snap to Grid:**
- **Option**: Enable/disable snap-to-grid
- **Snap Distance**: 10px (at 1.0x zoom)
- **Behavior**: Node positions snap to grid when enabled

### Canvas Interaction

**Pan:**
- **Method 1**: Middle mouse button drag
- **Method 2**: Space + Left mouse drag
- **Method 3**: Arrow keys (when canvas focused)
- **Speed**: 1:1 with mouse movement (at 1.0x zoom)

**Zoom:**
- **Method 1**: Mouse wheel (vertical scroll)
- **Method 2**: Pinch gesture (touch devices)
- **Method 3**: Ctrl/Cmd + Mouse wheel
- **Zoom Center**: Mouse cursor position
- **Zoom Speed**: 10% per scroll step
- **Visual Feedback**: Zoom level indicator (optional)

**Viewport:**
- **Bounds**: Infinite (no hard limits)
- **Initial View**: Centered on graph content (or 0,0 if empty)
- **Fit to Content**: Button/command to zoom/pan to show all nodes

---

## Node System

### Node Visual Design

**Node Structure:**
```
┌─────────────────────────────┐
│ [Icon] Node Title      [×]  │ ← Header
├─────────────────────────────┤
│ Input Port 1  [●]            │ ← Inputs
│ Input Port 2  [●]            │
├─────────────────────────────┤
│ Parameter Controls          │ ← Parameters
│ [Slider/Input]               │
├─────────────────────────────┤
│ [●] Output Port 1            │ ← Outputs
│ [●] Output Port 2            │
└─────────────────────────────┘
```

**Node Dimensions:**
- **Min Width**: 200px
- **Max Width**: 400px (auto-expands for long parameter names)
- **Header Height**: 32px
- **Port Height**: 24px per port
- **Parameter Height**: 32px per parameter (see Parameter Controls)
- **Border**: 1px solid (#CCCCCC)
- **Border Radius**: 4px

**Node Colors (by Category):**
- **Input**: Light blue (#E3F2FD)
- **Transform**: Light gray (#F5F5F5)
- **Generator**: Light green (#E8F5E9)
- **Operation**: Light yellow (#FFF9C4)
- **Blend**: Light purple (#F3E5F5)
- **Mask**: Light orange (#FFF3E0)
- **Post-Process**: Light pink (#FCE4EC)
- **Output**: Light red (#FFEBEE)

### Node Creation

**Method 1: Context Menu**
- **Trigger**: Right-click on canvas (empty area)
- **Menu**: List of node categories → node types
- **Action**: Click node type to create at cursor position

**Method 2: Search Dialog**
- **Trigger**: Double-click canvas or keyboard shortcut
- **Dialog**: Search input + filtered node list
- **Action**: Select node type, press Enter or click

**Method 3: Toolbar/Palette**
- **Location**: Left side or top of canvas (optional)
- **Action**: Click node type, then click canvas to place

**Default Position:**
- New nodes created at mouse cursor position (or center of viewport if no cursor)

### Node Placement

**Drag to Move:**
- **Trigger**: Click and drag node header
- **Behavior**: Node follows mouse cursor
- **Snap**: Optional snap-to-grid
- **Constraint**: Node cannot be dragged outside viewport (with padding)

**Position Updates:**
- Update `node.position` in real-time during drag
- Save position on drag end

### Node Deletion

**Method 1: Delete Button**
- **Location**: Top-right corner of node header
- **Icon**: "×"
- **Action**: Click to delete node (with confirmation if node has connections)

**Method 2: Keyboard**
- **Shortcut**: Delete or Backspace key
- **Action**: Delete selected node(s)
- **Confirmation**: Show if deleting node with connections

**Cascade Deletion:**
- When node is deleted, all connections to/from that node are also deleted
- Update graph data model accordingly

### Node Ports

**Port Visual:**
- **Shape**: Circle (8px diameter)
- **Color**: 
  - **Input**: Blue (#2196F3)
  - **Output**: Green (#4CAF50)
- **Hover**: Scale to 12px, highlight color
- **Active**: Scale to 10px, darker color

**Port Labels:**
- **Position**: Left of port (inputs) or right of port (outputs)
- **Font**: 12px, regular weight
- **Color**: #666666

**Port Types (Visual Indicator):**
- **float**: Single circle
- **vec2**: Two circles (side by side)
- **vec3**: Three circles
- **vec4**: Four circles

---

## Connection System

### Connection Visual (Cable)

**Cable Design:**
- **Style**: Curved bezier path
- **Color**: 
  - **Default**: Gray (#999999)
  - **Selected**: Blue (#2196F3)
  - **Invalid**: Red (#F44336)
- **Width**: 2px (default), 3px (hover/selected)
- **Opacity**: 0.8 (default), 1.0 (hover/selected)

**Bezier Curve:**
- **Control Points**: 
  - Start: Output port position
  - End: Input port position
  - Control 1: Horizontal offset from start (50px)
  - Control 2: Horizontal offset from end (50px)
- **Formula**: Standard cubic bezier

### Creating Connections

**Method 1: Drag from Output**
- **Trigger**: Click and drag from output port
- **Visual**: Temporary cable follows mouse cursor
- **Target**: Valid input ports highlight on hover
- **Action**: Release on input port to create connection

**Method 2: Drag from Input**
- **Trigger**: Click and drag from input port
- **Visual**: Temporary cable follows mouse cursor
- **Target**: Valid output ports highlight on hover
- **Action**: Release on output port to create connection

**Connection Validation:**
- **Type Check**: Output type must be compatible with input type
- **Visual Feedback**: 
  - **Valid Target**: Port highlights green
  - **Invalid Target**: Port highlights red
  - **No Target**: Cable disappears on release

### Connection Interaction

**Select Connection:**
- **Method**: Click on cable
- **Visual**: Cable highlights (blue, thicker)
- **Multi-select**: Shift+Click to add to selection

**Delete Connection:**
- **Method 1**: Select connection, press Delete
- **Method 2**: Right-click connection, select "Delete"
- **Action**: Remove connection from graph

**Connection Hover:**
- **Visual**: Cable becomes thicker (3px), fully opaque
- **Tooltip**: Show source → target information

### Connection Routing

**Automatic Routing:**
- Connections use bezier curves with automatic control points
- Avoid overlapping with nodes when possible
- Recalculate on node movement

**Manual Routing (Future):**
- Not required for v1.0

---

## Parameter Controls

### Parameter Input Types

**Float/Int Parameters:**
- **Control**: Draggable number input
- **Display**: Text input + drag area
- **Layout**: 
  ```
  [Label] [━━━━━━━━━━━━━━━━━━━━] [Value]
           ↑ Drag area
  ```

### Draggable Number Input

**Visual Design:**
- **Container**: Horizontal bar (200px width, 32px height)
- **Background**: Light gray (#F5F5F5)
- **Border**: 1px solid (#CCCCCC)
- **Value Display**: Right-aligned text (12px, monospace)

**Interaction:**
- **Drag Area**: Entire container (or dedicated drag handle)
- **Drag Direction**: Vertical (up = increase, down = decrease)
- **Drag Sensitivity**: 
  - **Normal**: 0.01 per pixel (for range 0-1)
  - **Fine**: 0.001 per pixel (with Shift key)
  - **Coarse**: 0.1 per pixel (with Ctrl/Cmd key)
- **Value Clamp**: Enforce min/max from parameter spec

**Drag Behavior:**
- **Start**: Mouse down on drag area
- **During**: 
  - Value updates in real-time
  - Visual feedback (highlight container)
  - Cursor: `ns-resize` (vertical resize)
- **End**: Mouse up, save value to graph

**Keyboard Input:**
- **Focus**: Click on value display to focus text input
- **Edit**: Type new value, press Enter to confirm
- **Validation**: Validate on blur/Enter (clamp to min/max)

**Visual Feedback:**
- **Hover**: Container background lightens
- **Dragging**: Container border highlights (blue)
- **Invalid**: Container border red (if value out of range)

### Other Parameter Types

**Int Parameters:**
- Same as float, but values are integers
- Step size: 1 (or parameter spec step)

**String Parameters:**
- **Control**: Text input field
- **No drag**: Dragging not applicable

**Vec4 Parameters (Bezier Curves):**
- **Control**: Custom bezier curve editor (from existing system)
- **No drag**: Use existing curve editor

**Array Parameters:**
- **Control**: List/table editor (from existing system)
- **No drag**: Use existing array editor

### Parameter Grouping

**Collapsible Groups:**
- Parameters can be grouped (from Node Specification)
- **Header**: Group name + expand/collapse icon
- **State**: Expanded (default) or collapsed
- **Visual**: Indentation for grouped parameters

---

## Selection and Editing

### Node Selection

**Single Selection:**
- **Method**: Click on node (header or body, not ports)
- **Visual**: Node border highlights (blue, 2px)
- **State**: Only one node selected

**Multi-Selection:**
- **Method**: Shift+Click to add to selection
- **Method**: Drag selection box (marquee)
- **Visual**: All selected nodes have blue border
- **State**: Multiple nodes selected

**Selection Box (Marquee):**
- **Trigger**: Click and drag on empty canvas
- **Visual**: Semi-transparent blue rectangle
- **Behavior**: All nodes within box are selected on release

**Deselection:**
- **Method**: Click on empty canvas
- **Action**: Clear all selections

### Copy/Paste

**Copy:**
- **Shortcut**: Ctrl/Cmd + C
- **Action**: Copy selected nodes (and their connections) to clipboard
- **Format**: JSON (node graph subset)

**Paste:**
- **Shortcut**: Ctrl/Cmd + V
- **Action**: Paste nodes at cursor position (offset from original)
- **Behavior**: 
  - Generate new IDs for pasted nodes
  - Maintain internal connections (between pasted nodes)
  - Break external connections (to non-pasted nodes)

**Duplicate:**
- **Shortcut**: Ctrl/Cmd + D
- **Action**: Same as copy + paste in one action

### Undo/Redo

**Undo:**
- **Shortcut**: Ctrl/Cmd + Z
- **Action**: Revert last change
- **Stack**: Maintain undo history (50 actions)

**Redo:**
- **Shortcut**: Ctrl/Cmd + Shift + Z
- **Action**: Reapply last undone change

**Undoable Actions:**
- Node creation/deletion
- Node movement
- Connection creation/deletion
- Parameter value changes
- Graph-level changes

**Non-Undoable Actions:**
- Canvas pan/zoom
- Selection changes
- View state changes

---

## Visual Feedback

### Hover States

**Node Hover:**
- **Visual**: Node border lightens, slight scale (1.02x)
- **Cursor**: `pointer`

**Port Hover:**
- **Visual**: Port scales to 12px, highlights
- **Cursor**: `crosshair`

**Connection Hover:**
- **Visual**: Cable becomes thicker (3px), fully opaque
- **Cursor**: `pointer`

### Drag States

**Node Dragging:**
- **Visual**: Node opacity 0.8, shadow effect
- **Cursor**: `move` or `grabbing`

**Connection Dragging:**
- **Visual**: Temporary cable follows mouse
- **Cursor**: `crosshair`

**Parameter Dragging:**
- **Visual**: Container border highlights (blue)
- **Cursor**: `ns-resize`

### Error States

**Invalid Connection:**
- **Visual**: Red cable, red port highlight
- **Tooltip**: "Type mismatch: float → vec2"

**Invalid Parameter:**
- **Visual**: Red border on parameter input
- **Tooltip**: "Value out of range: must be 0.0 - 1.0"

**Compilation Error:**
- **Visual**: Error indicator on canvas (top-right)
- **Tooltip**: List of compilation errors

### Loading States

**Compiling:**
- **Visual**: Spinner on preview panel
- **Message**: "Compiling shader..."

**Updating:**
- **Visual**: Subtle loading indicator
- **Message**: None (silent update)

---

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + C` | Copy selected nodes |
| `Ctrl/Cmd + V` | Paste nodes |
| `Ctrl/Cmd + D` | Duplicate selected nodes |
| `Delete` / `Backspace` | Delete selected nodes/connections |
| `Ctrl/Cmd + A` | Select all nodes |
| `Ctrl/Cmd + F` | Focus search (create node) |
| `Space + Drag` | Pan canvas |
| `Ctrl/Cmd + Mouse Wheel` | Zoom canvas |
| `F` | Fit to content |
| `1` | Reset zoom to 1.0x |

### Node-Specific Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Open parameter editor (when node selected) |
| `Esc` | Deselect all / Close dialogs |

### Parameter Editing Shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift + Drag` | Fine adjustment (0.1x sensitivity) |
| `Ctrl/Cmd + Drag` | Coarse adjustment (10x sensitivity) |
| `Enter` | Confirm text input |
| `Esc` | Cancel text input |

---

## Performance Requirements

### Frame Rate

- **Target**: 60 FPS
- **Minimum**: 30 FPS (acceptable for large graphs)
- **Measurement**: Canvas rendering + shader preview

### Scalability

- **Small Graphs** (1-10 nodes): Instant updates
- **Medium Graphs** (10-50 nodes): < 100ms compilation
- **Large Graphs** (50-100 nodes): < 500ms compilation
- **Very Large Graphs** (100+ nodes): < 2s compilation (acceptable)

### Optimization Strategies

1. **Incremental Compilation**: Only recompile changed nodes (future)
2. **Debouncing**: Debounce parameter updates (100ms)
3. **Virtualization**: Only render visible nodes (for 100+ nodes)
4. **Connection Culling**: Only render connections in viewport
5. **Lazy Evaluation**: Defer expensive calculations

### Memory Requirements

- **Graph Storage**: < 1MB per graph (typical)
- **Shader Code**: < 100KB per compiled shader
- **UI State**: < 10MB total

---

## Coordinate Systems

### Canvas Coordinate System

**Definition:**
- **Origin**: Top-left corner of canvas viewport
- **X-axis**: Increases rightward (pixels)
- **Y-axis**: Increases downward (pixels)
- **Units**: Pixels (integer coordinates)

### Node Position Storage

**Storage Format:**
- Node positions are stored in **canvas coordinates** (not screen coordinates)
- Canvas coordinates = (screen coordinates - pan) / zoom
- When saving: Store canvas coordinates
- When loading: Restore canvas coordinates

### Coordinate Conversion

**Screen to Canvas:**
```typescript
function screenToCanvas(
  screenX: number,
  screenY: number,
  panX: number,
  panY: number,
  zoom: number
): { x: number, y: number } {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom
  };
}
```

**Canvas to Screen:**
```typescript
function canvasToScreen(
  canvasX: number,
  canvasY: number,
  panX: number,
  panY: number,
  zoom: number
): { x: number, y: number } {
  return {
    x: canvasX * zoom + panX,
    y: canvasY * zoom + panY
  };
}
```

---

## Port Hit Testing

### Port Click Detection

**Algorithm:**
1. Get port position in screen coordinates
2. Calculate distance from mouse to port center
3. If distance < port radius + hit margin, port is hit

**Implementation:**
```typescript
function isPortHit(
  mouseX: number,
  mouseY: number,
  portX: number,
  portY: number,
  portRadius: number = 4,  // 8px diameter / 2
  hitMargin: number = 4    // Extra margin for easier clicking
): boolean {
  const dx = mouseX - portX;
  const dy = mouseY - portY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (portRadius + hitMargin);
}
```

**Port Position Calculation:**
```typescript
function getPortScreenPosition(
  node: NodeInstance,
  port: PortSpec,
  nodeScreenX: number,
  nodeScreenY: number,
  nodeWidth: number,
  nodeHeight: number
): { x: number, y: number } {
  // Ports are on left (inputs) or right (outputs) edge of node
  const portX = port.type === 'input' 
    ? nodeScreenX  // Left edge
    : nodeScreenX + nodeWidth;  // Right edge
  
  // Port Y: Calculate based on port index and node header height
  const headerHeight = 32;
  const portSpacing = 24;
  const portIndex = getPortIndex(node, port);  // 0-based index
  const portY = nodeScreenY + headerHeight + (portIndex * portSpacing) + (portSpacing / 2);
  
  return { x: portX, y: portY };
}
```

---

## Connection Hit Testing

### Cable Click Detection

**Problem:** Detect if mouse clicked on a bezier curve (cable).

**Solution:** Test distance from point to bezier curve.

**Algorithm:**
1. For each connection, get bezier curve points
2. Sample curve at multiple points (e.g., 20 samples)
3. Calculate distance from mouse to each sample point
4. If minimum distance < threshold (e.g., 5px), connection is hit

**Implementation:**
```typescript
function isConnectionHit(
  mouseX: number,
  mouseY: number,
  connection: Connection,
  sourcePort: { x: number, y: number },
  targetPort: { x: number, y: number },
  hitThreshold: number = 5
): boolean {
  // Bezier control points
  const cp1X = sourcePort.x + 50;  // 50px horizontal offset
  const cp1Y = sourcePort.y;
  const cp2X = targetPort.x - 50;
  const cp2Y = targetPort.y;
  
  // Sample curve at 20 points
  const samples = 20;
  let minDistance = Infinity;
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point = bezierPoint(
      sourcePort.x, sourcePort.y,
      cp1X, cp1Y,
      cp2X, cp2Y,
      targetPort.x, targetPort.y,
      t
    );
    
    const dx = mouseX - point.x;
    const dy = mouseY - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    minDistance = Math.min(minDistance, distance);
  }
  
  return minDistance < hitThreshold;
}

function bezierPoint(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  t: number
): { x: number, y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  
  return {
    x: uuu * x0 + 3 * uu * t * x1 + 3 * u * tt * x2 + ttt * x3,
    y: uuu * y0 + 3 * uu * t * y1 + 3 * u * tt * y2 + ttt * y3
  };
}
```

**Optimization:** Only test connections visible in viewport.

---

## Parameter Drag Calculation

### Drag Sensitivity Formula

**Base Formula:**
```
valueChange = (pixelDeltaY / sensitivity) * range
```

**Sensitivity Calculation:**
```typescript
function calculateDragSensitivity(
  paramMin: number,
  paramMax: number,
  modifier: 'normal' | 'fine' | 'coarse' = 'normal'
): number {
  const range = paramMax - paramMin;
  const baseSensitivity = 100;  // pixels per full range
  
  const multipliers = {
    'normal': 1.0,
    'fine': 0.1,      // Shift key
    'coarse': 10.0    // Ctrl/Cmd key
  };
  
  return baseSensitivity / multipliers[modifier];
}
```

### Drag Value Update

**Implementation:**
```typescript
function updateParameterValue(
  currentValue: number,
  pixelDeltaY: number,  // Negative = up (increase), Positive = down (decrease)
  paramMin: number,
  paramMax: number,
  modifier: 'normal' | 'fine' | 'coarse'
): number {
  const sensitivity = calculateDragSensitivity(paramMin, paramMax, modifier);
  const range = paramMax - paramMin;
  
  // Invert deltaY: up (negative) = increase, down (positive) = decrease
  const valueDelta = (-pixelDeltaY / sensitivity) * range;
  const newValue = currentValue + valueDelta;
  
  // Clamp to range
  return Math.max(paramMin, Math.min(paramMax, newValue));
}
```

**Example:**
- Parameter range: 0.0 - 1.0
- Current value: 0.5
- Drag up 10 pixels (pixelDeltaY = -10)
- Normal sensitivity: 100 pixels = full range
- Value change: (-(-10) / 100) * 1.0 = 0.1
- New value: 0.5 + 0.1 = 0.6

---

## Bezier Curve Rendering

### Connection Cable Rendering

**Bezier Control Points:**
```typescript
function getBezierControlPoints(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number
): { cp1X: number, cp1Y: number, cp2X: number, cp2Y: number } {
  const offset = 50;  // Horizontal offset in pixels
  
  return {
    cp1X: sourceX + offset,
    cp1Y: sourceY,
    cp2X: targetX - offset,
    cp2Y: targetY
  };
}
```

**Rendering:**
```typescript
function renderBezierCurve(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  width: number = 2,
  color: string = '#999999'
): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
```

---

## Node Overlap Detection

### Node Collision Detection

**Purpose:** Prevent nodes from overlapping (optional feature, or for auto-layout).

**Algorithm:**
```typescript
function nodesOverlap(
  node1: NodeInstance,
  node2: NodeInstance,
  nodeWidth: number = 200,
  nodeHeight: number = 100
): boolean {
  const x1 = node1.position.x;
  const y1 = node1.position.y;
  const x2 = node2.position.x;
  const y2 = node2.position.y;
  
  return !(
    x1 + nodeWidth < x2 ||
    x2 + nodeWidth < x1 ||
    y1 + nodeHeight < y2 ||
    y2 + nodeHeight < y1
  );
}
```

**Note:** Overlap is allowed in v1.0, but detection may be useful for future features.

---

## Context Menu Structure

### Right-Click Context Menu

**Menu Structure:**
```
┌─────────────────────────────┐
│ Create Node                 │
├─────────────────────────────┤
│ Input                       │
│   UV Coordinates            │
│   Time                      │
│   Resolution                │
│   Constant Float            │
│   ...                       │
├─────────────────────────────┤
│ Transform                   │
│   Polar Coordinates         │
│   Vortex                    │
│   ...                       │
├─────────────────────────────┤
│ Generator                   │
│   fBm Noise                 │
│   Voronoi Noise             │
│   ...                       │
├─────────────────────────────┤
│ Operation                   │
│   Add                       │
│   Multiply                  │
│   ...                       │
├─────────────────────────────┤
│ [Separator]                 │
│ Paste                       │
│ Select All                  │
└─────────────────────────────┘
```

**Implementation:**
- Show menu at mouse cursor position
- Group nodes by category (from Node Specification)
- Sort categories: Input, Transform, Generator, Operation, Blend, Mask, Post-Process, Output
- Sort nodes within category alphabetically

---

## Search Dialog Structure

### Node Search Dialog

**Layout:**
```
┌─────────────────────────────────────┐
│ Create Node                    [×]  │
├─────────────────────────────────────┤
│ [Search input...]                   │
├─────────────────────────────────────┤
│ Results:                            │
│                                     │
│ • fBm Noise                         │
│   Generator - Fractal Brownian...  │
│                                     │
│ • fBm Value Noise                   │
│   Generator - Value-based fBm...   │
│                                     │
└─────────────────────────────────────┘
```

**Search Algorithm:**
1. Filter nodes by search term (case-insensitive)
2. Match in: node name, description, category
3. Sort by: exact name match first, then relevance
4. Limit results: Show top 20 matches

**Keyboard Navigation:**
- `Arrow Up/Down`: Navigate results
- `Enter`: Create selected node
- `Esc`: Close dialog

---

## Corner Widget Resize

### Resize Handles

**Handle Locations:**
- **Corners**: 8px × 8px squares at each corner
- **Edges**: 4px wide strips along each edge

**Resize Behavior:**
```typescript
function handleCornerWidgetResize(
  widget: CornerWidget,
  mouseX: number,
  mouseY: number,
  resizeHandle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
): void {
  const minWidth = 160;
  const minHeight = 120;
  const maxWidth = window.innerWidth * 0.5;
  const maxHeight = window.innerHeight * 0.5;
  
  let newWidth = widget.width;
  let newHeight = widget.height;
  let newX = widget.x;
  let newY = widget.y;
  
  switch (resizeHandle) {
    case 'se':  // Bottom-right corner
      newWidth = Math.max(minWidth, Math.min(maxWidth, mouseX - widget.x));
      newHeight = Math.max(minHeight, Math.min(maxHeight, mouseY - widget.y));
      break;
    case 'sw':  // Bottom-left corner
      const deltaX = widget.x + widget.width - mouseX;
      newWidth = Math.max(minWidth, Math.min(maxWidth, deltaX));
      newHeight = Math.max(minHeight, Math.min(maxHeight, mouseY - widget.y));
      newX = widget.x + widget.width - newWidth;
      break;
    case 'ne':  // Top-right corner
      const deltaY = widget.y + widget.height - mouseY;
      newWidth = Math.max(minWidth, Math.min(maxWidth, mouseX - widget.x));
      newHeight = Math.max(minHeight, Math.min(maxHeight, deltaY));
      newY = widget.y + widget.height - newHeight;
      break;
    case 'nw':  // Top-left corner
      const deltaXNW = widget.x + widget.width - mouseX;
      const deltaYNW = widget.y + widget.height - mouseY;
      newWidth = Math.max(minWidth, Math.min(maxWidth, deltaXNW));
      newHeight = Math.max(minHeight, Math.min(maxHeight, deltaYNW));
      newX = widget.x + widget.width - newWidth;
      newY = widget.y + widget.height - newHeight;
      break;
    case 'e':  // Right edge
      newWidth = Math.max(minWidth, Math.min(maxWidth, mouseX - widget.x));
      break;
    case 'w':  // Left edge
      const deltaXW = widget.x + widget.width - mouseX;
      newWidth = Math.max(minWidth, Math.min(maxWidth, deltaXW));
      newX = widget.x + widget.width - newWidth;
      break;
    case 's':  // Bottom edge
      newHeight = Math.max(minHeight, Math.min(maxHeight, mouseY - widget.y));
      break;
    case 'n':  // Top edge
      const deltaYN = widget.y + widget.height - mouseY;
      newHeight = Math.max(minHeight, Math.min(maxHeight, deltaYN));
      newY = widget.y + widget.height - newHeight;
      break;
  }
  
  widget.width = newWidth;
  widget.height = newHeight;
  widget.x = newX;
  widget.y = newY;
}
```

---

## Debouncing Parameter Updates

### Parameter Update Strategy

**Problem:** Rapid parameter updates during drag can cause performance issues.

**Solution:** Debounce updates to shader compilation, but update UI immediately.

**Algorithm:**
```typescript
let parameterUpdateTimeout: number | null = null;
const DEBOUNCE_DELAY = 100;  // milliseconds

function onParameterDrag(value: number): void {
  // Update UI immediately (no debounce)
  updateParameterUI(value);
  
  // Debounce shader compilation
  if (parameterUpdateTimeout) {
    clearTimeout(parameterUpdateTimeout);
  }
  
  parameterUpdateTimeout = setTimeout(() => {
    compileShader();
    parameterUpdateTimeout = null;
  }, DEBOUNCE_DELAY);
}
```

**Note:** UI updates are immediate for responsiveness. Only shader compilation is debounced.

---

## Z-Index and Layering

### Element Layering Order

**From Bottom to Top:**
1. Canvas background
2. Grid
3. Connection cables (behind nodes)
4. Nodes
5. Selection highlights
6. Dragging connection (temporary cable)
7. Context menu / dialogs
8. Corner widget (when collapsed)

**Z-Index Values:**
- Canvas: `z-index: 0`
- Connections: `z-index: 1`
- Nodes: `z-index: 2`
- Selection: `z-index: 3`
- Dragging: `z-index: 4`
- Menus: `z-index: 100`
- Corner widget: `z-index: 50`

---

## Implementation Notes

### Technology Recommendations

- **Canvas**: Use HTML5 Canvas or WebGL for node editor
- **Rendering**: Consider libraries like React Flow, Cytoscape.js, or custom
- **State Management**: Use state management library (Redux, Zustand, etc.)
- **Undo/Redo**: Use library like Immer with history

### Accessibility

- **Keyboard Navigation**: All actions accessible via keyboard
- **Screen Readers**: Proper ARIA labels
- **Color Contrast**: Meet WCAG AA standards
- **Focus Indicators**: Clear focus states

### Testing Requirements

- **Unit Tests**: Graph operations, compilation
- **Integration Tests**: UI interactions, state management
- **Performance Tests**: Large graph handling
- **Visual Tests**: Rendering accuracy

---

**End of Specification**
