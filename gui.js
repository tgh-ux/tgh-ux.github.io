/*
 * Graphical user interface.
 *
 * Builds and maintains the application's DOM, coordinates user interaction, and reflects application state visually. Game and narration
 * logic remains in the underlying modules; this module primarily handles presentation and interaction.
 */


/* =========================
   Application state
   ========================= */

// Hold duration required to open a role's description from its selection tile, in milliseconds.
const LONG_PRESS_DELAY = 300;

// localStorage keys used by the GUI for role selection, role-filter state, and day-timer state.
const SELECTED_ROLES_STORE = "onuw_roles";
const TAG_FILTERS_STORE = "onuw_tag_filters";
const DAY_TIMER_STORE = "onuw_day_timer";

/*
 * Currently selected role instances, keyed by role ID.
 *
 * A role is absent when its selected count is zero. setRoleCount() maintains this invariant.
 */
const roleCounts = new Map();

// Maps Settings validation error types to the DOM renderer used for displaying them. Both weight-group error types share the same renderer.
const VALIDATION_RENDERERS = {
	value: renderValueError,
	weightGroupSum: renderWeightGroupError,
	conditionalWeightGroup: renderWeightGroupError,
};

// Pointer ID currently being held on a role-selection tile, or null when no selection hold is active.
let activeSelectionPointerId = null;

/*
 * Current generated narration data and manual prompt-view state.
 *
 * `narrationData` is the structural representation produced by Interpreter.compileAll() from Rules.buildPrompt(). It is shared by both
 * presentation modes: manual display renders it on demand, while automatic narration passes it to Narration.
 *
 * `currentTurn` is the zero-based turn currently displayed in single-turn mode. `showSingleTurn` selects between displaying the complete
 * script and one turn at a time.
 */
let promptState = {
	narrationData: [],
	currentTurn: 0,
	showSingleTurn: false,
};

// Interval used only to refresh the timer display; the target timestamp remains authoritative while running.
const DAY_TIMER_TICK_INTERVAL = 150;
// Number of seconds added or removed by the timer adjustment controls.
const DAY_TIMER_ADJUST_STEP = 30;
// Initial timer duration, in seconds, before a persisted duration exists.
const DAY_TIMER_DEFAULT_DURATION = 300;
/*
 * Audio warnings triggered as the timer approaches zero.
 *
 * Each entry contains:
 *   threshold   - remaining time, in seconds, at which the warning is eligible.
 *   text        - localization key for the announcement.
 *   playSetting - Settings OID controlling whether the warning is played.
 */
const DAY_TIMER_WARNINGS = [
    { threshold: 60, text: "UI_DAYTIMER_60S_WARNING", playSetting: "narration.play_timer_warnings" },
    { threshold: 30, text: "UI_DAYTIMER_30S_WARNING", playSetting: "narration.play_timer_warnings" },
];
// Maximum amount by which a warning threshold may already have been passed and still be played, in seconds.
const DAY_TIMER_WARNING_GRACE_SECONDS = 5;

/*
 * Current day-timer state.
 *   state           - "stopped" | "running" | "paused"
 *   duration        - Configured duration in seconds. Used as the reset/default duration.
 *   remaining       - Remaining seconds while stopped or paused. While running, the authoritative value is derived from targetTimestamp
 *                     instead.
 *   targetTimestamp - Wall-clock timestamp in milliseconds at which a running timer reaches zero. Using an absolute timestamp avoids
 *                     accumulating interval drift when the browser throttles timers or the tab is backgrounded.
 *   expanded        - Whether the expanded timer controls are currently visible.
 *   intervalId      - Redraw interval handle while the timer is running, or null otherwise.
 *   warnings        - Warning thresholds that have not yet been handled for the current timer run.
 */
let dayTimer = {
	state: "stopped",
	duration: DAY_TIMER_DEFAULT_DURATION,
	remaining: DAY_TIMER_DEFAULT_DURATION,
	targetTimestamp: null,
	expanded: false,
	intervalId: null,
	warnings: [],
};

/*
 * Declarative definition of the role-selection tag filters.
 *
 * Each group contains:
 *   id       - internal group identifier, also used in persisted filter state.
 *   textKey  - localization key for the group heading.
 *   tags     - available filter options, each containing:
 *                tag     - Roles tag matched by this option.
 *                textKey - localization key for the option label.
 *                default - optional initial selection state.
 *
 * Filters are combined with AND between groups and OR within a group. A group with no selected options imposes no restriction.
 */
const TAG_FILTER_GROUPS = [
	{
		id: "ruleset",
		textKey: "UI_FILTER_RULESET",
		tags: [
			{ tag: "RULESET_BASIC", textKey: "UI_FILTER_RULESET_BASIC", default: true },
			{ tag: "RULESET_ADVANCED", textKey: "UI_FILTER_RULESET_ADVANCED" },
			{ tag: "RULESET_ALIEN", textKey: "UI_FILTER_RULESET_ALIEN" },
			{ tag: "RULESET_VAMPIRE", textKey: "UI_FILTER_RULESET_VAMPIRE" },
		]
	},
	{
		id: "complexity",
		textKey: "UI_FILTER_COMPLEXITY",
		tags: [
			{ tag: "COMPLEXITY_EASY", textKey: "UI_FILTER_COMPLEXITY_EASY", default: true },
			{ tag: "COMPLEXITY_MEDIUM", textKey: "UI_FILTER_COMPLEXITY_MEDIUM", default: true },
			{ tag: "COMPLEXITY_HARD", textKey: "UI_FILTER_COMPLEXITY_HARD" },
		]
	}
];

/*
 * Sprite-sheet assets whose CSS URL depends on the active language.
 *
 * Each entry contains:
 *   cssVar       - CSS custom property receiving the loaded image URL.
 *   path         - language-specific asset path; %LANGUAGE% is replaced with the lower-case Localization language code.
 *   fallbackPath - asset used when the localized path cannot be loaded.
 */
const LOCALIZED_SPRITE_SHEETS = [
	{
		cssVar: "--card-sprite-sheet",
		path: "Sprites/cards_%LANGUAGE%.jpg",
		fallbackPath: "Sprites/placeholder_cards.jpg",
	},
	{
		cssVar: "--role-sprite-sheet",
		path: "Sprites/roles.png", // No localized sheets currently, add if needed
		fallbackPath: "Sprites/placeholder_roles.png",
	},
	{
		cssVar: "--token-sprite-sheet",
		path: "Sprites/tokens.png",	// No localized sheets currently, add if needed
		fallbackPath: "Sprites/placeholder_tokens.png",
	},
];



/* =========================
   Localization
   ========================= */

/**
 * Synchronizes GUI language-dependent state with the supplied language.
 *
 * Updates localized sprite sheets and the language selector. The application's actual language is managed by Localization.setLanguage().
 *
 * @param {string} lang - Language code known to Localization.
 */
function setGUILanguage(lang) {
	setGUISpriteLanguage(lang);
	document.getElementById("languageSelector").value = lang;
}

/**
 * Applies the localized sprite-sheet assets for the supplied language.
 *
 * Each entry in LOCALIZED_SPRITE_SHEETS has its `%LANGUAGE%` placeholder replaced with the lower-case language code. The corresponding CSS
 * custom property is updated when the image loads successfully; when it fails, the configured fallback asset is attempted instead.
 *
 * @param {string} lang - Language code used to construct localized asset paths.
 */
function setGUISpriteLanguage(lang) {
	LOCALIZED_SPRITE_SHEETS.forEach((sheetData) => {
		const sheetPath = sheetData.path.replace(/%LANGUAGE%/, lang.toLowerCase());
		const img = new Image();

		// Set the path if the image loads successfully
		img.onload = () => {
			document.documentElement.style.setProperty(sheetData.cssVar, `url("${sheetPath}")`);
		};

		// Otherwise (e.g. missing asset) fall back to the default-language asset
		img.onerror = () => {
			console.warn("Unable to load localized asset '" + sheetPath + "' for sprite sheet '" + sheetData.cssVar + "'");

			if (!sheetData.fallbackPath) {
				console.error("No fallback asset defined");
				return;
			}

			console.warn("Attempting to use fallback asset '" + sheetData.fallbackPath + "'");
			const fallbackImg = new Image();

			fallbackImg.onload = () => {
				document.documentElement.style.setProperty(sheetData.cssVar, `url("${sheetData.fallbackPath}")`);
			};

			fallbackImg.onerror = () => {
				console.error("Unable to load fallback asset '" + sheetData.fallbackPath + "'");
			}

			fallbackImg.src = sheetData.fallbackPath;
		};

		img.src = sheetPath;
	});
}

/**
 * Applies localization to static HTML elements marked with localization attributes.
 *
 * Supported attributes are:
 *   data-loc             -> sets textContent
 *   data-loc-placeholder -> sets the element's placeholder
 *   data-loc-html        -> sets innerHTML
 *
 * The document title is also localized when its <title> element has data-loc.
 */
function localizeStaticContent() {
	document.querySelectorAll("[data-loc]").forEach(el => {
		const key = el.dataset.loc;
		el.textContent = Localization.localize(key);
	});

	document.querySelectorAll("[data-loc-placeholder]").forEach(el => {
		const key = el.dataset.locPlaceholder;
		el.placeholder = Localization.localize(key);
	});

	document.querySelectorAll("[data-loc-html]").forEach(el => {
		const key = el.dataset.locHtml;
		el.innerHTML = Localization.localizeHTML(key);
	});

	const titleEl = document.querySelector("title[data-loc]");
	if (titleEl) {
		titleEl.textContent = Localization.localize(titleEl.dataset.loc);
	}
}



/* =========================
   Persistent storage
   ========================= */

/**
 * Persists the current role selection to localStorage.
 *
 * The Map is serialized as an object keyed by role ID, with each value being the selected instance count.
 */
function saveSelectedRoles() {
	const roles = Object.fromEntries(roleCounts);
	localStorage.setItem(SELECTED_ROLES_STORE, JSON.stringify(roles));
}

/**
 * Restores the persisted role selection into roleCounts.
 *
 * Unknown/disabled roles and non-integer counts are ignored. Valid counts outside the role's current min/max range are clamped to that
 * range, allowing persisted selections to survive changes to role configuration. Malformed stored data is ignored without throwing.
 */
function loadSelectedRoles() {
	const raw = localStorage.getItem(SELECTED_ROLES_STORE);
	if (!raw) return;

	try {
		const roles = JSON.parse(raw);

		console.group("Loaded role selection");

		for (const [roleId, count] of Object.entries(roles)) {
			if (!Roles.isEnabled(roleId)) {
				console.warn("\t" + roleId + " is disabled, ignoring attempt to load");
				continue;
			}

			if (!Number.isInteger(count)) {
				console.warn("\t" + roleId + " count is not an integer, ignoring attempt to load");
				continue;
			}

			if (count === 0) continue;

			const { minCount, maxCount } = Roles.getMinMax(roleId);
			let effectiveCount = count;

			if (count > maxCount || count < minCount) {
				console.warn("\t" + roleId + " count " + count + " is not within role min/max, clamping value");
				effectiveCount = Math.max(minCount, Math.min(count, maxCount));
			}

			//console.log("\t" + roleId + ": " + count);
			setRoleCount(roleId, effectiveCount);
		}
		console.groupEnd();

	} catch {
		console.warn("Unable to load selected roles from storage");
	}
}

/**
 * Persists the currently selected role-filter tags to localStorage.
 *
 * The stored representation is the same grouped object produced by getSelectedTagFilters(): { [groupId]: string[] }.
 */
function saveTagFilters() {
	const filters = getSelectedTagFilters();
	localStorage.setItem(TAG_FILTERS_STORE, JSON.stringify(filters));
}

/**
 * Restores persisted role-filter selections to the filter tiles.
 *
 * The filter tiles must already have been created by buildSelectionTagFilters() before this function is called. Stored state is applied by
 * matching each tile's data-group and data-tag attributes. Malformed stored data is ignored without throwing.
 */
function loadTagFilters() {
	const raw = localStorage.getItem(TAG_FILTERS_STORE);
	if (!raw) return;

	try {
		const filters = JSON.parse(raw);

		document.querySelectorAll(".selection-filter-option").forEach(tile => {
			const group = tile.dataset.group;
			const tag = tile.dataset.tag;

			const selected = filters[group]?.includes(tag) ?? false;

			tile.classList.toggle("selected", selected);
			tile.classList.toggle("unselected", !selected);
		});
	} catch {
		console.warn("Unable to load tag filters from storage");
	}
}

/**
 * Persists the current day-timer state to localStorage.
 *
 * While running, the remaining time is recalculated from the authoritative targetTimestamp before saving. The stored object contains the
 * timer state, configured duration, current remaining time, and target timestamp.
 */
function saveDayTimer() {
	const data = {
		state: dayTimer.state,
		duration: dayTimer.duration,
		remaining: getDayTimerRemainingSeconds(),
		targetTimestamp: dayTimer.targetTimestamp,
	};
	localStorage.setItem(DAY_TIMER_STORE, JSON.stringify(data));
}

/**
 * Restores the persisted day-timer state.
 *
 * A running timer is resumed from its saved wall-clock targetTimestamp, so elapsed time while the page was closed or reloaded is accounted
 * for. A paused timer restores its saved remaining time; a stopped timer resets to its saved duration.
 *
 * Invalid or incomplete stored data falls back to the appropriate default/current state without throwing. A running timer that has already
 * reached zero is restored as stopped at 00:00.
 */
