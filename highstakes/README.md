# High Stakes at the Roundhouse

A four-player, single-device mystery game played with one standard 52-card deck.

## Setup

1. Open `highstakes/index.html` through the project web server.
2. Deal five cards to each player.
3. Enter four player names and privately reveal the assigned Roundhouse characters.
4. Keep all physical cards hidden from the phone and the other players.

## Play

The game runs for five investigations. During each investigation every player secretly commits one physical card and records its suit and value on the device.

- Spades represent **Influence**.
- Hearts represent **Trust**.
- Diamonds represent **Wealth**.
- Clubs represent **Evidence**.
- Aces are high.
- Character abilities add two points to one suit.

The highest card leads the scene. Playing the investigation's matching suit can reveal its clue and reduce suspicion. Dominating a scene without producing the relevant evidence increases suspicion.

After five investigations the group discusses the reconstructed night and makes one final accusation. The game determines the murderer from the players' accumulated behaviour, so the culprit is shaped by the cards played rather than assigned at setup.

## Design notes

The game references `poison/characters.js` and the existing portrait assets rather than duplicating them. All other High Stakes files are self-contained inside this folder.
