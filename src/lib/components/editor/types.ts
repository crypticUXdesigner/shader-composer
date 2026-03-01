export type ViewMode = 'node' | 'split' | 'full';

export interface LayoutCallbacks {
  onCopyPreset?: () => Promise<void> | void;
  onExport?: () => Promise<void> | void;
  onVideoExport?: () => Promise<void>;
  onLoadPreset?: (presetName: string) => Promise<void> | void;
  /** Called when user selects a preset file; receives JSON string. App should load via loadPresetFromJson and apply graph. */
  onImportPresetFromFile?: (json: string) => Promise<void> | void;
  onZoomChange?: (zoom: number) => void;
  getZoom?: () => number;
  isHelpEnabled?: () => boolean;
  onHelpClick?: () => void;
  onPanelToggle?: () => void;
}
