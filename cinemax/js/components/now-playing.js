// "Now Playing" section: one featured movie + a parallax lineup of posters.
// Content comes from the backend (see js/main.js):
//   winner  : the current screening (featured, big)
//   lineup  : the other poll movies, shown in the poster row once a winner is current

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Runs a function at most once per frame while the page scrolls
function onScrollFrame(callback) {
  let waiting = false;
  window.addEventListener(
    "scroll",
    function () {
      if (waiting) return;
      waiting = true;
      requestAnimationFrame(function () {
        waiting = false;
        callback();
      });
    },
    { passive: true }
  );
}

/* ---------- Featured movie ---------- */

function showFeatured(movie, backgroundUrl) {
  const box = document.getElementById("featured");
  if (!box) return;

  // Background: the image an admin uploaded, or a coloured placeholder
  if (backgroundUrl) {
    const bg = createEl("img", "featured__bg");
    bg.src = backgroundUrl;
    bg.alt = "";
    box.appendChild(bg);
  } else {
    box.appendChild(createEl("div", "featured__bg featured__bg--empty"));
  }

  // Character cutout: sits in this section but pokes up over the hero
  if (CINEMAX_CONFIG.featuredCutout) {
    const cutout = createEl("img", "featured__cutout");
    cutout.src = CINEMAX_CONFIG.featuredCutout;
    cutout.alt = "";
    box.appendChild(cutout);
  }

  const inner = createEl("div", "featured__inner");
  inner.appendChild(createEl("p", "featured__label", "Halloween Screening"));

  if (!movie) {
    inner.appendChild(createEl("h2", "featured__title", "Next screening coming soon"));
    inner.appendChild(createEl("p", "featured__text", "Vote below for the film you want to see on the big screen."));
    box.appendChild(inner);
    return;
  }

  inner.appendChild(createEl("h2", "featured__title", movie.title_name));

  const meta = createEl("ul", "featured__meta");
  [String(movie.release_year), formatRuntime(movie.runtime)].forEach(function (item) {
    if (item) meta.appendChild(createEl("li", "", item));
  });
  inner.appendChild(meta);

  if (movie.details) {
    inner.appendChild(createEl("p", "featured__text", movie.details));
  }
  if (movie.recommended_by && movie.recommended_by.username) {
    inner.appendChild(createEl("p", "featured__text", "Recommended by " + movie.recommended_by.username));
  }

  box.appendChild(inner);
}

/* ---------- Poster lineup ---------- */

function createPoster(movie) {
  const card = createEl("article", "poster");
  const frame = createEl("div", "poster__frame");

  const empty = createEl("div", "poster__empty");
  empty.appendChild(createEl("span", "poster__empty-title", movie.title_name));
  frame.appendChild(empty);

  card.appendChild(frame);
  card.appendChild(createEl("h3", "poster__title", movie.title_name));
  card.appendChild(
    createEl("p", "poster__meta", [movie.release_year, formatRuntime(movie.runtime)].filter(Boolean).join(" · "))
  );
  return card;
}

function showLineup(list) {
  const lineup = document.getElementById("lineup");
  if (!lineup || !list || list.length === 0) return;

  const stage = createEl("div", "lineup__stage");

  const head = createEl("div", "lineup__head");
  head.appendChild(createEl("h2", "lineup__title", "Also on the shortlist"));

  const track = createEl("div", "lineup__track");
  list.forEach(function (movie) {
    track.appendChild(createPoster(movie));
  });

  stage.appendChild(head);
  stage.appendChild(track);
  lineup.appendChild(stage);
}

/* ---------- Parallax scroll ----------
   The lineup section is tall. While you scroll down through it, the stage
   stays pinned and the row of posters slides sideways. Each poster also:
   - drifts up / down (alternating directions) and tilts a little
   - grows and brightens when it is near the centre
   - moves its picture slightly inside its frame (the parallax)
   These values are written as CSS variables; the styling is in now-playing.css */

function initLineupScroll() {
  const lineup = document.getElementById("lineup");
  const track = lineup ? lineup.querySelector(".lineup__track") : null;
  if (!track) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const posters = Array.from(track.children);
  let maxShift = 0;

  function measure() {
    maxShift = Math.max(0, track.scrollWidth - window.innerWidth);
    lineup.style.height = window.innerHeight + maxShift + "px";
    update();
  }

  function update() {
    const scrollable = lineup.offsetHeight - window.innerHeight;
    const top = lineup.getBoundingClientRect().top;
    const progress = scrollable > 0 ? clamp(-top / scrollable, 0, 1) : 0;
    const shift = progress * maxShift;

    track.style.transform = "translate3d(" + -shift + "px, 0, 0)";

    const half = window.innerWidth / 2;
    posters.forEach(function (poster) {
      const center = poster.offsetLeft + poster.offsetWidth / 2 - shift;
      const offset = clamp((center - half) / half, -1, 1); // -1 (left) .. 1 (right)
      poster.style.setProperty("--offset", offset.toFixed(3));
      poster.style.setProperty("--focus", (1 - Math.abs(offset)).toFixed(3));
    });
  }

  onScrollFrame(update);
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure); // images change the width
  measure();
}

/* ---------- Cutout depth ----------
   The cutout moves a little faster than the page while scrolling,
   which makes it feel like it is standing in front of the background. */

function initCutoutMotion() {
  const box = document.getElementById("featured");
  const cutout = box ? box.querySelector(".featured__cutout") : null;
  if (!cutout) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  function update() {
    const top = box.getBoundingClientRect().top;
    const shift = clamp(top / window.innerHeight, -1, 1);
    cutout.style.setProperty("--shift", shift.toFixed(3));
  }

  onScrollFrame(update);
  update();
}

/* ---------- Start ---------- */

function initNowPlaying(data) {
  const background = data.images && data.images.now_playing_background;
  showFeatured(data.winner, background ? CINEMAX_CONFIG.apiBaseUrl + background.url : "");
  showLineup(data.lineup);
  initCutoutMotion();
  initLineupScroll();
}