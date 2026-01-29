/**
 * Color picker popover – HSV-style UI, stores OKLCH.
 * Hue strip + saturation/value 2D area; converts to/from OKLCH at boundary.
 */

import { oklchToHsv, hsvToOklch, oklchToCssRgb } from '../../utils/colorConversion';

export interface OKLCHTriple {
  l: number;
  c: number;
  h: number;
}

export interface ColorPickerPopoverCallbacks {
  onApply?: (l: number, c: number, h: number) => void;
  onClose?: () => void;
}

const HUE_STRIP_HEIGHT = 12;
const SV_BOX_SIZE = 160;

export class ColorPickerPopover {
  private overlay: HTMLElement;
  private popover: HTMLElement;
  private svBox: HTMLElement;
  private hueStrip: HTMLElement;
  private swatchEl: HTMLElement;
  private _isVisible = false;
  private callbacks: ColorPickerPopoverCallbacks;
  private h = 0;
  private s = 1;
  private v = 1;
  private onApplyValues?: (l: number, c: number, h: number) => void;
  /** Ignore outside clicks for this many ms after open (prevents opening click from closing). */
  private ignoreClicksUntil = 0;
  /** Aborted on close so SV/hue document listeners are removed. */
  private dragAbortController: AbortController | null = null;
  private boundKeydownHandler = (e: KeyboardEvent): void => {
    if (!this._isVisible) return;
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  };

  constructor(callbacks: ColorPickerPopoverCallbacks = {}) {
    this.callbacks = callbacks;
    this.overlay = document.createElement('div');
    this.overlay.className = 'color-picker-popover-overlay';

    this.popover = document.createElement('div');
    this.popover.className = 'popover';

    this.swatchEl = document.createElement('div');
    this.swatchEl.className = 'swatch';

    this.svBox = document.createElement('div');
    this.svBox.className = 'sv-box';

    this.hueStrip = document.createElement('div');
    this.hueStrip.className = 'hue-strip';

    this.popover.appendChild(this.swatchEl);
    this.popover.appendChild(this.svBox);
    this.popover.appendChild(this.hueStrip);
    this.overlay.appendChild(this.popover);
    document.body.appendChild(this.overlay);
  }

  private readonly boundDocumentHandler = (e: MouseEvent): void => {
    if (Date.now() < this.ignoreClicksUntil) return;
    const target = e.target as Node | null;
    if (!target || !this.popover) return;
    if (this.popover.contains(target)) return;
    e.preventDefault();
    e.stopPropagation();
    this.close();
  };

  private updateFromHSV(): void {
    const oklch = hsvToOklch(this.h, this.s, this.v);
    this.swatchEl.style.backgroundColor = oklchToCssRgb(oklch.l, oklch.c, oklch.h);
    this.onApplyValues?.(oklch.l, oklch.c, oklch.h);
    this.callbacks.onApply?.(oklch.l, oklch.c, oklch.h);
  }

  private svCanvas: HTMLCanvasElement | null = null;

