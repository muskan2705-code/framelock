// ── PUZZLE BOARD ─────────────────────────────────────────────────────────────

import type { PuzzleState, Tile, DragState } from './types.ts';

const GRID_SIZE = 3;

// ── Create ───────────────────────────────────────────────────────────────────
export function createPuzzle(img: HTMLCanvasElement): PuzzleState {
  const gridSize = GRID_SIZE;
  const tileW = Math.floor(img.width  / gridSize);
  const tileH = Math.floor(img.height / gridSize);

  const tiles: Tile[] = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const index = row * gridSize + col;
      const tc = document.createElement('canvas');
      tc.width  = tileW; tc.height = tileH;
      tc.getContext('2d')!.drawImage(img, col * tileW, row * tileH, tileW, tileH, 0, 0, tileW, tileH);
      tiles.push({ index, correct: index, img: tc });
    }
  }

  return {
    tiles: shuffleSolvable(tiles),
    gridSize,
    tileW, tileH,
    dragState: null,
    moveCount: 0,
    solved: false,
  };
}

function shuffleSolvable(tiles: Tile[]): Tile[] {
  const arr = [...tiles];
  for (let i = 0; i < 60; i++) {
    const a = Math.floor(Math.random() * arr.length);
    const b = Math.floor(Math.random() * arr.length);
    if (a !== b) {
      const tmp = arr[a].index;
      arr[a] = { ...arr[a], index: arr[b].index };
      arr[b] = { ...arr[b], index: tmp };
    }
  }
  const positioned = new Array(arr.length);
  for (const tile of arr) positioned[tile.index] = tile;
  return positioned;
}

// ── Solve check ───────────────────────────────────────────────────────────────
export function checkSolved(state: PuzzleState): boolean {
  return state.tiles.every(t => t.index === t.correct);
}

// ── Swap ──────────────────────────────────────────────────────────────────────
export function swapTiles(state: PuzzleState, posA: number, posB: number): PuzzleState {
  const tiles = [...state.tiles];
  const a = { ...tiles[posA] };
  const b = { ...tiles[posB] };
  tiles[posA] = { ...b, index: posA };
  tiles[posB] = { ...a, index: posB };
  const newState: PuzzleState = { ...state, tiles, moveCount: state.moveCount + 1, dragState: null };
  newState.solved = checkSolved(newState);
  return newState;
}

// ── Drag helpers ──────────────────────────────────────────────────────────────
// localX/Y = pinch position relative to frame top-left, in canvas pixels
// frameW/H = frame size in canvas pixels

function posToGridIdx(localX: number, localY: number, frameW: number, frameH: number, gridSize: number): number {
  const col = Math.min(Math.max(Math.floor((localX / frameW) * gridSize), 0), gridSize - 1);
  const row = Math.min(Math.max(Math.floor((localY / frameH) * gridSize), 0), gridSize - 1);
  return row * gridSize + col;
}

export function pickupTile(
  state: PuzzleState,
  localX: number, localY: number,
  frameW: number, frameH: number,
  canvasX: number, canvasY: number
): PuzzleState {
  const tileIdx = posToGridIdx(localX, localY, frameW, frameH, state.gridSize);
  return { ...state, dragState: { tileIdx, canvasX, canvasY } };
}

export function updateDragPos(state: PuzzleState, canvasX: number, canvasY: number): PuzzleState {
  if (!state.dragState) return state;
  return { ...state, dragState: { ...state.dragState, canvasX, canvasY } };
}

export function dropTile(
  state: PuzzleState,
  localX: number, localY: number,
  frameW: number, frameH: number
): PuzzleState {
  if (!state.dragState) return state;
  const from = state.dragState.tileIdx;
  const to   = posToGridIdx(localX, localY, frameW, frameH, state.gridSize);
  const cleared = { ...state, dragState: null };
  if (from === to) return cleared;
  return swapTiles(cleared, from, to);
}

// ── Render puzzle onto camera canvas ─────────────────────────────────────────
export function renderPuzzle(
  ctx: CanvasRenderingContext2D,
  state: PuzzleState,
  frameX: number, frameY: number,
  frameW: number, frameH: number,
  color: string
): void {
  const { tiles, gridSize, dragState } = state;
  const cellW = frameW / gridSize;
  const cellH = frameH / gridSize;

  // Semi-transparent dark backdrop so tiles are readable over camera feed
  ctx.fillStyle = 'rgba(5, 8, 16, 0.65)';
  ctx.fillRect(frameX, frameY, frameW, frameH);

  // Draw all tiles except the one being dragged
  for (let i = 0; i < tiles.length; i++) {
    if (dragState && dragState.tileIdx === i) continue;

    const tile = tiles[i];
    const col  = i % gridSize;
    const row  = Math.floor(i / gridSize);
    const x    = frameX + col * cellW;
    const y    = frameY + row * cellH;

    ctx.drawImage(tile.img, x, y, cellW, cellH);

    // Green glow on correctly-placed tiles
    if (tile.index === tile.correct) {
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.globalAlpha = 0.55;
      ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
      ctx.globalAlpha = 1;
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(x, y, cellW, cellH);
  }

  // Frame border
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.setLineDash([6, 3]);
  ctx.strokeRect(frameX, frameY, frameW, frameH);
  ctx.setLineDash([]);

  // Floating dragged tile follows the pinch
  if (dragState) {
    const tile = tiles[dragState.tileIdx];
    if (tile) {
      const hw = cellW / 2;
      const hh = cellH / 2;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur  = 24;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(tile.img, dragState.canvasX - hw, dragState.canvasY - hh, cellW, cellH);
      ctx.strokeStyle = color;
      ctx.lineWidth   = 3;
      ctx.strokeRect(dragState.canvasX - hw + 1, dragState.canvasY - hh + 1, cellW - 2, cellH - 2);
      ctx.restore();
    }
  }
}
