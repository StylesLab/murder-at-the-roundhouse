"use strict";

const app = document.getElementById('game');
const CARD_RULES = window.HIGH_STAKES_CARDS;
const EVENTS = window.HIGH_STAKES_EVENTS;
const CHARACTERS = window.ROUNDHOUSE_CHARACTERS;

const state = {
  phase: 'welcome',
  players: [],
  revealIndex: 0,
  round: 0,
  turn: 0,
  events: [],
  currentEvent: null,
  submissions: [],
  history: [],
  accusedId: null
};

const abilities = [
  { name: 'Commanding Presence', text: '+2 when playing Influence.', suit: 'spades', bonus: 2 },
  { name: 'Trusted Confidant', text: '+2 when playing Trust.', suit: 'hearts', bonus: 2 },
  { name: 'Private Fortune', text: '+2 when playing Wealth.', suit: 'diamonds', bonus: 2 },
  { name: 'Keen Investigator', text: '+2 when playing Evidence.', suit: 'clubs', bonus: 2 }
];

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function render() {
  const screens = {
    welcome: renderWelcome,
    setup: renderSetup,
    revealPass: renderRevealPass,
    reveal: renderReveal,
    roundIntro: renderRoundIntro,
    turnPass: renderTurnPass,
    playCard: renderPlayCard,
    roundResult: renderRoundResult,
    accusation: renderAccusation,
    ending: renderEnding
  };
  app.innerHTML = screens[state.phase]();
  bindActions();
}

function renderWelcome() {
  return `
    <section class="panel hero">
      <p class="kicker">A four-player card mystery</p>
      <h1>High Stakes at the Roundhouse</h1>
      <p>The lights fail during a private game of cards. When they return, a guest lies dead and every player has something to hide.</p>
      <div class="rules">
        ${Object.entries(CARD_RULES.suits).map(([key, suit]) => `<div class="rule"><div class="suit ${key === 'hearts' || key === 'diamonds' ? 'red' : 'black'}">${suit.symbol}</div><strong>${suit.name}</strong><br><small>${suit.hint}</small></div>`).join('')}
      </div>
      <p class="notice">You need one standard 52-card deck. Deal five cards to each player. The phone never needs to see your hands.</p>
      <button class="primary" data-action="setup">Prepare the table</button>
    </section>`;
}

function renderSetup() {
  return `
    <section class="panel">
      <p class="kicker">The guest list</p>
      <h1>Who is playing?</h1>
      <form id="setup-form" class="form-grid">
        ${[1,2,3,4].map(n => `<label>Player ${n}<input name="player${n}" required maxlength="24" value="Player ${n}"></label>`).join('')}
        <button class="primary" type="submit">Assign secret characters</button>
      </form>
    </section>`;
}

function renderRevealPass() {
  const player = state.players[state.revealIndex];
  return `<section class="panel pass"><p class="kicker">Secret identity</p><h1>Pass the device to ${player.name}</h1><p>Everyone else should look away.</p><button class="primary" data-action="show-character">I am ${player.name}</button></section>`;
}

function renderReveal() {
  const player = state.players[state.revealIndex];
  return `<section class="panel pass"><img class="portrait" src="../poison/${player.character.image}" alt="Portrait of ${player.character.name}"><p class="kicker">You are</p><h1>${player.character.name}</h1><p>${player.character.profile}</p><div class="notice"><strong>${player.ability.name}</strong><br>${player.ability.text}</div><p>Your private objective is to finish with the lowest suspicion. You may tell the truth or bluff about every card you play.</p><button class="primary" data-action="hide-character">Hide identity and pass on</button></section>`;
}

function renderRoundIntro() {
  const suit = CARD_RULES.suits[state.currentEvent.suit];
  return `<section class="panel"><p class="kicker">Investigation ${state.round + 1} of 5</p><h1>${state.currentEvent.title}</h1><p>${state.currentEvent.text}</p><div class="notice"><span class="suit ${state.currentEvent.suit === 'hearts' || state.currentEvent.suit === 'diamonds' ? 'red' : 'black'}">${suit.symbol}</span><br><strong>${suit.name} leads this investigation</strong><br>Players may play any card, but matching the investigation suit can uncover the clue.</div><button class="primary" data-action="begin-turns">Begin secret plays</button></section>`;
}