  private redrawSVCanvas(): void {
    if (!this.svCanvas) return;
    const canvas = this.svCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const hueGrad = ctx.createLinearGradient(0, 0, SV_BOX_SIZE, 0);
    hueGrad.addColorStop(0, 'white');
    hueGrad.addColorStop(1, `hsl(${this.h}, 100%, 50%)`);
    ctx.fillStyle = hueGrad;
    ctx.fillRect(0, 0, SV_BOX_SIZE, SV_BOX_SIZE);
    const blackGrad = ctx.createLinearGradient(0, 0, 0, SV_BOX_SIZE);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, SV_BOX_SIZE, SV_BOX_SIZE);
  }

  private setupSVBox(): void {
    this.svBox.innerHTML = '';
    this.svBox.style.setProperty('--hue', `${this.h}deg`);
    const canvas = document.createElement('canvas');
    canvas.width = SV_BOX_SIZE;
    canvas.height = SV_BOX_SIZE;
    canvas.className = 'sv-canvas';
    this.svCanvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.redrawSVCanvas();

    let dragging = false;
    const move = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      this.s = Math.max(0, Math.min(1, x));
      this.v = 1 - Math.max(0, Math.min(1, y));
      this.updateFromHSV();
      this.updateHueStripPointer();
      this.updateSVPointer();
    };
    canvas.addEventListener('mousedown', (e) => {
      dragging = true;
      move(e);
    });
    const moveOpt = this.dragAbortController ? { signal: this.dragAbortController.signal } : undefined;
    document.addEventListener('mousemove', (e) => { if (dragging) move(e); }, moveOpt);
    document.addEventListener('mouseup', () => { dragging = false; }, moveOpt);
    this.svBox.appendChild(canvas);
    this.updateSVPointer();
  }

  private updateSVPointer(): void {
    let pointer = this.svBox.querySelector('.sv-pointer') as HTMLElement;
    if (!pointer) {
      pointer = document.createElement('div');
      pointer.className = 'sv-pointer';
      this.svBox.appendChild(pointer);
    }
    pointer.style.left = `${this.s * 100}%`;
    pointer.style.top = `${(1 - this.v) * 100}%`;
  }

  private setupHueStrip(): void {
    this.hueStrip.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = SV_BOX_SIZE;
    canvas.height = HUE_STRIP_HEIGHT;
    canvas.className = 'hue-canvas';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, SV_BOX_SIZE, 0);
    for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, `hsl(${i * 60}, 100%, 50%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SV_BOX_SIZE, HUE_STRIP_HEIGHT);
    this.hueStrip.appendChild(canvas);

    let dragging = false;
    const move = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      this.h = Math.max(0, Math.min(360, x * 360));
      this.updateFromHSV();
      this.svBox.style.setProperty('--hue', `${this.h}deg`);
      this.updateHueStripPointer();
      this.redrawSVCanvas();
    };
    canvas.addEventListener('mousedown', (e) => {
      dragging = true;
      move(e);
    });
    const moveOpt = this.dragAbortController ? { signal: this.dragAbortController.signal } : undefined;
    document.addEventListener('mousemove', (e) => { if (dragging) move(e); }, moveOpt);
    document.addEventListener('mouseup', () => { dragging = false; }, moveOpt);
    this.updateHueStripPointer();
  }

  private updateHueStripPointer(): void {
    let pointer = this.hueStrip.querySelector('.hue-pointer') as HTMLElement;
    if (!pointer) {
      pointer = document.createElement('div');
      pointer.className = 'hue-pointer';
      this.hueStrip.appendChild(pointer);
    }
    pointer.style.left = `${(this.h / 360) * 100}%`;
  }

  show(
    _nodeId: string,
    initial: OKLCHTriple,
    screenX: number,
    screenY: number,
    onApplyValues: (l: number, c: number, h: number) => void
  ): void {
    this.onApplyValues = onApplyValues;
    this.dragAbortController = new AbortController();
    const hsv = oklchToHsv(initial.l, initial.c, initial.h);
    this.h = hsv.h;
    this.s = hsv.s;
    this.v = hsv.v;
    this.swatchEl.style.backgroundColor = oklchToCssRgb(initial.l, initial.c, initial.h);
    this.setupHueStrip();
    this.setupSVBox();

    this.popover.style.left = `${screenX}px`;
    this.popover.style.top = `${screenY}px`;

    this.overlay.classList.add('is-visible');
    this._isVisible = true;
    this.ignoreClicksUntil = Date.now() + 300;
    document.addEventListener('mousedown', this.boundDocumentHandler, true);
    document.addEventListener('click', this.boundDocumentHandler, true);
    document.addEventListener('keydown', this.boundKeydownHandler, true);
  }

  close(): void {
    if (!this._isVisible) return;
    document.removeEventListener('mousedown', this.boundDocumentHandler, true);
    document.removeEventListener('click', this.boundDocumentHandler, true);
    document.removeEventListener('keydown', this.boundKeydownHandler, true);
    this.dragAbortController?.abort();
    this.dragAbortController = null;
    this.overlay.classList.remove('is-visible');
    this.overlay.style.cssText = '';
    this._isVisible = false;
    this.callbacks.onClose?.();
  }

  isVisible(): boolean {
    return this._isVisible;
  }
}
