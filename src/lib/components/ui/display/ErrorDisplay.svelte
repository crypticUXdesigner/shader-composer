<script lang="ts">
  /**
   * ErrorDisplay - Toast notification system for errors, warnings, and info.
   * Replaces vanilla ErrorDisplay class.
   */
  import { errorStore, errorNotifications } from '../../../stores/errorStore';
  import { IconSvg, Button } from '..';
  import { getCSSColor } from '../../../../utils/cssTokens';

  interface Props {
    onDismiss?: (id: string) => void;
  }

  let { onDismiss }: Props = $props();

  const notifications = $derived($errorNotifications);

  function dismiss(id: string): void {
    errorStore.dismiss(id);
    onDismiss?.(id);
  }

  function getBgColor(severity: string): string {
    if (severity === 'error') return getCSSColor('layout-message-error-bg', '#3d1f1f');
    if (severity === 'warning') return getCSSColor('color-yellow-60', '#4a3d1f');
    return getCSSColor('color-blue-60', '#1f2a3d');
  }

  function getBorderColor(severity: string): string {
    if (severity === 'error') return getCSSColor('layout-message-error-border', '#5a2f2f');
    if (severity === 'warning') return getCSSColor('color-yellow-80', '#6a5d2f');
    return getCSSColor('color-blue-80', '#2f3a5d');
  }

  function getIconColor(severity: string): string {
    if (severity === 'error') return getCSSColor('color-red-100', '#ff6b6b');
    if (severity === 'warning') return getCSSColor('color-yellow-100', '#ffd93d');
    return getCSSColor('color-blue-100', '#6b9fff');
  }
</script>

<div class="container">
  {#each notifications as item (item.id)}
    {@const err = item.error}
    <div
      class="notification notification--{err.severity} notification--{err.category} is-visible"
      data-notification-id={item.id}
      style="
        --_bg: {getBgColor(err.severity)};
        --_border: {getBorderColor(err.severity)};
        --_icon: {getIconColor(err.severity)};
      "
    >
      <div class="icon">
        <IconSvg name="x" />
      </div>
      <div class="content">
        <div class="category">{err.category}</div>
        <div class="message">{err.message}</div>
        {#if err.details && err.details.length > 0}
          <div class="details">
            <ul>
              {#each err.details as detail}
                <li>{detail}</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
      <Button
        variant="ghost"
        size="sm"
        mode="icon-only"
        class="dismiss"
        onclick={() => dismiss(item.id)}
        aria-label="Dismiss"
      >
        <IconSvg name="x" />
      </Button>
    </div>
  {/each}
</div>

<style>
  .container {
    /* layout */
    position: fixed;
    top: var(--pd-md);
    right: var(--pd-md);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: var(--pd-sm);
    max-width: 400px;
    pointer-events: none;

    .notification {
      /* layout */
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: var(--pd-md);
      /* box model */
      padding: var(--pd-sm) var(--pd-md);
      max-width: 100%;
      /* visual */
      border-radius: var(--radius-md);
      background: var(--_bg);
      border: 1px solid var(--_border);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: opacity 0.3s ease-out, transform 0.3s ease-out;
      pointer-events: auto;

      @media (prefers-reduced-motion: reduce) {
        transition: none;
      }
      color: var(--layout-message-color, #e0e0e0);

      .icon {
        flex-shrink: 0;
        margin-top: var(--pd-2xs);
        width: var(--icon-size-md);
        height: var(--icon-size-md);
        color: var(--_icon);
      }

      .content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--pd-2xs);
      }

      .category {
        font-size: var(--text-xs);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px; /* one-off: category label */
        opacity: 0.8;
        margin-bottom: var(--pd-2xs);
      }

      .message {
        font-size: var(--text-sm);
        line-height: 1.4;
        word-wrap: break-word;
      }

      .details {
        margin-top: var(--pd-2xs);
        font-size: var(--text-xs);
        opacity: 0.85;
        max-height: 100px; /* one-off: details cap */
        overflow-y: auto;

        ul {
          margin: 0;
          padding-left: var(--pd-lg);
          list-style-type: disc;
        }
      }

      :global(.dismiss) {
        color: inherit;
        flex-shrink: 0;
      }
    }
  }
</style>
