"use strict";

function beginAccusations() {
  state.phase = "accusation";
  state.voteOrder = shuffle(state.players.map(p => p.id));
  state.voteIndex = 0;
  state.votes = {};
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
    state.votes[player.id] = state.pending.vote;
    state.pending = {};
    state.voteIndex += 1;
    beginVoteTurn();
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

function ownerAtSeat(course, playerId) {
  return playerById(course.mealOwners[playerId]);
}

function renderMealMap(map, courseName = currentCourseLower()) {
  return state.players.map(seat => `${seat.name} had ${playerById(map[seat.id]).name}'s ${courseName}`).join("; ");
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
  const head = document.createElement("thead");
  const hr = document.createElement("tr");
  ["Voter", "Accused"].forEach(text => hr.append(el("th", "", text)));
  head.append(hr);
  voteTable.append(head);
  const body = document.createElement("tbody");
  Object.entries(state.votes).forEach(([voter, accused]) => {
    const row = document.createElement("tr");
    row.append(el("td", "", playerById(voter).name), el("td", "", playerById(accused).name));
    body.append(row);
  });
  voteTable.append(body);
  if (!state.immediatePoisonerWin) root.append(voteTable);
  root.append(el("h2", "", "The dinner, reconstructed"));
  const timeline = el("section", "timeline");
  state.courses.forEach((course, index) => {
    const article = document.createElement("article");
    const courseName = course.name.toLowerCase();
    const poisonText = course.poisonedMealOwnerId === null
      ? `No ${courseName} was poisoned.`
      : `${playerById(course.poisonedMealOwnerId).name}'s ${courseName} was poisoned.`;
    const protectionText = course.protectionTarget
      ? `Doctor protected ${playerById(course.protectionTarget).name}.`
      : "The Doctor protected nobody.";
    article.append(el("h3", "", `${index + 1}. ${course.name}`),
      el("p", "", `${poisonText} ${protectionText}`),
      el("p", "", `Starting places: ${renderMealMap(course.originalMealOwners, courseName)}.`));
    const decisions = el("ol", "");
    course.swapDecisions.forEach(decision => {
      const actor = playerById(decision.playerId);
      let text;
      if (!decision.offered) text = `${actor.name} was not offered a swap.`;
      else if (decision.targetId === null) text = `${actor.name} was offered a swap but kept their ${courseName}.`;
      else text = `${actor.name} swapped ${courseName} immediately with ${playerById(decision.targetId).name}. Afterward: ${renderMealMap(decision.after, courseName)}.`;
      decisions.append(el("li", "", text));
    });
    article.append(el("h4", "", "Swap sequence"), decisions,
      el("p", "", `Final places: ${renderMealMap(course.mealOwners, courseName)}.`));
    const list = el("ul", "");
    state.players.forEach(p => {
      const incident = course.results.find(r => r.playerId === p.id);
      const outcome = incident ? (incident.protected ? `ate the poisoned ${courseName}, but was protected` : `ate the poisoned ${courseName} and was unprotected`) : `did not eat the poisoned ${courseName}`;
      const mealOwner = ownerAtSeat(course, p.id);
      list.append(el("li", "", `${p.name} ate ${mealOwner.name}'s ${courseName}; ${outcome}; ${course.healthAfter[p.id]} health remaining.`));
    });
    article.append(list, el("p", "", `Public report: ${publicResult(course)} ${evidenceFor(course)}`));
    timeline.append(article);
  });
  root.append(timeline, actions(
    button("Play again — same characters", () => restartWith(state.selectedIds)),
    button("Return to character selection", () => confirmReset("Return to character selection?", () => { state = freshState(state.selectedIds); renderSelection(); }), "secondary"),
    button("Full reset", () => confirmReset("Clear everything and start over?", () => { state = freshState(); renderSelection(); }), "danger")
  ));
  setScreen(root);
}
