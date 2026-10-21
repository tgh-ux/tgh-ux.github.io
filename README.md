# One Night Ultimate Werewolf — Narrator Companion

GitHub Pages link: https://tgh-ux.github.io/

A browser-based companion app for running games of One Night Ultimate
Werewolf (and its various expansions). It walks the selected roles through
their night actions in order and generates a narration script for the
moderator, with randomized outcomes controlled by configurable weighted
probabilities. Primary localization is Swedish, with English as a
secondary/partial translation.

This document is a map of the codebase, not a feature specification. Use it
to find where something lives and how the pieces fit together, then consult
the relevant source file's header and comments for implementation details.

**One Night Ultimate Werewolf** by **Bezier Games**, its expansions, and all
associated material is owned by their respective rights holders. This
project is neither associated with, nor approved by Bezier Games.

As no permission to use the original art work could be acquired, the icons
for characters, cards and tokens cannot be included in the repository. If
you wish to include your own, simply place sprite sheets in the "Sprites"
subfolder, named "roles.png" for characters, "tokens.png" for tokens, and
"cards_%LANGUAGE%.jpg" for cards, where the language code ("eng" / "swe")
replaces the placeholder for localized cards. Also see the CSS style sheet
and adjust the token/card/role-sprite values to suit the provided files.

## Module overview

The application consists of ten code modules. Nine are IIFEs that expose
small public APIs; `gui.js` is the top-level UI script. The scripts are loaded
from `index.html` in the order shown below.

| Module | Responsibility |
|---|---|
| **`localization.js`** | Owns all localized strings, the active language, and the lightweight `{Key}` / `{Function:args}` template engine used by UI text and narration. It also provides the structural template helpers used by the interpreter and clip-selection layers. |
| **`roles.js`** | Central registry of every role and token. Defines their authored metadata such as art, instance limits, prerequisites, and token usage, then derives tags, teams, phases, and localization keys during initialization. Also provides the player-count calculation and role/token lookup helpers. The definitions are frozen after initialization. |
| **`settings.js`** | Defines the complete declarative settings tree and owns current values, defaults, persistence, and validation. Settings include weighted choices, percentages, toggles, and numeric values used by rules and narration timing. Validation can depend on the current role selection. |
| **`rules.js`** | Generates the ordered game narration from the selected roles. It walks the declarative turn order and uses per-role resolver functions and shared weighted-random helpers to produce structured turn data. It does not generate localized text. |
| **`interpreter.js`** | Converts `rules.js` turn data into deferred narration data and renders that data through the localization template system. It provides template primitives such as `Identity`, `RoleName`, `If`, `Select`, and `Input`, and supports separate manual (`verbose`/`brief`) and automatic rendering modes. |
| **`clipselector.js`** | Purely maps structural narration references to logical pre-recorded clip names. Its hand-authored manifest can describe individual recordings and aggregate recordings covering multiple template positions. It performs no I/O and does not know whether a named clip actually exists in an audio atlas. `ClipPlayback` is its only consumer. |
| **`clipplayback.js`** | Owns the physical pre-recorded audio layer. It resolves structural references through `ClipSelector`, loads and caches language-specific audio atlases, plays clips through the Web Audio API, applies configured silence padding, and checks whether recordings actually exist. It also supports standalone announcement clips and a debug sequence player. |
| **`synthesis.js`** | Fallback speech backend using the browser's Web Speech API. It receives plain text only, selects the preferred voice for the active language when available, and exposes a small playback handle to its caller. |
| **`narration.js`** | Runs automatic narration sessions. It resolves turns immediately before playback, executes content/pause/input nodes in order, owns session state and pacing, accepts live input selections, and dispatches each spoken sentence to recorded clips or speech synthesis without exposing that backend choice to the rest of the application. |
| **`gui.js`** | Builds and maintains the interactive interface: role selection and filtering, settings, role/token descriptions, generated prompt navigation, the day timer, printing, and the speech overlay. It coordinates the other modules but contains no game-rule or speech-backend implementation of its own. |

`index.html` is a mostly static page skeleton. The main panels and controls
exist in the markup, while their data-driven contents are populated by
`gui.js`. The stylesheet is loaded separately as `styles.css`.

## Why this many layers?

The application has several kinds of change that are easier to maintain
when kept separate: game rules and randomization, localization and grammar,
data-driven settings, structural narration, and physical audio playback.

The main boundaries are:

- `rules.js` decides **what happens**.
- `interpreter.js` decides **how structured rule data becomes narration
  structure and text**.
- `localization.js` supplies **language-specific wording and template
  expansion**.
- `clipselector.js` decides **which recordings could cover a rendered
  sentence**.
- `clipplayback.js` decides **whether those recordings exist and how they
  are played**.
- `synthesis.js` provides the **text-to-speech fallback**.
- `narration.js` coordinates **turn execution, pacing, and interactive input**.
- `gui.js` handles **presentation and user interaction**.

This means, for example, that changing wording normally belongs in
`localization.js`, while changing which role can perform an action belongs in
`rules.js` or `roles.js`. Changing the physical atlas does not require
changing the narration engine.

## Program flow

### Startup (`gui.js: initGUI()`)

