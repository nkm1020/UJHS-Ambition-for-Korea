import type { Seat, StageAnchor } from "@/lib/types";

/**
 * Seat positions as fractions of the stage box. `y` is where a seated body
 * meets the far edge of the table. A 3D stage should frame its camera so
 * heads land roughly here, or report exact positions through onAnchors.
 */
export const SEAT_LAYOUT: Record<Seat, { x: number; y: number }> = {
  0: { x: 0.13, y: 0.548 },
  1: { x: 0.31, y: 0.503 },
  2: { x: 0.5, y: 0.488 },
  3: { x: 0.69, y: 0.503 },
  4: { x: 0.87, y: 0.548 },
};

/** Seated avatar width in px for a stage of the given width. */
export function avatarSize(stageWidth: number): number {
  return Math.min(stageWidth * 0.23, 124);
}

/** Where a speech bubble should point for a seat, above the head. */
export function defaultAnchor(seat: Seat, width: number, height: number): StageAnchor {
  const size = avatarSize(width);
  const { x, y } = SEAT_LAYOUT[seat];
  return { x: x * width, y: y * height - size * 1.02 };
}

/** -1 = turn left, 1 = turn right, 0 = face camera. */
export function lookDirection(from: Seat, to: Seat | null): -1 | 0 | 1 {
  if (to === null || to === from) return 0;
  return to < from ? -1 : 1;
}
