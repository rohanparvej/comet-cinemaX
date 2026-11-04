// Admin page entry: decides between the login form and the dashboard.
//
//   Dashboard tabs (one file each):
//     Movies            admin-choices.js : add movies to the poll, remove them, see who voted
//     Screening winners admin-winners.js : declare a winner, choose which winner is current
//     Users             admin-users.js   : create user accounts, see existing users
//     Images            admin-images.js  : upload the site images (Now Playing background)
//   Login form: admin-login.js

const adminState = {
  users: [],          // for the "recommended by" dropdown
  choices: [],        // poll entries (with voters)
  winners: [],
  images: {},         // which site images are set: { slot: { url, size } or null }
  maxUploadBytes: 1048576, // upload limit, read from the backend (MAX_IMAGE_UPLOAD_MB)
  showRemoved: false, // also list soft-deleted poll entries
  tab: "choices"      // the tab that is open
};

const ADMIN_TABS = [
  { id: "choices", label: "Movies" },
  { id: "winners", label: "Screening winners" },
  { id: "users", label: "Users" },
  { id: "images", label: "Images" }
];

const adminParts = {}; // status line + the section containers

// Calls the backend with the admin's token
function adminRequest(path, options) {
  return apiRequest(path, Object.assign({ session: adminSession }, options));
}

function setAdminStatus(text, isError) {
  if (!adminParts.status) return;
  adminParts.status.textContent = text;
  adminParts.status.classList.toggle("admin-status--error", Boolean(isError));
}

// Runs an admin action; shows errors in the status line, and returns to login if the session ended
async function runAdminAction(action) {
  try {
    await action();
  } catch (error) {
    if (error.unauthorized) {
      showAdminLogin("Your session expired. Please log in again.");
    } else {
      setAdminStatus(error.message, true);
    }
  }
}

function logoutAdmin() {
  adminSession.clear();
  showAdminLogin("");
}

async function loadAdminData() {
  const results = await Promise.all([
    adminRequest("/api/admin/users"),
    adminRequest("/api/admin/votes" + (adminState.showRemoved ? "?include_deleted=true" : "")),
    adminRequest("/api/admin/winners"),
    apiRequest("/api/site/images") // public: which images are set + the upload limit
  ]);
  adminState.users = results[0].data;
  adminState.choices = results[1].data;
  adminState.winners = results[2].data;
  adminState.images = results[3].data.images;
  adminState.maxUploadBytes = results[3].data.max_upload_bytes;
}

async function refreshAdmin() {
  await loadAdminData();
  showChoicesSection();
  showWinnersSection();
  showUsersSection();
  showImagesSection();
}

function showAdminTab(id) {
  adminState.tab = id;
  adminParts.tabButtons.forEach(function (button) {
    const active = button.dataset.tab === id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  ADMIN_TABS.forEach(function (tab) {
    adminParts[tab.id].hidden = tab.id !== id;
  });
  setAdminStatus("", false);
}

function showAdminDashboard() {
  const root = document.getElementById("admin-root");
  root.replaceChildren();

  const page = createEl("div", "admin");

  const bar = createEl("header", "admin__bar");
  bar.appendChild(createEl("h1", "admin__brand", "Cinemax Admin"));
  const right = createEl("div", "admin__bar-right");
  const saved = adminSession.load();
  right.appendChild(createEl("span", "admin__user", saved ? saved.user.username : ""));
  const siteLink = createEl("a", "admin-btn admin-btn--ghost", "View site");
  siteLink.href = "index.html";
  right.appendChild(siteLink);
  right.appendChild(createButton("Log out", "admin-btn admin-btn--ghost", logoutAdmin));
  bar.appendChild(right);
  page.appendChild(bar);

  // Tabs
  const tabs = createEl("div", "admin-tabs");
  tabs.setAttribute("role", "tablist");
  adminParts.tabButtons = ADMIN_TABS.map(function (tab) {
    const button = createButton(tab.label, "admin-tab", function () { showAdminTab(tab.id); });
    button.dataset.tab = tab.id;
    button.setAttribute("role", "tab");
    tabs.appendChild(button);
    return button;
  });
  page.appendChild(tabs);

  adminParts.status = createEl("p", "admin-status");
  adminParts.status.setAttribute("role", "status");
  page.appendChild(adminParts.status);

  ADMIN_TABS.forEach(function (tab) {
    adminParts[tab.id] = createEl("section", "admin-card");
    page.appendChild(adminParts[tab.id]);
  });
  showAdminTab(adminState.tab);

  root.appendChild(page);

  runAdminAction(refreshAdmin);
}

// Start
if (adminSession.load()) {
  showAdminDashboard();
} else {
  showAdminLogin("");
}
