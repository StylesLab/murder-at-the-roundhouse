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
    phase: "selection", selectedIds: [...selectedIds], poisonerExcludedIds: [], players: [], roleRevealIndex: 0,
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
  img.src = image;
  img.alt = `Portrait of ${name}`;
  img.className = className;
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
  node.type = "button";
  node.addEventListener("click", handler);
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
  message.textContent = text;
  message.hidden = false;
  window.setTimeout(() => { message.hidden = true; }, 2800);
}

function actions(...buttons) {
  const box = el("div", "actions");
  box.append(...buttons);
  return box;
}
