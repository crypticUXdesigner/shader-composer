/**
 * Opt-in WebGL vs WebGPU pixel parity for MVP fixture graphs (not a CI gate).
 *
 * Prerequisite: `npm run build` (uses `vite preview`).
 * Or set PREVIEW_URL to an already-running dev/preview server (must serve this repo with base /ShaderNoice/).
 *
 * Usage:
 *   npx tsx scripts/webgpu-golden-parity.ts
 *   PREVIEW_URL=http://127.0.0.1:3000/ShaderNoice/ npx tsx scripts/webgpu-golden-parity.ts
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';

const BASE_PATH = '/ShaderNoice/';
const LOCAL_URL_RE = /Local:\s*https?:\/\/[^:\s]+:(\d+)/;
const ANY_URL_RE = /https?:\/\/[^:\s]+:(\d+)\//;
const WAIT_MS = 300;
const WAIT_MAX_ATTEMPTS = 100;
const DEFAULT_PORT_TIMEOUT_MS = 30_000;

type GoldenRunResult = {
  fixtureId: string;
  pass: boolean;
  metrics?: { rms: number };
  rmsMax?: number;
  skipped?: string;
  webgpuError?: string;
  diffDataUrl?: string;
  diagnostics?: string;
};

type WebGpuAdapterProbe = {
  hasNavigatorGpu: boolean;
  adapterAvailable: boolean;
  error?: string;
};

function isEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
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

async function runAgainstBase(appBaseUrl: string): Promise<void> {
  const { chromium } = await import('playwright');
  const origin = new URL(appBaseUrl).origin;
  const harnessUrl = `${origin}${BASE_PATH}webgpu-golden-harness.html`;

  const headlessEnv = process.env.WEBGPU_GOLDEN_HEADLESS?.trim();
  const headless = headlessEnv == null || headlessEnv === '' ? true : !(headlessEnv === '0' || headlessEnv === 'false');
  const extraArgs = (process.env.WEBGPU_GOLDEN_CHROMIUM_ARGS ?? '')
    .split(/\s+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  // Note: WebGPU support in headless Chromium varies by platform/driver.
  // We enable it when possible, but the harness remains opt-in and should not fail
  // just because WebGPU isn't available in this environment.
  const browser = await chromium.launch({
    headless,
    args: ['--enable-unsafe-webgpu', ...extraArgs],
  });
  browser.on('disconnected', () => {
    console.error('[playwright] browser disconnected');
  });
  try {
    const page = await browser.newPage();
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.trim().length === 0) return;
      console.log(`[browser:${msg.type()}] ${text}`);
    });
    page.on('pageerror', (err) => {
      console.error(`[browser:pageerror] ${err.stack ?? err.message}`);
    });
    page.on('crash', () => {
      console.error('[playwright] page crashed');
    });
    page.on('close', () => {
      console.error('[playwright] page closed');
    });

    if (isEnabled(process.env.WEBGPU_GOLDEN_FORCE_SRGB)) {
      await page.addInitScript(() => {
        (window as unknown as { __webgpuForceSrgbPresentation?: boolean }).__webgpuForceSrgbPresentation = true;
      });
      console.log('WebGPU golden: forcing sRGB WebGPU formats for this run.');
    }

    console.log(`Opening WebGPU golden harness: ${harnessUrl}`);
    await page.goto(harnessUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Waiting for WebGPU golden harness readiness...');
    await page.waitForFunction(() => (window as unknown as { __WEBGPU_GOLDEN_READY?: boolean }).__WEBGPU_GOLDEN_READY === true, {
      timeout: 60000
    });

    const adapterProbe = (await page.evaluate(async (): Promise<WebGpuAdapterProbe> => {
      const gpu = (navigator as unknown as { gpu?: GPU }).gpu;
      if (!gpu) return { hasNavigatorGpu: false, adapterAvailable: false };
      try {
        const adapter = await gpu.requestAdapter();
        return { hasNavigatorGpu: true, adapterAvailable: adapter != null };
      } catch (e) {
        return { hasNavigatorGpu: true, adapterAvailable: false, error: e instanceof Error ? e.message : String(e) };
      }
    })) as WebGpuAdapterProbe;

    if (!adapterProbe.adapterAvailable) {
      const reason = adapterProbe.hasNavigatorGpu
        ? `requestAdapter returned null${adapterProbe.error ? ` (${adapterProbe.error})` : ''}`
        : 'navigator.gpu missing';
      console.log(`WebGPU unavailable in this environment (${reason}). Exit 0 for optional harness.`);
      return;
    }

    console.log('Running WebGPU golden parity fixtures...');
    const results = (await page.evaluate(async () => {
      const api = (window as unknown as { __webgpuGolden?: { runAll: () => Promise<GoldenRunResult[]> } }).__webgpuGolden;
      if (!api) throw new Error('__webgpuGolden API missing');
      return api.runAll();
    })) as GoldenRunResult[];

    console.log('WebGPU golden parity results:');
    for (const r of results) {
      const line =
        `[${r.fixtureId}] ${r.pass ? 'PASS' : 'FAIL'} RMS=${r.metrics?.rms?.toFixed?.(3) ?? 'n/a'} (max ${r.rmsMax ?? 'n/a'})` +
        (r.skipped ? ` skipped=${r.skipped}` : '') +
        (r.webgpuError ? ` webgpu=${r.webgpuError}` : '') +
        (r.diagnostics ? ` ${r.diagnostics}` : '');
      console.log(line);
    }

    const diffDir = path.join(process.cwd(), 'webgpu-golden-diff');
    let wroteDiff = false;
    for (const r of results) {
      if (r.pass || !r.diffDataUrl) continue;
      if (!fs.existsSync(diffDir)) fs.mkdirSync(diffDir, { recursive: true });
      const m = /^data:image\/png;base64,(.+)$/.exec(r.diffDataUrl);
      if (m) {
        const outPath = path.join(diffDir, `diff-${r.fixtureId}.png`);
        fs.writeFileSync(outPath, Buffer.from(m[1], 'base64'));
        console.error(`Wrote diff image: ${outPath}`);
        wroteDiff = true;
      }
    }

    const parityFailed = results.some((r) => !r.pass && !r.skipped && !r.webgpuError);
    const webgpuUnavailable =
      !results.some((r) => r.pass) &&
      results.some((r) => (r.webgpuError ?? '').includes('WebGPU program was not installed')) &&
      results.some((r) => (r.skipped ?? '').includes('requestAdapter.null'));

    if (parityFailed) {
      console.error('Parity check failed (RMS above threshold). See diff images under webgpu-golden-diff/ when produced.');
      process.exit(1);
    }

    if (webgpuUnavailable) {
      console.log('WebGPU unavailable in this environment (adapter/device missing). Exit 0 for optional harness.');
    } else if (!results.some((r) => r.pass) && results.some((r) => r.webgpuError || r.skipped)) {
      console.log('No passing fixtures (WebGPU or compile unavailable). Exit 0 for optional harness.');
    } else if (wroteDiff) {
      console.log('Wrote one or more diff images under webgpu-golden-diff/ (investigate if unexpected).');
    }
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const existingUrl = process.env.PREVIEW_URL?.trim();
  if (existingUrl) {
    const origin = new URL(existingUrl).origin;
    await waitForUrl(`${origin}${BASE_PATH}`);
    await runAgainstBase(existingUrl);
    return;
  }

  // Ensure `dist/` is up to date. `vite preview` serves the built output only.
  const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  const build = spawn(process.execPath, [viteBin, 'build'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  const buildExitCode: number = await new Promise((resolve) => {
    build.on('close', (code) => resolve(code ?? 1));
    build.on('error', () => resolve(1));
  });
  if (buildExitCode !== 0) {
    process.exit(buildExitCode);
  }

  const preview = spawn(process.execPath, [viteBin, 'preview'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' }
  });

  const exit = (code: number): void => {
    preview.kill('SIGTERM');
    process.exit(code);
  };

  preview.on('error', (err) => {
    console.error('Failed to start preview server:', err);
    exit(1);
  });

  const { getPort, getRecentOutput } = attachPortSniffer(preview);

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

  await new Promise((r) => setTimeout(r, 3000));

  const appUrl = `http://localhost:${resolvedPort}${BASE_PATH}`;
  try {
    await waitForUrl(appUrl);
  } catch (err) {
    console.error('Preview server did not become ready:', (err as Error).message);
    exit(1);
  }

  try {
    await runAgainstBase(`http://localhost:${resolvedPort}/`);
  } catch (err) {
    console.error('Golden parity run failed:', err);
    exit(1);
  }

  exit(0);
}

main();
