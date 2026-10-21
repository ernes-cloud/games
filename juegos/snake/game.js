(() => {
  const W = 400, H = 400, N = 20, C = W / N;
  const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };

  const canvas = document.getElementById('game');
  const ctx = Arcade.setupCanvas(canvas, W, H);
  const board = Arcade.scoreboard('snake');
  const overlay = Arcade.createOverlay(document.getElementById('overlay'));
  const fx = Arcade.particles();

  let snake, dir, queue, food, score, stepMs;
  let acc = 0, last = performance.now(), running = false, paused = false;

  function reset() {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    dir = DIRS.right;
    queue = [];
    score = 0;
    stepMs = 130;
    acc = 0;
    fx.clear();
    board.set(0);
    placeFood();
  }

  function placeFood() {
    const free = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  // Encola giros para que dos pulsaciones rápidas no se pierdan ni permitan dar media vuelta.
  function turn(name) {
    if (!running || paused) return;
    const d = DIRS[name];
    const prev = queue.length ? queue[queue.length - 1] : dir;
    if ((d.x === -prev.x && d.y === -prev.y) || d === prev || queue.length >= 3) return;
    queue.push(d);
  }

  function step() {
    if (queue.length) dir = queue.shift();
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const eats = food && head.x === food.x && head.y === food.y;
    const body = eats ? snake : snake.slice(0, -1);
    if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N ||
        body.some((s) => s.x === head.x && s.y === head.y)) {
      gameOver();
      return;
    }
    snake.unshift(head);
    if (eats) {
      score += 10;
      board.set(score);
      stepMs = Math.max(60, stepMs - 3);
      fx.burst(food.x * C + C / 2, food.y * C + C / 2, '#f87171', 14, 120);
      placeFood();
      if (!food) gameOver();
    } else {
      snake.pop();
    }
  }

  function start() {
    reset();
    overlay.hide();
    running = true;
    paused = false;
  }

  function gameOver() {
    running = false;
    const record = board.finish(score);
    overlay.show('Fin de la partida', Arcade.gameOverText(score, record), 'Jugar otra vez', start);
  }

  function resume() { paused = false; overlay.hide(); }

  Arcade.onPause((onlyPause) => {
    if (!running) return;
    if (paused) { if (!onlyPause) resume(); return; }
    paused = true;
    overlay.show('Pausa', 'Tómate un respiro.', 'Continuar', resume);
  });

  document.addEventListener('keydown', (e) => { if (KEYS[e.code]) turn(KEYS[e.code]); });

  document.querySelectorAll('[data-dir]').forEach((btn) => {
    Arcade.bindButton(btn, () => turn(btn.dataset.dir));
  });

  // Deslizar el dedo sobre el tablero.
  let swipe = null;
  canvas.addEventListener('pointerdown', (e) => { swipe = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    swipe = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointerup', () => { swipe = null; });

  function draw() {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let y = 0; y < N; y++) {
      for (let x = (y % 2); x < N; x += 2) ctx.fillRect(x * C, y * C, C, C);
    }

    if (food) {
      ctx.save();
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(food.x * C + C / 2, food.y * C + C / 2, C * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(food.x * C + C / 2, food.y * C + 2, 3, 5);
    }

    snake.forEach((s, i) => {
      const t = i / Math.max(1, snake.length - 1);
      ctx.fillStyle = `hsl(${142 - t * 20}, 70%, ${58 - t * 22}%)`;
      Arcade.roundRect(ctx, s.x * C + 1, s.y * C + 1, C - 2, C - 2, i === 0 ? 7 : 5);
      ctx.fill();
    });

    // Ojos mirando hacia donde avanza.
    const h = snake[0];
    const cx = h.x * C + C / 2, cy = h.y * C + C / 2;
    const px = -dir.y, py = dir.x;
    ctx.fillStyle = '#0f172a';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + dir.x * 4 + px * side * 4.5, cy + dir.y * 4 + py * side * 4.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    fx.draw(ctx);
  }

  function loop(t) {
    const dt = Math.min(t - last, 250);
    last = t;
    if (running && !paused) {
      acc += dt;
      while (running && acc >= stepMs) {
        acc -= stepMs;
        step();
      }
    }
    fx.update(dt / 1000);
    draw();
    requestAnimationFrame(loop);
  }

  reset();
  overlay.show('Snake', 'Come manzanas para crecer. ¡No choques con las paredes ni contigo mismo!', 'Jugar', start);
  requestAnimationFrame(loop);
})();