function loadDayTimer() {
	const raw = localStorage.getItem(DAY_TIMER_STORE);
	if (!raw) return;

	try {
		const data = JSON.parse(raw);

		dayTimer.duration = Number.isFinite(data.duration) ? data.duration : DAY_TIMER_DEFAULT_DURATION;

		if (data.state === "running" && typeof data.targetTimestamp === "number") {
			const remaining = Math.max(0, Math.round((data.targetTimestamp - Date.now()) / 1000));

			if (remaining > 0) {
				dayTimer.state = "running";
				dayTimer.targetTimestamp = data.targetTimestamp;
				initializeDayTimerWarnings(remaining);
			} else {
				// Timer would have already run out while the page was closed/reloaded
				dayTimer.state = "stopped";
				dayTimer.remaining = 0;
			}
		} else if (data.state === "paused") {
			dayTimer.state = "paused";
			dayTimer.remaining = Math.max(0, Number.isFinite(data.remaining) ? data.remaining : dayTimer.duration);
		} else {
			dayTimer.state = "stopped";
			dayTimer.remaining = dayTimer.duration;
		}

		document.getElementById("btn-speech-start").disabled = (dayTimer.state == "stopped" ? false : true);

	} catch {
		console.warn("Unable to load day timer from storage");
	}
}



/* =========================
   Role & token utility functions
   ========================= */

/**
 * Returns all enabled tokens sorted by token type and then localized name.
 *
 * Token types are ordered as artifact, mark, shield. Names are compared using the active language's locale.
 *
 * @returns {object[]} Enabled token definitions in display order.
 */
function getEnabledTokensSorted() {
	const TOKEN_TYPE_ORDER = ["artifact", "mark", "shield"];

	const tokens = Roles.getAllEnabledTokens();
	const lang = Localization.getLanguage();

	const localizedTokens = tokens.map(token => ({
		token,
		name: Localization.localize(token.nameKey)
	}));

	localizedTokens.sort((a, b) =>
		TOKEN_TYPE_ORDER.indexOf(a.token.type) - TOKEN_TYPE_ORDER.indexOf(b.token.type) ||
		a.name.localeCompare(b.name, lang)
	);

	return localizedTokens.map(entry => entry.token);
}

/**
 * Returns the localized token name normalized for case-insensitive search.
 *
 * @param {object} token - Token definition.
 * @returns {string} Lowercase localized token name.
 */
function getTokenSearchText(token) {
	return Localization.localize(token.nameKey).toLowerCase();
}

/**
 * Returns all enabled roles sorted by their localized display name.
 *
 * @returns {object[]} Enabled role definitions in display order.
 */
function getEnabledRolesSorted() {
	const roles = Roles.getAllEnabled();
	const lang = Localization.getLanguage();

	const localizedRoles = roles.map(role => ({
		role,
		name: Localization.localize(role.nameKey)
	}));

	localizedRoles.sort((a, b) =>
		a.name.localeCompare(b.name, lang)
	);

	return localizedRoles.map(entry => entry.role);
}

/**
 * Returns the IDs of all currently selected roles.
 *
 * Roles are returned once each, regardless of how many instances are selected.
 *
 * @returns {string[]} Selected role IDs.
 */
function getSelectedRoleIds() {
	return Array.from(roleCounts.keys());
}

/**
 * Calculates the number of players supported by the current role selection.
 *
 * @returns {number} Current player count.
 */
function getPlayerCount() {
	return Roles.calculatePlayerCount(roleCounts);
}

/**
 * Returns the localized role name normalized for case-insensitive search.
 *
 * @param {object} role - Role definition.
 * @returns {string} Lowercase localized role name.
 */
function getRoleSearchText(role) {
	return Localization.localize(Roles.getNameKey(role)).toLowerCase().replace(/\u00AD/g, '');
}

/**
 * Returns the number of selected instances of a role.
 *
 * @param {string} roleId - Role ID.
 * @returns {number} Selected instance count, or 0 when the role is not selected.
 */
function getRoleCount(roleId) {
	return roleCounts.get(roleId) ?? 0;
}

/**
 * Sets the selected instance count for a role.
 *
 * A count of 0 removes the role from the current selection. Positive counts must be integers within the role's configured minimum and
 * maximum range.
 *
 * @param {string} roleId - Role ID.
 * @param {number} value - Desired selected instance count.
 * @returns {number} The accepted count.
 * @throws {Error} If the count is invalid for the role.
 */
function setRoleCount(roleId, value) {
	const { minCount, maxCount } = Roles.getMinMax(roleId);

	if (!Number.isInteger(value) || value < 0 || (value > 0 && (value < minCount || value > maxCount)))
		throw new Error(`Invalid role count for ${roleId}: ${value}`);

	if (value === 0)
		roleCounts.delete(roleId);
	else
		roleCounts.set(roleId, value);

	return value;
}

/**
 * Returns whether at least one instance of a role is selected.
 *
 * @param {string} roleId - Role ID.
 * @returns {boolean} True when the role has a positive selected count.
 */
function roleIsSelected(roleId) {
	return getRoleCount(roleId) > 0;
}

/**
 * Returns whether any role is currently selected.
 *
 * @returns {boolean} True when at least one role is selected.
 */
function isAnyRoleSelected() {
	return roleCounts.size > 0;
}

/**
 * Returns a localized, comma-separated list of roles that directly use a token.
 *
 * @param {object} token - Token definition.
 * @returns {string} Localized role names, separated by commas.
 */
function getTokenUsedByText(token) {
	return Roles.getRolesUsingToken(token).map(roleId => Localization.localize(Roles.getNameKey(roleId))).join(", ");
}

/**
 * Converts role IDs into a localized, comma-separated role-name list.
 *
 * @param {string[]} roleIds - Role IDs to display.
 * @returns {string} Localized role names, separated by commas.
 */
function getRoleList(roleIds) {
	return roleIds.map(roleId => Localization.localize(Roles.getNameKey(roleId))).join(", ");
}


