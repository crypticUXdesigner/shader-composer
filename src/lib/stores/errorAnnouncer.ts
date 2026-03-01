/**
 * Error announcer store for ARIA live region.
 * Single source for screen reader announcements; avoid duplicate announcements
 * for the same message by only updating when the message text changes.
 */

import { writable, get } from 'svelte/store';
import type { AppError } from '../../utils/errorHandling';

const message = writable<string | null>(null);

function announce(msg: string): void {
  const current = get(message);
  if (msg === current) return;
  message.set(msg);
}

function clear(): void {
  message.set(null);
}

/** Format an AppError for the live region (single-line, concise). */
export function formatErrorForAnnouncer(err: AppError): string {
  const prefix = `${err.category}:`;
  const main = err.message.trim();
  const detail = err.details?.length ? ` ${err.details[0]}` : '';
  return `${prefix} ${main}${detail}`;
}

export const errorAnnouncer = {
  subscribe: message.subscribe,
  announce,
  clear,
};
