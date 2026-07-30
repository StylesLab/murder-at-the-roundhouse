"use strict";

function restartWith(ids) { state = freshState(ids); startGame(); }

function confirmReset(promptText, callback) {
  if (state.phase === "selection") { callback(); return; }
  const root = document.createDocumentFragment();
  root.append(titleBlock("Abandon the current dinner?", promptText, "This action cannot be undone."),
    actions(button("Keep playing", renderCurrentPhase, "secondary"), button("Confirm", callback, "danger")));
  setScreen(root);
}

function renderCurrentPhase() {
  if (state.phase === "final") renderFinalReveal();
  else if (state.phase === "discussion") renderCourseDiscussion();
  else if (state.phase === "course-intro") beginCourse();
  else renderSelection();
}

function renderDebug() {
  if (!debugMode) { debugRoot.hidden = true; return; }
  debugRoot.hidden = false;
  const details = document.createElement("details");
  details.open = true;
  details.append(el("summary", "", "Debug mode"));
  const skip = button(debugRoot.dataset.skip === "true" ? "Pass screens: skipped" : "Pass screens: shown", () => {
    debugRoot.dataset.skip = debugRoot.dataset.skip === "true" ? "false" : "true";
    renderDebug();
  });
  const next = button("Jump / auto-fill phase", debugAdvance);
  const restart = button("Restart course", () => {
    if (!state.current || state.phase === "selection" || state.phase === "roles") {
      showMessage("No active course to restart.");
      return;
    }
    state.courses = state.courses.slice(0, state.courseIndex);
    beginCourse();
  });
  const roles = el("p", "", state.players.length ? state.players.map(p => `${p.name}: ${p.role}`).join(" | ") : "Roles not assigned");
  const fixedRoles = el("div", "");
  if (state.players.length) {
    fixedRoles.append(el("label", "", "Fixed Poisoner "));
    fixedRoles.append(debugRoleSelect("Poisoner"));
    fixedRoles.append(el("label", "", " Fixed Doctor "));
    fixedRoles.append(debugRoleSelect("Doctor"));
  }
  const pre = el("pre", "", JSON.stringify({ phase: state.phase, course: state.courseIndex + 1, current: state.current, votes: state.votes }, null, 2));
  details.append(skip, next, restart, roles, fixedRoles, pre);
  debugRoot.replaceChildren(details);
}

function debugRoleSelect(role) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", `Fixed ${role}`);
  state.players.forEach(player => {
    const option = document.createElement("option");
    option.value = player.id;
    option.textContent = player.name;
    option.selected = player.role === role;
    select.append(option);
  });
  select.addEventListener("change", () => {
    const chosen = playerById(select.value);
    const otherSpecial = state.players.find(player => player.role !== role && (player.role === "Poisoner" || player.role === "Doctor"));
    state.players.forEach(player => { player.role = "Guest"; });
    chosen.role = role;
    if (otherSpecial && otherSpecial.id !== chosen.id) otherSpecial.role = role === "Poisoner" ? "Doctor" : "Poisoner";
    else state.players.find(player => player.id !== chosen.id).role = role === "Poisoner" ? "Doctor" : "Poisoner";
    renderDebug();
  });
  return select;
}

function debugAdvance() {
  if (state.phase === "selection") {
    if (state.selectedIds.length < 4) state.selectedIds = window.ROUNDHOUSE_CHARACTERS.slice(0, 4).map(c => c.id);
    startGame();
    return;
  }
  if (state.phase === "roles") { state.roleRevealIndex = 3; revealRole(); return; }
  if (state.phase === "course-intro") { beginCourseActionRound(); return; }
  if (state.phase === "discussion") { state.courseIndex += 1; beginCourse(); return; }
  if (state.phase === "accusation") {
    const poisoner = state.players.find(p => p.role === "Poisoner");
    state.players.forEach(p => { state.votes[p.id] = poisoner.id; });
    renderFinalReveal();
    return;
  }
  showMessage("Use the visible choice controls for this secret phase.");
}

window.addEventListener("beforeunload", event => {
  if (!["selection", "final"].includes(state.phase)) {
    event.preventDefault();
    event.returnValue = "";
  }
});

window.addEventListener("keydown", event => {
  if (event.key === "Escape" && !["selection", "final"].includes(state.phase)) {
    confirmReset("Restart this game?", () => { state = freshState(state.selectedIds); startGame(); });
  }
});
