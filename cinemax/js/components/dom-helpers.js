// Small helpers shared by all sections.

// createEl("p", "my-class", "Hello") -> <p class="my-class">Hello</p>
function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

// createButton("Sign in", "my-class", function () { ... })
//   -> <button type="button" class="my-class">Sign in</button>
function createButton(text, className, onClick) {
  const button = createEl("button", className, text);
  button.type = "button";
  if (onClick) button.addEventListener("click", onClick);
  return button;
}

// formatRuntime(134) -> "2h 14m", formatRuntime(90) -> "1h 30m", formatRuntime(45) -> "45m"
function formatRuntime(minutes) {
  const total = Number(minutes);
  if (!total) return "";
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return rest + "m";
  return hours + "h" + (rest ? " " + rest + "m" : "");
}


// Password input with a Show / Hide button. Returns { wrap, input }: put `wrap` in the form.
//   const pw = createPasswordField("my-input-class", "password", "current-password");
//   field.appendChild(pw.wrap);   ...   pw.input.value
// Styling is in css/components/password-field.css
function createPasswordField(inputClass, name, autocomplete) {
  const wrap = createEl("div", "password-field");

  const input = createEl("input", inputClass);
  input.type = "password";
  input.name = name;
  input.autocomplete = autocomplete;
  wrap.appendChild(input);

  const toggle = createButton("Show", "password-field__toggle", function () {
    const hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    toggle.textContent = hidden ? "Hide" : "Show";
    toggle.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
    toggle.setAttribute("aria-pressed", String(hidden));
  });
  toggle.setAttribute("aria-label", "Show password");
  toggle.setAttribute("aria-pressed", "false");
  wrap.appendChild(toggle);

  return { wrap: wrap, input: input };
}
