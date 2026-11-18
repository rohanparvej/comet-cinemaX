// "Now Playing" section: one featured movie + the shortlist scroller.
// Content comes from the backend (see js/main.js):
//   winner   : the current screening (featured, big)
//   lineup   : the shortlisted movies (poll movies that did not win), once a winner is current
//   upcoming : upcoming movies added in admin, any number

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
  inner.appendChild(createEl("p", "featured__label", "November Screenings"));

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

/* ---------- Shortlist scroller ----------
   A plain horizontal scroller (swipe, trackpad, arrow buttons or keyboard):
     - the shortlisted movie(s): poll movies that did not win. Shown bigger, first.
     - the upcoming movies the admin added: as many as there are, smaller.
   Every movie brings its own poster (poster_url from the backend). */

function createPoster(movie, kind) {
  const card = createEl("article", "poster poster--" + kind);
  const frame = createEl("div", "poster__frame");

  // Placeholder underneath: also what you see when a movie has no poster or it fails to load
  const empty = createEl("div", "poster__empty");
  empty.appendChild(createEl("span", "poster__empty-title", movie.title_name));
  frame.appendChild(empty);

  const source = posterSource(movie);
  if (source) {
    const img = createEl("img", "poster__img");
    img.alt = movie.title_name + " poster";
    img.loading = "lazy";
    img.draggable = false;
    img.addEventListener("load", function () { img.classList.add("is-loaded"); });
    img.addEventListener("error", function () { img.remove(); });
    img.src = source;
    frame.appendChild(img);
  }

  frame.appendChild(createEl("span", "poster__badge", kind === "shortlisted" ? "Shortlisted" : "Upcoming"));
  card.appendChild(frame);

  card.appendChild(createEl("h3", "poster__title", movie.title_name));
  const meta = [movie.release_year, formatRuntime(movie.runtime)].filter(Boolean).join(" · ");
  if (meta) card.appendChild(createEl("p", "poster__meta", meta));
  return card;
}

function createScrollButton(direction, track) {
  const button = createButton("", "lineup__arrow lineup__arrow--" + direction, function () {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({
      left: (direction === "next" ? 1 : -1) * track.clientWidth * 0.8,
      behavior: reduceMotion ? "auto" : "smooth"
    });
  });
  button.setAttribute("aria-label", direction === "next" ? "Scroll to the next movies" : "Scroll to the previous movies");
  button.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true"><path d="' +
    (direction === "next" ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7") +
    '"/></svg>';
  return button;
}

function showLineup(shortlisted, upcoming) {
  const lineup = document.getElementById("lineup");
  shortlisted = shortlisted || [];
  upcoming = upcoming || [];
  if (!lineup || shortlisted.length + upcoming.length === 0) return;

  const stage = createEl("div", "lineup__stage");

  const head = createEl("div", "lineup__head");
  const heading = createEl("div", "lineup__heading");
  heading.appendChild(createEl("p", "lineup__label", shortlisted.length ? "After the vote" : "On the horizon"));
  heading.appendChild(createEl("h2", "lineup__title", shortlisted.length ? "The Shortlist" : "Coming Up"));
  heading.appendChild(
    createEl(
      "p",
      "lineup__lead",
      shortlisted.length
        ? "The runner-up that just missed the screening, and what is coming after."
        : "Films we are lining up for the big screen."
    )
  );
  head.appendChild(heading);

  const track = createEl("div", "lineup__track");
  track.tabIndex = 0;
  track.setAttribute("role", "region");
  track.setAttribute("aria-label", "Shortlisted and upcoming movies");
  shortlisted.forEach(function (movie) { track.appendChild(createPoster(movie, "shortlisted")); });
  upcoming.forEach(function (movie) { track.appendChild(createPoster(movie, "upcoming")); });

  const arrows = createEl("div", "lineup__arrows");
  const previous = createScrollButton("prev", track);
  const next = createScrollButton("next", track);
  arrows.appendChild(previous);
  arrows.appendChild(next);
  head.appendChild(arrows);

  stage.appendChild(head);
  stage.appendChild(track);
  lineup.appendChild(stage);

  // Arrows and edge fades only appear when there is more to scroll
  function updateEdges() {
    const max = track.scrollWidth - track.clientWidth;
    const overflowing = max > 4;
    arrows.hidden = !overflowing;
    stage.classList.toggle("can-scroll-back", overflowing && track.scrollLeft > 4);
    stage.classList.toggle("can-scroll-forward", overflowing && track.scrollLeft < max - 4);
    previous.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft >= max - 4;
  }
  track.addEventListener("scroll", updateEdges, { passive: true });
  window.addEventListener("resize", updateEdges);
  window.addEventListener("load", updateEdges); // posters change the width
  updateEdges();
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
  showLineup(data.lineup, data.upcoming);
  initCutoutMotion();
}