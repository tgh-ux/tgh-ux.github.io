//Required hold time to open role description overlay from the role selection tile
const LONG_PRESS_DELAY = 300;
//Selected roles persistent storage key
const SELECTED_ROLES_STORE = "onuw_roles";
//Selected tag filters persistent storage key
const TAG_FILTERS_STORE = "onuw_tag_filters";

//Map of currently selected roles with instance count
//setRoleCount() ensures that roles with no instances are deleted from the map
const roleCounts = new Map(); // roleId -> count

//Callback table for how to handle different error types in relation to the DOM elements
const VALIDATION_RENDERERS = {
	value: renderValueError,
	weightGroupSum: renderWeightGroupError,
};

//Tracks push and hold interactions with role selection tiles
let activeSelectionPointerId = null;

//Prompt display data
let renderedTurns = [];
let currentTurn = 0;
let showSingleTurn = false;

//Day timer persistent storage key
const DAY_TIMER_STORE = "onuw_day_timer";
//How often the display redraws while the timer is running. Purely cosmetic - the authoritative end time is a wall-clock timestamp, so this has no effect on accuracy
const DAY_TIMER_TICK_INTERVAL = 150;
//Seconds adjusted by the day timer's +/- buttons
const DAY_TIMER_ADJUST_STEP = 30;
//Default duration (seconds) the very first time the page is opened, before anything has been configured
const DAY_TIMER_DEFAULT_DURATION = 300;

//Day timer lifecycle state
let dayTimerState = "stopped"; // "stopped" | "running" | "paused"
//The duration to fall back to when reset via the stop button, in seconds
let dayTimerDuration = DAY_TIMER_DEFAULT_DURATION;
//Remaining time in seconds - authoritative only while stopped/paused; while running it's derived from dayTimerTargetTimestamp instead
let dayTimerRemaining = dayTimerDuration;
//Wall-clock timestamp (ms) at which the timer reaches zero, set only while running. Using a fixed end time (rather than decrementing a counter) keeps the timer accurate across tab throttling/backgrounding
let dayTimerTargetTimestamp = null;
//Whether the expanded panel is currently open
let dayTimerExpanded = false;
//Handle for the redraw interval, only active while running
let dayTimerIntervalId = null;

//Tags to add as a filter at role selection. Each group is an AND relationship, tags within groups is an OR relationship
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

//Sprite sheets with fallbacks for those that contained localization, updated when language is set
const LOCALIZED_SPRITE_SHEETS = [
	{
		cssVar: "--card-sprite-sheet",
		path: "Sprites/sprites_cards_%LANGUAGE%.jpg",
		fallbackPath: "Sprites/sprites_cards_swe.jpg",
	},
	{
		cssVar: "--token-sprite-sheet",
		path: "Sprites/sprites_tokens_%LANGUAGE%.png",
		fallbackPath: "Sprites/sprites_tokens_swe.png",
	},
];





/* =========================
   Localization
   ========================= */

