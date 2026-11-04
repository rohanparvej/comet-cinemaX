// "Polls & Reviews" section.
//
//   Signed out : see the movies up for a vote and recent reviews, plus a "Sign in" button.
//   Signed in  : vote for ONE movie (once only, never your own recommendation),
//                and add / edit your own review (half stars allowed).
//   Once a screening winner is current the poll is closed: every movie is disabled
//   and the movies move to the lineup in the "Now Playing" section.
//
// Data comes from the backend (loaded in js/main.js). Calls go through js/services/api.js.
// Stars come from js/components/star-rating.js, the login pop-up from js/components/auth-modal.js

const pollsState = {
  user: null,        // logged in user, or null
  winner: null,      // current winner (also reviewable)
  choices: [],       // movies up for a vote
  reviews: [],       // recent reviews from the backend
  myVoteId: null,    // id of the movie I voted for (voting is once only)
  selectedPoll: "",  // movie picked in the poll, not submitted yet
  pollMessage: "",   // message under the poll (errors / "Vote recorded.")
  draft: { key: "", rating: 0, comment: "" },  // what is in the review form
  notice: ""         // one-time message shown in the review form
};

const pollsParts = {};  // header, polls and reviews containers

/* ---------- Helpers ---------- */

// A movie is identified by title + year (that is how the backend keeps one review per movie)
function movieKey(title, year) {
  return title + "|" + year;
}

// Voting is closed as soon as a screening winner is current
function isVotingClosed() {
  return Boolean(pollsState.winner);
}

function isMine(review) {
  return Boolean(pollsState.user) && review.user_id_fk === pollsState.user.id;
}

function endSession() {
  userSession.clear();
  pollsState.user = null;
  pollsState.myVoteId = null;
  pollsState.selectedPoll = "";
  pollsState.notice = "";
}

// If the server says our login expired, drop it and show the signed out page
function handleAuthError(error) {
  if (error.unauthorized) {
    endSession();
    pollsState.pollMessage = "Your session expired. Please sign in again.";
    return true;
  }
  return false;
}

/* ---------- Loading data ---------- */

async function loadMyVote() {
  try {
    const result = await apiRequest("/api/screenings/votes/me", { session: userSession });
    pollsState.myVoteId = result.data ? result.data.screening_choice_id : null;
  } catch (error) {
    handleAuthError(error);
  }
}

async function reloadChoices() {
  const result = await apiRequest("/api/screenings/choices");
  pollsState.choices = result.data;
}

async function reloadReviews() {
  const result = await apiRequest("/api/movie-logs?limit=20");
  pollsState.reviews = result.data;
}

/* ---------- Sign in / out ---------- */

function signIn() {
  openAuthModal(async function (user) {
    pollsState.user = user;
    pollsState.pollMessage = "";
    await loadMyVote();
    showPollsReviews();
  });
}

function signOut() {
  endSession();
  pollsState.pollMessage = "";
  showPollsReviews();
}

/* ---------- Header ---------- */

function showPollsHeader() {
  const header = pollsParts.header;
  header.replaceChildren();

  const intro = createEl("div", "polls-reviews__intro");
  intro.appendChild(createEl("p", "polls-reviews__label", "Your say"));
  intro.appendChild(createEl("h2", "polls-reviews__title", "Polls & Reviews"));
  intro.appendChild(
    createEl("p", "polls-reviews__lead", "Vote for what we screen next, and read what the audience thought.")
  );
  header.appendChild(intro);

  const auth = createEl("div", "polls-reviews__auth");
  if (pollsState.user) {
    auth.appendChild(createEl("span", "polls-reviews__user", "Signed in as " + pollsState.user.username));
    auth.appendChild(createButton("Sign out", "polls-reviews__button polls-reviews__button--ghost", signOut));
  } else {
    auth.appendChild(createButton("Sign in to review & vote", "polls-reviews__button polls-reviews__button--primary", signIn));
  }
  header.appendChild(auth);
}

/* ---------- Polls ---------- */

