// Shared poster helpers for the admin tabs (Movies and Upcoming).
// A poster is picked as a file, shrunk in the browser, and sent to the backend as a
// base64 data URI ("data:image/jpeg;base64,..."). The backend stores it on the movie itself.

const POSTER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const POSTER_MAX_HEIGHT = 900; // pixels: plenty for a poster card, keeps uploads small
const POSTER_MAX_WIDTH = 600;

// Size in bytes of the image inside a data URI
function dataUriBytes(dataUri) {
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

// File -> shrunk JPEG data URI. Rejects with a readable Error.
function readPosterFile(file) {
  return new Promise(function (resolve, reject) {
    if (POSTER_TYPES.indexOf(file.type) === -1) {
      reject(new Error("Only JPG, PNG or WebP images are allowed."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, POSTER_MAX_HEIGHT / img.naturalHeight, POSTER_MAX_WIDTH / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // JPEG has no transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUri = canvas.toDataURL("image/jpeg", 0.85);
      if (dataUriBytes(dataUri) > adminState.maxUploadBytes) {
        reject(new Error("That poster is still too large after shrinking. The maximum is " + formatBytes(adminState.maxUploadBytes) + "."));
        return;
      }
      resolve(dataUri);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image. Try another file."));
    };
    img.src = url;
  });
}

// Small poster picture for tables and lists (placeholder when the movie has none)
function createPosterThumb(posterUrl, title) {
  if (!posterUrl) return createEl("span", "admin-thumb admin-thumb--empty", "No poster");
  const img = createEl("img", "admin-thumb");
  img.alt = (title || "Movie") + " poster";
  img.loading = "lazy";
  img.src = CINEMAX_CONFIG.apiBaseUrl + posterUrl;
  return img;
}

// Poster field for the "add movie" forms.
//   const picker = createPosterPicker();   form.appendChild(picker.el);
//   picker.value() -> data URI or ""        picker.clear() -> empties it after saving
function createPosterPicker() {
  let dataUri = "";
  const field = createEl("div", "admin-field admin-field--wide admin-poster-picker");
  field.appendChild(createEl("span", "admin-field__label", "Poster (optional, JPG, PNG or WebP)"));

  const row = createEl("div", "admin-poster-picker__row");
  const preview = createEl("div", "admin-poster-picker__preview");
  const img = createEl("img", "admin-poster-picker__img");
  img.alt = "Poster preview";
  img.hidden = true;
  const empty = createEl("span", "admin-muted", "No poster");
  preview.appendChild(img);
  preview.appendChild(empty);

  const side = createEl("div", "admin-poster-picker__side");
  const file = createEl("input", "admin-input");
  file.type = "file";
  file.accept = POSTER_TYPES.join(",");
  const note = createEl("p", "admin-muted", "Tall (2:3) images look best. Large files are shrunk automatically.");
  const clearButton = createButton("Clear", "admin-btn admin-btn--small", function () { reset(); });
  clearButton.hidden = true;
  side.appendChild(file);
  side.appendChild(note);
  side.appendChild(clearButton);

  row.appendChild(preview);
  row.appendChild(side);
  field.appendChild(row);

  function reset() {
    dataUri = "";
    file.value = "";
    img.hidden = true;
    empty.hidden = false;
    clearButton.hidden = true;
  }

  file.addEventListener("change", async function () {
    const picked = file.files[0];
    if (!picked) { reset(); return; }
    try {
      dataUri = await readPosterFile(picked);
      img.src = dataUri;
      img.hidden = false;
      empty.hidden = true;
      clearButton.hidden = false;
      setAdminStatus("", false);
    } catch (error) {
      reset();
      setAdminStatus(error.message, true);
    }
  });

  return { el: field, value: function () { return dataUri; }, clear: reset };
}

// "Replace poster" button: opens the file picker, then saves the poster for that movie.
//   kind = "choices" (poll movie) or "upcoming"
function createPosterReplaceButton(kind, entry) {
  const input = createEl("input");
  input.type = "file";
  input.accept = POSTER_TYPES.join(",");
  input.hidden = true;

  const button = createButton(entry.poster_url ? "Replace poster" : "Add poster", "admin-btn admin-btn--small", function () {
    input.click();
  });
  input.addEventListener("change", function () {
    const picked = input.files[0];
    input.value = "";
    if (!picked) return;
    runAdminAction(async function () {
      try {
        const poster = await readPosterFile(picked);
        await adminRequest("/api/admin/" + kind + "/" + entry.id + "/poster", { method: "PUT", body: { poster: poster } });
        setAdminStatus('Poster saved for "' + entry.title_name + '".', false);
        await refreshAdmin();
      } catch (error) {
        if (error.unauthorized) throw error;
        setAdminStatus(error.message, true);
      }
    });
  });
  // The hidden input sits next to the button (inside a button its click would bubble back to it)
  const wrap = createEl("span", "admin-inline");
  wrap.appendChild(button);
  wrap.appendChild(input);
  return wrap;
}

function createPosterRemoveButton(kind, entry) {
  return createButton("Remove poster", "admin-btn admin-btn--small", function () {
    if (!confirm('Remove the poster of "' + entry.title_name + '"?')) return;
    runAdminAction(async function () {
      await adminRequest("/api/admin/" + kind + "/" + entry.id + "/poster", { method: "DELETE" });
      setAdminStatus('Poster removed from "' + entry.title_name + '".', false);
      await refreshAdmin();
    });
  });
}
