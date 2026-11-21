// Reviews forum page (reviews.html): every review, with filters and two views.
//
//   "By movie"    : one card per movie with its average rating and review count. Pick one to
//                   read its reviews.
//   "All reviews" : one feed of reviews, newest first (or by rating).
//
// Filters: search (movie, review text or username), minimum rating, time, sort.
// The backend filters and pages the results (/api/movie-logs/movies and /api/movie-logs/browse),
// so the page stays fast however many reviews exist. The filters are kept in the address bar,
// so a filtered view can be shared or reloaded.

const REVIEW_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" }
];
const MOVIE_SORTS = [
  { value: "latest", label: "Recently reviewed" },
  { value: "most_reviewed", label: "Most reviewed" },
  { value: "top_rated", label: "Top rated" },
  { value: "title", label: "A to Z" }
];
const RATING_FILTERS = [
  { value: "", label: "Any rating" },
  { value: "1", label: "1 star and up" },
  { value: "2", label: "2 stars and up" },
  { value: "3", label: "3 stars and up" },
  { value: "4", label: "4 stars and up" },
  { value: "5", label: "5 stars only" }
];
const PERIOD_FILTERS = [
  { value: "", label: "Any time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "365", label: "Last year" }
];

const forum = {
  view: "movies",   // "movies" or "reviews"
  q: "",
  rating: "",       // minimum stars
  days: "",
  sort: "",         // "" = the default of the current view
  movie: null,      // { title_name, release_year } when reading one movie's reviews
  page: 1,
  items: [],
  total: 0,
  hasMore: false,
  loading: false,
  error: ""
};

const forumParts = {};
let forumRequest = 0;
const forumUser = (function () {
  const saved = userSession.load();
  return saved ? saved.user : null;
})();

/* ---------- Address bar <-> filters ---------- */

function readAddress() {
  const params = new URLSearchParams(window.location.search);
  forum.view = params.get("view") === "reviews" ? "reviews" : "movies";
  forum.q = params.get("q") || "";
  forum.rating = params.get("min") || "";
  forum.days = params.get("days") || "";
  forum.sort = params.get("sort") || "";
  const title = params.get("title");
  const year = Number(params.get("year"));
  forum.movie = title && year ? { title_name: title, release_year: year } : null;
  if (forum.movie) forum.view = "reviews";
}

function writeAddress() {
  const params = new URLSearchParams();
  if (forum.view === "reviews") params.set("view", "reviews");
  if (forum.q) params.set("q", forum.q);
  if (forum.rating) params.set("min", forum.rating);
  if (forum.days) params.set("days", forum.days);
  if (forum.sort) params.set("sort", forum.sort);
  if (forum.movie) {
    params.set("title", forum.movie.title_name);
    params.set("year", String(forum.movie.release_year));
  }
  const text = params.toString();
  try {
    history.replaceState(null, "", window.location.pathname + (text ? "?" + text : ""));
  } catch (error) {
    // address bar not available: the filters just are not kept
  }
}

/* ---------- Loading ---------- */

function buildQuery(page) {
  const params = new URLSearchParams();
  if (forum.q) params.set("q", forum.q);
  if (forum.rating) params.set("min_rating", forum.rating);
  if (forum.days) params.set("days", forum.days);
  if (forum.sort) params.set("sort", forum.sort);
  if (forum.movie) {
    params.set("title", forum.movie.title_name);
    params.set("year", String(forum.movie.release_year));
  }
  params.set("page", String(page));
  return params.toString();
}

// append = true loads the next page and adds it; otherwise starts the list again from page 1
async function loadForum(append) {
  const mine = ++forumRequest;
  const page = append ? forum.page + 1 : 1;
  forum.loading = true;
  forum.error = "";
  if (!append) {
    forum.items = [];
    forum.total = 0;
    forum.hasMore = false;
  }
  showResults();

  try {
    const path = forum.view === "movies" ? "/api/movie-logs/movies?" : "/api/movie-logs/browse?";
    const result = await apiRequest(path + buildQuery(page));
    if (mine !== forumRequest) return; // the filters changed while this was loading
    forum.page = page;
    forum.items = append ? forum.items.concat(result.data) : result.data;
    forum.total = result.total;
    forum.hasMore = result.has_more;
  } catch (error) {
    if (mine !== forumRequest) return;
    forum.error = error.message;
  }
  forum.loading = false;
  showResults();
}

// Any filter changed: update the address bar and start from page 1
function applyFilters() {
  writeAddress();
  showControls();
  loadForum(false);
}

/* ---------- Controls ---------- */

function createSelect(label, options, current, onChange) {
  const field = createEl("label", "forum-field");
  field.appendChild(createEl("span", "forum-field__label", label));
  const select = createEl("select", "forum-input");
  options.forEach(function (option) {
    const item = createEl("option", "", option.label);
    item.value = option.value;
    select.appendChild(item);
  });
  select.value = current;
  select.addEventListener("change", function () { onChange(select.value); });
  field.appendChild(select);
  return field;
}

function hasFilters() {
  return Boolean(forum.q || forum.rating || forum.days || forum.movie);
}

function clearFilters() {
  forum.q = "";
  forum.rating = "";
  forum.days = "";
  forum.movie = null;
  applyFilters();
}

function setView(view) {
  if (forum.view === view) return;
  forum.view = view;
  forum.sort = ""; // each view has its own sort options
  if (view === "movies") forum.movie = null;
  applyFilters();
}

function showMovieReviews(movie) {
  forum.movie = { title_name: movie.title_name, release_year: movie.release_year };
  forum.view = "reviews";
  forum.sort = "";
  applyFilters();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showControls() {
  const box = forumParts.controls;
  box.replaceChildren();

  // Views
  const tabs = createEl("div", "forum-tabs");
  tabs.setAttribute("role", "tablist");
  [{ id: "movies", label: "By movie" }, { id: "reviews", label: "All reviews" }].forEach(function (tab) {
    const button = createButton(tab.label, "forum-tab" + (forum.view === tab.id ? " is-active" : ""), function () {
      setView(tab.id);
    });
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(forum.view === tab.id));
    tabs.appendChild(button);
  });
  box.appendChild(tabs);

  // Filters
  const filters = createEl("div", "forum-filters");

  const search = createEl("label", "forum-field forum-field--search");
  search.appendChild(createEl("span", "forum-field__label", "Search"));
  const input = createEl("input", "forum-input");
  input.type = "search";
  input.placeholder = "Movie, review text or username";
  input.maxLength = 100;
  input.value = forum.q;
  let timer = null;
  input.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      forum.q = input.value.trim();
      writeAddress();
      loadForum(false);
      updateClearButton();
    }, 300);
  });
  search.appendChild(input);
  filters.appendChild(search);

  filters.appendChild(createSelect("Rating", RATING_FILTERS, forum.rating, function (value) {
    forum.rating = value;
    applyFilters();
  }));
  filters.appendChild(createSelect("When", PERIOD_FILTERS, forum.days, function (value) {
    forum.days = value;
    applyFilters();
  }));

  const sorts = forum.view === "movies" ? MOVIE_SORTS : REVIEW_SORTS;
  filters.appendChild(createSelect("Sort by", sorts, forum.sort || sorts[0].value, function (value) {
    forum.sort = value === sorts[0].value ? "" : value;
    applyFilters();
  }));

  const clear = createButton("Clear filters", "forum-clear", clearFilters);
  function updateClearButton() { clear.hidden = !hasFilters(); }
  updateClearButton();
  filters.appendChild(clear);
  box.appendChild(filters);

  // One movie selected
  if (forum.movie) {
    const chip = createEl("div", "forum-chip");
    chip.appendChild(createEl("span", "", "Reviews of " + forum.movie.title_name + " (" + forum.movie.release_year + ")"));
    chip.appendChild(createButton("Show all movies", "forum-chip__close", function () {
      forum.movie = null;
      forum.view = "movies";
      forum.sort = "";
      applyFilters();
    }));
    box.appendChild(chip);
  }
}