/* =========================
   DOM construction
   ========================= */

	/* =========================
	   Sprites
	   ========================= */

	/**
	 * Reads the CSS-defined sprite-sheet geometry for a sprite type.
	 *
	 * @param {string} type - Sprite type: "role", "card", or "token".
	 * @returns {{width: number, height: number, scale: number, columns: number, rows: number}}
	 *     Sprite cell dimensions, display scale, and sheet dimensions in cells.
	 */
	function getSpriteData(type) {
		const styles = getComputedStyle(document.documentElement);

		return {
			width: parseFloat(styles.getPropertyValue(`--${type}-sprite-width`)),
			height: parseFloat(styles.getPropertyValue(`--${type}-sprite-height`)),
			scale: parseFloat(styles.getPropertyValue(`--${type}-sprite-scale`)),
			columns: parseInt(styles.getPropertyValue(`--${type}-sprite-columns`), 10),
			rows: parseInt(styles.getPropertyValue(`--${type}-sprite-rows`), 10)
		};
	}

	/**
	 * Sets the CSS offsets needed to display a sprite at the specified sheet position.
	 *
	 * @param {HTMLElement} el - Sprite element to update.
	 * @param {string} type - Sprite type: "role", "card", or "token".
	 * @param {{x: number, y: number}} position - Zero-based sprite coordinates.
	 */
	function applySpriteOffset(el, type, position) {
		const { width, height } = getSpriteData(type);

		el.style.setProperty(`--${type}-sprite-x`, `${-position.x * width}px`);
		el.style.setProperty(`--${type}-sprite-y`, `${-position.y * height}px`);
	}

	/**
	 * Creates a generic sprite element positioned at the specified sprite-sheet coordinates.
	 *
	 * Adds the common sprite classes and any additional classes supplied by the caller.
	 *
	 * @param {string} type - Sprite type: "role", "card", or "token".
	 * @param {{x: number, y: number}} position - Zero-based sprite coordinates.
	 * @param {...string} classes - Additional CSS classes.
	 * @returns {HTMLDivElement} Configured sprite element.
	 */
	function createSprite(type, position, ...classes) {
		const el = document.createElement("div");

		el.classList.add(
			"sprite",
			`${type}-sprite`,
			...classes
		);

		applySpriteOffset(el, type, position);

		return el;
	}

	/**
	 * Creates a role portrait sprite for the supplied role.
	 *
	 * @param {object} role - Role definition.
	 * @returns {HTMLDivElement} Role portrait element.
	 */
	function createRoleIcon(role) {
		return createSprite("role", Roles.getPortraitIcon(role));
	}

	/**
	 * Creates a card sprite at the supplied sheet position.
	 *
	 * @param {{x: number, y: number}} card - Card sprite coordinates.
	 * @returns {HTMLDivElement} Card icon element.
	 */
	function createCardIcon(card) {
		return createSprite("card", card);
	}

	/**
	 * Creates a token sprite for the supplied token.
	 *
	 * @param {object} token - Token definition.
	 * @returns {HTMLDivElement} Token icon element.
	 */
	function createTokenIcon(token) {
		return createSprite("token", Roles.getTokenIcon(token));
	}

	/* =========================
	   Tile construction

	   Builds tiles for the three static panels that list roles/tokens: role selection, role descriptions, and token descriptions. All three
	   share the base tile elements.
	   ========================= */

	// -- Base tile elements --

	/**
	 * Creates the common DOM element used by role tiles.
	 *
	 * Stores the normalized localized role name for searching and the role ID for selection/filter state.
	 *
	 * @param {object} role - Role definition.
	 * @param {...string} classes - CSS classes to apply.
	 * @returns {HTMLDivElement} Base role tile.
	 */
	function createRoleTile(role, ...classes) {
		const el = document.createElement("div");
		el.classList.add(...classes);
		el.dataset.roleName = getRoleSearchText(role);  // normalized name, used for search/filtering
		el.dataset.roleId = role.id;                    // identifies the associated role

		return el;
	}

	/**
	 * Creates the common DOM element used by token tiles.
	 *
	 * Stores the normalized localized token name for searching and the token ID for identifying the token.
	 *
	 * @param {object} token - Token definition.
	 * @param {...string} classes - CSS classes to apply.
	 * @returns {HTMLDivElement} Base token tile.
	 */
	function createTokenTile(token, ...classes) {
		const el = document.createElement("div");
		el.classList.add(...classes);
		el.dataset.tokenName = getTokenSearchText(token);  // normalized name, used for search/filtering
		el.dataset.tokenId = token.id;                     // identifies the associated token

		return el;
	}

	// -- Role selection tiles --

	/**
	 * Creates and appends a role-selection tile.
	 *
	 * The tile contains the role icon, localized name, and an initially hidden instance-count badge.
	 *
	 * @param {object} role - Role definition.
	 * @returns {HTMLDivElement} The created selection tile.
	 */
	function buildSelectionListTile(role) {
		const container = document.getElementById("selectionList");
		const tile = createRoleTile(role, "selection-tile", "unselected");
		const icon = createRoleIcon(role);
		const label = document.createElement("div");
		label.className = "selection-tile-name";
		label.textContent = Localization.localize(role.nameKey);
		const count = document.createElement("div");
		count.className = "selection-selected-count";
		count.style.display = "none";

		tile.append(icon, label, count);
		container.appendChild(tile);

		return tile;
	}

	/**
	 * Adds pointer interaction to a role-selection tile.
	 *
	 * A short press selects or cycles the role. A hold for LONG_PRESS_DELAY opens the role description instead. Pointer movement beyond the
	 * long-press threshold or pointer cancellation aborts the hold.
	 *
	 * @param {HTMLElement} tile - Role-selection tile.
	 * @param {object} role - Role definition associated with the tile.
	 */
	function applySelectionTileListeners(tile, role) {
		const MAX_DISTANCE = 10;
		let pressTimer = null;
		let longPressTriggered = false;
		let startX = 0;
		let startY = 0;

		function cancelLongpress() {
			clearTimeout(pressTimer);
			pressTimer = null;
		}

		tile.addEventListener("pointerdown", (e) => {
			activeSelectionPointerId = e.pointerId;
			startX = e.clientX;
			startY = e.clientY;
			longPressTriggered = false;

			pressTimer = setTimeout(() => {
				longPressTriggered = true;
				onOpenModalRoleDescription(role);
			}, LONG_PRESS_DELAY);
		});

		tile.addEventListener("pointermove", (e) => {
			if (!pressTimer) return;

			if (Math.hypot(e.clientX - startX, e.clientY - startY) > MAX_DISTANCE) {
				cancelLongpress();
			}
		});

		tile.addEventListener("pointerup", (e) => {
			if (e.pointerId !== activeSelectionPointerId) return;

			cancelLongpress();

			if (!longPressTriggered) {
				onSelectionTileClicked(role);
			}

			activeSelectionPointerId = null;
		});

		tile.addEventListener("pointerleave", cancelLongpress);
		tile.addEventListener("pointercancel", cancelLongpress);
	}

	// -- Role description tiles --

	/**
	 * Returns the localized team text for a role.
	 *
	 * Roles tagged CAN_CHANGE_ALIGNMENT receive the localized variable-alignment suffix.
	 *
	 * @param {object} role - Role definition.
	 * @returns {string} Localized team description.
	 */
	function getDescriptionTeamText(role) {
		let team = Localization.localize(role.team);

		if (team && role.tags?.includes("CAN_CHANGE_ALIGNMENT")) {
			team += Localization.localize("TEAM_VARIABLE_SUFFIX");
		}

		return team;
	}

	/**
	 * Returns the localized text describing the phase in which a role acts.
	 *
	 * @param {object} role - Role definition.
	 * @returns {string} Localized phase description, or an empty string for an unknown phase.
	 */
	function getDescriptionPhaseText(role) {
		switch (role.phase) {
			case "NIGHT":
				return Localization.localize("PHASE_NIGHT_ROLE");
			case "DAY":
				return Localization.localize("PHASE_DAY_ROLE");
			case "DUSK":
				return Localization.localize("PHASE_DUSK_ROLE");
		}

		console.warn("Unknown phase " + role.phase + " for role " + role.id + " when fetching description");
		return "";
	}

	/**
	 * Returns the localized win-condition text for a role.
	 *
	 * Uses a role-specific localization key when available, otherwise falls back to the role's team key. Roles with changeable alignment
	 * receive an additional variable-alignment note.
	 *
	 * @param {object} role - Role definition.
	 * @returns {string} Localized win-condition description.
	 */
	function getDescriptionWinConditionText(role) {
		const roleKey = `UI_WINCONDITION_${role.id}`;
		if (Localization.hasKey(roleKey)) {
			return Localization.localize(roleKey);
		}

		const teamKey = `UI_WINCONDITION_${role.team}`;
		let base;

		if (Localization.hasKey(teamKey)) {
			base = Localization.localize(teamKey);
		} else {
			console.warn(`Missing team win condition: ${teamKey} (role: ${role.id})`);
			base = "";
		}

		if (role.tags?.includes("CAN_CHANGE_ALIGNMENT")) {
			base += (base ? " " : "") + Localization.localize("UI_WINCONDITION_VARIABLE_NOTE");
		}

		return base;
	}

	/**
	 * Populates a role description tile with its name, phase, team, ability, and win-condition information.
	 *
	 * Icon elements are supplied separately by the caller.
	 *
	 * @param {HTMLElement} tile - Role description tile to populate.
	 * @param {object} role - Role definition.
	 * @returns {HTMLElement} The populated tile.
	 */
	function populateDescriptionTile(tile, role) {
		const name = document.createElement("div");
		name.className = "description-tile-name";
		name.textContent = Localization.localize(role.nameKey);

		const header = document.createElement("div");
		header.className = "description-tile-header";
		header.append(name);

		const phase = document.createElement("div");
		phase.className = "description-tile-phase";
		phase.textContent = getDescriptionPhaseText(role);

		const team = document.createElement("div");
		team.className = "description-tile-team";
		team.textContent = Localization.localize("TEAM_PREFIX") + ": " + getDescriptionTeamText(role);
		if (Roles.hasTag(role, "CAN_CHANGE_ALIGNMENT")) {
			team.classList.add("description-tile-team-variable");
		}

		const meta = document.createElement("div");
		meta.className = "description-tile-meta";
		meta.append(phase, team);

		const ability = document.createElement("div");
		ability.className = "description-tile-ability";
		ability.textContent = Localization.localize(role.abilityKey);

		const rules = document.createElement("div");
		rules.className = "description-tile-rules";
		rules.append(ability);

		const winCondition = document.createElement("div");
		winCondition.className = "description-tile-wincondition";
		winCondition.textContent = getDescriptionWinConditionText(role);
		rules.append(winCondition);

		const info = document.createElement("div");
		info.className = "description-tile-info";
		info.append(header, meta, rules);

		tile.append(info);

		return tile;
	}

	/**
	 * Creates and appends a role description tile.
	 *
	 * @param {object} role - Role definition.
	 * @returns {HTMLDivElement} The created description tile.
	 */
	function buildDescriptionListTile(role) {
		const container = document.getElementById("descriptionList");
		const tile = createRoleTile(role, "description-tile");
		const icon = createRoleIcon(role);

		tile.append(icon);
		populateDescriptionTile(tile, role);
		container.appendChild(tile);

		return tile;
	}

	// -- Token description tiles --

	/**
	 * Populates a token description tile with its name, associated roles, and localized ability description.
	 *
	 * @param {HTMLElement} tile - Token description tile to populate.
	 * @param {object} token - Token definition.
	 * @returns {HTMLElement} The populated tile.
	 */
	function populateTokenDescriptionTile(tile, token) {
		const name = document.createElement("div");
		name.className = "token-tile-name";
		name.textContent = Localization.localize(token.nameKey);

		const info = document.createElement("div");
		info.className = "token-tile-info";
		info.append(name);

		const usedByRoles = Roles.getRolesUsingToken(token);
		if (usedByRoles.length > 0) {
			const usedBy = document.createElement("div");
			usedBy.className = "token-tile-usedby";
			usedBy.textContent = Localization.localize("UI_USEDBY_PREFIX") + ": " + getRoleList(usedByRoles);
			info.append(usedBy);
		}

		const description = document.createElement("div");
		description.className = "token-tile-description";
		description.textContent = Localization.localize(token.abilityKey);
		info.append(description);

		tile.append(info);

		return tile;
	}

	/**
	 * Creates and appends a token description tile.
	 *
	 * @param {object} token - Token definition.
	 * @returns {HTMLDivElement} The created token tile.
	 */
	function buildTokenDescriptionListTile(token) {
		const container = document.getElementById("tokenDescriptionList");
		const tile = createTokenTile(token, "token-tile");
		const icon = createTokenIcon(token);

		tile.append(icon);
		populateTokenDescriptionTile(tile, token);
		container.appendChild(tile);

		return tile;
	}


	/* =========================
	   Modal overlay construction
	   ========================= */

	/**
	 * Builds a row of collapsed token tiles with click-to-reveal descriptions.
	 *
	 * The first token is selected automatically so the detail area is populated when the modal opens. Clicking another token that is not
	 * selected replaces the detail with that token's description.
	 *
	 * @param {object[]} tokens - Token definitions to display.
	 * @param {HTMLElement} listContainer - Container receiving the collapsed token tiles.
	 * @returns {HTMLDivElement} Hidden detail container used for the expanded token description.
	 */
	function buildCollapsedTokenIcons(tokens, listContainer) {
		const detail = document.createElement("div");
		detail.className = "modal-token-detail is-hidden";

		// Shows a token's full description and marks its collapsed tile as selected.
		function showDetail(token, tileEl) {
			listContainer.querySelectorAll(".modal-token-tile.is-selected").forEach(t => t.classList.remove("is-selected"));
			tileEl.classList.add("is-selected");

			detail.replaceChildren(createModalTokenTile(token, false));
			detail.classList.remove("is-hidden");
		}

		// Hides the currently displayed token description and clears its selected state.
		function hideDetail() {
			listContainer.querySelectorAll(".modal-token-tile.is-selected").forEach(t => t.classList.remove("is-selected"));
			detail.replaceChildren();
			detail.classList.add("is-hidden");
		}

		tokens.forEach(token => {
			const tile = createModalTokenTile(token, true);
			tile.addEventListener("click", () => {
				if (!tile.classList.contains("is-selected")) {
					showDetail(token, tile);
				}
			});
			listContainer.appendChild(tile);
		});

		// Auto-select the first token so the modal opens at its final size, rather than resizing (and potentially scrolling) on first click
		const firstTile = listContainer.querySelector(".modal-token-tile");
		if (firstTile) {
			showDetail(tokens[0], firstTile);
		}

		return detail;
	}

	/**
	 * Creates a token tile for use in the role-description modal.
	 *
	 * In collapsed mode the tile contains only the token icon; otherwise it also contains the localized token name and ability description.
	 *
	 * @param {object} token - Token definition.
	 * @param {boolean} collapsed - Whether to create the icon-only version.
	 * @returns {HTMLDivElement} Token tile element.
	 */
	function createModalTokenTile(token, collapsed) {
		const tile = document.createElement("div");
		tile.className = "modal-token-tile" + (collapsed ? " is-collapsed" : "");

		const icon = createTokenIcon(token);
		tile.append(icon);

		if (!collapsed) {
			const text = document.createElement("div");
			text.className = "modal-token-tile-text";

			const header = document.createElement("div");
			header.className = "modal-token-tile-header";
			header.textContent = Localization.localize(token.nameKey);
			text.append(header);

			const description = document.createElement("div");
			description.className = "modal-token-tile-description";
			description.textContent = Localization.localize(token.abilityKey);
			text.append(description);

			tile.append(text);
		}

		return tile;
	}

	/**
	 * Builds the role description modal for the supplied role.
	 *
	 * Replaces the existing modal content with the role's card icons and description. Tokens used by the role are also shown; when more
	 * than MAX_MODAL_TOKEN_DESCRIPTIONS tokens are present, they are presented as collapsible icon tiles with one description shown at a
	 * time.
	 *
	 * @param {object} role - Role definition to display.
	 */
	function buildModalRoleDescription(role) {
		const MAX_MODAL_TOKEN_DESCRIPTIONS = 1;

		const container = document.getElementById("modalOverlayContainer");

		container.replaceChildren();

		const tile = createRoleTile(role, "description-tile");

		const cardIcons = document.createElement("div");
		cardIcons.className = "description-overlay-cards";
		for (const card of Roles.getCardIcons(role)) {
			cardIcons.appendChild(createCardIcon(card));
		}
		tile.append(cardIcons);

		populateDescriptionTile(tile, role);

		const tokens = Roles.getTokensUsedByRole(role);
		if (tokens.length > 0) {
			const collapsed = tokens.length > MAX_MODAL_TOKEN_DESCRIPTIONS;

			const tokenSection = document.createElement("div");
			tokenSection.className = "description-overlay-tokens-container";

			const tokenHeader = document.createElement("div");
			tokenHeader.className = "description-overlay-tokens-header";
			tokenHeader.textContent = Localization.localize("UI_TOKENS_PLACES");
			tokenSection.append(tokenHeader);

			const tokenList = document.createElement("div");
			tokenList.className = "description-overlay-tokens" + (collapsed ? "" : " is-expanded");
			tokenSection.append(tokenList);

			if (collapsed) {
				const detail = buildCollapsedTokenIcons(tokens, tokenList);
				tokenSection.append(detail);
			} else {
				tokens.forEach(token => tokenList.appendChild(createModalTokenTile(token, collapsed)));
			}

			tile.append(tokenSection);
		}

		container.appendChild(tile);
	}

	/**
	 * Builds the settings-validation error panel in the modal overlay.
	 *
	 * Each error supplies an option-key path and a message key. The option path is localized and displayed with " > " separators, followed
	 * by its localized validation message.
	 *
	 * @param {object[]} errors - Validation errors returned by Settings validation.
	 */
	function buildModalErrorPanel(errors) {
		const container = document.getElementById("modalOverlayContainer");

		container.replaceChildren();

		const panel = document.createElement("div");
		panel.className = "settings-validation-overlay";

		const heading = document.createElement("h2");
		heading.textContent = Localization.localize("UI_SETTING_VALIDATION_ERROR");

		panel.appendChild(heading);

		for (const err of errors) {
			const entry = document.createElement("div");
			entry.className = "settings-validation-entry";

			const option = document.createElement("div");
			option.className = "settings-validation-option";
			let optionTextContent = "";
			for (let i = 0; i < err.optionKey.length; i++) {
				optionTextContent += Localization.localize(err.optionKey[i]);
				if (i < err.optionKey.length - 1)
					optionTextContent += " > ";
			}
			option.textContent = optionTextContent;

			const message = document.createElement("div");
			message.className = "settings-validation-message";
			message.textContent = Localization.localize(err.messageKey);

			entry.append(option, message);
			panel.appendChild(entry);
		}

		container.appendChild(panel);
	}


	/* =========================
	   Selection tag filter construction
	   ========================= */

	/**
	 * Creates a selection tag-filter tile.
	 *
	 * The tile stores its group and tag in data attributes, applies its initial selected state, and registers the filter click handler.
	 *
	 * @param {string} groupId - Filter group ID.
	 * @param {string} tag - Role tag represented by the tile.
	 * @param {string} textKey - Localization key for the displayed tag name.
	 * @param {boolean} defaultState - Whether the tile starts selected.
	 * @returns {HTMLDivElement} Created filter tile.
	 */
	function createSelectionTagFilterTile(groupId, tag, textKey, defaultState) {
		const tile = document.createElement("div");
		tile.className = "selection-filter-option";
		tile.classList.add(defaultState ? "selected" : "unselected");
		tile.dataset.tag = tag;
		tile.dataset.group = groupId;

		const label = document.createElement("div");
		label.className = "selection-filter-option-name";
		label.textContent = Localization.localize(textKey);

		tile.appendChild(label);
		tile.addEventListener("click", onTagFilterClicked);

		return tile;
	}

	/**
	 * Creates a selection tag-filter group and populates it with its tag tiles.
	 *
	 * @param {string} groupId - Filter group ID.
	 * @param {string} textKey - Localization key for the group heading.
	 * @param {object[]} tags - Tag definitions from TAG_FILTER_GROUPS.
	 * @returns {HTMLFieldSetElement} Created filter group.
	 */
	function createSelectionTagFilterGroup(groupId, textKey, tags) {
		const group = document.createElement("fieldset");
		group.className = "selection-filter-group";

		const legend = document.createElement("legend");
		legend.className = "selection-filter-group-header";
		legend.textContent = Localization.localize(textKey);

		const tileContainer = document.createElement("div");
		tileContainer.className = "selection-filter-options";

		group.appendChild(legend);
		group.appendChild(tileContainer);

		tags.forEach(filter => {
			const tile = createSelectionTagFilterTile(groupId, filter.tag, filter.textKey, !!filter.default)
			tileContainer.appendChild(tile);
		});

		return group;
	}

	/**
	 * Rebuilds the selection tag-filter UI from TAG_FILTER_GROUPS.
	 *
	 * Existing filter elements in the container are removed before the groups are created.
	 */
	function buildSelectionTagFilters() {
		const container = document.getElementById("roleFilterContainer");
		container.innerHTML = "";

		TAG_FILTER_GROUPS.forEach(groupData => {
			const group = createSelectionTagFilterGroup(groupData.id, groupData.textKey, groupData.tags);
			container.appendChild(group);
		});
	}


	/* =========================
	   Settings construction

	   Settings are generated entirely from Settings.js metadata rather than being individually hard-coded into the UI.
	   ========================= */

	/**
	 * Applies the text-style classes defined for a settings node to a label element.
	 *
	 * @param {HTMLElement} label - DOM element receiving the classes.
	 * @param {object} node - Settings-tree node.
	 */
	function applyTextStyleClasses(label, node) {
		for (const style of Settings.getNodeTextStyles(node)) {
			label.classList.add("settings-font-" + style);
		}
	}

	/**
	 * Creates the collapsed container for a settings node's children.
	 *
	 * Child nodes are built recursively and assigned the next nesting depth.
	 *
	 * @param {object} node - Settings-tree node whose children are being built.
	 * @param {number} depth - Current node depth.
	 * @returns {HTMLDivElement} Collapsed children container.
	 */
	function createSettingChildrenWrap(node, depth) {
		const wrap = document.createElement("div");
		wrap.className = "settings-childrenwrap";
		wrap.dataset.depth = String(depth + 1);
		wrap.style.display = "none";
		wrap.dataset.collapsed = "true";

		for (const childNode of Settings.getChildren(node)) {
			wrap.appendChild(createSettingNode(childNode, depth + 1));
		}

		return wrap;
	}

	/**
	 * Creates a numeric weight input bound to a settings node.
	 *
	 * Input values are normalized to non-negative integers and written directly to the corresponding setting. Changes also refresh the
	 * weight-group percentages.
	 *
	 * @param {object} node - Settings-tree node.
	 * @param {HTMLElement} item - DOM item containing the setting.
	 * @returns {HTMLInputElement} Configured number input.
	 */
	function createWeightInput(node, item) {
		const input = document.createElement("input");
		input.type = "number";
		input.min = "0";
		input.step = "1";
		input.value = String(Settings.getValue(node.oid));
		input.dataset.settingOid = node.oid;

		input.addEventListener("input", () => {
			let v = parseInt(input.value, 10);
			if (!Number.isFinite(v) || v < 0) v = 0;

			input.value = String(v);
			Settings.setValue(node.oid, v);

			if (item.parentElement) {
				updateWeightGroupPercentages(item.parentElement);
			}

			updateSettingsUI();
		});

		return input;
	}

	/**
	 * Creates a percentage input bound to a settings node.
	 *
	 * Values are restricted to the range 0–100.
	 *
	 * @param {object} node - Settings-tree node.
	 * @returns {HTMLInputElement} Configured percentage input.
	 */
	function createPercentInput(node) {
		const input = document.createElement("input");
		input.type = "number";
		input.min = "0";
		input.max = "100";
		input.step = "1";
		input.value = String(Settings.getValue(node.oid));
		input.dataset.settingOid = node.oid;

		input.addEventListener("input", () => {
			let v = parseInt(input.value, 10);
			if (!Number.isFinite(v) || v < 0) v = 0;
			if (v > 100) v = 100;

			input.value = String(v);
			Settings.setValue(node.oid, v);
			updateSettingsUI();
		});

		return input;
	}

	/**
	 * Creates a checkbox input bound to a settings node.
	 *
	 * @param {object} node - Settings-tree node.
	 * @returns {HTMLInputElement} Configured checkbox input.
	 */
	function createToggleInput(node) {
		const input = document.createElement("input");
		input.type = "checkbox";
		input.checked = Boolean(Settings.getValue(node.oid));
		input.dataset.settingOid = node.oid;

		input.addEventListener("change", () => {
			Settings.setValue(node.oid, input.checked);
			updateSettingsUI();
		});

		return input;
	}

	/**
	 * Creates a numeric input bound to a settings node.
	 *
	 * The numeric type and negative-value policy are taken from the settings node. Values are committed while typing when they parse
	 * successfully; the field is normalized or reverted when it loses focus.
	 *
	 * @param {object} node - Settings-tree node.
	 * @returns {HTMLInputElement} Configured number input.
	 */
	function createNumericInput(node) {
		const input = document.createElement("input");
		input.type = "number";
		if (!node.allowNegative) input.min = "0";
		input.step = node.numericType === "integer" ? "1" : "0.1";
		input.value = String(Settings.getValue(node.oid));
		input.dataset.settingOid = node.oid;

		const parse = (raw) => node.numericType === "integer" ? parseInt(raw, 10) : parseFloat(raw);

		// Commits input.value if it already parses to a valid, in-range number. Returns false without
		// committing anything for an in-progress string like "1." or "-" - those aren't wrong, just unfinished.
		function commitIfValid() {
			const v = parse(input.value);
			if (!Number.isFinite(v)) return false;
			if (!node.allowNegative && v < 0) return false;

			Settings.setValue(node.oid, v);
			updateSettingsUI();
			return true;
		}

		// Commits live as the user types, same as the weight/percent inputs - but never rewrites the
		// field's text here. Doing so would stomp on a decimal point or leading minus sign the user just
		// typed but hasn't finished into a complete number yet (e.g. "1." parses to 1, "-" parses to NaN).
		input.addEventListener("input", () => {
			commitIfValid();
		});

		// Once the user's done, normalize the display: a valid entry gets reformatted to its committed
		// value (clearing a trailing "." etc.); an entry that never finished parsing reverts to whatever's
		// still stored (unchanged from before this edit).
		input.addEventListener("blur", () => {
			input.value = String(commitIfValid() ? parse(input.value) : Settings.getValue(node.oid));
		});

		return input;
	}

	/**
	 * Creates the controls area for a settings row.
	 *
	 * The control type is selected from node.type and delegated to the appropriate create<Type>Input helper. Labels and separators do not
	 * receive an input control.
	 *
	 * @param {object} node - Settings-tree node.
	 * @param {HTMLElement} item - DOM item containing the setting.
	 * @returns {HTMLDivElement} Controls container.
	 */
	function createSettingControls(node, item) {
		const control = document.createElement("div");
		control.className = "settings-row-controls";

		const info = document.createElement("span");
		info.className = "settings-controls-info";
		info.textContent = "";

		const wrap = document.createElement("div");
		wrap.className = "settings-controls-wrap";

		switch (node.type) {
			case "label":
			case "separator":
				break;

			case "weight": {
				const icon = document.createElement("span");
				icon.className = "settings-weight-icon";
				icon.textContent = "⚖"; // can be changed later

				const weightWrap = document.createElement("div");
				weightWrap.className = "settings-weight-input";

				info.classList.add("settings-weight-label");
				info.dataset.settingOid = node.oid;

				weightWrap.append(icon, createWeightInput(node, item));
				wrap.appendChild(weightWrap);
				break;
			}
			case "percent": {
				const percentWrap = document.createElement("div");
				percentWrap.className = "settings-percent-input";
				percentWrap.appendChild(createPercentInput(node));

				wrap.appendChild(percentWrap);
				break;
			}
			case "toggle": {
				wrap.appendChild(createToggleInput(node));
				break;
			}
			case "numeric": {
				const numericWrap = document.createElement("div");
				numericWrap.className = "settings-numeric-input";
				numericWrap.appendChild(createNumericInput(node));

				wrap.appendChild(numericWrap);
				break;
			}
			default:
				break;
		}

		control.append(info, wrap);

		return control;
	}

	/**
	 * Creates a hidden settings-validation indicator.
	 *
	 * The indicator is populated later by the validation UI and opens the validation error panel when clicked.
	 *
	 * @returns {HTMLDivElement} Validation indicator element.
	 */
	function createSettingErrorIndicator() {
		const indicator = document.createElement("div");
		indicator.className = "settings-validation-indicator";
		indicator.style.display = "none";

		const icon = document.createElement("span");
		icon.className = "settings-validation-icon";
		icon.textContent = "⚠";

		const count = document.createElement("span");
		count.className = "settings-validation-count";

		indicator.append(icon, count);

		indicator.addEventListener("click", onErrorIndicatorClicked);

		return indicator;
	}

	/**
	 * Recursively builds the DOM representation of a settings-tree node.
	 *
	 * Headers and normal items use their respective row variants; separators are rendered as standalone divider rows. Nodes with children
	 * receive a collapsed child container and a disclosure handler. Settings metadata determines the row label, control, styling,
	 * weight-group membership, and validation indicator.
	 *
	 * @param {object} node - Settings-tree node to build.
	 * @param {number} depth - Node depth from the settings-tree root.
	 * @returns {HTMLDivElement} Built settings item and, when applicable, its child subtree.
	 */
	function createSettingNode(node, depth) {
		// Creates the disclosure indicator for a collapsible settings row.
		function createDisclosureIndicator() {
			const indicator = document.createElement("div");
			indicator.className = "settings-row-disclosure";
			indicator.textContent = "▶";
			indicator.dataset.expanded = "false";
			return indicator;
		}
		
		// Creates the placeholder used when a row has no disclosure indicator.
		function createSpacer() {
			const spacer = document.createElement("div");
			spacer.className = "settings-row-spacer";
			return spacer;
		}

		const SETTING_NODE_VARIANTS = {
			item: {
				itemClass: "settings-item",
				hasControl: true,
			},
			header: {
				itemClass: "settings-header",
				hasControl: false,
			},
		};

		const isSeparator = node.type === "separator";
		const isHeader = node.type === "header";
		const hasChildren = Settings.hasChildren(node);
		const variant = SETTING_NODE_VARIANTS[isHeader ? "header" : "item"];

		const item = document.createElement("div");
		item.className = isSeparator ? `${variant.itemClass} settings-separator` : variant.itemClass;
		item.dataset.settingOid = node.oid;
		item.dataset.depth = String(depth);
		item.dataset.hasChildren = hasChildren ? "true" : "false";
		if (node.weightGroupId != null)
			item.dataset.weightGroupId = String(node.weightGroupId);

		const row = document.createElement("div");
		row.className = "settings-row";

		item.appendChild(row);

		// Empty indentation, or a disclosure indicator for collapsible rows with children
		const leadingElement = (hasChildren && !isSeparator) ? createDisclosureIndicator() : createSpacer();
		row.appendChild(leadingElement);

		if (isSeparator) {
			// Separators need nothing further
			const line = document.createElement("div");
			line.className = "settings-separator-line";
			row.appendChild(line);
			return item;
		}

		const label = document.createElement("div");
		label.className = "settings-row-label";
		label.textContent = Localization.localize(node.textKey);

		applyTextStyleClasses(label, node);
		row.appendChild(label);

		row.appendChild(createSettingErrorIndicator());

		if (variant.hasControl) {
			row.appendChild(createSettingControls(node, item));
		}

		if (hasChildren) {
			const childrenWrap = createSettingChildrenWrap(node, depth);
			applyWeightGroupBorders(childrenWrap);
			updateWeightGroupPercentages(childrenWrap);
			item.appendChild(childrenWrap);
			row.addEventListener("click", e => onSettingsBranchClicked(e, childrenWrap));
		}

		return item;
	}

	/**
	 * Builds the complete settings panel from Settings.getRootNodes().
	 *
	 * Adds the panel-level validation indicator and performs an initial validation pass so the UI reflects the current settings immediately
	 * after construction.
	 */
	function buildSettingsUI() {
		const settingsList = document.getElementById("settingsList");

		for (const rootNode of Settings.getRootNodes()) {
			settingsList.appendChild(createSettingNode(rootNode, 0));
		}

		const settingsHeader = document.querySelector(".panel-settings > .panel-header");
		const indicator = createSettingErrorIndicator();
		indicator.id = "settingsPanelValidationIndicator";
		settingsHeader.appendChild(indicator);

		updateSettingsValidationUI();  // ensure UI state is correct on first build
	}

	/**
	 * Groups the direct child items of a settings container by weight-group ID.
	 *
	 * Items without a weight-group ID are ignored.
	 *
	 * @param {HTMLElement} wrap - Settings children container.
	 * @returns {Map<string, HTMLElement[]>} Weight-group IDs mapped to their member items.
	 */
	function getItemsByWeightGroup(wrap) {
		const weightGroups = new Map();

		for (const item of wrap.children) {
			const weightGroupId = item.dataset.weightGroupId;

			if (weightGroupId === undefined) continue;

			if (weightGroups.has(weightGroupId))
				weightGroups.get(weightGroupId).push(item);
			else
				weightGroups.set(weightGroupId, [ item ]);
		}

		return weightGroups;
	}

	/**
	 * Applies positional CSS classes to multi-item weight groups.
	 *
	 * The first and last items receive top/bottom classes, while intermediate items receive the middle class. Single-item groups are left
	 * unchanged.
	 *
	 * @param {HTMLElement} wrap - Settings children container.
	 */
	function applyWeightGroupBorders(wrap) {
		const weightGroups = getItemsByWeightGroup(wrap);

		for (const items of weightGroups.values()) {
			if (items.length <= 1) continue;  // single-item groups don't need boxing

			items[0].classList.add("settings-weightbox", "settings-weightbox-top");
			items[items.length - 1].classList.add("settings-weightbox", "settings-weightbox-bottom");

			for (let i = 1; i < items.length - 1; i++)
				items[i].classList.add("settings-weightbox", "settings-weightbox-middle");
		}
	}


	/* =========================
	   Prompt navigation controls construction
	   ========================= */

	/**
	 * Builds and inserts the prompt panel's navigation controls.
	 *
	 * Adds first/previous/next/last navigation buttons, a turn counter, and the single-turn display toggle. The toggle is initialized from
	 * promptState.
	 */
	function buildPromptNavigationControls() {
		const content = document.querySelector(".panel-output > .panel-content");
		const outputBox = document.getElementById("promptOutput");

		const nav = document.createElement("div");
		nav.className = "prompt-navigation";

		const label = document.createElement("label");
		label.className = "prompt-navigation-toggle";

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.checked = promptState.showSingleTurn;
		checkbox.id = "promptSingleTurn";

		const text = document.createElement("span");
		text.textContent = Localization.localize("UI_PROMPT_SINGLETURN");

		label.append(checkbox, text);

		const first = document.createElement("button");
		first.id = "promptFirst";
		first.className = "prompt-navigation-button";
		first.type = "button";
		first.textContent = "⏮";
		first.dataset.action = "first";

		const previous = document.createElement("button");
		previous.id = "promptPrevious";
		previous.className = "prompt-navigation-button";
		previous.type = "button";
		previous.textContent = "◀";
		previous.dataset.action = "prev";

		const counter = document.createElement("span");
		counter.id = "promptCounter";
		counter.className = "prompt-navigation-counter";
		counter.textContent = "1 / 1";

		const next = document.createElement("button");
		next.id = "promptNext";
		next.className = "prompt-navigation-button";
		next.type = "button";
		next.textContent = "▶";
		next.dataset.action = "next";

		const last = document.createElement("button");
		last.id = "promptLast";
		last.className = "prompt-navigation-button";
		last.type = "button";
		last.textContent = "⏭";
		last.dataset.action = "last";

		nav.append(label, first, previous, counter, next, last);
		content.insertBefore(nav, outputBox);
	}



