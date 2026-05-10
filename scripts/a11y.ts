/**
 * Automated accessibility check for the main app route.
 * Starts the preview server, runs axe-core (WCAG 2 Level A/AA), and fails on serious/critical violations.
 *
 * Prerequisite: run `npm run build` first (or rely on CI having already built).
 * Usage: npx tsx scripts/a11y.ts
 *
 * See docs/implementation/a11y-baseline.md for known acceptable issues.
 */

import { spawn } from 'node:child_process';
import * as http from 'node:http';
import * as path from 'node:path';

const BASE_PATH = '/ShaderNoice/';
const WAIT_MS = 300;
const WAIT_MAX_ATTEMPTS = 100;
const DEFAULT_PORT_TIMEOUT_MS = 30_000;

/** Match "Local:   http://localhost:4173/..." or "➜  Local:   http://localhost:4177/ShaderNoice/" */
const LOCAL_URL_RE = /Local:\s*https?:\/\/[^:\s]+:(\d+)/;
const ANY_URL_RE = /https?:\/\/[^:\s]+:(\d+)\//;

function getPortTimeoutMs(): number {
  const raw = process.env.PREVIEW_PORT_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_PORT_TIMEOUT_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PORT_TIMEOUT_MS;
}

function attachPortSniffer(preview: ReturnType<typeof spawn>): {
  getPort: () => number | null;
  getRecentOutput: () => string;
} {
  let resolvedPort: number | null = null;
  let recentOutput = '';
  const MAX_RECENT = 16_000;

  const ingest = (chunk: Buffer): void => {
    const text = chunk.toString();
    recentOutput += text;
    if (recentOutput.length > MAX_RECENT) recentOutput = recentOutput.slice(-MAX_RECENT);

    // Vite output can be chunked mid-line (especially on Windows), so match against
    // the accumulated tail buffer instead of only the current chunk.
    const mLocal = recentOutput.match(LOCAL_URL_RE);
    if (mLocal) {
      resolvedPort = parseInt(mLocal[1], 10);
      return;
    }
    const mAny = recentOutput.match(ANY_URL_RE);
    if (mAny) resolvedPort = parseInt(mAny[1], 10);
  };

  preview.stdout?.on('data', ingest);
  preview.stderr?.on('data', ingest);

  return {
    getPort: () => resolvedPort,
    getRecentOutput: () => recentOutput,
  };
}

function waitForUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tryFetch = (): void => {
      attempts++;
      const req = http.get(url, (res) => {
        if (res.statusCode !== undefined && res.statusCode < 500) {
          resolve();
          return;
        }
        if (attempts >= WAIT_MAX_ATTEMPTS) {
          reject(new Error(`URL did not respond with OK after ${WAIT_MAX_ATTEMPTS} attempts`));
          return;
        }
        setTimeout(tryFetch, WAIT_MS);
      });
      req.on('error', () => {
        if (attempts >= WAIT_MAX_ATTEMPTS) {
          reject(new Error(`URL ${url} did not become ready after ${WAIT_MAX_ATTEMPTS} attempts`));
          return;
        }
        setTimeout(tryFetch, WAIT_MS);
      });
    };
    tryFetch();
  });
}

function runA11yFromUrl(appUrl: string): Promise<void> {
  return runA11yInternal(appUrl);
}

async function runA11y(port: number): Promise<void> {
  const appUrl = `http://localhost:${port}${BASE_PATH}`;
  return runA11yInternal(appUrl);
}

async function runA11yInternal(appUrl: string): Promise<void> {
  const { chromium } = await import('playwright');
  const AxeBuilder = (await import('@axe-core/playwright')).default;

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const builder = new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa']);
    const results = await builder.analyze();

    const seriousOrCritical = (results.violations ?? []).filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (seriousOrCritical.length > 0) {
      const baseline = await loadBaselineRuleIds();
      const unresolved = seriousOrCritical.filter(
        (v) => !baseline.has(v.id)
      );
      if (unresolved.length > 0) {
        console.error('Accessibility violations (serious/critical):');
        for (const v of unresolved) {
          console.error(`  [${v.impact}] ${v.id}: ${v.help}`);
          for (const n of v.nodes ?? []) {
            console.error(`    - ${n.html?.slice(0, 80)}...`);
          }
        }
        console.error('\nSee docs/implementation/a11y-baseline.md for baselined issues.');
        process.exit(1);
      }
    }
  } finally {
    await browser.close();
  }
}

/** Load rule IDs that are documented as acceptable (baseline). */
async function loadBaselineRuleIds(): Promise<Set<string>> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const baselinePath = path.join(
    process.cwd(),
    'docs/implementation/a11y-baseline.md'
  );
  if (!fs.existsSync(baselinePath)) return new Set();
  const content = fs.readFileSync(baselinePath, 'utf-8');
  const ids = new Set<string>();
  const ruleIdLine = /^-\s*`?([a-z0-9-]+)`?/im;
  for (const line of content.split('\n')) {
    const m = line.match(ruleIdLine);
    if (m) ids.add(m[1]);
  }
  return ids;
}

async function main(): Promise<void> {
  const existingUrl = process.env.PREVIEW_URL;
  if (existingUrl) {
    const url = existingUrl.replace(/\/$/, '') + '/';
    try {
      await runA11yFromUrl(url);
    } catch (err) {
      console.error('A11y check failed:', err);
      process.exit(1);
    }
    return;
  }

  const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  const preview = spawn(
    process.execPath,
    [viteBin, 'preview'],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    }
  );

  const exit = (code: number): void => {
    preview.kill('SIGTERM');
    process.exit(code);
  };

  preview.on('error', (err) => {
    console.error('Failed to start preview server:', err);
    exit(1);
  });

  const { getPort, getRecentOutput } = attachPortSniffer(preview);

  // Wait until we see the Local URL in stdout/stderr, then wait for that port
  const portTimeoutMs = getPortTimeoutMs();
  const deadline = Date.now() + portTimeoutMs;
  while (Date.now() < deadline) {
    const port = getPort();
    if (port != null) break;
    await new Promise((r) => setTimeout(r, WAIT_MS));
  }
  const resolvedPort = getPort();
  if (resolvedPort == null) {
    console.error(`Preview server did not report a port in time (timeout ${portTimeoutMs}ms).`);
    const out = getRecentOutput().trim();
    if (out) {
      console.error('\n--- preview output (tail) ---\n');
      console.error(out);
      console.error('\n--- end preview output ---\n');
    }
    exit(1);
  }

  const port = resolvedPort!;

  // Give the server time to start listening after printing the URL (can be delayed on Windows)
  await new Promise((r) => setTimeout(r, 3000));

  const appUrl = `http://localhost:${port}${BASE_PATH}`;
  try {
    await waitForUrl(appUrl);
  } catch (err) {
    console.error('Preview server did not become ready:', (err as Error).message);
    exit(1);
  }

  try {
    await runA11y(port);
  } catch (err) {
    console.error('A11y check failed:', err);
    exit(1);
  }

  exit(0);
}

main();
