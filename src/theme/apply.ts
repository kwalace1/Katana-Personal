import type { EffectiveTheme } from './types'

/**
 * Marks the document with the effective theme. Color variables stay in CSS
 * (`:root` and `.dark`) so Classic Light and Classic Dark do not repaint
 * from JavaScript and do not flash.
 */
export function applyThemeAttributes(
  effective: EffectiveTheme,
  root: HTMLElement = document.documentElement,
) {
  root.dataset.theme = effective.family
  root.dataset.contrast = effective.contrast
  root.dataset.rotation = effective.rotation
}
