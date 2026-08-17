/*
 * Graphical user interface.
 *
 * Builds and maintains the application's DOM, coordinates interaction between the user and the underlying modules, and reflects application
 * state visually. Business logic remains in Roles, Settings, Rules, Interpreter and Localization; this module is primarily responsible for
 * presentation and interaction.
 */


/* =========================
   Application state
   ========================= */

// Required hold time to open the role description overlay from a selection tile, ms
const LONG_PRESS_DELAY = 300;

// Persistent storage keys
const SELECTED_ROLES_STORE = "onuw_roles";
const TAG_FILTERS_STORE = "onuw_tag_filters";
const DAY_TIMER_STORE = "onuw_day_timer";

// Map of currently selected roles with instance count. setRoleCount() ensures a role with no instances is deleted from the map.
const roleCounts = new Map(); // roleId -> count

// Maps validation error types onto DOM rendering strategies
const VALIDATION_RENDERERS = {
	value: renderValueError,
	weightGroupSum: renderWeightGroupError,
};

// Tracks push-and-hold interactions with role selection tiles
let activeSelectionPointerId = null;

/*
 * Prompt display and narration state. renderedTurns/rawTurns are two views of the same turns produced by updatePrompt(): rawTurns is what
 * Speech.play() takes, renderedTurns is the localized text shown in the output box. currentTurn/showSingleTurn control single-turn display and
 * navigation.
 */
let promptState = {
	renderedTurns: [],
	rawTurns: [],
	currentTurn: 0,
	showSingleTurn: false,
};

// Display redraw interval while the day timer runs, ms - cosmetic only, the target timestamp below is authoritative
const DAY_TIMER_TICK_INTERVAL = 150;
// Seconds adjusted by the day timer's +/- buttons
const DAY_TIMER_ADJUST_STEP = 30;
// Default duration (seconds) the first time the page is ever opened
const DAY_TIMER_DEFAULT_DURATION = 300;

/*
 * Day timer state. state/duration/remaining/targetTimestamp track the timer's own lifecycle (see the Day Timer section); expanded/intervalId
 * are GUI bookkeeping (panel open, redraw handle).
 */
let dayTimer = {
	state: "stopped",                       // "stopped" | "running" | "paused"
	duration: DAY_TIMER_DEFAULT_DURATION,   // fallback duration when reset via the stop button
	remaining: DAY_TIMER_DEFAULT_DURATION,  // authoritative only while stopped/paused; derived from targetTimestamp while running
	targetTimestamp: null,                  // wall-clock ms timestamp the timer reaches zero at, set only while running - avoids drift from tab throttling/backgrounding
	expanded: false,                        // whether the expanded panel is open
	intervalId: null,                       // handle for the redraw interval, only set while running
};

// Tags to filter role selection by. Groups are AND'd together; tags within a group are OR'd
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

// Sprite sheets with per-language fallbacks, applied when language is set. %LANGUAGE% in path is replaced by the current language from Localization
const LOCALIZED_SPRITE_SHEETS = [
	{
		cssVar: "--card-sprite-sheet",
		path: "Sprites/sprites_cards_%LANGUAGE%.jpg",
		fallbackPath: "Sprites/sprites_cards_swe.jpg",
	},
	{
		cssVar: "--token-sprite-sheet",
		path: "Sprites/sprites_tokens.png",	// No localized sheets currently, add if needed
		fallbackPath: "Sprites/sprites_tokens.png",
	},
];



/* =========================
   Localization
   ========================= */

/*
 * Sets the page language: applies any localized sprite sheets and syncs the language selector's displayed value. lang - a language code
 * matching a key in Localization's dictionaries (e.g. "ENG", "SWE"). No return value.
 */
function setGUILanguage(lang) {
	setGUISpriteLanguage(lang);
	document.getElementById("languageSelector").value = lang;
}

// Sets any localized sprite sheets in the CSS based on selected language
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

// Localizes elements declared statically in HTML
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
		el.innerHTML = Localization.localize(key);
	});

	const titleEl = document.querySelector("title[data-loc]");
	if (titleEl) {
		titleEl.textContent = Localization.localize(titleEl.dataset.loc);
	}
}



/* =========================
   Persistent storage
   ========================= */

// Saves selected roles to persistent storage
function saveSelectedRoles() {
	const roles = Object.fromEntries(roleCounts);
	localStorage.setItem(SELECTED_ROLES_STORE, JSON.stringify(roles));
}

// Loads selected roles from persistent storage, updating the selected-role counter. Called on page load; GUI updates is handled by the init process.
function loadSelectedRoles() {
	const raw = localStorage.getItem(SELECTED_ROLES_STORE);
	if (!raw) return;

	try {
		const roles = JSON.parse(raw);

		console.group("Loaded role selection");

		for (const [roleId, count] of Object.entries(roles)) {
			if (Roles.isEnabled(roleId)) {
				if (count > 0) {
					console.log("\t" + roleId + ": " + count);
				}
				setRoleCount(roleId, count);
			} else {
				console.warn("\t" + roleId + " is disabled, ignoring attempt to load");
			}
		}
		console.groupEnd();

	} catch {
		console.warn("Unable to load selected roles from storage");
	}
}

// Saves selected tag filters to persistent storage
function saveTagFilters() {
	const filters = getSelectedTagFilters();
	localStorage.setItem(TAG_FILTERS_STORE, JSON.stringify(filters));
}

/*
 * Loads selected tag filters from persistent storage. Called once after the tag filter tiles have been built (buildSelectionTagFilters), since it
 * looks up existing .selection-filter-option elements to apply state to.
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

// Saves the day timer state to persistent storage
function saveDayTimer() {
	const data = {
		state: dayTimer.state,
		duration: dayTimer.duration,
		remaining: getDayTimerRemainingSeconds(),
		targetTimestamp: dayTimer.targetTimestamp,
	};
	localStorage.setItem(DAY_TIMER_STORE, JSON.stringify(data));
}

/*
 * Loads the day timer state from persistent storage, resuming a running timer based on wall-clock time so a reload (or the tab having been
 * closed) doesn't lose progress. Called once on page load; updating the GUI is left to the init process.
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

	} catch {
		console.warn("Unable to load day timer from storage");
	}
}



/* =========================
   Role & token utility functions
   ========================= */