/* =========================
   Role selection UI updates
   ========================= */

/**
 * Synchronizes all UI derived from the current role selection.
 *
 * Removes selections that are no longer valid, updates selection-tile visuals, refreshes the player count and visibility filters,
 * revalidates settings, persists the selection, and regenerates the narration prompt.
 */
function updateRolesUI() {
	while (sanitizeRoleSelection()) {}  // resolve invalid selections, including chains

	document.querySelectorAll(".selection-tile").forEach(tile => {
		const roleId = tile.dataset.roleId;
		updateRoleTileVisual(tile, roleId);
	});

	updatePlayerCountDisplay();
	updateDescriptionVisibility();
	updateSelectionVisibility();
	updateTokenDescriptionVisibility();

	const errors = Settings.validate({ selectedRoles: roleCounts });
	updateSettingsValidationUI(errors);
	saveSelectedRoles();
	updatePrompt(Settings.filterRelevant(errors, roleCounts));
}

/**
 * Removes any selected role that is no longer selectable.
 *
 * Returns whether the selection changed. This is used repeatedly by updateRolesUI() because removing one role can make another role
 * invalid.
 *
 * @returns {boolean} True if at least one role was deselected.
 */
function sanitizeRoleSelection() {
	let selectedRoleIds = getSelectedRoleIds();
	let changed = false;

	for (const roleId of selectedRoleIds) {
		if (!Roles.isSelectable(roleId, roleCounts)) {
			setRoleCount(roleId, 0);
			changed = true;
		}
	}

	return changed;
}

