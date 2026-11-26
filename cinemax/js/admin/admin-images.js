// Admin tab: site images. Each image is stored in the database by the backend.
// To add another slot (e.g. a poster), add it here AND in cinemax-backend/src/config/imageSlots.js.

const IMAGE_SLOTS = [
  {
    key: "now_playing_background",
    label: "Now Playing background",
    hint: "Shown behind the featured movie on the home page. A wide image works best."
  },
  {
    key: "hero_background",
    label: "Hero background",
    hint: "Full-screen image at the very top of the home page. A wide, landscape image works best.",
    emptyText: "No image set. The built-in hero image is used.",
    caption: {
      key: "hero_caption",
      label: "Hero caption (\"In Frame\" text)",
      hint: "The small line under the hero tagline that describes the background image.",
      defaultText: "In Frame: Fallen Angels (1995)",
      maxLength: 150
    }
  }
];

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2).replace(/\.?0+$/, "") + " MB";
  return Math.round(bytes / 1024) + " KB";
}

// Text box + Save / Reset for a caption that belongs to an image slot
function createCaptionEditor(caption) {
  const saved = adminState.texts[caption.key];
  const form = createEl("form", "admin-image__form admin-image__caption");

  const field = createEl("label", "admin-field");
  field.appendChild(createEl("span", "admin-field__label", caption.label));
  const input = createEl("input", "admin-input");
  input.type = "text";
  input.maxLength = caption.maxLength;
  input.value = saved || caption.defaultText;
  input.placeholder = caption.defaultText;
  field.appendChild(input);
  form.appendChild(field);
  form.appendChild(
    createEl("p", "admin-muted", caption.hint + (saved ? "" : " Currently using the built-in text."))
  );

  const buttons = createEl("div", "admin-image__buttons");
  const save = createEl("button", "admin-btn admin-btn--primary", "Save caption");
  save.type = "submit";
  buttons.appendChild(save);
  if (saved) {
    buttons.appendChild(createButton("Reset to default", "admin-btn admin-btn--danger", function () {
      runAdminAction(async function () {
        await adminRequest("/api/admin/texts/" + caption.key, { method: "DELETE" });
        await refreshAdmin();
        setAdminStatus(caption.label + " reset to default.", false);
      });
    }));
  }
  form.appendChild(buttons);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      setAdminStatus("The caption cannot be empty. Use \"Reset to default\" to go back to the built-in one.", true);
      return;
    }
    save.disabled = true;
    runAdminAction(async function () {
      try {
        const result = await adminRequest("/api/admin/texts/" + caption.key, { method: "PUT", body: { value: value } });
        await refreshAdmin();
        setAdminStatus(result.message, false);
      } finally {
        save.disabled = false;
      }
    });
  });

  return form;
}

function createImageSlot(slot) {
  const current = adminState.images[slot.key];
  const box = createEl("div", "admin-image");

  box.appendChild(createEl("h3", "admin-image__title", slot.label));
  box.appendChild(createEl("p", "admin-muted", slot.hint));

  // Preview: the saved image, or the file just picked
  const preview = createEl("div", "admin-image__preview");
  const previewImg = createEl("img", "admin-image__img");
  previewImg.alt = slot.label + " preview";
  const empty = createEl("p", "admin-muted admin-image__empty", slot.emptyText || "No image set. The default colour background is used.");
  preview.appendChild(previewImg);
  preview.appendChild(empty);
  function showPreview(url) {
    previewImg.hidden = !url;
    empty.hidden = Boolean(url);
    if (url) previewImg.src = url;
  }
  showPreview(current ? CINEMAX_CONFIG.apiBaseUrl + current.url : "");
  box.appendChild(preview);
  if (current) {
    box.appendChild(createEl("p", "admin-muted", "Current file: " + formatBytes(current.size)));
  }

  // Picker + buttons
  const form = createEl("form", "admin-image__form");
  const file = createEl("input", "admin-input");
  file.type = "file";
  file.accept = IMAGE_TYPES.join(",");
  form.appendChild(file);
  form.appendChild(
    createEl("p", "admin-muted", "JPG, PNG or WebP, up to " + formatBytes(adminState.maxUploadBytes) + ".")
  );

  const buttons = createEl("div", "admin-image__buttons");
  const upload = createEl("button", "admin-btn admin-btn--primary", current ? "Replace image" : "Upload image");
  upload.type = "submit";
  upload.disabled = true;
  buttons.appendChild(upload);
  if (current) {
    buttons.appendChild(createButton("Remove image", "admin-btn admin-btn--danger", function () {
      if (!confirm("Remove the " + slot.label + "? The home page goes back to the default.")) return;
      runAdminAction(async function () {
        await adminRequest("/api/admin/images/" + slot.key, { method: "DELETE" });
        await refreshAdmin();
        setAdminStatus(slot.label + " removed.", false);
      });
    }));
  }
  form.appendChild(buttons);
  box.appendChild(form);

  if (slot.caption) box.appendChild(createCaptionEditor(slot.caption));

  // Check the file in the browser first (the backend checks again)
  file.addEventListener("change", function () {
    upload.disabled = true;
    const picked = file.files[0];
    if (!picked) {
      showPreview(current ? CINEMAX_CONFIG.apiBaseUrl + current.url : "");
      return;
    }
    if (IMAGE_TYPES.indexOf(picked.type) === -1) {
      setAdminStatus("Only JPG, PNG or WebP images are allowed.", true);
      file.value = "";
      return;
    }
    if (picked.size > adminState.maxUploadBytes) {
      setAdminStatus(
        "That image is " + formatBytes(picked.size) + ". The maximum is " + formatBytes(adminState.maxUploadBytes) + ".",
        true
      );
      file.value = "";
      return;
    }
    setAdminStatus("", false);
    showPreview(URL.createObjectURL(picked));
    upload.disabled = false;
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const picked = file.files[0];
    if (!picked) return;
    const data = new FormData();
    data.append("image", picked); // the backend expects the field name "image"

    upload.disabled = true;
    runAdminAction(async function () {
      try {
        const result = await adminRequest("/api/admin/images/" + slot.key, { method: "PUT", body: data });
        await refreshAdmin();
        setAdminStatus(result.message, false);
      } finally {
        upload.disabled = false;
      }
    });
  });

  return box;
}

function showImagesSection() {
  const box = adminParts.images;
  box.replaceChildren();
  box.appendChild(createEl("h2", "admin-card__title", "Site images"));
  IMAGE_SLOTS.forEach(function (slot) {
    box.appendChild(createImageSlot(slot));
  });
}