1. The active language is read from `Localization`, the language selector is
   initialized, and language-dependent GUI assets are applied.
2. Persisted role selection and day-timer state are loaded. Other modules
   have already initialized their own persisted/default state when their
   scripts were loaded.
3. GUI scaling is adapted to the current viewport.
4. Static text, panels, role/token elements, tag filters, settings controls,
   and prompt navigation are built.
5. Saved tag-filter state is restored.
6. GUI event listeners are registered.
7. `updateRolesUI()` performs the first full synchronization, including
   selection sanitization, validation, prompt generation, and persistence.
8. `Narration.preload()` prepares the available speech backends.

### Selecting roles → generating the prompt

This pipeline begins whenever the role selection changes.

1. `gui.js` repeatedly calls `Roles.isSelectable()` and removes roles whose
   prerequisites are no longer satisfied. This repeats until the selection is
   stable, allowing prerequisite changes to cascade.
2. `Settings.validate({ selectedRoles })` validates the settings for the
   current role selection. `Settings.filterRelevant()` removes validation
   results for settings that are not applicable to the current selection.
3. If relevant setting errors remain, the prompt panel displays an error
   instead of generating narration.
4. Otherwise, `Rules.buildPrompt(roleCounts)` walks the turn order and
   produces structured turns, resolving randomized outcomes along the way.
   Cached random choices remain stable until explicitly rerandomized.
5. `Interpreter.compileAll(turns)` converts the rule turns into deferred
   `NarrationData`. No localized text is stored in this structure.
6. The GUI stores that `NarrationData` in `promptState`. The written prompt
   renders it on demand through `Interpreter.renderText()` in either
   `verbose` or `brief` mode.

### Playing narration aloud (`gui.js: speakPrompt()`)

1. `Interpreter.refreshPauseSettings()` snapshots the current narration pause
   settings for the upcoming playback session.
2. The speech overlay opens and `Narration.play(promptState.narrationData, ...)`
   starts the automatic narration session.
3. `Narration` resolves each turn only when execution reaches it, using values
   collected from earlier interactive inputs.
4. Content nodes are rendered through `Interpreter.renderContent()`. Each
   rendered sentence contains both its localized text and the structural
   source information needed for recording lookup.
5. `Narration` passes the sentence to `ClipPlayback`. `ClipPlayback` asks
   `ClipSelector` for recording coverage and confirms the resulting clips
   actually exist in the current language's atlas. When recorded coverage is
   unavailable or incomplete, the sentence is spoken through `Synthesis`
   instead. A sentence is therefore handled entirely by recordings or
   entirely by synthesis.
6. Explicit pauses and interactive input nodes are handled by `Narration`.
   Input choices are displayed by the GUI and delivered back through
   `Narration.selectInput()`.
7. Playback ends when all executable turns finish or when the user stops the
   session. Standalone timer announcements use `Narration.playAnnouncement()`
   and are kept separate from the normal narration session.

### Adjusting a setting

Changing a settings control writes the value through `Settings.setValue()`.
The GUI then re-runs settings validation and prompt generation, so the
displayed prompt and validation state stay synchronized with the current
configuration.

### Language switch

Changing the language calls `Localization.setLanguage()` and reloads the
page. The application is therefore rebuilt entirely using the new language
rather than trying to patch every already-generated element in place.

## Where to look for...

- **Adding or changing role/token data** → `roles.js`, especially
  `ROLES`, `TOKENS`, `TAGS`, `ROLE_TEAMS`, and `ROLE_PHASES`.
- **Changing prerequisites, teams, phases, or role instance limits** →
  `roles.js`.
- **Changing randomized role behavior or turn order** → `rules.js`,
  especially `RESOLVERS` and `TURN_ORDER`.
- **Adding or changing a tunable setting** → `settings.js`,
  especially `SETTINGS_TREE`. The settings UI, persistence, and validation
  are generated from this data.
- **Changing localized wording or grammar** → `localization.js`,
  especially `LOCALIZATION_KEYS`.
- **Adding or changing template primitives** → `interpreter.js`.
- **Changing how narration maps to recordings** → `clipselector.js`,
  especially `MANIFEST` and its aggregate helpers.
- **Changing physical audio, atlas data, or silence padding** →
  `clipplayback.js`.
- **Changing browser text-to-speech behavior or preferred voices** →
  `synthesis.js`.
- **Changing spoken narration sequencing, pacing, pause/resume, or input
  handling** → `narration.js`.
- **Changing anything visual or interactive** → `gui.js`.
- **Changing the static page structure or script load order** → `index.html`.

## Audio data and recording workflow

`clipselector.js` contains the authored structural mapping from localization
templates to logical clip names. `clipplayback.js` contains the physical
language-specific atlas metadata and playback logic.

The clip atlas region table in `clipplayback.js` is generated by the atlas
packing tooling and should normally be replaced as a generated data set after
repacking. Per-clip and per-type silence adjustments are authored separately
and are not changed by repacking.

## Known limitations

- English localization is secondary/partial; Swedish is the primary language.
- `localization.js`'s `getString()` can return `null` when the current language
  has no dictionary, rather than `undefined`. The normal UI only allows known
  language IDs, so this is not currently reachable through normal language
  selection.