function renderTurnPass() {
  const player = state.players[state.turn];
  return `<section class="panel pass"><p class="kicker">Private card play</p><h1>Pass the device to ${player.name}</h1><p>Keep your hand hidden.</p><button class="primary" data-action="show-card-form">I am ${player.name}</button></section>`;
}

function renderPlayCard() {
  const player = state.players[state.turn];
  return `<section class="panel"><p class="kicker">${player.character.name}</p><h1>Play one card</h1><p>Place the physical card face down in front of you, then record it privately.</p><form id="card-form" class="form-grid"><label>Suit<select name="suit" required>${Object.entries(CARD_RULES.suits).map(([key, suit]) => `<option value="${key}">${suit.symbol} ${suit.name}</option>`).join('')}</select></label><label>Value<select name="value" required>${[1,2,3,4,5,6,7,8,9,10,11,12,13].map(v => `<option value="${v}">${CARD_RULES.valueLabel(v)}</option>`).join('')}</select></label><button class="primary" type="submit">Commit card and hide screen</button></form></section>`;
}

function renderRoundResult() {
  const result = state.history[state.history.length - 1];
  return `<section class="panel"><p class="kicker">Cards revealed</p><h1>${result.title}</h1><div class="players">${result.plays.map(play => `<article class="player-card ${play.winner ? 'active' : ''}"><strong>${play.playerName}</strong><br><span class="suit ${play.suit === 'hearts' || play.suit === 'diamonds' ? 'red' : 'black'}">${CARD_RULES.suits[play.suit].symbol}</span> ${CARD_RULES.valueLabel(play.value)}<br><small>Score ${play.score}</small></article>`).join('')}</div><p class="notice">${result.clueFound ? `<strong>Clue discovered:</strong> ${result.clue}` : 'The evidence remains inconclusive. The leading player gains suspicion for dominating the room without producing a useful clue.'}</p><div class="players">${state.players.map(player => `<article class="player-card ${player.suspicion >= 3 ? 'suspect' : ''}"><strong>${player.name}</strong><br>Suspicion: ${player.suspicion}</article>`).join('')}</div><button class="primary" data-action="continue">${state.round === 4 ? 'Make the final accusation' : 'Discuss, discard played cards, and continue'}</button></section>`;
}

function renderAccusation() {
  return `<section class="panel"><p class="kicker">Final accusation</p><h1>Who engineered the murder?</h1><p>Discuss the evidence. As a group, choose one accused player. Resolve a tie by accusing the player with the highest suspicion.</p><div class="choices">${state.players.map(player => `<button class="choice" data-action="accuse" data-id="${player.id}"><strong>${player.name}</strong>${player.character.name}<br>Suspicion ${player.suspicion}</button>`).join('')}</div></section>`;
}

function renderEnding() {
  const murderer = chooseMurderer();
  const accused = state.players.find(player => player.id === state.accusedId);
  const solved = accused.id === murderer.id;
  return `<section class="panel"><p class="kicker">The truth at midnight</p><h1>${solved ? 'The guests expose the killer' : 'The killer escapes'}</h1><img class="portrait" src="../poison/${murderer.character.image}" alt="Portrait of ${murderer.character.name}"><h2>${murderer.name} — ${murderer.character.name}</h2><p>${murderer.name}'s pattern of influence, concealed evidence, and mounting suspicion made them the murderer in this telling of the night.</p><p class="notice">You accused <strong>${accused.name}</strong>. ${solved ? 'Your reasoning was correct.' : `The table trusted the wrong story.`}</p><h2>The investigation reconstructed</h2><div class="timeline">${state.history.map((item, index) => `<article><strong>${index + 1}. ${item.title}</strong><br>${item.clueFound ? item.clue : 'No reliable clue was recovered.'}</article>`).join('')}</div><button class="primary" data-action="restart">Play another mystery</button></section>`;
}

