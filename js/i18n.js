/* Тексты на трёх языках. Яндекс Игры требуют, чтобы язык игры совпадал с языком площадки. */
(function () {
  "use strict";
  var T = {
    ru: { title: "Орбита", tap: "Нажмите, чтобы начать", hint: "Нажатие переключает орбиту. Собирайте звёзды, уворачивайтесь от метеоритов.",
          score: "Счёт", best: "Рекорд", over: "Столкновение", again: "Ещё раз", revive: "Продолжить за рекламу",
          paused: "Пауза", resume: "Нажмите, чтобы продолжить", sound: "Звук", newBest: "Новый рекорд!" },
    en: { title: "Orbit", tap: "Tap to start", hint: "Tap to switch orbit. Collect stars, dodge meteors.",
          score: "Score", best: "Best", over: "Crash", again: "Play again", revive: "Continue for an ad",
          paused: "Paused", resume: "Tap to continue", sound: "Sound", newBest: "New best!" },
    tr: { title: "Yörünge", tap: "Başlamak için dokun", hint: "Yörünge değiştirmek için dokun. Yıldızları topla, meteorlardan kaç.",
          score: "Skor", best: "Rekor", over: "Çarpışma", again: "Tekrar", revive: "Reklamla devam et",
          paused: "Duraklatıldı", resume: "Devam etmek için dokun", sound: "Ses", newBest: "Yeni rekor!" }
  };
  var lang = "ru";
  window.I18N = {
    set: function (l) { lang = T[l] ? l : (l === "be" || l === "kk" || l === "uk" || l === "uz" ? "ru" : "en"); document.documentElement.lang = lang; },
    t: function (k) { return T[lang][k] || T.ru[k] || k; },
    get lang() { return lang; }
  };
})();
