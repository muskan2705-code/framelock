// ── GESTURE DETECTOR ─────────────────────────────────────────────────────────
// Frame gesture: thumb tip + index tip of EACH hand form the four corners.
// Pinch gesture: thumb tip + index tip of ONE hand close together = grab.

import type { Landmark, Rect } from './types.ts';
import { LM, handCenterX } from './HandTracker.ts';

export interface FrameGesture {
  rect: Rect;        // display (mirrored) coords 0-1
  confidence: number;
}

export interface PinchState {
  active: boolean;
  rawX: number;   // unmirrored normalized x (0-1)
  rawY: number;   // normalized y (0-1)
}

export function mirrorX(x: number): number { return 1 - x; }

// Split hands by mirrored position: landscape=L/R, portrait=T/B
export function assignHandsToPlayers(
  landmarks: Landmark[][],
  orientation: 'landscape' | 'portrait'
): { p1Hands: Landmark[][]; p2Hands: Landmark[][] } {
  const p1Hands: Landmark[][] = [];
  const p2Hands: Landmark[][] = [];
  for (const hand of landmarks) {
    if (orientation === 'portrait') {
      const y = handCenterX(hand, 'y'); // 0=top, 1=bottom
      if (y < 0.5) p1Hands.push(hand);  // P1 on Top
      else         p2Hands.push(hand);  // P2 on Bottom
    } else {
      const mx = mirrorX(handCenterX(hand)); // 0=left, 1=right
      if (mx < 0.5) p1Hands.push(hand);  // P1 on Left
      else          p2Hands.push(hand);  // P2 on Right
    }
  }
  return { p1Hands, p2Hands };
}

// --- helpers -----------------------------------------------------------------
function fingerTips(hand: Landmark[]): { x: number; y: number }[] {
  return [hand[LM.THUMB_TIP], hand[LM.INDEX_TIP]];
}

function tipsRect(hands: Landmark[][]): Rect | null {
  const pts = [...fingerTips(hands[0]), ...fingerTips(hands[1])];
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 0.08 || h < 0.05) return null;

  // Make it a perfect square centered on the midpoint
  const side = Math.max(w, h);
  const cx = minX + w / 2;
  const cy = minY + h / 2;

  return {
    x: cx - side / 2,
    y: cy - side / 2,
    w: side,
    h: side
  };
}

// Frame in DISPLAY (mirrored) coords — for overlay drawing
export function detectFrameGesture(hands: Landmark[][]): FrameGesture | null {
  if (hands.length < 2) return null;
  const raw = tipsRect(hands);
  if (!raw) return null;
  const ratio = raw.w / raw.h;
  const confidence = ratio > 0.3 && ratio < 3.0 ? 1.0 : 0.5;
  return {
    rect: { x: mirrorX(raw.x + raw.w), y: raw.y, w: raw.w, h: raw.h },
    confidence,
  };
}

// Frame in RAW (unmirrored) coords — for image cropping
export function detectFrameRaw(hands: Landmark[][]): Rect | null {
  if (hands.length < 2) return null;
  return tipsRect(hands);
}

export function rectsAreStable(a: Rect, b: Rect, threshold = 0.04): boolean {
  return (
    Math.abs(a.x - b.x) < threshold &&
    Math.abs(a.y - b.y) < threshold &&
    Math.abs(a.w - b.w) < threshold &&
    Math.abs(a.h - b.h) < threshold
  );
}

// Pinch = thumb tip & index tip distance < threshold
// Returns raw (unmirrored) normalized coordinates of the pinch midpoint
export function detectPinch(hand: Landmark[]): PinchState {
  const thumb = hand[LM.THUMB_TIP];
  const index = hand[LM.INDEX_TIP];
  const dist  = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  return {
    active: dist < 0.07,
    rawX: (thumb.x + index.x) / 2,
    rawY: (thumb.y + index.y) / 2,
  };
}

// Get the strongest (first active) pinch from a player's hands
export function getBestPinch(hands: Landmark[][]): PinchState | null {
  for (const hand of hands) {
    const p = detectPinch(hand);
    if (p.active) return p;
  }
  return null;
}