async function submitPollVote(button) {
  const choiceId = pollsState.selectedPoll;
  if (!choiceId) return;

  button.disabled = true;
  try {
    await apiRequest("/api/screenings/choices/" + choiceId + "/vote", { method: "POST", session: userSession });
    pollsState.myVoteId = choiceId;
    pollsState.pollMessage = "Vote recorded. Thank you!";
  } catch (error) {
    if (!handleAuthError(error)) {
      pollsState.pollMessage = error.message;
      if (error.status === 409) {
        await loadMyVote(); // already voted earlier
        try {
          const latest = await apiRequest("/api/screenings/winner/current");
          pollsState.winner = latest.data; // the poll may have just been closed
        } catch (ignored) {
          // keep what we have
        }
      }
    }
  }
  pollsState.selectedPoll = "";

  try {
    await reloadChoices(); // fresh vote counts
  } catch (error) {
    // keep the old counts if this fails
  }
  showPollsReviews();
}

function createPollThumb(poll) {
  const thumb = createEl("div", "poll__thumb");
  thumb.appendChild(createEl("span", "poll__thumb-letter", poll.title_name.charAt(0)));
  return thumb;
}

function createPollChoice(poll) {
  const mine = pollsState.user && poll.recommended_by && poll.recommended_by.id === pollsState.user.id;

  // Already voted: no more choosing, just mark the movie that got my vote
  if (pollsState.myVoteId) {
    if (poll.id !== pollsState.myVoteId) return null;
    return createEl("p", "poll__badge", "Your vote");
  }

  const choice = createEl("label", "poll__choice");
  const radio = createEl("input", "poll__choice-input");
  radio.type = "radio";
  radio.name = "screening-poll";
  radio.value = poll.id;

  // A winner has been announced: nobody can choose any more
  if (isVotingClosed()) {
    radio.disabled = true;
    choice.classList.add("is-disabled");
    choice.appendChild(radio);
    choice.appendChild(createEl("span", "poll__choice-text", "Voting closed"));
    return choice;
  }

  // You cannot vote for a movie you recommended
  if (mine) {
    radio.disabled = true;
    choice.classList.add("is-disabled");
    choice.appendChild(radio);
    choice.appendChild(createEl("span", "poll__choice-text", "You recommended this"));
    return choice;
  }

  radio.checked = pollsState.selectedPoll === poll.id;
  radio.addEventListener("change", function () {
    pollsState.selectedPoll = poll.id;
    pollsParts.polls.querySelectorAll(".poll__choice").forEach(function (item) {
      item.classList.toggle("is-selected", item.querySelector("input").checked);
    });
    const submit = pollsParts.polls.querySelector(".poll__submit");
    if (submit) submit.disabled = false;
  });
  choice.classList.toggle("is-selected", radio.checked);
  choice.appendChild(radio);
  choice.appendChild(createEl("span", "poll__choice-text", "Vote for this movie"));
  return choice;
}

function createPollCard(poll) {
  const card = createEl("article", "poll");
  card.appendChild(createPollThumb(poll));

  const body = createEl("div", "poll__body");
  body.appendChild(createEl("h4", "poll__title", poll.title_name));
  body.appendChild(
    createEl("p", "poll__meta", [poll.release_year, formatRuntime(poll.runtime)].filter(Boolean).join(" · "))
  );
  if (poll.recommended_by && poll.recommended_by.username) {
    body.appendChild(createEl("p", "poll__meta", "Recommended by " + poll.recommended_by.username));
  }

  const votes = poll.number_of_votes;
  body.appendChild(createEl("p", "poll__stats", votes + (votes === 1 ? " vote" : " votes")));

  if (pollsState.user) {
    const choice = createPollChoice(poll);
    if (choice) body.appendChild(choice);
  }

  card.appendChild(body);
  return card;
}

function showPolls() {
  const box = pollsParts.polls;
  box.replaceChildren();

  box.appendChild(createEl("h3", "polls-reviews__subtitle", "Vote for the next screening"));

  if (pollsState.choices.length === 0) {
    box.appendChild(createEl("p", "polls-reviews__empty", "No movies are up for a vote right now. Check back soon."));
    return;
  }

  if (isVotingClosed()) {
    box.appendChild(
      createEl("p", "polls-reviews__hint", "Voting is closed. The winner is now playing: " + pollsState.winner.title_name + ".")
    );
  }

  const grid = createEl("div", "polls__grid");
  pollsState.choices.forEach(function (poll) {
    grid.appendChild(createPollCard(poll));
  });
  box.appendChild(grid);

  // Voting is once only, so the submit button disappears after a vote
  if (pollsState.user && !pollsState.myVoteId && !isVotingClosed()) {
    const submit = createButton("Submit vote", "polls-reviews__button polls-reviews__button--primary poll__submit", function () {
      submitPollVote(submit);
    });
    submit.disabled = !pollsState.selectedPoll;
    box.appendChild(submit);
    box.appendChild(createEl("p", "polls-reviews__hint", "You can vote once, and a vote cannot be changed."));
  }

  if (pollsState.pollMessage) {
    const message = createEl("p", "poll__message", pollsState.pollMessage);
    message.setAttribute("role", "status");
    box.appendChild(message);
  }
}

