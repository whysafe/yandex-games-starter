/* Обёртка над Yandex Games SDK v2.
   На Яндекс Играх подключается настоящий /sdk.js, локально работает заглушка:
   реклама показывается как плашка на пару секунд, сохранения идут в localStorage.
   Игра обращается только к объекту YA и не знает, где она запущена. */
(function () {
  "use strict";

  var KEY = "orbit-progress";
  var listeners = { pause: [], resume: [] };
  var ysdk = null, player = null, real = false, adOpen = false;

  function emit(type) { listeners[type].forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  function readLocal() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function writeLocal(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* приватный режим */ } }

  /* SDK доступен только на домене игры. На file:// и localhost сразу берём заглушку. */
  function loadSdk() {
    return new Promise(function (resolve) {
      var host = location.hostname;
      var onYandex = /(^|\.)yandex\.(ru|com|com\.tr|by|kz|uz)$|(^|\.)playhop\.com$|^app-\d+\.games\.s3\.yandex\.net$/.test(host)
        || /[?&]sdk=1\b/.test(location.search);
      if (!onYandex || location.protocol === "file:") return resolve(false);
      var s = document.createElement("script");
      s.src = "/sdk.js";
      s.async = true;
      s.onload = function () { resolve(typeof window.YaGames !== "undefined"); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
      setTimeout(function () { resolve(typeof window.YaGames !== "undefined"); }, 5000);
    });
  }

  /* Заглушка рекламы: полупрозрачная плашка поверх игры. */
  function fakeAd(text, ms) {
    return new Promise(function (resolve) {
      var el = document.createElement("div");
      el.className = "fake-ad";
      el.innerHTML = "<div><b>" + text + "</b><span>локальная заглушка рекламы</span></div>";
      document.body.appendChild(el);
      setTimeout(function () { el.remove(); resolve(); }, ms);
    });
  }

  var YA = {
    lang: (navigator.language || "ru").slice(0, 2),
    get isReal() { return real; },
    get adOpen() { return adOpen; },

    init: function () {
      return loadSdk().then(function (ok) {
        if (!ok) return;
        return window.YaGames.init().then(function (sdk) {
          ysdk = sdk; real = true;
          YA.lang = (sdk.environment && sdk.environment.i18n && sdk.environment.i18n.lang) || YA.lang;
          /* Площадка ставит игру на паузу, например при открытии меню Яндекса */
          if (sdk.on) {
            sdk.on("game_api_pause", function () { emit("pause"); });
            sdk.on("game_api_resume", function () { emit("resume"); });
          }
          return sdk.getPlayer({ scopes: false }).then(function (p) { player = p; }, function () {});
        });
      }).catch(function (e) { console.warn("SDK недоступен, работает заглушка", e); });
    },

    /* Сообщаем площадке, что игра загрузилась: обязательно для модерации */
    ready: function () {
      if (real && ysdk.features && ysdk.features.LoadingAPI) ysdk.features.LoadingAPI.ready();
    },
    gameplayStart: function () {
      if (real && ysdk.features && ysdk.features.GameplayAPI) ysdk.features.GameplayAPI.start();
    },
    gameplayStop: function () {
      if (real && ysdk.features && ysdk.features.GameplayAPI) ysdk.features.GameplayAPI.stop();
    },

    on: function (type, fn) { listeners[type].push(fn); },

    /* Полноэкранная реклама. Во время показа игра на паузе и без звука. */
    fullscreen: function () {
      if (adOpen) return Promise.resolve(false);
      adOpen = true; emit("pause");
      var done = function (shown) { adOpen = false; emit("resume"); return !!shown; };
      if (!real) return fakeAd("Реклама", 1500).then(function () { return done(true); });
      return new Promise(function (resolve) {
        ysdk.adv.showFullscreenAdv({ callbacks: {
          onClose: function (wasShown) { resolve(done(wasShown)); },
          onError: function () { resolve(done(false)); },
          onOffline: function () { resolve(done(false)); }
        } });
      });
    },

    /* Реклама за вознаграждение. Награду выдаём только после onRewarded. */
    rewarded: function () {
      if (adOpen) return Promise.resolve(false);
      adOpen = true; emit("pause");
      var rewarded = false;
      var done = function () { adOpen = false; emit("resume"); return rewarded; };
      if (!real) return fakeAd("Видео за награду", 2000).then(function () { rewarded = true; return done(); });
      return new Promise(function (resolve) {
        ysdk.adv.showRewardedVideo({ callbacks: {
          onRewarded: function () { rewarded = true; },
          onClose: function () { resolve(done()); },
          onError: function () { resolve(done()); }
        } });
      });
    },

    /* Прогресс: облако игрока плюс localStorage как запасной вариант. */
    load: function () {
      var local = readLocal();
      if (!player) return Promise.resolve(local);
      return player.getData().then(function (cloud) { return window.Logic.mergeProgress(local, cloud); }, function () { return local; });
    },
    save: function (data) {
      writeLocal(data);
      if (player) return player.setData(data, false).catch(function () {});
      return Promise.resolve();
    },

    /* Лидерборд: имя таблицы задаётся в консоли разработчика Яндекс Игр. */
    leaderboard: function (name, score) {
      if (!real) return Promise.resolve();
      try {
        if (ysdk.leaderboards && ysdk.leaderboards.setScore) return ysdk.leaderboards.setScore(name, score).catch(function () {});
        if (ysdk.getLeaderboards) return ysdk.getLeaderboards().then(function (lb) { return lb.setLeaderboardScore(name, score); }).catch(function () {});
      } catch (e) { /* таблица не создана */ }
      return Promise.resolve();
    }
  };

  window.YA = YA;
})();
