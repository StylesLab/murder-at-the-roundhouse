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
    if (eater && eater.health > 0) {
      if (state.current.poisonType === "slow" || state.current.event.delayedPoison) {
        state.delayedPoison = { playerId: eater.id, mealOwnerId: poisonedOwner };
      } else {
        const blockedAntidote = state.current.poisonType === "blocker";
        const protectedByDoctor = !blockedAntidote && state.current.protectionTarget === eater.id;
        if (!protectedByDoctor) eater.health = Math.max(0, eater.health - 1);
        state.current.results.push({
          playerId: eater.id,
          protected: protectedByDoctor,
          blockedAntidote,
          healthAfter: eater.health,
          mealOwnerId: poisonedOwner,
          poisonType: state.current.poisonType
        });
      }
    }
  }
  state.current.healthAfter = Object.fromEntries(state.players.map(player => [player.id, player.health]));
  state.courses.push(JSON.parse(JSON.stringify(state.current)));
  state.immediatePoisonerWin = state.players.filter(player => player.role !== "Poisoner" && player.health === 0).length >= 2;
  renderCourseDiscussion();
}

function publicResult(course) {
  if (course.results.length === 0) {
    if (course.poisonedMealOwnerId !== null && (course.poisonType === "slow" || course.event?.delayedPoison)) {
      return `Nobody became ill during the ${course.name.toLowerCase()}, but the effects may not yet have appeared.`;
    }
    return `Nobody became ill during the ${course.name.toLowerCase()}.`;
  }
  const result = course.results[0];
  const player = playerById(result.playerId);
  if (result.delayed) return `${player.name} suddenly suffered the delayed effects of poison and now has ${result.healthAfter} health remaining.`;
  if (result.protected) return `${player.name} suddenly felt faint but recovered. The doctor’s intervention appears to have saved someone.`;
  if (result.blockedAntidote) return `${player.name} became ill despite the Doctor's intervention. The antidote appears to have been neutralised.`;
  if (result.healthAfter === 0) return `${player.name} is now bedridden. They will take no further meal actions, but may still discuss and vote.`;
  return `${player.name} was taken seriously ill and now has ${result.healthAfter} health remaining.`;
}

function evidenceFor(course) {
  const courseName = course.name.toLowerCase();
  if (course.poisonedMealOwnerId === null) return `No physical trace of poison was found in the ${courseName}.`;
  if (course.poisonType === "slow" || course.event?.delayedPoison) return `A subtle residue was found, but its effect may have been delayed.`;
  if (course.results.length === 0) return `A bitter residue was discovered on an uneaten portion of ${courseName}.`;
  if (course.swapHistory.length > 1) return `Several servings of ${courseName} appeared to have been disturbed during service.`;
  if (course.swapHistory.length === 1) return `One serving of ${courseName} appeared to have been disturbed.`;
  return `A faint almond scent lingered over one serving of ${courseName}.`;
}

function renderCourseDiscussion() {
  state.phase = "discussion";
  const root = document.createDocumentFragment();
  root.append(titleBlock(`Course ${state.courseIndex + 1}`, `${state.current.name}: reckoning and discussion`,
    "Review what happened, then share claims and challenge alibis. Bedridden players remain part of the discussion."));
  const result = el("div", "result");
  result.append(el("p", "", publicResult(state.current)), el("p", "", evidenceFor(state.current)));
  const eventReminder = el("p", "status", `${state.current.event.name}: ${state.current.event.text}`);
  const portraits = el("div", "mini-portraits");
  state.players.forEach(player => portraits.append(safeImage(player.image, player.name)));
  const prompts = el("ul", "prompts");
  const promptText = ["Were you offered a chance to swap?", `Did you exchange ${currentCourseLower()}, and with whom?`, `Whose ${currentCourseLower()} do you believe you finally ate?`, "Why might the Doctor have protected that person?"];
  if (state.current.event.revealSwapClaims) promptText.unshift("Police Visit: every player must publicly state whether they attempted a swap.");
  promptText.forEach(prompt => prompts.append(el("li", "", prompt)));
  root.append(eventReminder, result, renderHealthBoard(), portraits, prompts, actions(button(
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
      el("span", "health-pips", player.health === 0 ? "Bedridden" : "♥".repeat(player.health)));
    board.append(item);
  });
  return board;
}
