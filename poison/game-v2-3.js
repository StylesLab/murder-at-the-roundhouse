function beginAccusations() {
  state.phase = "accusation"; state.voteOrder = shuffle(state.players.map(p => p.id)); state.voteIndex = 0; state.votes = {};
  beginVoteTurn();
}
function beginVoteTurn() {
  if (state.voteIndex >= PLAYER_COUNT) { renderFinalReveal(); return; }
  const player = playerById(state.voteOrder[state.voteIndex]);
  showPassScreen(player, `Accusation ${state.voteIndex + 1} of ${PLAYER_COUNT}`, () => renderVote(player));
}
function renderVote(player) {
  const root = document.createDocumentFragment();
  root.append(titleBlock(player.name, "Name the Poisoner", "Your accusation is secret. You cannot accuse yourself."));
  root.append(personChoices("vote", !debugMode), actions(button("Seal my accusation", () => {
    if (!state.pending.vote) { showMessage("Choose a suspect before voting."); return; }
    state.votes[player.id] = state.pending.vote; state.pending = {}; state.voteIndex += 1; beginVoteTurn();
  })));
  setScreen(root);
}
function calculateScore() {
  const poisoner = state.players.find(p => p.role === "Poisoner");
  const incidents = state.courses.reduce((sum, c) => sum + c.results.length, 0);
  const unprotected = state.courses.reduce((sum, c) => sum + c.results.filter(r => !r.protected).length, 0);
  const misdirected = Object.values(state.votes).filter(id => id !== poisoner.id).length;
  const bluffs = state.courses.filter(c => c.poisonedMealOwnerId === null && c.results.length === 0).length;
  return { incidents, unprotected, misdirected, bluffs, total: incidents * 2 + unprotected * 3 + misdirected * 2 + bluffs };
}
function ownerAtSeat(course, playerId) { return playerById(course.mealOwners[playerId]); }
function renderMealMap(map) {
  return state.players.map(seat => `${seat.name} had ${playerById(map[seat.id]).name}'s meal`).join("; ");
}
function renderFinalReveal() {
  state.phase = "final";
  const poisoner = state.players.find(p => p.role === "Poisoner");
  const doctor = state.players.find(p => p.role === "Doctor");
  const votesForPoisoner = Object.values(state.votes).filter(id => id === poisoner.id).length;
  const qualifiedPoisoner = poisonerHasQualified();
  const investigatorsWin = !state.immediatePoisonerWin && (votesForPoisoner >= 3 || !qualifiedPoisoner);
  const score = calculateScore();
  const root = document.createDocumentFragment();
  let endingExplanation;
  if (state.immediatePoisonerWin) endingExplanation = "Two non-Poisoners became critically ill before the final accusation. The Poisoner wins immediately.";
  else if (!qualifiedPoisoner) endingExplanation = "The Poisoner caused no unprotected health loss during dinner, so the guests win automatically.";
  else endingExplanation = `${poisoner.name} received ${votesForPoisoner} accusation vote${votesForPoisoner === 1 ? "" : "s"}. Three were needed to expose the Poisoner.`;
  root.append(titleBlock("The masks fall", investigatorsWin ? "The guests prevail" : state.immediatePoisonerWin ? "The Poisoner triumphs" : "The Poisoner escapes", endingExplanation));
  const result = el("div", "result");
  result.append(el("h2", "", `${poisoner.name} was the Poisoner`), el("p", "", `${doctor.name} was the Doctor.`),
    el("p", "", `Poisoner performance: ${score.total} points — ${score.incidents} poisoning incident(s), ${score.unprotected} unprotected, ${score.misdirected} misdirected accusation(s), ${score.bluffs} no-poison bluff(s).`));
  root.append(result);
  const voteTable = document.createElement("table");
  const head = document.createElement("thead"); const hr = document.createElement("tr");
  ["Voter", "Accused"].forEach(text => hr.append(el("th", "", text))); head.append(hr); voteTable.append(head);
  const body = document.createElement("tbody");
  Object.entries(state.votes).forEach(([voter, accused]) => { const row = document.createElement("tr"); row.append(el("td", "", playerById(voter).name), el("td", "", playerById(accused).name)); body.append(row); });
  voteTable.append(body);
  if (!state.immediatePoisonerWin) root.append(voteTable);
  root.append(el("h2", "", "The dinner, reconstructed"));
  const timeline = el("section", "timeline");
  state.courses.forEach((course, index) => {
    const article = document.createElement("article");
    const poisonText = course.poisonedMealOwnerId === null
      ? "No meal was poisoned."
      : `${playerById(course.poisonedMealOwnerId).name}'s original meal was poisoned.`;
    article.append(el("h3", "", `${index + 1}. ${course.name}`),
      el("p", "", `${poisonText} Doctor protected ${playerById(course.protectionTarget).name}.`),
      el("p", "", `Starting places: ${renderMealMap(course.originalMealOwners)}.`));
    const decisions = el("ol", "");
    course.swapDecisions.forEach(decision => {
      const actor = playerById(decision.playerId);
      let text;
      if (!decision.offered) text = `${actor.name} was not offered a swap.`;
      else if (decision.targetId === null) text = `${actor.name} was offered a swap but kept their current meal.`;
      else text = `${actor.name} swapped immediately with ${playerById(decision.targetId).name}. Afterward: ${renderMealMap(decision.after)}.`;
      decisions.append(el("li", "", text));
    });
    article.append(el("h4", "", "Swap sequence"), decisions,
      el("p", "", `Final places: ${renderMealMap(course.mealOwners)}.`));
    const list = el("ul", "");
    state.players.forEach(p => {
      const incident = course.results.find(r => r.playerId === p.id);
      const outcome = incident ? (incident.protected ? "ate the poisoned meal, but was protected" : "ate the poisoned meal and was unprotected") : "did not eat the poisoned meal";
      const mealOwner = ownerAtSeat(course, p.id);
      list.append(el("li", "", `${p.name} ate ${mealOwner.name}'s original meal; ${outcome}; ${course.healthAfter[p.id]} health remaining.`));
    });
    article.append(list, el("p", "", `Public report: ${publicResult(course)} ${evidenceFor(course)}`)); timeline.append(article);
  });
  root.append(timeline, actions(
    button("Play again — same characters", () => restartWith(state.selectedIds)),
    button("Return to character selection", () => confirmReset("Return to character selection?", () => { state = freshState(state.selectedIds); renderSelection(); }), "secondary"),
    button("Full reset", () => confirmReset("Clear everything and start over?", () => { state = freshState(); renderSelection(); }), "danger")
  ));
  setScreen(root);
}
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
  else if (state.phase === "discussion") renderDiscussion();
  else if (state.phase === "resolution") renderResolution();
  else if (state.phase === "course-intro") beginCourse();
  else renderSelection();
}

