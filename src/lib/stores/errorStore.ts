/**
 * Error notification store.
 * Used by ErrorDisplay.svelte and globalErrorHandler integration.
 */

import { writable } from 'svelte/store';
import type { AppError } from '../../utils/errorHandling';

export interface ErrorNotification {
  id: string;
  error: AppError;
  dismissTimeoutId?: ReturnType<typeof setTimeout>;
}

const AUTO_DISMISS_MS = {
  error: 5000,
  warning: 3000,
  info: 2000,
} as const;

const notifications = writable<ErrorNotification[]>([]);

function add(error: AppError): void {
  const id = `error-${error.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
  const delay = AUTO_DISMISS_MS[error.severity] ?? 5000;
  const dismissTimeoutId = setTimeout(() => {
    dismiss(id);
  }, delay);

  notifications.update((list) => [...list, { id, error, dismissTimeoutId }]);
}

function dismiss(id: string): void {
  notifications.update((list) => {
    const item = list.find((n) => n.id === id);
    if (item?.dismissTimeoutId) clearTimeout(item.dismissTimeoutId);
    return list.filter((n) => n.id !== id);
  });
}

export const errorStore = {
  subscribe: notifications.subscribe,
  add,
  dismiss,
};

/** Reactive store for ErrorDisplay component */
export { notifications as errorNotifications };
