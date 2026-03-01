/**
 * Main entry point for Node-Based Shader Composer
 *
 * Svelte 5 Migration WP 06: Mount App.svelte, load icons, handle HMR.
 */

import { mount, unmount } from 'svelte';
import { onCLS, onINP, onLCP } from 'web-vitals';
import App from './lib/App.svelte';
import { loadPhosphorIconData } from './utils/phosphor-icons-loader';

function reportWebVitals(metric: { name: string; value: number; id: string }): void {
  if (import.meta.env.DEV) {
    console.log(`[web-vitals] ${metric.name}:`, metric.value, metric.id);
  }
  // Production: no-op; hook is in place for future RUM if needed.
}

const APP_MOUNTED_KEY = '__shaderComposerAppMounted';

let appInstance: ReturnType<typeof mount> | null = null;

async function bootstrap(): Promise<void> {
  const hot = typeof import.meta !== 'undefined' && import.meta.hot;
  const hotData = hot ? (import.meta.hot!.data as Record<string, unknown>) : undefined;

  if (hotData?.shaderComposerBooted === true) {
    return;
  }
  const alreadyMounted =
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>)[APP_MOUNTED_KEY] === true;
  if (alreadyMounted) {
    return;
  }

  await loadPhosphorIconData();

  const main = document.getElementById('main');
  if (!main) {
    throw new Error('Main container not found');
  }

  main.innerHTML = '';
  (window as unknown as Record<string, unknown>)[APP_MOUNTED_KEY] = true;
  if (hotData) hotData.shaderComposerBooted = true;

  appInstance = mount(App, { target: main });

  if (hot) {
    import.meta.hot!.accept();
    import.meta.hot!.dispose(() => {
      if (appInstance) unmount(appInstance);
      appInstance = null;
      (window as unknown as Record<string, unknown>)[APP_MOUNTED_KEY] = false;
      if (hotData) hotData.shaderComposerBooted = false;
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootstrap());
} else {
  bootstrap();
}

// Performance baseline: report Core Web Vitals (dev: console; prod: no-op).
onCLS(reportWebVitals);
onLCP(reportWebVitals);
onINP(reportWebVitals);