/* ---------- Results ---------- */

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function createForumReview(review) {
  const card = createEl("article", "review");

  const top = createEl("div", "review__top");
  const title = createButton(review.title_name + " (" + review.release_year + ")", "review__movie forum-link", function () {
    showMovieReviews(review);
  });
  title.title = "Show only reviews of this movie";
  top.appendChild(title);
  top.appendChild(createStarRating({ value: review.rating }));
  card.appendChild(top);

  if (review.comment) card.appendChild(createEl("p", "review__text", review.comment));

  const foot = createEl("div", "review__foot");
  const mine = forumUser && review.user_id_fk === forumUser.id;
  foot.appendChild(createEl("span", "review__author", mine ? "You" : review.username || "Guest"));
  foot.appendChild(createEl("span", "forum-date", formatDate(review.added_date_time)));
  card.appendChild(foot);
  return card;
}

function createForumMovie(movie) {
  const card = createEl("article", "forum-movie");

  const poster = createEl("div", "forum-movie__poster");
  poster.appendChild(createEl("span", "forum-movie__letter", movie.title_name.charAt(0)));
  const source = posterSource(movie);
  if (source) {
    const img = createEl("img", "forum-movie__img");
    img.alt = movie.title_name + " poster";
    img.loading = "lazy";
    img.addEventListener("error", function () { img.remove(); });
    img.src = source;
    poster.appendChild(img);
  }
  card.appendChild(poster);

  const info = createEl("div", "forum-movie__info");
  info.appendChild(createEl("h3", "forum-movie__title", movie.title_name));
  info.appendChild(createEl("p", "forum-movie__meta", String(movie.release_year)));

  const rating = createEl("div", "forum-movie__rating");
  rating.appendChild(createStarRating({ value: movie.average_rating }));
  rating.appendChild(createEl("span", "forum-movie__score", movie.average_rating.toFixed(1)));
  info.appendChild(rating);

  info.appendChild(
    createEl("p", "forum-movie__meta",
      movie.review_count + (movie.review_count === 1 ? " review" : " reviews") + " · latest " + formatDate(movie.latest_review_at))
  );
  info.appendChild(createButton("Read reviews", "forum-button", function () { showMovieReviews(movie); }));
  card.appendChild(info);
  return card;
}

