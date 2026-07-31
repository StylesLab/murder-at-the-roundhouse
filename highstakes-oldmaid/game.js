"use strict";

const app = document.getElementById('game');
const CHARACTERS = window.ROUNDHOUSE_CHARACTERS.slice(0, 16);
const ROOMS = window.HIGH_STAKES_ROOMS;

const state = {
  phase: 'welcome',
  players: [],
  roomIndex: 0,
  activePlayer: 0,
  jokerHolder: null,
  winners: [],
  tieBreakOrder: []
};

function render() {
  const screens = {
    welcome: renderWelcome,
    setup: renderSetup,
    room: renderRoom,
    holder: renderHolder,
    boardPass: renderBoardPass,
    board: renderBoard,
    roundSummary: renderRoundSummary,
    winner: renderWinner,
    tieBreak: renderTieBreak
  };
  app.innerHTML = screens[state.phase]();
  bind();
}

function renderWelcome() {
  return `<section class="panel hero"><p class="kicker">A Roundhouse card mystery</p><h1>The Joker's Secret</h1><p>Play a physical game inspired by Old Maid. The app adds rooms, narrative, suspect boards and scoring, but never needs to know your cards.</p><div class="notice"><strong>You need:</strong> four players, one standard deck and one Joker. Remove one ordinary card so every non-Joker card can form a pair.</div><p>At the end of each room, the player holding the Joker gets no clue. Every other player removes half of their remaining suspects. Reach one suspect to solve the mystery.</p><button class="primary" data-action="setup">Enter the Roundhouse</button></section>`;
}

function renderSetup() {
  return `<section class="panel"><p class="kicker">Detective register</p><h1>Who is investigating?</h1><form id="setup-form" class="form-grid">${[1,2,3,4].map(n=>`<label>Player ${n}<input name="player${n}" maxlength="24" required value="Player ${n}"></label>`).join('')}<button class="primary" type="submit">Begin in the Main Hall</button></form></section>`;
}

function renderRoom() {
  const room = ROOMS[state.roomIndex];
  return `<section class="panel"><p class="kicker">Room ${state.roomIndex + 1}</p><h1>${room.name}</h1><img class="room-art" src="${room.image}" alt="${room.name}" onerror="this.hidden=true"><p>${room.narrative}</p><div class="notice"><strong>Play the physical card round now.</strong><br>Draw from the player on your left and discard pairs. Stop when only the Joker remains unpaired.</div><button class="primary" data-action="finish-room">The round is over</button></section>`;
}

function renderHolder() {
  return `<section class="panel"><p class="kicker">The Joker remains</p><h1>Who holds the Joker?</h1><p>Choose the player left holding it. They receive no clue in this room.</p><div class="players">${state.players.map(p=>`<button class="player-card secondary" data-action="holder" data-id="${p.id}"><strong>${p.name}</strong><br>${p.remaining.length} suspects remain</button>`).join('')}</div></section>`;
}

function renderBoardPass() {
  const player = state.players[state.activePlayer];
  return `<section class="panel pass"><p class="kicker">Private suspect board</p><h1>Pass the device to ${player.name}</h1><p>Everyone else should look away.</p><button class="primary" data-action="show-board">I am ${player.name}</button></section>`;
}

function renderBoard() {
  const player = state.players[state.activePlayer];
  const target = Math.max(1, Math.ceil(player.remaining.length / 2));
  const mustRemove = player.remaining.length - target;
  const joker = player.id === state.jokerHolder;
  return `<section class="panel"><p class="kicker">${ROOMS[state.roomIndex].name}</p><h1>${player.name}'s suspect board</h1>${joker?`<div class="notice"><strong>The Joker blocked your investigation.</strong><br>You cannot remove anyone this room.</div>`:`<div class="notice">Remove exactly <strong>${mustRemove}</strong> suspect${mustRemove===1?'':'s'}, leaving ${target}.</div>`}<div id="board" class="board">${CHARACTERS.map(c=>{const active=player.remaining.includes(c.id);return `<button class="suspect ${active?'':'removed'}" ${!active||joker?'disabled':''} data-id="${c.id}"><img src="../poison/${c.image}" alt=""><strong>${c.name}</strong></button>`}).join('')}</div><button class="primary" data-action="save-board" ${joker?'':'disabled'}>${joker?'Hide board and pass on':'Confirm eliminations'}</button></section>`;
}