function renderDebug() {
  if (!debugMode) { debugRoot.hidden = true; return; }
  debugRoot.hidden = false;
  const details = document.createElement("details"); details.open = true;
  details.append(el("summary", "", "Debug mode"));
  const skip = button(debugRoot.dataset.skip === "true" ? "Pass screens: skipped" : "Pass screens: shown", () => {
    debugRoot.dataset.skip = debugRoot.dataset.skip === "true" ? "false" : "true"; renderDebug();
  });
  const next = button("Jump / auto-fill phase", debugAdvance);
  const restart = button("Restart course", () => {
    if (!state.current || state.phase === "selection" || state.phase === "roles") { showMessage("No active course to restart."); return; }
    state.courses = state.courses.slice(0, state.courseIndex); beginCourse();
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
  details.append(skip, next, restart, roles, fixedRoles, pre); debugRoot.replaceChildren(details);
}
function debugRoleSelect(role) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", `Fixed ${role}`);
  state.players.forEach(player => {
    const option = document.createElement("option");
    option.value = player.id; option.textContent = player.name;
    option.selected = player.role === role; select.append(option);
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
  if (state.phase === "selection") { if (state.selectedIds.length < 4) state.selectedIds = window.ROUNDHOUSE_CHARACTERS.slice(0, 4).map(c => c.id); startGame(); return; }
  if (state.phase === "roles") { state.roleRevealIndex = 3; revealRole(); return; }
  if (state.phase === "course-intro") { beginPrivateActionRound(); return; }
  if (["resolution", "discussion"].includes(state.phase)) { state.courseIndex += 1; beginCourse(); return; }
  if (state.phase === "accusation") {
    const poisoner = state.players.find(p => p.role === "Poisoner");
    state.players.forEach(p => { state.votes[p.id] = poisoner.id; }); renderFinalReveal(); return;
  }
  showMessage("Use the visible choice controls for this secret phase.");
}

window.addEventListener("beforeunload", event => {
  if (!["selection", "final"].includes(state.phase)) { event.preventDefault(); event.returnValue = ""; }
});
window.addEventListener("keydown", event => {
  if (event.key === "Escape" && !["selection", "final"].includes(state.phase)) {
    confirmReset("Restart this game?", () => { state = freshState(state.selectedIds); startGame(); });
  }
});
renderSelection();
