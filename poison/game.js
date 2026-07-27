"use strict";

(() => {
  const PLAYER_COUNT = 4;
  const COURSE_NAMES = ["Aperitif", "Soup", "Fish", "Main Course", "Dessert"];
  const COURSE_IMAGES = {
    "Aperitif": "assets/courses/aperitif.webp",
    "Soup": "assets/courses/soup.webp",
    "Fish": "assets/courses/fish.webp",
    "Main Course": "assets/courses/main-course.webp",
    "Dessert": "assets/courses/dessert.webp"
  };
  const GLASSES = [
    { id: "goblet", name: "Crystal Goblet", icon: "♕" },
    { id: "chalice", name: "Silver Chalice", icon: "♜" },
    { id: "tumbler", name: "Cut-Glass Tumbler", icon: "▥" },
    { id: "coupe", name: "Champagne Coupe", icon: "♢" }
  ];
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
  const glassById = id => GLASSES.find(glass => glass.id === id);
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
  function lockTransition(fn) {
    if (state.transitionLocked) return;
    state.transitionLocked = true;
    fn();
    window.setTimeout(() => { state.transitionLocked = false; }, 250);
  }

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
      Poisoner: "Each course, secretly poison one glass—or choose no poison.",
      Doctor: "Each course, secretly protect one guest, including yourself. Your choice can prevent that guest from losing health.",
      Guest: "Observe, discuss, and identify the Poisoner. During some courses, you may secretly receive the ability to switch drinks."
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
    const guests = state.players.filter(player => player.role === "Guest");
    state.current = {
      name: COURSE_NAMES[state.courseIndex],
      poisonedGlass: null,
      protectionTarget: null,
      switcherId: shuffle(guests)[0].id,
      switchTarget: null,
      drinks: {},
      originalDrinks: {},
      switchApplied: false,
      results: []
    };
    const root = document.createDocumentFragment();
    root.append(titleBlock(`Course ${state.courseIndex + 1} of ${COURSE_NAMES.length}`, state.current.name,
      "Every guest takes a private action in a random order. Afterward, everyone secretly chooses a glass in a fresh random order."));
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
    if (state.actionIndex >= state.actionQueue.length) {
      beginDrinkingRound();
      return;
    }
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
    root.append(titleBlock(player.name, "Choose a glass to poison", "You act before anyone chooses a drink. You may poison no glass."));
    if (!poisonerHasQualified()) {
      root.append(el("p", "status warning",
        "Victory requirement not yet met: you must cause at least one non-Poisoner to lose unprotected health before dinner ends."));
    }
    const choices = glassChoices(true);
    root.append(choices, actions(button("Seal my choice", () => {
      if (state.pending.poison === undefined) { showMessage("Choose a poison decision."); return; }
      state.current.poisonedGlass = state.pending.poison;
      finishPrivateAction();
    })));
    setScreen(root);
  }
  function glassChoices(includeNoPoison = false) {
    const grid = el("div", "choices");
    const options = includeNoPoison ? [...GLASSES, { id: null, name: "No poison this course", icon: "∅" }] : GLASSES;
    options.forEach(glass => {
      const chosen = state.pending.poison === glass.id;
      const choice = button("", () => { state.pending.poison = glass.id; renderPoisonerAction(state.players.find(p => p.role === "Poisoner")); }, `choice${chosen ? " selected" : ""}`);
      choice.setAttribute("aria-pressed", String(chosen));
      choice.append(el("span", "glass-icon", glass.icon), el("span", "glass-name", glass.name));
      grid.append(choice);
    });
    return grid;
  }
  function renderDoctorAction(player) {
    const root = document.createDocumentFragment();
    root.append(titleBlock(player.name, "Choose someone to protect", "You may protect yourself. Your intervention stays secret."));
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
      "You have no special action this course. Observe carefully and keep your role private."));
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
  function beginDrinkingRound() {
    state.phase = "drinking";
    state.actionQueue = shuffle(state.players.map(player => player.id));
    state.actionIndex = 0;
    beginDrinkTurn();
  }
  function beginDrinkTurn() {
    if (state.actionIndex >= state.actionQueue.length) {
      applyDrinkSwitch();
      resolveCourse();
      return;
    }
    const player = playerById(state.actionQueue[state.actionIndex]);
    showPassScreen(player, `${state.current.name}: choose your drink`, () => renderDrinkAction(player));
  }
  function renderDrinkAction(player) {
    const root = document.createDocumentFragment();
    root.append(titleBlock(player.name, "Choose your glass", "Your choice is private. Other guests may choose the same glass."));
    const grid = el("div", "choices");
    GLASSES.forEach(glass => {
      const choice = button("", () => {
        state.pending.drink = glass.id;
        grid.querySelectorAll("button").forEach(b => { const on = b.dataset.id === glass.id; b.classList.toggle("selected", on); b.setAttribute("aria-pressed", String(on)); });
      }, "choice");
      choice.dataset.id = glass.id; choice.setAttribute("aria-pressed", "false");
      choice.append(el("span", "glass-icon", glass.icon), el("span", "glass-name", glass.name)); grid.append(choice);
    });
    root.append(grid);
    if (player.id === state.current.switcherId) root.append(renderSwitchChoices(player));
    root.append(actions(button("Seal my choice", () => {
      if (!state.pending.drink) { showMessage("Choose a glass before continuing."); return; }
      if (player.id === state.current.switcherId && state.pending.swap === undefined) {
        showMessage("Choose someone to switch with, or choose no switch."); return;
      }
      state.current.drinks[player.id] = state.pending.drink;
      if (player.id === state.current.switcherId) state.current.switchTarget = state.pending.swap;
      state.pending = {}; state.actionIndex += 1; beginDrinkTurn();
    })));
    setScreen(root);
  }
  function renderSwitchChoices(player) {
    const section = el("section", "");
    section.append(el("h3", "", "Your secret switch ability"),
      el("p", "status", "After every glass is chosen, you may exchange your drink with another player without seeing their choice."));
    const grid = el("div", "choices people");
    const options = state.players.filter(person => person.id !== player.id);
    options.forEach(person => {
      const choice = button("", () => selectSwitchOption(grid, person.id), "person-choice");
      choice.dataset.id = person.id; choice.setAttribute("aria-pressed", "false");
      choice.append(safeImage(person.image, person.name), el("span", "", `Switch with ${person.name}`)); grid.append(choice);
    });
    const decline = button("Do not switch this course", () => selectSwitchOption(grid, null), "choice");
    decline.dataset.id = "none"; decline.setAttribute("aria-pressed", "false"); grid.append(decline);
    section.append(grid);
    return section;
  }
  function selectSwitchOption(grid, targetId) {
    state.pending.swap = targetId;
    grid.querySelectorAll("button").forEach(choice => {
      const selected = targetId === null ? choice.dataset.id === "none" : choice.dataset.id === targetId;
      choice.classList.toggle("selected", selected);
      choice.setAttribute("aria-pressed", String(selected));
    });
  }
  function applyDrinkSwitch() {
    if (state.current.switchApplied) return;
    state.current.originalDrinks = { ...state.current.drinks };
    if (state.current.switchTarget !== null) {
      const switcherId = state.current.switcherId;
      const targetId = state.current.switchTarget;
      [state.current.drinks[switcherId], state.current.drinks[targetId]] =
        [state.current.drinks[targetId], state.current.drinks[switcherId]];
    }
    state.current.switchApplied = true;
  }

  function resolveCourse() {
    const poisoned = state.current.poisonedGlass;
    state.players.forEach(player => {
      if (poisoned !== null && state.current.drinks[player.id] === poisoned) {
        const protectedByDoctor = state.current.protectionTarget === player.id;
        if (!protectedByDoctor) player.health = Math.max(0, player.health - 1);
        state.current.results.push({ playerId: player.id, protected: protectedByDoctor, healthAfter: player.health });
      }
    });
    state.current.healthAfter = Object.fromEntries(state.players.map(player => [player.id, player.health]));
    state.courses.push(JSON.parse(JSON.stringify(state.current)));
    state.immediatePoisonerWin = state.players.filter(player => player.role !== "Poisoner" && player.health === 0).length >= 2;
    state.actionQueue = shuffle(state.players.map(player => player.id));
    state.actionIndex = 0;
    beginPrivateReportTurn();
  }
  function beginPrivateReportTurn() {
    if (state.actionIndex >= state.actionQueue.length) {
      renderResolution();
      return;
    }
    const player = playerById(state.actionQueue[state.actionIndex]);
    showPassScreen(player, `${state.current.name}: private report`, () => renderPrivateReport(player));
  }
  function renderPrivateReport(player) {
    if (player.role !== "Doctor") {
      const switchMessage = player.id === state.current.switcherId && state.current.switchTarget !== null
        ? ` Your switch with ${playerById(state.current.switchTarget).name} was carried out.`
        : "";
      const root = document.createDocumentFragment();
      root.append(titleBlock(player.name, "Your private report",
        `You have ${player.health} health remaining.${switchMessage} Keep your role and glass secret unless you choose to make a claim.`),
        actions(button("Hide this report", finishPrivateReport)));
      setScreen(root);
      return;
    }
    const protectedIncident = state.current.results.find(result => result.playerId === state.current.protectionTarget && result.protected);
    const protectedPlayer = playerById(state.current.protectionTarget);
    const root = document.createDocumentFragment();
    root.append(titleBlock(player.name, protectedIncident ? "Your intervention succeeded" : "No antidote was needed",
      protectedIncident
        ? `You prevented ${protectedPlayer.name} from losing health this course. Keep that knowledge secret.`
        : `${protectedPlayer.name} did not drink from the poisoned glass—or no poison was used. Keep that knowledge secret.`),
      actions(button("Hide this report", finishPrivateReport)));
    setScreen(root);
  }
  function finishPrivateReport() {
    state.actionIndex += 1;
    beginPrivateReportTurn();
  }
  function publicResult(course) {
    if (course.results.length === 0) return "Nobody became ill during this course.";
    const protectedResults = course.results.filter(result => result.protected);
    const unprotected = course.results.filter(result => !result.protected);
    if (course.results.length === 1) {
      const player = playerById(course.results[0].playerId);
      return course.results[0].protected
        ? `${player.name} suddenly felt faint but recovered. The doctor’s intervention appears to have saved someone.`
        : `${player.name} was taken seriously ill and now has ${course.results[0].healthAfter} health remaining.`;
    }
    let text = `${course.results.length} guests became unwell after the ${course.name.toLowerCase()} course.`;
    if (protectedResults.length) text += ` The doctor’s intervention appears to have saved ${protectedResults.length === 1 ? "someone" : `${protectedResults.length} people`}.`;
    if (!unprotected.length) text += " Everyone recovered quickly.";
    else {
      const incapacitated = unprotected.filter(result => result.healthAfter === 0).map(result => playerById(result.playerId).name);
      if (incapacitated.length) text += ` ${incapacitated.join(" and ")} ${incapacitated.length === 1 ? "is" : "are"} now critically ill.`;
    }
    return text;
  }
  function evidenceFor(course) {
    if (course.poisonedGlass === null) return "No physical trace of poison was found.";
    if (course.results.length === 0) return "A bitter residue was discovered on one untouched glass.";
    if (course.results.length > 1) return "A faint almond scent lingered near several disturbed place settings.";
    return "One place setting appeared to have been disturbed.";
  }
  function renderResolution() {
    state.phase = "resolution";
    const root = document.createDocumentFragment();
    root.append(titleBlock(`Course ${state.courseIndex + 1}`, `${state.current.name}: the reckoning`, ""));
    const result = el("div", "result");
    result.append(el("p", "", publicResult(state.current)), el("p", "", evidenceFor(state.current)));
    root.append(result, renderHealthBoard(), actions(button(
      state.immediatePoisonerWin ? "Reveal the Poisoner’s victory" : "Open the drawing room for discussion",
      state.immediatePoisonerWin ? renderFinalReveal : renderDiscussion
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
  function renderDiscussion() {
    state.phase = "discussion";
    const root = document.createDocumentFragment();
    root.append(titleBlock(state.current.name, "Discussion", "Share claims and challenge alibis. Start the next course whenever the table is ready."));
    const portraits = el("div", "mini-portraits");
    state.players.forEach(p => portraits.append(safeImage(p.image, p.name)));
    const prompts = el("ul", "prompts");
    ["Which glass did you claim to drink from?", "Who behaved suspiciously?", "Why might the Doctor have chosen that person?", "Did anyone change their usual choice?"].forEach(p => prompts.append(el("li", "", p)));
    root.append(portraits, el("div", "result", publicResult(state.current)), actions(
      button(state.courseIndex === COURSE_NAMES.length - 1 ? "Begin accusations" : "Start the next course", () => {
        state.courseIndex += 1; beginCourse();
      })
    ), prompts);
    setScreen(root);
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
    const bluffs = state.courses.filter(c => c.poisonedGlass === null && c.results.length === 0).length;
    return { incidents, unprotected, misdirected, bluffs, total: incidents * 2 + unprotected * 3 + misdirected * 2 + bluffs };
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
    if (state.immediatePoisonerWin) {
      endingExplanation = "Two non-Poisoners became critically ill before the final accusation. The Poisoner wins immediately.";
    } else if (!qualifiedPoisoner) {
      endingExplanation = "The Poisoner caused no unprotected health loss during dinner, so the guests win automatically.";
    } else {
      endingExplanation = `${poisoner.name} received ${votesForPoisoner} accusation vote${votesForPoisoner === 1 ? "" : "s"}. Three were needed to expose the Poisoner.`;
    }
    root.append(titleBlock("The masks fall", investigatorsWin ? "The guests prevail" : state.immediatePoisonerWin ? "The Poisoner triumphs" : "The Poisoner escapes",
      endingExplanation));
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
      article.append(el("h3", "", `${index + 1}. ${course.name}`),
        el("p", "", `Poison: ${course.poisonedGlass === null ? "none" : glassById(course.poisonedGlass).name}. Doctor protected ${playerById(course.protectionTarget).name}.`),
        el("p", "", course.switchTarget === null
          ? `${playerById(course.switcherId).name} received the switch ability but declined to use it.`
          : `${playerById(course.switcherId).name} exchanged drinks with ${playerById(course.switchTarget).name}.`));
      const list = el("ul", "");
      state.players.forEach(p => {
        const incident = course.results.find(r => r.playerId === p.id);
        const outcome = incident ? (incident.protected ? "poisoned, but protected" : "poisoned and unprotected") : "not poisoned";
        const initialGlass = glassById(course.originalDrinks[p.id]).name;
        const finalGlass = glassById(course.drinks[p.id]).name;
        const glassSummary = initialGlass === finalGlass ? `chose and drank from the ${finalGlass}` : `chose the ${initialGlass} but received the ${finalGlass}`;
        list.append(el("li", "", `${p.name} ${glassSummary}; ${outcome}; ${course.healthAfter[p.id]} health remaining.`));
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
    else if (state.phase === "discussion") renderDiscussion();
    else if (state.phase === "resolution") renderResolution();
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
    if (state.phase === "course-intro") { beginPrivateActionRound(); return; }
    if (["resolution", "discussion"].includes(state.phase)) { state.courseIndex += 1; beginCourse(); return; }
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
})();
