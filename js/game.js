/* Орбита: игровой цикл, отрисовка, ввод, звук и связка с YA (SDK) и I18N. */
(function () {
  "use strict";
  var L = window.Logic, YA = window.YA, I = window.I18N, TAU = L.TAU;
  var $ = function (s) { return document.querySelector(s); };

  var canvas = $("#game"), ctx = canvas.getContext("2d");
  var ui = { menu: $("#menu"), over: $("#over"), pause: $("#pause"), hud: $("#hud"),
             score: $("#score"), best: $("#best"), finalScore: $("#finalScore"), newBest: $("#newBest"),
             revive: $("#revive"), again: $("#again"), sound: $("#sound") };

  var W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = [0, 0], unit = 1;
  var state = "boot"; /* boot | menu | play | over | pause */
  var progress = { best: 0, stars: 0, games: 0, muted: false };
  var ads = new L.AdPolicy({ cooldown: 60, everyGames: 2 });
  var rand = L.rng(Date.now());
  var player, objects, particles, score, spawnTimer, revived, shake, prevState;
  var bg = [];

  /* ---------- размеры и фон ---------- */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W / 2; cy = H / 2;
    var m = Math.min(W * 1.12, H * 0.9);
    R = [m * 0.2, m * 0.34]; unit = m / 400;
    var r = L.rng(7); bg = [];
    for (var i = 0; i < 90; i++) bg.push({ x: r() * W, y: r() * H, s: r() * 1.4 + 0.3, a: r() * 0.6 + 0.2 });
  }

  /* ---------- звук на Web Audio, без файлов ---------- */
  var ac = null;
  function beep(freq, dur, type, vol) {
    if (progress.muted || YA.adOpen) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
      g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* звук недоступен */ }
  }
  function suspendAudio(on) { if (ac) { if (on) ac.suspend(); else if (!progress.muted) ac.resume(); } }

  /* ---------- состояние партии ---------- */
  function reset() {
    player = { angle: -Math.PI / 2, orbit: 1, shift: 1 };
    objects = []; particles = []; score = 0; spawnTimer = 0.8; revived = false; shake = 0;
    ui.score.textContent = "0";
  }

  function show(name) {
    ["menu", "over", "pause"].forEach(function (n) { ui[n].hidden = n !== name; });
    ui.hud.hidden = name === "menu";
  }

  function start() {
    reset(); state = "play"; show(null);
    YA.gameplayStart(); beep(440, 0.12, "triangle");
  }

  function die() {
    state = "over"; shake = 0.35; beep(110, 0.4, "sawtooth", 0.12);
    YA.gameplayStop();
    progress.games++;
    var isBest = score > progress.best;
    if (isBest) progress.best = score;
    YA.save(progress);
    YA.leaderboard("orbitScore", score);
    ui.finalScore.textContent = score;
    ui.best.textContent = progress.best;
    ui.newBest.hidden = !isBest || score === 0;
    ui.revive.hidden = revived || score < 3;
    setTimeout(function () { if (state === "over") show("over"); }, 450);
  }

  function revive() {
    ui.revive.disabled = true;
    YA.rewarded().then(function (ok) {
      ui.revive.disabled = false;
      if (!ok) return;
      revived = true;
      /* убираем метеориты рядом с игроком, чтобы не умереть сразу */
      objects = objects.filter(function (o) { return o.kind !== "meteor"; });
      state = "play"; show(null); YA.gameplayStart();
    });
  }

  function again() {
    var now = performance.now() / 1000;
    if (ads.gameOver(now)) YA.fullscreen().then(start); else start();
  }

  function pause() {
    if (state !== "play") return;
    prevState = state; state = "pause"; show("pause"); YA.gameplayStop();
  }
  function resume() {
    if (state !== "pause" || YA.adOpen) return;
    state = prevState || "play"; show(null); YA.gameplayStart(); last = performance.now();
  }

  function tap() {
    if (state === "menu") return start();
    if (state === "pause") return resume();
    if (state !== "play") return;
    player.orbit = 1 - player.orbit; player.shift = 0;
    beep(player.orbit ? 520 : 660, 0.07, "square", 0.04);
  }

  /* ---------- шаг симуляции ---------- */
  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = rand() * TAU, s = (40 + rand() * 120) * unit;
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, color: color });
    }
  }
  function pos(orbit, angle) { return { x: cx + Math.cos(angle) * R[orbit], y: cy + Math.sin(angle) * R[orbit] }; }

  function update(dt) {
    particles.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; });
    particles = particles.filter(function (p) { return p.life > 0; });
    if (shake > 0) shake -= dt;
    if (state !== "play") return;

    player.angle = (player.angle + L.speedFor(score) * dt) % TAU;
    player.shift = Math.min(1, player.shift + dt * 7);

    spawnTimer -= dt;
    if (spawnTimer <= 0) { objects.push(L.spawn(rand, player, score)); spawnTimer = L.spawnInterval(score); }

    var hitArc = (14 * unit) / R[player.orbit];
    for (var i = objects.length - 1; i >= 0; i--) {
      var o = objects[i];
      o.age += dt;
      if (o.age > o.life) { objects.splice(i, 1); continue; }
      if (o.age < o.warn || player.shift < 0.6) continue;
      if (L.collides(player, o, hitArc)) {
        var p = pos(o.orbit, o.angle);
        if (o.kind === "star") {
          score++; progress.stars++; ui.score.textContent = score;
          burst(p.x, p.y, "#ffd166", 12); beep(880 + score * 6, 0.09, "triangle");
          objects.splice(i, 1);
        } else {
          burst(p.x, p.y, "#ff5d5d", 26); die(); return;
        }
      }
    }
  }

  /* ---------- отрисовка ---------- */
  function star(x, y, r, rot) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = rot + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  function draw(time) {
    ctx.save();
    ctx.fillStyle = "#0b1026"; ctx.fillRect(0, 0, W, H);
    if (shake > 0) ctx.translate((rand() - 0.5) * 10 * shake, (rand() - 0.5) * 10 * shake);

    bg.forEach(function (s) { ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(time / 900 + s.x)); ctx.fillStyle = "#fff"; ctx.fillRect(s.x, s.y, s.s, s.s); });
    ctx.globalAlpha = 1;

    /* планета */
    var g = ctx.createRadialGradient(cx - 10 * unit, cy - 12 * unit, 4 * unit, cx, cy, 44 * unit);
    g.addColorStop(0, "#7bdff2"); g.addColorStop(1, "#2a4d9b");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 40 * unit, 0, TAU); ctx.fill();

    /* орбиты */
    ctx.lineWidth = 2 * unit; ctx.setLineDash([4 * unit, 8 * unit]);
    R.forEach(function (r, i) {
      ctx.strokeStyle = player && player.orbit === i && state === "play" ? "rgba(123,223,242,.55)" : "rgba(255,255,255,.18)";
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    });
    ctx.setLineDash([]);

    /* объекты */
    (objects || []).forEach(function (o) {
      var p = pos(o.orbit, o.angle), fade = Math.min(1, (o.life - o.age) / 0.5, o.age / 0.2);
      ctx.globalAlpha = Math.max(0, fade);
      if (o.kind === "star") {
        ctx.fillStyle = "#ffd166"; star(p.x, p.y, 11 * unit, time / 600);
      } else if (o.age < o.warn) {
        ctx.strokeStyle = "#ff5d5d"; ctx.lineWidth = 2 * unit;
        ctx.globalAlpha *= 0.4 + 0.6 * Math.abs(Math.sin(o.age * 14));
        ctx.beginPath(); ctx.arc(p.x, p.y, 12 * unit, 0, TAU); ctx.stroke();
      } else {
        ctx.fillStyle = "#ff5d5d"; ctx.beginPath(); ctx.arc(p.x, p.y, 12 * unit, 0, TAU); ctx.fill();
        ctx.fillStyle = "#b83b3b"; ctx.beginPath(); ctx.arc(p.x - 4 * unit, p.y - 3 * unit, 3.5 * unit, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    /* игрок: плавный переход между орбитами */
    if (player && state !== "over") {
      var from = R[1 - player.orbit], to = R[player.orbit], k = 1 - Math.pow(1 - player.shift, 3);
      var rr = from + (to - from) * k, px = cx + Math.cos(player.angle) * rr, py = cy + Math.sin(player.angle) * rr;
      ctx.shadowColor = "#7bdff2"; ctx.shadowBlur = 18 * unit;
      ctx.fillStyle = "#e9fbff"; ctx.beginPath(); ctx.arc(px, py, 9 * unit, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }

    particles.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.life / 0.6); ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); });
    ctx.restore();
  }

  /* ---------- цикл с фиксированным шагом ---------- */
  var last = performance.now(), acc = 0, STEP = 1 / 120;
  function frame(t) {
    var dt = Math.min((t - last) / 1000, 0.1); last = t;
    if (state !== "pause" && !YA.adOpen) {
      acc += dt;
      while (acc >= STEP) { update(STEP); acc -= STEP; }
    } else acc = 0;
    draw(t);
    requestAnimationFrame(frame);
  }

  /* ---------- ввод ---------- */
  canvas.addEventListener("pointerdown", function (e) { e.preventDefault(); tap(); });
  ui.menu.addEventListener("pointerdown", function (e) { if (!e.target.closest("button")) { e.preventDefault(); tap(); } });
  ui.pause.addEventListener("pointerdown", function (e) { e.preventDefault(); resume(); });
  document.addEventListener("keydown", function (e) {
    if (e.repeat) return;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "Enter") {
      e.preventDefault();
      if (state === "over" && !ui.over.hidden) again(); else tap();
    }
    if (e.code === "KeyP" || e.code === "Escape") { state === "pause" ? resume() : pause(); }
  });
  ui.again.addEventListener("click", again);
  ui.revive.addEventListener("click", revive);
  ui.sound.addEventListener("click", function (e) {
    e.stopPropagation();
    progress.muted = !progress.muted; ui.sound.setAttribute("aria-pressed", String(!progress.muted));
    ui.sound.classList.toggle("off", progress.muted); suspendAudio(progress.muted); YA.save(progress);
  });
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  /* пауза при сворачивании вкладки и по сигналу площадки */
  document.addEventListener("visibilitychange", function () { if (document.hidden) { pause(); suspendAudio(true); } else suspendAudio(false); });
  YA.on("pause", function () { pause(); suspendAudio(true); });
  YA.on("resume", function () { suspendAudio(false); });

  /* ---------- текст интерфейса ---------- */
  function texts() {
    document.querySelectorAll("[data-t]").forEach(function (el) { el.textContent = I.t(el.getAttribute("data-t")); });
    document.title = I.t("title");
  }

  /* ---------- запуск ---------- */
  window.addEventListener("resize", resize);
  resize(); reset(); requestAnimationFrame(frame);
  I.set(YA.lang); texts();

  YA.init().then(function () {
    I.set(YA.lang); texts();
    return YA.load();
  }).then(function (p) {
    progress = L.mergeProgress(progress, p);
    ui.best.textContent = progress.best;
    ui.sound.setAttribute("aria-pressed", String(!progress.muted));
    ui.sound.classList.toggle("off", progress.muted);
    state = "menu"; show("menu");
    YA.ready();
  });

  /* для автотестов в браузере */
  window.__orbit = { get state() { return state; }, get score() { return score; }, tap: tap, start: start, die: die };
})();
