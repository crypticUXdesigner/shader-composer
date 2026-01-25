// Dropdown Menu Component
// Simple dropdown menu for top bar actions

export interface DropdownMenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
}

export class DropdownMenu {
  private menu: HTMLElement;
  private _isVisible: boolean = false;
  private ignoreClicksUntil: number = 0;
  
  isVisible(): boolean {
    return this._isVisible;
  }
  
  constructor() {
    this.menu = document.createElement('div');
    this.menu.className = 'menu-wrapper';
    this.menu.style.minWidth = '160px';
    this.menu.style.padding = 'var(--pd-xs) 0';
    document.body.appendChild(this.menu);
    this.setupEventListeners();
  }
  
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  private setupEventListeners(): void {
    // Remove existing listeners if any
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }
    
    // Close on outside click
    this.clickHandler = (e: MouseEvent) => {
      // Ignore clicks that happen soon after opening (to ignore the click that opened it)
      const now = Date.now();
      if (now < this.ignoreClicksUntil) {
        return;
      }
      if (this._isVisible && !this.menu.contains(e.target as Node)) {
        e.stopPropagation(); // Prevent canvas handlers from processing this click
        this.hide();
      }
    };
    document.addEventListener('click', this.clickHandler, true); // Use capture phase to run before canvas handlers
    
    // Close on escape
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this._isVisible) {
        this.hide();
      }
    };
    document.addEventListener('keydown', this.keydownHandler);
  }
  
  show(x: number, y: number, items: DropdownMenuItem[]): void {
    this.menu.innerHTML = '';
    
    items.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'menu-item';
      if (item.disabled) {
        menuItem.classList.add('is-disabled');
      }
      menuItem.textContent = item.label;
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!item.disabled) {
          item.action();
          this.hide();
        }
      });
      this.menu.appendChild(menuItem);
    });
    
    this.menu.classList.add('is-visible');
    this._isVisible = true;
    
    // Ignore clicks for the next 300ms to prevent the click that opened this dropdown from closing it
    // This handles the case where mousedown opens the dropdown, and mouseup completes the click
    this.ignoreClicksUntil = Date.now() + 300;
    
    // Position menu
    this.menu.style.top = `${y}px`;
    this.menu.style.left = `${x}px`;
    this.menu.style.transform = 'none';
    
    // Ensure menu stays within viewport
    const rect = this.menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.menu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      this.menu.style.top = `${y - rect.height}px`;
    }
  }
  
  hide(): void {
    this.menu.classList.remove('is-visible');
    this._isVisible = false;
  }
  
  destroy(): void {
    // Remove event listeners
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler, true);
      this.clickHandler = null;
    }
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    
    if (this.menu.parentNode) {
      this.menu.parentNode.removeChild(this.menu);
    }
  }
}