function bindActions() {
  document.querySelector('[data-action="setup"]')?.addEventListener('click', () => { state.phase = 'setup'; render(); });
  document.getElementById('setup-form')?.addEventListener('submit', startGame);
  document.querySelector('[data-action="show-character"]')?.addEventListener('click', () => { state.phase = 'reveal'; render(); });
  document.querySelector('[data-action="hide-character"]')?.addEventListener('click', nextReveal);
  document.querySelector('[data-action="begin-turns"]')?.addEventListener('click', () => { state.turn = 0; state.submissions = []; state.phase = 'turnPass'; render(); });
  document.querySelector('[data-action="show-card-form"]')?.addEventListener('click', () => { state.phase = 'playCard'; render(); });
  document.getElementById('card-form')?.addEventListener('submit', submitCard);
  document.querySelector('[data-action="continue"]')?.addEventListener('click', continueGame);
  document.querySelectorAll('[data-action="accuse"]').forEach(button => button.addEventListener('click', () => { state.accusedId = Number(button.dataset.id); state.phase = 'ending'; render(); }));
  document.querySelector('[data-action="restart"]')?.addEventListener('click', () => window.location.reload());
}

function startGame(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const selectedCharacters = shuffle(CHARACTERS).slice(0, 4);
  const selectedAbilities = shuffle(abilities);
  state.players = [1,2,3,4].map((n, index) => ({ id: n, name: data.get(`player${n}`).trim(), character: selectedCharacters[index], ability: selectedAbilities[index], suspicion: 0, totalScore: 0, matchingWins: 0 }));
  state.events = shuffle(EVENTS).slice(0, 5);
  state.revealIndex = 0;
  state.phase = 'revealPass';
  render();
}

function nextReveal() {
  state.revealIndex += 1;
  if (state.revealIndex < state.players.length) {
    state.phase = 'revealPass';
  } else {
    beginRound();
  }
  render();
}

function beginRound() {
  state.currentEvent = state.events[state.round];
  state.phase = 'roundIntro';
}

function submitCard(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const player = state.players[state.turn];
  const suit = data.get('suit');
  const value = Number(data.get('value'));
  const score = CARD_RULES.score(value) + (player.ability.suit === suit ? player.ability.bonus : 0);
  state.submissions.push({ playerId: player.id, playerName: player.name, suit, value, score });
  state.turn += 1;
  if (state.turn < state.players.length) {
    state.phase = 'turnPass';
  } else {
    resolveRound();
  }
  render();
}

function resolveRound() {
  const sorted = [...state.submissions].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const matching = sorted.filter(play => play.suit === state.currentEvent.suit);
  const clueFound = matching.length > 0;
  const clueWinner = matching.sort((a, b) => b.score - a.score)[0];
  const winnerPlayer = state.players.find(player => player.id === winner.playerId);
  winnerPlayer.totalScore += winner.score;
  winnerPlayer.suspicion += clueFound && clueWinner.playerId === winner.playerId ? 0 : 1;
  if (clueFound) {
    const cluePlayer = state.players.find(player => player.id === clueWinner.playerId);
    cluePlayer.matchingWins += 1;
    cluePlayer.suspicion = Math.max(0, cluePlayer.suspicion - 1);
  }
  state.history.push({ title: state.currentEvent.title, clue: state.currentEvent.clue, clueFound, plays: state.submissions.map(play => ({ ...play, winner: play.playerId === winner.playerId })) });
  state.phase = 'roundResult';
}

function continueGame() {
  if (state.round === 4) {
    state.phase = 'accusation';
  } else {
    state.round += 1;
    beginRound();
  }
  render();
}

function chooseMurderer() {
  return [...state.players].sort((a, b) => (b.suspicion * 10 + b.totalScore - b.matchingWins * 2) - (a.suspicion * 10 + a.totalScore - a.matchingWins * 2))[0];
}

render();
