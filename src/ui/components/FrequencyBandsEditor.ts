// Frequency Bands Editor Modal
// Allows editing frequency band ranges for audio analyzer nodes

export interface FrequencyBand {
  minHz: number;
  maxHz: number;
}

export interface FrequencyBandsEditorCallbacks {
  onApply?: (bands: FrequencyBand[]) => void;
  onCancel?: () => void;
}

export class FrequencyBandsEditor {
  private dialog: HTMLElement;
  private overlay: HTMLElement;
  private bandsContainer: HTMLElement;
  private addButton: HTMLElement;
  private applyButton: HTMLElement;
  private cancelButton: HTMLElement;
  private bands: FrequencyBand[] = [];
  private callbacks: FrequencyBandsEditorCallbacks;
  private _isVisible: boolean = false;

  constructor(callbacks: FrequencyBandsEditorCallbacks = {}) {
    this.callbacks = callbacks;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'frequency-bands-editor-overlay';

    // Create dialog
    this.dialog = document.createElement('div');
    this.dialog.className = 'frequency-bands-editor-dialog';

    // Create header
    const header = document.createElement('div');
    header.className = 'header';
    header.textContent = 'Edit Frequency Bands';
    this.dialog.appendChild(header);

    // Create bands container
    this.bandsContainer = document.createElement('div');
    this.bandsContainer.className = 'bands';
    this.dialog.appendChild(this.bandsContainer);

    // Create add button
    this.addButton = document.createElement('button');
    this.addButton.className = 'add-button';
    this.addButton.textContent = '+ Add Band';
    this.addButton.addEventListener('click', () => this.addBand());
    this.dialog.appendChild(this.addButton);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'buttons';

    // Create cancel button
    this.cancelButton = document.createElement('button');
    this.cancelButton.className = 'button cancel';
    this.cancelButton.textContent = 'Cancel';
    this.cancelButton.addEventListener('click', () => this.cancel());
    buttonContainer.appendChild(this.cancelButton);

    // Create apply button
    this.applyButton = document.createElement('button');
    this.applyButton.className = 'button apply';
    this.applyButton.textContent = 'Apply';
    this.applyButton.addEventListener('click', () => this.apply());
    buttonContainer.appendChild(this.applyButton);

    this.dialog.appendChild(buttonContainer);

    this.overlay.appendChild(this.dialog);
    document.body.appendChild(this.overlay);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.cancel();
      }
    });

    // ESC key handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isVisible) {
        this.cancel();
      }
    });
  }

  show(initialBands: number[][]): void {
    // Convert from array format [min, max] to FrequencyBand format
    this.bands = initialBands.map(band => ({
      minHz: Array.isArray(band) && band.length >= 2 ? band[0] : 20,
      maxHz: Array.isArray(band) && band.length >= 2 ? band[1] : 20000
    }));

    // Ensure at least one band
    if (this.bands.length === 0) {
      this.bands = [{ minHz: 20, maxHz: 20000 }];
    }

    this.renderBands();
    this.overlay.classList.add('is-visible');
    this._isVisible = true;
  }

  hide(): void {
    this.overlay.classList.remove('is-visible');
    this._isVisible = false;
  }

  isVisible(): boolean {
    return this._isVisible;
  }

  private renderBands(): void {
    this.bandsContainer.innerHTML = '';

    this.bands.forEach((band, index) => {
      const bandRow = document.createElement('div');
      bandRow.className = 'band-row';

      // Band label
      const label = document.createElement('div');
      label.className = 'band-label';
      label.textContent = `Band ${index + 1}`;
      bandRow.appendChild(label);

      // Min input
      const minContainer = document.createElement('div');
      minContainer.className = 'input-container';
      const minLabel = document.createElement('label');
      minLabel.textContent = 'Min (Hz)';
      minLabel.className = 'input-label';
      minContainer.appendChild(minLabel);
      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.className = 'input primary md';
      minInput.value = band.minHz.toString();
      minInput.min = '0';
      minInput.max = '20000';
      minInput.step = '1';
      minInput.addEventListener('input', () => {
        const value = parseFloat(minInput.value);
        if (!isNaN(value)) {
          band.minHz = Math.max(0, Math.min(20000, value));
          this.validateBand(index);
        }
      });
      minContainer.appendChild(minInput);
      bandRow.appendChild(minContainer);

      // Max input
      const maxContainer = document.createElement('div');
      maxContainer.className = 'input-container';
      const maxLabel = document.createElement('label');
      maxLabel.textContent = 'Max (Hz)';
      maxLabel.className = 'input-label';
      maxContainer.appendChild(maxLabel);
      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.className = 'input primary md';
      maxInput.value = band.maxHz.toString();
      maxInput.min = '0';
      maxInput.max = '20000';
      maxInput.step = '1';
      maxInput.addEventListener('input', () => {
        const value = parseFloat(maxInput.value);
        if (!isNaN(value)) {
          band.maxHz = Math.max(0, Math.min(20000, value));
          this.validateBand(index);
        }
      });
      maxContainer.appendChild(maxInput);
      bandRow.appendChild(maxContainer);

      // Remove button (only show if more than one band)
      if (this.bands.length > 1) {
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-button';
        removeButton.textContent = '×';
        removeButton.title = 'Remove band';
        removeButton.addEventListener('click', () => this.removeBand(index));
        bandRow.appendChild(removeButton);
      }

      this.bandsContainer.appendChild(bandRow);
    });
  }

  private validateBand(index: number): void {
    const band = this.bands[index];
    if (band.minHz >= band.maxHz) {
      // Auto-adjust: if min >= max, set max to min + 1
      band.maxHz = Math.min(20000, band.minHz + 1);
      // Update the input field - find the last input-container's input
      const bandRow = this.bandsContainer.children[index] as HTMLElement;
      const maxInput = bandRow.querySelector('.input-container:last-of-type .input[type="number"]') as HTMLInputElement;
      if (maxInput) {
        maxInput.value = band.maxHz.toString();
      }
    }
  }

  private addBand(): void {
    // Add a new band after the last one, with a reasonable default range
    const lastBand = this.bands[this.bands.length - 1];
    const newMin = lastBand ? Math.min(20000, lastBand.maxHz + 1) : 20;
    const newMax = Math.min(20000, newMin + 100);
    
    this.bands.push({ minHz: newMin, maxHz: newMax });
    this.renderBands();
  }

  private removeBand(index: number): void {
    if (this.bands.length > 1) {
      this.bands.splice(index, 1);
      this.renderBands();
    }
  }

  private apply(): void {
    // Validate all bands
    const validBands = this.bands.filter(band => band.minHz < band.maxHz && band.minHz >= 0 && band.maxHz <= 20000);
    
    if (validBands.length === 0) {
      alert('At least one valid frequency band is required.');
      return;
    }

    this.callbacks.onApply?.(validBands);
    this.hide();
  }

  private cancel(): void {
    this.callbacks.onCancel?.();
    this.hide();
  }

  destroy(): void {
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}
