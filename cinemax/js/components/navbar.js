// Navbar behaviour: open / close the menu.

function initNavbar() {
  const button = document.getElementById("menu-btn");
  const menu = document.getElementById("menu");

  if (!button || !menu) return;

  function openMenu() {
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "Close menu");
  }

  function closeMenu() {
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open menu");
  }

  function toggleMenu() {
    const isOpen = button.getAttribute("aria-expanded") === "true";
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  button.addEventListener("click", toggleMenu);

  // Close when a link is clicked
  menu.addEventListener("click", function (event) {
    if (event.target.closest(".menu__link")) closeMenu();
  });

  // Close with the Escape key
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });
}
