const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../js/logic.js");

test("angleDist: кратчайшее расстояние через 0", () => {
  assert.ok(Math.abs(L.angleDist(0.1, L.TAU - 0.1) - 0.2) < 1e-9);
  assert.equal(L.angleDist(1, 1), 0);
  assert.ok(Math.abs(L.angleDist(0, Math.PI) - Math.PI) < 1e-9);
});

test("collides: только на той же орбите и рядом по углу", () => {
  const p = { orbit: 1, angle: 0.5 };
  assert.equal(L.collides(p, { orbit: 1, angle: 0.55 }, 0.1), true);
  assert.equal(L.collides(p, { orbit: 0, angle: 0.5 }, 0.1), false);
  assert.equal(L.collides(p, { orbit: 1, angle: 0.8 }, 0.1), false);
});

test("скорость и частота появления ограничены", () => {
  assert.ok(L.speedFor(0) < L.speedFor(20));
  assert.equal(L.speedFor(10000), 4.2);
  assert.equal(L.spawnInterval(10000), 0.42);
});

test("spawn не ставит объект прямо перед игроком", () => {
  const rand = L.rng(42), player = { angle: 0, orbit: 0 };
  for (let i = 0; i < 500; i++) {
    const o = L.spawn(rand, player, 10);
    assert.ok(L.angleDist(o.angle, player.angle) >= 1.1);
    assert.ok(o.orbit === 0 || o.orbit === 1);
    if (o.kind === "meteor") assert.ok(o.warn > 0, "метеор сначала мигает");
  }
});

test("rng детерминирован", () => {
  const a = L.rng(5), b = L.rng(5);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
});

test("AdPolicy: каждая вторая партия и не чаще кулдауна", () => {
  const ads = new L.AdPolicy({ cooldown: 60, everyGames: 2 });
  assert.equal(ads.gameOver(0), false);   // 1-я партия
  assert.equal(ads.gameOver(10), true);   // 2-я
  assert.equal(ads.gameOver(20), false);  // 3-я
  assert.equal(ads.gameOver(30), false);  // 4-я, но кулдаун
  assert.equal(ads.gameOver(40), false);
  assert.equal(ads.gameOver(80), true);   // 6-я, кулдаун прошёл
});

test("mergeProgress берёт лучшее", () => {
  const m = L.mergeProgress({ best: 10, stars: 5, games: 3, muted: true }, { best: 7, stars: 9, games: 4 });
  assert.deepEqual(m, { best: 10, stars: 9, games: 4, muted: true });
  assert.deepEqual(L.mergeProgress(null, undefined), { best: 0, stars: 0, games: 0, muted: false });
});
