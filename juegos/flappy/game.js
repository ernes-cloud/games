(() => {
  const W = 360, H = 640, GROUND = 90, FLOOR = H - GROUND;
  const BIRD_X = 100, R = 14, GRAVITY = 1500, FLAP = -470;
  const PIPE_W = 62, GAP = 165, SPEED = 170, SPACING = 220;

  const canvas = document.getElementById('game');
  const ctx = Arcade.setupCanvas(canvas, W, H);
  const board = Arcade.scoreboard('flappy');
  const overlay = Arcade.createOverlay(document.getElementById('overlay'));

  // Nubes y edificios del fondo, generados una vez.
  const clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 90 + Math.random() * 40, y: 60 + Math.random() * 160, s: 0.6 + Math.random() * 0.6 }));
  const city = Array.from({ length: 14 }, (_, i) => ({ x: i * 30, h: 40 + Math.random() * 70, w: 26 + Math.random() * 10 }));

  let bird, pipes, score, state = 'idle', deadTime = 0, scroll = 0, time = 0;
  let paused = false, last = performance.now();

  function reset() {
    bird = { y: H / 2 - 60, vy: 0 };
    pipes = [];
    score = 0;
    board.set(0);
  }

  function addPipe() {
    const margin = 70;
    const gapY = margin + GAP / 2 + Math.random() * (FLOOR - 2 * margin - GAP);
    pipes.push({ x: W + 20, gapY, passed: false });
  }

  function flap() {
    if (state !== 'play' || paused) return;
    bird.vy = FLAP;
  }

  function start() {
    reset();
    overlay.hide();
    state = 'play';
    paused = false;
    addPipe();
    flap();
  }

  function die() {
    state = 'dead';
    deadTime = 0;
  }

  function circleRect(cx, cy, r, x, y, w, h) {
    const nx = Math.max(x, Math.min(cx, x + w));
    const ny = Math.max(y, Math.min(cy, y + h));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }

  function update(dt) {
    time += dt;
    if (state === 'idle') {
      bird.y = H / 2 - 60 + Math.sin(time * 3) * 8;
      scroll += SPEED * dt;
      return;
    }

    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;

    if (state === 'dead') {
      if (bird.y >= FLOOR - R) { bird.y = FLOOR - R; bird.vy = 0; }
      deadTime += dt;
      if (deadTime > 0.7 && !overlay.visible) {
        const record = board.finish(score);
        overlay.show('¡Golpe!', Arcade.gameOverText(score, record), 'Jugar otra vez', start);
      }
      return;
    }

    scroll += SPEED * dt;
    for (const p of pipes) p.x -= SPEED * dt;
    if (pipes.length && pipes[pipes.length - 1].x < W - SPACING) addPipe();
    pipes = pipes.filter((p) => p.x + PIPE_W > -10);

    for (const p of pipes) {
      if (!p.passed && p.x + PIPE_W < BIRD_X - R) {
        p.passed = true;
        score++;
        board.set(score);
      }
      const hitR = R * 0.85;
      if (circleRect(BIRD_X, bird.y, hitR, p.x, 0, PIPE_W, p.gapY - GAP / 2) ||
          circleRect(BIRD_X, bird.y, hitR, p.x, p.gapY + GAP / 2, PIPE_W, FLOOR)) {
        die();
        return;
      }
    }

    if (bird.y < R) { bird.y = R; bird.vy = 0; }
    if (bird.y >= FLOOR - R) { bird.y = FLOOR - R; die(); }
  }

  function drawPipe(x, y, h, capAtBottom) {
    ctx.fillStyle = '#73bf2e';
    ctx.fillRect(x, y, PIPE_W, h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 6, y, 6, h);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x + PIPE_W - 10, y, 6, h);
    const capY = capAtBottom ? y + h - 24 : y;
    ctx.fillStyle = '#5ea323';
    ctx.fillRect(x - 4, capY, PIPE_W + 8, 24);
    ctx.strokeStyle = '#2f5a10';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, capY, PIPE_W + 8, 24);
    ctx.strokeRect(x, y, PIPE_W, h);
  }

  function drawBird() {
    const rot = Math.max(-0.5, Math.min(1.2, bird.vy / 600));
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(state === 'idle' ? 0 : rot);
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#7c4a03';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, R + 3, R, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Ala que aletea
    const wing = Math.sin(time * 22) * 4;
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.ellipse(-6, 2 + wing, 8, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(7, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(8.5, -5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(23, 3);
    ctx.lineTo(12, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, FLOOR);
    sky.addColorStop(0, '#4ec0ca');
    sky.addColorStop(1, '#b8ecef');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, FLOOR);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of clouds) {
      const x = ((c.x - scroll * 0.1) % (W + 120) + W + 120) % (W + 120) - 60;
      ctx.beginPath();
      ctx.arc(x, c.y, 18 * c.s, 0, Math.PI * 2);
      ctx.arc(x + 20 * c.s, c.y - 8 * c.s, 22 * c.s, 0, Math.PI * 2);
      ctx.arc(x + 42 * c.s, c.y, 16 * c.s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#9fd7c9';
    const cityW = city.length * 30;
    for (const b of city) {
      const x = ((b.x - scroll * 0.3) % cityW + cityW) % cityW - 30;
      ctx.fillRect(x, FLOOR - b.h, b.w, b.h);
    }

    for (const p of pipes) {
      drawPipe(p.x, 0, p.gapY - GAP / 2, true);
      drawPipe(p.x, p.gapY + GAP / 2, FLOOR - (p.gapY + GAP / 2), false);
    }

    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, FLOOR, W, GROUND);
    ctx.fillStyle = '#73bf2e';
    ctx.fillRect(0, FLOOR, W, 14);
    ctx.fillStyle = '#5ea323';
    const off = scroll % 24;
    for (let x = -off; x < W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, FLOOR + 14);
      ctx.lineTo(x + 12, FLOOR);
      ctx.lineTo(x + 24, FLOOR);
      ctx.lineTo(x + 12, FLOOR + 14);
      ctx.fill();
    }
    ctx.fillStyle = '#c9b870';
    ctx.fillRect(0, FLOOR + 14, W, 3);

    drawBird();

    if (state !== 'idle') {
      ctx.font = '32px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#1f2937';
      ctx.strokeText(String(score), W / 2, 80);
      ctx.fillStyle = '#fff';
      ctx.fillText(String(score), W / 2, 80);
      ctx.textAlign = 'left';
    }
  }

  function loop(t) {
    const dt = Math.min(t - last, 50) / 1000;
    last = t;
    if (!paused) update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function resume() { paused = false; overlay.hide(); }

  Arcade.onPause((onlyPause) => {
    if (state !== 'play') return;
    if (paused) { if (!onlyPause) resume(); return; }
    paused = true;
    overlay.show('Pausa', 'Respira hondo antes del siguiente tubo.', 'Continuar', resume);
  });

  document.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') && !e.repeat) flap();
  });
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); });

  reset();
  overlay.show('Flappy', 'Vuela entre los tubos sin tocarlos. Cada tubo superado suma un punto.', 'Jugar', start);
  requestAnimationFrame(loop);
})();
