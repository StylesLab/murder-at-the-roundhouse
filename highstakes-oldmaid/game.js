"use strict";

const app = document.getElementById("game");
const CHARACTERS = window.ROUNDHOUSE_CHARACTERS.slice(0, 16);
const ROOMS = window.HIGH_STAKES_ROOMS;
const PLAYER_NAMES_STORAGE_KEY = "highstakes.playerNames.v1";

const state = {
  phase: "welcome",
  players: [],
  murdererId: null,
  roomIndex: 0,
  activePlayer: 0,
  jokerHolder: null,
  finalists: [],
  winner: null,
  accusationRound: 1,
  clearedThisRound: []
};

function render() {
  const views = {
    welcome: renderWelcome,
    setup: renderSetup,
    room: renderRoom,
    holder: renderHolder,
    pass: renderPass,
    board: renderBoard,
    summary: renderSummary,
    finalPass: renderFinalPass,
    finalChoice: renderFinalChoice,
    accusationResult: renderAccusationResult,
    tieBreak: renderTieBreak,
    winner: renderWinner
  };

  app.innerHTML = views[state.phase]();
  bindEvents();
  app.focus();
}

function renderWelcome() {
  return `
    <section class="panel hero">
      <p class="kicker">A four-player Roundhouse mystery</p>
      <h1>The Joker's Secret</h1>
      <p>Play Old Maid with real cards while this app tells the story and manages each detective's private suspect board.</p>
      <div class="notice">
        <strong>Prepare the deck</strong>
        <p>Use one standard deck plus one Joker. Remove one ordinary card so every non-Joker card can form a pair.</p>
      </div>
      <ol class="rules">
        <li>The app secretly chooses the murderer at the beginning.</li>
        <li>Play one physical Old Maid round in each room.</li>
        <li>The player left holding the Joker receives no clue.</li>
        <li>For everyone else, the app automatically excludes 50% of the remaining innocent guests.</li>
        <li>After four rooms, everyone makes private accusations.</li>
        <li>If every accusation is wrong, those suspects are cleared and another accusation round begins.</li>
        <li>If several detectives are correct together, they play a final Joker sudden-death round.</li>
      </ol>
      <button class="primary" data-action="setup">Enter the Roundhouse</button>
    </section>`;
}

function renderSetup() {
  const savedNames = loadPlayerNames();
  return `
    <section class="panel">
      <p class="kicker">Detective register</p>
      <h1>Who is investigating?</h1>
      <form id="setup-form" class="form-grid">
        ${[1, 2, 3, 4].map(number => `
          <label>Player ${number}
            <input name="player${number}" maxlength="24" required value="${escapeHtml(savedNames[number - 1])}">
          </label>`).join("")}
        <button class="primary" type="submit">Begin the investigation</button>
      </form>
    </section>`;
}

function renderRoom() {
  const room = ROOMS[state.roomIndex];
  return `
    <section class="panel room-panel">
      <p class="kicker">Room ${state.roomIndex + 1} of ${ROOMS.length}</p>
      <h1>${room.name}</h1>
      <div class="room-marker" aria-hidden="true">${state.roomIndex + 1}</div>
      <p class="story">${room.narrative}</p>
      <div class="notice">
        <strong>Play the physical card round now.</strong>
        <p>Draw from the player on your left and discard every pair. Continue until only the Joker remains unpaired.</p>
      </div>
      <button class="primary" data-action="finish-room">The card round is over</button>
    </section>`;
}

function renderHolder() {
  return `
    <section class="panel">
      <p class="kicker">The Joker remains</p>
      <h1>Who holds the Joker?</h1>
      <p>Choose the player who was left holding it. That player will not receive this room's clue.</p>
      <div class="players">
        ${state.players.map(player => `
          <button class="player-card secondary" data-action="holder" data-id="${player.id}">
            <strong>${escapeHtml(player.name)}</strong>
            <span>${player.remaining.length} suspects remain</span>
          </button>`).join("")}
      </div>
    </section>`;
}

