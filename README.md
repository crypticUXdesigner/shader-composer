# Shader Composer

A web-based node-based shader editor for creating procedural shader art using WebGL. Build complex shader graphs by connecting nodes visually.

> **⚠️ Prototype Status:** This is an early prototype version. The application is functional but features and APIs are subject to change. Some functionality may be incomplete or experimental.

🌐 **[Live Demo](https://crypticUXdesigner.github.io/shader-composer/)**

## Features

- **Node-Based Editor**: Visual node graph editor for composing shaders
- **Real-time Preview**: Live preview of shader output as you build
- **Rich Node Library**: 90+ nodes including noise generators, transforms, blending modes, post-processing effects, and more
- **Preset System**: Save and load shader graphs as presets
- **Export System**: Export images at custom resolutions (PNG, JPEG, WebP)
- **Undo/Redo**: Full undo/redo support for all operations
- **Copy/Paste**: Copy and paste nodes between graphs
- **Parameter Controls**: Intuitive draggable parameter controls with real-time updates

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

## Usage

### Creating a Shader

1. **Add Nodes**: Use the side panel to browse and add nodes by dragging them onto the canvas
2. **Connect Nodes**: Drag from output ports to input ports to create connections
3. **Adjust Parameters**: Click on nodes to expand parameter controls, then drag sliders to adjust values
4. **Preview**: The shader preview updates in real-time as you make changes
5. **Save Preset**: Use "Copy Preset" to copy your graph as JSON, then save it in `src/presets/`
6. **Export Image**: Click "Export Image" to save your creation at custom resolutions

### Keyboard Shortcuts

- `Delete` / `Backspace` - Delete selected nodes
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Shift + Z` - Redo
- `Ctrl/Cmd + C` - Copy selected nodes
- `Ctrl/Cmd + V` - Paste nodes
- `Ctrl/Cmd + A` - Select all nodes
- `Ctrl/Cmd + D` - Duplicate selected nodes

## Project Structure

```
src/
├── data-model/            # Graph data structures, validation, serialization
├── shaders/
│   ├── elements/          # Visual element node definitions
│   ├── nodes/             # System nodes (math, blending, transforms, etc.)
│   └── NodeShaderCompiler.ts  # Compiles node graphs to GLSL
├── runtime/               # WebGL runtime, shader execution, uniform management
├── ui/
│   └── components/        # Node editor UI components
├── presets/               # Preset shader graphs
├── utils/                 # Utilities (export, presets, serialization)
└── main.ts                # Main application entry point
```

## Tech Stack

- **TypeScript** - Type-safe development
- **Svelte 5** - Component framework and reactivity (editor UI)
- **Vite** - Fast build tool and dev server
- **WebGL** - GPU-accelerated shader rendering
- **GLSL** - Shader programming language
- **Phosphor Icons** - Icon library

## Environment variables

Optional variables (copy `.env.example` to `.env` and edit as needed). **Do not commit `.env`** — it is gitignored; it may contain tokens (e.g. `VITE_AUDIOTOOL_API_TOKEN`) and should stay local.

| Variable | Description |
|----------|-------------|
| `VITE_AUDIOGRAPH_API_URL` | Optional. Base URL for the Audiograph RPC (default: `https://rpc.audiotool.com`). The mini timeline calls `POST {baseUrl}/audiotool.audiograph.v1.AudiographService/GetAudiographs` with `resource_names`, `resolution`, `channels`. Override only if using a different host or proxy. |
| `VITE_AUDIOTOOL_API_TOKEN` | Optional. Bearer token sent as `Authorization: Bearer <token>` when set. Required only if rpc.audiotool.com demands auth for your origin. |

### Config scope (public vs private)

All variables above are **client-side**: Vite inlines `VITE_*` (and `BASE_URL`) at build time, so they appear in the client bundle and are visible to anyone who inspects the app. **Tokens** (e.g. `VITE_AUDIOTOOL_API_TOKEN`) must not be committed; use a local `.env` (gitignored) and never put real secrets in `.env.example`.

If a **backend or server-side build** is added later, keep server-only config (secrets, internal API keys) **out of the client**: do not prefix them with `VITE_`, do not add them to `.env.example`, and do not expose them to the client bundle.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run Vitest test suite
- `npm run lint` - Run ESLint on TypeScript and Svelte sources
- `npm run check` - Run type-check, tests, and lint (pre-commit gate)
- `npm run preview` - Preview production build locally
- `npm run a11y` - Run automated accessibility checks (axe-core, WCAG 2 A/AA) on the main route. Requires `npm run build` first; optionally set `PREVIEW_URL` if the preview server is already running. See [docs/projects/quality-review-remediation/a11y-baseline.md](docs/projects/quality-review-remediation/a11y-baseline.md).

### Building

```bash
npm run build
```

The build output will be in the `dist/` directory, ready for deployment.

## Contributors

See [docs/onboarding-checklist.md](docs/onboarding-checklist.md) for a short checklist: clone, run dev, run `npm run check` before commit, and where to find user-goals, rules, and work packages.

## Deployment

This project is automatically deployed to GitHub Pages via GitHub Actions when changes are pushed to the `main` branch. The deployment workflow:

1. Builds the project using `npm run build`
2. Runs automated accessibility checks (axe-core on the main route)
3. Deploys the `dist/` directory to GitHub Pages
3. Available at: `https://crypticUXdesigner.github.io/shader-composer/`

## License

All Rights Reserved. Unauthorized copying, modification, distribution, or use of this software is strictly prohibited.

