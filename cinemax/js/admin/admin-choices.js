// Admin section: the movies people can vote on.
//   - add a movie (recommended by = a user picked from the dropdown)
//   - remove a movie (soft delete: it only disappears from the poll)
//   - see who voted for each movie
//   - declare a movie the winner (only while no winner is current)
//   - "Open voting" switch: lets people vote again while the current winner stays
//   - give each movie its own poster (base64, see admin-poster.js)

function recommenderName(entry) {
  return entry.recommended_by && entry.recommended_by.username ? entry.recommended_by.username : "-";
}

/* ---------- Add form ---------- */

function createChoiceForm() {
  const form = createEl("form", "admin-form");
  form.noValidate = true;

  function addField(label, input, wide) {
    const field = createEl("label", "admin-field" + (wide ? " admin-field--wide" : ""));
    field.appendChild(createEl("span", "admin-field__label", label));
    input.classList.add("admin-input");
    field.appendChild(input);
    form.appendChild(field);
    return input;
  }

  const title = addField("Title", createEl("input"));
  title.type = "text";
  title.maxLength = 200;

  const year = addField("Release year", createEl("input"));
  year.type = "number";
  year.min = "1888";

  const runtime = addField("Runtime (minutes)", createEl("input"));
  runtime.type = "number";
  runtime.min = "1";

  const recommender = addField("Recommended by", createEl("select"));
  recommender.appendChild(createEl("option", "", "Select a user..."));
  recommender.firstChild.value = "";
  adminState.users.forEach(function (user) {
    const option = createEl("option", "", user.username);
    option.value = user.id;
    recommender.appendChild(option);
  });

  const details = addField("Details (optional)", createEl("textarea"), true);
  details.rows = 3;
  details.maxLength = 2000;

  const picker = createPosterPicker();
  form.appendChild(picker.el);

  const submit = createEl("button", "admin-btn admin-btn--primary", "Add to poll");
  submit.type = "submit";
  form.appendChild(submit);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!title.value.trim() || !year.value || !runtime.value || !recommender.value) {
      setAdminStatus("Fill in the title, year, runtime and who recommended it.", true);
      return;
    }
    const body = {
      title_name: title.value.trim(),
      release_year: Number(year.value),
      runtime: Number(runtime.value),
      recommended_by: recommender.value,
      details: details.value.trim()
    };
    if (picker.value()) body.poster = picker.value();

    submit.disabled = true;
    runAdminAction(async function () {
      try {
        await adminRequest("/api/admin/choices", { method: "POST", body: body });
        setAdminStatus('"' + title.value.trim() + '" added to the poll.', false);
        await refreshAdmin();
      } finally {
        submit.disabled = false;
      }
    });
  });

  return form;
}

/* ---------- Open voting switch ---------- */

function setVotingOpen(open) {
  if (open) {
    const stale = adminState.choices.filter(function (entry) { return !entry.is_deleted && entry.number_of_votes > 0; }).length;
    const warning = stale
      ? "\n\n" + stale + (stale === 1 ? " movie in the poll still holds" : " movies in the poll still hold") +
        " votes from the last round. People who voted for them cannot vote again until those movies are removed from the poll."
      : "";
    if (!confirm("Open voting? People can vote again while the current winner stays on the home page." + warning)) {
      return runAdminAction(refreshAdmin); // puts the switch back
    }
  }
  runAdminAction(async function () {
    await adminRequest("/api/admin/voting", { method: "PUT", body: { open: open } });
    setAdminStatus(open ? "Voting is open." : "Voting is closed.", false);
    await refreshAdmin();
  });
}

function createVotingCard() {
  const voting = adminState.voting;
  const card = createEl("div", "admin-voting");

  const text = createEl("div", "admin-voting__text");
  text.appendChild(createEl("strong", "", "Open voting"));
  text.appendChild(
    createEl(
      "span",
      "admin-muted",
      voting.has_current_winner
        ? voting.voting_open
          ? "Voting is open. People can vote while the current winner stays on the home page. Switch off to close the poll again."
          : "Voting is closed because a winner is current. Add the next movies below, remove last round's movies (this releases their votes), then switch on."
        : "Voting is open: there is no current winner. Declaring a winner closes it."
    )
  );
  card.appendChild(text);

  const label = createEl("label", "admin-switch");
  const input = createEl("input");
  input.type = "checkbox";
  input.setAttribute("role", "switch");
  input.checked = voting.is_voting_open;
  input.disabled = !voting.has_current_winner; // with no winner voting is always open
  input.addEventListener("change", function () { setVotingOpen(input.checked); });
  label.appendChild(input);
  label.appendChild(createEl("span", "admin-switch__track"));
  label.appendChild(createEl("span", "admin-switch__label", voting.is_voting_open ? "On" : "Off"));
  card.appendChild(label);
  return card;
}

/* ---------- Actions ---------- */

function removeChoice(entry) {
  if (!confirm('Remove "' + entry.title_name + '" from the poll? Votes for it are kept.')) return;
  runAdminAction(async function () {
    await adminRequest("/api/admin/choices/" + entry.id, { method: "DELETE" });
    setAdminStatus('"' + entry.title_name + '" removed from the poll.', false);
    await refreshAdmin();
  });
}

