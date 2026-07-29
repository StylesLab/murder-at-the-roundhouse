function beginSwapRound() {
  state.phase = "swapping";
  state.actionQueue = shuffle(state.players.map(player => player.id));
  state.current.swapOrder = [...state.actionQueue];
  state.actionIndex = 0;
  beginSwapTurn();
}
function beginSwapTurn() {
  if (state.actionIndex >= state.actionQueue.length) { resolveCourse(); return; }
  const player = playerById(state.actionQueue[state.actionIndex]);
  if (state.current.swapEligibility[player.id] === undefined) {
    state.current.swapEligibility[player.id] = Math.random() < SWAP_CHANCE;
  }
  showPassScreen(player, `${state.current.name}: meal service`, () => renderSwapAction(player));
}
function renderSwapAction(player) {
  if (!state.current.swapEligibility[player.id]) {
    const root = document.createDocumentFragment();
    root.append(titleBlock(player.name, "Your meal remains in place",
      "You did not receive a swap opportunity this course. You may still claim otherwise during discussion."),
      actions(button("Hide this report", () => finishSwapTurn(player, null, false))));
    setScreen(root);
    return;
  }
  const root = document.createDocumentFragment();
  root.append(titleBlock(player.name, "You may secretly swap meals",
    "Choose another guest to exchange meals with now, or decline. The exchange is applied immediately before the next player's turn."));
  const grid = el("div", "choices people");
  state.players.filter(person => person.id !== player.id).forEach(person => {
    const choice = button("", () => selectSwapOption(grid, person.id), "person-choice");
    choice.dataset.id = person.id; choice.setAttribute("aria-pressed", "false");
    choice.append(safeImage(person.image, person.name), el("span", "", `Swap with ${person.name}`)); grid.append(choice);
  });
  const decline = button("Keep my current meal", () => selectSwapOption(grid, null), "choice");
  decline.dataset.id = "none"; decline.setAttribute("aria-pressed", "false"); grid.append(decline);
  root.append(grid, actions(button("Seal my choice", () => {
    if (state.pending.swap === undefined) { showMessage("Choose a swap target, or keep your meal."); return; }
    finishSwapTurn(player, state.pending.swap, true);
  })));
  setScreen(root);
}
function selectSwapOption(grid, targetId) {
  state.pending.swap = targetId;
  grid.querySelectorAll("button").forEach(choice => {
    const selected = targetId === null ? choice.dataset.id === "none" : choice.dataset.id === targetId;
    choice.classList.toggle("selected", selected);
    choice.setAttribute("aria-pressed", String(selected));
  });
}
function finishSwapTurn(player, targetId, offered) {
  const decision = {
    sequence: state.current.swapDecisions.length + 1,
    playerId: player.id,
    offered,
    targetId,
    before: { ...state.current.mealOwners }
  };
  if (offered && targetId !== null) {
    [state.current.mealOwners[player.id], state.current.mealOwners[targetId]] =
      [state.current.mealOwners[targetId], state.current.mealOwners[player.id]];
  }
  decision.after = { ...state.current.mealOwners };
  state.current.swapDecisions.push(decision);
  if (offered && targetId !== null) state.current.swapHistory.push(decision);
  state.pending = {};
  state.actionIndex += 1;
  beginSwapTurn();
}

