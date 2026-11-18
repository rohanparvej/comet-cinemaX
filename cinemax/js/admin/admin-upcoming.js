// Admin section: upcoming movies (the small cards in the home page shortlist scroller).
//   - add as many as you like, each with its own poster
//   - replace / remove a poster, remove a movie (soft delete)

function createUpcomingForm() {
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

  const runtime = addField("Runtime in minutes (optional)", createEl("input"));
  runtime.type = "number";
  runtime.min = "1";

  const details = addField("Details (optional)", createEl("textarea"), true);
  details.rows = 2;
  details.maxLength = 2000;

  const picker = createPosterPicker();
  form.appendChild(picker.el);

  const submit = createEl("button", "admin-btn admin-btn--primary", "Add upcoming movie");
  submit.type = "submit";
  form.appendChild(submit);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!title.value.trim() || !year.value) {
      setAdminStatus("Fill in the title and release year.", true);
      return;
    }
    const body = { title_name: title.value.trim(), release_year: Number(year.value) };
    if (runtime.value) body.runtime = Number(runtime.value);
    if (details.value.trim()) body.details = details.value.trim();
    if (picker.value()) body.poster = picker.value();

    submit.disabled = true;
    runAdminAction(async function () {
      try {
        await adminRequest("/api/admin/upcoming", { method: "POST", body: body });
        setAdminStatus('"' + body.title_name + '" added to upcoming.', false);
        await refreshAdmin();
      } finally {
        submit.disabled = false;
      }
    });
  });

  return form;
}

function removeUpcoming(entry) {
  if (!confirm('Remove "' + entry.title_name + '" from the upcoming list?')) return;
  runAdminAction(async function () {
    await adminRequest("/api/admin/upcoming/" + entry.id, { method: "DELETE" });
    setAdminStatus('"' + entry.title_name + '" removed from upcoming.', false);
    await refreshAdmin();
  });
}

function createUpcomingItem(entry) {
  const item = createEl("li", "admin-upcoming__item");
  item.appendChild(createPosterThumb(entry.poster_url, entry.title_name));

  const info = createEl("div", "admin-upcoming__info");
  info.appendChild(createEl("strong", "", entry.title_name));
  info.appendChild(
    createEl("span", "admin-muted", [entry.release_year, formatRuntime(entry.runtime)].filter(Boolean).join(" · "))
  );
  item.appendChild(info);

  const actions = createEl("div", "admin-upcoming__actions");
  actions.appendChild(createPosterReplaceButton("upcoming", entry));
  if (entry.poster_url) actions.appendChild(createPosterRemoveButton("upcoming", entry));
  actions.appendChild(createButton("Remove", "admin-btn admin-btn--small admin-btn--danger", function () {
    removeUpcoming(entry);
  }));
  item.appendChild(actions);
  return item;
}

function showUpcomingSection() {
  const box = adminParts.upcoming;
  box.replaceChildren();

  box.appendChild(createEl("h2", "admin-card__title", "Add an upcoming movie"));
  box.appendChild(
    createEl("p", "admin-muted", "Upcoming movies appear as the small cards in the home page shortlist, next to the shortlisted runner-up.")
  );
  box.appendChild(createUpcomingForm());

  const head = createEl("div", "admin-card__head");
  head.appendChild(createEl("h2", "admin-card__title", "Upcoming movies (" + adminState.upcoming.length + ")"));
  box.appendChild(head);

  if (adminState.upcoming.length === 0) {
    box.appendChild(createEl("p", "admin-muted", "No upcoming movies yet. Add one above."));
    return;
  }
  const list = createEl("ul", "admin-upcoming");
  adminState.upcoming.forEach(function (entry) {
    list.appendChild(createUpcomingItem(entry));
  });
  box.appendChild(list);
}
