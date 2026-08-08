"use strict";

const app = document.querySelector("#game");
const toast = document.querySelector("#toast");
const STORAGE_KEY = "roundhouse.euchre.progress.v1";
const SUITS = ["♣", "♦", "♥", "♠"];
const RED = new Set(["♦", "♥"]);
const RANKS = ["9", "10", "J", "Q", "K", "A"];
const FACE_PORTRAITS = {
  J: ["01", "06", "13", "17"],
  Q: ["03", "08", "14", "16"],
  K: ["02", "04", "12", "18"]
};
const LEVELS = [
  { id: 1, title: "Meet the Pack", subtitle: "Which cards do we use?", xp: 20, kind: "pack" },
  { id: 2, title: "Trump Power", subtitle: "Why trump beats other suits", xp: 25, kind: "trump" },
  { id: 3, title: "The Right Bower", subtitle: "The strongest ordinary card", xp: 30, kind: "right" },
  { id: 4, title: "The Left Bower", subtitle: "The sneaky jack that changes suit", xp: 35, kind: "left" },
  { id: 5, title: "Meet the Benny", subtitle: "The Joker rules them all", xp: 35, kind: "benny" },
  { id: 6, title: "Follow Suit", subtitle: "Play legal cards", xp: 40, kind: "follow" },
  { id: 7, title: "Win the Trick", subtitle: "Spot the strongest card", xp: 45, kind: "winner" },
  { id: 8, title: "Save Your Trump", subtitle: "A first tactical choice", xp: 50, kind: "tactics" },
  { id: 9, title: "Call It!", subtitle: "Choose a useful trump suit", xp: 55, kind: "call" },
  { id: 10, title: "Mini Mission", subtitle: "Win two tricks from three", xp: 70, kind: "mini" },
  { id: 11, title: "Roundhouse Table", subtitle: "Play a full five-trick hand", xp: 100, kind: "full" }
];
const ACHIEVEMENTS = [
  { id: "first", icon: "★", title: "First Trick", text: "Complete your first lesson." },
  { id: "bower", icon: "♛", title: "Bower Spotter", text: "Master both bowers." },
  { id: "streak", icon: "⚡", title: "Hot Streak", text: "Answer three challenges correctly in a row." },
  { id: "mini", icon: "♣", title: "Trick Taker", text: "Complete the Mini Mission." },
  { id: "table", icon: "🏆", title: "Roundhouse Regular", text: "Complete a full AI hand." }
];

let progress = loadProgress();
let screen = "home";
let currentLevel = 1;
let lessonState = {};
let handState = null;

function loadProgress() {
  const fallback = { xp: 0, completed: [], stars: {}, achievements: [], streak: 0, bestStreak: 0 };
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return value && typeof value === "object" ? { ...fallback, ...value } : fallback;
  } catch { return fallback; }
}

function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* optional persistence */ }
}

function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 2200);
}