function resolveCourse() {
  const poisonedOwner = state.current.poisonedMealOwnerId;
  if (poisonedOwner !== null) {
    const eater = state.players.find(player => state.current.mealOwners[player.id] === poisonedOwner);
    if (eater) {
      const protectedByDoctor = state.current.protectionTarget === eater.id;
      if (!protectedByDoctor) eater.health = Math.max(0, eater.health - 1);
      state.current.results.push({ playerId: eater.id, protected: protectedByDoctor, healthAfter: eater.health, mealOwnerId: poisonedOwner });
    }
  }
  state.current.healthAfter = Object.fromEntries(state.players.map(player => [player.id, player.health]));
  state.courses.push(JSON.parse(JSON.stringify(state.current)));
  state.immediatePoisonerWin = state.players.filter(player => player.role !== "Poisoner" && player.health === 0).length >= 2;
  state.actionQueue = shuffle(state.players.map(player => player.id));
  state.actionIndex = 0;
  beginPrivateReportTurn();
}
function beginPrivateReportTurn() {
  if (state.actionIndex >= state.actionQueue.length) { renderResolution(); return; }
  const player = playerById(state.actionQueue[state.actionIndex]);
  showPassScreen(player, `${state.current.name}: private report`, () => renderPrivateReport(player));
}
function renderPrivateReport(player) {
  const ownDecision = state.current.swapDecisions.find(decision => decision.playerId === player.id);
  const switchMessage = ownDecision && ownDecision.offered
    ? ownDecision.targetId === null
      ? " You were offered a swap but kept your meal."
      : ` Your swap with ${playerById(ownDecision.targetId).name} was carried out immediately.`
    : " You were not offered a swap.";
  if (player.role !== "Doctor") {
    const root = document.createDocumentFragment();
    root.append(titleBlock(player.name, "Your private report",
      `You have ${player.health} health remaining.${switchMessage} Keep your role and meal history secret unless you choose to make a claim.`),
      actions(button("Hide this report", finishPrivateReport)));
    setScreen(root);
    return;
  }
  const protectedIncident = state.current.results.find(result => result.playerId === state.current.protectionTarget && result.protected);
  const protectedPlayer = playerById(state.current.protectionTarget);
  const root = document.createDocumentFragment();
  root.append(titleBlock(player.name, protectedIncident ? "Your intervention succeeded" : "No antidote was needed",
    protectedIncident
      ? `You prevented ${protectedPlayer.name} from losing health this course.${switchMessage} Keep that knowledge secret.`
      : `${protectedPlayer.name} did not eat the poisoned meal—or no poison was used.${switchMessage} Keep that knowledge secret.`),
    actions(button("Hide this report", finishPrivateReport)));
  setScreen(root);
}
function finishPrivateReport() { state.actionIndex += 1; beginPrivateReportTurn(); }
function publicResult(course) {
  if (course.results.length === 0) return "Nobody became ill during this course.";
  const result = course.results[0];
  const player = playerById(result.playerId);
  return result.protected
    ? `${player.name} suddenly felt faint but recovered. The doctor’s intervention appears to have saved someone.`
    : `${player.name} was taken seriously ill and now has ${result.healthAfter} health remaining.`;
}
function evidenceFor(course) {
  if (course.poisonedMealOwnerId === null) return "No physical trace of poison was found.";
  if (course.results.length === 0) return "A bitter residue was discovered on an uneaten portion of the course.";
  if (course.swapHistory.length > 1) return "Several place settings appeared to have been disturbed during service.";
  if (course.swapHistory.length === 1) return "One place setting appeared to have been disturbed.";
  return "A faint almond scent lingered over one plate.";
}
function renderResolution() {
  state.phase = "resolution";
  const root = document.createDocumentFragment();
  root.append(titleBlock(`Course ${state.courseIndex + 1}`, `${state.current.name}: the reckoning`, ""));
  const result = el("div", "result");
  result.append(el("p", "", publicResult(state.current)), el("p", "", evidenceFor(state.current)));
  root.append(result, renderHealthBoard(), actions(button(
    state.immediatePoisonerWin ? "Reveal the Poisoner’s victory" : "Open the drawing room for discussion",
    state.immediatePoisonerWin ? renderFinalReveal : renderDiscussion
  )));
  setScreen(root);
}
function renderHealthBoard() {
  const board = el("section", "health-board");
  board.setAttribute("aria-label", "Guest health");
  state.players.forEach(player => {
    const item = el("div", `health-card${player.health === 0 ? " critically-ill" : ""}`);
    item.append(safeImage(player.image, player.name), el("strong", "", player.name),
      el("span", "health-pips", player.health === 0 ? "Critically ill" : "♥".repeat(player.health)));
    board.append(item);
  });
  return board;
}
function renderDiscussion() {
  state.phase = "discussion";
  const root = document.createDocumentFragment();
  root.append(titleBlock(state.current.name, "Discussion", "Share claims and challenge alibis. Start the next course whenever the table is ready."));
  const portraits = el("div", "mini-portraits");
  state.players.forEach(p => portraits.append(safeImage(p.image, p.name)));
  const prompts = el("ul", "prompts");
  ["Were you offered a chance to swap?", "Did you exchange meals, and with whom?", "Whose meal do you believe you finally ate?", "Why might the Doctor have protected that person?"].forEach(p => prompts.append(el("li", "", p)));
  root.append(portraits, el("div", "result", publicResult(state.current)), actions(
    button(state.courseIndex === COURSE_NAMES.length - 1 ? "Begin accusations" : "Start the next course", () => {
      state.courseIndex += 1; beginCourse();
    })
  ), prompts);
  setScreen(root);
}
