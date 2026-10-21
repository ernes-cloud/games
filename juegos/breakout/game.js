(() => {
  const W = 480, H = 640;
  const COLS = 8, ROWS = 6, PAD = 16, GAP = 6, TOP = 80, BH = 20;
  const BW = (W - 2 * PAD - (COLS - 1) * GAP) / COLS;
  const ROW_COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'];
  const PADDLE_SPEED = 560;

  const canvas = document.getElementById('game');
  const ctx = Arcade.setupCanvas(canvas, W, H);
  const board = Arcade.scoreboard('breakout');
  const overlay = Arcade.createOverlay(document.getElementById('overlay'));
  const fx = Arcade.particles();

  const paddle = { x: W / 2, w: 90, h: 12, y: H - 48 };
  const keys = { left: false, right: false };
  let ball, bricks, score, lives, level, speed, stuck;
  let running = false, paused = false, last = performance.now();

  function buildBricks() {
    bricks = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const hits = level >= 3 && r < 2 ? 2 : 1;
        bricks.push({
          x: PAD + c * (BW + GAP), y: TOP + r * (BH + GAP), w: BW, h: BH,
          color: ROW_COLORS[r], points: (ROWS - r) * 10, hits,
        });
      }
    }
  }

  function resetBall() {
    stuck = true;
    ball = { x: paddle.x, y: paddle.y - 8, vx: 0, vy: 0, r: 7 };
  }

  function launch() {
    if (!running || paused || !stuck) return;
    stuck = false;
    const a = Math.random() * 0.6 - 0.3;
    ball.vx = speed * Math.sin(a);
    ball.vy = -speed * Math.cos(a);
  }

  const overlaps = (b, r) => b.x + b.r > r.x && b.x - b.r < r.x + r.w && b.y + b.r > r.y && b.y - b.r < r.y + r.h;

  function hitBrick() {
    const b = bricks.find((br) => br.hits > 0 && overlaps(ball, br));
    if (!b) return false;
    b.hits--;
    if (b.hits === 0) {
      score += b.points;
      board.set(score);
      fx.burst(b.x + b.w / 2, b.y + b.h / 2, b.color, 14);
    }
    return true;
  }

  function update(dt) {
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, paddle.x + dir * PADDLE_SPEED * dt));

    if (stuck) {
      ball.x = paddle.x;
      ball.y = paddle.y - ball.r - 1;
      return;
    }

    // Subpasos para que la bola no atraviese ladrillos a alta velocidad.
    const steps = Math.ceil(Math.hypot(ball.vx, ball.vy) * dt / 4);
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      ball.x += ball.vx * sdt;
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (hitBrick()) { ball.x -= ball.vx * sdt; ball.vx = -ball.vx; }

      ball.y += ball.vy * sdt;
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
      if (hitBrick()) { ball.y -= ball.vy * sdt; ball.vy = -ball.vy; }

      const pr = { x: paddle.x - paddle.w / 2, y: paddle.y, w: paddle.w, h: paddle.h };
      if (ball.vy > 0 && overlaps(ball, pr)) {
        // El ángulo de rebote depende de dónde golpea la bola en la pala.
        const rel = Math.max(-1, Math.min(1, (ball.x - paddle.x) / (paddle.w / 2)));
        const a = rel * (Math.PI / 3);
        const s = Math.hypot(ball.vx, ball.vy);
        ball.vx = s * Math.sin(a);
        ball.vy = -s * Math.cos(a);
        ball.y = paddle.y - ball.r;
      }

      if (ball.y - ball.r > H) {
        loseLife();
        return;
      }
    }

    if (bricks.every((b) => b.hits <= 0)) {
      level++;
      speed *= 1.1;
      buildBricks();
      resetBall();
    }
  }

  function loseLife() {
    lives--;
    fx.burst(ball.x, H - 4, '#f8fafc', 18);
    if (lives <= 0) {
      gameOver();
    } else {
      resetBall();
    }
  }

  function start() {
    score = 0;
    lives = 3;
    level = 1;
    speed = 380;
    paddle.x = W / 2;
    board.set(0);
    fx.clear();
    buildBricks();
    resetBall();
    overlay.hide();
    running = true;
    paused = false;
  }

  function gameOver() {
    running = false;
    const record = board.finish(score);
    overlay.show('Fin de la partida', Arcade.gameOverText(score, record, `<br>Nivel alcanzado: <b>${level}</b>`), 'Jugar otra vez', start);
  }

  function resume() { paused = false; overlay.hide(); }

  Arcade.onPause((onlyPause) => {
    if (!running) return;
    if (paused) { if (!onlyPause) resume(); return; }
    paused = true;
    overlay.show('Pausa', 'La bola sigue en el aire... casi.', 'Continuar', resume);
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') launch();
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  });

  function followPointer(e) {
    if (!running || paused) return;
    const { x } = Arcade.pointerPos(canvas, e, W, H);
    paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, x));
  }
  canvas.addEventListener('pointermove', followPointer);
  canvas.addEventListener('pointerdown', (e) => { followPointer(e); launch(); });

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0f0c29');
    g.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const b of bricks) {
      if (b.hits <= 0) continue;
      ctx.fillStyle = b.color;
      Arcade.roundRect(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, 4);
      if (b.hits > 1) {
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        Arcade.roundRect(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 4);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#e2e8f0';
    Arcade.roundRect(ctx, paddle.x - paddle.w / 2, paddle.y, paddle.w, paddle.h, 6);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = '#a5f3fc';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    fx.draw(ctx);

    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillStyle = '#f472b6';
    ctx.fillText('♥'.repeat(Math.max(0, lives)), 16, 40);
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`NIVEL ${level}`, W - 16, 40);
    ctx.textAlign = 'left';

    if (running && stuck && !paused) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TOCA O PULSA ESPACIO', W / 2, H / 2 + 60);
      ctx.textAlign = 'left';
    }
  }

  function loop(t) {
    const dt = Math.min(t - last, 50) / 1000;
    last = t;
    if (running && !paused) update(dt);
    fx.update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  level = 1;
  lives = 3;
  speed = 380;
  buildBricks();
  resetBall();
  overlay.show('Breakout', 'Rompe todos los ladrillos sin dejar caer la bola. Tienes 3 vidas.', 'Jugar', start);
  requestAnimationFrame(loop);
})();
