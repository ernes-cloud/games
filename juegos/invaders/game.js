(() => {
  const W = 480, H = 600, PX = 2;
  const PLAYER_Y = H - 60, GROUND_Y = H - 32;
  const COLS = 11, ROWS = 5, SX = 34, SY = 30;

  const SPRITES = {
    squid: [
      ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '..X..X..', '.X.XX.X.', 'X.X..X.X'],
      ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X.XX.X.', 'X......X', '.X....X.'],
    ],
    crab: [
      ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'],
      ['..X.....X..', 'X..X...X..X', 'X.XXXXXXX.X', 'XXX.XXX.XXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..X.....X..', '.X.......X.'],
    ],
    octo: [
      ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '...XX..XX...', '..XX.XX.XX..', 'XX........XX'],
      ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '..XXX..XXX..', '.XX..XX..XX.', '..XX....XX..'],
    ],
  };
  const SHIP = ['......X......', '.....XXX.....', '.....XXX.....', '.XXXXXXXXXXX.', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX'];
  const SHIP_PX = 3, SHIP_W = SHIP[0].length * SHIP_PX, SHIP_H = SHIP.length * SHIP_PX;
  const SHIELD = ['..XXXXXXXX..', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXXXXXXXXXX', 'XXXX....XXXX', 'XXX......XXX', 'XXX......XXX'];
  const BLOCK = 4;
  const ROW_TYPES = ['squid', 'crab', 'crab', 'octo', 'octo'];
  const POINTS = { squid: 30, crab: 20, octo: 10 };
  const COLORS = { squid: '#f472b6', crab: '#a78bfa', octo: '#22d3ee' };

  const canvas = document.getElementById('game');
  const ctx = Arcade.setupCanvas(canvas, W, H);
  const board = Arcade.scoreboard('invaders');
  const overlay = Arcade.createOverlay(document.getElementById('overlay'));
  const fx = Arcade.particles();
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, b: Math.random() }));

  const input = { left: false, right: false, fire: false };
  let player, bullet, shots, aliens, fleet, shields, score, lives, wave, respawn, shotTimer, banner;
  let running = false, paused = false, last = performance.now();

  function buildShields() {
    shields = [];
    const sw = SHIELD[0].length * BLOCK;
    for (let i = 0; i < 4; i++) {
      const x0 = W * (i + 1) / 5 - sw / 2;
      SHIELD.forEach((row, r) => [...row].forEach((ch, c) => {
        if (ch === 'X') shields.push({ x: x0 + c * BLOCK, y: H - 150 + r * BLOCK, alive: true });
      }));
    }
  }

  function buildWave() {
    aliens = [];
    const startY = 70 + Math.min(wave - 1, 5) * 12;
    const offsetX = (W - (COLS - 1) * SX) / 2;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const type = ROW_TYPES[r];
        aliens.push({ type, col: c, x: offsetX + c * SX, y: startY + r * SY, w: SPRITES[type][0][0].length * PX, h: 16, alive: true });
      }
    }
    fleet = { dir: 1, frame: 0, frameAcc: 0 };
    bullet = null;
    shots = [];
    shotTimer = 1.2;
    banner = 1.5;
    buildShields();
  }

  const rectHit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const alienRect = (a) => ({ x: a.x - a.w / 2, y: a.y - a.h / 2, w: a.w, h: a.h });
  const playerRect = () => ({ x: player.x - SHIP_W / 2, y: PLAYER_Y - SHIP_H / 2, w: SHIP_W, h: SHIP_H });
  const shotRect = (s) => ({ x: s.x - 1.5, y: s.y - 6, w: 3, h: 12 });

  // Un impacto en un escudo abre un pequeño agujero alrededor del punto.
  function hitShield(r) {
    const block = shields.find((b) => b.alive && rectHit(r, { x: b.x, y: b.y, w: BLOCK, h: BLOCK }));
    if (!block) return false;
    for (const b of shields) {
      if (b.alive && Math.hypot(b.x - block.x, b.y - block.y) <= BLOCK * 1.6 && Math.random() < 0.8) b.alive = false;
    }
    block.alive = false;
    return true;
  }

  function fire() {
    if (bullet || respawn > 0) return;
    bullet = { x: player.x, y: PLAYER_Y - SHIP_H / 2 - 6, vy: -560 };
  }

  function update(dt) {
    banner = Math.max(0, banner - dt);
    if (respawn > 0) respawn -= dt;

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    player.x = Math.max(SHIP_W / 2 + 8, Math.min(W - SHIP_W / 2 - 8, player.x + dir * 240 * dt));
    if (input.fire) fire();

    // Flota: más rápida cuantos menos aliens quedan.
    const alive = aliens.filter((a) => a.alive);
    const ratio = alive.length / aliens.length;
    const speed = (18 + wave * 10) * (1 + 4 * (1 - ratio));
    for (const a of alive) a.x += fleet.dir * speed * dt;
    const minX = Math.min(...alive.map((a) => a.x - a.w / 2));
    const maxX = Math.max(...alive.map((a) => a.x + a.w / 2));
    if ((fleet.dir > 0 && maxX > W - 10) || (fleet.dir < 0 && minX < 10)) {
      const back = fleet.dir > 0 ? W - 10 - maxX : 10 - minX;
      fleet.dir = -fleet.dir;
      for (const a of alive) { a.x += back; a.y += 14; }
    }
    fleet.frameAcc += dt;
    if (fleet.frameAcc > Math.max(0.1, 0.6 * ratio)) { fleet.frameAcc = 0; fleet.frame ^= 1; }

    for (const a of alive) {
      const ar = alienRect(a);
      for (const b of shields) {
        if (b.alive && rectHit(ar, { x: b.x, y: b.y, w: BLOCK, h: BLOCK })) b.alive = false;
      }
      if (a.y + a.h / 2 >= PLAYER_Y - SHIP_H / 2) { gameOver('¡Te han invadido!'); return; }
    }

    // Disparo del jugador
    if (bullet) {
      bullet.y += bullet.vy * dt;
      const br = shotRect(bullet);
      const hit = alive.find((a) => rectHit(br, alienRect(a)));
      if (hit) {
        hit.alive = false;
        score += POINTS[hit.type];
        board.set(score);
        fx.burst(hit.x, hit.y, COLORS[hit.type], 16);
        bullet = null;
      } else if (hitShield(br) || bullet.y < 0) {
        bullet = null;
      }
    }

    // Disparos alienígenas desde el alien más bajo de una columna al azar.
    shotTimer -= dt;
    if (shotTimer <= 0 && alive.length && shots.length < 4) {
      const bottoms = {};
      for (const a of alive) if (!bottoms[a.col] || a.y > bottoms[a.col].y) bottoms[a.col] = a;
      const list = Object.values(bottoms);
      const shooter = list[Math.floor(Math.random() * list.length)];
      shots.push({ x: shooter.x, y: shooter.y + 10, vy: 220 + wave * 15 });
      shotTimer = (0.4 + Math.random() * 0.8) * Math.max(0.35, 1 - wave * 0.08);
    }

    for (const s of shots) {
      s.y += s.vy * dt;
      const sr = shotRect(s);
      if (hitShield(sr) || s.y > GROUND_Y) { s.dead = true; continue; }
      if (bullet && rectHit(sr, shotRect(bullet))) { s.dead = true; bullet = null; continue; }
      if (respawn <= 0 && rectHit(sr, playerRect())) {
        s.dead = true;
        playerHit();
        if (!running) return;
      }
    }
    shots = shots.filter((s) => !s.dead);

    if (!aliens.some((a) => a.alive)) {
      wave++;
      buildWave();
    }
  }

  function playerHit() {
    lives--;
    fx.burst(player.x, PLAYER_Y, '#4ade80', 30, 200);
    shots = [];
    if (lives <= 0) {
      gameOver('Fin de la partida');
    } else {
      respawn = 1.5;
    }
  }

  function start() {
    score = 0;
    lives = 3;
    wave = 1;
    respawn = 0;
    player = { x: W / 2 };
    board.set(0);
    fx.clear();
    buildWave();
    overlay.hide();
    running = true;
    paused = false;
  }

  function gameOver(title) {
    running = false;
    const record = board.finish(score);
    overlay.show(title, Arcade.gameOverText(score, record, `<br>Oleada: <b>${wave}</b>`), 'Jugar otra vez', start);
  }

  function resume() { paused = false; overlay.hide(); }

  Arcade.onPause((onlyPause) => {
    if (!running) return;
    if (paused) { if (!onlyPause) resume(); return; }
    paused = true;
    overlay.show('Pausa', 'Los invasores esperan...', 'Continuar', resume);
  });

  const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire', ArrowUp: 'fire', KeyW: 'fire' };
  document.addEventListener('keydown', (e) => { if (KEYS[e.code]) input[KEYS[e.code]] = true; });
  document.addEventListener('keyup', (e) => { if (KEYS[e.code]) input[KEYS[e.code]] = false; });
  window.addEventListener('blur', () => { input.left = input.right = input.fire = false; });
  document.querySelectorAll('[data-hold]').forEach((btn) => {
    const name = btn.dataset.hold;
    Arcade.bindButton(btn, () => { input[name] = true; }, () => { input[name] = false; });
  });

  function drawSprite(sprite, cx, cy, px, color) {
    const x0 = Math.round(cx - sprite[0].length * px / 2);
    const y0 = Math.round(cy - sprite.length * px / 2);
    ctx.fillStyle = color;
    for (let r = 0; r < sprite.length; r++) {
      for (let c = 0; c < sprite[r].length; c++) {
        if (sprite[r][c] === 'X') ctx.fillRect(x0 + c * px, y0 + r * px, px, px);
      }
    }
  }

  function draw() {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + s.b * 0.5})`;
      ctx.fillRect(s.x, s.y, 1.5, 1.5);
    }

    ctx.fillStyle = '#4ade80';
    for (const b of shields) if (b.alive) ctx.fillRect(b.x, b.y, BLOCK, BLOCK);

    for (const a of aliens) {
      if (a.alive) drawSprite(SPRITES[a.type][fleet.frame], a.x, a.y, PX, COLORS[a.type]);
    }

    if (running && (respawn <= 0 || Math.floor(respawn * 10) % 2 === 0)) {
      drawSprite(SHIP, player.x, PLAYER_Y, SHIP_PX, '#4ade80');
    }

    if (bullet) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bullet.x - 1.5, bullet.y - 6, 3, 12);
    }
    ctx.fillStyle = '#fb923c';
    for (const s of shots) {
      const zig = Math.floor(s.y / 6) % 2 ? 2 : -2;
      ctx.fillRect(s.x - 1.5 + zig, s.y - 6, 3, 6);
      ctx.fillRect(s.x - 1.5 - zig, s.y, 3, 6);
    }

    fx.draw(ctx);

    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, GROUND_Y, W, 2);
    for (let i = 0; i < lives - 1; i++) drawSprite(SHIP, 24 + i * 34, GROUND_Y + 16, 2, '#4ade80');
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`OLEADA ${wave}`, W - 14, GROUND_Y + 21);

    if (running && banner > 0) {
      ctx.globalAlpha = Math.min(1, banner);
      ctx.font = '18px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.fillText(`OLEADA ${wave}`, W / 2, H / 2 + 40);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  function loop(t) {
    const dt = Math.min(t - last, 50) / 1000;
    last = t;
    if (running && !paused) update(dt);
    fx.update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  wave = 1;
  lives = 3;
  player = { x: W / 2 };
  buildWave();
  overlay.show('Space Invaders', 'Detén la invasión alienígena. Escóndete tras los escudos y no dejes que lleguen al suelo.', 'Jugar', start);
  requestAnimationFrame(loop);
})();
