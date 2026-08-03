"use strict";

const POISONER_EXCLUSION_DOUBLE_TAP_MS = 350;

function renderSelection() {
  state.phase = "selection";
  const root = document.createDocumentFragment();
  root.append(titleBlock("A pass-and-play mystery for four", "Poison at the Roundhouse",
    "Exactly four guests are required. Tap to select a character. Double-tap quickly to prevent that character from being assigned the Poisoner role."));
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
    const excluded = state.poisonerExcludedIds.includes(character.id);
    const card = button("", () => selectCharacter(character.id), `character-card${selectedIndex >= 0 ? " selected" : ""}${excluded ? " poisoner-excluded" : ""}`);
    card.setAttribute("aria-pressed", String(selectedIndex >= 0));
    card.setAttribute("aria-label", `${character.name}. ${character.profile}${excluded ? ". Cannot be the Poisoner." : ". Double-tap to exclude from the Poisoner role."}`);
    attachPoisonerExclusionDoubleTap(card, character.id);
    card.append(safeImage(character.image, character.name), el("strong", "", character.name));
    if (excluded) card.append(el("small", "role-exclusion", "Will not be the Poisoner"));
    grid.append(card);
  });
  root.append(el("p", "status", "Tip: double-tap a character to toggle whether they can be the Poisoner."), grid, actions(
    button("Randomise characters", randomiseCharacters, "secondary"),
    button("Clear selections", () => { state.selectedIds = []; renderSelection(); }, "ghost"),
    button("Begin dinner", startGame)
  ));
  setScreen(root);
}

function attachPoisonerExclusionDoubleTap(card, characterId) {
  let tapTimer = null;
  let lastTapAt = 0;

  card.addEventListener("click", event => {
    const now = Date.now();
    const isDoubleTap = now - lastTapAt <= POISONER_EXCLUSION_DOUBLE_TAP_MS;
    lastTapAt = now;

    if (isDoubleTap) {
      if (tapTimer !== null) window.clearTimeout(tapTimer);
      tapTimer = null;
      event.preventDefault();
      event.stopImmediatePropagation();
      togglePoisonerExclusion(characterId);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    tapTimer = window.setTimeout(() => {
      tapTimer = null;
      selectCharacter(characterId);
    }, POISONER_EXCLUSION_DOUBLE_TAP_MS);
  }, true);
}

function togglePoisonerExclusion(id) {
  const index = state.poisonerExcludedIds.indexOf(id);
  if (index >= 0) {
    state.poisonerExcludedIds.splice(index, 1);
    showMessage(`${byId(id).name} may now be the Poisoner.`);
  } else {
    state.poisonerExcludedIds.push(id);
    showMessage(`${byId(id).name} will not be the Poisoner.`);
  }
  renderSelection();
}

function selectCharacter(id) {
  const index = state.selectedIds.indexOf(id);
  if (index >= 0) state.selectedIds.splice(index, 1);
  else if (state.selectedIds.length < PLAYER_COUNT) state.selectedIds.push(id);
  else showMessage("Four guests are already seated. Deselect one before choosing another.");
  renderSelection();
}

function randomiseCharacters() {
  state.selectedIds = shuffle(window.ROUNDHOUSE_CHARACTERS).slice(0, PLAYER_COUNT).map(c => c.id);
  renderSelection();
}

function startGame() {
  if (state.selectedIds.length !== PLAYER_COUNT || new Set(state.selectedIds).size !== PLAYER_COUNT) {
    showMessage("Select exactly four different characters before beginning.");
    return;
  }
  const eligiblePoisoners = state.selectedIds.filter(id => !state.poisonerExcludedIds.includes(id));
  if (eligiblePoisoners.length === 0) {
    showMessage("At least one selected character must be eligible to become the Poisoner.");
    return;
  }
  const poisonerId = shuffle(eligiblePoisoners)[0];
  const remainingRoles = shuffle(["Doctor", "Guest", "Guest"]);
  state.players = state.selectedIds.map(id => ({
    ...byId(id),
    role: id === poisonerId ? "Poisoner" : remainingRoles.shift(),
    health: 2
  }));
  state.roleRevealIndex = 0;
  state.phase = "roles";
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
    Poisoner: "You have two deadly poisons, two slow poisons, and one antidote blocker for the whole dinner. Choose carefully; swaps may move a poisoned serving before it is eaten.",
    Doctor: "Each course, secretly protect one guest, including yourself. Your choice can prevent that guest from losing health unless an antidote blocker was used.",
    Guest: "Observe, discuss, and identify the Poisoner. Each course you may receive a secret opportunity to swap servings."
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
