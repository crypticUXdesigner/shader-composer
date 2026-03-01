/**
 * Generate favicon assets from a single source image.
 *
 * Reads public/favicon/favicon.png and writes recommended sizes and formats
 * for browser tabs, bookmarks, Apple touch icon, and PWA.
 *
 * Run: npm run build-favicons (or pnpm run build-favicons)
 * Output: public/favicon/favicon-*.png, apple-touch-icon.png, icon-*.png
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');
const FAVICON_DIR = join(PROJECT_ROOT, 'public', 'favicon');
const SOURCE_PATH = join(FAVICON_DIR, 'favicon.png');

/** Recommended sizes: [width, height, filename] */
const OUTPUTS: [number, number, string][] = [
  [16, 16, 'favicon-16x16.png'],
  [32, 32, 'favicon-32x32.png'],
  [48, 48, 'favicon-48x48.png'],
  [180, 180, 'apple-touch-icon.png'],
  [192, 192, 'icon-192x192.png'],
  [512, 512, 'icon-512x512.png'],
];

async function main(): Promise<void> {
  if (!existsSync(SOURCE_PATH)) {
    console.error(`Source image not found: ${SOURCE_PATH}`);
    process.exit(1);
  }

  let sharp: typeof import('sharp');
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('Missing dependency: run npm install sharp --save-dev');
    process.exit(1);
  }

  if (!existsSync(FAVICON_DIR)) {
    mkdirSync(FAVICON_DIR, { recursive: true });
  }

  const buffer = readFileSync(SOURCE_PATH);
  const pipeline = sharp(buffer);

  for (const [width, height, filename] of OUTPUTS) {
    const outPath = join(FAVICON_DIR, filename);
    await pipeline
      .clone()
      .resize(width, height)
      .png()
      .toFile(outPath);
    console.log(`Wrote ${outPath} (${width}x${height})`);
  }

  console.log(`Done. Generated ${OUTPUTS.length} favicon assets in public/favicon/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
