// Admin section: declared winners. Exactly one can be "current" (shown on the home page).

function setCurrentWinner(winner) {
  runAdminAction(async function () {
    await adminRequest("/api/admin/winners/" + winner.id + "/current", { method: "PATCH" });
    setAdminStatus('"' + winner.title_name + '" is now the current screening.', false);
    await refreshAdmin();
  });
}

function clearCurrentWinner() {
  if (!confirm("Turn off the current screening? Voting opens again and the home page will show \"coming soon\".")) return;
  runAdminAction(async function () {
    await adminRequest("/api/admin/winners/current", { method: "DELETE" });
    setAdminStatus("No screening is current now.", false);
    await refreshAdmin();
  });
}

function showWinnersSection() {
  const box = adminParts.winners;
  box.replaceChildren();

  const head = createEl("div", "admin-card__head");
  head.appendChild(createEl("h2", "admin-card__title", "Screening winners"));
  const hasCurrent = adminState.winners.some(function (winner) { return winner.is_current; });
  if (hasCurrent) {
    head.appendChild(createButton("Turn off current", "admin-btn admin-btn--small", clearCurrentWinner));
  }
  box.appendChild(head);
  box.appendChild(
    createEl(
      "p",
      "admin-muted",
      hasCurrent
        ? "Only one winner can be current. Turn it off before declaring or choosing the next winner. To let people vote again while it stays, use \"Open voting\" in the Movies tab."
        : "The poll is open. Declaring a winner closes voting."
    )
  );

  if (adminState.winners.length === 0) {
    box.appendChild(createEl("p", "admin-muted", "No winners yet. Use \"Declare winner\" on a poll entry."));
    return;
  }

  const list = createEl("ul", "admin-winners");
  adminState.winners.forEach(function (winner) {
    const item = createEl("li", "admin-winner" + (winner.is_current ? " is-current" : ""));

    const info = createEl("div", "admin-winner__info");
    info.appendChild(createEl("strong", "", winner.title_name + " (" + winner.release_year + ")"));
    info.appendChild(
      createEl("span", "admin-muted", formatRuntime(winner.runtime) + " · recommended by " + recommenderName(winner))
    );
    item.appendChild(info);

    if (winner.is_current) {
      item.appendChild(createEl("span", "admin-tag admin-tag--current", "Current"));
    } else {
      const makeCurrent = createButton("Make current", "admin-btn admin-btn--small", function () {
        setCurrentWinner(winner);
      });
      if (hasCurrent) {
        makeCurrent.disabled = true; // only one winner at a time
        makeCurrent.title = "Turn off the current winner first";
      }
      item.appendChild(makeCurrent);
    }
    list.appendChild(item);
  });
  box.appendChild(list);
}