/* ---------- Reviews ---------- */

// Every movie that can be reviewed: the winner, the poll movies, and movies already reviewed
function getReviewMovies() {
  const movies = [];
  const seen = {};
  function add(title, year) {
    const key = movieKey(title, year);
    if (seen[key]) return;
    seen[key] = true;
    movies.push({ key: key, title_name: title, release_year: year });
  }
  if (pollsState.winner) add(pollsState.winner.title_name, pollsState.winner.release_year);
  pollsState.choices.forEach(function (poll) { add(poll.title_name, poll.release_year); });
  pollsState.reviews.forEach(function (review) { add(review.title_name, review.release_year); });
  return movies;
}

function findMyReview(key) {
  return pollsState.reviews.find(function (review) {
    return isMine(review) && movieKey(review.title_name, review.release_year) === key;
  });
}

// Loads one of your reviews into the form and moves to it
function editMyReview(review) {
  pollsState.draft = {
    key: movieKey(review.title_name, review.release_year),
    rating: review.rating,
    comment: review.comment || ""
  };
  showReviews();
  const form = pollsParts.reviews.querySelector(".review-form");
  if (form) {
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    form.querySelector("textarea").focus({ preventScroll: true });
  }
}

function createReviewCard(review) {
  const card = createEl("article", "review");

  const top = createEl("div", "review__top");
  top.appendChild(createEl("h4", "review__movie", review.title_name + " (" + review.release_year + ")"));
  top.appendChild(createStarRating({ value: review.rating }));
  card.appendChild(top);

  if (review.comment) card.appendChild(createEl("p", "review__text", review.comment));

  const foot = createEl("div", "review__foot");
  foot.appendChild(createEl("span", "review__author", isMine(review) ? "You" : review.username || "Guest"));
  if (isMine(review)) {
    foot.appendChild(
      createButton("Edit", "polls-reviews__button polls-reviews__button--small", function () {
        editMyReview(review);
      })
    );
  }
  card.appendChild(foot);

  return card;
}