//Sets the page language
function setGUILanguage(lang) {
	setGUISpriteLanguage(lang);
	document.getElementById("languageSelector").value = lang;
}
//Sets any localized sprite sheets in the CSS based on selected language
function setGUISpriteLanguage(lang) {
	LOCALIZED_SPRITE_SHEETS.forEach((sheetData)  => {
		const sheetPath = sheetData.path.replace(/%LANGUAGE%/, lang.toLowerCase());
		const img = new Image();
		
		//Set the path if image is loaded successfully
		img.onload = () => {
			document.documentElement.style.setProperty(sheetData.cssVar, `url("${sheetPath}")`);
		};
		
		//If image fails to load (e.g. missing asset), use the fallback asset
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
//Localizes elements declared in HTML late
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

//Saves selected roles to persistent storage
function saveSelectedRoles() {
	const roles = Object.fromEntries(roleCounts);
	localStorage.setItem(SELECTED_ROLES_STORE, JSON.stringify(roles));
}
//Loads selected roles from persistent storage, updating selected role counter
//Called once on page load, deferring updating GUI to the init process
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
				console.warn("\t" + roleId + " is diabled, ignoring attempt to load");
			}
		}
		console.groupEnd();
		
	} catch {
		// ignore corrupted data
		console.warn("Unable to load selected roles from storage");
	}
}
//Saves selected tag filters to persistent storage
function saveTagFilters() {
	const filters = getSelectedTagFilters();
	localStorage.setItem(TAG_FILTERS_STORE, JSON.stringify(filters));
}
//Loads selected tag filters from persistent storage
//Called once directly after tag filters have been loaded
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
//Saves the day timer state to persistent storage
function saveDayTimer() {
	const data = {
		state: dayTimerState,
		duration: dayTimerDuration,
		remaining: getDayTimerRemainingSeconds(),
		targetTimestamp: dayTimerTargetTimestamp,
	};
	localStorage.setItem(DAY_TIMER_STORE, JSON.stringify(data));
}
//Loads the day timer state from persistent storage, resuming a running timer based on wall-clock time so a reload (or the tab having been closed) doesn't lose progress
//Called once on page load, deferring updating GUI to the init process
function loadDayTimer() {
	const raw = localStorage.getItem(DAY_TIMER_STORE);
	if (!raw) return;

	try {
		const data = JSON.parse(raw);

		dayTimerDuration = Number.isFinite(data.duration) ? data.duration : DAY_TIMER_DEFAULT_DURATION;

		if (data.state === "running" && typeof data.targetTimestamp === "number") {
			const remaining = Math.max(0, Math.round((data.targetTimestamp - Date.now()) / 1000));

			if (remaining > 0) {
				dayTimerState = "running";
				dayTimerTargetTimestamp = data.targetTimestamp;
			} else {
				//Timer would have already run out while the page was closed/reloaded
				dayTimerState = "stopped";
				dayTimerRemaining = 0;
			}
		} else if (data.state === "paused") {
			dayTimerState = "paused";
			dayTimerRemaining = Math.max(0, Number.isFinite(data.remaining) ? data.remaining : dayTimerDuration);
		} else {
			dayTimerState = "stopped";
			dayTimerRemaining = dayTimerDuration;
		}

	} catch {
		console.warn("Unable to load day timer from storage");
	}
}



/* =========================
   Role utility functions
   ========================= */

//Retrieves a sorted list of all tokens that are enabled
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
//Retrieves a localized lowercase text, used by the search function for comparisons against search term
function getTokenSearchText(token) {
	return Localization.localize(token.nameKey).toLowerCase();
}
//Creates a base token tile shared by (future) token views
function createTokenTile(token, ...classes) {
	const el = document.createElement("div");
	el.classList.add(...classes);
	el.dataset.tokenName = getTokenSearchText(token);	//Normalized token name used for search/filtering
	el.dataset.tokenId = token.id;	//Used for identification of associated token

	return el;
}
//Retrieves a sorted list of all roles that are enabled
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
//Retrieves a list of all currently selected roles
function getSelectedRoleIds() {
	return Array.from(roleCounts.keys());
}
//Retrieves the number of players supported by the current selection
function getPlayerCount() {
	return Roles.calculatePlayerCount(roleCounts);
}
//Retrieves a localized lowercase text, used by the search function for comparisons against search term
function getRoleSearchText(role) {
	return Localization.localize(role.nameKey).toLowerCase();
}
//Retrieves the number of selected role instances
function getRoleCount(roleId) {
	return roleCounts.get(roleId) ?? 0;
}
//Sets the number of selected role instances
function setRoleCount(roleId, value) {
	if (value <= 0)
		roleCounts.delete(roleId);
	else
		roleCounts.set(roleId, value);
}
//Returns true if at least one instance of the role is selected, else false
function roleIsSelected(roleId) {
	return getRoleCount(roleId) > 0;
}
//Returns true if at least one role is selected, else false
function isAnyRoleSelected() {
	return roleCounts.size > 0;
}
//Returns the localized, comma-separated list of role names that use a given token
function getTokenUsedByText(token) {
	return Roles.getRolesUsingToken(token).map(roleId => Localization.localize(Roles.getNameKey(roleId))).join(", ");
}
//Returns a localized, comma-separated list of role names from an array of roleIDs
function getRoleList(roleIds) {
	return roleIds.map(roleId => Localization.localize(Roles.getNameKey(roleId))).join(", ");
}


