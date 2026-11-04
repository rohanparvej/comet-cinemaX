// Log in pop-up for visitors. Accounts are created in the database (no sign up here).
//
//   openAuthModal(function (user) { ... })   // called after a successful login
//
// Uses a native <dialog>, so Escape closes it and focus stays inside.
// Styling is in css/components/auth-modal.css

function openAuthModal(onSuccess) {
  const dialog = createEl("dialog", "auth-modal");
  dialog.setAttribute("aria-label", "Log in");

  const card = createEl("div", "auth-modal__card");
  dialog.appendChild(card);
  card.appendChild(createEl("h3", "auth-modal__title", "Log in"));

  const form = createEl("form", "auth-modal__form");
  form.noValidate = true;
  card.appendChild(form);

  function createField(label, type, name, autocomplete) {
    const field = createEl("label", "review-form__field");
    field.appendChild(createEl("span", "review-form__label", label));
    const input = createEl("input", "review-form__input");
    input.type = type;
    input.name = name;
    input.autocomplete = autocomplete;
    field.appendChild(input);
    form.appendChild(field);
    return input;
  }

  const username = createField("Username", "text", "username", "username");

  const passwordLabel = createEl("label", "review-form__field");
  passwordLabel.appendChild(createEl("span", "review-form__label", "Password"));
  const passwordField = createPasswordField("review-form__input", "password", "current-password");
  passwordLabel.appendChild(passwordField.wrap);
  form.appendChild(passwordLabel);
  const password = passwordField.input;

  const message = createEl("p", "review-form__message");
  message.setAttribute("role", "status");
  form.appendChild(message);

  const actions = createEl("div", "auth-modal__actions");
  const submit = createEl("button", "polls-reviews__button polls-reviews__button--primary", "Log in");
  submit.type = "submit";
  actions.appendChild(submit);
  actions.appendChild(createButton("Cancel", "polls-reviews__button polls-reviews__button--ghost", close));
  form.appendChild(actions);

  function close() {
    dialog.close();
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!username.value.trim() || !password.value) {
      message.textContent = "Enter your username and password.";
      return;
    }

    submit.disabled = true;
    message.textContent = "";
    try {
      const result = await apiRequest("/api/auth/login", {
        method: "POST",
        body: { username: username.value.trim(), password: password.value }
      });
      userSession.save(result.token, result.user);
      close();
      if (onSuccess) onSuccess(result.user);
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  // Click on the dark backdrop closes it
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) close();
  });
  dialog.addEventListener("close", function () { dialog.remove(); });

  document.body.appendChild(dialog);
  dialog.showModal();
  username.focus();
}
