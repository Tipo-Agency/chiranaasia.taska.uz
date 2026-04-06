/**
 * Fixed positioning for anchored dropdowns: prefers opening below, flips above if needed,
 * clamps to viewport so lists stay scrollable instead of clipped off-screen.
 */
export function computeAnchoredDropdownPosition(
  anchor: DOMRect,
  options?: {
    maxHeightPx?: number;
    gap?: number;
    viewportPad?: number;
    /** If wider than anchor (e.g. assignee list). */
    minWidth?: number;
  }
): { top: number; left: number; maxHeight: number; minWidth: number } {
  const maxDefault = options?.maxHeightPx ?? 256;
  const gap = options?.gap ?? 4;
  const pad = options?.viewportPad ?? 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const minWidth = Math.max(options?.minWidth ?? anchor.width, anchor.width);

  let left = anchor.left;
  if (left + minWidth > vw - pad) {
    left = Math.max(pad, vw - minWidth - pad);
  }
  if (left < pad) left = pad;

  const spaceBelow = vh - anchor.bottom - gap - pad;
  const spaceAbove = anchor.top - gap - pad;
  const openBelow = spaceBelow >= 120 || spaceBelow >= spaceAbove;

  let top: number;
  let maxHeight: number;

  if (openBelow) {
    top = anchor.bottom + gap;
    maxHeight = Math.min(maxDefault, Math.max(72, spaceBelow));
  } else {
    maxHeight = Math.min(maxDefault, Math.max(72, spaceAbove));
    top = anchor.top - gap - maxHeight;
    if (top < pad) {
      top = pad;
      maxHeight = Math.max(72, anchor.top - gap - pad);
    }
  }

  if (top + maxHeight > vh - pad) {
    maxHeight = Math.max(72, vh - pad - top);
  }

  return { top, left, maxHeight, minWidth };
}
