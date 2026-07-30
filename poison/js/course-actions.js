"use strict";

function beginCourse() {
  if (state.courseIndex >= COURSE_NAMES.length) { beginAccusations(); return; }
  state.phase = "course-intro";
  const mealOwners = Object.fromEntries(state.players.map(player => [player.id, player.id]));
  state.current = {
    name: COURSE_NAMES[state.courseIndex], poisonedMealOwnerId: null, protectionTarget: null,
    mealOwners, originalMealOwners: { ...mealOwners }, swapEligibility: {}, swapChoices: {},
    swapDecisions: [], swapHistory: [], results: []
  };
  const root = document.createDocumentFragment();
  root.append(titleBlock(`Course ${state.courseIndex + 1} of ${COURSE_NAMES.length}`, state.current.name,
    "Each player receives the device once in a random order. Role choices and swap choices are recorded privately, then all swaps are applied in that same pass order."));
  const courseImage = safeImage(COURSE_IMAGES[state.current.name], `${state.current.name} course`, "course-image");
  courseImage.alt = `${state.current.name} course illustration`;
  root.append(courseImage, actions(button("Begin private turns", beginCourseActionRound)));
  setScreen(root);
}

function beginCourseActionRound() {
  state.phase = "course-actions";
  state.actionQueue = shuffle(state.players.map(player => player.id));
  state.current.swapOrder = [...state.actionQueue];
  state.current.swapEligibility = Object.fromEntries(state.players.map(player => [player.id, Math.random() < SWAP_CHANCE]));
  state.actionIndex = 0;
  beginCourseActionTurn();
}

function beginCourseActionTurn() {
  if (state.actionIndex >= state.actionQueue.length) { applySwapsAndResolve(); return; }
  const player = playerById(state.actionQueue[state.actionIndex]);
  showPassScreen(player, `${state.current.name}: private turn`, () => renderCourseAction(player));
}

function renderCourseAction(player) {
  if (player.role === "Poisoner") { renderPoisonerAction(player); return; }
  if (player.role === "Doctor") { renderDoctorAction(player); return; }
  renderGuestAction(player);
}

function finishCourseAction() {
  state.pending = {};
  state.actionIndex += 1;
  beginCourseActionTurn();
}

function appendSwapChoice(root, player, afterChoice) {
  if (!state.current.swapEligibility[player.id]) {
    root.append(el("p", "status", `You were not offered a swap during the ${currentCourseLower()}.`),
      actions(button("Hide my screen and pass on", () => {
        state.current.swapChoices[player.id] = { offered: false, targetId: null };
        afterChoice();
      })));
    return;
  }
  root.append(el("h2", "", `Optional ${currentCourseLower()} swap`),
    el("p", "lede", `Choose another guest to exchange ${currentCourseLower()} with, or keep yours. The swap will be applied later in pass order.`));
  const grid = el("div", "choices people");
  state.players.filter(person => person.id !== player.id).forEach(person => {
    const choice = button("", () => selectSwapOption(grid, person.id), "person-choice");
    choice.dataset.id = person.id;
    choice.setAttribute("aria-pressed", "false");
    choice.append(safeImage(person.image, person.name), el("span", "", `Swap with ${person.name}`));
    grid.append(choice);
  });
  const decline = button(`Keep my ${currentCourseLower()}`, () => selectSwapOption(grid, null), "choice");
  decline.dataset.id = "none";
  decline.setAttribute("aria-pressed", "false");
  grid.append(decline);
  root.append(grid, actions(button("Seal my turn and pass on", () => {
    if (state.pending.swap === undefined) { showMessage(`Choose a swap target, or keep your ${currentCourseLower()}.`); return; }
    state.current.swapChoices[player.id] = { offered: true, targetId: state.pending.swap };
    afterChoice();
  })));
}

