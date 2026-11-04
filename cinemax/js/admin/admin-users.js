// Admin tab: user accounts.
//   - create a normal user (username + password); they can then log in on the home page
//   - list the existing users
// The backend hashes the password; it is never stored or shown in plain text.

function createUserForm() {
  const form = createEl("form", "admin-form");
  form.noValidate = true;

  function addField(label, control, wide) {
    const field = createEl("label", "admin-field" + (wide ? " admin-field--wide" : ""));
    field.appendChild(createEl("span", "admin-field__label", label));
    field.appendChild(control);
    form.appendChild(field);
  }

  const username = createEl("input", "admin-input");
  username.type = "text";
  username.name = "new-username";
  username.autocomplete = "off";
  username.maxLength = 30;
  addField("Username", username);

  const passwordField = createPasswordField("admin-input", "new-password", "new-password");
  addField("Password", passwordField.wrap);

  const email = createEl("input", "admin-input");
  email.type = "email";
  email.name = "new-email";
  email.autocomplete = "off";
  addField("Email (optional)", email);

  const submit = createEl("button", "admin-btn admin-btn--primary", "Create user");
  submit.type = "submit";
  form.appendChild(submit);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const name = username.value.trim();
    if (name.length < 3) {
      setAdminStatus("Username must be at least 3 characters.", true);
      return;
    }
    if (passwordField.input.value.length < 6) {
      setAdminStatus("Password must be at least 6 characters.", true);
      return;
    }

    const body = { username: name, password: passwordField.input.value };
    if (email.value.trim()) body.email = email.value.trim();

    submit.disabled = true;
    runAdminAction(async function () {
      try {
        await adminRequest("/api/admin/users", { method: "POST", body: body });
        await refreshAdmin(); // re-draws this tab with an empty form
        setAdminStatus('User "' + name.toLowerCase() + '" created. They can log in now.', false);
      } finally {
        submit.disabled = false;
      }
    });
  });

  return form;
}

function showUsersSection() {
  const box = adminParts.users;
  box.replaceChildren();

  box.appendChild(createEl("h2", "admin-card__title", "Add a user"));
  box.appendChild(createUserForm());

  box.appendChild(createEl("h2", "admin-card__title admin-card__title--spaced", "Users (" + adminState.users.length + ")"));
  const list = createEl("ul", "admin-users");
  adminState.users.forEach(function (user) {
    const item = createEl("li", "admin-user");
    item.appendChild(createEl("span", "", user.username));
    if (user.is_admin) item.appendChild(createEl("span", "admin-tag admin-tag--current", "Admin"));
    list.appendChild(item);
  });
  box.appendChild(list);
}
