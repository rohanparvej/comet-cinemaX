// "Waking up" screen. Render's free server sleeps when nobody visits and needs up to a minute
// to start again. While that happens this shows a film-reel loader instead of an empty page.
//
//   wakeLoader.begin()        start watching; the screen only appears if things take > 1.2 s
//   wakeLoader.untilAwake()   keeps asking /api/health until the server answers (or gives up)
//   wakeLoader.end()          hide the screen
//   wakeLoader.ensureAwake()  begin + untilAwake + end (used by the admin page)
//
// Normal fast loads never see it.

const wakeLoader = (function () {
  const SHOW_AFTER = 1200;   // ms of waiting before the screen appears
  const RETRY_EVERY = 2500;  // ms between health checks
  const CHECK_TIMEOUT = 10000;
  const GIVE_UP_AFTER = 90000;

  const MESSAGES = [
    { at: 0, text: "Warming up the projector\u2026" },
    { at: 7000, text: "The server naps when it's quiet. The first visit can take up to a minute." },
    { at: 30000, text: "Almost showtime\u2026 thanks for waiting." }
  ];

  const REEL =
    '<svg class="wake__reel" viewBox="0 0 100 100" aria-hidden="true">' +
    '<circle cx="50" cy="50" r="46" class="wake__reel-body"/>' +
    '<circle cx="50" cy="23" r="10"/><circle cx="73.4" cy="36.5" r="10"/><circle cx="73.4" cy="63.5" r="10"/>' +
    '<circle cx="50" cy="77" r="10"/><circle cx="26.6" cy="63.5" r="10"/><circle cx="26.6" cy="36.5" r="10"/>' +
    '<circle cx="50" cy="50" r="7" class="wake__reel-hub"/></svg>';

  let overlay = null;
  let timer = null;
  let textTimers = [];

  function show() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "wake";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML =
      REEL +
      '<p class="wake__brand">CINEMAX</p>' +
      '<div class="wake__strip" aria-hidden="true"><span></span></div>' +
      '<p class="wake__text"></p>';
    document.body.appendChild(overlay);
    const text = overlay.querySelector(".wake__text");
    MESSAGES.forEach(function (message) {
      textTimers.push(setTimeout(function () { text.textContent = message.text; }, message.at));
    });
    // next frame, so the fade-in transition runs
    requestAnimationFrame(function () { if (overlay) overlay.classList.add("is-visible"); });
  }

  function begin() {
    clearTimeout(timer);
    timer = setTimeout(show, SHOW_AFTER);
  }

  function end() {
    clearTimeout(timer);
    textTimers.forEach(clearTimeout);
    textTimers = [];
    if (!overlay) return;
    const closing = overlay;
    overlay = null;
    closing.classList.remove("is-visible");
    setTimeout(function () { closing.remove(); }, 400);
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function serverAnswers() {
    const controller = new AbortController();
    const abort = setTimeout(function () { controller.abort(); }, CHECK_TIMEOUT);
    try {
      const response = await fetch(CINEMAX_CONFIG.apiBaseUrl + "/api/health", {
        cache: "no-store",
        signal: controller.signal
      });
      return response.ok;
    } catch (error) {
      return false;
    } finally {
      clearTimeout(abort);
    }
  }

  async function untilAwake() {
    const start = Date.now();
    while (Date.now() - start < GIVE_UP_AFTER) {
      if (await serverAnswers()) return true;
      await sleep(RETRY_EVERY);
    }
    return false;
  }

  async function ensureAwake() {
    begin();
    try {
      if (!(await serverAnswers())) await untilAwake();
    } finally {
      end();
    }
  }

  return { begin: begin, end: end, untilAwake: untilAwake, ensureAwake: ensureAwake };
})();