/* =========================
   DOM construction
   ========================= */

function buildPromptNavigationControls() {
	const content = document.querySelector(".panel-output > .panel-content");
	const outputBox = document.getElementById("promptOutput");

    const nav = document.createElement("div");
    nav.className = "prompt-navigation";

    // Single-turn checkbox
    const label = document.createElement("label");
    label.className = "prompt-navigation-toggle";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
	checkbox.checked = showSingleTurn;
    checkbox.id = "promptSingleTurn";

    const text = document.createElement("span");
    text.textContent = Localization.localize("UI_PROMPT_SINGLETURN");

    label.append(checkbox, text);

    // First
    const first = document.createElement("button");
    first.id = "promptFirst";
    first.className = "prompt-navigation-button";
    first.type = "button";
    first.textContent = "⏮";
	first.dataset.action = "first";

    // Previous
    const previous = document.createElement("button");
    previous.id = "promptPrevious";
    previous.className = "prompt-navigation-button";
    previous.type = "button";
    previous.textContent = "◀";
	previous.dataset.action = "prev";

    // Counter
    const counter = document.createElement("span");
    counter.id = "promptCounter";
    counter.className = "prompt-navigation-counter";
    counter.textContent = "1 / 1";

    // Next
    const next = document.createElement("button");
    next.id = "promptNext";
    next.className = "prompt-navigation-button";
    next.type = "button";
    next.textContent = "▶";
	next.dataset.action = "next";

    // Last
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
	   Sprites
	   ========================= */
	
	//Retrieves the CSS attributes of a sprite sheet matching the type parameter
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
	//Sets the absolute offset on an icon element within a sprite sheet where the desired sprite with abstract coordinates x and y is located
	function applySpriteOffset(el, type, position) {
		const { width, height } = getSpriteData(type);
		
		el.style.setProperty(`--${type}-sprite-x`, `${-position.x * width}px`);
		el.style.setProperty(`--${type}-sprite-y`, `${-position.y * height}px`);
	}
	//Creates an icon element containing a sprite image from a sprite sheet
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
	//Shorthand helper for creating a role portrait icon
	function createRoleIcon(role) {
		return createSprite("role", Roles.getPortraitIcon(role));
	}
	//Shorthand helper for creating a full playing card icon
	function createCardIcon(card) {
		return createSprite("card", card);
	}
	//Shorthand helper for creating a token icon
	function createTokenIcon(token) {
		return createSprite("token", Roles.getTokenIcon(token));
	}

	/* =========================
	   Tile construction
	   ========================= */

	//Creates a base role tile shared by the selection and description views
	function createRoleTile(role, ...classes) {
		const el = document.createElement("div");
		el.classList.add(...classes);
		el.dataset.roleName = getRoleSearchText(role);	//Normalized role name used for search/filtering
		el.dataset.roleId = role.id;	//Used for identification of associated role

		return el;
	}
	//Creates and populates a role selection tile
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
	//Adds listeners to a tile (selection) to support click to select and hold to open description overlay
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
	//Returns the localized team text for a role
	function getDescriptionTeamText(role) {
		let team = Localization.localize(role.team);
		
		if (team && role.tags?.includes("CAN_CHANGE_ALIGNMENT")) {
			team += Localization.localize("TEAM_VARIABLE_SUFFIX");
		}

		return team;
	}
	//Returns the localized active phase text for a role
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
	//Assembles and returns the localized composite win condition description text for a role
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
	//Populates a role description tile. Used by both the description list and description overlay, defers icon elements to caller
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
	//Creates a role description tile
	function buildDescriptionListTile(role) {
		const container = document.getElementById("descriptionList");
		const tile = createRoleTile(role, "description-tile");
		const icon = createRoleIcon(role);
		
		tile.append(icon);
		populateDescriptionTile(tile, role);
		container.appendChild(tile);
		
		return tile;
	}
	//Populates a token description tile
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
	//Creates a token description tile
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

	//Builds the collapsed token icon row with click-to-reveal detail, returning the detail container to append alongside it
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
		
		//Auto-select the first token so the modal opens at its final size, rather than resizing (and potentially triggering scroll) on first click
		const firstTile = listContainer.querySelector(".modal-token-tile");
		if (firstTile) {
			showDetail(tokens[0], firstTile);
		}

		return detail;
	}
	//Creates a small tile pairing a token's icon with its description, or just the icon when collapsed
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
	//Creates a role description tile for the modal overlay
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
	//Creates and populates the modal overlay with a validation result panel
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
				if (i < err.optionKey.length-1)
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
	
	//Creates and populates a selection tag filter group tile
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
	//Creates and populates a selection tag filter group
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
	//Builds the selection tag filter elements
	function buildSelectionTagFilters() {
		const container = document.getElementById("roleFilterContainer");
		container.innerHTML = "";
		
		TAG_FILTER_GROUPS.forEach(groupData => {
			const group = createSelectionTagFilterGroup(groupData.id, groupData.textKey, groupData.tags);
			container.appendChild(group);
		});
	}

	/* =========================
	   Settings
	   ========================= */

	function applyTextStyleClasses(label, node) {
		for (const style of Settings.getNodeTextStyles(node)) {
			label.classList.add("settings-font-" + style);
		}
	}

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
		
		//Insert either an empty space indentation, or a disclosure indicator for collapsible rows with children
		const leadingElement = (hasChildren && !isSeparator) ? createDisclosureIndicator() : createSpacer();
		row.appendChild(leadingElement);
		
		if (isSeparator) {
			//This is a separator, so no extras or children are required
			const line = document.createElement("div");
			line.className = "settings-separator-line";
			row.appendChild(line);
			return item;
		}
		
		// Label
		const label = document.createElement("div");
		label.className = "settings-row-label";
		label.textContent = Localization.localize(node.textKey);	
		
		applyTextStyleClasses(label, node);
		row.appendChild(label);
		
		row.appendChild(createSettingErrorIndicator());

		// Control (headers never have one)
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

	function buildSettingsUI() {
		const settingsList = document.getElementById("settingsList");
		
		for (const rootNode of Settings.getRootNodes()) {
			settingsList.appendChild(createSettingNode(rootNode, 0));
		}
		
		const settings_header = document.querySelector(".panel-settings > .panel-header");
		const indicator = createSettingErrorIndicator();
		indicator.id = "settingsPanelValidationIndicator";
		settings_header.appendChild(indicator);

		//Ensure UI state is correct
		updateSettingsValidationUI();
	}

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

	function applyWeightGroupBorders(wrap) {
		const weightGroups = getItemsByWeightGroup(wrap);
		
		for (const items of weightGroups.values()) {
			if (items.length <= 1) continue;	//If single item in group, no need to box it
			
			items[0].classList.add("settings-weightbox", "settings-weightbox-top");	//Add to first item
			items[items.length-1].classList.add("settings-weightbox", "settings-weightbox-bottom");	//Add to last item
			
			for (let i = 1; i < items.length-1; i++)
				items[i].classList.add("settings-weightbox", "settings-weightbox-middle");	//Add to all middle items
		}
	}





