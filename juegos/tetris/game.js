(() => {
  const COLS = 10, ROWS = 20, C = 30, BW = COLS * C, SIDE = 160, W = BW + SIDE, H = ROWS * C;
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  };
  const COLORS = { I: '#22d3ee', J: '#3b82f6', L: '#f97316', O: '#facc15', S: '#22c55e', T: '#a855f7', Z: '#ef4444' };
  const LINE_POINTS = [0, 100, 300, 500, 800];
  const KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];

  const canvas = document.getElementById('game');
  const ctx = Arcade.setupCanvas(canvas, W, H);
  const board = Arcade.scoreboard('tetris');
  const overlay = Arcade.createOverlay(document.getElementById('overlay'));

  let grid, bag, cur, next, score, lines, level, dropAcc;
  let running = false, paused = false, last = performance.now();

  const emptyGrid = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const rotateCW = (m) => m[0].map((_, i) => m.map((row) => row[i]).reverse());

  function nextType() {
    if (!bag.length) {
      bag = Object.keys(SHAPES);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function collides(m, x, y) {
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const nx = x + c, ny = y + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && grid[ny][nx]) return true;
      }
    }
    return false;
  }

  function spawn() {
    const type = next;
    next = nextType();
    const m = SHAPES[type].map((r) => r.slice());
    cur = { type, m, x: Math.floor((COLS - m[0].length) / 2), y: type === 'I' ? -1 : 0 };
    dropAcc = 0;
    if (collides(cur.m, cur.x, cur.y)) gameOver();
  }

  function interval() {
    return Math.max(50, 1000 * Math.pow(0.8 - (level - 1) * 0.007, level - 1));
  }

  function move(dx, dy) {
    if (collides(cur.m, cur.x + dx, cur.y + dy)) return false;
    cur.x += dx;
    cur.y += dy;
    return true;
  }

  function rotate(dir) {
    if (cur.type === 'O') return;
    let m = rotateCW(cur.m);
    if (dir < 0) m = rotateCW(rotateCW(m));
    for (const [kx, ky] of KICKS) {
      if (!collides(m, cur.x + kx, cur.y + ky)) {
        cur.m = m;
        cur.x += kx;
        cur.y += ky;
        return;
      }
    }
  }

  function softDrop() {
    if (move(0, 1)) {
      score += 1;
      board.set(score);
    } else {
      lock();
    }
    dropAcc = 0;
  }

  function hardDrop() {
    let n = 0;
    while (move(0, 1)) n++;
    score += n * 2;
    lock();
  }

  function lock() {
    for (let r = 0; r < cur.m.length; r++) {
      for (let c = 0; c < cur.m[r].length; c++) {
        if (!cur.m[r][c]) continue;
        if (cur.y + r < 0) { gameOver(); return; }
        grid[cur.y + r][cur.x + c] = cur.type;
      }
    }
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every(Boolean)) {
        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    score += LINE_POINTS[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    board.set(score);
    spawn();
  }

  function ghostY() {
    let y = cur.y;
    while (!collides(cur.m, cur.x, y + 1)) y++;
    return y;
  }

  function start() {
    grid = emptyGrid();
    bag = [];
    next = nextType();
    score = 0;
    lines = 0;
    level = 1;
    board.set(0);
    overlay.hide();
    running = true;
    paused = false;
    spawn();
  }

  function gameOver() {
    running = false;
    const record = board.finish(score);
    overlay.show('Fin de la partida',
      Arcade.gameOverText(score, record, `<br>Líneas: <b>${lines}</b> · Nivel: <b>${level}</b>`),
      'Jugar otra vez', start);
  }

  function resume() { paused = false; overlay.hide(); }

  Arcade.onPause((onlyPause) => {
    if (!running) return;
    if (paused) { if (!onlyPause) resume(); return; }
    paused = true;
    overlay.show('Pausa', 'La partida te espera.', 'Continuar', resume);
  });

  const actions = {
    left: () => move(-1, 0),
    right: () => move(1, 0),
    down: softDrop,
    rotate: () => rotate(1),
    rotateBack: () => rotate(-1),
    drop: hardDrop,
  };

  function act(name) {
    if (running && !paused) actions[name]();
  }

  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down', ArrowUp: 'rotate', KeyX: 'rotate', KeyW: 'rotate',
    KeyZ: 'rotateBack', Space: 'drop',
  };

  document.addEventListener('keydown', (e) => {
    const name = KEYS[e.code];
    if (!name) return;
    if (e.repeat && (name === 'drop' || name === 'rotate' || name === 'rotateBack')) return;
    act(name);
  });

  document.querySelectorAll('[data-act]').forEach((btn) => {
    const name = btn.dataset.act;
    if (name === 'left' || name === 'right' || name === 'down') {
      Arcade.bindRepeat(btn, () => act(name));
    } else {
      Arcade.bindButton(btn, () => act(name));
    }
  });

  function cell(x, y, color, size = C, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x + 1, y + 1, size - 2, Math.max(2, size * 0.14));
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + 1, y + size - 1 - Math.max(2, size * 0.14), size - 2, Math.max(2, size * 0.14));
    ctx.globalAlpha = 1;
  }

  function drawPiece(m, x, y, color, alpha) {
    m.forEach((row, r) => row.forEach((v, c) => {
      if (v && y + r >= 0) cell((x + c) * C, (y + r) * C, color, C, alpha);
    }));
  }

  function label(text, y) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText(text, BW + 20, y);
  }

  function value(text, y) {
    ctx.fillStyle = '#f8fafc';
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.fillText(text, BW + 20, y);
  }

  function draw() {
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, BW, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * C + 0.5, 0); ctx.lineTo(x * C + 0.5, H); ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * C + 0.5); ctx.lineTo(BW, y * C + 0.5); ctx.stroke();
    }

    if (grid) {
      grid.forEach((row, r) => row.forEach((t, c) => { if (t) cell(c * C, r * C, COLORS[t]); }));
    }
    if (cur && running) {
      drawPiece(cur.m, cur.x, ghostY(), COLORS[cur.type], 0.2);
      drawPiece(cur.m, cur.x, cur.y, COLORS[cur.type], 1);
    }

    // Panel lateral
    ctx.fillStyle = '#131a33';
    ctx.fillRect(BW, 0, SIDE, H);
    label('SIGUIENTE', 36);
    if (next) {
      const m = SHAPES[next];
      const s = 24;
      const ox = BW + (SIDE - m[0].length * s) / 2;
      m.forEach((row, r) => row.forEach((v, c) => { if (v) cell(ox + c * s, 56 + r * s, COLORS[next], s); }));
    }
    label('NIVEL', 200);
    value(String(level || 1), 228);
    label('LINEAS', 280);
    value(String(lines || 0), 308);
    label('PUNTOS', 360);
    value(String(score || 0), 388);
  }

  function loop(t) {
    const dt = Math.min(t - last, 250);
    last = t;
    if (running && !paused) {
      dropAcc += dt;
      if (dropAcc >= interval()) {
        dropAcc = 0;
        if (!move(0, 1)) lock();
      }
    }
    draw();
    requestAnimationFrame(loop);
  }

  grid = emptyGrid();
  overlay.show('Tetris', 'Encaja las piezas y completa líneas. Cada 10 líneas sube el nivel.', 'Jugar', start);
  requestAnimationFrame(loop);
})();
