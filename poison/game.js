"use strict";

// Fictional pass-and-play dinner mystery. Consolidated from game-v2-1.js, game-v2-2.js and game-v2-3.js.

const PLAYER_COUNT = 4;
const SWAP_CHANCE = 0.5;
const COURSE_NAMES = ["Aperitif", "Soup", "Fish", "Main Course", "Dessert"];
const COURSE_IMAGES = {
  "Aperitif": "assets/courses/aperitif.webp",
  "Soup": "assets/courses/soup.webp",
  "Fish": "assets/courses/fish.webp",
  "Main Course": "assets/courses/main-course.webp",
  "Dessert": "assets/courses/dessert.webp"
};
const ROLES = ["Poisoner", "Doctor", "Guest", "Guest"];
const debugMode = new URLSearchParams(location.search).get("debug") === "true";
const gameRoot = document.querySelector("#game");
const message = document.querySelector("#message");
const debugRoot = document.querySelector("#debug");
let state = freshState();

function freshState(selectedIds = []) {
  return {
    phase: "selection", selectedIds: [...selectedIds], players: [], roleRevealIndex: 0,
    courseIndex: 0, courses: [], current: null, actionQueue: [], actionIndex: 0,
    votes: {}, voteOrder: [], voteIndex: 0, pending: {}, transitionLocked: false,
    immediatePoisonerWin: false
  };
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const byId = id => window.ROUNDHOUSE_CHARACTERS.find(character => character.id === id);
const playerById = id => state.players.find(player => player.id === id);
const poisonerHasQualified = () => state.courses.some(course =>
  course.results.some(result => !result.protected && playerById(result.playerId).role !== "Poisoner")
);
const currentCourse = () => state.current?.name ?? "course";
const currentCourseLower = () => currentCourse().toLowerCase();
const safeImage = (image, name, className = "") => {
  const img = document.createElement("img");
  img.src = image; img.alt = `Portrait of ${name}`; img.className = className;
  return img;
};
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const button = (label, handler, className = "") => {
  const node = el("button", className, label);
  node.type = "button"; node.addEventListener("click", handler);
  return node;
};
function setScreen(...nodes) {
  gameRoot.replaceChildren(...nodes);
  gameRoot.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  renderDebug();
}
function titleBlock(eyebrow, title, description) {
  const box = document.createDocumentFragment();
  box.append(el("p", "eyebrow", eyebrow), el("h1", "", title));
  if (description) box.append(el("p", "lede", description));
  return box;
}
function showMessage(text) {
  message.textContent = text; message.hidden = false;
  window.setTimeout(() => { message.hidden = true; }, 2800);
}
function actions(...buttons) { const box = el("div", "actions"); box.append(...buttons); return box; }

function renderSelection() {
  state.phase = "selection";
  const root = document.createDocumentFragment();
  root.append(titleBlock("A pass-and-play mystery for four", "Poison at the Roundhouse",
    "Exactly four guests are required. Choose four different public characters; secret roles are assigned only after dinner begins."));
  const summary = el("div", "player-slots");
  for (let index = 0; index < PLAYER_COUNT; index += 1) {
    const character = byId(state.selectedIds[index]);
    const slot = el("div", "slot");
    if (character) slot.append(safeImage(character.image, character.name), el("strong", "", `Player ${index + 1}: ${character.name}`));
    else slot.append(el("strong", "", `Player ${index + 1}: choose a guest`));
    summary.append(slot);
  }
  root.append(summary);
  const grid = el("section", "character-grid");
  grid.setAttribute("aria-label", "Available characters");
  window.ROUNDHOUSE_CHARACTERS.forEach(character => {
    const selectedIndex = state.selectedIds.indexOf(character.id);
    const card = button("", () => selectCharacter(character.id), `character-card${selectedIndex >= 0 ? " selected" : ""}`);
    card.setAttribute("aria-pressed", String(selectedIndex >= 0));
    card.setAttribute("aria-label", `${character.name}. ${character.profile}`);
    card.append(safeImage(character.image, character.name), el("strong", "", character.name));
    grid.append(card);
  });
  root.append(grid, actions(
    button("Randomise characters", randomiseCharacters, "secondary"),
    button("Clear selections", () => { state.selectedIds = []; renderSelection(); }, "ghost"),
    button("Begin dinner", startGame)
  ));
  setScreen(root);
}

function selectCharacter(id) {
  const index = state.selectedIds.indexOf(id);
  if (index >= 0) state.selectedIds.splice(index, 1);
  else if (state.selectedIds.length < PLAYER_COUNT) state.selectedIds.push(id);
  else showMessage("Four guests are already seated. Deselect one before choosing another.");
  renderSelection();
}
function randomiseCharacters() { state.selectedIds = shuffle(window.ROUNDHOUSE_CHARACTERS).slice(0, PLAYER_COUNT).map(c => c.id); renderSelection(); }
function startGame() {
  if (state.selectedIds.length !== PLAYER_COUNT || new Set(state.selectedIds).size !== PLAYER_COUNT) {
    showMessage("Select exactly four different characters before beginning."); return;
  }
  const assigned = shuffle(ROLES);
  state.players = state.selectedIds.map((id, index) => ({ ...byId(id), role: assigned[index], health: 2 }));
  state.roleRevealIndex = 0; state.phase = "roles";
  showPassScreen(state.players[0], "View your secret role", revealRole);
}

function showPassScreen(player, purpose, callback) {
  state.pending = {};
  const box = el("section", "privacy");
  box.append(el("p", "eyebrow", purpose), el("h2", "", `Pass the device to ${player.name}`),
    safeImage(player.image, player.name, "portrait"), el("p", "warning", "Make sure nobody else can see the screen."),
    button(`I am ${player.name} — reveal my screen`, callback));
  setScreen(box);
  if (debugMode && debugRoot.dataset.skip === "true") callback();
}
function revealRole() {
  const player = state.players[state.roleRevealIndex];
  const descriptions = {
    Poisoner: "Each course, secretly poison one guest's serving—or choose no poison. Swaps may move it before it is eaten.",
    Doctor: "Each course, secretly protect one guest, including yourself. Your choice can prevent that guest from losing health.",
    Guest: "Observe, discuss, and identify the Poisoner. Each course you have a 50% chance of receiving a secret opportunity to swap servings."
  };
  const root = document.createDocumentFragment();
  root.append(titleBlock(player.name, `You are the ${player.role}`, descriptions[player.role]),
    actions(button("Hide my role and pass on", () => {
      state.pending = {};
      state.roleRevealIndex += 1;
      if (state.roleRevealIndex < PLAYER_COUNT) showPassScreen(state.players[state.roleRevealIndex], "View your secret role", revealRole);
      else beginCourse();
    })));
  setScreen(root);
}

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
    `Each player receives the device once. The Poisoner and Doctor make their choices first, then all swaps are applied in the same pass order.`));
  const courseImage = safeImage(COURSE_IMAGES[state.current.name], `${state.current.name} course`, "course-image");
  courseImage.alt = `${state.current.name} course illustration`;
  root.append(courseImage, actions(button("Begin private turns", beginCourseActionRound)));
  setScreen(root);
}
function beginCourseActionRound() {
  state.phase = "course-actions";
  const poisoner = state.players.find(player => player.role === "Poisoner");
  const doctor = state.players.find(player => player.role === "Doctor");
  const guests = shuffle(state.players.filter(player => player.role === "Guest"));
  state.actionQueue = [poisoner.id, doctor.id, ...guests.map(player => player.id)];
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
    choice.dataset.id = person.id; choice.setAttribute("aria-pressed", "false");
    choice.append(safeImage(person.image, person.name), el("span", "", `Swap with ${person.name}`)); grid.append(choice);
  });
  const decline = button(`Keep my ${currentCourseLower()}`, () => selectSwapOption(grid, null), "choice");
  decline.dataset.id = "none"; decline.setAttribute("aria-pressed", "false"); grid.append(decline);
  root.append(grid, actions(button("Seal my turn and pass on", () => {
    if (state.pending.swap === undefined) { showMessage(`Choose a swap target, or keep your ${currentCourseLower()}.`); return; }
    state.current.swapChoices[player.id] = { offered: true, targetId: state.pending.swap };
    afterChoice();
  })));
}
function renderPoisonerAction(player) {
  const root = document.createDocumentFragment();
  root.append(titleBlock(player.name, `Choose ${currentCourseLower()} to poison`, `Make your Poisoner choice, then complete any swap shown below before passing the device.`));
  if (!poisonerHasQualified()) root.append(el("p", "status warning",
    "Victory requirement not yet met: you must cause at least one non-Poisoner to lose unprotected health before dinner ends."));
  const grid = el("div", "choices people");
  state.players.forEach(person => {
    const choice = button("", () => selectPoisonTarget(grid, person.id), "person-choice");
    choice.dataset.id = person.id; choice.setAttribute("aria-pressed", "false");
    choice.append(safeImage(person.image, person.name), el("span", "", `Poison ${person.name}'s ${currentCourseLower()}`));
    grid.append(choice);
  });
  const decline = button(`Use no poison in the ${currentCourseLower()}`, () => selectPoisonTarget(grid, null), "choice");
  decline.dataset.id = "none"; decline.setAttribute("aria-pressed", "false"); grid.append(decline);
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
  root.append(titleBlock(player.name, "Choose someone to protect", `Make your Doctor choice, then complete any swap shown below before passing the device.`));
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
      grid.querySelectorAll("button").forEach(b => { const on = b.dataset.id === person.id; b.classList.toggle("selected", on); b.setAttribute("aria-pressed", String(on)); });
    }, `person-choice${selected ? " selected" : ""}`);
    choice.dataset.id = person.id; choice.setAttribute("aria-pressed", String(selected));
    choice.append(safeImage(person.image, person.name), el("span", "", person.name)); grid.append(choice);
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
    const courseName = course.name.toLowerCase();
    const poisonText = course.poisonedMealOwnerId === null ? `No ${courseName} was poisoned.` : `${playerById(course.poisonedMealOwnerId).name}'s ${courseName} was poisoned.`;
    article.append(el("h3", "", `${index + 1}. ${course.name}`),
      el("p", "", `${poisonText} Doctor protected ${playerById(course.protectionTarget).name}.`),
      el("p", "", `Starting places: ${renderMealMap(course.originalMealOwners, courseName)}.`));
    const decisions = el("ol", "");
    course.swapDecisions.forEach(decision => {
      const actor = playerById(decision.playerId);
      let text;
      if (!decision.offered) text = `${actor.name} was not offered a swap.`;
      else if (decision.targetId === null) text = `${actor.name} was offered a swap but kept their ${courseName}.`;
      else text = `${actor.name} swapped ${courseName} with ${playerById(decision.targetId).name}. Afterward: ${renderMealMap(decision.after, courseName)}.`;
      decisions.append(el("li", "", text));
    });
    article.append(el("h4", "", "Swap sequence"), decisions, el("p", "", `Final places: ${renderMealMap(course.mealOwners, courseName)}.`));
    const list = el("ul", "");
    state.players.forEach(player => {
      const incident = course.results.find(result => result.playerId === player.id);
      const outcome = incident ? (incident.protected ? `ate the poisoned ${courseName}, but was protected` : `ate the poisoned ${courseName} and was unprotected`) : `did not eat the poisoned ${courseName}`;
      const mealOwner = ownerAtSeat(course, player.id);
      list.append(el("li", "", `${player.name} ate ${mealOwner.name}'s ${courseName}; ${outcome}; ${course.healthAfter[player.id]} health remaining.`));
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
  else if (state.phase === "discussion") renderCourseDiscussion();
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
  if (state.phase === "course-intro") { beginCourseActionRound(); return; }
  if (state.phase === "discussion") { state.courseIndex += 1; beginCourse(); return; }
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
