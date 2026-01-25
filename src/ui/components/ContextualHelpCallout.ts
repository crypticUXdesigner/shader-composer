/**
 * Contextual Help Callout Component
 * Displays contextual help information positioned relative to trigger elements
 */

import type { HelpContent } from '../../utils/ContextualHelpManager';
import { getHelpContent, resolveRelatedItems, findNodesUsingType } from '../../utils/ContextualHelpManager';
import type { NodeSpec } from '../../types/nodeSpec';
import { createIconElement } from '../../utils/icons';
import { createNodeIconElement } from '../../utils/icons';
import { getNodeIcon } from '../../utils/nodeSpecAdapter';
import { getCSSColor } from '../../utils/cssTokens';

export interface ShowOptions {
  helpId?: string;
  content?: HelpContent;
  triggerElement?: HTMLElement;
  screenX?: number;
  screenY?: number;
  nodeSpecs?: Map<string, NodeSpec>;
}

export class ContextualHelpCallout {
  private callout: HTMLElement;
  private _isVisible: boolean = false;
  private ignoreClicksUntil: number = 0;
  private nodeSpecs: Map<string, NodeSpec> = new Map();
  
  isVisible(): boolean {
    return this._isVisible;
  }
  
  constructor() {
    this.callout = document.createElement('div');
    this.callout.className = 'help-popover';
    document.body.appendChild(this.callout);
    this.setupEventListeners();
  }

  /**
   * Set node specs for resolving related items
   */
  setNodeSpecs(nodeSpecs: Map<string, NodeSpec>): void {
    this.nodeSpecs = nodeSpecs;
  }

  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private mousedownHandler: ((e: MouseEvent) => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  private setupEventListeners(): void {
    // Remove existing listeners if any
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
    }
    if (this.mousedownHandler) {
      document.removeEventListener('mousedown', this.mousedownHandler, true);
    }
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }
    
    // Close on outside click (use mousedown to catch events before canvas handlers)
    this.mousedownHandler = (e: MouseEvent) => {
      if (!this._isVisible) {
        return;
      }
      
      const now = Date.now();
      if (now < this.ignoreClicksUntil) {
        return;
      }
      
      // Check if click is on the close button or inside the callout
      const target = e.target as HTMLElement;
      if (!target) {
        return;
      }
      
      // If click is on close button, don't handle it here (its own handler will)
      if (target.closest('.help-popover-close')) {
        return;
      }
      
      // Check if click is outside the callout
      if (!this.callout.contains(target)) {
        e.stopPropagation();
        this.hide();
      }
    };
    document.addEventListener('mousedown', this.mousedownHandler, true);
    
    // Also handle click events as fallback
    this.clickHandler = (e: MouseEvent) => {
      if (!this._isVisible) {
        return;
      }
      
      const now = Date.now();
      if (now < this.ignoreClicksUntil) {
        return;
      }
      
      // Check if click is on the close button or inside the callout
      const target = e.target as HTMLElement;
      if (!target) {
        return;
      }
      
      // If click is on close button, don't handle it here (its own handler will)
      if (target.closest('.help-popover-close')) {
        return;
      }
      
      // Check if click is outside the callout
      if (!this.callout.contains(target)) {
        e.stopPropagation();
        this.hide();
      }
    };
    document.addEventListener('click', this.clickHandler, true);
    
