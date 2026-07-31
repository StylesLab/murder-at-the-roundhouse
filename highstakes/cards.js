"use strict";

window.HIGH_STAKES_CARDS = {
  suits: {
    spades: { symbol: "♠", name: "Influence", hint: "Pressure witnesses and win confrontations." },
    hearts: { symbol: "♥", name: "Trust", hint: "Gain confidence and reduce suspicion." },
    diamonds: { symbol: "♦", name: "Wealth", hint: "Bribe servants and buy information." },
    clubs: { symbol: "♣", name: "Evidence", hint: "Discover clues and strengthen accusations." }
  },
  valueLabel(value) {
    return ({ 1: "Ace", 11: "Jack", 12: "Queen", 13: "King" })[value] || String(value);
  },
  score(value) {
    const parsed = Number(value);
    return parsed === 1 ? 14 : parsed;
  }
};
