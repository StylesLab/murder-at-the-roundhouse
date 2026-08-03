"use strict";

function activePlayers() {
  return state.players.filter(player => player.health > 0);
}

function beginCourse() {
  if (state.courseIndex >= COURSE_NAMES.length) { beginAccusations(); return; }
  state.phase = "course-intro";
  const mealOwners = Object.fromEntries(state.players.map(player => [player.id, player.id]));
  const event = shuffle(DINNER_EVENTS)[0];
  state.current = {
    name: COURSE_NAMES[state.courseIndex], poisonedMealOwnerId: null, poisonType: null, protectionTarget: null,
    mealOwners, originalMealOwners: { ...mealOwners }, swapEligibility: {}, swapChoices: {},
    swapDecisions: [], swapHistory: [], results: [], event
  };
  applyPendingDelayedPoison();
  if (event.rotateMeals) rotateActiveMealsClockwise();
  const root = document.createDocumentFragment();
  root.append(titleBlock(`Course ${state.courseIndex + 1} of ${COURSE_NAMES.length}`, state.current.name,
    "Each active player receives the device once in a random order. Bedridden players take no further meal actions, but still join the discussion and final accusation."));
  const eventBox = el("section", "dinner-event");
  eventBox.append(el("p", "eyebrow", "Dinner event"), el("h2", "", event.name), el("p", "lede", event.text));
  const courseImage = safeImage(COURSE_IMAGES[state.current.name], `${state.current.name} course`, "course-image");
  courseImage.alt = `${state.current.name} course illustration`;
  root.append(eventBox, courseImage, actions(button("Begin private turns", beginCourseActionRound)));
  setScreen(root);
}

function applyPendingDelayedPoison() {
  if (!state.delayedPoison) return;
  const delayed = state.delayedPoison;
  const eater = playerById(delayed.playerId);
  if (eater && eater.health > 0) {
    eater.health = Math.max(0, eater.health - 1);
    state.current.results.push({ playerId: eater.id, protected: false, healthAfter: eater.health, mealOwnerId: delayed.mealOwnerId, delayed: true, poisonType: "slow" });
  }
  state.delayedPoison = null;
}

function rotateActiveMealsClockwise() {
  const active = activePlayers();
  if (active.length < 2) return;
  const owners = active.map(player => state.current.mealOwners[player.id]);
  active.forEach((player, index) => {
    state.current.mealOwners[player.id] = owners[(index - 1 + owners.length) % owners.length];
  });
}

