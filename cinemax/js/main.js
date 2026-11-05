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

async function startHome() {
  // If the free server is asleep, a loader is shown until it answers (see wake-loader.js)
  wakeLoader.begin();
  let data = await loadHomeData();
  if (data.error) {
    // Possibly a sleeping server: wait until it answers, then load once more
    await wakeLoader.untilAwake();
    data = await loadHomeData();
  }
  wakeLoader.end();
  initNowPlaying(data);
  initPollsReviews(data);
}

startHome();