/* =========================
   DOM updates
   ========================= */

function updateRolesUI() {
	// Resolve invalid selections (including chains)
	while (sanitizeRoleSelection()) {};

	// Update all tiles
	document.querySelectorAll(".selection-tile").forEach(tile => {
		const roleId = tile.dataset.roleId;
		const count = getRoleCount(roleId);
		updateRoleTileVisual(tile, count, roleId);
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

//Ensures that all selected roles are actually selectable, e.g. if a role is deselected that another role depends on
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

function updateRoleTileVisual(tile, count, roleId) {
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

function updateDescriptionVisibility() {
	const searchTerm = document.getElementById("roleDescriptionSearchField").value.toLowerCase().trim();
	const tiles = document.querySelectorAll(".description-tile");
	const hasSelection = isAnyRoleSelected();

	updateTileVisibility(tiles, searchTerm, tile => !hasSelection || roleIsSelected(tile.dataset.roleId))
}

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

function roleMatchesAllFilterGroups(roleId, groupedFilters) {
	// Iterate over each group (ruleset, complexity, etc.)
	for (const groupId in groupedFilters) {
		const selectedTags = groupedFilters[groupId];

		// If no tags selected in this group → ignore it
		if (!selectedTags || selectedTags.length === 0) continue;

		// Role must match at least one tag in this group (OR)
		const matchesGroup = selectedTags.some(tag =>
			Roles.hasTag(roleId, tag)
		);

		// If it fails any group → overall failure (AND)
		if (!matchesGroup) {
			return false;
		}
	}

	return true;
}

function updateSelectionVisibility() {
	const searchTerm = document.getElementById("roleSelectionSearchField").value.toLowerCase().trim();
	const tiles = document.querySelectorAll(".selection-tile");
	const tagFilters = getSelectedTagFilters();
	
	updateTileVisibility(tiles, searchTerm, tile => {
		const roleId = tile.dataset.roleId;
		return roleMatchesAllFilterGroups(roleId, tagFilters) || roleIsSelected(roleId);
	});
}
//Toggles a tag filter tile between selected and unselected
function toggleTagFilterTileState(tile) {
	const isSelected = tile.classList.contains("selected");
	setTagFilterTileState(tile, !isSelected);
}
//Sets the tag filter tile status and updates the selection UI
function setTagFilterTileState(tile, isSelected) {
	tile.classList.toggle("selected", isSelected);
	tile.classList.toggle("unselected", !isSelected);
	updateSelectionVisibility();
}

function updatePromptNavigation() {
	const label = document.getElementById("promptCounter");
	if (showSingleTurn) {
		label.textContent = (renderedTurns.length > 0) ? `${currentTurn+1} / ${renderedTurns.length}` : "-";
	} else {
		label.textContent = "-";
	}
	
	document.getElementById("promptFirst").disabled = !showSingleTurn || currentTurn <= 0;
	document.getElementById("promptPrevious").disabled = !showSingleTurn || currentTurn <= 0;
	document.getElementById("promptNext").disabled = !showSingleTurn || currentTurn >= renderedTurns.length - 1;
	document.getElementById("promptLast").disabled = !showSingleTurn || currentTurn >= renderedTurns.length - 1;
}

function renderPrompt() {
    const outputBox = document.getElementById("promptOutput");

    if (!showSingleTurn) {
        outputBox.value = renderedTurns.map(t => t.text).join("\n\n");
    }
    else {
        outputBox.value = renderedTurns[currentTurn]?.text ?? "";
    }

    updatePromptNavigation();
    resizePromptBox();
}

function updatePrompt(relevantErrors) {
	function _showPromptUnavailable(message) {
		renderedTurns = [];
		currentTurn = 0;

		document.getElementById("promptOutput").value = message;

		updatePromptNavigation();
		resizePromptBox();
	}
	
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

		renderedTurns = Interpreter.renderAll(turns);

		//Success path - currentTurn is preserved, only clamped if now out of range
		currentTurn = Math.min(currentTurn, renderedTurns.length - 1);
		if (currentTurn < 0)
			currentTurn = 0;

		renderPrompt();

	} catch (error) {
		console.error(error);
		_showPromptUnavailable(String(error));
	}
}

function resizePromptBox() {
	const outputBox = document.getElementById("promptOutput");
	outputBox.style.height = "auto";
	outputBox.style.height = outputBox.scrollHeight + "px";
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
	   Settings
	   ========================= */

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

	function refreshInputsFromState(selector, applyFn) {
		document.querySelectorAll(selector).forEach(input => {
			const oid = input.dataset.settingOid;
			try {
				applyFn(input, Settings.getValue(oid));
			} catch {
				//Defensive only - every input should always have a valid oid from the same tree Settings walks
				console.warn(`Unable to refresh input for unknown setting oid: ${oid}`);
			}
		});
	}

	function refreshSettingsUIFromState() {
		refreshInputsFromState('input[type="number"][data-setting-oid]', (input, v) => input.value = String(v));
		refreshInputsFromState('input[type="checkbox"][data-setting-oid]', (input, v) => input.checked = Boolean(v));

		updateAllWeightPercentages();
		updateSettingsUI();
	}

	function updateSettingsValidationUI(errors = []) {
		const byOid = new Map();
		for (const err of errors) {
			if (!byOid.has(err.oid))
				byOid.set(err.oid, []);
			
			byOid.get(err.oid).push(err);
		}
		
		const root = document.getElementById("settingsList");
		let collected_errors = [];

		for (const item of root.children)
			collected_errors.push(...updateSettingsValidationNode(item, byOid));
		
		updateSettingsPanelValidation(collected_errors);
	}
	
	function clearValidationState(item) {
		item.classList.remove("settings-has-errors");

		const childrenWrap = item.querySelector(":scope > .settings-childrenwrap");

		if (childrenWrap) {
			for (const child of childrenWrap.children)
				child.classList.remove("settings-weightbox-error");
		}
	}

	function renderValueError(item, err) {
		item.classList.add("settings-has-errors");
	}

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

	function applyValidationError(item, err) {
		const renderer = VALIDATION_RENDERERS[err.errorType];
		if (renderer)
			renderer(item, err);
		else
			console.warn(`Unknown validation error type '${err.errorType}'`);
	}

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

		let select_scale = minViewport / SELECT_BASE_SIZE;
		select_scale = Math.max(MIN_SELECT_SCALE, Math.min(MAX_SELECT_SCALE, select_scale));
		let description_scale = minViewport / DESCRIPTION_BASE_SIZE;
		description_scale = Math.max(MIN_DESCRIPTION_SCALE, Math.min(MAX_DESCRIPTION_SCALE, description_scale));

		document.documentElement.style
			.setProperty("--selection-tile-scale", select_scale.toFixed(3));

		document.documentElement.style
			.setProperty("--description-tile-scale", description_scale.toFixed(3));
	}





/* =========================
   Printing
   ========================= */

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

//Retrieves the current remaining time in seconds, derived from the target timestamp while running
function getDayTimerRemainingSeconds() {
	if (dayTimerState === "running" && dayTimerTargetTimestamp != null) {
		return Math.max(0, Math.round((dayTimerTargetTimestamp - Date.now()) / 1000));
	}
	return dayTimerRemaining;
}
//Formats a whole number of seconds as MM:SS, clamped to zero
function formatDayTimerTime(totalSeconds) {
	const clamped = Math.max(0, Math.round(totalSeconds));
	const minutes = Math.floor(clamped / 60);
	const seconds = clamped % 60;
	return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

//Starts or resumes the timer from its current remaining time. No-op if already running or if there's no time left (stop first to reset)
function startDayTimer() {
	if (dayTimerState === "running" || dayTimerRemaining <= 0) return;

	dayTimerTargetTimestamp = Date.now() + dayTimerRemaining * 1000;
	dayTimerState = "running";

	ensureDayTimerInterval();
	updateDayTimerUI();
	saveDayTimer();
}
//Pauses the timer, freezing the remaining time until resumed
function pauseDayTimer() {
	if (dayTimerState !== "running") return;

	dayTimerRemaining = getDayTimerRemainingSeconds();
	dayTimerTargetTimestamp = null;
	dayTimerState = "paused";

	clearDayTimerInterval();
	updateDayTimerUI();
	saveDayTimer();
}
//Stops the timer and resets it back to the configured duration, ready to be started again
function stopDayTimer() {
	dayTimerState = "stopped";
	dayTimerTargetTimestamp = null;
	dayTimerRemaining = dayTimerDuration;

	clearDayTimerInterval();
	updateDayTimerUI();
	saveDayTimer();
}
//Adjusts the remaining time (and the running target, if running) by a number of seconds, clamped to zero
//While stopped, also updates the configured duration, since there's nothing else to fall back to
function adjustDayTimer(deltaSeconds) {
	if (dayTimerState === "running") {
		dayTimerTargetTimestamp = Math.max(Date.now(), dayTimerTargetTimestamp + deltaSeconds * 1000);
	} else {
		dayTimerRemaining = Math.max(0, dayTimerRemaining + deltaSeconds);
		if (dayTimerState === "stopped")
			dayTimerDuration = dayTimerRemaining;
	}

	updateDayTimerUI();
	saveDayTimer();
}
//Sets an explicit duration in seconds, only valid while stopped or paused (guarded by caller, but defensively re-checked here)
function setDayTimerDuration(totalSeconds) {
	if (dayTimerState === "running") return;

	const clamped = Math.max(0, Math.round(totalSeconds));
	dayTimerRemaining = clamped;
	if (dayTimerState === "stopped")
		dayTimerDuration = clamped;

	updateDayTimerUI();
	saveDayTimer();
}

function ensureDayTimerInterval() {
	if (dayTimerIntervalId != null) return;
	dayTimerIntervalId = setInterval(tickDayTimer, DAY_TIMER_TICK_INTERVAL);
}

function clearDayTimerInterval() {
	if (dayTimerIntervalId == null) return;
	clearInterval(dayTimerIntervalId);
	dayTimerIntervalId = null;
}
//Redraw callback while running. Also detects reaching zero, at which point the timer simply stops (staying at 00:00 until the narrator presses stop/reset)
function tickDayTimer() {
	if (getDayTimerRemainingSeconds() > 0) {
		updateDayTimerUI();
		return;
	}

	dayTimerState = "stopped";
	dayTimerTargetTimestamp = null;
	dayTimerRemaining = 0;

	clearDayTimerInterval();
	updateDayTimerUI();
	saveDayTimer();
}

//Refreshes the pill text, panel time, and toggle button label to match the current state
function updateDayTimerUI() {
	const isRunning = dayTimerState === "running";
	const timeText = formatDayTimerTime(getDayTimerRemainingSeconds());

	const pillText = document.getElementById("dayTimerPillText");
	if (pillText)
		pillText.textContent = (dayTimerState === "stopped") ? Localization.localize("UI_DAYTIMER_START") : timeText;

	const display = document.getElementById("dayTimerDisplay");
	if (display) {
		//Only overwrite the field's value when it isn't the active element, so a redraw doesn't fight with an in-progress edit
		if (document.activeElement !== display)
			display.value = timeText;
		display.disabled = isRunning;
	}

	const toggleBtn = document.getElementById("dayTimerToggle");
	if (toggleBtn)
		toggleBtn.textContent = isRunning ? "⏸" : "▶";
}

//Expands the panel, pushing page content down
function expandDayTimer() {
	dayTimerExpanded = true;
	document.body.classList.add("day-timer-expanded");
	updateDayTimerSpacer();
}
//Collapses back down to the floating pill
function collapseDayTimer() {
	dayTimerExpanded = false;
	document.body.classList.remove("day-timer-expanded");
	updateDayTimerSpacer();
}
//Resizes the layout spacer to match the expanded panel's actual rendered height (which may wrap on narrow screens), so it reserves the right amount of space
function updateDayTimerSpacer() {
	const spacer = document.getElementById("dayTimerSpacer");
	const panel = document.getElementById("dayTimerPanel");
	if (!spacer || !panel) return;

	//Deferred a frame so the panel's display change (via the body class) has taken effect before measuring it
	requestAnimationFrame(() => {
		spacer.style.height = dayTimerExpanded ? panel.getBoundingClientRect().height + "px" : "0px";
	});
}



/* =========================
   Event listeners
   ========================= */

function onWindowResize() {
	updateGUIScale();
	resizePromptBox();
	updateDayTimerSpacer();
}

function onSettingsReset() {
	Settings.reset();
	refreshSettingsUIFromState();
}

function onSelectedRolesReset() {
	const tiles = document.querySelectorAll(".selection-tile");
	
	tiles.forEach(tile => {
		const roleId = tile.dataset.roleId;
		setRoleCount(roleId, 0);
	});

	updateRolesUI();
}

function onSelectionSearchInput() {
	updateSelectionVisibility();
}

function onDescriptionSearchInput() {
	updateDescriptionVisibility();
}

function onLanguageSelect(e) {
	const lang = e.target.value;
	Localization.setLanguage(lang);
	//setGUILanguage(lang);	//If switching to updating page rather than reloading, this needs to be added back
	window.location.reload();
}

function onOpenModalRoleDescription(role) {
	buildModalRoleDescription(role);
	openModalOverlay();
}

function onCloseModalOverlay() {
	closeModalOverlay();
}

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

function onTagFilterClicked(e) {
	const tile = e.currentTarget;
	toggleTagFilterTileState(tile);
	saveTagFilters();
}

function onPrintRulesClicked(e) {
	const toHide = document.querySelectorAll("h1, .role-search, .panel-header, #languageSelector, .panel:not(.panel-rules)");
	printWithHiddenElements([...toHide]);
}

function onPrintDescriptionsClicked(e) {
	const toHide = document.querySelectorAll("h1, .role-search, .panel-header, #languageSelector, .panel:not(.panel-role-descriptions)");
	printWithHiddenElements([...toHide]);
}

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

function onErrorIndicatorClicked(e) {
	e.stopPropagation();

	const errors = e.currentTarget._validationErrors ?? [];

	buildModalErrorPanel(errors);
	openModalOverlay();
}

function onNavigationButtonClicked(e) {
	const target = e.currentTarget;
	const action = target.dataset.action;
	
	switch (action) {
		case "first":
			currentTurn = 0;
			break;
		case "prev":
			currentTurn = Math.max(0, currentTurn-1);
			break;
		case "next":
			currentTurn = Math.min(renderedTurns.length-1, currentTurn+1);
			break;
		case "last":
			currentTurn = Math.max(0, renderedTurns.length-1);
			break;
	}
	
	renderPrompt();
}

function onNavigationModeChanged(e) {
	showSingleTurn = e.currentTarget.checked;
	renderPrompt();
}

function onTokenDescriptionSearchInput() {
	updateTokenDescriptionVisibility();
}

function onPrintTokensClicked(e) {
	const toHide = document.querySelectorAll("h1, .role-search, .panel-header, #languageSelector, .panel:not(.panel-token-descriptions)");
	printWithHiddenElements([...toHide]);
}

function onDayTimerPillClicked() {
	expandDayTimer();
}

function onDayTimerCollapseClicked() {
	collapseDayTimer();
}

function onDayTimerToggleClicked() {
	if (dayTimerState === "running")
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
//Parses the typed MM:SS value on commit (blur/enter). Reverts to the current value on anything unparseable, rather than guessing
function onDayTimerDisplayChange(e) {
	if (dayTimerState === "running") return;

	const match = e.target.value.trim().match(/^(\d{1,3}):([0-5]?\d)$/);

	if (!match) {
		updateDayTimerUI();	//Invalid input, revert the field back to the current value
		return;
	}

	const minutes = parseInt(match[1], 10);
	const seconds = parseInt(match[2], 10);
	setDayTimerDuration(minutes * 60 + seconds);
}

function onRerandomizeClicked(e) {
	Rules.rerandomize();
	updatePrompt();
}




/* =========================
   Initialization
   ========================= */

//Assigns listener functions to fixed GUI elements. Dynamic elements may have listeners assigned at creation
function initGUIListeners() {
	//May trigger twice in some cases, but necessary for cross-device support
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
	
	
}

//Restores persisted state, resumes a running timer's interval if needed, and syncs the UI to match
function initDayTimer() {
	loadDayTimer();

	if (dayTimerState === "running")
		ensureDayTimerInterval();

	updateDayTimerUI();
	updateDayTimerSpacer();
}

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

function initGUI() {
	//Load language first so it's ready for component initialization, no dependency on anything
	setGUILanguage(Localization.getLanguage());
	
	//Load configuration/stored values, no dependecy
	loadSelectedRoles();
	initDayTimer();	//Loads persisted timer state and resumes ticking if it was left running
	
	//Adapt scaling to window size, no dependecy
	updateGUIScale();
	
	//Setup DOM elements in their default states, no interdependency but depends on localization to be loaded
	localizeStaticContent();
	initPanels();
	initRoleElements();
	initTokenElements();
	buildSelectionTagFilters();
	buildSettingsUI();
	buildPromptNavigationControls();
	
	//Load saved tag filters, depends on buildSelectionTagFilters() having executed first
	loadTagFilters();
	
	//Assign listeners to DOM elements, depends on DOM being completed
	initGUIListeners();
	
	//Update the GUI to apply non-default states
	updateRolesUI();
}

initGUI();