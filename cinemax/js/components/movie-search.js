// Searchable movie box (a combobox: type to search, pick from the list).
// Used by the review form. Movies come from the backend (/api/movies?q=), so it stays fast
// however many movies there are, and it covers every movie that was ever a winner or in the poll.
//
//   const search = createMovieSearch({
//     value: { title_name: "Dune", release_year: 2021 },   // optional, what is selected now
//     onSelect: function (movie) { ... }                   // movie, or null when the text is cleared
//   });
//   form.appendChild(search.el);     search.setValue(movie)     search.getValue()
//
// Keyboard: type to search, Up / Down to move, Enter to pick, Escape to close.
// Styling is in css/components/movie-search.css

const MOVIE_STATUS_LABELS = { now_playing: "Now playing", past_winner: "Past winner" };
let movieSearchCount = 0; // gives every box its own ids

function movieLabel(movie) {
  return movie.title_name + " (" + movie.release_year + ")";
}

function createMovieSearch(options) {
  const id = "movie-search-" + ++movieSearchCount;
  let selected = options.value || null;
  let results = [];
  let active = -1;
  let timer = null;
  let requestNumber = 0;

  const root = createEl("div", "movie-search");

  const input = createEl("input", "movie-search__input review-form__input");
  input.type = "text";
  input.placeholder = "Search a movie or year...";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", id + "-list");
  root.appendChild(input);

  const list = createEl("ul", "movie-search__list");
  list.id = id + "-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  root.appendChild(list);

  function open() {
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function close() {
    list.hidden = true;
    active = -1;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  function showSelected() {
    input.value = selected ? movieLabel(selected) : "";
  }

  function choose(movie) {
    selected = { title_name: movie.title_name, release_year: movie.release_year };
    showSelected();
    close();
    if (options.onSelect) options.onSelect(selected);
  }

  function setActive(index) {
    const items = list.querySelectorAll(".movie-search__option");
    items.forEach(function (item, position) {
      item.classList.toggle("is-active", position === index);
      item.setAttribute("aria-selected", String(position === index));
    });
    active = index;
    if (items[index]) {
      input.setAttribute("aria-activedescendant", items[index].id);
      items[index].scrollIntoView({ block: "nearest" });
    }
  }

  function render(message) {
    list.replaceChildren();
    if (message) {
      const note = createEl("li", "movie-search__note", message);
      note.setAttribute("role", "presentation");
      list.appendChild(note);
      return;
    }
    results.forEach(function (movie, index) {
      const item = createEl("li", "movie-search__option");
      item.id = id + "-option-" + index;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", "false");
      item.appendChild(createEl("span", "movie-search__name", movieLabel(movie)));
      if (movie.status && MOVIE_STATUS_LABELS[movie.status]) {
        item.appendChild(createEl("span", "movie-search__tag", MOVIE_STATUS_LABELS[movie.status]));
      }
      // mousedown (not click) so it runs before the box loses focus
      item.addEventListener("mousedown", function (event) {
        event.preventDefault();
        choose(movie);
      });
      item.addEventListener("mousemove", function () {
        if (active !== index) setActive(index);
      });
      list.appendChild(item);
    });
  }

  async function load(text) {
    const mine = ++requestNumber;
    try {
      const result = await apiRequest("/api/movies?limit=12&q=" + encodeURIComponent(text));
      if (mine !== requestNumber) return; // a newer search is already running
      results = result.data;
      render(results.length ? "" : "No movie found. Only movies from our polls and screenings can be reviewed.");
      if (results.length) setActive(0);
    } catch (error) {
      if (mine !== requestNumber) return;
      results = [];
      render("Could not load movies. Try again.");
    }
    open();
  }

  input.addEventListener("focus", function () {
    input.select();
    load(selected && input.value === movieLabel(selected) ? "" : input.value.trim());
  });

  input.addEventListener("input", function () {
    // Typing changes the movie: nothing is selected until one is picked again
    if (selected) {
      selected = null;
      if (options.onSelect) options.onSelect(null);
    }
    clearTimeout(timer);
    timer = setTimeout(function () { load(input.value.trim()); }, 200);
  });

  input.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      close();
      showSelected();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (list.hidden) { load(input.value.trim()); return; }
      if (!results.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((active + step + results.length) % results.length);
    } else if (event.key === "Enter" && !list.hidden) {
      event.preventDefault(); // pick the movie, do not submit the form
      if (results[active]) choose(results[active]);
    }
  });

  input.addEventListener("blur", function () {
    close();
    showSelected(); // text that was not picked goes back to the selected movie
  });

  showSelected();

  return {
    el: root,
    getValue: function () { return selected; },
    setValue: function (movie) { selected = movie || null; showSelected(); },
    focus: function () { input.focus(); }
  };
}
