// ── RENDERER ─────────────────────────────────────────────────────────────────

import type { HandResult, Rect, PlayerState } from './types.ts';
import type { FrameGesture, PinchState } from './GestureDetector.ts';
import { renderPuzzle } from './PuzzleBoard.ts';
import { LM } from './HandTracker.ts';

const P1_COLOR = '#00ffe7';
const P2_COLOR = '#ff00aa';

export class Renderer {
  private camCanvas: HTMLCanvasElement;
  private camCtx:    CanvasRenderingContext2D;

  constructor() {
    this.camCanvas = document.getElementById('camera-canvas') as HTMLCanvasElement;
    this.camCtx    = this.camCanvas.getContext('2d')!;
  }

  resize(w: number, h: number): void {
    this.camCanvas.width  = w;
    this.camCanvas.height = h;
  }

  // ── Main camera frame ───────────────────────────────────────────────────────
  drawCameraFrame(
    video:      HTMLVideoElement,
    handResults: HandResult,
    p1Frame:    FrameGesture | null,
    p2Frame:    FrameGesture | null,
    p1Stable:   number,
    p2Stable:   number,
    p1Pinch:    PinchState | null,
    p2Pinch:    PinchState | null,
  ): void {
    const w   = this.camCanvas.width;
    const h   = this.camCanvas.height;
    const ctx = this.camCtx;

    // Mirrored video
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    // Half-screen separator
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(w / 2 - 1, 0, 2, h);

    // Zone labels
    this.drawLabel(ctx, 'P1', 20,      20, P1_COLOR);
    this.drawLabel(ctx, 'P2', w - 48,  20, P2_COLOR);

    // Hand skeleton
    for (const lms of handResults.landmarks) {
      this.drawHand(ctx, lms, w, h);
    }

    // Fingertip dots (thumb + index highlighted for frame corners)
    for (const lms of handResults.landmarks) {
      this.drawCornerDots(ctx, lms, w, h);
    }

    // Frame rects
    if (p1Frame) this.drawFrameRect(ctx, p1Frame.rect, w, h, P1_COLOR, p1Stable);
    if (p2Frame) this.drawFrameRect(ctx, p2Frame.rect, w, h, P2_COLOR, p2Stable);

    // Pinch indicators while solving
    if (p1Pinch?.active) this.drawPinchDot(ctx, p1Pinch, w, h, P1_COLOR);
    if (p2Pinch?.active) this.drawPinchDot(ctx, p2Pinch, w, h, P2_COLOR);
  }

  // ── Puzzle overlay on camera canvas ────────────────────────────────────────
  renderPuzzleOverlay(player: PlayerState): void {
    if (!player.puzzle || !player.frameRectRaw) return;
    const raw   = player.frameRectRaw;
    const w     = this.camCanvas.width;
    const h     = this.camCanvas.height;
    const color = player.id === 1 ? P1_COLOR : P2_COLOR;

    // Convert raw (unmirrored) rect to display (mirrored) canvas pixels
    const fx = (1 - raw.x - raw.w) * w;
    const fy = raw.y * h;
    const fw = raw.w * w;
    const fh = raw.h * h;

    renderPuzzle(this.camCtx, player.puzzle, fx, fy, fw, fh, color);
  }

  // ── Flash capture ───────────────────────────────────────────────────────────
  flashCapture(): void {
    this.camCanvas.classList.add('capture-flash');
    setTimeout(() => this.camCanvas.classList.remove('capture-flash'), 300);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────
  private drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
    ctx.font      = 'bold 12px "Orbitron", monospace';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillText(text, x, y + 12);
    ctx.globalAlpha = 1;
  }

  private drawHand(ctx: CanvasRenderingContext2D, lms: Array<{x:number;y:number}>, w: number, h: number): void {
    const connections = [
      [0,1],[1,2],[2,3],[3,4],
      [0,5],[5,6],[6,7],[7,8],
      [5,9],[9,10],[10,11],[11,12],
      [9,13],[13,14],[14,15],[15,16],
      [13,17],[17,18],[18,19],[19,20],[0,17]
    ];
    ctx.strokeStyle  = 'rgba(255,255,255,0.3)';
    ctx.lineWidth    = 1.5;
    for (const [a, b] of connections) {
      ctx.beginPath();
      ctx.moveTo((1 - lms[a].x) * w, lms[a].y * h);
      ctx.lineTo((1 - lms[b].x) * w, lms[b].y * h);
      ctx.stroke();
    }
    // Small joint dots
    for (const lm of lms) {
      ctx.beginPath();
      ctx.arc((1 - lm.x) * w, lm.y * h, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    }
  }

  private drawCornerDots(ctx: CanvasRenderingContext2D, lms: Array<{x:number;y:number}>, w: number, h: number): void {
    // Thumb tip (4) and index tip (8) — the frame corners
    const tips = [lms[LM.THUMB_TIP], lms[LM.INDEX_TIP]];
    // Determine color by mirrored x position
    const mx    = 1 - lms[0].x; // mirrored wrist x
    const color = mx < 0.5 ? P1_COLOR : P2_COLOR;

    for (const tip of tips) {
      const px = (1 - tip.x) * w;
      const py = tip.y * h;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fillStyle   = color;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawFrameRect(
    ctx: CanvasRenderingContext2D,
    rect: Rect, w: number, h: number,
    color: string, progress: number
  ): void {
    const x  = rect.x * w;
    const y  = rect.y * h;
    const rw = rect.w * w;
    const rh = rect.h * h;

    ctx.shadowColor = color;
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(x, y, rw, rh);
    ctx.setLineDash([]);
    ctx.shadowBlur  = 0;

    // Progress arc
    if (progress > 0) {
      const cx     = x + rw / 2;
      const cy     = y + rh / 2;
      const radius = Math.min(rw, rh) * 0.14;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      if (progress > 0.1) {
        ctx.fillStyle      = color;
        ctx.font           = 'bold 14px "Orbitron", monospace';
        ctx.textAlign      = 'center';
        ctx.textBaseline   = 'middle';
        const secs = Math.ceil((1 - progress) * 1.5);
        ctx.fillText(secs > 0 ? secs.toString() : '✓', cx, cy);
        ctx.textAlign      = 'left';
        ctx.textBaseline   = 'alphabetic';
      }
    }

    // Corner brackets
    const bl = Math.min(rw, rh) * 0.14;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 10;
    ctx.beginPath(); ctx.moveTo(x, y + bl);       ctx.lineTo(x, y);         ctx.lineTo(x + bl, y);       ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+rw-bl, y);       ctx.lineTo(x+rw, y);      ctx.lineTo(x+rw, y+bl);      ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y+rh-bl);       ctx.lineTo(x, y+rh);      ctx.lineTo(x+bl, y+rh);      ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+rw-bl, y+rh);    ctx.lineTo(x+rw, y+rh);   ctx.lineTo(x+rw, y+rh-bl);   ctx.stroke();
    ctx.shadowBlur  = 0;

    // Subtle face guide
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x + rw / 2, y + rh * 0.45, rw * 0.25, rh * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawPinchDot(ctx: CanvasRenderingContext2D, pinch: PinchState, w: number, h: number, color: string): void {
    const px = (1 - pinch.rawX) * w;
    const py = pinch.rawY * h;
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fillStyle   = color + '33';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 12;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }
}
