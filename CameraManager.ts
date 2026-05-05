// ── CAMERA MANAGER ───────────────────────────────────────────────────────────

export class CameraManager {
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  public ready = false;

  constructor() {
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.style.position = 'absolute';
    this.video.style.opacity = '0';
    this.video.style.pointerEvents = 'none';
    document.body.appendChild(this.video);
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await new Promise<void>((resolve, reject) => {
        this.video.onloadedmetadata = () => {
          this.video.play().then(resolve).catch(reject);
        };
        this.video.onerror = reject;
      });
      this.ready = true;
    } catch (err) {
      throw new Error(`Camera access failed: ${(err as Error).message}`);
    }
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.ready = false;
  }

  get videoEl(): HTMLVideoElement {
    return this.video;
  }

  get width(): number {
    return this.video.videoWidth || 640;
  }

  get height(): number {
    return this.video.videoHeight || 480;
  }

  // Draw mirrored frame to a canvas context
  drawMirrored(ctx: CanvasRenderingContext2D, dw: number, dh: number): void {
    if (!this.ready) return;
    ctx.save();
    ctx.translate(dw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this.video, 0, 0, dw, dh);
    ctx.restore();
  }

  // Capture a raw (unmirrored) crop from camera
  cropRegion(rect: { x: number; y: number; w: number; h: number }, displayW: number, displayH: number): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = rect.w;
    out.height = rect.h;
    const ctx = out.getContext('2d')!;

    // Scale rect back to native video coords
    const scaleX = this.width / displayW;
    const scaleY = this.height / displayH;

    // rect is in raw sensor coords (0-1), scale back to native video coords
    const realX = rect.x * scaleX;
    const realY = rect.y * scaleY;
    const realW = rect.w * scaleX;
    const realH = rect.h * scaleY;

    ctx.drawImage(this.video, realX, realY, realW, realH, 0, 0, rect.w, rect.h);
    return out;
  }
}