/**
 * Updates a role-selection tile to reflect its current state.
 *
 * Applies disabled, selected, and unselected classes and updates the instance-count badge. The badge is hidden when the role has no
 * selection or cannot have multiple instances.
 *
 * @param {HTMLElement} tile - Role-selection tile to update.
 * @param {string} roleId - Role ID represented by the tile.
 */
function updateRoleTileVisual(tile, roleId) {
	const count = getRoleCount(roleId);
	const selectable = Roles.isSelectable(roleId, roleCounts);
	tile.classList.toggle("selection-role-disabled", !selectable);
	tile.classList.toggle("selected", count > 0);
	tile.classList.toggle("unselected", count === 0);

	const badge = tile.querySelector(".selection-selected-count");
	if (!badge) return;

	const { minCount, maxCount } = Roles.getMinMax(roleId);
	if (maxCount <= 1 || count === 0) {
		badge.style.display = "none";
	} else {
		badge.style.display = "";
		badge.textContent = count + (maxCount != minCount ? "/" + maxCount : "");
	}
}

/**
 * Updates the displayed player count from the current role selection.
 */
function updatePlayerCountDisplay() {
	const el = document.getElementById("playerCountDisplay");
	if (!el) return;

	el.textContent = Localization.localize("UI_PLAYER_COUNT") + " " + getPlayerCount().toString();
}



/* =========================
   Search & tag filter visibility
   ========================= */

/**
 * Applies shared visibility logic to a set of tiles.
 *
 * When a search term is present, visibility is determined solely by whether the selected dataset field contains that term. Otherwise,
 * visibility is determined by the supplied callback.
 *
 * @param {NodeListOf<HTMLElement>|HTMLElement[]} tiles - Tiles to update.
 * @param {string} searchTerm - Lowercase, trimmed search text.
 * @param {string} searchAttr - Dataset field used for searching.
 * @param {function(HTMLElement): boolean} isVisibleCallback - Visibility test used when searchTerm is empty.
 */
function updateTileVisibility(tiles, searchTerm, searchAttr, isVisibleCallback) {
	tiles.forEach(tile => {
		let visible = true;

		if (searchTerm) {
			visible = tile.dataset[searchAttr].includes(searchTerm);
		} else {
			visible = isVisibleCallback(tile);
		}

		tile.classList.toggle("is-hidden", !visible);
	});
}

/**
 * Updates visibility of role-description tiles.
 *
 * Search takes priority. Without a search term, all roles are shown when no roles are selected; otherwise only currently-selected roles are
 * shown.
 */
function updateDescriptionVisibility() {
	const searchTerm = document.getElementById("roleDescriptionSearchField").value.toLowerCase().replace(/\u00AD/g, '').trim();
	const tiles = document.querySelectorAll(".description-tile");
	const hasSelection = isAnyRoleSelected();

	updateTileVisibility(tiles,  searchTerm, "roleName", tile => {
		return !hasSelection || roleIsSelected(tile.dataset.roleId);
	});
}

/**
 * Updates visibility of token-description tiles.
 *
 * Search takes priority. Without a search term, all tokens are shown when no roles are selected; otherwise only tokens active for the
 * current selection are shown.
 */
function updateTokenDescriptionVisibility() {
	const searchTerm = document.getElementById("tokenDescriptionSearchField").value.toLowerCase().replace(/\u00AD/g, '').trim();
	const tiles = document.querySelectorAll(".token-tile");
	const hasSelection = isAnyRoleSelected();
	const selectedRoleIds = getSelectedRoleIds();

	updateTileVisibility(tiles, searchTerm, "tokenName", tile => {
		return !hasSelection || Roles.isTokenActive(tile.dataset.tokenId, selectedRoleIds);
	});
}

/**
 * Returns the currently-selected role tag filters grouped by filter group.
 *
 * Groups with no selected tags are omitted from the result.
 *
 * @returns {{[groupId: string]: string[]}} Selected tags keyed by group ID.
 */
function getSelectedTagFilters() {
	const result = {};

	document.querySelectorAll(".selection-filter-option.selected").forEach(tile => {
		const groupId = tile.dataset.group;
		const tag = tile.dataset.tag;

		if (!result[groupId]) {
			result[groupId] = [];
		}

		result[groupId].push(tag);
	});

	return result;
}

/**
 * Tests whether a role matches all active filter groups.
 *
 * A role must match at least one selected tag within every group. Groups with no selected tags are ignored.
 *
 * @param {string} roleId - Role ID to test.
 * @param {{[groupId: string]: string[]}} groupedFilters - Selected tags by group.
 * @returns {boolean} True if the role matches all active groups.
 */
function roleMatchesAllFilterGroups(roleId, groupedFilters) {
	for (const groupId in groupedFilters) {
		const selectedTags = groupedFilters[groupId];

		if (!selectedTags || selectedTags.length === 0) continue;  // nothing selected in this group -> ignore it

		const matchesGroup = selectedTags.some(tag => Roles.hasTag(roleId, tag));
		if (!matchesGroup) {
			return false;
		}
	}

	return true;
}

/**
 * Updates visibility of role-selection tiles.
 *
 * Search takes priority. Without a search term, a role is visible when it matches every active filter group or is already selected.
 * Selected roles therefore remain visible when tag filters are applied.
 */
function updateSelectionVisibility() {
	const searchTerm = document.getElementById("roleSelectionSearchField").value.toLowerCase().replace(/\u00AD/g, '').trim();
	const tiles = document.querySelectorAll(".selection-tile");
	const tagFilters = getSelectedTagFilters();

	updateTileVisibility(tiles, searchTerm, "roleName", tile => {
		const roleId = tile.dataset.roleId;
		return roleMatchesAllFilterGroups(roleId, tagFilters) || roleIsSelected(roleId);
	});
}

/**
 * Toggles a tag-filter tile between selected and unselected.
 *
 * @param {HTMLElement} tile - Filter tile to toggle.
 */
function toggleTagFilterTileState(tile) {
	const isSelected = tile.classList.contains("selected");
	setTagFilterTileState(tile, !isSelected);
}

/**
 * Sets a tag-filter tile's selected state and refreshes role-selection visibility.
 *
 * @param {HTMLElement} tile - Filter tile to update.
 * @param {boolean} isSelected - Desired selected state.
 */
function setTagFilterTileState(tile, isSelected) {
	tile.classList.toggle("selected", isSelected);
	tile.classList.toggle("unselected", !isSelected);
	updateSelectionVisibility();
}



/* =========================
   Game script & narration

   Rules.buildPrompt() produces structured turns. Interpreter.compileAll() converts those turns into the single structural narration dataset
   stored in promptState. The GUI chooses the presentation: manual text is rendered through Interpreter on demand, while automatic narration
   is delegated to Narration.
   ========================= */

/**
 * Regenerates the shared narration data from the current role selection.
 *
 * Stops any active narration and resets the speech overlay before rebuilding. Validation errors or insufficient players prevent prompt
 * generation and instead display a localized explanatory message. Successfully generated turns are compiled by Interpreter and empty turns
 * are removed so manual and automatic narration use the same turn indexes.
 *
 * @param {object[]|undefined} relevantErrors - Relevant Settings validation errors; a non-empty array prevents prompt generation.
 */
