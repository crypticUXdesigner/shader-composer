// Node Right-Click Menu Component
// Context menu shown when right-clicking on a node (Read Guide, Copy node name, Remove)

export interface NodeRightClickMenuCallbacks {
  onReadGuide?: (nodeId: string, nodeType: string) => void;
  onCopyNodeName?: (nodeType: string) => void;
  onRemove?: (nodeId: string) => void;
}

export class NodeRightClickMenu {
  private menu: HTMLElement;
  private _isVisible: boolean = false;
  private ignoreClicksUntil: number = 0;
  private callbacks: NodeRightClickMenuCallbacks = {};

  isVisible(): boolean {
    return this._isVisible;
  }

  constructor(callbacks: NodeRightClickMenuCallbacks = {}) {
    this.callbacks = callbacks;
    this.menu = document.createElement('div');
    this.menu.className = 'menu-wrapper node-right-click-menu';
    document.body.appendChild(this.menu);
    this.setupEventListeners();
  }

  setCallbacks(callbacks: NodeRightClickMenuCallbacks): void {
    this.callbacks = callbacks;
  }

  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  private setupEventListeners(): void {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
    }
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }

    this.clickHandler = (e: MouseEvent) => {
      if (Date.now() < this.ignoreClicksUntil) return;
      if (this._isVisible && !this.menu.contains(e.target as Node)) {
        e.stopPropagation();
        this.hide();
      }
    };
    document.addEventListener('click', this.clickHandler, true);

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this._isVisible) {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.keydownHandler);
  }

  show(screenX: number, screenY: number, nodeId: string, nodeType: string): void {
    this.menu.innerHTML = '';

    const items: Array<{ label: string; action: () => void }> = [
      {
        label: 'Read Guide',
        action: () => {
          this.callbacks.onReadGuide?.(nodeId, nodeType);
        }
      },
      {
        label: 'Copy node name',
        action: () => {
          this.callbacks.onCopyNodeName?.(nodeType);
        }
      },
      {
        label: 'Remove',
        action: () => {
          this.callbacks.onRemove?.(nodeId);
        }
      }
    ];

    items.forEach((item) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'menu-item';
      menuItem.textContent = item.label;
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action();
        this.hide();
      });
      this.menu.appendChild(menuItem);
    });

    this.menu.style.setProperty('--menu-top', `${screenY}px`);
    this.menu.style.setProperty('--menu-left', `${screenX}px`);
    this.menu.style.setProperty('--menu-transform', 'none');
    this.menu.classList.add('is-visible');
    this._isVisible = true;

    const rect = this.menu.getBoundingClientRect();
    let left = screenX;
    let top = screenY;
    if (rect.right > window.innerWidth) {
      left = screenX - rect.width;
    }
    if (rect.bottom > window.innerHeight) {
      top = screenY - rect.height;
    }
    if (left !== screenX || top !== screenY) {
      this.menu.style.setProperty('--menu-left', `${left}px`);
      this.menu.style.setProperty('--menu-top', `${top}px`);
    }

    this.ignoreClicksUntil = Date.now() + 100;
  }

  hide(): void {
    this.menu.classList.remove('is-visible');
    this._isVisible = false;
  }

  destroy(): void {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
    }
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }
    this.menu.remove();
  }
}