function declareWinner(entry) {
  if (!confirm('Declare "' + entry.title_name + '" the winner? It becomes the current screening on the home page.')) return;

  let details = entry.details;
  if (!details) {
    details = prompt('"' + entry.title_name + '" has no details yet. Write a short description for the winner announcement:');
    if (!details || !details.trim()) return;
  }

  runAdminAction(async function () {
    await adminRequest("/api/admin/winners", {
      method: "POST",
      body: { screening_choice_id: entry.id, details: details.trim() }
    });
    setAdminStatus('"' + entry.title_name + '" is now the current screening.', false);
    await refreshAdmin();
  });
}

/* ---------- Table ---------- */

function createVotersList(entry) {
  const box = createEl("div", "admin-voters");
  if (entry.voters.length === 0) {
    box.appendChild(createEl("p", "admin-muted", "Nobody has voted for this movie yet."));
    return box;
  }
  const list = createEl("ul", "admin-voters__list");
  entry.voters.forEach(function (voter) {
    list.appendChild(createEl("li", "admin-voters__item", voter.username));
  });
  box.appendChild(list);
  return box;
}

function createChoiceRow(entry, table) {
  const row = createEl("tr", entry.is_deleted ? "is-removed" : "");
  const posterCell = createEl("td");
  posterCell.appendChild(createPosterThumb(entry.poster_url, entry.title_name));
  row.appendChild(posterCell);
  row.appendChild(createEl("td", "", entry.title_name));
  row.appendChild(createEl("td", "", String(entry.release_year)));
  row.appendChild(createEl("td", "", formatRuntime(entry.runtime)));
  row.appendChild(createEl("td", "", recommenderName(entry)));
  row.appendChild(createEl("td", "admin-table__num", String(entry.number_of_votes)));

  const actions = createEl("td", "admin-table__actions");
  if (entry.is_deleted) {
    actions.appendChild(createEl("span", "admin-tag", "Removed"));
    // A removed movie keeps its poster in the database until it is removed here
    if (entry.poster_url) actions.appendChild(createPosterRemoveButton("choices", entry));
  } else {
    const votersRow = createEl("tr", "admin-table__voters");
    votersRow.hidden = true;
    const cell = createEl("td");
    cell.colSpan = 7;
    cell.appendChild(createVotersList(entry));
    votersRow.appendChild(cell);

    const toggle = createButton("Voters (" + entry.voters.length + ")", "admin-btn admin-btn--small", function () {
      votersRow.hidden = !votersRow.hidden;
      toggle.setAttribute("aria-expanded", String(!votersRow.hidden));
    });
    toggle.setAttribute("aria-expanded", "false");
    actions.appendChild(toggle);
    actions.appendChild(createPosterReplaceButton("choices", entry));
    if (entry.poster_url) actions.appendChild(createPosterRemoveButton("choices", entry));
    const declare = createButton("Declare winner", "admin-btn admin-btn--small admin-btn--primary", function () {
      declareWinner(entry);
    });
    if (adminState.voting.has_current_winner) {
      declare.disabled = true; // only one winner at a time
      declare.title = "Turn off the current winner first (Screening winners tab)";
    }
    actions.appendChild(declare);
    actions.appendChild(createButton("Remove", "admin-btn admin-btn--small admin-btn--danger", function () {
      removeChoice(entry);
    }));

    row.appendChild(actions);
    table.appendChild(row);
    table.appendChild(votersRow);
    return;
  }
  row.appendChild(actions);
  table.appendChild(row);
}

/* ---------- Section ---------- */

function showChoicesSection() {
  const box = adminParts.choices;
  box.replaceChildren();

  box.appendChild(createVotingCard());
  box.appendChild(createEl("h2", "admin-card__title", "Add a movie to the poll"));
  box.appendChild(createChoiceForm());

  const head = createEl("div", "admin-card__head");
  head.appendChild(createEl("h2", "admin-card__title", "Poll entries"));
  const toggle = createEl("label", "admin-check");
  const checkbox = createEl("input");
  checkbox.type = "checkbox";
  checkbox.checked = adminState.showRemoved;
  checkbox.addEventListener("change", function () {
    adminState.showRemoved = checkbox.checked;
    runAdminAction(refreshAdmin);
  });
  toggle.appendChild(checkbox);
  toggle.appendChild(createEl("span", "", "Show removed"));
  head.appendChild(toggle);
  box.appendChild(head);

  if (adminState.choices.length === 0) {
    box.appendChild(createEl("p", "admin-muted", "No movies in the poll yet. Add one above."));
    return;
  }

  const wrap = createEl("div", "admin-table-wrap");
  const table = createEl("table", "admin-table");
  const headRow = createEl("tr");
  ["Poster", "Title", "Year", "Runtime", "Recommended by", "Votes", ""].forEach(function (label) {
    headRow.appendChild(createEl("th", "", label));
  });
  const thead = createEl("thead");
  thead.appendChild(headRow);
  table.appendChild(thead);

  const body = createEl("tbody");
  adminState.choices.forEach(function (entry) {
    createChoiceRow(entry, body);
  });
  table.appendChild(body);
  wrap.appendChild(table);
  box.appendChild(wrap);
}
