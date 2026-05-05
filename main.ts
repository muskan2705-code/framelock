import './style.css';
import { CameraManager }  from './CameraManager.ts';
import { HandTracker }    from './HandTracker.ts';
import {
  assignHandsToPlayers,
  detectFrameGesture,
  detectFrameRaw,
  rectsAreStable,
  getBestPinch,
} from './GestureDetector.ts';
import type { PinchState } from './GestureDetector.ts';
import { createPuzzle, pickupTile, updateDragPos, dropTile } from './PuzzleBoard.ts';
import { Renderer }       from './Renderer.ts';
import { UIController }   from './UIController.ts';
import type { GameState, PlayerState, Rect } from './types.ts';

const STABLE_DURATION_MS = 1500;
const CANVAS_W = 640;
const CANVAS_H = 360;

const camera  = new CameraManager();
const tracker = new HandTracker();
const renderer= new Renderer();
const ui      = new UIController();

let animFrame = 0;
let gameRunning = false;

// Per-player previous rects for stability check
let p1PrevRect: Rect | null = null;
let p2PrevRect: Rect | null = null;

// Pinch state tracking (was pinching last frame?)
let p1WasPinching = false;
let p2WasPinching = false;

function makePlayer(id: 1 | 2): PlayerState {
  return { id, status: 'waiting_for_gesture', gestureStableMs: 0 };
}

let state: GameState = {
  phase: 'idle',
  players: [makePlayer(1), makePlayer(2)],
  winner: null,
};

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot(): Promise<void> {
  ui.showScreen('loading-screen');
  ui.setLoadingProgress(10, 'Loading hand tracker...');

  let skipResolve: (() => void) | null = null;
  const skipPromise = new Promise<void>(r => { skipResolve = r; });
  (window as any).__skipLoad = () => skipResolve?.();

  let fakeProgress = 10;
  const fakeInterval = setInterval(() => {
    fakeProgress = Math.min(fakeProgress + 3, 85);
    ui.setLoadingProgress(fakeProgress, 'Loading hand tracker...');
  }, 200);

  try {
    await Promise.race([tracker.load(), skipPromise]);
    clearInterval(fakeInterval);
    ui.setLoadingProgress(100, 'Systems online ✓');
  } catch (err) {
    clearInterval(fakeInterval);
    console.warn('MediaPipe unavailable:', err);
    ui.setLoadingProgress(100, 'Ready (limited mode)');
  }

  await new Promise(r => setTimeout(r, 500));
  ui.showScreen('start-screen');
}

// ── Start ─────────────────────────────────────────────────────────────────────
async function startGame(): Promise<void> {
  ui.showScreen('game-screen');
  try {
    await camera.start();
  } catch (_) {
    ui.showError('Camera Error', 'Could not access webcam. Please allow camera permission and try again.');
    document.getElementById('retry-btn')!.onclick = () => location.reload();
    return;
  }
  renderer.resize(CANVAS_W, CANVAS_H);
  resetState();
  gameRunning = true;
  loop();
}