function showResults() {
  const box = forumParts.results;
  box.replaceChildren();

  if (forum.error) {
    const problem = createEl("div", "forum-empty");
    problem.appendChild(createEl("p", "", forum.error));
    problem.appendChild(createButton("Try again", "forum-button", function () { loadForum(false); }));
    box.appendChild(problem);
    return;
  }

  if (forum.loading && forum.items.length === 0) {
    box.appendChild(createEl("p", "forum-status", "Loading…"));
    return;
  }

  const noun = forum.view === "movies" ? "movie" : "review";
  box.appendChild(
    createEl("p", "forum-status", forum.total + " " + noun + (forum.total === 1 ? "" : "s") + (hasFilters() ? " match your filters" : ""))
  );

  if (forum.items.length === 0) {
    const empty = createEl("div", "forum-empty");
    empty.appendChild(createEl("p", "", hasFilters() ? "Nothing matches these filters." : "No reviews yet. Be the first to write one."));
    if (hasFilters()) empty.appendChild(createButton("Clear filters", "forum-button", clearFilters));
    box.appendChild(empty);
    return;
  }

  const list = createEl("div", forum.view === "movies" ? "forum-grid" : "forum-feed");
  forum.items.forEach(function (item) {
    list.appendChild(forum.view === "movies" ? createForumMovie(item) : createForumReview(item));
  });
  box.appendChild(list);

  if (forum.hasMore) {
    const more = createButton(forum.loading ? "Loading…" : "Load more", "forum-button forum-more", function () {
      loadForum(true);
    });
    more.disabled = forum.loading;
    box.appendChild(more);
  }
}

/* ---------- Start ---------- */

async function startForum() {
  const app = document.getElementById("forum-app");
  forumParts.controls = createEl("div", "forum-controls");
  forumParts.results = createEl("div", "forum-results");
  forumParts.results.setAttribute("aria-live", "polite");
  app.appendChild(forumParts.controls);
  app.appendChild(forumParts.results);

  readAddress();
  showControls();

  // If the free server is asleep, show the loader until it answers (see wake-loader.js)
  wakeLoader.begin();
  try {
    await loadForum(false);
    if (forum.error) {
      await wakeLoader.untilAwake();
      await loadForum(false);
    }
  } finally {
    wakeLoader.end();
  }
}

startForum();