function renderPass() {
  const player = state.players[state.activePlayer];
  return `
    <section class="panel pass">
      <p class="kicker">Private investigation</p>
      <h1>Pass the device to ${escapeHtml(player.name)}</h1>
      <p>Everyone else should look away before the suspect board is revealed.</p>
      <button class="primary" data-action="show-board">I am ${escapeHtml(player.name)}</button>
    </section>`;
}

function renderBoard() {
  const player = state.players[state.activePlayer];
  const blocked = player.id === state.jokerHolder;
  const removedThisRound = blocked ? [] : excludeHalfOfRemainingInnocents(player);
  const room = ROOMS[state.roomIndex];

  return `
    <section class="panel">
      <p class="kicker">${room.name}</p>
      <h1>${escapeHtml(player.name)}'s suspect board</h1>
      ${blocked
        ? `<div class="notice danger"><strong>The Joker blocked your investigation.</strong><p>You receive no clue and nobody is excluded from enquiries in this room.</p></div>`
        : `<div class="notice"><strong>Your clue</strong><p>${room.clue}</p><p>The app has randomly marked <strong>${removedThisRound.length}</strong> innocent guest${removedThisRound.length === 1 ? "" : "s"} as excluded from enquiries. The murderer remains under suspicion.</p></div>`}
      <div class="progress" aria-label="${player.remaining.length} suspects currently remain">
        <span style="width:${(player.remaining.length / CHARACTERS.length) * 100}%"></span>
      </div>
      <div class="board" aria-label="Suspect status board">
        ${CHARACTERS.map(character => renderSuspect(character, player)).join("")}
      </div>
      <p class="selection-status">No selection is required. Review the exclusions, then continue.</p>
      <button class="primary" data-action="save-board">Continue</button>
    </section>`;
}

function renderSuspect(character, player) {
  const active = player.remaining.includes(character.id);
  return `
    <article class="suspect-card ${active ? "" : "excluded"}">
      <div class="portrait-frame">
        <img src="../poison/${character.image}" alt="Portrait of ${escapeHtml(character.name)}">
      </div>
      <strong>${escapeHtml(character.name)}</strong>
      <span>${active ? "Still under suspicion" : "Excluded from enquiries"}</span>
    </article>`;
}

function renderSummary() {
  const room = ROOMS[state.roomIndex];
  const finalRoom = state.roomIndex === ROOMS.length - 1;
  return `
    <section class="panel">
      <p class="kicker">Investigation update</p>
      <h1>${room.name} searched</h1>
      <div class="players">
        ${state.players.map(player => `
          <article class="player-card ${player.remaining.length === 1 ? "winner" : ""}">
            <strong>${escapeHtml(player.name)}</strong>
            <span>${player.remaining.length} suspect${player.remaining.length === 1 ? "" : "s"} remain</span>
            ${player.id === state.jokerHolder ? "<small>Held the Joker</small>" : "<small>Received the clue</small>"}
          </article>`).join("")}
      </div>
      <button class="primary" data-action="continue">${finalRoom ? "Make final accusations" : "Move to the next room"}</button>
    </section>`;
}

function renderFinalPass() {
  const player = state.players[state.activePlayer];
  return `
    <section class="panel pass">
      <p class="kicker">Accusation round ${state.accusationRound}</p>
      <h1>Pass the device to ${escapeHtml(player.name)}</h1>
      <p>${player.remaining.length === 1 ? "Only one suspect remains on your board." : "Choose one suspect from those still on your board."}</p>
      <button class="primary" data-action="show-final">I am ${escapeHtml(player.name)}</button>
    </section>`;
}

