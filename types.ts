// ── TYPES ────────────────────────────────────────────────────────────────────

export interface Point { x: number; y: number; }
export interface Rect  { x: number; y: number; w: number; h: number; }

export interface Tile {
  index: number;   // current position in grid
  correct: number; // correct position index
  img: HTMLCanvasElement;
}

export interface DragState {
  tileIdx: number;  // grid position of tile being dragged
  canvasX: number;  // absolute display x on camera canvas (mirrored)
  canvasY: number;  // absolute display y on camera canvas
}

export interface PuzzleState {
  tiles: Tile[];
  gridSize: number;
  tileW: number;
  tileH: number;
  dragState: DragState | null;
  moveCount: number;
  solved: boolean;
}

export type PlayerStatus =
  | 'waiting_for_gesture'
  | 'countdown'
  | 'capturing'
  | 'solving'
  | 'completed';

export type GamePhase = 'idle' | 'gesture_capture' | 'solving' | 'game_over';

export interface PlayerState {
  id: 1 | 2;
  status: PlayerStatus;
  frameRectRaw?: Rect;          // unmirrored rect used for cropping + overlay
  capturedImage?: HTMLCanvasElement;
  puzzle?: PuzzleState;
  startTime?: number;
  completedTime?: number;
  countdownStart?: number;
  gestureStableMs: number;
}

export interface GameState {
  phase: GamePhase;
  players: [PlayerState, PlayerState];
  winner: 1 | 2 | null;
}

// MediaPipe landmark (normalized 0-1)
export interface Landmark { x: number; y: number; z: number; }

export interface HandResult {
  landmarks: Landmark[][];
  multiHandedness?: Array<{ label: string; score: number; index: number }>;
}
