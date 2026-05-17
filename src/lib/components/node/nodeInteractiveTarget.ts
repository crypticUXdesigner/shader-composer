/**
 * Targets inside a DOM node that should not trigger node selection or patch-into
 * double-click when the user is interacting with parameters / controls.
 */
const NODE_INTERACTIVE_TARGET_SELECTOR = [
  'button',
  'input',
  'textarea',
  'select',
  'a[href]',
  '.value-input-wrapper',
  '.knob',
  '.param-port',
  '[role="textbox"]',
  '[role="switch"]',
  '.toggle',
  '.bezier-editor',
  '.color-picker',
  '.color-picker-row',
  '.coord-pad',
  '.coord-pad-cell',
  '.remap-range-editor',
  '.frequency-range-editor',
  '.enum-selector-row',
  '.enum-selector-trigger',
  '.arrangement-track-filter',
  '.group-header-actions',
  '.mode-button',
].join(', ');

export function isNodeInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(NODE_INTERACTIVE_TARGET_SELECTOR));
}