function renderFinalChoice() {
  const player = state.players[state.activePlayer];
  const candidates = CHARACTERS.filter(character => player.remaining.includes(character.id));
  return `
    <section class="panel">
      <p class="kicker">Accusation round ${state.accusationRound}</p>
      <h1>Who is the murderer, ${escapeHtml(player.name)}?</h1>
      <p>Your accusation is private until everyone has chosen.</p>
      <div class="board final-board">
        ${candidates.map(character => `
          <button class="suspect-choice" data-action="accuse" data-id="${character.id}">
            <div class="portrait-frame">
              <img src="../poison/${character.image}" alt="Portrait of ${escapeHtml(character.name)}">
            </div>
            <strong>${escapeHtml(character.name)}</strong>
            <span>Accuse</span>
          </button>`).join("")}
      </div>
    </section>`;
}

function renderAccusationResult() {
  const clearedCharacters = state.clearedThisRound
    .map(id => CHARACTERS.find(character => character.id === id))
    .filter(Boolean);

  return `
    <section class="panel hero">
      <p class="kicker">The accusations were wrong</p>
      <h1>The investigation continues</h1>
      <div class="notice danger">
        <strong>No detective identified the murderer.</strong>
        <p>The police have cleared ${clearedCharacters.map(character => escapeHtml(character.name)).join(", ")}.</p>
      </div>
      <p>Those suspects have been removed from every detective's board. Pass the device around for another private accusation.</p>
      <button class="primary" data-action="next-accusation">Begin accusation round ${state.accusationRound}</button>
    </section>`;
}

function renderTieBreak() {
  return `
    <section class="panel hero">
      <p class="kicker">Sudden death</p>
      <h1>Several detectives solved the case</h1>
      <p>${state.finalists.map(player => escapeHtml(player.name)).join(", ")} all accused the real murderer in accusation round ${state.accusationRound}.</p>
      <div class="notice"><strong>Deal the cards once more.</strong><p>The first tied detective to receive the Joker wins the case.</p></div>
      <div class="players">
        ${state.finalists.map(player => `
          <button class="player-card secondary" data-action="tie-winner" data-id="${player.id}">
            <strong>${escapeHtml(player.name)}</strong>
            <span>I received the Joker first</span>
          </button>`).join("")}
      </div>
    </section>`;
}

function renderWinner() {
  const murderer = CHARACTERS.find(character => character.id === state.murdererId);
  return `
    <section class="panel hero">
      <p class="kicker">Case closed</p>
      <h1>${escapeHtml(state.winner.name)} wins</h1>
      <div class="culprit-frame">
        <img class="culprit" src="../poison/${murderer.image}" alt="Portrait of ${escapeHtml(murderer.name)}">
      </div>
      <h2>${escapeHtml(murderer.name)}</h2>
      <p>${escapeHtml(state.winner.name)} correctly identified the murderer in accusation round ${state.accusationRound}.</p>
      <button class="primary" data-action="restart">Play again</button>
    </section>`;
}

function bindEvents() {
  document.querySelector('[data-action="setup"]')?.addEventListener("click", () => changePhase("setup"));
  document.getElementById("setup-form")?.addEventListener("submit", startGame);
  document.querySelector('[data-action="finish-room"]')?.addEventListener("click", () => changePhase("holder"));
  document.querySelectorAll('[data-action="holder"]').forEach(button => button.addEventListener("click", () => selectHolder(Number(button.dataset.id))));
  document.querySelector('[data-action="show-board"]')?.addEventListener("click", () => changePhase("board"));
  document.querySelector('[data-action="save-board"]')?.addEventListener("click", saveBoard);
  document.querySelector('[data-action="continue"]')?.addEventListener("click", continueGame);
  document.querySelector('[data-action="show-final"]')?.addEventListener("click", () => changePhase("finalChoice"));
  document.querySelectorAll('[data-action="accuse"]').forEach(button => button.addEventListener("click", () => saveAccusation(button.dataset.id)));
  document.querySelector('[data-action="next-accusation"]')?.addEventListener("click", beginNextAccusationRound);
  document.querySelectorAll('[data-action="tie-winner"]').forEach(button => button.addEventListener("click", () => finishTie(Number(button.dataset.id))));
  document.querySelector('[data-action="restart"]')?.addEventListener("click", resetGame);
}

