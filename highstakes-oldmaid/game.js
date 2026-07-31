"use strict";

const app = document.getElementById("game");
const CHARACTERS = window.ROUNDHOUSE_CHARACTERS.slice(0, 16);
const ROOMS = window.HIGH_STAKES_ROOMS;

const state = {
  phase: "welcome",
  players: [],
  roomIndex: 0,
  activePlayer: 0,
  jokerHolder: null,
  selected: new Set(),
  finalists: [],
  winner: null
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
    winner: renderWinner,
    tieBreak: renderTieBreak
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
        <li>Play one physical Old Maid round in each room.</li>
        <li>The player left holding the Joker receives no clue.</li>
        <li>Everyone else eliminates half of their remaining suspects.</li>
        <li>After four rooms, each detective makes a final accusation.</li>
      </ol>
      <button class="primary" data-action="setup">Enter the Roundhouse</button>
    </section>`;
}

function renderSetup() {
  return `
    <section class="panel">
      <p class="kicker">Detective register</p>
      <h1>Who is investigating?</h1>
      <form id="setup-form" class="form-grid">
        ${[1, 2, 3, 4].map(number => `
          <label>Player ${number}
            <input name="player${number}" maxlength="24" required value="Player ${number}">
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
  const target = Math.max(1, Math.ceil(player.remaining.length / 2));
  const required = player.remaining.length - target;
  const room = ROOMS[state.roomIndex];

  return `
    <section class="panel">
      <p class="kicker">${room.name}</p>
      <h1>${escapeHtml(player.name)}'s suspect board</h1>
      ${blocked
        ? `<div class="notice danger"><strong>The Joker blocked your investigation.</strong><p>You receive no clue and cannot eliminate a suspect in this room.</p></div>`
        : `<div class="notice"><strong>Your clue</strong><p>${room.clue}</p><p>Eliminate exactly <strong>${required}</strong> suspect${required === 1 ? "" : "s"}, leaving ${target}.</p></div>`}
      <div class="progress" aria-label="${player.remaining.length} suspects currently remain">
        <span style="width:${(player.remaining.length / CHARACTERS.length) * 100}%"></span>
      </div>
      <div class="board">
        ${CHARACTERS.map(character => renderSuspect(character, player, blocked)).join("")}
      </div>
      <p id="selection-status" class="selection-status">${blocked ? "No eliminations allowed." : `${required} eliminations required.`}</p>
      <button class="primary" data-action="save-board" ${blocked ? "" : "disabled"}>
        ${blocked ? "Hide board and pass on" : "Confirm eliminations"}
      </button>
    </section>`;
}

function renderSuspect(character, player, blocked) {
  const active = player.remaining.includes(character.id);
  const selected = state.selected.has(character.id);
  return `
    <button class="suspect ${active ? "" : "removed"} ${selected ? "selected" : ""}"
      ${!active || blocked ? "disabled" : ""}
      data-id="${character.id}"
      aria-pressed="${selected}">
      <img src="../poison/${character.image}" alt="">
      <strong>${escapeHtml(character.name)}</strong>
      <span>${active ? "Still suspected" : "Eliminated"}</span>
    </button>`;
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
      <p class="kicker">Final accusation</p>
      <h1>Pass the device to ${escapeHtml(player.name)}</h1>
      <p>${player.remaining.length === 1 ? "Your investigation has produced one final suspect." : "Choose one suspect from those still on your board."}</p>
      <button class="primary" data-action="show-final">I am ${escapeHtml(player.name)}</button>
    </section>`;
}

function renderFinalChoice() {
  const player = state.players[state.activePlayer];
  const candidates = CHARACTERS.filter(character => player.remaining.includes(character.id));
  return `
    <section class="panel">
      <p class="kicker">Final accusation</p>
      <h1>Who is the murderer, ${escapeHtml(player.name)}?</h1>
      <p>Your accusation is private until everyone has chosen.</p>
      <div class="board final-board">
        ${candidates.map(character => `
          <button class="suspect" data-action="accuse" data-id="${character.id}">
            <img src="../poison/${character.image}" alt="">
            <strong>${escapeHtml(character.name)}</strong>
            <span>Accuse</span>
          </button>`).join("")}
      </div>
    </section>`;
}

function renderTieBreak() {
  return `
    <section class="panel hero">
      <p class="kicker">Sudden death</p>
      <h1>The detectives agree</h1>
      <p>${state.finalists.map(player => escapeHtml(player.name)).join(", ")} made the same winning accusation.</p>
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
  const suspect = CHARACTERS.find(character => character.id === state.winner.accusation);
  return `
    <section class="panel hero">
      <p class="kicker">Case closed</p>
      <h1>${escapeHtml(state.winner.name)} wins</h1>
      <img class="culprit" src="../poison/${suspect.image}" alt="Portrait of ${escapeHtml(suspect.name)}">
      <h2>${escapeHtml(suspect.name)}</h2>
      <p>${escapeHtml(state.winner.name)} survived four rooms of clues and named the final suspect.</p>
      <button class="primary" data-action="restart">Play again</button>
    </section>`;
}

function bindEvents() {
  document.querySelector('[data-action="setup"]')?.addEventListener("click", () => changePhase("setup"));
  document.getElementById("setup-form")?.addEventListener("submit", startGame);
  document.querySelector('[data-action="finish-room"]')?.addEventListener("click", () => changePhase("holder"));
  document.querySelectorAll('[data-action="holder"]').forEach(button => button.addEventListener("click", () => selectHolder(Number(button.dataset.id))));
  document.querySelector('[data-action="show-board"]')?.addEventListener("click", () => changePhase("board"));
  document.querySelectorAll(".suspect:not([disabled])").forEach(button => {
    if (!button.dataset.action) button.addEventListener("click", toggleSuspect);
  });
  document.querySelector('[data-action="save-board"]')?.addEventListener("click", saveBoard);
  document.querySelector('[data-action="continue"]')?.addEventListener("click", continueGame);
  document.querySelector('[data-action="show-final"]')?.addEventListener("click", () => changePhase("finalChoice"));
  document.querySelectorAll('[data-action="accuse"]').forEach(button => button.addEventListener("click", () => saveAccusation(button.dataset.id)));
  document.querySelectorAll('[data-action="tie-winner"]').forEach(button => button.addEventListener("click", () => finishTie(Number(button.dataset.id))));
  document.querySelector('[data-action="restart"]')?.addEventListener("click", resetGame);
}

function startGame(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.players = [1, 2, 3, 4].map(id => ({
    id,
    name: String(form.get(`player${id}`)).trim() || `Player ${id}`,
    remaining: CHARACTERS.map(character => character.id),
    accusation: null
  }));
  state.roomIndex = 0;
  changePhase("room");
}

function selectHolder(id) {
  state.jokerHolder = id;
  state.activePlayer = 0;
  state.selected = new Set();
  changePhase("pass");
}

function toggleSuspect(event) {
  const player = state.players[state.activePlayer];
  const id = event.currentTarget.dataset.id;
  const target = Math.max(1, Math.ceil(player.remaining.length / 2));
  const required = player.remaining.length - target;

  if (state.selected.has(id)) state.selected.delete(id);
  else if (state.selected.size < required) state.selected.add(id);

  render();
}

function saveBoard() {
  const player = state.players[state.activePlayer];
  const blocked = player.id === state.jokerHolder;
  const target = Math.max(1, Math.ceil(player.remaining.length / 2));
  const required = player.remaining.length - target;

  if (!blocked && state.selected.size !== required) return;
  if (!blocked) player.remaining = player.remaining.filter(id => !state.selected.has(id));

  state.activePlayer += 1;
  state.selected = new Set();
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
  changePhase("finalPass");
}

function saveAccusation(characterId) {
  state.players[state.activePlayer].accusation = characterId;
  state.activePlayer += 1;

  if (state.activePlayer < state.players.length) {
    changePhase("finalPass");
    return;
  }

  resolveWinner();
}

function resolveWinner() {
  const groups = new Map();
  state.players.forEach(player => {
    const key = player.accusation;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(player);
  });

  const ranked = [...groups.values()].sort((a, b) => b.length - a.length);
  state.finalists = ranked[0];

  if (state.finalists.length === 1) {
    state.winner = state.finalists[0];
    changePhase("winner");
  } else {
    changePhase("tieBreak");
  }
}

function finishTie(playerId) {
  state.winner = state.finalists.find(player => player.id === playerId);
  changePhase("winner");
}

function resetGame() {
  state.phase = "welcome";
  state.players = [];
  state.roomIndex = 0;
  state.activePlayer = 0;
  state.jokerHolder = null;
  state.selected = new Set();
  state.finalists = [];
  state.winner = null;
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