function updatePrompt(relevantErrors) {
	// Replaces the current prompt with an unavailable/error message and clears the associated narration state.
	function _showPromptUnavailable(message) {
		promptState.narrationData = [];
		setCurrentTurn(0, false);

		document.getElementById("promptOutput").value = message;

		updatePromptNavigation();
		resizePromptBox();
	}

	Narration.stop();
	resetSpeechOverlay();
	closeSpeechOverlay();

	if (relevantErrors && relevantErrors.length > 0) {
		console.warn("Invalid settings for current role selection:", relevantErrors);
		_showPromptUnavailable(Localization.localize("UI_PROMPT_ERROR_INVALID_SETTINGS"));
		return;
	}

	try {
		const { turns, insufficientPlayers } = Rules.buildPrompt(new Map(roleCounts));

		if (insufficientPlayers) {
			_showPromptUnavailable(Localization.localize("UI_PROMPT_ERROR_INSUFFICIENT_PLAYERS"));
			return;
		}

		// Drop turns that render to nothing, so every consumer indexes the same array and no index translation is needed.
		// Relies on manual narration covering every outcome, so a turn empty in manual mode should be empty in automatic too.
		promptState.narrationData = Interpreter.compileAll(turns).filter(narration => Interpreter.renderText(narration, "verbose").trim() !== "");

		setCurrentTurn(promptState.currentTurn); // preserve current turn, clamped to a valid index

	} catch (error) {
		console.error(error);
		_showPromptUnavailable(String(error));
	}
}


	/* =========================
	   Text script
	   ========================= */

	/**
	 * Updates the prompt navigation controls to match the current script state.
	 *
	 * The turn counter is shown only in single-turn mode. Navigation buttons are enabled only when single-turn mode is active and movement
	 * in that direction is possible.
	 */
	function updatePromptNavigation() {
		const label = document.getElementById("promptCounter");
		const turnCount = promptState.narrationData.length;

		if (promptState.showSingleTurn) {
			label.textContent = turnCount > 0 ? `${promptState.currentTurn + 1} / ${turnCount}` : "-";
		} else {
			label.textContent = "-";
		}

		document.getElementById("promptFirst").disabled = !promptState.showSingleTurn || promptState.currentTurn <= 0;
		document.getElementById("promptPrevious").disabled = !promptState.showSingleTurn || promptState.currentTurn <= 0;
		document.getElementById("promptNext").disabled = !promptState.showSingleTurn || promptState.currentTurn >= promptState.narrationData.length - 1;
		document.getElementById("promptLast").disabled = !promptState.showSingleTurn || promptState.currentTurn >= promptState.narrationData.length - 1;
	}

	/**
	 * Sets the current prompt turn, clamping the index to the available turns.
	 *
	 * @param {number} value - Target zero-based turn index.
	 * @param {boolean} rerender - Whether to immediately re-render the prompt.
	 */
	function setCurrentTurn(value, rerender = true) {
		const lastTurn = promptState.narrationData.length - 1;
		promptState.currentTurn = Math.max(Math.min(value, lastTurn), 0);

		if (rerender)
			renderPrompt();
	}

	/**
	 * Renders the current narration data into the text-script output.
	 *
	 * In normal mode all turns are rendered; in single-turn mode only the current turn is rendered. Text is generated from the structural
	 * narration data through Interpreter rather than stored separately.
	 */
	function renderPrompt() {
		const outputBox = document.getElementById("promptOutput");

		if (!promptState.showSingleTurn) {
			outputBox.value = promptState.narrationData.map(narration => Interpreter.renderText(narration, "verbose")).join("\n\n");
		} else {
			const narration = promptState.narrationData[promptState.currentTurn];
			outputBox.value = narration ? Interpreter.renderText(narration, "verbose") : "";
		}

		updatePromptNavigation();
		resizePromptBox();
	}

	/**
	 * Resizes the prompt output field to fit its current contents.
	 */
	function resizePromptBox() {
		const outputBox = document.getElementById("promptOutput");
		outputBox.style.height = "auto";
		outputBox.style.height = outputBox.scrollHeight + "px";
	}


	/* =========================
	   Speech narration
	   ========================= */

	/**
	 * Starts automatic narration of the current prompt.
	 *
	 * Resets the current turn to the beginning, opens the speech overlay, and passes the shared structural narration data to Narration with
	 * callbacks for speech, pauses, turns, and user inputs. Does nothing when there is no narration data.
	 */
	function speakPrompt() {
		Interpreter.refreshPauseSettings();
		setCurrentTurn(0);

		if (promptState.narrationData.length === 0) {
			return;
		}

		openSpeechOverlay();
		resetSpeechOverlay();

		Narration.play(promptState.narrationData, {
				onSpeaking: clbkSpeechSpeaking,
				onPause: clbkSpeechPause,
				onTurnComplete: clbkSpeechTurnComplete,
				onFinished: clbkSpeechFinished,
				onInputStart: clbkSpeechInputStart,
				onInputCountdown: clbkSpeechInputCountdown,
				onInputResolved: clbkSpeechInputResolved,
			}
		);

		updateSpeechOverlayControls();
	}

	/**
	 * Updates the speech overlay when a text segment begins speaking.
	 *
	 * @param {string} text - Text currently being spoken.
	 */
	function clbkSpeechSpeaking(text) {
		const state = document.getElementById("speechOverlayState");
		const textElement = document.getElementById("speechOverlayText");
		const countdown = document.getElementById("speechOverlayCountdown");

		state.textContent = Localization.localize("UI_SPEECH_SPEAKING");
		textElement.textContent = text;
		countdown.textContent = "";
	}

	/**
	 * Updates the speech overlay countdown during a normal narration pause.
	 *
	 * @param {number} secondsRemaining - Seconds remaining in the pause.
	 */
	function clbkSpeechPause(secondsRemaining) {
		const state = document.getElementById("speechOverlayState");
		const countdown = document.getElementById("speechOverlayCountdown");

		state.textContent = Localization.localize("UI_SPEECH_WAITING");
		countdown.textContent = `${Math.ceil(secondsRemaining)} s`;
	}

	/**
	 * Advances the displayed script position when a narration turn finishes.
	 *
	 * @param {number} turnIndex - Zero-based index of the completed turn.
	 */
	function clbkSpeechTurnComplete(turnIndex) {
		setCurrentTurn(turnIndex + 1, promptState.showSingleTurn);
	}

	/**
	 * Resets and closes the speech overlay after narration finishes normally.
	 */
	function clbkSpeechFinished() {
		resetSpeechOverlay();
		closeSpeechOverlay();
		updateSpeechOverlayControls();
	}

	/**
	 * Displays the available choices when narration reaches an input prompt.
	 *
	 * Creates one button per option. Selecting a button records its value through Narration.selectInput() and marks that button as
	 * selected. The narration wait itself continues for its full duration.
	 *
	 * @param {object} field - Input field descriptor supplied by Narration.
	 * @param {object[]} options - Available input options, each containing a label and value.
	 */
	function clbkSpeechInputStart(field, options) {
		const state = document.getElementById("speechOverlayState");
		const countdown = document.getElementById("speechOverlayCountdown");
		const optionsContainer = document.getElementById("speechOverlayOptions");

		state.textContent = Localization.localize("UI_SPEECH_INPUT");
		countdown.classList.add("speech-overlay-countdown-compact");

		optionsContainer.replaceChildren();
		options.forEach(option => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "speech-overlay-option";
			button.textContent = option.label;
			button.addEventListener("click", () => {
				Narration.selectInput(option.value);
				optionsContainer.querySelectorAll(".speech-overlay-option")
					.forEach(b => b.classList.toggle("selected", b === button));
			});
			optionsContainer.appendChild(button);
		});
	}

	/**
	 * Updates the countdown displayed while a narration input prompt is active.
	 *
	 * @param {number} secondsRemaining - Seconds remaining in the input wait.
	 */
	function clbkSpeechInputCountdown(secondsRemaining) {
		document.getElementById("speechOverlayCountdown").textContent = `${Math.ceil(secondsRemaining)} s`;
	}

	/**
	 * Clears the input controls after an input prompt has resolved.
	 *
	 * @param {object} field - Input field descriptor supplied by Narration.
	 * @param {*} value - Value bound by the resolved input.
	 */
	function clbkSpeechInputResolved(field, value) {
		document.getElementById("speechOverlayOptions").replaceChildren();
		document.getElementById("speechOverlayCountdown").classList.remove("speech-overlay-countdown-compact");
	}

	/**
	 * Shows the speech narration overlay.
	 *
	 * Does nothing when the overlay element is unavailable.
	 */
	function openSpeechOverlay() {
		const overlay = document.getElementById("speechOverlay");
		if (!overlay) return;

		overlay.classList.add("visible");
		overlay.setAttribute("aria-hidden", "false");
	}

	/**
	 * Hides the speech narration overlay.
	 *
	 * Does nothing when the overlay element is unavailable.
	 */
	function closeSpeechOverlay() {
		const overlay = document.getElementById("speechOverlay");
		if (!overlay) return;

		overlay.classList.remove("visible");
		overlay.setAttribute("aria-hidden", "true");
	}

	/**
	 * Clears all transient speech-overlay content and returns it to its idle state.
	 *
	 * Removes the displayed state/text/countdown and any input-choice buttons.
	 */
	function resetSpeechOverlay() {
		document.getElementById("speechOverlayState").textContent = "";
		document.getElementById("speechOverlayText").textContent = "";
		document.getElementById("speechOverlayCountdown").textContent = "";
		document.getElementById("speechOverlayCountdown").classList.remove("speech-overlay-countdown-compact");
		document.getElementById("speechOverlayOptions").replaceChildren();
	}

	/**
	 * Synchronizes the speech-overlay controls with the current Narration state.
	 *
	 * Both controls are disabled when narration is inactive. The pause button shows the appropriate pause or resume symbol and accessible
	 * label according to the current paused state.
	 */
	function updateSpeechOverlayControls() {
		const pauseBtn = document.getElementById("btn-speech-overlay-pause");
		const stopBtn = document.getElementById("btn-speech-overlay-stop");

		if (!pauseBtn || !stopBtn) return;

		const active = Narration.isActive();
		const paused = Narration.isPaused();

		pauseBtn.textContent = paused ? "▶" : "⏸";
		pauseBtn.setAttribute("aria-label", paused ? "Resume" : "Pause");

		pauseBtn.disabled = !active;
		stopBtn.disabled = !active;
	}



/* =========================
   Modal overlay
   ========================= */

/**
 * Shows the modal overlay.
 */
function openModalOverlay() {
	const overlay = document.getElementById("modalOverlay");
	overlay.classList.remove("hidden");
}

/**
 * Hides the modal overlay and clears its current contents.
 */
function closeModalOverlay() {
	const overlay = document.getElementById("modalOverlay");
	overlay.classList.add("hidden");
	document.getElementById("modalOverlayContainer").replaceChildren();
}



/* =========================
   Settings validation & updates
   ========================= */

/**
 * Updates the displayed percentage for each weight input in a group.
 *
 * Percentages are calculated from the current input values and are display-only; actual validation is handled separately by
 * Settings.validate().
 *
 * @param {HTMLElement} wrap - Settings container containing the weight groups.
 */
function updateWeightGroupPercentages(wrap) {
	const weightGroups = getItemsByWeightGroup(wrap);

	for (const items of weightGroups.values()) {
		let sum = 0;
		for (const item of items) {
			const v = parseInt(item.querySelector('input[type="number"]').value, 10);
			if (Number.isFinite(v) && v > 0) sum += v;
		}
		for (const item of items) {
			const input = item.querySelector('input[type="number"]');
			const pctEl = item.querySelector(".settings-weight-label");
			if (!pctEl) continue;
			const v = parseInt(input.value, 10);
			pctEl.textContent = (!Number.isFinite(v) || v <= 0 || sum <= 0)
				? "0%"
				: `${Math.round((v / sum) * 1000) / 10}%`;
		}
	}
}

/**
 * Refreshes the displayed percentages for every settings weight group.
 */
function updateAllWeightPercentages() {
	document.querySelectorAll(".settings-childrenwrap").forEach(updateWeightGroupPercentages);
}

/**
 * Refreshes matching settings inputs from their current Settings values.
 *
 * The supplied callback determines how each value is applied to its input. Inputs whose setting OID is invalid are skipped with a warning.
 *
 * @param {string} selector - CSS selector identifying the inputs to refresh.
 * @param {function(HTMLElement, *): void} applyFn - Applies a setting value to an input.
 */
function refreshInputsFromState(selector, applyFn) {
	document.querySelectorAll(selector).forEach(input => {
		const oid = input.dataset.settingOid;
		try {
			applyFn(input, Settings.getValue(oid));
		} catch {
			// Defensive only - every input should always have a valid oid from the same tree Settings walks
			console.warn(`Unable to refresh input for unknown setting oid: ${oid}`);
		}
	});
}

/**
 * Synchronizes all settings inputs and related UI with the current Settings state.
 *
 * Refreshes numeric and checkbox inputs, recalculates weight-group percentages, and updates validation state.
 */
function refreshSettingsUIFromState() {
	refreshInputsFromState('input[type="number"][data-setting-oid]', (input, v) => input.value = String(v));
	refreshInputsFromState('input[type="checkbox"][data-setting-oid]', (input, v) => input.checked = Boolean(v));

	updateAllWeightPercentages();
	updateSettingsUI();
}

/**
 * Rebuilds validation state across the settings tree.
 *
 * Groups validation errors by setting OID, recursively applies them to the corresponding rows, and updates the panel-level error indicator
 * with the complete error set.
 *
 * @param {object[]} errors - Validation errors returned by Settings.validate().
 */
function updateSettingsValidationUI(errors = []) {
	const byOid = new Map();
	for (const err of errors) {
		if (!byOid.has(err.oid))
			byOid.set(err.oid, []);

		byOid.get(err.oid).push(err);
	}

	const root = document.getElementById("settingsList");
	let collectedErrors = [];

	for (const item of root.children)
		collectedErrors.push(...updateSettingsValidationNode(item, byOid));

	updateSettingsPanelValidation(collectedErrors);
}

/**
 * Clears the current validation styling from a settings row and its direct weight-group children.
 *
 * This runs before current errors are re-applied.
 *
 * @param {HTMLElement} item - Settings row to clear.
 */
function clearValidationState(item) {
	item.classList.remove("settings-has-errors");

	const childrenWrap = item.querySelector(":scope > .settings-childrenwrap");

	if (childrenWrap) {
		for (const child of childrenWrap.children)
			child.classList.remove("settings-weightbox-error");
	}
}

/**
 * Marks a settings row as having a value error.
 *
 * @param {HTMLElement} item - Settings row to mark.
 * @param {object} err - Validation error being rendered.
 */
function renderValueError(item, err) {
	item.classList.add("settings-has-errors");
}

/**
 * Marks a settings row and its members of the affected weight group as invalid.
 *
 * @param {HTMLElement} item - Settings row associated with the error.
 * @param {object} err - Validation error containing the weightGroupId.
 */
function renderWeightGroupError(item, err) {
	item.classList.add("settings-has-errors");

	const gid = String(err.data.weightGroupId);

	const childrenWrap = item.querySelector(":scope > .settings-childrenwrap");
	if (!childrenWrap)
		return;

	for (const child of childrenWrap.children) {
		if (child.dataset.weightGroupId === gid)
			child.classList.add("settings-weightbox-error");
	}
}

/**
 * Applies the appropriate DOM renderer for a validation error type.
 *
 * Unknown error types are logged and ignored rather than preventing other validation errors from being rendered.
 *
 * @param {HTMLElement} item - Settings row associated with the error.
 * @param {object} err - Validation error to render.
 */
function applyValidationError(item, err) {
	const renderer = VALIDATION_RENDERERS[err.errorType];
	if (renderer)
		renderer(item, err);
	else
		console.warn(`Unknown validation error type '${err.errorType}'`);
}

/**
 * Updates a validation indicator with its current error count and error data.
 *
 * The errors are stored on the indicator element for retrieval when the user opens the corresponding validation panel. A null target is
 * ignored.
 *
 * @param {HTMLElement|null} target - Validation indicator to update.
 * @param {object[]} errors - Errors represented by the indicator.
 */
function updateValidationIcon(target, errors) {
	if (!target) return;

	target.querySelector(".settings-validation-count").textContent = String(errors.length);
	target.style.display = errors.length ? "" : "none";
	target._validationErrors = errors.length ? errors : null;
}

/** Updates the validation indicator for an individual settings row. */
function updateItemValidationIcon(item, errors) {
	const indicator = item.querySelector(":scope > .settings-row > .settings-validation-indicator");
	updateValidationIcon(indicator, errors);
}

/** Updates the validation indicator for the settings panel as a whole. */
function updateSettingsPanelValidation(errors) {
	const indicator = document.getElementById("settingsPanelValidationIndicator");
	updateValidationIcon(indicator, errors);
}

/**
 * Recursively applies validation errors to a settings subtree.
 *
 * Child errors are processed first, then errors belonging to the current node are rendered. The function returns all errors found in the
 * subtree so they can be propagated to the parent and ultimately to the panel-level indicator.
 *
 * @param {HTMLElement} item - Settings node DOM element.
 * @param {Map<string, object[]>} byOid - Validation errors grouped by setting OID.
 * @returns {object[]} All validation errors belonging to this subtree.
 */
