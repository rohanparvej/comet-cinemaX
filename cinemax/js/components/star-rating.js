// Star rating with half stars (0.5 steps, 5 stars).
//
//   createStarRating({ value: 3.5 })
//       -> read only, just shows the stars
//
//   createStarRating({ value: 0, label: "Your rating", onChange: function (rating) { ... } })
//       -> clickable. Click the left half of a star for a half, the right half for a full star.
//          Clicking the same rating again clears it (rating 0).
//          Each half is a real button, so the keyboard (Tab + Enter) works too.
//
// The returned element also has .setValue(number) to change the stars from code.
// Styling is in css/components/star-rating.css

const STAR_COUNT = 5;

function createStarIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z");
  svg.appendChild(path);
  return svg;
}

function createStarRating(options) {
  const interactive = typeof options.onChange === "function";
  let value = options.value || 0;

  const root = createEl("div", "star-rating");
  if (interactive) root.classList.add("star-rating--interactive");
  root.setAttribute("role", interactive ? "group" : "img");

  const stars = [];
  const hits = [];

  // Fills the stars up to "amount" (a number from 0 to 5, halves allowed)
  function paint(amount) {
    stars.forEach(function (star, index) {
      const fill = Math.min(Math.max(amount - index, 0), 1);
      star.style.setProperty("--fill", fill);
    });
  }

  function describe() {
    const text = value > 0 ? value + " out of " + STAR_COUNT + " stars" : "Not rated";
    if (interactive) {
      root.setAttribute("aria-label", (options.label || "Rating") + ": " + text);
    } else {
      root.setAttribute("aria-label", text);
    }
    hits.forEach(function (hit) {
      hit.button.setAttribute("aria-pressed", hit.amount === value ? "true" : "false");
    });
  }

  function setValue(newValue) {
    value = newValue;
    paint(value);
    describe();
  }

  for (let i = 1; i <= STAR_COUNT; i++) {
    const star = createEl("span", "star-rating__star");
    star.appendChild(createEl("span", "star-rating__base")).appendChild(createStarIcon());
    star.appendChild(createEl("span", "star-rating__fill")).appendChild(createStarIcon());
    stars.push(star);

    if (interactive) {
      // Left half = i - 0.5, right half = i
      [i - 0.5, i].forEach(function (amount, side) {
        const half = side === 0 ? "left" : "right";
        const button = createButton("", "star-rating__hit star-rating__hit--" + half);
        button.setAttribute("aria-label", amount + (amount === 1 ? " star" : " stars"));

        button.addEventListener("mouseenter", function () { paint(amount); });
        button.addEventListener("mouseleave", function () { paint(value); });
        button.addEventListener("click", function () {
          setValue(amount === value ? 0 : amount);
          options.onChange(value);
        });

        star.appendChild(button);
        hits.push({ button: button, amount: amount });
      });
    }

    root.appendChild(star);
  }

  root.setValue = setValue;
  setValue(value);
  return root;
}