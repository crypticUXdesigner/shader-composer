/**
 * Error Display Component
 * 
 * Displays errors to users in a toast notification system.
 * Supports different severity levels and auto-dismiss functionality.
 */

import type { AppError } from '../../utils/errorHandling';
import { createIconElement } from '../../utils/icons';
import { getCSSColor } from '../../utils/cssTokens';

export class ErrorDisplay {
  private container: HTMLElement;
  private notifications: Map<string, HTMLElement> = new Map();
  private readonly AUTO_DISMISS_DELAY = 5000; // 5 seconds for errors, 3 seconds for warnings
  private readonly WARNING_DISMISS_DELAY = 3000;
  private readonly INFO_DISMISS_DELAY = 2000;
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.createContainer();
  }
  
  /**
   * Create the notification container
   */
  private createContainer(): void {
    this.container.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      max-width: 400px;
    `;
  }
  
  /**
   * Show an error notification
   */
  showError(error: AppError): void {
    const notificationId = `error-${error.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    const notification = this.createNotification(error, notificationId);
    
    this.container.appendChild(notification);
    this.notifications.set(notificationId, notification);
    
    // Trigger animation
    requestAnimationFrame(() => {
      notification.classList.add('is-visible');
    });
    
    // Auto-dismiss based on severity
    const dismissDelay = 
      error.severity === 'error' ? this.AUTO_DISMISS_DELAY :
      error.severity === 'warning' ? this.WARNING_DISMISS_DELAY :
      this.INFO_DISMISS_DELAY;
    
    const timeoutId = setTimeout(() => {
      this.dismiss(notificationId);
    }, dismissDelay);
    
    // Store timeout ID for manual dismissal
    (notification as any).__dismissTimeout = timeoutId;
  }
  
  /**
   * Create a notification element
   */
  private createNotification(error: AppError, id: string): HTMLElement {
    const notification = document.createElement('div');
    notification.className = `error-notification error-notification--${error.severity} error-notification--${error.category}`;
    notification.setAttribute('data-notification-id', id);
    
    // Get colors based on severity
    const bgColor = this.getBackgroundColor(error.severity);
    const borderColor = this.getBorderColor(error.severity);
    const textColor = this.getTextColor(error.severity);
    const iconColor = this.getIconColor(error.severity);
    
    notification.style.cssText = `
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      background: ${bgColor};
      border: 1px solid ${borderColor};
      color: ${textColor};
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
      opacity: 0;
      transform: translateX(100%);
      transition: opacity 0.3s ease-out, transform 0.3s ease-out;
      max-width: 100%;
    `;
    
    // Icon
    const icon = this.createIcon(error.severity, iconColor);
    notification.appendChild(icon);
    
    // Content
    const content = document.createElement('div');
    content.style.cssText = `
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;
    
    // Category badge
    const categoryBadge = document.createElement('div');
    categoryBadge.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.8;
      margin-bottom: 2px;
    `;
    categoryBadge.textContent = error.category;
    content.appendChild(categoryBadge);
    
    // Message
    const message = document.createElement('div');
    message.style.cssText = `
      font-size: 13px;
      line-height: 1.4;
      word-wrap: break-word;
    `;
    message.textContent = error.message;
    content.appendChild(message);
    
    // Details (if any)
    if (error.details && error.details.length > 0) {
      const details = document.createElement('div');
      details.style.cssText = `
        margin-top: 4px;
        font-size: 12px;
        opacity: 0.85;
        max-height: 100px;
        overflow-y: auto;
      `;
      
      const detailsList = document.createElement('ul');
      detailsList.style.cssText = `
        margin: 0;
        padding-left: 16px;
        list-style-type: disc;
      `;
      
      for (const detail of error.details) {
        const li = document.createElement('li');
        li.textContent = detail;
        li.style.marginBottom = '2px';
        detailsList.appendChild(li);
      }
      
      details.appendChild(detailsList);
      content.appendChild(details);
    }
    
    notification.appendChild(content);
    
    // Dismiss button (component .button.ghost.sm.icon-only)
    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'button ghost sm icon-only';
    dismissButton.setAttribute('aria-label', 'Dismiss');
    dismissButton.addEventListener('click', () => {
      this.dismiss(id);
    });
    dismissButton.style.color = 'inherit'; /* match notification text color (severity) */
    // Icon uses currentColor so it matches the button
    const closeIcon = createIconElement('x', 16, 'currentColor', 'icon', 'line');
    dismissButton.appendChild(closeIcon as unknown as HTMLElement);
    notification.appendChild(dismissButton);
    
    return notification;
  }
  
  /**
   * Create icon for notification
   */
  private createIcon(severity: AppError['severity'], color: string): HTMLElement {
    const iconName = 
      severity === 'error' ? 'x' :
      severity === 'warning' ? 'x' : // Could use a warning icon if available
      'x';
    
    const icon = createIconElement(iconName, 20, color, 'icon', 'line');
    icon.style.cssText = `
      flex-shrink: 0;
      margin-top: 2px;
    `;
    return icon as unknown as HTMLElement;
  }
  
  /**
   * Dismiss a notification
   */
  dismiss(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (!notification) return;
    
    // Clear auto-dismiss timeout if exists
    const timeoutId = (notification as any).__dismissTimeout;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    // Animate out
    notification.classList.remove('is-visible');
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    
    // Remove after animation
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      this.notifications.delete(notificationId);
    }, 300);
  }
  
  /**
   * Clear all notifications
   */
  clearAll(): void {
    for (const id of this.notifications.keys()) {
      this.dismiss(id);
    }
  }
  
  /**
   * Get background color for severity
   */
  private getBackgroundColor(severity: AppError['severity']): string {
    if (severity === 'error') {
      return getCSSColor('layout-message-error-bg', '#3d1f1f');
    } else if (severity === 'warning') {
      return getCSSColor('color-yellow-60', '#4a3d1f');
    } else {
      return getCSSColor('color-blue-60', '#1f2a3d');
    }
  }
  
  /**
   * Get border color for severity
   */
  private getBorderColor(severity: AppError['severity']): string {
    if (severity === 'error') {
      return getCSSColor('layout-message-error-border', '#5a2f2f');
    } else if (severity === 'warning') {
      return getCSSColor('color-yellow-80', '#6a5d2f');
    } else {
      return getCSSColor('color-blue-80', '#2f3a5d');
    }
  }
  
  /**
   * Get text color for severity
   */
  private getTextColor(_severity: AppError['severity']): string {
    return getCSSColor('layout-message-color', '#e0e0e0');
  }
  
  /**
   * Get icon color for severity
   */
  private getIconColor(severity: AppError['severity']): string {
    if (severity === 'error') {
      return getCSSColor('color-red-100', '#ff6b6b');
    } else if (severity === 'warning') {
      return getCSSColor('color-yellow-100', '#ffd93d');
    } else {
      return getCSSColor('color-blue-100', '#6b9fff');
    }
  }
}