function createReviewForm() {
  const draft = pollsState.draft;
  const movies = getReviewMovies();
  if (!movies.some(function (movie) { return movie.key === draft.key; })) {
    draft.key = movies.length ? movies[0].key : "";
  }

  const form = createEl("form", "review-form");
  form.noValidate = true;

  const heading = createEl("h3", "review-form__title");
  form.appendChild(heading);

  // Movie
  const movieField = createEl("label", "review-form__field");
  movieField.appendChild(createEl("span", "review-form__label", "Movie"));
  const select = createEl("select", "review-form__input");
  movies.forEach(function (movie) {
    const option = createEl("option", "", movie.title_name + " (" + movie.release_year + ")");
    option.value = movie.key;
    select.appendChild(option);
  });
  select.value = draft.key;
  movieField.appendChild(select);
  form.appendChild(movieField);

  // Rating
  const ratingField = createEl("div", "review-form__field");
  ratingField.appendChild(createEl("span", "review-form__label", "Your rating"));
  const stars = createStarRating({
    value: draft.rating,
    label: "Your rating",
    onChange: function (rating) { draft.rating = rating; }
  });
  ratingField.appendChild(stars);
  form.appendChild(ratingField);

  // Comment
  const textField = createEl("label", "review-form__field");
  textField.appendChild(createEl("span", "review-form__label", "Your thoughts"));
  const text = createEl("textarea", "review-form__input review-form__input--text");
  text.rows = 4;
  text.maxLength = 500;
  text.placeholder = "What stayed with you?";
  text.value = draft.comment;
  text.addEventListener("input", function () { draft.comment = text.value; });
  textField.appendChild(text);
  form.appendChild(textField);

  // Message (errors and "saved")
  const message = createEl("p", "review-form__message");
  message.setAttribute("role", "status");
  message.textContent = pollsState.notice;
  pollsState.notice = "";
  form.appendChild(message);

  const submit = createEl("button", "polls-reviews__button polls-reviews__button--primary");
  submit.type = "submit";
  form.appendChild(submit);

  // Adds or edits depending on whether you already reviewed the selected movie
  function updateLabels() {
    const editing = Boolean(findMyReview(draft.key));
    heading.textContent = editing ? "Edit your review" : "Add your review";
    submit.textContent = editing ? "Update review" : "Post review";
  }
  updateLabels();

  select.addEventListener("change", function () {
    draft.key = select.value;
    const mine = findMyReview(draft.key);
    draft.rating = mine ? mine.rating : 0;
    draft.comment = mine ? mine.comment || "" : "";
    stars.setValue(draft.rating);
    text.value = draft.comment;
    message.textContent = "";
    updateLabels();
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const comment = draft.comment.trim();
    if (!draft.rating) {
      message.textContent = "Pick a star rating first.";
      return;
    }
    if (!comment) {
      message.textContent = "Write a few words about the film.";
      return;
    }
    const movie = movies.find(function (item) { return item.key === draft.key; });
    if (!movie) {
      message.textContent = "Pick a movie first.";
      return;
    }

    submit.disabled = true;
    try {
      await apiRequest("/api/movie-logs", {
        method: "POST",
        session: userSession,
        body: {
          title_name: movie.title_name,
          release_year: movie.release_year,
          rating: draft.rating,
          comment: comment
        }
      });
      await reloadReviews();
      pollsState.notice = "Review saved.";
      showReviews();
    } catch (error) {
      if (handleAuthError(error)) {
        showPollsReviews();
      } else {
        message.textContent = error.message;
        submit.disabled = false;
      }
    }
  });

  return form;
}

// Shown instead of the form when signed out
function createSignInPrompt() {
  const prompt = createEl("div", "review-prompt");
  prompt.appendChild(createEl("h3", "review-form__title", "Join the conversation"));
  prompt.appendChild(createEl("p", "review-prompt__text", "Sign in to vote on screenings and write your own review."));
  prompt.appendChild(createButton("Sign in to review & vote", "polls-reviews__button polls-reviews__button--primary", signIn));
  return prompt;
}

function showReviews() {
  const box = pollsParts.reviews;
  box.replaceChildren();

  box.appendChild(createEl("h3", "polls-reviews__subtitle", "Recent reviews"));

  const layout = createEl("div", "reviews__layout");

  const list = createEl("div", "reviews__list");
  if (pollsState.reviews.length === 0) {
    list.appendChild(createEl("p", "polls-reviews__empty", "No reviews yet. Be the first to write one."));
  }
  pollsState.reviews.forEach(function (review) {
    list.appendChild(createReviewCard(review));
  });
  layout.appendChild(list);

  const side = createEl("div", "reviews__side");
  side.appendChild(pollsState.user ? createReviewForm() : createSignInPrompt());
  layout.appendChild(side);

  box.appendChild(layout);
}

/* ---------- Start ---------- */

function showPollsReviews() {
  showPollsHeader();
  showPolls();
  showReviews();
}

async function initPollsReviews(data) {
  const section = document.getElementById("polls-reviews");
  if (!section) return;

  pollsState.winner = data.winner;
  pollsState.choices = data.choices;
  pollsState.reviews = data.reviews;
  if (data.error) pollsState.pollMessage = data.error;

  const saved = userSession.load();
  pollsState.user = saved ? saved.user : null;

  const inner = createEl("div", "polls-reviews__inner");
  pollsParts.header = createEl("div", "polls-reviews__header");
  pollsParts.polls = createEl("div", "polls");
  pollsParts.reviews = createEl("div", "reviews");
  inner.appendChild(pollsParts.header);
  inner.appendChild(pollsParts.polls);
  inner.appendChild(pollsParts.reviews);
  section.appendChild(inner);

  if (pollsState.user) await loadMyVote();
  showPollsReviews();
}
