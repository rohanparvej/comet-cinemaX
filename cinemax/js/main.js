// Entry point. Loads the data from the backend once, then starts each component.

async function loadHomeData() {
  const results = await Promise.allSettled([
    apiRequest("/api/screenings/winner/current"),
    apiRequest("/api/screenings/choices"),
    apiRequest("/api/movie-logs?limit=20"),
    apiRequest("/api/site/images")
  ]);

  const failed = results.find(function (result) { return result.status === "rejected"; });
  function valueOf(result, fallback) {
    return result.status === "fulfilled" ? result.value.data : fallback;
  }

  const winner = valueOf(results[0], null);
  const choices = valueOf(results[1], []);

  // The lineup (poster scroll) shows the poll movies once a winner is current,
  // except the winner itself, which is already the featured movie.
  const lineup = winner
    ? choices.filter(function (movie) {
        return !(movie.title_name === winner.title_name && movie.release_year === winner.release_year);
      })
    : [];

  return {
    winner: winner,
    choices: choices,
    lineup: lineup,
    reviews: valueOf(results[2], []),
    images: valueOf(results[3], { images: {} }).images,
    error: failed ? failed.reason.message : ""
  };
}

initNavbar();

// Hero background: the image an admin uploaded replaces the built-in one in index.html.
// If the uploaded image fails to load, the built-in one is put back.
function showHeroBackground(images) {
  const hero = document.querySelector(".hero__bg");
  const uploaded = images && images.hero_background;
  if (!hero || !uploaded) return;

  const fallback = hero.getAttribute("src");
  hero.addEventListener("error", function restore() {
    hero.removeEventListener("error", restore);
    hero.src = fallback;
  });
  hero.src = CINEMAX_CONFIG.apiBaseUrl + uploaded.url;
}

async function startHome() {
  // If the free server is asleep, a loader is shown until it answers (see wake-loader.js)
  wakeLoader.begin();
  let data;
  try {
    data = await loadHomeData();
    if (data.error) {
      // Possibly a sleeping server: wait until it answers, then load once more
      await wakeLoader.untilAwake();
      data = await loadHomeData();
    }
  } finally {
    wakeLoader.end();
  }
  showHeroBackground(data.images);
  initNowPlaying(data);
  initPollsReviews(data);
}

startHome();