function updateSettingsValidationNode(item, byOid) {
	const propagatedErrors = [];

	const childrenWrap = item.querySelector(":scope > .settings-childrenwrap");
	if (childrenWrap) {
		for (const child of childrenWrap.children) {
			const childErrors = updateSettingsValidationNode(child, byOid);
			propagatedErrors.push(...childErrors);
		}
	}

	const ownErrors = byOid.get(item.dataset.settingOid) ?? [];

	clearValidationState(item);

	for (const err of ownErrors)
		applyValidationError(item, err);

	const allErrors = [ ...ownErrors, ...propagatedErrors ];

	updateItemValidationIcon(item, allErrors);

	return allErrors;
}

/**
 * Revalidates the current settings, refreshes validation indicators, and regenerates the narration prompt using only errors relevant to the
 * current role selection.
 */
function updateSettingsUI() {
	const errors = Settings.validate({ selectedRoles: roleCounts });
	updateSettingsValidationUI(errors);
	updatePrompt(Settings.filterRelevant(errors, roleCounts));
}



/* =========================
   Adaptive layout/scaling
   ========================= */

/**
 * Returns the usable viewport dimensions.
 *
 * Uses the Visual Viewport API when available and otherwise falls back to the window's inner dimensions.
 *
 * @returns {{width: number, height: number}} Usable viewport dimensions.
 */
function getUsableViewport() {
	if (window.visualViewport) {
		return {
			width: window.visualViewport.width,
			height: window.visualViewport.height
		};
	}

	return {
		width: window.innerWidth,
		height: window.innerHeight
	};
}

/**
 * Recalculates GUI scale factors from the current viewport size.
 *
 * Uses the smaller viewport dimension as the basis and clamps separate scale ranges for role selection tiles, role descriptions, and speech
 * text. The resulting values are written to CSS custom properties.
 */
function updateGUIScale() {
	const { width, height } = getUsableViewport();
	const minViewport = Math.min(width, height);

	const MIN_SELECT_SCALE = 0.5;
	const MAX_SELECT_SCALE = 1.0;
	const MIN_DESCRIPTION_SCALE = 0.75;
	const MAX_DESCRIPTION_SCALE = 1.0;
	const MIN_TTS_SCALE = 0.2;
	const MAX_TTS_SCALE = 1.0;
	const SELECT_BASE_SIZE = 800;
	const DESCRIPTION_BASE_SIZE = 800;
	const TTS_BASE_SIZE = 800;

	let selectScale = minViewport / SELECT_BASE_SIZE;
	selectScale = Math.max(MIN_SELECT_SCALE, Math.min(MAX_SELECT_SCALE, selectScale));
	let descriptionScale = minViewport / DESCRIPTION_BASE_SIZE;
	descriptionScale = Math.max(MIN_DESCRIPTION_SCALE, Math.min(MAX_DESCRIPTION_SCALE, descriptionScale));
	let ttsScale = minViewport / TTS_BASE_SIZE;
	ttsScale = Math.max(MIN_TTS_SCALE, Math.min(MAX_TTS_SCALE, ttsScale));

	document.documentElement.style.setProperty("--selection-tile-scale", selectScale.toFixed(3));
	document.documentElement.style.setProperty("--description-tile-scale", descriptionScale.toFixed(3));
	document.documentElement.style.setProperty("--tts-text-scale", ttsScale.toFixed(3));
}



/* =========================
   Printing
   ========================= */

/**
 * Prints the page while temporarily hiding the supplied elements.
 *
 * The elements are marked with the do-not-print class before printing and restored automatically after the browser's afterprint event.
 *
 * @param {HTMLElement[]} elements - Elements to hide during printing.
 */
function printWithHiddenElements(elements) {
	elements.forEach(el => el.classList.add("do-not-print"));

	const cleanup = () => {
		elements.forEach(el => el.classList.remove("do-not-print"));
		window.removeEventListener("afterprint", cleanup);
	};

	window.addEventListener("afterprint", cleanup);
	window.print();
}



/* =========================
   Day timer
   ========================= */

/**
 * Returns the timer's current remaining time in seconds.
 *
 * While running, derives the value from targetTimestamp to avoid interval drift. Otherwise returns the stored remaining value.
 *
 * @returns {number} Remaining seconds, clamped to zero.
 */
function getDayTimerRemainingSeconds() {
	if (dayTimer.state === "running" && dayTimer.targetTimestamp != null) {
		return Math.max(0, Math.round((dayTimer.targetTimestamp - Date.now()) / 1000));
	}
	return dayTimer.remaining;
}

/**
 * Formats a duration as MM:SS.
 *
 * @param {number} totalSeconds - Duration in seconds.
 * @returns {string} Zero-padded MM:SS value.
 */
