"use strict";

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
    Poisoner: "Each course, secretly poison one guest's meal—or choose no poison. Swaps may move that meal before it is eaten.",
    Doctor: "Each course, secretly protect one guest, including yourself. Your choice can prevent that guest from losing health.",
    Guest: "Observe, discuss, and identify the Poisoner. Each course you have a 50% chance of receiving a secret opportunity to swap meals."
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
    name: COURSE_NAMES[state.courseIndex],
    poisonedMealOwnerId: null,
    protectionTarget: null,
    mealOwners,
    originalMealOwners: { ...mealOwners },
    swapEligibility: {},
    swapDecisions: [],
    swapHistory: [],
    results: []
  };
  const root = document.createDocumentFragment();
  root.append(titleBlock(`Course ${state.courseIndex + 1} of ${COURSE_NAMES.length}`, state.current.name,
    "The Poisoner targets a meal and the Doctor protects a guest. Then each player may secretly receive a chance to swap meals. Swaps are applied immediately in pass order."));
  const courseImage = safeImage(COURSE_IMAGES[state.current.name], `${state.current.name} course`, "course-image");
  courseImage.alt = `${state.current.name} course illustration`;
  root.append(courseImage, actions(button("Begin secret actions", beginPrivateActionRound)));
  setScreen(root);
}
function beginPrivateActionRound() {
  state.phase = "private-actions";
  state.actionQueue = shuffle(state.players.map(player => player.id));
  state.actionIndex = 0;
  beginPrivateActionTurn();
}
function beginPrivateActionTurn() {
  if (state.actionIndex >= state.actionQueue.length) { beginSwapRound(); return; }
  const player = playerById(state.actionQueue[state.actionIndex]);
  showPassScreen(player, `${state.current.name}: private action`, () => {
    if (player.role === "Poisoner") renderPoisonerAction(player);
    else if (player.role === "Doctor") renderDoctorAction(player);
    else renderGuestAction(player);
  });
}
function finishPrivateAction() {
  state.pending = {};
  state.actionIndex += 1;
  beginPrivateActionTurn();
}
function renderPoisonerAction(player) {
  const root = document.createDocumentFragment();
  root.append(titleBlock(player.name, "Choose a meal to poison", "Target the meal currently placed in front of one guest. Later swaps may move it. You may also choose no poison."));
  if (!poisonerHasQualified()) root.append(el("p", "status warning",
    "Victory requirement not yet met: you must cause at least one non-Poisoner to lose unprotected health before dinner ends."));
  const grid = el("div", "choices people");
  state.players.forEach(person => {
    const choice = button("", () => selectPoisonTarget(grid, person.id), "person-choice");
    choice.dataset.id = person.id; choice.setAttribute("aria-pressed", "false");
    choice.append(safeImage(person.image, person.name), el("span", "", `Poison ${person.name}'s meal`));
    grid.append(choice);
  });
  const decline = button("Use no poison this course", () => selectPoisonTarget(grid, null), "choice");
  decline.dataset.id = "none"; decline.setAttribute("aria-pressed", "false"); grid.append(decline);
  root.append(grid, actions(button("Seal my choice", () => {
    if (state.pending.poison === undefined) { showMessage("Choose a poison decision."); return; }
    state.current.poisonedMealOwnerId = state.pending.poison;
    finishPrivateAction();
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
  root.append(titleBlock(player.name, "Choose someone to protect", "You may protect yourself. Protection applies to whoever finally eats that guest's meal."));
  root.append(personChoices("protection"), actions(button("Seal my choice", () => {
    if (!state.pending.protection) { showMessage("Choose a person to protect."); return; }
    state.current.protectionTarget = state.pending.protection;
    finishPrivateAction();
  })));
  setScreen(root);
}
function renderGuestAction(player) {
  const root = document.createDocumentFragment();
  root.append(titleBlock(player.name, "Nothing unusual to report",
    "You have no role action this course. A separate secret swap opportunity may follow."));
  root.append(actions(button("Seal my report", finishPrivateAction)));
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
