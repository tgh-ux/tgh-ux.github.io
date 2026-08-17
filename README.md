# One Night Ultimate Werewolf — Narrator Companion

Github pages link: https://tgh-ux.github.io/

A browser-based companion app for running games of One Night Ultimate
Werewolf (and its various expansions). It walks the selected roles through
their night actions in order and generates a spoken narration script for
the moderator to read aloud, with the specific outcome of each action
randomized according to configurable weighted probabilities. Primary
localization is Swedish, with English as a secondary/partial translation.

This document is a map of the codebase, not a feature spec — read it to
find out *where* something lives and *how the pieces fit together*, then
dive into the relevant file's own header comment for the details.

## Module overview

The app is split into seven modules, each an IIFE exposing a small public
API (`const X = (() => { ... return {...}; })();`), loaded in dependency
order from `index.html`:

| Module | Responsibility |
|---|---|
| **`roles.js`** | Static registry of every role and token: their card art, min/max instance counts, prerequisites, team, active phase, and tags. Also the sole authority on player-count math (given a role selection, how many players does it support). Frozen after initialization — pure data + lookup helpers, no game state. |
| **`settings.js`** | The declarative settings tree that drives the settings UI: weighted-choice sliders, percentages, toggles, and plain numeric values (e.g. narration pause timing) that tune *how likely* — or, for numeric settings, *how long* — each possible outcome is. Owns persistence (`localStorage`), default values, and validation — including validating that weighted-choice groups always have a satisfiable outcome for the currently selected roles. |
| **`rules.js`** | The narration engine. Walks a fixed, declarative turn order and, for each role/team whose selection condition is met, produces a turn of *structured data* (no text) describing what happened — resolving randomized outcomes via per-role resolver functions and a shared weighted-random helper. Deliberately knows nothing about language. |
| **`interpreter.js`** | The bridge between `rules.js`'s structured turn data and `localization.js`'s template language. Exposes a small set of template primitives (`Identity`, `RoleName`, `If`, `Select`, `Input`, etc.) that localized strings use to pull in role names, grammatical forms, conditional text, and (in automatic/spoken-narration mode) interactive player-input prompts from a turn's data. Also isolates rendering errors per turn so one bad template can't break the whole script. |
| **`localization.js`** | All localized strings (Swedish primary, English secondary) plus the lightweight `{Key}` / `{Function:args}` template-resolution engine that both static UI text and dynamic narration are built from. |
| **`speech.js`** | The speech playback engine. Takes raw turns from the generated prompt, resolves each turn through `interpreter.js` immediately before playback, and walks the resulting text, pause, and input segments asynchronously. Owns the browser Web Speech API boundary, voice selection, pause/resume/stop state, inter-turn pacing, and interactive input waits; reports playback progress to the GUI through callbacks. It contains no presentation/UI code. |
| **`gui.js`** | Builds and maintains the DOM: role selection tiles, the settings panel (generated entirely from `settings.js`'s tree — no settings row is hand-coded), role/token description panels, the day timer, generated prompt display/navigation, and speech playback overlay/controls. Coordinates user interaction and presentation with the modules above; contains no game logic or speech-engine implementation of its own. |

`index.html` is a mostly static page skeleton — panel containers exist in
the markup, but their contents are populated at runtime by `gui.js`.

## Why this many layers?

It looks like a lot of indirection for "print a script," but the layering
is earning its keep given the actual scope: dozens of roles, each with its
own randomized behavior tunable via settings; bilingual narration that
needs correct Swedish grammar (definite/genitive/plural forms selected
dynamically based on *which* role a sentence is about); a settings UI
with enough sliders that hand-coding each one would be worse to maintain
than generating them from data; and spoken narration that has to pause for,
and react to, live player input mid-playback. Keeping `rules.js` free of
language and `localization.js` free of game logic is what makes the two
independently maintainable — a translator can add narration variants
without touching game logic, and a new role can be added without touching
localization plumbing (beyond adding its own strings).

## Program flow

### Startup (`gui.js: initGUI()`)
1. Load the persisted language and apply it (sprite sheets, `<html lang>`).
2. Load persisted role selection, day timer state, and settings from
   `localStorage`.
3. Adapt layout scale to the viewport.
4. Build the DOM: static text localization, collapsible panels, role/token
   selection & description tiles, settings tree, prompt navigation controls,
   and speech controls/overlay.
5. Wire up event listeners.
6. Run an initial full UI sync (see below).

### Selecting roles → generating the prompt
This is the main loop the app spends its time in, triggered any time a
role is selected/deselected (`gui.js: updateRolesUI()`):

1. **Sanitize** the current role selection — deselect anything whose
   prerequisites are no longer met (`Roles.isSelectable`), repeating until
   stable (deselecting one role can cascade into others).
2. **Validate settings** against the *current* role selection
   (`Settings.validate` → `Settings.filterRelevant`) — e.g. a setting that
   only matters when a Vampire is in play is ignored if none is selected,
   but flagged if one is.
3. If validation errors are relevant to the current selection, the prompt
   panel shows an error instead of narration and generation stops here.
4. Otherwise, **build the prompt**: `Rules.buildPrompt(roleCounts)` walks
   the turn order, producing structured turns (resolving any randomized
   outcomes along the way, using cached RNG so the result is stable until
   explicitly rerandomized).
5. **Render the prompt** (manual/text mode): `Interpreter.renderAll(turns)`
   resolves each turn's data against its localization template, producing
   the final narration text per turn.
6. The GUI stores both the raw turns and their rendered text in `promptState`.
   The rendered form is displayed in the prompt textarea (joined or
   single-turn-navigable), while the raw form remains available to `Speech` for
   narration. The new role selection is persisted.

### Playing narration aloud (`gui.js: speakPrompt()`)
Triggered by the speech-start button, using `promptState.rawTurns` from
the flow above:

1. `Interpreter.refreshPauseSettings()` snapshots the current pause-timing
   settings for this playback session — deliberately not re-read again
   until the next time playback starts, so a settings change mid-playback
   doesn't retime a session already underway.
2. The speech overlay opens, and `Speech.play(rawTurns, ...)` takes over:
   each turn is resolved through `Interpreter.resolveTurn(turn, { mode:
   "automatic" })` immediately before it plays, not batched upfront — so a
   value an earlier turn's player-input segment bound is already visible
   to every turn resolved after it.
3. `Speech` walks each turn's resulting text/pause/input segments,
   reporting progress back to `gui.js` via callbacks (`clbkSpeech*`),
   which update the overlay's spoken text, countdown, and — for an input
   segment — a set of tappable choice buttons.
4. Playback ends either when every turn finishes on its own, or via the
   overlay's stop button; either way the overlay resets and closes.

### Adjusting a setting
Editing a settings control (`gui.js`) writes the value via
`Settings.setValue`, then re-runs the same validate → build → render
pipeline as above (`updateSettingsUI()`), so the prompt and any validation
warnings stay in sync live as settings change.

### Language switch
Changing the language reloads the page rather than patching the DOM live
— simpler than re-localizing every already-built element in place.

## Where to look for...

- **Adding or changing a role's data** (art, prerequisites, team, tags) →
  `roles.js`, `ROLES`/`TOKENS`/`TAGS`/`ROLE_TEAMS`/`ROLE_PHASES`.
- **Adding or tuning a role's randomized behavior** → `rules.js`,
  `RESOLVERS` (the *how likely*) and `TURN_ORDER` (the *when/if*).
- **Adding a new tunable setting** → `settings.js`, `SETTINGS_TREE` — the
  settings UI, persistence, and validation all follow automatically from
  the declarative entry.
- **Wording/grammar for a role or turn** → `localization.js`,
  `LOCALIZATION_KEYS` — see its module header for the identity-key suffix
  convention (`_PLURAL`, `_DEFINITE`, `_GENITIVE`) used throughout.
- **A new template primitive for use inside localized strings** →
  `interpreter.js`, `PRIMITIVES`.
- **Spoken narration playback/pacing/voice selection** → `speech.js`.
- **Anything visual/interactive** → `gui.js`, organized into labeled
  sections (DOM construction, role/settings UI updates, game script &
  narration, day timer, printing, event listeners, initialization).

## Known limitations

- `rules.js`'s `RippleResolver` always keeps a "backup ripple" on hand for
  a live, table-side player-response event (see its header comment for
  why this can't be resolved in code). If every ripple effect *except*
  "none" is set to weight 0, that backup roll currently has nothing to
  fall back to and throws, even though `Settings.validate()` considers
  that configuration valid — flagged as a known issue in the resolver's
  comment, not yet fixed.
- `localization.js`'s `getString()` returns `null` (not `undefined`) if
  the current language has no loaded dictionary at all, but
  `_resolveTemplate`'s missing-key check only tests for `undefined` — so
  an invalid/unrecognized language could in theory let a literal `null`
  leak into narration text instead of triggering the normal missing-key
  error path. Documented in both functions' comments; not currently
  reachable through the UI (language is always one of the two selector
  options), not yet fixed.