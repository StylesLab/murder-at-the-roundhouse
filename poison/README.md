# Poison at the Roundhouse

An offline, moderator-free social-deduction game for exactly four people sharing one device. One guest is the Poisoner, one is the Doctor, and two are Guests. Five dinner courses of secret actions, drinking choices, public evidence, and discussion end in a private accusation vote.

## Run offline

Open `index.html` directly in a modern browser. No installation, build, internet connection, npm, API, storage, or web server is required.

The folder is fully self-contained. Open it in place or move the entire `PoisonAtTheRoundhouse` directory anywhere; all character portraits and course illustrations are stored under `assets/`.

## Files

- `index.html` — semantic page shell
- `styles.css` — responsive Art Deco presentation and accessibility rules
- `characters.js` — browser-readable character names, short profiles, and portrait paths
- `game.js` — state, randomisation, rules, rendering, privacy flow, voting, and debug tools
- `assets/portraits/` — local copies of the 18 canonical Murder at the Roundhouse portraits
- `assets/courses/` — five optimized Art Deco course illustrations
- `README.md` — operation, maintenance, and testing notes

## Character data and portraits

The 18 names and profiles are based on `MATR.Game/Engine/Model/Character.cs`. Profiles were shortened without changing their substance. The canonical portraits were copied from `MATR.Game/wwwroot` into `assets/portraits`; the originals remain unchanged. The normal Felix D’Arcy portrait (`12.png`) is used rather than the December-only `12x` variant, making the offline roster stable year-round.

To add or remove a character, edit `ROUNDHOUSE_CHARACTERS` in `characters.js` and place the referenced portrait in `assets/portraits`. The game supports the complete current `GenerateAll()` roster; regardless of roster size, exactly four unique characters must be seated.

## Rules

Each player publicly chooses a unique character, then privately learns a shuffled role. Every course:

1. All four players take private turns in a random order: the Poisoner chooses a glass to poison or no poison, the Doctor protects one character, and Guests receive a quick neutral acknowledgement with no mechanical action. Everyone receives neutral handover wording, so turn order reveals no role.
2. All four players privately choose a glass in a new, independently randomised order. One randomly selected Guest receives a secret switch ability and may exchange their chosen drink with another player, or decline. The exchange occurs only after all choices are sealed.
3. Everyone starts with two health. Drinking from the poisoned glass after any switch costs one health unless the Doctor protected that character.
4. After drinking, all four players receive neutral private-report handovers in random order. Only the Doctor’s report reveals whether their intervention prevented damage, so the report sequence cannot expose the Doctor.
5. A character at zero health is critically ill but remains fully involved in private actions, drinking choices, discussion, and voting.
6. If two non-Poisoners become critically ill, the Poisoner wins immediately. Otherwise, deduction-safe public results and consistent physical evidence are shown, followed by an open-ended discussion.

After five courses, each player privately accuses another character. The Poisoner must have caused at least one unprotected health loss to a non-Poisoner to be eligible to win; their private action screen reminds them until this requirement is met. Harming only themselves does not qualify. If the requirement is not met, the guests win automatically. Otherwise, three or four votes for the Poisoner gives the non-Poisoners the win; with two or fewer votes, the Poisoner wins. The final screen reveals every role, vote, choice, protection, action, poison decision, and outcome.

## Configuration and testing mode

Change `COURSE_NAMES` near the top of `game.js` to rename, add, or remove courses. The number of courses is derived from that array.

Open `index.html?debug=true` to show a testing panel. Debug mode reveals roles and internal state, allows pass screens to be skipped, provides phase shortcuts, permits self-voting, and can restart the active course. Debug output goes only to the panel; normal mode does not log secrets.

When opened from `file://`, browsers may show a generic reload confirmation during an active game. The game intentionally uses ordinary script files and direct local image paths rather than modules or `fetch`, avoiding common local-file security restrictions.

## Manual test checklist

- [ ] Select four unique characters; duplicates and fewer than four cannot start.
- [ ] Confirm exactly one Poisoner, one Doctor, and two Guests in debug mode.
- [ ] Confirm every secret view is covered by a named handover screen.
- [ ] Choose each poison option, including no poison.
- [ ] Protect every player, including the Doctor.
- [ ] Let all four players choose glasses; let several choose the same glass.
- [ ] Cause multiple poisonings and verify protection affects only the protected player.
- [ ] Verify no poison gives a valid, non-contradictory result.
- [ ] Complete all five courses.
- [ ] Cast four private votes; verify self-voting is blocked outside debug mode.
- [ ] Verify three votes exposes the Poisoner and two votes lets them escape.
- [ ] Compare the final timeline with debug state for every hidden action.
- [ ] Replay with the same characters and confirm roles are reshuffled.
- [ ] Open `index.html` directly from the filesystem with network access disabled.
- [ ] Test at 360 CSS pixels wide and in mobile landscape.
- [ ] Complete a game using only Tab, Shift+Tab, Enter, and Space.
- [ ] Enable reduced motion at operating-system level and verify no essential effect depends on motion.
- [ ] Confirm normal mode has no debug panel and emits no secret console output.
