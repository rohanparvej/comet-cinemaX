// Admin login form. Only accounts with is_admin can get in (the backend checks).

function showAdminLogin(message) {
  const root = document.getElementById("admin-root");
  root.replaceChildren();
  adminParts.status = null;

  const wrap = createEl("div", "admin-login");
  const form = createEl("form", "admin-login__card");
  form.noValidate = true;

  form.appendChild(createEl("h1", "admin__brand", "Cinemax Admin"));
  form.appendChild(createEl("p", "admin-muted", "Log in with an admin account."));

  function addField(label, type, name, autocomplete) {
    const field = createEl("label", "admin-field");
    field.appendChild(createEl("span", "admin-field__label", label));
    const input = createEl("input", "admin-input");
    input.type = type;
    input.name = name;
    input.autocomplete = autocomplete;
    field.appendChild(input);
    form.appendChild(field);
    return input;
  }
  const username = addField("Username", "text", "username", "username");

  const passwordLabel = createEl("label", "admin-field");
  passwordLabel.appendChild(createEl("span", "admin-field__label", "Password"));
  const passwordField = createPasswordField("admin-input", "password", "current-password");
  passwordLabel.appendChild(passwordField.wrap);
  form.appendChild(passwordLabel);
  const password = passwordField.input;

  const note = createEl("p", "admin-status admin-status--error", message);
  note.setAttribute("role", "status");
  form.appendChild(note);

  const submit = createEl("button", "admin-btn admin-btn--primary", "Log in");
  submit.type = "submit";
  form.appendChild(submit);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!username.value.trim() || !password.value) {
      note.textContent = "Enter your username and password.";
      return;
    }
    submit.disabled = true;
    try {
      const result = await apiRequest("/api/auth/admin/login", {
        method: "POST",
        body: { username: username.value.trim(), password: password.value }
      });
      adminSession.save(result.token, result.user);
      showAdminDashboard();
    } catch (error) {
      note.textContent = error.message;
      submit.disabled = false;
    }
  });

  wrap.appendChild(form);
  root.appendChild(wrap);
  username.focus();
}