// Sorted list of all enabled tokens, grouped by type then localized name
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

// Localized lowercase token name, used by the search function for comparisons against a search term
function getTokenSearchText(token) {
	return Localization.localize(token.nameKey).toLowerCase();
}

// Sorted list of all enabled roles, by localized name
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

// List of all currently selected role IDs
function getSelectedRoleIds() {
	return Array.from(roleCounts.keys());
}

// Number of players supported by the current selection
function getPlayerCount() {
	return Roles.calculatePlayerCount(roleCounts);
}

// Localized lowercase role name, used by the search function for comparisons against a search term
function getRoleSearchText(role) {
	return Localization.localize(role.nameKey).toLowerCase();
}

// Number of selected instances of a role
function getRoleCount(roleId) {
	return roleCounts.get(roleId) ?? 0;
}

// Sets the number of selected instances of a role
function setRoleCount(roleId, value) {
	if (value <= 0)
		roleCounts.delete(roleId);
	else
		roleCounts.set(roleId, value);
}

// True if at least one instance of the role is selected
function roleIsSelected(roleId) {
	return getRoleCount(roleId) > 0;
}

// True if at least one role is selected
function isAnyRoleSelected() {
	return roleCounts.size > 0;
}

// Localized, comma-separated list of role names that use a given token
function getTokenUsedByText(token) {
	return Roles.getRolesUsingToken(token).map(roleId => Localization.localize(Roles.getNameKey(roleId))).join(", ");
}

// Localized, comma-separated list of role names from an array of role IDs
function getRoleList(roleIds) {
	return roleIds.map(roleId => Localization.localize(Roles.getNameKey(roleId))).join(", ");
}


