/* Чистая логика игры без DOM: её можно тестировать в Node (node --test). */
(function (root) {
  "use strict";

  var TAU = Math.PI * 2;

  /* Детерминированный генератор случайных чисел (mulberry32): одинаковый сид даёт одинаковую партию. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Кратчайшее расстояние между двумя углами, результат от 0 до PI. */
  function angleDist(a, b) {
    var d = Math.abs(((a - b) % TAU + TAU) % TAU);
    return d > Math.PI ? TAU - d : d;
  }

  /* Игрок и объект сталкиваются, если они на одной орбите и близко по углу.
     hitArc задаётся в радианах и зависит от размера объектов и радиуса орбиты. */
  function collides(player, obj, hitArc) {
    return player.orbit === obj.orbit && angleDist(player.angle, obj.angle) < hitArc;
  }

  /* Скорость вращения растёт со счётом, но упирается в потолок, чтобы игра оставалась честной. */
  function speedFor(score) {
    return Math.min(1.6 + score * 0.045, 4.2); /* радиан в секунду */
  }

  /* Интервал появления объектов сокращается со счётом. */
  function spawnInterval(score) {
    return Math.max(0.42, 1.1 - score * 0.012);
  }

  /* Новый объект не должен появляться прямо перед игроком: оставляем «окно безопасности». */
  function spawn(rand, player, score) {
    var meteorChance = Math.min(0.35 + score * 0.01, 0.6);
    var kind = rand() < meteorChance ? "meteor" : "star";
    var angle, tries = 0;
    do {
      angle = rand() * TAU;
      tries++;
    } while (angleDist(angle, player.angle) < 1.1 && tries < 20);
    return {
      kind: kind,
      orbit: rand() < 0.5 ? 0 : 1,
      angle: angle,
      age: 0,
      warn: kind === "meteor" ? 0.7 : 0, /* метеор сначала мигает и безопасен */
      life: kind === "star" ? 4.5 : 5.5
    };
  }

  /* Политика полноэкранной рекламы: не чаще раза в cooldown секунд и не раньше N-й партии.
     Площадки вроде Яндекс Игр сами ограничивают частоту, но лишние вызовы портят опыт игрока. */
  function AdPolicy(opts) {
    opts = opts || {};
    this.cooldown = opts.cooldown != null ? opts.cooldown : 60;
    this.everyGames = opts.everyGames || 2;
    this.games = 0;
    this.last = -Infinity;
  }
  AdPolicy.prototype.gameOver = function (now) {
    this.games++;
    if (this.games % this.everyGames !== 0) return false;
    if (now - this.last < this.cooldown) return false;
    this.last = now;
    return true;
  };

  /* Слияние прогресса: облако и localStorage могут разойтись, берём лучшее из обоих. */
  function mergeProgress(a, b) {
    a = a || {}; b = b || {};
    return {
      best: Math.max(a.best || 0, b.best || 0),
      stars: Math.max(a.stars || 0, b.stars || 0),
      games: Math.max(a.games || 0, b.games || 0),
      muted: b.muted != null ? !!b.muted : !!a.muted
    };
  }

  var api = { TAU: TAU, rng: rng, angleDist: angleDist, collides: collides, speedFor: speedFor,
              spawnInterval: spawnInterval, spawn: spawn, AdPolicy: AdPolicy, mergeProgress: mergeProgress };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Logic = api;
})(this);
