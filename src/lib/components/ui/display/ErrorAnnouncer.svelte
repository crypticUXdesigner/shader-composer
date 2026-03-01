<script lang="ts">
  /**
   * ErrorAnnouncer - ARIA live region for user-facing errors.
   * Screen readers announce when the message updates. Visually hidden (sr-only).
   */
  import { errorAnnouncer } from '../../../stores';

  const ANNOUNCE_CLEAR_MS = 1000;

  const message = $derived($errorAnnouncer);

  $effect(() => {
    const msg = message;
    if (msg == null || msg === '') return;
    const id = setTimeout(() => {
      errorAnnouncer.clear();
    }, ANNOUNCE_CLEAR_MS);
    return () => clearTimeout(id);
  });
</script>

<div
  class="error-announcer"
  aria-live="polite"
  aria-atomic="true"
  aria-relevant="text"
  aria-label="Error notifications"
  role="status"
>
  {message ?? ''}
</div>

<style>
  .error-announcer {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