/* =========================
   DOM construction
   ========================= */

	/* =========================
	   Sprites
	   ========================= */

	// CSS attributes of the sprite sheet matching the given type
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

	// Sets the offset on an icon element so it displays the sprite at abstract coordinates (position.x, position.y) within its sheet
	function applySpriteOffset(el, type, position) {
		const { width, height } = getSpriteData(type);

		el.style.setProperty(`--${type}-sprite-x`, `${-position.x * width}px`);
		el.style.setProperty(`--${type}-sprite-y`, `${-position.y * height}px`);
	}

	// Creates an icon element displaying a sprite from a sprite sheet. Common helper for the three different create<Type>Icon functions
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

	function createRoleIcon(role) {
		return createSprite("role", Roles.getPortraitIcon(role));
	}

	function createCardIcon(card) {
		return createSprite("card", card);
	}

	function createTokenIcon(token) {
		return createSprite("token", Roles.getTokenIcon(token));
	}

	/* =========================
	   Tile construction
	   
	   Builds tiles for the three static panels that list roles/tokens: role selection, role descriptions, and token descriptions.
	   All three share the base tile elements.
	   ========================= */

	// -- Base tile elements --

	// Base role tile shared by the selection and description views
	function createRoleTile(role, ...classes) {
		const el = document.createElement("div");
		el.classList.add(...classes);
		el.dataset.roleName = getRoleSearchText(role);  // normalized name, used for search/filtering
		el.dataset.roleId = role.id;                    // identifies the associated role

		return el;
	}

	// Base token tile shared by (future) token views
	function createTokenTile(token, ...classes) {
		const el = document.createElement("div");
		el.classList.add(...classes);
		el.dataset.tokenName = getTokenSearchText(token);  // normalized name, used for search/filtering
		el.dataset.tokenId = token.id;                      // identifies the associated token

		return el;
	}

	// -- Role selection tiles --

	// Creates and populates a role selection tile
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

	// Adds listeners to a selection tile: click to select, hold to open the description overlay
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

	// Localized team text for a role
	function getDescriptionTeamText(role) {
		let team = Localization.localize(role.team);

		if (team && role.tags?.includes("CAN_CHANGE_ALIGNMENT")) {
			team += Localization.localize("TEAM_VARIABLE_SUFFIX");
		}

		return team;
	}

	// Localized active-phase text for a role
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

	// Localized composite win-condition text for a role, falling back from a role-specific key to its team's key
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

	// Populates a role description tile. Shared by the description list and the modal overlay; icon elements are left to the caller
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

	// Creates a role description tile
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

	// Populates a token description tile
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

	// Creates a token description tile
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

	// Builds the collapsed token icon row with click-to-reveal detail, returning the detail container to append alongside it.
	function buildCollapsedTokenIcons(tokens, listContainer) {
		const detail = document.createElement("div");
		detail.className = "modal-token-detail is-hidden";

		function showDetail(token, tileEl) {
			listContainer.querySelectorAll(".modal-token-tile.is-selected").forEach(t => t.classList.remove("is-selected"));
			tileEl.classList.add("is-selected");

			detail.replaceChildren(createModalTokenTile(token, false));
			detail.classList.remove("is-hidden");
		}

		function hideDetail() {
			listContainer.querySelectorAll(".modal-token-tile.is-selected").forEach(t => t.classList.remove("is-selected"));
			detail.replaceChildren();
			detail.classList.add("is-hidden");
		}

		tokens.forEach(token => {
			const tile = createModalTokenTile(token, true);
			tile.addEventListener("click", () => {
				if (tile.classList.contains("is-selected")) {
					hideDetail();
				} else {
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

	// Creates a small tile pairing a token's icon with its description, or just the icon when collapsed
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

	// Creates a role description tile for the modal overlay, replacing whatever the overlay currently shows
	function buildModalRoleDescription(role) {
		const MAX_MODAL_TOKEN_DESCRIPTIONS = 2;

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

	// Creates and populates the modal overlay with a settings validation result panel, replacing whatever the overlay currently shows
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

	// Creates and populates a selection tag filter tile
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

	// Creates and populates a selection tag filter group
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

	// Builds the selection tag filter elements from TAG_FILTER_GROUPS
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

	/*
	 * Applies each of node's textStyle classes (see Settings.getNodeTextStyles) to label. node is a settings-tree node, not a DOM node -
	 * distinct from label, which is the DOM element receiving the classes. No return value.
	 */
	function applyTextStyleClasses(label, node) {
		for (const style of Settings.getNodeTextStyles(node)) {
			label.classList.add("settings-font-" + style);
		}
	}

	/*
	 * Builds the (initially collapsed) wrapper element holding node's children, recursively building each child via createSettingNode.
	 *   node  - the settings-tree node whose children are being built.
	 *   depth - node's own nesting depth; children are built one level deeper (depth + 1), used for indentation via dataset.depth.
	 * Returns the wrapper element.
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

	/*
	 * The create<Type>Input functions creates an input control corresponding to the given type, setting meta-data and default values.
	 * Also sets any listener dynamically for the input control here as it depends on data from the node, rather than doing it through
	 * a second pass through all inputs afterwards.
	 *   node - the settings-tree node this input controls.
	 *   item - extra parameter for the weight type, representing the DOM row/item element this input's control lives inside; only used
	 *          so a live edit can find and refresh its sibling weight inputs' percentage labels via updateWeightGroupPercentages().
	 * Returns the input element.
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

	/*
	 * Builds the type-specific control(s) - and their info/label span - for a settings row, dispatching on the value of node.type to
	 * the create<Type>Input functions corresponding to the type.
	 *   node - the settings-tree node to build controls for.
	 *   item - the DOM row/item element being built; forwarded to createWeightInput for weight-type nodes (see there).
	 * Returns the assembled controls container element.
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

	/*
	 * Recursively builds one settings-tree node (and, if it has children, its entire subtree) into its DOM representation.
	 *   node  - the settings-tree node to build.
	 *   depth - node's nesting depth from the tree root (0 at the top level); stored as dataset.depth and passed to any children as depth + 1.
	 * Returns the built item element - a header, a plain item, or (for node.type === "separator") a bare separator row - already containing
	 * its label/controls/validation indicator and, if node has children, its (collapsed) childrenWrap subtree.
	 */
	function createSettingNode(node, depth) {
		function createDisclosureIndicator() {
			const indicator = document.createElement("div");
			indicator.className = "settings-row-disclosure";
			indicator.textContent = "▶";
			indicator.dataset.expanded = "false";
			return indicator;
		}
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

	/*
	 * Builds the entire settings panel from Settings.getRootNodes(), then adds the panel-header-level validation indicator (distinct from
	 * each node's own per-row indicator) and runs an initial validation pass so error states are correct before any input is touched.
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

	// Groups a settings-childrenwrap's direct children by weight group ID. Returns a Map<weightGroupId, item[]>.
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

	// Adds top/middle/bottom border classes to visually box each weight group with more than one member
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

	/*
	 * Builds the prompt panel's navigation controls (first/prev/next/last buttons, turn counter, single-turn toggle) and inserts them into
	 * the panel. Reads promptState.showSingleTurn to set the toggle's initial checked state. No return value.
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

/*
 * Synchronizes all UI derived from the current role selection: resolves invalid selections, updates tile visuals, revalidates settings, and
 * regenerates the narration prompt.
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

// Deselects any selected role that's no longer selectable (e.g. a role another selected role depended on). Returns true if anything changed
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

/*
 * Updates one selection tile's visual state (disabled/selected styling, instance-count badge) to match count.
 *   tile   - the tile's DOM element.
 *   roleId - the tile's role ID, used to check selectability and fetch min/max instance counts.
 * No return value. The badge is hidden entirely for a role with maxCount <= 1 (nothing to count) or count === 0.
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

function updatePlayerCountDisplay() {
	const el = document.getElementById("playerCountDisplay");
	if (!el) return;

	el.textContent = Localization.localize("UI_PLAYER_COUNT") + " " + getPlayerCount().toString();
}



/* =========================
   Search & tag filter visibility
   ========================= */

/*
 * Shared visibility logic for a tile list: search term (if any) takes priority, else falls back to isVisibleCallback.
 *   tiles             - the tile elements to show/hide.
 *   searchTerm        - lowercase, trimmed search text; if non-empty, a tile is visible only if its searchAttr dataset value includes it.
 *   isVisibleCallback - (tile) => boolean, consulted only when searchTerm is empty.
 *   searchAttr        - which dataset field to search against; defaults to "roleName" (see createRoleTile) - callers for token tiles pass
 *                       "tokenName" instead (see createTokenTile).
 * No return value - toggles the "is-hidden" class on each tile directly.
 */
function updateTileVisibility(tiles, searchTerm, isVisibleCallback, searchAttr = "roleName") {
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

/*
 * Updates which role description tiles are visible: matching the search field if it has text, otherwise showing only currently-selected
 * roles once anything is selected (all roles if nothing is selected yet). No parameters, no return value.
 */
function updateDescriptionVisibility() {
	const searchTerm = document.getElementById("roleDescriptionSearchField").value.toLowerCase().trim();
	const tiles = document.querySelectorAll(".description-tile");
	const hasSelection = isAnyRoleSelected();

	updateTileVisibility(tiles, searchTerm, tile => !hasSelection || roleIsSelected(tile.dataset.roleId))
}

/*
 * Updates which token description tiles are visible: matching the search field if it has text, otherwise showing only tokens actually
 * active for the current role selection (all tokens if nothing is selected yet). No parameters, no return value.
 */
function updateTokenDescriptionVisibility() {
	const searchTerm = document.getElementById("tokenDescriptionSearchField").value.toLowerCase().trim();
	const tiles = document.querySelectorAll(".token-tile");
	const hasSelection = isAnyRoleSelected();
	const selectedRoleIds = getSelectedRoleIds();

	updateTileVisibility(
		tiles,
		searchTerm,
		tile => !hasSelection || Roles.isTokenActive(tile.dataset.tokenId, selectedRoleIds),
		"tokenName"
	);
}

/*
 * Reads the currently-selected tag filter tiles into a plain object. Returns { [groupId]: tag[] }, one entry per group that has at
 * least one tile selected (a group with nothing selected is simply absent, not an empty array).
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

// True if roleId matches at least one tag in every filter group that has a selection (AND across groups, OR within a group)
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

/*
 * Updates which role selection tiles are visible: matching the search field if it has text; otherwise a role is visible if it matches
 * every active tag filter group (see roleMatchesAllFilterGroups) or is already selected (a selected role is never hidden by filters,
 * only by search). No parameters, no return value.
 */
function updateSelectionVisibility() {
	const searchTerm = document.getElementById("roleSelectionSearchField").value.toLowerCase().trim();
	const tiles = document.querySelectorAll(".selection-tile");
	const tagFilters = getSelectedTagFilters();

	updateTileVisibility(tiles, searchTerm, tile => {
		const roleId = tile.dataset.roleId;
		return roleMatchesAllFilterGroups(roleId, tagFilters) || roleIsSelected(roleId);
	});
}

// Toggles a tag filter tile between selected and unselected
function toggleTagFilterTileState(tile) {
	const isSelected = tile.classList.contains("selected");
	setTagFilterTileState(tile, !isSelected);
}

// Sets a tag filter tile's selected state and refreshes selection visibility
function setTagFilterTileState(tile, isSelected) {
	tile.classList.toggle("selected", isSelected);
	tile.classList.toggle("unselected", !isSelected);
	updateSelectionVisibility();
}



/* =========================
   Game script & narration
   
   Turns produced by Rules.buildPrompt() are one dataset with two parallel presentations: a plain text script (rendered into the output box, see
   "Text script" below) and spoken narration played back through Speech (see "Speech narration" below). Both read from promptState, which
   updatePrompt() below is the sole writer of.
   ========================= */

/*
 * Regenerates promptState from the current role selection, or shows an explanatory message in its place if generation isn't currently
 * possible. Always stops any narration in progress and resets the speech overlay first, since a new prompt invalidates whatever was
 * playing.
 *
 * relevantErrors - Settings validation errors already filtered to the current role selection (see Settings.filterRelevant); a non-empty
 *                  array short-circuits generation entirely, showing a fixed "invalid settings" message instead of attempting
 *                  Rules.buildPrompt(). Optional/undefined is treated as "no errors".
 *
 * No return value.
 */
function updatePrompt(relevantErrors) {
	function _showPromptUnavailable(message) {
		promptState.renderedTurns = [];
		promptState.rawTurns = [];
		setCurrentTurn(0, false);

		document.getElementById("promptOutput").value = message;

		updatePromptNavigation();
		resizePromptBox();
	}

	Speech.stop();
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

		promptState.renderedTurns = Interpreter.renderAll(turns);
		promptState.rawTurns = turns;
		setCurrentTurn(promptState.currentTurn); // preserve current turn, clamped to a valid index

	} catch (error) {
		console.error(error);
		_showPromptUnavailable(String(error));
	}
}


	/* =========================
	   Text script
	   ========================= */

	/*
	 * Updates the turn counter label and enables/disables the first/prev/next/last buttons to match promptState (single-turn mode and
	 * current position).
	 */
	function updatePromptNavigation() {
		const label = document.getElementById("promptCounter");
		if (promptState.showSingleTurn) {
			label.textContent = (promptState.renderedTurns.length > 0) ? `${promptState.currentTurn + 1} / ${promptState.renderedTurns.length}` : "-";
		} else {
			label.textContent = "-";
		}

		document.getElementById("promptFirst").disabled = !promptState.showSingleTurn || promptState.currentTurn <= 0;
		document.getElementById("promptPrevious").disabled = !promptState.showSingleTurn || promptState.currentTurn <= 0;
		document.getElementById("promptNext").disabled = !promptState.showSingleTurn || promptState.currentTurn >= promptState.renderedTurns.length - 1;
		document.getElementById("promptLast").disabled = !promptState.showSingleTurn || promptState.currentTurn >= promptState.renderedTurns.length - 1;
	}

	/*
	 * Sets the current turn shown in the script output, clamped to a valid index.
	 *   value    - the target turn index; clamped to [0, promptState.renderedTurns.length - 1].
	 *   rerender - if true (default), immediately calls renderPrompt(); pass false when the caller will render separately (or not at all).
	 */
	function setCurrentTurn(value, rerender = true) {
		promptState.currentTurn = Math.max(Math.min(value, promptState.renderedTurns.length - 1), 0);

		if (rerender)
			renderPrompt();
	}

	/*
	 * Writes the current script text into the output box - either the full script, or just promptState.currentTurn's turn if
	 * showSingleTurn is set - then refreshes navigation and box sizing. No parameters, no return value.
	 */
	function renderPrompt() {
		const outputBox = document.getElementById("promptOutput");

		if (!promptState.showSingleTurn) {
			outputBox.value = promptState.renderedTurns.map(t => Interpreter.sequenceToText(t.sequence)).join("\n\n");
		} else {
			outputBox.value = promptState.renderedTurns[promptState.currentTurn] ? Interpreter.sequenceToText(promptState.renderedTurns[promptState.currentTurn].sequence) : "";
		}

		updatePromptNavigation();
		resizePromptBox();
	}

	function resizePromptBox() {
		const outputBox = document.getElementById("promptOutput");
		outputBox.style.height = "auto";
		outputBox.style.height = outputBox.scrollHeight + "px";
	}


	/* =========================
	   Speech narration
	   ========================= */

	/*
	 * Plays promptState.rawTurns as narration. Turn boundaries are preserved (not flattened) so Speech can report per-turn progress back to
	 * clbkSpeechTurnComplete below. All engine-specific detail (voices, pacing, what "playing" even means) lives in Speech - this just hands it data and
	 * a few progress callbacks.
	 */
	function speakPrompt() {
		Interpreter.refreshPauseSettings();
		setCurrentTurn(0);

		if (promptState.rawTurns.length === 0)
			return;

		openSpeechOverlay();
		resetSpeechOverlay();

		Speech.play(promptState.rawTurns, { verbosity: "verbose" }, {
			onSpeaking: clbkSpeechSpeaking,
			onPause: clbkSpeechPause,
			onTurnComplete: clbkSpeechTurnComplete,
			onFinished: clbkSpeechFinished,
			onInputStart: clbkSpeechInputStart,
			onInputCountdown: clbkSpeechInputCountdown,
			onInputResolved: clbkSpeechInputResolved,
		});

		updateSpeechOverlayControls();
	}

	// Fires when a text segment starts being spoken. Mostly a contrast against clbkSpeechPause ("speaking" vs "waiting")
	function clbkSpeechSpeaking(text) {
		const state = document.getElementById("speechOverlayState");
		const textElement = document.getElementById("speechOverlayText");
		const countdown = document.getElementById("speechOverlayCountdown");

		state.textContent = Localization.localize("UI_SPEECH_SPEAKING");
		textElement.textContent = text;
		countdown.textContent = "";
	}

	// Fires roughly once a second while a pause segment is running, with the seconds remaining
	function clbkSpeechPause(secondsRemaining) {
		const state = document.getElementById("speechOverlayState");
		const countdown = document.getElementById("speechOverlayCountdown");

		state.textContent = Localization.localize("UI_SPEECH_WAITING");
		countdown.textContent = `${Math.ceil(secondsRemaining)} s`;
	}

	// Fires once a turn has fully finished playing, with that turn's index into promptState.renderedTurns
	function clbkSpeechTurnComplete(turnIndex) {
		setCurrentTurn(turnIndex + 1, promptState.showSingleTurn);
	}

	// Fires once playback has run to the end on its own (not via the Stop button, which already resets the controls itself when clicked)
	function clbkSpeechFinished() {
		resetSpeechOverlay();
		closeSpeechOverlay();
		updateSpeechOverlayControls();
	}

	/*
	 * Fires when an input node begins its wait. Renders one tappable button per option. Selecting one only records the choice (Speech.selectInput) - the
	 * wait always runs its full fixed duration regardless of whether or when a button gets pressed, so there's nothing else for this handler to gate.
	 * The narration text from just before the input is left in place rather than cleared, since it's usually the instruction the wait is time for.
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
				Speech.selectInput(option.value);
				optionsContainer.querySelectorAll(".speech-overlay-option")
					.forEach(b => b.classList.toggle("selected", b === button));
			});
			optionsContainer.appendChild(button);
		});
	}

	// Same shape as clbkSpeechPause, kept separate so the countdown can render alongside the option buttons instead of assuming nothing else is on screen
	function clbkSpeechInputCountdown(secondsRemaining) {
		document.getElementById("speechOverlayCountdown").textContent = `${Math.ceil(secondsRemaining)} s`;
	}

	/*
	 * Fires once an input's wait - not an ordinary narration pause, but the timed prompt during which speechOverlayOptions shows tappable
	 * choices for the user to pick from - has fully elapsed and a value has been bound (either the user's selection, or the input's own
	 * default if nothing was picked in time). Only clears the option buttons and countdown styling here; field/value aren't used since this
	 * module doesn't currently need to react to which field or value was bound - the narration that follows arrives through
	 * clbkSpeechSpeaking/clbkSpeechPause like anything else. field/value match Speech.play()'s onInputResolved(field,value) callback shape.
	 */
	function clbkSpeechInputResolved(field, value) {
		document.getElementById("speechOverlayOptions").replaceChildren();
		document.getElementById("speechOverlayCountdown").classList.remove("speech-overlay-countdown-compact");
	}

	function openSpeechOverlay() {
		const overlay = document.getElementById("speechOverlay");
		if (!overlay) return;

		overlay.classList.add("visible");
		overlay.setAttribute("aria-hidden", "false");
	}

	function closeSpeechOverlay() {
		const overlay = document.getElementById("speechOverlay");
		if (!overlay) return;

		overlay.classList.remove("visible");
		overlay.setAttribute("aria-hidden", "true");
	}

	/*
	 * Clears the overlay back to its idle state (no state text, no spoken text, no countdown, no input buttons) - called both before a
	 * fresh speakPrompt() session starts and after one ends, so the overlay never briefly shows stale content from a previous turn.
	 * No parameters, no return value.
	 */
	function resetSpeechOverlay() {
		document.getElementById("speechOverlayState").textContent = "";
		document.getElementById("speechOverlayText").textContent = "";
		document.getElementById("speechOverlayCountdown").textContent = "";
		document.getElementById("speechOverlayCountdown").classList.remove("speech-overlay-countdown-compact");
		document.getElementById("speechOverlayOptions").replaceChildren();
	}

	/*
	 * Syncs the overlay's pause/stop buttons to the current Speech state: both disabled when nothing is active, and the pause button's
	 * icon/label toggling between pause and resume depending on Speech.isPaused(). No parameters, no return value.
	 */
	function updateSpeechOverlayControls() {
		const pauseBtn = document.getElementById("btn-speech-overlay-pause");
		const stopBtn = document.getElementById("btn-speech-overlay-stop");

		if (!pauseBtn || !stopBtn) return;

		const active = Speech.isActive();
		const paused = Speech.isPaused();

		pauseBtn.textContent = paused ? "▶" : "⏸";
		pauseBtn.setAttribute("aria-label", paused ? "Resume" : "Pause");

		pauseBtn.disabled = !active;
		stopBtn.disabled = !active;
	}



/* =========================
   Modal overlay
   ========================= */

function openModalOverlay() {
	const overlay = document.getElementById("modalOverlay");
	overlay.classList.remove("hidden");
}

function closeModalOverlay() {
	const overlay = document.getElementById("modalOverlay");
	overlay.classList.add("hidden");
	document.getElementById("modalOverlayContainer").replaceChildren();
}



/* =========================
   Settings validation & updates
   ========================= */

/*
 * Updates the "X%" label next to each weight input in a group to reflect its live share of the group's total - purely visual feedback while
 * editing. Display-only: it doesn't affect validation (Settings.validate handles that separately) and only reads values already committed via
 * Settings.setValue.
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

function updateAllWeightPercentages() {
	document.querySelectorAll(".settings-childrenwrap").forEach(updateWeightGroupPercentages);
}

/*
 * Re-reads every settings input's DOM element (matched by selector) from its current Settings value and applies it via applyFn -
 * used to reset the DOM after Settings.reset() changes values programmatically, bypassing the inputs' own change listeners.
 *   selector - CSS selector matching the input elements to refresh.
 *   applyFn  - (input, value) => void, applies value to input in whatever way suits its type (e.g. .value = ... vs .checked = ...).
 * No return value. An input whose settingOid isn't recognized by Settings.getValue is skipped with a warning rather than throwing.
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

/*
 * Refreshes every settings input's displayed value from Settings (see refreshInputsFromState), then the weight-group percentage
 * labels and full settings validation UI - the sequence used after Settings.reset() to bring the DOM back in sync. No parameters,
 * no return value.
 */
function refreshSettingsUIFromState() {
	refreshInputsFromState('input[type="number"][data-setting-oid]', (input, v) => input.value = String(v));
	refreshInputsFromState('input[type="checkbox"][data-setting-oid]', (input, v) => input.checked = Boolean(v));

	updateAllWeightPercentages();
	updateSettingsUI();
}

/*
 * Re-renders validation state across the entire settings tree from a fresh errors array (see Settings.validate), then updates the
 * panel-level indicator with every error found. errors defaults to [] (clears all validation state). No return value.
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

/*
 * Clears item's own error styling and any weight-group error highlighting on its direct children, in preparation for
 * updateSettingsValidationNode to re-apply whatever's still actually invalid. No return value.
 */
function clearValidationState(item) {
	item.classList.remove("settings-has-errors");

	const childrenWrap = item.querySelector(":scope > .settings-childrenwrap");

	if (childrenWrap) {
		for (const child of childrenWrap.children)
			child.classList.remove("settings-weightbox-error");
	}
}

// Visually marks a row in the settings GUI with an error (CSS class mutation)
function renderValueError(item, err) {
	item.classList.add("settings-has-errors");
}

// Visually marks a row and all children belonging to the weight group in the settings GUI with an error (CSS class mutation)
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

/*
 * Looks up and runs the renderer for err.errorType (see VALIDATION_RENDERERS), warning instead of throwing for an unrecognized type -
 * so one unexpected error shape doesn't break rendering for every other error. No return value.
 */
function applyValidationError(item, err) {
	const renderer = VALIDATION_RENDERERS[err.errorType];
	if (renderer)
		renderer(item, err);
	else
		console.warn(`Unknown validation error type '${err.errorType}'`);
}

/*
 * Shared icon-update logic for both a per-row indicator (see updateItemValidationIcon) and the settings-panel-level indicator (see
 * updateSettingsPanelValidation): sets the error count text, shows/hides the indicator, and stashes errors on the element itself
 * (target._validationErrors) so onErrorIndicatorClicked can retrieve them later without a separate lookup. target may be null (e.g. a
 * row with no indicator element), in which case this is a no-op. No return value.
 */
function updateValidationIcon(target, errors) {
	if (!target) return;

	target.querySelector(".settings-validation-count").textContent = String(errors.length);
	target.style.display = errors.length ? "" : "none";
	target._validationErrors = errors.length ? errors : null;
}

function updateItemValidationIcon(item, errors) {
	const indicator = item.querySelector(":scope > .settings-row > .settings-validation-indicator");
	updateValidationIcon(indicator, errors);
}

function updateSettingsPanelValidation(errors) {
	const indicator = document.getElementById("settingsPanelValidationIndicator");
	updateValidationIcon(indicator, errors);
}

/*
 * Collects and propagates validation errors through the settings tree: recurses into children first, then checks and renders errors on the
 * node itself, then returns everything found (own + children's) so the caller can propagate it further up.
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

/*
 * Re-validates settings against the current role selection, refreshes the validation UI, and regenerates the prompt from only the
 * errors relevant to that selection (see Settings.validateRelevant / Settings.filterRelevant). No parameters, no return value.
 */
function updateSettingsUI() {
	const errors = Settings.validate({ selectedRoles: roleCounts });
	updateSettingsValidationUI(errors);
	updatePrompt(Settings.filterRelevant(errors, roleCounts));
}



/* =========================
   Adaptive layout/scaling
   ========================= */

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

function updateGUIScale() {
	const { width, height } = getUsableViewport();
	const minViewport = Math.min(width, height);

	const MIN_SELECT_SCALE = 0.5;
	const MAX_SELECT_SCALE = 1.0;
	const MIN_DESCRIPTION_SCALE = 0.75;
	const MAX_DESCRIPTION_SCALE = 1.0;
	const SELECT_BASE_SIZE = 800;
	const DESCRIPTION_BASE_SIZE = 800;

	let selectScale = minViewport / SELECT_BASE_SIZE;
	selectScale = Math.max(MIN_SELECT_SCALE, Math.min(MAX_SELECT_SCALE, selectScale));
	let descriptionScale = minViewport / DESCRIPTION_BASE_SIZE;
	descriptionScale = Math.max(MIN_DESCRIPTION_SCALE, Math.min(MAX_DESCRIPTION_SCALE, descriptionScale));

	document.documentElement.style.setProperty("--selection-tile-scale", selectScale.toFixed(3));
	document.documentElement.style.setProperty("--description-tile-scale", descriptionScale.toFixed(3));
}



/* =========================
   Printing
   ========================= */

// Temporarily hides elements for the duration of a print, restoring them once the browser reports printing is done
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

// Current remaining time in seconds, derived from the target timestamp while running
function getDayTimerRemainingSeconds() {
	if (dayTimer.state === "running" && dayTimer.targetTimestamp != null) {
		return Math.max(0, Math.round((dayTimer.targetTimestamp - Date.now()) / 1000));
	}
	return dayTimer.remaining;
}

// Formats a whole number of seconds as MM:SS, clamped to zero
function formatDayTimerTime(totalSeconds) {
	const clamped = Math.max(0, Math.round(totalSeconds));
	const minutes = Math.floor(clamped / 60);
	const seconds = clamped % 60;
	return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

// Starts or resumes the timer from its current remaining time. No-op if already running or if there's no time left (stop first to reset)
function startDayTimer() {
	if (dayTimer.state === "running" || dayTimer.remaining <= 0) return;

	dayTimer.targetTimestamp = Date.now() + dayTimer.remaining * 1000;
	dayTimer.state = "running";

	ensureDayTimerInterval();
	updateDayTimerUI();
	saveDayTimer();
}

// Pauses the timer, freezing the remaining time until resumed
function pauseDayTimer() {
	if (dayTimer.state !== "running") return;

	dayTimer.remaining = getDayTimerRemainingSeconds();
	dayTimer.targetTimestamp = null;
	dayTimer.state = "paused";

	clearDayTimerInterval();
	updateDayTimerUI();
	saveDayTimer();
}

// Stops the timer and resets it back to the configured duration, ready to be started again
function stopDayTimer() {
	dayTimer.state = "stopped";
	dayTimer.targetTimestamp = null;
	dayTimer.remaining = dayTimer.duration;

	clearDayTimerInterval();
	updateDayTimerUI();
	saveDayTimer();
}

/*
 * Adjusts the remaining time (and the running target, if running) by a number of seconds, clamped to zero. While stopped, also updates the
 * configured duration, since there's nothing else to fall back to.
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

// Sets an explicit duration in seconds. Only valid while stopped or paused (guarded by caller, but re-checked here defensively)
function setDayTimerDuration(totalSeconds) {
	if (dayTimer.state === "running") return;

	const clamped = Math.max(0, Math.round(totalSeconds));
	dayTimer.remaining = clamped;
	if (dayTimer.state === "stopped")
		dayTimer.duration = clamped;

	updateDayTimerUI();
	saveDayTimer();
}

/*
 * Starts the display redraw interval if it isn't already running - guarded so calling this while already running doesn't stack a
 * second interval. No parameters, no return value.
 */
function ensureDayTimerInterval() {
	if (dayTimer.intervalId != null) return;
	dayTimer.intervalId = setInterval(tickDayTimer, DAY_TIMER_TICK_INTERVAL);
}

function clearDayTimerInterval() {
	if (dayTimer.intervalId == null) return;
	clearInterval(dayTimer.intervalId);
	dayTimer.intervalId = null;
}

// Redraw callback while running. Also detects reaching zero, at which point the timer simply stops (staying at 00:00 until the narrator presses stop/reset)
function tickDayTimer() {
	if (getDayTimerRemainingSeconds() > 0) {
		updateDayTimerUI();
		return;
	}

	dayTimer.state = "stopped";
	dayTimer.targetTimestamp = null;
	dayTimer.remaining = 0;

	clearDayTimerInterval();
	updateDayTimerUI();
	saveDayTimer();
}

// Refreshes the pill text, panel time, and toggle button label to match the current state
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

// Expands the panel, pushing page content down
function expandDayTimer() {
	dayTimer.expanded = true;
	document.body.classList.add("day-timer-expanded");
	updateDayTimerSpacer();
}

// Collapses back down to the floating pill
function collapseDayTimer() {
	dayTimer.expanded = false;
	document.body.classList.remove("day-timer-expanded");
	updateDayTimerSpacer();
}

// Resizes the layout spacer to match the expanded panel's actual rendered height (which may wrap on narrow screens), so it reserves the right amount of space
function updateDayTimerSpacer() {
	const spacer = document.getElementById("dayTimerSpacer");
	const panel = document.getElementById("dayTimerPanel");
	if (!spacer || !panel) return;

	// Deferred a frame so the panel's display change (via the body class) has taken effect before measuring it
	requestAnimationFrame(() => {
		spacer.style.height = dayTimer.expanded ? panel.getBoundingClientRect().height + "px" : "0px";
	});
}





/* =========================
   Event listeners
   ========================= */

function onSpeechStartClicked() {
	speakPrompt();
}

function onSpeechOverlayPauseClicked() {
	if (!Speech.isActive())
		return;

	if (Speech.isPaused())
		Speech.resume();
	else
		Speech.pause();

	updateSpeechOverlayControls();
}

function onSpeechOverlayStopClicked() {
	Speech.stop();

	resetSpeechOverlay();
	closeSpeechOverlay();

	updateSpeechOverlayControls();
}

function onDayTimerPillClicked() {
	expandDayTimer();
}

function onDayTimerCollapseClicked() {
	collapseDayTimer();
}

function onDayTimerToggleClicked() {
	if (dayTimer.state === "running")
		pauseDayTimer();
	else
		startDayTimer();
}

function onDayTimerStopClicked() {
	stopDayTimer();
}

function onDayTimerAdjustClicked(deltaSeconds) {
	adjustDayTimer(deltaSeconds);
}

// Parses the typed MM:SS value on commit (blur/enter). Reverts to the current value on anything unparseable, rather than guessing
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

/*
 * Applies the newly selected language and reloads the page - a full reload rather than a live re-render, since most of the UI (role
 * names, ability text, etc.) is generated once at init time from the language active at that point. No return value.
 */
function onLanguageSelect(e) {
	const lang = e.target.value;
	Localization.setLanguage(lang);
	window.location.reload();
}

function onSelectedRolesReset() {
	const tiles = document.querySelectorAll(".selection-tile");

	tiles.forEach(tile => {
		const roleId = tile.dataset.roleId;
		setRoleCount(roleId, 0);
	});

	updateRolesUI();
}

/*
 * Cycles a role selection tile's instance count on click: 0 -> minCount -> minCount+1 -> ... -> maxCount -> 0 (back to unselected). A
 * role no longer selectable (e.g. a dependency was deselected) is left alone entirely - no-op rather than resetting it, since
 * updateRolesUI's own sanitization pass is what handles removing it. role - the role being clicked. No return value.
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

function onSelectionSearchInput() {
	updateSelectionVisibility();
}

function onDescriptionSearchInput() {
	updateDescriptionVisibility();
}

function onTokenDescriptionSearchInput() {
	updateTokenDescriptionVisibility();
}

function onTagFilterClicked(e) {
	const tile = e.currentTarget;
	toggleTagFilterTileState(tile);
	saveTagFilters();
}

function onOpenModalRoleDescription(role) {
	buildModalRoleDescription(role);
	openModalOverlay();
}

function onCloseModalOverlay() {
	closeModalOverlay();
}

function onSettingsReset() {
	Settings.reset();
	refreshSettingsUIFromState();
}

/*
 * Toggles a settings node's children open/closed. A node with children can itself be a weight/percent/toggle item, so its own input control lives in
 * this same row alongside the disclosure toggle - the guard below stops a click on that control (or the error indicator button) from also
 * collapsing/expanding the row. Child rows live in a separate childrenWrap sibling, not inside this row, so they can't trigger this listener anyway.
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

/*
 * Shows the errors stashed on the clicked indicator by updateValidationIcon (target._validationErrors) in the modal overlay. Falls
 * back to an empty array if none were stashed (indicator shouldn't be visible/clickable in that case, but this guards against it
 * anyway). No return value.
 */
function onErrorIndicatorClicked(e) {
	e.stopPropagation();

	const errors = e.currentTarget._validationErrors ?? [];

	buildModalErrorPanel(errors);
	openModalOverlay();
}

function onPrintRulesClicked(e) {
	const toHide = document.querySelectorAll("h1, .role-search, .panel-header, #languageSelector, .panel:not(.panel-rules)");
	printWithHiddenElements([...toHide]);
}

function onPrintDescriptionsClicked(e) {
	const toHide = document.querySelectorAll("h1, .role-search, .panel-header, #languageSelector, .panel:not(.panel-role-descriptions)");
	printWithHiddenElements([...toHide]);
}

function onPrintTokensClicked(e) {
	const toHide = document.querySelectorAll("h1, .role-search, .panel-header, #languageSelector, .panel:not(.panel-token-descriptions)");
	printWithHiddenElements([...toHide]);
}

/*
 * Moves promptState.currentTurn according to which navigation button (e.currentTarget.dataset.action: "first"/"prev"/"next"/"last")
 * was clicked, then re-renders via setCurrentTurn. No return value.
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
			newTurn = promptState.renderedTurns.length - 1;
			break;
	}

	setCurrentTurn(newTurn);
}

function onNavigationModeChanged(e) {
	promptState.showSingleTurn = e.currentTarget.checked;
	renderPrompt();
}

function onWindowResize() {
	updateGUIScale();
	resizePromptBox();
	updateDayTimerSpacer();
}

function onRerandomizeClicked(e) {
	Rules.rerandomize();
	updatePrompt();
}





/* =========================
   Initialization
   ========================= */

/*
 * Assigns listener functions to fixed GUI elements. Dynamic elements have listeners assigned at creation instead (see e.g.
 * applySelectionTileListeners, createSelectionTagFilterTile's own listener, onTagFilterClicked wiring). No parameters, no return value.
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

// Restores persisted state, resumes a running timer's interval if needed, and syncs the UI to match
function initDayTimer() {
	loadDayTimer();

	if (dayTimer.state === "running")
		ensureDayTimerInterval();

	updateDayTimerUI();
	updateDayTimerSpacer();
}

/*
 * Builds the role selection and description tiles for every enabled role, sorted by localized name, and wires up each selection
 * tile's click/hold listeners. No parameters, no return value.
 */
function initRoleElements() {
	const sortedRoles = getEnabledRolesSorted();

	sortedRoles.forEach(role => {
		const selectionTile = buildSelectionListTile(role);
		applySelectionTileListeners(selectionTile, role);

		buildDescriptionListTile(role);
	});
}

function initTokenElements() {
	const sortedTokens = getEnabledTokensSorted();
	sortedTokens.forEach(token => buildTokenDescriptionListTile(token));
}

/*
 * Wires up every static panel's collapse/expand behavior (click header to toggle) and applies each panel's initial collapsed state
 * from its data-collapsed attribute in the HTML. No parameters, no return value.
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

/*
 * Initializes the application in dependency order:
 *
 *   language
 *   persisted state
 *   adaptive layout
 *   DOM construction
 *   listener registration
 *   initial synchronization
 */
function initGUI() {
	// Load language first so it's ready for component initialization, no dependency on anything
	setGUILanguage(Localization.getLanguage());

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

	// Update the GUI to apply non-default states
	updateRolesUI();
}

initGUI();