function startGame(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const playerNames = [1, 2, 3, 4].map(id => String(form.get(`player${id}`)).trim() || `Player ${id}`);
  savePlayerNames(playerNames);

  state.murdererId = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;
  state.players = playerNames.map((name, index) => ({
    id: index + 1,
    name,
    remaining: CHARACTERS.map(character => character.id),
    accusation: null,
    processedRoom: -1
  }));
  state.roomIndex = 0;
  state.accusationRound = 1;
  state.clearedThisRound = [];
  state.finalists = [];
  state.winner = null;
  changePhase("room");
}

function loadPlayerNames() {
  const defaults = ["Player 1", "Player 2", "Player 3", "Player 4"];
  try {
    const parsed = JSON.parse(localStorage.getItem(PLAYER_NAMES_STORAGE_KEY));
    if (!Array.isArray(parsed) || parsed.length !== 4) return defaults;
    return parsed.map((name, index) => {
      const value = typeof name === "string" ? name.trim().slice(0, 24) : "";
      return value || defaults[index];
    });
  } catch {
    return defaults;
  }
}

function savePlayerNames(names) {
  try {
    localStorage.setItem(PLAYER_NAMES_STORAGE_KEY, JSON.stringify(names));
  } catch {
    // The game still works if storage is blocked or unavailable.
  }
}

function selectHolder(id) {
  state.jokerHolder = id;
  state.activePlayer = 0;
  changePhase("pass");
}

function excludeHalfOfRemainingInnocents(player) {
  if (player.processedRoom === state.roomIndex) return [];

  const innocentIds = player.remaining.filter(id => id !== state.murdererId);
  const removeCount = Math.floor(innocentIds.length / 2);
  const shuffled = shuffle(innocentIds);
  const removed = shuffled.slice(0, removeCount);

  player.remaining = player.remaining.filter(id => !removed.includes(id));
  player.processedRoom = state.roomIndex;
  return removed;
}

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function saveBoard() {
  state.players[state.activePlayer].processedRoom = state.roomIndex;
  state.activePlayer += 1;
  changePhase(state.activePlayer < state.players.length ? "pass" : "summary");
}

function continueGame() {
  if (state.roomIndex < ROOMS.length - 1) {
    state.roomIndex += 1;
    state.jokerHolder = null;
    changePhase("room");
    return;
  }

  state.activePlayer = 0;
  state.players.forEach(player => { player.accusation = null; });
  changePhase("finalPass");
}

function saveAccusation(characterId) {
  state.players[state.activePlayer].accusation = characterId;
  state.activePlayer += 1;

  if (state.activePlayer < state.players.length) {
    changePhase("finalPass");
    return;
  }

  resolveAccusations();
}

function resolveAccusations() {
  state.finalists = state.players.filter(player => player.accusation === state.murdererId);

  if (state.finalists.length === 1) {
    state.winner = state.finalists[0];
    changePhase("winner");
    return;
  }

  if (state.finalists.length > 1) {
    changePhase("tieBreak");
    return;
  }

  state.clearedThisRound = [...new Set(state.players.map(player => player.accusation))]
    .filter(id => id && id !== state.murdererId);

  state.players.forEach(player => {
    player.remaining = player.remaining.filter(id => !state.clearedThisRound.includes(id));
    player.accusation = null;
  });

  state.accusationRound += 1;
  changePhase("accusationResult");
}

function beginNextAccusationRound() {
  state.activePlayer = 0;
  changePhase("finalPass");
}

function finishTie(playerId) {
  state.winner = state.finalists.find(player => player.id === playerId);
  changePhase("winner");
}

function resetGame() {
  state.phase = "welcome";
  state.players = [];
  state.murdererId = null;
  state.roomIndex = 0;
  state.activePlayer = 0;
  state.jokerHolder = null;
  state.finalists = [];
  state.winner = null;
  state.accusationRound = 1;
  state.clearedThisRound = [];
  render();
}

function changePhase(phase) {
  state.phase = phase;
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
