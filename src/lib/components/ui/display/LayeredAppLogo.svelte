<script lang="ts">
  /**
   * Mask-based ShaderNoice mark (same assets as {@link AppSplashScreen}).
   * `full` matches splash size; `compact` for inline / help surfaces.
   */
  interface Props {
    variant?: 'full' | 'compact';
    class?: string;
  }

  let { variant = 'full', class: className }: Props = $props();

  const baseUrl = import.meta.env.BASE_URL;
  const layeredLogo = {
    layer1: `${baseUrl}app-logo/layer1-badge.webp`,
    shapeMask: `${baseUrl}app-logo/shape-mask.webp`,
    patternMask: `${baseUrl}app-logo/pattern-mask.webp`,
    layer3: `${baseUrl}app-logo/layer3-content.webp`,
  } as const;

  let reduceMotion = $state(false);
  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = mq.matches;
    const handler = (): void => {
      reduceMotion = mq.matches;
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  const isCompact = $derived(variant === 'compact');
  /** Compact mark: slightly slower loops than splash so motion stays readable in a small panel. */
  const motionClass = $derived.by(() => {
    if (reduceMotion) return 'is-reduced-motion';
    return isCompact ? 'is-compact-motion' : 'is-full-motion';
  });
</script>

<div
  class="layered-app-logo layered-app-logo--{variant} {motionClass} {className ?? ''}"
  aria-hidden="true"
  style:--layered-logo-layer1-url={`url("${layeredLogo.layer1}")`}
  style:--layered-logo-shape-mask-url={`url("${layeredLogo.shapeMask}")`}
  style:--layered-logo-pattern-mask-url={`url("${layeredLogo.patternMask}")`}
  style:--layered-logo-layer3-url={`url("${layeredLogo.layer3}")`}
>
  <div class="layered-app-logo__stack">
    <div class="layered-app-logo__layer layered-app-logo__layer--badge"></div>

    <div class="layered-app-logo__layer layered-app-logo__layer--shape-clip">
      <div class="layered-app-logo__pattern"></div>
    </div>

    <div class="layered-app-logo__layer layered-app-logo__layer--shape-clip">
      <div class="layered-app-logo__pattern-mask">
        <div class="layered-app-logo__content"></div>
      </div>
    </div>
  </div>
</div>

<style>
  .layered-app-logo {
    position: relative;
    flex-shrink: 0;
    border-radius: var(--radius-md);
  }

  .layered-app-logo--full {
    width: 120px;
    height: 120px;
  }

  .layered-app-logo--compact {
    width: 64px;
    height: 64px;
  }

  .layered-app-logo__stack {
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: inherit;
    filter: drop-shadow(0 0 7px color-mix(in srgb, var(--color-violet-90) 22%, transparent))
      drop-shadow(0 0 16px color-mix(in srgb, var(--print-light) 10%, transparent))
      drop-shadow(0 0 32px color-mix(in srgb, var(--print-light) 5%, transparent));
  }

  .layered-app-logo__layer {
    position: absolute;
    inset: 0;
    transform-origin: center center;
  }

  @keyframes layered-logo-layer-rotate-a {
    0% {
      transform: rotate(0deg);
      animation-timing-function: cubic-bezier(0.22, 0.61, 0.36, 1);
    }
    50% {
      transform: rotate(-180deg);
      animation-timing-function: cubic-bezier(0.64, 0, 0.78, 0.39);
    }
    100% {
      transform: rotate(-360deg);
    }
  }

  @keyframes layered-logo-layer-pattern-mask-breathe {
    0% {
      transform: rotate(0deg) scale(1);
    }
    25% {
      transform: rotate(90deg) scale(0.93);
    }
    50% {
      transform: rotate(180deg) scale(0.987);
    }
    75% {
      transform: rotate(270deg) scale(0.897);
    }
    100% {
      transform: rotate(360deg) scale(1);
    }
  }

  @keyframes layered-logo-layer-content-breathe {
    0% {
      transform: rotate(0deg) scale(1);
    }
    20% {
      transform: rotate(-72deg) scale(1.017);
    }
    50% {
      transform: rotate(-180deg) scale(1.007);
    }
    80% {
      transform: rotate(-288deg) scale(1.023);
    }
    100% {
      transform: rotate(-360deg) scale(1);
    }
  }

  .layered-app-logo.is-full-motion .layered-app-logo__layer--badge,
  .layered-app-logo.is-full-motion .layered-app-logo__layer--shape-clip {
    animation: layered-logo-layer-rotate-a 42s infinite;
  }

  .layered-app-logo.is-full-motion .layered-app-logo__pattern,
  .layered-app-logo.is-full-motion .layered-app-logo__pattern-mask {
    animation: layered-logo-layer-pattern-mask-breathe 37s linear infinite;
  }

  .layered-app-logo.is-full-motion .layered-app-logo__content {
    animation: layered-logo-layer-content-breathe 33s linear infinite;
  }

  .layered-app-logo.is-compact-motion .layered-app-logo__layer--badge,
  .layered-app-logo.is-compact-motion .layered-app-logo__layer--shape-clip {
    animation: layered-logo-layer-rotate-a 52s infinite;
  }

  .layered-app-logo.is-compact-motion .layered-app-logo__pattern,
  .layered-app-logo.is-compact-motion .layered-app-logo__pattern-mask {
    animation: layered-logo-layer-pattern-mask-breathe 48s linear infinite;
  }

  .layered-app-logo.is-compact-motion .layered-app-logo__content {
    animation: layered-logo-layer-content-breathe 44s linear infinite;
  }

  .layered-app-logo__layer--badge {
    background-image: var(--layered-logo-layer1-url);
    background-repeat: no-repeat;
    background-size: contain;
    background-position: center;
  }

  .layered-app-logo__layer--shape-clip {
    -webkit-mask-image: var(--layered-logo-shape-mask-url);
    mask-image: var(--layered-logo-shape-mask-url);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-position: center;
    mask-position: center;
  }

  .layered-app-logo__pattern {
    position: absolute;
    inset: 0;
    transform-origin: center center;
    background: color-mix(in srgb, var(--print-light) 70%, transparent);
    -webkit-mask-image: var(--layered-logo-pattern-mask-url);
    mask-image: var(--layered-logo-pattern-mask-url);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-position: center;
    mask-position: center;
  }

  .layered-app-logo__pattern-mask {
    position: absolute;
    inset: 0;
    transform-origin: center center;
    -webkit-mask-image: var(--layered-logo-pattern-mask-url);
    mask-image: var(--layered-logo-pattern-mask-url);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-position: center;
    mask-position: center;
    mask-mode: luminance;
  }

  .layered-app-logo__content {
    position: absolute;
    inset: 0;
    transform-origin: center center;
    background-image: var(--layered-logo-layer3-url);
    background-repeat: no-repeat;
    background-size: contain;
    background-position: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .layered-app-logo__stack {
      filter: drop-shadow(0 0 10px color-mix(in srgb, var(--print-light) 30%, transparent))
        drop-shadow(0 0 22px color-mix(in srgb, var(--print-light) 14%, transparent))
        drop-shadow(0 0 40px color-mix(in srgb, var(--print-light) 6%, transparent));
    }

    .layered-app-logo.is-reduced-motion .layered-app-logo__layer--badge,
    .layered-app-logo.is-reduced-motion .layered-app-logo__layer--shape-clip,
    .layered-app-logo.is-reduced-motion .layered-app-logo__pattern,
    .layered-app-logo.is-reduced-motion .layered-app-logo__pattern-mask,
    .layered-app-logo.is-reduced-motion .layered-app-logo__content {
      animation: none;
    }
  }
</style>