function render() {
  if (screen === "home") renderHome();
  else if (screen === "level") renderLevel();
  else if (screen === "achievements") renderAchievements();
  else if (screen === "hand") renderHand();
  app.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function levelNumber() {
  return Math.min(LEVELS.length, 1 + progress.completed.length);
}

function hud() {
  const nextXp = 100;
  return `<section class="hud" aria-label="Player progress">
    <div><span>Level</span><strong>${levelNumber()}</strong></div>
    <div><span>XP</span><strong>${progress.xp}</strong></div>
    <div><span>Lessons</span><strong>${progress.completed.length}/${LEVELS.length}</strong></div>
    <div><span>Best streak</span><strong>${progress.bestStreak}</strong></div>
  </section><div class="progress"><span style="width:${Math.min(100, progress.xp % nextXp)}%"></span></div>`;
}

function renderHome() {
  const chars = window.ROUNDHOUSE_CHARACTERS.slice(0, 4);
  app.innerHTML = `
    <p class="eyebrow">The Roundhouse Card Academy</p>
    <h1>Euchre at the Roundhouse</h1>
    <p class="lede">Learn Euchre in tiny missions. Meet trump, the bowers and the mighty Benny, earn stars, unlock achievements, then sit down against three Roundhouse players.</p>
    ${hud()}
    <div class="portrait-strip">${chars.map(c => `<img src="../poison/${c.image}" alt="${c.name}">`).join("")}</div>
    <div class="actions">
      <button data-action="continue">${progress.completed.length ? "Continue academy" : "Start learning"}</button>
      <button class="secondary" data-action="achievements">Achievements</button>
    </div>
    <section class="level-grid">${LEVELS.map(levelCard).join("")}</section>
    <p class="mini-rule">Roundhouse rules: 4 players, cards 9 through Ace, the Joker is the Benny, and the jacks become the right and left bowers when trump is chosen.</p>`;
  app.querySelector('[data-action="continue"]').onclick = () => openLevel(Math.min(LEVELS.length, progress.completed.length + 1));
  app.querySelector('[data-action="achievements"]').onclick = () => { screen = "achievements"; render(); };
  app.querySelectorAll("[data-level]").forEach(btn => btn.onclick = () => openLevel(Number(btn.dataset.level)));
}

function levelCard(level) {
  const unlocked = level.id <= progress.completed.length + 1;
  const complete = progress.completed.includes(level.id);
  const stars = progress.stars[level.id] || 0;
  return `<button class="level-card ${unlocked ? "unlocked" : "locked"} ${complete ? "completed" : ""}" data-level="${level.id}" ${unlocked ? "" : "disabled"}>
    <span class="badge">Mission ${level.id}</span>
    <h3>${level.title}</h3><p>${level.subtitle}</p>
    <div class="stars">${complete ? "★".repeat(stars) + "☆".repeat(3 - stars) : unlocked ? "Ready" : "Locked"}</div>
  </button>`;
}

function openLevel(id) {
  currentLevel = id;
  lessonState = { attempts: 0, correct: 0, answered: false };
  if (LEVELS[id - 1].kind === "full") { startFullHand(); return; }
  screen = "level";
  render();
}

function renderLevel() {
  const level = LEVELS[currentLevel - 1];
  const content = lessonContent(level.kind);
  app.innerHTML = `<div class="lesson"><p class="eyebrow">Mission ${level.id} of ${LEVELS.length}</p><h1>${level.title}</h1><p class="lede">${level.subtitle}</p>${content}<div class="actions"><button class="ghost" data-home>Back to academy</button></div></div>`;
  app.querySelector("[data-home]").onclick = () => { screen = "home"; render(); };
  bindLesson(level.kind);
}

function lessonContent(kind) {
  const cards = {
    nine: cardHtml({ rank: "9", suit: "♣" }),
    ace: cardHtml({ rank: "A", suit: "♠" }),
    jackH: cardHtml({ rank: "J", suit: "♥" }),
    jackD: cardHtml({ rank: "J", suit: "♦" }),
    joker: cardHtml({ rank: "B", suit: "★", joker: true })
  };
  if (kind === "pack") return quiz("Euchre uses a small, quick deck. Which cards belong in our Roundhouse pack?", ["2 through Ace", "9 through Ace plus the Joker", "Only picture cards"], 1, `<div class="card-row">${cards.nine}${cards.ace}${cards.joker}</div><p class="tip">That gives us 25 cards: six ranks in each suit, plus the Benny.</p>`);
  if (kind === "trump") return quiz("Hearts are trump. Which card wins this little trick?", ["A♣", "9♥", "K♣"], 1, `<p class="tip">Any trump beats any non-trump card.</p>`);
  if (kind === "right") return quiz("Clubs are trump. Which ordinary card is strongest?", ["A♣", "J♣", "J♠"], 1, `<div class="lesson-box"><strong>Right Bower:</strong> the Jack of the trump suit. It beats every card except the Benny.</div>`);
  if (kind === "left") return quiz("Hearts are trump. What suit does J♦ count as?", ["Diamonds", "Hearts", "Either one"], 1, `<div class="card-row">${cards.jackH}${cards.jackD}</div><p class="tip">The Jack of the same-colour suit becomes the Left Bower and counts as trump.</p>`);
  if (kind === "benny") return quiz("What beats the Right Bower in Roundhouse Euchre?", ["Ace of trump", "The Benny (Joker)", "Nothing"], 1, `<div class="card-row">${cards.joker}</div><p class="tip">Our Benny is the Joker and is the top trump card.</p>`);
  if (kind === "follow") return quiz("Clubs were led. You hold 9♣, A♥ and K♠. Which card must you play?", ["9♣", "A♥", "K♠"], 0, `<p class="tip">If you can follow the led suit, you must. Remember: a Left Bower counts as trump, not its printed suit.</p>`);
  if (kind === "winner") return quiz("Spades are trump. The trick is A♥, K♥, 9♠, A♣. Who wins?", ["A♥", "9♠", "A♣"], 1, `<p class="tip">The little 9♠ wins because trump beats every off-suit card.</p>`);
  if (kind === "tactics") return quiz("Your partner is already winning with A♣. You have 9♣ and J♥, with Hearts trump. What is usually smarter?", ["Play J♥ trump", "Follow with 9♣ and save the trump", "Throw any card"], 1, `<p class="tip">Don't spend a powerful trump when your partner already has the trick.</p>`);
  if (kind === "call") return quiz("Your hand has J♥, J♦, A♥, K♥, 9♣. Which trump call looks strongest?", ["Hearts", "Clubs", "Spades"], 0, `<p class="tip">Calling Hearts gives you the Right Bower, Left Bower, Ace and King of trump—a monster hand.</p>`);
  if (kind === "mini") return `<div class="lesson-box"><h2>Three-trick challenge</h2><p>Trump is ♥. Win at least two of these choices.</p><div id="mini-game"></div></div>`;
  return "";
}

function quiz(question, options, correctIndex, extra) {
  return `${extra}<section class="question"><h2>${question}</h2><div class="answers">${options.map((o, i) => `<button class="answer" data-answer="${i}">${o}</button>`).join("")}</div><div id="feedback"></div></section>`;
}

function bindLesson(kind) {
  if (kind === "mini") { startMiniMission(); return; }
  app.querySelectorAll("[data-answer]").forEach(btn => btn.onclick = () => answerQuiz(Number(btn.dataset.answer), lessonCorrectIndex(kind)));
}

function lessonCorrectIndex(kind) {
  return { pack:1, trump:1, right:1, left:1, benny:1, follow:0, winner:1, tactics:1, call:0 }[kind];
}

function answerQuiz(index, correctIndex) {
  if (lessonState.answered) return;
  lessonState.attempts += 1;
  const good = index === correctIndex;
  if (!good) {
    progress.streak = 0;
    const feedback = app.querySelector("#feedback");
    feedback.innerHTML = `<p class="feedback">Not quite. Try again—there's no penalty.</p>`;
    showToast("Try another answer");
    saveProgress();
    return;
  }
  lessonState.answered = true;
  progress.streak += 1;
  progress.bestStreak = Math.max(progress.bestStreak, progress.streak);
  if (progress.streak >= 3) unlockAchievement("streak");
  app.querySelectorAll("[data-answer]").forEach((b, i) => { b.disabled = true; if (i === correctIndex) b.classList.add("correct"); });
  app.querySelector("#feedback").innerHTML = `<p class="feedback">Correct! Nice work.</p><div class="actions"><button data-complete>Mission complete</button></div>`;
  app.querySelector("[data-complete]").onclick = completeCurrentLevel;
  saveProgress();
}

function completeCurrentLevel(starsOverride) {
  const level = LEVELS[currentLevel - 1];
  if (!progress.completed.includes(level.id)) {
    progress.completed.push(level.id);
    progress.xp += level.xp;
  }
  const stars = starsOverride || (lessonState.attempts <= 1 ? 3 : lessonState.attempts <= 2 ? 2 : 1);
  progress.stars[level.id] = Math.max(progress.stars[level.id] || 0, stars);
  if (level.id === 1) unlockAchievement("first");
  if (progress.completed.includes(3) && progress.completed.includes(4)) unlockAchievement("bower");
  if (level.kind === "mini") unlockAchievement("mini");
  saveProgress();
  showToast(`Mission complete · +${level.xp} XP`);
  screen = "home";
  render();
}

function unlockAchievement(id) {
  if (progress.achievements.includes(id)) return;
  progress.achievements.push(id);
  saveProgress();
  const achievement = ACHIEVEMENTS.find(a => a.id === id);
  if (achievement) showToast(`Achievement: ${achievement.title}`);
}

function renderAchievements() {
  app.innerHTML = `<p class="eyebrow">Trophy cabinet</p><h1>Achievements</h1>${hud()}<section class="achievement-grid">${ACHIEVEMENTS.map(a => `<article class="achievement ${progress.achievements.includes(a.id) ? "unlocked" : "locked"}"><div class="icon">${a.icon}</div><h3>${a.title}</h3><p>${a.text}</p><span class="badge">${progress.achievements.includes(a.id) ? "Unlocked" : "Locked"}</span></article>`).join("")}</section><div class="actions"><button data-home>Back</button></div>`;
  app.querySelector("[data-home]").onclick = () => { screen = "home"; render(); };
}

function startMiniMission() {
  const rounds = [
    { lead: {rank:"A",suit:"♣"}, hand:[{rank:"9",suit:"♣"},{rank:"J",suit:"♥"}], correct:0, text:"Partner is winning with A♣." },
    { lead: {rank:"K",suit:"♠"}, hand:[{rank:"9",suit:"♥"},{rank:"A",suit:"♦"}], correct:0, text:"You cannot follow Spades." },
    { lead: {rank:"A",suit:"♦"}, hand:[{rank:"J",suit:"♦"},{rank:"Q",suit:"♣"}], correct:1, text:"Hearts are trump, so J♦ is the Left Bower and counts as Hearts—you cannot follow Diamonds with it." }
  ];
  lessonState.mini = { index:0, wins:0, rounds };
  renderMiniRound();
}

function renderMiniRound() {
  const box = app.querySelector("#mini-game");
  const s = lessonState.mini;
  if (s.index >= s.rounds.length) {
    box.innerHTML = `<h2>${s.wins >= 2 ? "Challenge passed!" : "Almost there!"}</h2><p>You won ${s.wins}/3 decisions.</p><div class="actions"><button data-mini-end>${s.wins >= 2 ? "Complete mission" : "Try again"}</button></div>`;
    box.querySelector("[data-mini-end]").onclick = () => s.wins >= 2 ? completeCurrentLevel(s.wins === 3 ? 3 : 2) : startMiniMission();
    return;
  }
  const r = s.rounds[s.index];
  box.innerHTML = `<p><strong>Decision ${s.index + 1}/3.</strong> ${r.text}</p><p>Led card:</p><div class="card-row">${cardHtml(r.lead)}</div><p>Your choices:</p><div class="hand">${r.hand.map((c,i)=>`<button class="playing-card-wrap" data-mini="${i}" style="background:none;border:0;padding:0;min-height:0">${cardHtml(c)}</button>`).join("")}</div>`;
  box.querySelectorAll("[data-mini]").forEach(btn => btn.onclick = () => {
    if (Number(btn.dataset.mini) === r.correct) { s.wins += 1; progress.streak += 1; } else { progress.streak = 0; }
    s.index += 1; saveProgress(); renderMiniRound();
  });
}

function cardHtml(card, trump = null) {
  const isRed = RED.has(card.suit);
  const face = ["J","Q","K"].includes(card.rank);
  const joker = card.joker || card.rank === "B";
  let portrait = "";
  if (face) {
    const suitIndex = SUITS.indexOf(card.suit);
    const id = FACE_PORTRAITS[card.rank][Math.max(0, suitIndex)];
    const ch = window.ROUNDHOUSE_CHARACTERS.find(c => c.id === id);
    if (ch) portrait = `<img src="../poison/${ch.image}" alt="${ch.name}">`;
  }
  return `<div class="playing-card ${isRed ? "red" : ""} ${face ? "face" : ""} ${joker ? "joker" : ""}"><span class="corner">${joker ? "B" : card.rank}${joker ? "" : card.suit}</span>${portrait}<span class="suit">${joker ? "★" : card.suit}</span></div>`;
}

function createDeck() {
  const deck = [];
  SUITS.forEach(suit => RANKS.forEach(rank => deck.push({ rank, suit, id: `${rank}${suit}` })));
  deck.push({ rank:"B", suit:"★", joker:true, id:"B" });
  return shuffle(deck);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

function sameColourSuit(suit) {
  return suit === "♥" ? "♦" : suit === "♦" ? "♥" : suit === "♠" ? "♣" : "♠";
}
function effectiveSuit(card, trump) {
  if (card.joker) return trump;
  if (card.rank === "J" && card.suit === sameColourSuit(trump)) return trump;
  return card.suit;
}
function cardPower(card, trump, ledSuit) {
  if (card.joker) return 100;
  if (card.rank === "J" && card.suit === trump) return 99;
  if (card.rank === "J" && card.suit === sameColourSuit(trump)) return 98;
  const rankPower = {"9":1,"10":2,"J":3,"Q":4,"K":5,"A":6}[card.rank];
  const suit = effectiveSuit(card, trump);
  if (suit === trump) return 80 + rankPower;
  if (suit === ledSuit) return 40 + rankPower;
  return rankPower;
}
function legalCards(hand, trump, ledSuit) {
  if (!ledSuit) return hand;
  const followers = hand.filter(c => effectiveSuit(c, trump) === ledSuit);
  return followers.length ? followers : hand;
}
function trickWinner(plays, trump) {
  const ledSuit = effectiveSuit(plays[0].card, trump);
  return plays.reduce((best, play) => cardPower(play.card, trump, ledSuit) > cardPower(best.card, trump, ledSuit) ? play : best);
}

function startFullHand() {
  currentLevel = 11;
  const deck = createDeck();
  const players = window.ROUNDHOUSE_CHARACTERS.slice(0,4).map((c,i)=>({ id:i, name:i===0?"You":c.name, character:c, hand:[], tricks:0 }));
  for (let r=0;r<5;r++) for (let p=0;p<4;p++) players[p].hand.push(deck.pop());
  const suggested = chooseTrump(players[0].hand);
  handState = { players, dealer:3, leader:0, trump:suggested, trick:[], trickNo:1, message:`Trump is ${suggested}. Win as many tricks as you can.`, finished:false, yourTurn:true };
  screen = "hand";
  render();
}

function chooseTrump(hand) {
  return SUITS.map(suit => ({ suit, score: hand.reduce((sum,c)=>sum+Math.max(0,cardPower(c,suit,suit)-70),0) })).sort((a,b)=>b.score-a.score)[0].suit;
}

function renderHand() {
  const s = handState;
  const you = s.players[0];
  const legal = s.trick.length ? legalCards(you.hand, s.trump, effectiveSuit(s.trick[0].card, s.trump)) : you.hand;
  app.innerHTML = `<p class="eyebrow">Mission 11 · Full hand</p><h1>The Roundhouse Table</h1><div class="score-banner">Trump: <strong>${s.trump}</strong> · Trick ${Math.min(5,s.trickNo)}/5 · Your tricks: ${you.tricks}</div><p class="lede">${s.message}</p><section class="table"><div class="trick-grid">${s.players.map(p=>seatHtml(p,s.trick.find(x=>x.player===p.id))).join("")}</div></section>${s.finished ? endHandHtml() : `<h2>Your hand</h2><div class="hand">${you.hand.map(c=>`<button class="playing-card-wrap" data-card="${c.id}" ${legal.includes(c)&&s.yourTurn?"":"disabled"} style="background:none;border:0;padding:0;min-height:0">${cardHtml(c,s.trump)}</button>`).join("")}</div><p class="tip">${s.yourTurn ? "Choose a legal card. If you can follow suit, you must." : "The other players are thinking…"}</p>`}<div class="actions"><button class="ghost" data-home>Back to academy</button></div>`;
  app.querySelector("[data-home]").onclick = () => { screen="home"; render(); };
  app.querySelectorAll("[data-card]").forEach(btn => btn.onclick = () => playHuman(btn.dataset.card));
  const done = app.querySelector("[data-finish-hand]"); if (done) done.onclick = () => { unlockAchievement("table"); completeCurrentLevel(you.tricks >= 3 ? 3 : you.tricks >= 2 ? 2 : 1); };
}

function seatHtml(player, play) {
  return `<article class="seat ${player.id===0?"you":""}"><img src="../poison/${player.character.image}" alt="${player.character.name}"><strong>${player.name}</strong><div>${play ? cardHtml(play.card,handState.trump) : `<span class="mini-rule">${player.hand.length} cards</span>`}</div><span>Tricks: ${player.tricks}</span></article>`;
}

function playHuman(id) {
  const s = handState;
  const you = s.players[0];
  const card = you.hand.find(c=>c.id===id);
  if (!card || !s.yourTurn) return;
  const led = s.trick.length ? effectiveSuit(s.trick[0].card,s.trump) : null;
  if (!legalCards(you.hand,s.trump,led).includes(card)) { showToast("You must follow suit if you can."); return; }
  you.hand = you.hand.filter(c=>c!==card);
  s.trick.push({player:0,card});
  s.yourTurn=false;
  playAIs();
}

function playAIs() {
  const s = handState;
  [1,2,3].forEach(id => {
    const p=s.players[id];
    const led=s.trick.length?effectiveSuit(s.trick[0].card,s.trump):null;
    const legal=legalCards(p.hand,s.trump,led);
    const partnerWinning = s.trick.length >= 2 && trickWinner(s.trick,s.trump).player === ((id+2)%4);
    const choice = chooseAiCard(legal,s.trump,led,partnerWinning);
    p.hand=p.hand.filter(c=>c!==choice);
    s.trick.push({player:id,card:choice});
  });
  const winner=trickWinner(s.trick,s.trump);
  s.players[winner.player].tricks += 1;
  s.message = `${s.players[winner.player].name} wins the trick.`;
  render();
  window.setTimeout(()=>{
    if (s.trickNo >= 5) { s.finished=true; s.message = s.players[0].tricks >= 3 ? "You won the hand!" : "Hand complete. Every trick teaches you something."; render(); return; }
    s.trickNo += 1; s.trick=[]; s.leader=winner.player;
    // Tutorial hand keeps the human leading each new trick so interaction stays simple.
    s.yourTurn=true; s.message=`Trick ${s.trickNo}: choose your lead.`; render();
  },700);
}

function chooseAiCard(legal,trump,led,partnerWinning) {
  const sorted=[...legal].sort((a,b)=>cardPower(a,trump,led)-cardPower(b,trump,led));
  if (partnerWinning) return sorted[0];
  return sorted[sorted.length-1];
}

function endHandHtml() {
  const tricks=handState.players[0].tricks;
  return `<section class="lesson-box"><h2>${tricks>=3?"Hand won!":"Hand complete"}</h2><p>You took <strong>${tricks}</strong> of 5 tricks.</p><p>${tricks>=3?"Excellent—you are ready for a real table.":"You finished a whole Euchre hand. Replay it and try to spot when to save trump."}</p><div class="actions"><button data-finish-hand>Claim rewards</button></div></section>`;
}

render();