function formatDayTimerTime(totalSeconds) {
	const clamped = Math.max(0, Math.round(totalSeconds));
	const minutes = Math.floor(clamped / 60);
	const seconds = clamped % 60;
	return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

/**
 * Starts or resumes the day timer from its current remaining time.
 *
 * Does nothing when already running or when no time remains.
 */
function startDayTimer() {
	if (dayTimer.state === "running" || dayTimer.remaining <= 0) return;

    if (dayTimer.state === "stopped")
        initializeDayTimerWarnings(dayTimer.remaining);

	dayTimer.targetTimestamp = Date.now() + dayTimer.remaining * 1000;
	dayTimer.state = "running";
	document.getElementById("btn-speech-start").disabled = (dayTimer.state == "stopped" ? false : true);

	ensureDayTimerInterval();
	updateDayTimerUI();
	saveDayTimer();
}

/**
 * Pauses a running timer, preserving its current remaining time.
 *
 * The wall-clock target and redraw interval are cleared until the timer is resumed.
 */
function pauseDayTimer() {
	if (dayTimer.state !== "running") return;

	dayTimer.remaining = getDayTimerRemainingSeconds();
	dayTimer.targetTimestamp = null;
	dayTimer.state = "paused";
	document.getElementById("btn-speech-start").disabled = (dayTimer.state == "stopped" ? false : true);

	clearDayTimerInterval();
	updateDayTimerUI();
	saveDayTimer();
}

/**
 * Stops the timer and resets its remaining time to the configured duration.
 */
function stopDayTimer() {
	dayTimer.state = "stopped";
	dayTimer.targetTimestamp = null;
	dayTimer.remaining = dayTimer.duration;
	document.getElementById("btn-speech-start").disabled = (dayTimer.state == "stopped" ? false : true);

	clearDayTimerInterval();
	updateDayTimerUI();
	saveDayTimer();
}

/**
 * Adjusts the timer by the specified number of seconds.
 *
 * Running timers adjust their target timestamp; stopped and paused timers adjust their stored remaining time. Values are clamped to zero,
 * and a stopped timer also updates its configured duration.
 *
 * @param {number} deltaSeconds - Number of seconds to add or subtract.
 */
function adjustDayTimer(deltaSeconds) {
	if (dayTimer.state === "running") {
		dayTimer.targetTimestamp = Math.max(Date.now(), dayTimer.targetTimestamp + deltaSeconds * 1000);
	} else {
		dayTimer.remaining = Math.max(0, dayTimer.remaining + deltaSeconds);
		if (dayTimer.state === "stopped")
			dayTimer.duration = dayTimer.remaining;
	}

	updateDayTimerUI();
	saveDayTimer();
}

/**
 * Sets an explicit timer duration.
 *
 * Only stopped and paused timers can be changed. The value is rounded and clamped to zero; while stopped, it also becomes the configured
 * duration.
 *
 * @param {number} totalSeconds - New duration in seconds.
 */
function setDayTimerDuration(totalSeconds) {
	if (dayTimer.state === "running") return;

	const clamped = Math.max(0, Math.round(totalSeconds));
	dayTimer.remaining = clamped;
	if (dayTimer.state === "stopped")
		dayTimer.duration = clamped;

	updateDayTimerUI();
	saveDayTimer();
}

/**
 * Starts the timer's display-redraw interval if one is not already active.
 */
function ensureDayTimerInterval() {
	if (dayTimer.intervalId != null) return;
	dayTimer.intervalId = setInterval(tickDayTimer, DAY_TIMER_TICK_INTERVAL);
}

/**
 * Stops the timer's display-redraw interval, if active.
 */
function clearDayTimerInterval() {
	if (dayTimer.intervalId == null) return;
	clearInterval(dayTimer.intervalId);
	dayTimer.intervalId = null;
}

/**
 * Updates the running timer display and handles timer expiration.
 *
 * While time remains, refreshes the UI and processes pending warning thresholds. At zero, stops the timer, persists the final state, and
 * plays the configured time-up announcement.
 */
function tickDayTimer() {
	const remaining = getDayTimerRemainingSeconds();

    if (remaining > 0) {
		processDayTimerWarnings(remaining);
		updateDayTimerUI();
		return;
	}

	dayTimer.state = "stopped";
	dayTimer.targetTimestamp = null;
	dayTimer.remaining = 0;
	document.getElementById("btn-speech-start").disabled = (dayTimer.state == "stopped" ? false : true);

	clearDayTimerInterval();
	updateDayTimerUI();
	saveDayTimer();

	playDayTimerTimeUpAnnouncement();
}

/**
 * Refreshes the timer pill, editable time field, and start/pause button to match the current timer state.
 *
 * The editable time field is not overwritten while it has focus, allowing an in-progress manual edit to complete.
 */
function updateDayTimerUI() {
	const isRunning = dayTimer.state === "running";
	const timeText = formatDayTimerTime(getDayTimerRemainingSeconds());

	const pillText = document.getElementById("dayTimerPillText");
	if (pillText)
		pillText.textContent = (dayTimer.state === "stopped") ? Localization.localize("UI_DAYTIMER_START") : timeText;

	const display = document.getElementById("dayTimerDisplay");
	if (display) {
		// Only overwrite the field's value when it isn't the active element, so a redraw doesn't fight an in-progress edit
		if (document.activeElement !== display)
			display.value = timeText;
		display.disabled = isRunning;
	}

	const toggleBtn = document.getElementById("dayTimerToggle");
	if (toggleBtn)
		toggleBtn.textContent = isRunning ? "⏸" : "▶";
}

/**
 * Expands the day-timer panel and reserves space for it in the page layout.
 */
function expandDayTimer() {
	dayTimer.expanded = true;
	document.body.classList.add("day-timer-expanded");
	updateDayTimerSpacer();
}

/**
 * Collapses the day-timer panel back to its floating pill.
 */
function collapseDayTimer() {
	dayTimer.expanded = false;
	document.body.classList.remove("day-timer-expanded");
	updateDayTimerSpacer();
}

/**
 * Updates the page spacer to match the expanded timer panel's rendered height.
 *
 * Measurement is deferred until the next animation frame so the panel's layout change has taken effect before its height is measured.
 */
function updateDayTimerSpacer() {
	const spacer = document.getElementById("dayTimerSpacer");
	const panel = document.getElementById("dayTimerPanel");
	if (!spacer || !panel) return;

	// Deferred a frame so the panel's display change (via the body class) has taken effect before measuring it
	requestAnimationFrame(() => {
		spacer.style.height = dayTimer.expanded ? panel.getBoundingClientRect().height + "px" : "0px";
	});
}

/**
 * Initializes the pending timer warnings for a new timer run.
 *
 * Includes only thresholds that are within the initial duration and whose corresponding narration setting is enabled. Warnings are ordered
 * from the highest threshold to the lowest.
 *
 * @param {number} initialSeconds - Timer duration at the start of the run.
 */
function initializeDayTimerWarnings(initialSeconds) {
    dayTimer.warnings = DAY_TIMER_WARNINGS
        .filter(warning => (warning.threshold <= initialSeconds) && Settings.getValue(warning.playSetting))
        .sort((a, b) => b.threshold - a.threshold);
}

/**
 * Processes pending warning thresholds for the current remaining time.
 *
 * Each threshold is removed once reached. Warnings crossed within the configured grace period are announced; thresholds crossed by more
 * than that are skipped.
 *
 * @param {number} remaining - Current remaining time in seconds.
 */
function processDayTimerWarnings(remaining) {
    while (dayTimer.warnings.length > 0) {
        const warning = dayTimer.warnings[0];

        if (remaining > warning.threshold)
            return;

        dayTimer.warnings.shift();

        if (remaining >= warning.threshold - DAY_TIMER_WARNING_GRACE_SECONDS) {
            Narration.playAnnouncement(warning.text);
        }
    }
}

/**
 * Plays the configured announcement when the day timer reaches zero.
 */
function playDayTimerTimeUpAnnouncement() {
	if (Settings.getValue("narration.play_timer_expired"))
		Narration.playAnnouncement("UI_DAYTIMER_EXPIRED");
}




/* =========================
   Event listeners
   ========================= */

/** Starts narration from the current prompt. */
function onSpeechStartClicked() {
	speakPrompt();
}

/** If narration is active, toggles speech narration between paused and resumed states. */
function onSpeechOverlayPauseClicked() {
	if (!Narration.isActive())
		return;

	if (Narration.isPaused())
		Narration.resume();
	else
		Narration.pause();

	updateSpeechOverlayControls();
}

/** Stops speech narration and resets/closes its overlay. */
function onSpeechOverlayStopClicked() {
	Narration.stop();

	resetSpeechOverlay();
	closeSpeechOverlay();

	updateSpeechOverlayControls();
}

/** Expands the day-timer panel. */
function onDayTimerPillClicked() {
	expandDayTimer();
}

/** Collapses the day-timer panel. */
function onDayTimerCollapseClicked() {
	collapseDayTimer();
}

/** Toggles the day timer between running and paused/stopped states. */
function onDayTimerToggleClicked() {
	if (dayTimer.state === "running")
		pauseDayTimer();
	else
		startDayTimer();
}

/** Stops and resets the day timer. */
function onDayTimerStopClicked() {
	stopDayTimer();
}

/**
 * Adjusts the day timer by the supplied number of seconds.
 *
 * @param {number} deltaSeconds - Amount of time to add or subtract.
 */
function onDayTimerAdjustClicked(deltaSeconds) {
	adjustDayTimer(deltaSeconds);
}

/**
 * Commits a manually entered MM:SS timer value.
 *
 * Invalid or incomplete input is discarded and the displayed value is restored from the current timer state. Changes are ignored while the
 * timer is running.
 *
 * @param {Event} e - Change event from the timer display field.
 */
function onDayTimerDisplayChange(e) {
	if (dayTimer.state === "running") return;

	const match = e.target.value.trim().match(/^(\d{1,3}):([0-5]?\d)$/);

	if (!match) {
		updateDayTimerUI();  // invalid input, revert the field back to the current value
		return;
	}

	const minutes = parseInt(match[1], 10);
	const seconds = parseInt(match[2], 10);
	setDayTimerDuration(minutes * 60 + seconds);
}

/**
 * Applies the selected language and reloads the page so all generated content is rebuilt using the new language.
 *
 * @param {Event} e - Change event from the language selector.
 */
function onLanguageSelect(e) {
	const lang = e.target.value;
	Localization.setLanguage(lang);
	window.location.reload();
}

/** Clears all selected roles and refreshes the role-selection UI. */
function onSelectedRolesReset() {
	const tiles = document.querySelectorAll(".selection-tile");

	tiles.forEach(tile => {
		const roleId = tile.dataset.roleId;
		setRoleCount(roleId, 0);
	});

	updateRolesUI();
}

/**
 * Selects or cycles the instance count for a role-selection tile.
 *
 * A click progresses from unselected through the role's allowed counts and back to unselected. Roles that are currently unavailable are
 * ignored.
 *
 * @param {object} role - Role definition associated with the clicked tile.
 */
function onSelectionTileClicked(role) {
	if (!Roles.isSelectable(role, roleCounts)) return;

	const current = getRoleCount(role.id);

	const { minCount, maxCount } = Roles.getMinMax(role);
	let next;
	if (current === 0)
		next = minCount;
	else if (current < maxCount)
		next = current + 1;
	else
		next = 0;

	setRoleCount(role.id, next);
	updateRolesUI();
}

/** Refreshes role-selection tile visibility after a search change. */
function onSelectionSearchInput() {
	updateSelectionVisibility();
}

/** Refreshes role-description tile visibility after a search change. */
function onDescriptionSearchInput() {
	updateDescriptionVisibility();
}

/** Refreshes token-description tile visibility after a search change. */
function onTokenDescriptionSearchInput() {
	updateTokenDescriptionVisibility();
}

/**
 * Toggles a role tag filter and persists the new filter state.
 *
 * @param {Event} e - Click event from the filter tile.
 */
function onTagFilterClicked(e) {
	const tile = e.currentTarget;
	toggleTagFilterTileState(tile);
	saveTagFilters();
}

/**
 * Builds and opens the role-description modal.
 *
 * @param {object} role - Role definition to display.
 */
function onOpenModalRoleDescription(role) {
	buildModalRoleDescription(role);
	openModalOverlay();
}

/** Closes the modal overlay. */
function onCloseModalOverlay() {
	closeModalOverlay();
}

/** Resets Settings to their defaults and refreshes the settings UI. */
function onSettingsReset() {
	Settings.reset();
	refreshSettingsUIFromState();
}

/**
 * Toggles the expanded state of a settings node's child rows.
 *
 * Input and button controls within the row are ignored so interacting with them does not also toggle the branch.
 *
 * @param {Event} e - Click event on the settings row.
 * @param {HTMLElement} childrenWrap - Child-row container controlled by the row.
 */
function onSettingsBranchClicked(e, childrenWrap) {
	if (e.target.closest("button, input, select, textarea, label"))
		return;

	e.preventDefault();
	e.stopPropagation();

	const row = e.currentTarget;
	const disclosure = row.querySelector(".settings-row-disclosure");

	const collapsed = childrenWrap.dataset.collapsed === "true";
	childrenWrap.dataset.collapsed = collapsed ? "false" : "true";
	childrenWrap.style.display = collapsed ? "" : "none";
	disclosure.textContent = collapsed ? "▼" : "▶";
	disclosure.dataset.expanded = collapsed ? "true" : "false";
}

/**
 * Opens the validation-error modal for the clicked indicator.
 *
 * @param {Event} e - Click event from a validation indicator.
 */
function onErrorIndicatorClicked(e) {
	e.stopPropagation();

	const errors = e.currentTarget._validationErrors ?? [];

	buildModalErrorPanel(errors);
	openModalOverlay();
}

/** Prints the rules panel while hiding unrelated page content. */
function onPrintRulesClicked(e) {
	const toHide = document.querySelectorAll("h1, .role-search, .panel-header, #languageSelector, .panel:not(.panel-rules)");
	printWithHiddenElements([...toHide]);
}

/** Prints the role-description panel while hiding unrelated page content. */
function onPrintDescriptionsClicked(e) {
	const toHide = document.querySelectorAll("h1, .role-search, .panel-header, #languageSelector, .panel:not(.panel-role-descriptions)");
	printWithHiddenElements([...toHide]);
}

/** Prints the token-description panel while hiding unrelated page content. */
function onPrintTokensClicked(e) {
	const toHide = document.querySelectorAll("h1, .role-search, .panel-header, #languageSelector, .panel:not(.panel-token-descriptions)");
	printWithHiddenElements([...toHide]);
}

/**
 * Moves the current script turn according to the clicked navigation button.
 *
 * @param {Event} e - Click event from a prompt navigation button.
 */
function onNavigationButtonClicked(e) {
	const target = e.currentTarget;
	const action = target.dataset.action;
	let newTurn = 0;

	switch (action) {
		case "first":
			newTurn = 0;
			break;
		case "prev":
			newTurn = promptState.currentTurn - 1;
			break;
		case "next":
			newTurn = promptState.currentTurn + 1;
			break;
		case "last":
			newTurn = promptState.narrationData.length - 1;
			break;
	}

	setCurrentTurn(newTurn);
}

/**
 * Enables or disables single-turn display mode and refreshes the prompt.
 *
 * @param {Event} e - Change event from the single-turn checkbox.
 */
function onNavigationModeChanged(e) {
	promptState.showSingleTurn = e.currentTarget.checked;
	renderPrompt();
}

/** Refreshes responsive GUI scaling, prompt sizing, and day-timer layout after the viewport changes. */
function onWindowResize() {
	updateGUIScale();
	resizePromptBox();
	updateDayTimerSpacer();
}

/** Re-randomizes any randomized rule values and regenerates the prompt. */
function onRerandomizeClicked(e) {
	Rules.rerandomize();
	updatePrompt();
}



/* =========================
   Initialization
   ========================= */

/**
 * Registers event listeners for the application's static GUI elements.
 *
 * Dynamic elements register their own listeners when they are created.
 */
function initGUIListeners() {
	// May trigger twice in some cases, but necessary for cross-device support
	window.addEventListener("resize", onWindowResize);
	window.visualViewport?.addEventListener("resize", onWindowResize);

	document.getElementById("btn-reset-settings").addEventListener("click", onSettingsReset);
	document.getElementById("btn-reset-roles").addEventListener("click", onSelectedRolesReset);
	document.getElementById("modalOverlayClose").addEventListener("click", onCloseModalOverlay);
	document.querySelector(".modal-overlay-backdrop").addEventListener("click", onCloseModalOverlay);
	document.getElementById("languageSelector").addEventListener("change", onLanguageSelect);
	document.getElementById("roleSelectionSearchField").addEventListener("input", onSelectionSearchInput);
	document.getElementById("roleDescriptionSearchField").addEventListener("input", onDescriptionSearchInput);
	document.getElementById("btn-print-rules").addEventListener("click", onPrintRulesClicked);
	document.getElementById("btn-print-descriptions").addEventListener("click", onPrintDescriptionsClicked);
	document.getElementById("promptFirst").addEventListener("click", onNavigationButtonClicked);
	document.getElementById("promptPrevious").addEventListener("click", onNavigationButtonClicked);
	document.getElementById("promptNext").addEventListener("click", onNavigationButtonClicked);
	document.getElementById("promptLast").addEventListener("click", onNavigationButtonClicked);
	document.getElementById("promptSingleTurn").addEventListener("change", onNavigationModeChanged);
	document.getElementById("tokenDescriptionSearchField").addEventListener("input", onTokenDescriptionSearchInput);
	document.getElementById("btn-print-tokens").addEventListener("click", onPrintTokensClicked);

	document.getElementById("dayTimerPill").addEventListener("click", onDayTimerPillClicked);
	document.getElementById("dayTimerCollapseTab").addEventListener("click", onDayTimerCollapseClicked);
	document.getElementById("dayTimerToggle").addEventListener("click", onDayTimerToggleClicked);
	document.getElementById("dayTimerStop").addEventListener("click", onDayTimerStopClicked);
	document.getElementById("dayTimerMinus30").addEventListener("click", () => onDayTimerAdjustClicked(-DAY_TIMER_ADJUST_STEP));
	document.getElementById("dayTimerPlus30").addEventListener("click", () => onDayTimerAdjustClicked(DAY_TIMER_ADJUST_STEP));
	document.getElementById("dayTimerDisplay").addEventListener("change", onDayTimerDisplayChange);

	document.getElementById("btn-rerandomize").addEventListener("click", onRerandomizeClicked);

	document.getElementById("btn-speech-start").addEventListener("click", onSpeechStartClicked);
	document.getElementById("btn-speech-overlay-pause").addEventListener("click", onSpeechOverlayPauseClicked);
	document.getElementById("btn-speech-overlay-stop").addEventListener("click", onSpeechOverlayStopClicked);
}

/**
 * Restores the persisted day-timer state and synchronizes its initial UI.
 *
 * A previously running timer resumes its redraw interval.
 */
function initDayTimer() {
	loadDayTimer();

	if (dayTimer.state === "running")
		ensureDayTimerInterval();

	updateDayTimerUI();
	updateDayTimerSpacer();
}

/**
 * Builds role-selection and role-description tiles for all enabled roles.
 *
 * Roles are sorted by localized display name, and selection tiles receive their click/hold interaction handlers.
 */
function initRoleElements() {
	const sortedRoles = getEnabledRolesSorted();

	sortedRoles.forEach(role => {
		const selectionTile = buildSelectionListTile(role);
		applySelectionTileListeners(selectionTile, role);

		buildDescriptionListTile(role);
	});
}

/** Builds token-description tiles for all enabled tokens in display order. */
function initTokenElements() {
	const sortedTokens = getEnabledTokensSorted();
	sortedTokens.forEach(token => buildTokenDescriptionListTile(token));
}

/**
 * Initializes collapse/expand behavior for all static panels.
 *
 * Each panel header toggles its content, and panels marked with data-collapsed="true" start collapsed.
 */
function initPanels() {
	document.querySelectorAll(".panel").forEach(panel => {
		const header = panel.querySelector(".panel-header");
		const toggle = panel.querySelector(".panel-toggle");
		const content = panel.querySelector(".panel-content");

		if (!header || !toggle || !content) return;

		header.addEventListener("click", (e) => {
			if (e.target.closest("input, button, select, textarea, label")) return;
			const collapsed = content.style.display === "none";
			content.style.display = collapsed ? "" : "none";
			toggle.textContent = collapsed ? "−" : "+";
		});
	});

	document
		.querySelectorAll(".panel[data-collapsed='true']")
		.forEach(panel => {
			const content = panel.querySelector(".panel-content");
			const toggle = panel.querySelector(".panel-toggle");
			if (content) content.style.display = "none";
			if (toggle) toggle.textContent = "+";
		});
}

/**
 * Populates the language selector with all languages known to Localization.
 *
 * @param {string} lang - Current language ID to select.
 */
function initLanguageSelector(lang) {
	const languageSelector = document.getElementById("languageSelector");

	for (const [langID, langName] of Object.entries(Localization.getKnownLanguages())) {
		const opt = document.createElement("option")
		opt.value = langID;
		opt.text = langName;

		languageSelector.add(opt)

		if (langID === lang) {
			languageSelector.selectedIndex = languageSelector.options.length - 1;
		}
	}
}

/**
 * Initializes the complete GUI in dependency order.
 *
 * Loads the active language and persisted state, initializes responsive layout and day-timer state, builds the application's DOM, restores
 * persisted filters, registers event handlers, performs the initial UI synchronization, and preloads narration resources.
 */
function initGUI() {
	// Load language first so it's ready for component initialization, no dependency on anything
	const lang = Localization.getLanguage();
	initLanguageSelector(lang);	
	setGUILanguage(lang);

	// Load configuration/stored values, no dependency
	loadSelectedRoles();
	initDayTimer();  // loads persisted timer state and resumes ticking if it was left running

	// Adapt scaling to window size, no dependency
	updateGUIScale();

	// Setup DOM elements in their default states, no interdependency but depends on localization being loaded
	localizeStaticContent();
	initPanels();
	initRoleElements();
	initTokenElements();
	buildSelectionTagFilters();
	buildSettingsUI();
	buildPromptNavigationControls();

	// Load saved tag filters, depends on buildSelectionTagFilters() having run first
	loadTagFilters();

	// Assign listeners to DOM elements, depends on the DOM being complete
	initGUIListeners();

	// Update the GUI to apply non-default states, depends on the DOM being complete
	updateRolesUI();

	// Prepare narration modules immediately to eliminate load times
	Narration.preload();
}

initGUI();