function renderPoisonerAction(player) {
  const root = document.createDocumentFragment();
  root.append(titleBlock(player.name, `Choose ${currentCourseLower()} to poison`, "Make your Poisoner choice, then complete any swap shown below before passing the device."));
  if (!poisonerHasQualified()) root.append(el("p", "status warning",
    "Victory requirement not yet met: you must cause at least one non-Poisoner to lose unprotected health before dinner ends."));
  const grid = el("div", "choices people");
  state.players.forEach(person => {
    const choice = button("", () => selectPoisonTarget(grid, person.id), "person-choice");
    choice.dataset.id = person.id;
    choice.setAttribute("aria-pressed", "false");
    choice.append(safeImage(person.image, person.name), el("span", "", `Poison ${person.name}'s ${currentCourseLower()}`));
    grid.append(choice);
  });
  const decline = button(`Use no poison in the ${currentCourseLower()}`, () => selectPoisonTarget(grid, null), "choice");
  decline.dataset.id = "none";
  decline.setAttribute("aria-pressed", "false");
  grid.append(decline);
  root.append(grid, actions(button("Continue to swap", () => {
    if (state.pending.poison === undefined) { showMessage("Choose a poison decision."); return; }
    state.current.poisonedMealOwnerId = state.pending.poison;
    state.pending = {};
    const next = document.createDocumentFragment();
    next.append(titleBlock(player.name, `${currentCourse()}: swap`, "Your poison choice is sealed."));
    appendSwapChoice(next, player, finishCourseAction);
    setScreen(next);
  })));
  setScreen(root);
}

function selectPoisonTarget(grid, targetId) {
  state.pending.poison = targetId;
  grid.querySelectorAll("button").forEach(choice => {
    const selected = targetId === null ? choice.dataset.id === "none" : choice.dataset.id === targetId;
    choice.classList.toggle("selected", selected);
    choice.setAttribute("aria-pressed", String(selected));
  });
}

function renderDoctorAction(player) {
  const root = document.createDocumentFragment();
  root.append(titleBlock(player.name, "Choose someone to protect", "Make your Doctor choice, then complete any swap shown below before passing the device."));
  root.append(personChoices("protection"), actions(button("Continue to swap", () => {
    if (!state.pending.protection) { showMessage("Choose a person to protect."); return; }
    state.current.protectionTarget = state.pending.protection;
    state.pending = {};
    const next = document.createDocumentFragment();
    next.append(titleBlock(player.name, `${currentCourse()}: swap`, "Your protection choice is sealed."));
    appendSwapChoice(next, player, finishCourseAction);
    setScreen(next);
  })));
  setScreen(root);
}

function renderGuestAction(player) {
  const root = document.createDocumentFragment();
  root.append(titleBlock(player.name, `${currentCourse()}: private turn`, "You have no role action this course."));
  appendSwapChoice(root, player, finishCourseAction);
  setScreen(root);
}

function personChoices(mode, excludeSelf = false) {
  const currentPlayer = mode === "vote" ? playerById(state.voteOrder[state.voteIndex]) : null;
  const grid = el("div", "choices people");
  state.players.filter(p => !excludeSelf || p.id !== currentPlayer.id).forEach(person => {
    const selected = state.pending[mode] === person.id;
    const choice = button("", () => {
      state.pending[mode] = person.id;
      grid.querySelectorAll("button").forEach(b => {
        const on = b.dataset.id === person.id;
        b.classList.toggle("selected", on);
        b.setAttribute("aria-pressed", String(on));
      });
    }, `person-choice${selected ? " selected" : ""}`);
    choice.dataset.id = person.id;
    choice.setAttribute("aria-pressed", String(selected));
    choice.append(safeImage(person.image, person.name), el("span", "", person.name));
    grid.append(choice);
  });
  return grid;
}

function selectSwapOption(grid, targetId) {
  state.pending.swap = targetId;
  grid.querySelectorAll("button").forEach(choice => {
    const selected = targetId === null ? choice.dataset.id === "none" : choice.dataset.id === targetId;
    choice.classList.toggle("selected", selected);
    choice.setAttribute("aria-pressed", String(selected));
  });
}
