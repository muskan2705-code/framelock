// ── UI CONTROLLER ─────────────────────────────────────────────────────────────

import type { PlayerState, GameState } from './types.ts';

export class UIController {
  private p1Status  = document.getElementById('p1-status')!;
  private p2Status  = document.getElementById('p2-status')!;
  private p1Timer   = document.getElementById('p1-timer')!;
  private p2Timer   = document.getElementById('p2-timer')!;
  private winOverlay        = document.getElementById('win-overlay')!;
  private winBadge          = document.getElementById('win-badge')!;
  private winTitle          = document.getElementById('win-title')!;
  private winTimes          = document.getElementById('win-times')!;
  private confettiContainer = document.getElementById('confetti-container')!;

  showScreen(id: 'loading-screen' | 'start-screen' | 'game-screen' | 'error-screen'): void {
    ['loading-screen', 'start-screen', 'game-screen', 'error-screen'].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.classList.toggle('hidden', s !== id);
    });
  }

  setLoadingProgress(pct: number, msg: string): void {
    const bar  = document.getElementById('loading-bar');
    const text = document.getElementById('loading-text');
    if (bar)  bar.style.width   = pct + '%';
    if (text) text.textContent  = msg;
  }

  showError(title: string, msg: string): void {
    const t = document.getElementById('error-title');
    const m = document.getElementById('error-msg');
    if (t) t.textContent = title;
    if (m) m.textContent = msg;
    this.showScreen('error-screen');
  }

  updatePlayerStatus(player: PlayerState): void {
    const statusEl = player.id === 1 ? this.p1Status : this.p2Status;
    const labels: Record<string, string> = {
      waiting_for_gesture: 'ALIGN FACE IN FRAME',
      countdown:           'HOLD STILL...',
      capturing:           'CAPTURING...',
      solving:             'PINCH TO DRAG TILES',
      completed:           'COMPLETED ✓',
    };
    statusEl.textContent = labels[player.status] || player.status.toUpperCase();
    statusEl.className   = 'player-status';
    if (player.status === 'countdown')  statusEl.classList.add('status-capturing');
    if (player.status === 'solving')    statusEl.classList.add('status-solving');
    if (player.status === 'completed')  statusEl.classList.add('status-done');
  }

  updateTimer(playerId: 1 | 2, ms: number): void {
    const el   = playerId === 1 ? this.p1Timer : this.p2Timer;
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60).toString().padStart(2, '0');
    const s    = (secs % 60).toString().padStart(2, '0');
    el.textContent = `${mins}:${s}`;
  }

  showWinner(state: GameState): void {
    const winner = state.winner!;
    const loser  = winner === 1 ? 2 : 1;
    const color  = winner === 1 ? 'p1' : 'p2';

    this.winBadge.textContent = `PLAYER ${winner} WINS`;
    this.winBadge.className   = `win-badge ${color}`;
    this.winTitle.textContent = 'PUZZLE SOLVED!';
    this.winTitle.style.color = winner === 1 ? '#00ffe7' : '#ff00aa';

    const wp = state.players[winner - 1];
    const lp = state.players[loser  - 1];
    const wTime = wp.completedTime && wp.startTime ? wp.completedTime - wp.startTime : 0;
    const lTime = lp.completedTime && lp.startTime ? lp.completedTime - lp.startTime : 0;

    const fmt = (ms: number) => {
      const s = Math.floor(ms / 1000);
      return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
    };

    this.winTimes.innerHTML = `
      <div style="color:${winner===1?'#00ffe7':'#ff00aa'}">Player ${winner}: ${fmt(wTime)} 🏆</div>
      ${lp.status === 'completed'
        ? `<div style="opacity:0.6">Player ${loser}: ${fmt(lTime)}</div>`
        : `<div style="opacity:0.6">Player ${loser}: DNF</div>`
      }
    `;

    this.winOverlay.classList.remove('hidden');
    this.launchConfetti(winner);
  }

  hideWinner(): void {
    this.winOverlay.classList.add('hidden');
    this.confettiContainer.innerHTML = '';
  }

  // resetPuzzleArea is a no-op — puzzle lives on camera canvas now
  resetPuzzleArea(_playerId: 1 | 2): void { /* no separate canvas */ }

  private launchConfetti(winner: 1 | 2): void {
    const colors = winner === 1
      ? ['#00ffe7', '#00aabb', '#ffffff', '#88ffee']
      : ['#ff00aa', '#aa0066', '#ffffff', '#ff88cc'];

    for (let i = 0; i < 80; i++) {
      const el    = document.createElement('div');
      el.className = 'confetti-particle';
      const color    = colors[Math.floor(Math.random() * colors.length)];
      const duration = 3 + Math.random() * 2;
      const delay    = Math.random() * 3;
      const size     = 6 + Math.random() * 10;
      el.style.cssText = `
        left:${Math.random()*100}vw;
        width:${size}px; height:${size}px;
        background:${color};
        border-radius:${Math.random()>0.5?'50%':'0%'};
        animation-duration:${duration}s;
        animation-delay:${delay}s;
        transform:rotate(${Math.random()*360}deg);
      `;
      this.confettiContainer.appendChild(el);
    }
  }
}
