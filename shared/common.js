// Utilidades compartidas por todos los juegos.
const Arcade = (() => {
  const KEY = 'arcade-best:';

  function getBest(id) {
    try { return Number(localStorage.getItem(KEY + id)) || 0; } catch { return 0; }
  }

  function saveBest(id, score) {
    if (score <= getBest(id)) return false;
    try { localStorage.setItem(KEY + id, String(score)); } catch { /* sin almacenamiento */ }
    return true;
  }

  // Marcador de la cabecera (puntos y récord).
  function scoreboard(id) {
    const scoreEl = document.getElementById('score');
    const bestEl = document.getElementById('best');
    bestEl.textContent = getBest(id);
    return {
      set(score) { scoreEl.textContent = score; },
      finish(score) {
        const record = saveBest(id, score);
        bestEl.textContent = getBest(id);
        return record;
      },
    };
  }

  // Canvas nítido en pantallas de alta densidad; se dibuja en coordenadas lógicas w x h.
  function setupCanvas(canvas, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.aspectRatio = `${w} / ${h}`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function pointerPos(canvas, e, w, h) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * w / r.width, y: (e.clientY - r.top) * h / r.height };
  }

  // Pantalla de inicio / pausa / fin de partida sobre el canvas.
  function createOverlay(el) {
    const title = el.querySelector('.overlay-title');
    const text = el.querySelector('.overlay-text');
    const btn = el.querySelector('.overlay-btn');
    let action = null;
    let shownAt = 0;
    let used = false;

    const trigger = () => {
      // Evita reiniciar sin querer con la misma pulsación que terminó la partida.
      if (el.hidden || !action || (used && performance.now() - shownAt < 450)) return;
      used = true;
      action();
    };

    btn.addEventListener('click', trigger);
    // En captura para que el juego no reciba también esa tecla.
    window.addEventListener('keydown', (e) => {
      if (el.hidden || (e.code !== 'Enter' && e.code !== 'Space')) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) trigger();
    }, true);

    return {
      show(t, msg, label, fn) {
        title.textContent = t;
        text.innerHTML = msg;
        btn.textContent = label;
        action = fn;
        shownAt = performance.now();
        el.hidden = false;
      },
      hide() { el.hidden = true; action = null; btn.blur(); },
      get visible() { return !el.hidden; },
    };
  }

  function gameOverText(score, record, extra = '') {
    return `Puntuación: <b>${score}</b>${extra}` +
      (record ? '<br><span class="record">¡Nuevo récord!</span>' : '');
  }

  // Pausa con P / Esc, botón de pausa y al cambiar de pestaña.
  function onPause(toggle) {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' || e.code === 'Escape') toggle(false);
    });
    const btn = document.getElementById('pause');
    if (btn) btn.addEventListener('click', () => toggle(false));
    document.addEventListener('visibilitychange', () => { if (document.hidden) toggle(true); });
  }

  // Botón táctil con pulsación mantenida.
  function bindButton(btn, onDown, onUp) {
    const up = () => {
      if (!btn.classList.contains('active')) return;
      btn.classList.remove('active');
      if (onUp) onUp();
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
      btn.classList.add('active');
      if (onDown) onDown();
    });
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Botón táctil que repite la acción mientras se mantiene pulsado.
  function bindRepeat(btn, fn, delay = 170, rate = 55) {
    let timer = null;
    const stop = () => { clearTimeout(timer); clearInterval(timer); timer = null; };
    bindButton(btn, () => {
      fn();
      timer = setTimeout(() => { timer = setInterval(fn, rate); }, delay);
    }, stop);
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Pequeño sistema de partículas para explosiones.
  function particles() {
    let list = [];
    return {
      burst(x, y, color, n = 12, speed = 160) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = speed * (0.3 + Math.random() * 0.7);
          list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, color });
        }
      },
      update(dt) {
        for (const p of list) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.96;
          p.vy *= 0.96;
          p.life -= dt;
        }
        list = list.filter((p) => p.life > 0);
      },
      draw(ctx) {
        for (const p of list) {
          ctx.globalAlpha = Math.min(1, p.life * 2);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
      },
      clear() { list = []; },
    };
  }

  // Evita que las flechas y el espacio desplacen la página.
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) &&
        !(e.target instanceof HTMLInputElement)) {
      e.preventDefault();
    }
  });

  return {
    getBest, saveBest, scoreboard, setupCanvas, pointerPos, createOverlay, gameOverText,
    onPause, bindButton, bindRepeat, roundRect, particles,
  };
})();