function beginCourseActionRound() {
  state.phase = "course-actions";
  const active = activePlayers();
  state.actionQueue = shuffle(active.map(player => player.id));
  state.current.swapOrder = [...state.actionQueue];
  state.current.swapEligibility = Object.fromEntries(active.map(player => [player.id, state.current.event.noSwaps ? false : Math.random() < SWAP_CHANCE]));
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
    root.append(el("p", "status", state.current.event.noSwaps
      ? `The ${state.current.event.name} prevents all swaps during the ${currentCourseLower()}.`
      : `You were not offered a swap during the ${currentCourseLower()}.`),
      actions(button("Hide my screen and pass on", () => {
        state.current.swapChoices[player.id] = { offered: false, targetId: null };
        afterChoice();
      })));
    return;
  }
  root.append(el("h2", "", `Optional ${currentCourseLower()} swap`),
    el("p", "lede", `Choose another active guest to exchange ${currentCourseLower()} with, or keep yours. The swap will be applied later in pass order.`));
  const grid = el("div", "choices people");
  activePlayers().filter(person => person.id !== player.id).forEach(person => {
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
  root.append(titleBlock(player.name, `Choose ${currentCourseLower()} to poison`, "Choose a vial and a serving, then complete any swap shown below before passing the device."));
  if (!poisonerHasQualified()) root.append(el("p", "status warning",
    "Victory requirement not yet met: you must cause at least one non-Poisoner to lose unprotected health before dinner ends."));
  root.append(renderPoisonSupply());
  const typeGrid = el("div", "choices poison-types");
  [
    { id: "deadly", label: "Deadly poison", detail: "Immediate health loss", count: state.poisonSupply.deadly },
    { id: "slow", label: "Slow poison", detail: "Takes effect next course", count: state.poisonSupply.slow },
    { id: "blocker", label: "Antidote blocker", detail: "Immediate and ignores Doctor protection", count: state.poisonSupply.blocker }
  ].forEach(option => {
    const choice = button("", () => selectPoisonType(typeGrid, option.id), "choice poison-type");
    choice.dataset.id = option.id;
    choice.disabled = option.count <= 0;
    choice.append(el("strong", "", option.label), el("span", "", `${option.detail} · ${option.count} left`));
    typeGrid.append(choice);
  });
  root.append(typeGrid);
  const grid = el("div", "choices people");
  activePlayers().forEach(person => {
    const choice = button("", () => selectPoisonTarget(grid, person.id), "person-choice");
    choice.dataset.id = person.id;
    choice.setAttribute("aria-pressed", "false");
    choice.append(safeImage(person.image, person.name), el("span", "", `Poison ${person.name}'s ${currentCourseLower()}`));
    grid.append(choice);
  });
  const canDecline = !state.current.event.forcePoison || Object.values(state.poisonSupply).every(count => count <= 0);
  if (canDecline) {
    const decline = button(`Use no poison in the ${currentCourseLower()}`, () => selectPoisonTarget(grid, null), "choice");
    decline.dataset.id = "none";
    decline.setAttribute("aria-pressed", "false");
    grid.append(decline);
  }
  root.append(grid, actions(button("Continue to swap", () => {
    if (state.pending.poison === undefined) { showMessage("Choose a poison decision."); return; }
    if (state.pending.poison !== null && !state.pending.poisonType) { showMessage("Choose which vial to use."); return; }
    state.current.poisonedMealOwnerId = state.pending.poison;
    state.current.poisonType = state.pending.poison === null ? null : state.pending.poisonType;
    if (state.current.poisonType) state.poisonSupply[state.current.poisonType] -= 1;
    state.pending = {};
    const next = document.createDocumentFragment();
    next.append(titleBlock(player.name, `${currentCourse()}: swap`, "Your poison choice is sealed."));
    appendSwapChoice(next, player, finishCourseAction);
    setScreen(next);
  })));
  setScreen(root);
}

function renderPoisonSupply() {
  const box = el("section", "poison-supply");
  box.append(el("h2", "", "Remaining poison supply"));
  const list = el("div", "supply-grid");
  list.append(
    el("span", "", `Deadly: ${state.poisonSupply.deadly}`),
    el("span", "", `Slow: ${state.poisonSupply.slow}`),
    el("span", "", `Blocker: ${state.poisonSupply.blocker}`)
  );
  box.append(list);
  return box;
}

function selectPoisonType(grid, type) {
  state.pending.poisonType = type;
  grid.querySelectorAll("button").forEach(choice => {
    const selected = choice.dataset.id === type;
    choice.classList.toggle("selected", selected);
    choice.setAttribute("aria-pressed", String(selected));
  });
}

function selectPoisonTarget(grid, targetId) {
  state.pending.poison = targetId;
  if (targetId === null) state.pending.poisonType = null;
  grid.querySelectorAll("button").forEach(choice => {
    const selected = targetId === null ? choice.dataset.id === "none" : choice.dataset.id === targetId;
    choice.classList.toggle("selected", selected);
    choice.setAttribute("aria-pressed", String(selected));
  });
}

function renderDoctorAction(player) {
  const root = document.createDocumentFragment();
  root.append(titleBlock(player.name, "Choose someone to protect", "Make your Doctor choice, then complete any swap shown below before passing the device."));
  root.append(personChoices("protection", false, true), actions(button("Continue to swap", () => {
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

function personChoices(mode, excludeSelf = false, activeOnly = false) {
  const currentPlayer = mode === "vote" ? playerById(state.voteOrder[state.voteIndex]) : null;
  const grid = el("div", "choices people");
  state.players
    .filter(person => !activeOnly || person.health > 0)
    .filter(person => !excludeSelf || person.id !== currentPlayer.id)
    .forEach(person => {
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