function resetState(): void {
  state = { phase: 'gesture_capture', players: [makePlayer(1), makePlayer(2)], winner: null };
  p1PrevRect = null;
  p2PrevRect = null;
  p1WasPinching = false;
  p2WasPinching = false;
  ui.hideWinner();
  for (const p of state.players) {
    ui.updatePlayerStatus(p);
    ui.updateTimer(p.id, 0);
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────
async function loop(): Promise<void> {
  if (!gameRunning) return;
  const now = Date.now();

  if (tracker.isLoaded() && camera.ready) {
    await tracker.detect(camera.videoEl);
  }

  const hands  = tracker.getLatest();
  const { p1Hands, p2Hands } = assignHandsToPlayers(hands.landmarks);
  const p1 = state.players[0];
  const p2 = state.players[1];

  // ── Gesture capture phase ─────────────────────────────────────────────────
  if (state.phase === 'gesture_capture' || state.phase === 'solving') {
    if (p1.status === 'waiting_for_gesture' || p1.status === 'countdown') processGesture(p1, p1Hands);
    if (p2.status === 'waiting_for_gesture' || p2.status === 'countdown') processGesture(p2, p2Hands);
  }

  // ── Pinch-to-drag solving ─────────────────────────────────────────────────
  const p1Pinch = (p1.status === 'solving') ? getBestPinch(p1Hands) : null;
  const p2Pinch = (p2.status === 'solving') ? getBestPinch(p2Hands) : null;

  if (p1.status === 'solving') processPinch(p1, p1Pinch, p1WasPinching);
  if (p2.status === 'solving') processPinch(p2, p2Pinch, p2WasPinching);
  p1WasPinching = p1Pinch?.active ?? false;
  p2WasPinching = p2Pinch?.active ?? false;

  // ── Timers ────────────────────────────────────────────────────────────────
  for (const player of state.players) {
    if (player.status === 'solving' && player.startTime) {
      ui.updateTimer(player.id, now - player.startTime);
    }
  }

  // ── Frame gesture visualization ───────────────────────────────────────────
  const p1Frame    = (p1.status === 'waiting_for_gesture' || p1.status === 'countdown') ? detectFrameGesture(p1Hands) : null;
  const p2Frame    = (p2.status === 'waiting_for_gesture' || p2.status === 'countdown') ? detectFrameGesture(p2Hands) : null;
  const p1Progress = p1.status === 'countdown' ? Math.min(p1.gestureStableMs / STABLE_DURATION_MS, 1) : 0;
  const p2Progress = p2.status === 'countdown' ? Math.min(p2.gestureStableMs / STABLE_DURATION_MS, 1) : 0;

  // ── Draw ──────────────────────────────────────────────────────────────────
  renderer.drawCameraFrame(camera.videoEl, hands, p1Frame, p2Frame, p1Progress, p2Progress, p1Pinch, p2Pinch);

  // Puzzle overlays on top of camera canvas
  if (p1.status === 'solving' || p1.status === 'completed') renderer.renderPuzzleOverlay(p1);
  if (p2.status === 'solving' || p2.status === 'completed') renderer.renderPuzzleOverlay(p2);

  animFrame = requestAnimationFrame(loop);
}

// ── Gesture capture ───────────────────────────────────────────────────────────
function processGesture(
  player: PlayerState,
  hands:  Array<Array<{ x: number; y: number; z: number }>>
): void {
  const rawRect = detectFrameRaw(hands);
  if (!rawRect) {
    player.gestureStableMs = 0;
    player.status = 'waiting_for_gesture';
    ui.updatePlayerStatus(player);
    if (player.id === 1) p1PrevRect = null;
    else                 p2PrevRect = null;
    return;
  }

  const prevRect = player.id === 1 ? p1PrevRect : p2PrevRect;
  if (prevRect && rectsAreStable(prevRect, rawRect, 0.05)) {
    player.gestureStableMs += 16;
    player.status = 'countdown';
    ui.updatePlayerStatus(player);
  } else {
    player.gestureStableMs = Math.max(0, player.gestureStableMs - 8);
    if (player.gestureStableMs === 0) {
      player.status = 'waiting_for_gesture';
      ui.updatePlayerStatus(player);
    }
  }

  if (player.id === 1) p1PrevRect = rawRect;
  else                 p2PrevRect = rawRect;

  if (player.gestureStableMs >= STABLE_DURATION_MS) captureFrame(player, rawRect);
}

// ── Frame capture ─────────────────────────────────────────────────────────────
function captureFrame(player: PlayerState, rawRect: Rect): void {
  player.status = 'capturing';
  ui.updatePlayerStatus(player);
  renderer.flashCapture();

  const cw = CANVAS_W, ch = CANVAS_H;
  const px = { x: rawRect.x * cw, y: rawRect.y * ch, w: rawRect.w * cw, h: rawRect.h * ch };
  if (px.w < 60 || px.h < 60) {
    player.status = 'waiting_for_gesture';
    player.gestureStableMs = 0;
    ui.updatePlayerStatus(player);
    return;
  }

  const capturedImg = camera.cropRegion(
    { x: Math.max(0, px.x), y: Math.max(0, px.y), w: Math.min(px.w, cw - px.x), h: Math.min(px.h, ch - px.y) },
    cw, ch
  );

  player.capturedImage    = capturedImg;
  player.puzzle           = createPuzzle(capturedImg);
  player.frameRectRaw     = rawRect;          // store for overlay rendering
  player.startTime        = Date.now();
  player.status           = 'solving';
  player.gestureStableMs  = 0;
  ui.updatePlayerStatus(player);

  if (state.players.every(p => p.status === 'solving' || p.status === 'completed')) {
    state.phase = 'solving';
  }
}

// ── Pinch-to-drag ─────────────────────────────────────────────────────────────
function processPinch(player: PlayerState, pinch: PinchState | null, wasPinching: boolean): void {
  if (!player.puzzle || !player.frameRectRaw) return;

  const raw  = player.frameRectRaw;
  const cw   = CANVAS_W;
  const ch   = CANVAS_H;

  // Frame in display (mirrored) canvas pixels
  const fx   = (1 - raw.x - raw.w) * cw;
  const fy   = raw.y * ch;
  const fw   = raw.w * cw;
  const fh   = raw.h * ch;

  if (!pinch) {
    // Pinch released — drop tile
    if (wasPinching && player.puzzle.dragState) {
      const ds     = player.puzzle.dragState;
      const localX = ds.canvasX - fx;
      const localY = ds.canvasY - fy;
      player.puzzle = dropTile(player.puzzle, localX, localY, fw, fh);
      if (player.puzzle.solved) handlePuzzleSolved(player.id);
    }
    return;
  }

  // Convert raw pinch to display canvas pixels
  const dispX = (1 - pinch.rawX) * cw;
  const dispY = pinch.rawY * ch;

  if (!wasPinching) {
    // New pinch — pick up tile under pinch position
    const localX = dispX - fx;
    const localY = dispY - fy;
    player.puzzle = pickupTile(player.puzzle, localX, localY, fw, fh, dispX, dispY);
  } else if (player.puzzle.dragState) {
    // Continue dragging
    player.puzzle = updateDragPos(player.puzzle, dispX, dispY);
  }
}

// ── Win ───────────────────────────────────────────────────────────────────────
function handlePuzzleSolved(playerId: 1 | 2): void {
  const player = state.players[playerId - 1];
  player.status        = 'completed';
  player.completedTime = Date.now();
  ui.updatePlayerStatus(player);
  if (state.winner === null) {
    state.winner = playerId;
    state.phase  = 'game_over';
    ui.showWinner(state);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById('start-btn')!.addEventListener('click', startGame);
document.getElementById('restart-btn')!.addEventListener('click', () => {
  if (animFrame) cancelAnimationFrame(animFrame);
  gameRunning = false;
  setTimeout(() => { gameRunning = true; resetState(); loop(); }, 200);
});

boot();
