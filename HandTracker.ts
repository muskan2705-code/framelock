// ── HAND TRACKER ─────────────────────────────────────────────────────────────
// Uses MediaPipe Hands loaded from CDN to avoid bundler issues.

import type { HandResult, Landmark } from './types.ts';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

export type HandsCallback = (results: HandResult) => void;

export class HandTracker {
  private hands: any = null;
  private latestResults: HandResult = { landmarks: [] };
  private callback: HandsCallback | null = null;
  private loaded = false;

  async load(): Promise<void> {
    // Load MediaPipe from CDN
    await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js');
    await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('MediaPipe load timeout')), 8000);

      const init = () => {
        if (typeof window.Hands === 'undefined') {
          setTimeout(init, 200);
          return;
        }
        clearTimeout(timeout);

        this.hands = new window.Hands({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
        });

        this.hands.setOptions({
          maxNumHands: 4,
          modelComplexity: 0,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5,
        });

        this.hands.onResults((results: any) => {
          this.latestResults = {
            landmarks: results.multiHandLandmarks || [],
            multiHandedness: results.multiHandedness || [],
          };
          if (this.callback) this.callback(this.latestResults);
        });

        this.loaded = true;
        resolve();
      };

      init();
    });
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(s);
    });
  }

  onResults(cb: HandsCallback): void {
    this.callback = cb;
  }

  async detect(videoEl: HTMLVideoElement): Promise<void> {
    if (!this.loaded || !this.hands) return;
    try {
      await this.hands.send({ image: videoEl });
    } catch (_) {
      // silently skip frames
    }
  }

  getLatest(): HandResult {
    return this.latestResults;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

// Landmark indices
export const LM = {
  WRIST: 0,
  INDEX_TIP: 8,
  THUMB_TIP: 4,
  MIDDLE_TIP: 12,
  RING_TIP: 16,
  PINKY_TIP: 20,
  INDEX_MCP: 5,
};

// Get bounding box of a hand's landmarks in normalized coords
export function handBounds(lms: Landmark[]): { x: number; y: number; w: number; h: number } {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const lm of lms) {
    minX = Math.min(minX, lm.x);
    minY = Math.min(minY, lm.y);
    maxX = Math.max(maxX, lm.x);
    maxY = Math.max(maxY, lm.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Midpoint of wrist landmark for quick x-position comparison
export function handCenterX(lms: Landmark[]): number {
  return lms[LM.WRIST].x;
}