function renderRoundSummary() {
  return `<section class="panel"><p class="kicker">Investigation update</p><h1>${ROOMS[state.roomIndex].name} searched</h1><div class="players">${state.players.map(p=>`<article class="player-card ${p.remaining.length===1?'winner':''}"><strong>${p.name}</strong><br>${p.remaining.length} suspect${p.remaining.length===1?'':'s'} remain${p.id===state.jokerHolder?'<br><small>Held the Joker</small>':''}</article>`).join('')}</div><button class="primary" data-action="continue">${state.players.some(p=>p.remaining.length===1)?'Resolve the investigation':'Move to the next room'}</button></section>`;
}

function renderWinner() {
  const winner = state.winners[0];
  const suspect = CHARACTERS.find(c=>c.id===winner.remaining[0]);
  return `<section class="panel hero"><p class="kicker">Case closed</p><h1>${winner.name} solves the mystery</h1><img class="room-art" src="../poison/${suspect.image}" alt="Portrait of ${suspect.name}"><h2>${suspect.name}</h2><p>After searching ${state.roomIndex + 1} room${state.roomIndex===0?'':'s'}, ${winner.name} is the first detective left with a single suspect.</p><button class="primary" data-action="restart">Play again</button></section>`;
}

function renderTieBreak() {
  return `<section class="panel"><p class="kicker">Sudden-death tiebreak</p><h1>Deal the deck again</h1><p>${state.winners.map(p=>p.name).join(', ')} all reached one suspect together. Shuffle and deal the full deck. The first tied player to receive the Joker wins.</p><div class="players">${state.winners.map(p=>`<button class="player-card secondary" data-action="tie-winner" data-id="${p.id}"><strong>${p.name}</strong><br>I received the Joker first</button>`).join('')}</div></section>`;
}

function bind() {
  document.querySelector('[data-action="setup"]')?.addEventListener('click',()=>{state.phase='setup';render();});
  document.getElementById('setup-form')?.addEventListener('submit',startGame);
  document.querySelector('[data-action="finish-room"]')?.addEventListener('click',()=>{state.phase='holder';render();});
  document.querySelectorAll('[data-action="holder"]').forEach(b=>b.addEventListener('click',()=>selectHolder(Number(b.dataset.id))));
  document.querySelector('[data-action="show-board"]')?.addEventListener('click',()=>{state.phase='board';render();});
  document.querySelectorAll('.suspect:not([disabled])').forEach(b=>b.addEventListener('click',toggleSuspect));
  document.querySelector('[data-action="save-board"]')?.addEventListener('click',saveBoard);
  document.querySelector('[data-action="continue"]')?.addEventListener('click',continueGame);
  document.querySelectorAll('[data-action="tie-winner"]').forEach(b=>b.addEventListener('click',()=>finishTie(Number(b.dataset.id))));
  document.querySelector('[data-action="restart"]')?.addEventListener('click',()=>location.reload());
}

function startGame(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.players = [1,2,3,4].map(n=>({id:n,name:data.get(`player${n}`).trim(),remaining:CHARACTERS.map(c=>c.id),selected:new Set()}));
  state.phase='room';
  render();
}

function selectHolder(id) {
  state.jokerHolder=id;
  state.activePlayer=0;
  state.players.forEach(p=>p.selected=new Set());
  state.phase='boardPass';
  render();
}

function toggleSuspect(event) {
  const player=state.players[state.activePlayer];
  const id=event.currentTarget.dataset.id;
  const target=Math.max(1,Math.ceil(player.remaining.length/2));
  const mustRemove=player.remaining.length-target;
  if(player.selected.has(id)) player.selected.delete(id);
  else if(player.selected.size<mustRemove) player.selected.add(id);
  event.currentTarget.classList.toggle('removed');
  const save=document.querySelector('[data-action="save-board"]');
  save.disabled=player.selected.size!==mustRemove;
}

function saveBoard() {
  const player=state.players[state.activePlayer];
  if(player.id!==state.jokerHolder) player.remaining=player.remaining.filter(id=>!player.selected.has(id));
  state.activePlayer+=1;
  state.phase=state.activePlayer<state.players.length?'boardPass':'roundSummary';
  render();
}

function continueGame() {
  state.winners=state.players.filter(p=>p.remaining.length===1);
  if(state.winners.length===1){state.phase='winner';render();return;}
  if(state.winners.length>1){state.phase='tieBreak';render();return;}
  state.roomIndex=Math.min(state.roomIndex+1,ROOMS.length-1);
  state.phase='room';
  render();
}

function finishTie(id) {
  state.winners=[state.winners.find(p=>p.id===id)];
  state.phase='winner';
  render();
}

render();
