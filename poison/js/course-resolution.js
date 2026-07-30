"use strict";

function recordSwapDecision(player, targetId, offered) {
  const decision = { sequence: state.current.swapDecisions.length + 1, playerId: player.id, offered, targetId, before: { ...state.current.mealOwners } };
  if (offered && targetId !== null) {
    [state.current.mealOwners[player.id], state.current.mealOwners[targetId]] =
      [state.current.mealOwners[targetId], state.current.mealOwners[player.id]];
  }
  decision.after = { ...state.current.mealOwners };
  state.current.swapDecisions.push(decision);
  if (offered && targetId !== null) state.current.swapHistory.push(decision);
}

function applySwapsAndResolve() {
  state.current.swapOrder.forEach(playerId => {
    const player = playerById(playerId);
    const choice = state.current.swapChoices[playerId] ?? { offered: false, targetId: null };
    recordSwapDecision(player, choice.targetId, choice.offered);
  });
  resolveCourse();
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
  renderCourseDiscussion();
}

function publicResult(course) {
  if (course.results.length === 0) return `Nobody became ill during the ${course.name.toLowerCase()}.`;
  const result = course.results[0];
  const player = playerById(result.playerId);
  return result.protected
    ? `${player.name} suddenly felt faint but recovered. The doctor’s intervention appears to have saved someone.`
    : `${player.name} was taken seriously ill and now has ${result.healthAfter} health remaining.`;
}

function evidenceFor(course) {
  const courseName = course.name.toLowerCase();
  if (course.poisonedMealOwnerId === null) return `No physical trace of poison was found in the ${courseName}.`;
  if (course.results.length === 0) return `A bitter residue was discovered on an uneaten portion of ${courseName}.`;
  if (course.swapHistory.length > 1) return `Several servings of ${courseName} appeared to have been disturbed during service.`;
  if (course.swapHistory.length === 1) return `One serving of ${courseName} appeared to have been disturbed.`;
  return `A faint almond scent lingered over one serving of ${courseName}.`;
}

function renderCourseDiscussion() {
  state.phase = "discussion";
  const root = document.createDocumentFragment();
  root.append(titleBlock(`Course ${state.courseIndex + 1}`, `${state.current.name}: reckoning and discussion`,
    "Review what happened, then share claims and challenge alibis."));
  const result = el("div", "result");
  result.append(el("p", "", publicResult(state.current)), el("p", "", evidenceFor(state.current)));
  const portraits = el("div", "mini-portraits");
  state.players.forEach(player => portraits.append(safeImage(player.image, player.name)));
  const prompts = el("ul", "prompts");
  ["Were you offered a chance to swap?", `Did you exchange ${currentCourseLower()}, and with whom?`, `Whose ${currentCourseLower()} do you believe you finally ate?`, "Why might the Doctor have protected that person?"].forEach(prompt => prompts.append(el("li", "", prompt)));
  root.append(result, renderHealthBoard(), portraits, prompts, actions(button(
    state.immediatePoisonerWin ? "Reveal the Poisoner’s victory" : state.courseIndex === COURSE_NAMES.length - 1 ? "Begin accusations" : "Start the next course",
    state.immediatePoisonerWin ? renderFinalReveal : () => { state.courseIndex += 1; beginCourse(); }
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