    // Close on escape
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this._isVisible) {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * Show help callout
   */
  async show(options: ShowOptions): Promise<void> {
    let content: HelpContent | null = null;

    // Get content from helpId or use provided content
    if (options.helpId) {
      content = await getHelpContent(options.helpId);
      if (!content) {
        console.warn(`Help content not found for: ${options.helpId}`);
        return;
      }
    } else if (options.content) {
      content = options.content;
    } else {
      console.error('ContextualHelpCallout.show() requires either helpId or content');
      return;
    }

    // Build callout content
    this.renderContent(content);

    // Position callout
    let screenX = 0;
    let screenY = 0;

    if (options.triggerElement) {
      const rect = options.triggerElement.getBoundingClientRect();
      screenX = rect.left;
      screenY = rect.bottom;
    } else if (options.screenX !== undefined && options.screenY !== undefined) {
      screenX = options.screenX;
      screenY = options.screenY;
    } else {
      console.error('ContextualHelpCallout.show() requires either triggerElement or screenX/screenY');
      return;
    }

    // Position callout (this will also add is-visible class)
    this.positionCallout(screenX, screenY);

    // Mark as visible
    this._isVisible = true;
    this.ignoreClicksUntil = Date.now() + 300;
  }

  private renderContent(content: HelpContent): void {
    this.callout.innerHTML = '';

    // Header with title and close button
    const header = document.createElement('div');
    header.className = 'header';

    // Title badge
    const titleBadge = document.createElement('div');
    titleBadge.className = 'title-badge';
    
    // Apply type-specific styling if it's a type
    if (content.titleType === 'type') {
      const tokenMap: Record<string, string> = {
        'float': 'port-type-bg-float',
        'vec2': 'port-type-bg-vec2',
        'vec3': 'port-type-bg-vec3',
        'vec4': 'port-type-bg-vec4'
      };
      const bgTokenName = tokenMap[content.title] || 'port-type-bg-default';
      const textTokenMap: Record<string, string> = {
        'float': 'port-type-text-float',
        'vec2': 'port-type-text-vec2',
        'vec3': 'port-type-text-vec3',
        'vec4': 'port-type-text-vec4'
      };
      const textTokenName = textTokenMap[content.title] || 'port-type-text-default';
      
      const typeBgColor = getCSSColor(bgTokenName, getCSSColor('port-type-bg-default', getCSSColor('color-gray-40', '#282b31')));
      const typeTextColor = getCSSColor(textTokenName, getCSSColor('port-type-text-default', getCSSColor('color-gray-110', '#a3aeb5')));
      titleBadge.style.backgroundColor = typeBgColor;
      titleBadge.style.color = typeTextColor;
    } else {
      // Default styling
      const defaultBg = getCSSColor('port-type-bg-default', getCSSColor('color-gray-40', '#282b31'));
      const defaultText = getCSSColor('port-type-text-default', getCSSColor('color-gray-110', '#a3aeb5'));
      titleBadge.style.backgroundColor = defaultBg;
      titleBadge.style.color = defaultText;
    }
    
    titleBadge.textContent = content.title;
    header.appendChild(titleBadge);

    // Close button
    const closeButton = document.createElement('button');
    closeButton.className = 'close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close help');
    const closeIcon = createIconElement('x', 16, 'currentColor', undefined, 'line');
    closeButton.appendChild(closeIcon);
    
    // Use mousedown instead of click to avoid canvas interference
    closeButton.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.hide();
    });
    
    // Also handle click as fallback
    closeButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.hide();
    });
    
    header.appendChild(closeButton);

    this.callout.appendChild(header);

    // Category icon (if applicable)
    if (content.category) {
      const categoryRow = document.createElement('div');
      categoryRow.className = 'category';
      // For now, we'll skip category icons as they need to be defined in the help data
      // This can be extended later
      this.callout.appendChild(categoryRow);
    }

    // Related items (nodes that use this type)
    if (content.titleType === 'type' && this.nodeSpecs.size > 0) {
      const relatedNodes = findNodesUsingType(content.title, this.nodeSpecs);
      if (relatedNodes.length > 0) {
        const relatedRow = document.createElement('div');
        relatedRow.className = 'related';
        const relatedLabel = document.createElement('div');
        relatedLabel.className = 'related-label';
        relatedLabel.textContent = 'Used by:';
        relatedRow.appendChild(relatedLabel);

        const iconsContainer = document.createElement('div');
        iconsContainer.className = 'related-icons';
        
        relatedNodes.slice(0, 12).forEach((nodeSpec: NodeSpec) => { // Limit to 12 icons
          const iconWrapper = document.createElement('div');
          iconWrapper.className = 'related-icon';
          iconWrapper.title = nodeSpec.displayName;
          const iconIdentifier = getNodeIcon(nodeSpec);
          // Variant is auto-selected by createNodeIconElement based on icon identifier
          const icon = createNodeIconElement(iconIdentifier, 20, 'currentColor', undefined);
          iconWrapper.appendChild(icon);
          iconsContainer.appendChild(iconWrapper);
        });

        relatedRow.appendChild(iconsContainer);
        this.callout.appendChild(relatedRow);
      }
    }

    // Also show related items from help content
    if (content.relatedItems && content.relatedItems.length > 0 && this.nodeSpecs.size > 0) {
      const resolved = resolveRelatedItems(content.relatedItems, this.nodeSpecs);
      if (resolved.nodes.length > 0) {
        const relatedRow = document.createElement('div');
        relatedRow.className = 'related';
        const relatedLabel = document.createElement('div');
        relatedLabel.className = 'related-label';
        relatedLabel.textContent = 'Related:';
        relatedRow.appendChild(relatedLabel);

        const iconsContainer = document.createElement('div');
        iconsContainer.className = 'related-icons';
        
        resolved.nodes.slice(0, 8).forEach((nodeSpec: NodeSpec) => {
          const iconWrapper = document.createElement('div');
          iconWrapper.className = 'related-icon';
          iconWrapper.title = nodeSpec.displayName;
          const iconIdentifier = getNodeIcon(nodeSpec);
          // Variant is auto-selected by createNodeIconElement based on icon identifier
          const icon = createNodeIconElement(iconIdentifier, 20, 'currentColor', undefined);
          iconWrapper.appendChild(icon);
          iconsContainer.appendChild(iconWrapper);
        });

        relatedRow.appendChild(iconsContainer);
        this.callout.appendChild(relatedRow);
      }
    }

    // Description
    const description = document.createElement('div');
    description.className = 'description';
    description.textContent = content.description;
    this.callout.appendChild(description);

    // Examples
    if (content.examples && content.examples.length > 0) {
      const examplesSection = document.createElement('div');
      examplesSection.className = 'examples';
      const examplesLabel = document.createElement('div');
      examplesLabel.className = 'examples-label';
      examplesLabel.textContent = 'Examples:';
      examplesSection.appendChild(examplesLabel);

      const examplesList = document.createElement('ul');
      examplesList.className = 'examples-list';
      content.examples.forEach((example: string) => {
        const li = document.createElement('li');
        li.textContent = example;
        examplesList.appendChild(li);
      });
      examplesSection.appendChild(examplesList);
      this.callout.appendChild(examplesSection);
    }
  }

  private positionCallout(screenX: number, screenY: number): void {
    const margin = 8; // Gap from trigger element
    const safeMargin = 16; // Safe distance from viewport edges
    
    // Default position: below and right-aligned with trigger
    let left = screenX;
    let top = screenY + margin;

    // Show callout to measure it (use CSS class, not inline display)
    this.callout.classList.add('is-visible');
    this.callout.style.visibility = 'hidden';
    this.callout.style.top = `${top}px`;
    this.callout.style.left = `${left}px`;
    const rect = this.callout.getBoundingClientRect();
    const calloutWidth = rect.width;
    const calloutHeight = rect.height;

    // Adjust position to stay within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check right edge
    if (left + calloutWidth > viewportWidth - safeMargin) {
      // Try flipping to left side of trigger
      left = screenX - calloutWidth;
      // If that's also off-screen, align to right edge
      if (left < safeMargin) {
        left = viewportWidth - calloutWidth - safeMargin;
      }
    }

    // Check left edge
    if (left < safeMargin) {
      left = safeMargin;
    }

    // Check bottom edge
    if (top + calloutHeight > viewportHeight - safeMargin) {
      // Flip above trigger
      top = screenY - calloutHeight - margin;
      // If that's also off-screen, align to bottom edge
      if (top < safeMargin) {
        top = viewportHeight - calloutHeight - safeMargin;
      }
    }

    // Check top edge
    if (top < safeMargin) {
      top = safeMargin;
    }

    // Apply final position
    this.callout.style.top = `${top}px`;
    this.callout.style.left = `${left}px`;
    this.callout.style.visibility = 'visible';
  }

  hide(): void {
    if (!this._isVisible) {
      return;
    }
    this._isVisible = false;
    this.callout.classList.remove('is-visible');
    // Reset ignore clicks timer
    this.ignoreClicksUntil = 0;
  }

  destroy(): void {
    // Remove event listeners
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
    if (this.mousedownHandler) {
      document.removeEventListener('mousedown', this.mousedownHandler, true);
      this.mousedownHandler = null;
    }
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    
    if (this.callout.parentNode) {
      this.callout.parentNode.removeChild(this.callout);
    }
  }
}

