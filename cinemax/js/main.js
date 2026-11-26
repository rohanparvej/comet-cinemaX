// Entry point. Loads the data from the backend once, then starts each component.

async function loadHomeData() {
  const results = await Promise.allSettled([
    apiRequest("/api/screenings/winner/current"),
    apiRequest("/api/screenings/choices"),
    apiRequest("/api/movie-logs?top_k=5"),
    apiRequest("/api/site/images"),
    // Upcoming movies for the shortlist scroller. Never blocks the page: no answer = empty list.
    apiRequest("/api/screenings/upcoming").catch(function () { return { data: [] }; })
  ]);

  const failed = results.find(function (result) { return result.status === "rejected"; });
  function valueOf(result, fallback) {
    return result.status === "fulfilled" ? result.value.data : fallback;
  }

  const winner = valueOf(results[0], null);
  const choices = valueOf(results[1], []);

  // The shortlist scroller shows the runner-up poll movies once a winner is current,
  // except the winner itself (the featured movie), followed by the upcoming movies.
  // While voting is open again, the poll movies are candidates, not runner-ups: no shortlist then.
  const lineup = winner && !winner.voting_open
    ? choices.filter(function (movie) {
        return !(movie.title_name === winner.title_name && movie.release_year === winner.release_year);
      })
    : [];

  return {
    winner: winner,
    choices: choices,
    lineup: lineup,
    upcoming: valueOf(results[4], []),
    reviews: valueOf(results[2], []),
    reviewsTotal: results[2].status === "fulfilled" ? results[2].value.total : 0,
    images: valueOf(results[3], { images: {} }).images,
    texts: valueOf(results[3], { texts: {} }).texts,
    error: failed ? failed.reason.message : ""
  };
}

initNavbar();

// Hero background: the image an admin uploaded replaces the built-in one in index.html.
// If the uploaded image fails to load, the built-in one is put back.
function showHeroBackground(images, texts) {
  // Caption describing the background ("In Frame: ..."); admin text replaces the built-in one.
  // textContent keeps it plain text, so nothing an admin types can inject HTML.
  const caption = document.querySelector(".hero__sub__small");
  const captionText = texts && texts.hero_caption;
  if (caption && captionText) caption.textContent = captionText;

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
  showHeroBackground(data.images, data.texts);
  initNowPlaying(data);
  initPollsReviews(data);
}

startHome();