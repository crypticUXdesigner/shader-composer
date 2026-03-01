# Public Assets Folder

This folder contains static assets that are served at the root path.

## Audio Files

Place your audio files (MP3) here to make them available to the app’s audio system.

- Audio playback, bands, and remapping are configured via the audio panel (audioSetup), not visual nodes.
- Files in this folder are served as static assets and can be referenced by `filePath` in audioSetup or playlist entries.

### Path Notes

- Files in this folder are served at the root path `/`
- If your Vite config has a `base` path (like `/shader-composer/`), you may need to include it in the path
- For development: use `/filename.mp3`
- For production with base path: use `/shader-composer/filename.mp3` or use a relative path

### Automatic Loading

Files referenced by the audio setup (e.g. playlist entries or primary source) will be loaded by the audio runtime when needed, subject to browser autoplay policies.
