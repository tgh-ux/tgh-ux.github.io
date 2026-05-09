const roleCounts = new Map(); // roleId → count

//Tags to add as a filter at role selection. Each group is an AND relationship, tags within groups is an OR relationship
const TAG_FILTER_GROUPS = [
    {
        id: "ruleset",
        label: "UI_FILTER_RULESET",
        tags: [
            { tag: "RULESET_BASIC", label: "UI_FILTER_RULESET_BASIC", default: true },
            { tag: "RULESET_ADVANCED", label: "UI_FILTER_RULESET_ADVANCED" },
            { tag: "RULESET_ALIEN", label: "UI_FILTER_RULESET_ALIEN" },
            { tag: "RULESET_VAMPIRE", label: "UI_FILTER_RULESET_VAMPIRE" },
        ]
    },
    {
        id: "complexity",
        label: "UI_FILTER_COMPLEXITY",
        tags: [
            { tag: "COMPLEXITY_EASY", label: "UI_FILTER_COMPLEXITY_EASY", default: true },
            { tag: "COMPLEXITY_MEDIUM", label: "UI_FILTER_COMPLEXITY_MEDIUM", default: true },
            { tag: "COMPLEXITY_HARD", label: "UI_FILTER_COMPLEXITY_HARD" },
        ]
    }
];

/* =========================
   Shared helpers
   ========================= */

function setLanguage(lang) {
	setLocalizationLanguage(lang);
	window.location.reload();
}

function saveRolesToStorage() {
    const roles = Object.fromEntries(roleCounts);
    localStorage.setItem("onuww_roles", JSON.stringify(roles));
}

function loadRolesFromStorage() {
    const raw = localStorage.getItem("onuww_roles");
    if (!raw) return;

    try {
        const roles = JSON.parse(raw);
		
		console.group("Loaded role selection");

        for (const [roleId, count] of Object.entries(roles)) {
            if (ROLES[roleId]) {
				if (count > 0) {
					console.log("Enabling role " + roleId + " from storage (count: " + count + ")");
				}
                roleCounts.set(roleId, count);
            }
        }
		console.groupEnd();
		
    } catch {
        // ignore corrupted data
    }
}

function getRoleSearchName(role) {
    // Used for search filtering. Keep consistent across all panels.
    return Loc(role.nameKey).toLowerCase();
}

function getIconSpriteSize() {
    const styles = getComputedStyle(document.documentElement);
    return {
        width: parseFloat(styles.getPropertyValue("--icon-sprite-width")),
        height: parseFloat(styles.getPropertyValue("--icon-sprite-height"))
    };
}

function applyRoleIconOffset(el, role) {
    const { width, height } = getIconSpriteSize();

    el.style.setProperty("--icon-x", `${-role.icon.x * width}px`);
    el.style.setProperty("--icon-y", `${-role.icon.y * height}px`);
}

function createRoleIcon(role) {
    const icon = document.createElement("div");
    icon.className = "role-icon role-icon-base";
    applyRoleIconOffset(icon, role);
    return icon;
}

function createRoleRootEl(role, className, container) {
    const el = document.createElement("div");
    el.className = className;
    el.dataset.roleName = getRoleSearchName(role);
	el.dataset.roleId = role.id;

    if (container === "tiles") {
        el.dataset.roleId = role.id;
    }

    return el;
}

function roleIsEnabled(role) {
    return !getRole(role)?.disable;
}

function getSortedRoles() {
	const roles = Object.values(ROLES).filter(roleIsEnabled);

	const mapped = roles.map(role => { return { role, name: Loc(role.nameKey) }; });

	mapped.sort((a, b) => { return a.name.localeCompare(b.name, LANG); });

	return mapped.map(x => x.role);
}

function applyTextStyleClasses(labelEl, node) {
    const styles = node.textStyle;

    if (!styles) return;

    const list = Array.isArray(styles) ? styles : [styles];

    for (const s of list) {
        if (s === "bold") labelEl.classList.add("setting-text-bold");
        else if (s === "italic") labelEl.classList.add("setting-text-italic");
        else if (s === "underline") labelEl.classList.add("setting-text-underline");
        else if (s === "muted") labelEl.classList.add("setting-text-muted");
    }
}

function updateRoleTileVisual(tile, count, role, selectedRoleIds) {
	const available = roleIsAvailable(role, selectedRoleIds);
	tile.classList.toggle("role-disabled", !available);
	
    tile.classList.toggle("selected", count > 0);
    tile.classList.toggle("unselected", count === 0);

    const badge = tile.querySelector(".role-count");
    if (!badge) return;

    const isMulti = role.maxCount > 1;

    if (!isMulti || count === 0) {
        badge.style.display = "none";
    } else {
        badge.style.display = "";
        badge.textContent = count + (role.maxCount != role.minCount ? "/" + role.maxCount : "");
    }
}

function getPlayerCount() {
	let totalRoles = 0;
	let extraCenter = 0;

	for (const [roleId, count] of roleCounts.entries()) {
		totalRoles += count;

		const role = ROLES[roleId];
		if (role && role.extraCenterCards) {
			extraCenter += role.extraCenterCards * count;
		}
	}
	
	return Math.max(0, totalRoles - (3 + extraCenter));
}

function getSelectedRoleIds() {
    return Array.from(roleCounts.entries())
        .filter(([_, count]) => count > 0)
        .map(([id]) => id);
}

function updatePlayerCountDisplay() {
    const el = document.getElementById("playerCountDisplay");
    if (!el) return;

    el.textContent = Loc("UI_PLAYER_COUNT") + " " + getPlayerCount().toString();
}

function sanitizeRoleSelection(selectedRoleIds) {
    let changed = false;

    for (const roleId of selectedRoleIds) {
        const role = ROLES[roleId];

        if (!roleIsAvailable(role, selectedRoleIds)) {
            roleCounts.set(roleId, 0);
            changed = true;
        }
    }

    return changed;
}

function updateRolesUI() {
    let selectedRoleIds = getSelectedRoleIds();

    // Resolve invalid selections (including chains)
    let changed;
    do {
        changed = sanitizeRoleSelection(selectedRoleIds);
        if (changed) {
            selectedRoleIds = getSelectedRoleIds();
        }
    } while (changed);

    // Update all tiles
    document.querySelectorAll(".role-tile").forEach(tile => {
        const roleId = tile.dataset.roleId;
        const role = ROLES[roleId];
        const count = roleCounts.get(roleId) ?? 0;

        updateRoleTileVisual(tile, count, role, selectedRoleIds);
    });

    updatePlayerCountDisplay();
    applySelectionFilter();
	applyRoleTileFilter();
	saveRolesToStorage();
    updatePrompt();
}

function roleIsAvailable(role, selectedRoles) {
    if (role.disable) return false;
    if (!role.prereq) return true;

    return evaluatePrereq(role.prereq, selectedRoles);
}

function evaluatePrereq(node, selectedRoles) {
    if (!node) return true;

    const hasAny = node.any !== undefined;
    const hasAll = node.all !== undefined;
    const hasType = node.type !== undefined;

    // --- Validation ---
    if (hasAny && hasAll) {
        console.warn("Invalid prereq node (both 'any' and 'all'):", node);
        return false;
    }

    if (!hasAny && !hasAll && !hasType) {
        console.warn("Invalid prereq node (no type/op):", node);
        return false;
    }

    // --- Leaf nodes FIRST ---
    if (hasType) {
        const values = node.any || node.all;

        if (!Array.isArray(values)) {
            console.warn("Leaf node missing values:", node);
            return false;
        }

        switch (node.type) {
            case "role":
                return node.all
                    ? values.every(r => selectedRoles.includes(r))
                    : values.some(r => selectedRoles.includes(r));

            case "team":
                return node.all
                    ? values.every(team =>
                        selectedRoles.some(r => ROLES[r].team === team)
                    )
                    : values.some(team =>
                        selectedRoles.some(r => ROLES[r].team === team)
                    );

            case "tag":
                return node.all
                    ? values.every(tag =>
                        selectedRoles.some(r => roleHasTag(r, tag))
                    )
                    : values.some(tag =>
                        selectedRoles.some(r => roleHasTag(r, tag))
                    );

            default:
                console.warn("Unknown prereq type:", node.type);
                return false;
        }
    }

    // --- Logical nodes AFTER ---
    if (hasAny) {
        return node.any.some(child =>
            evaluatePrereq(child, selectedRoles)
        );
    }

    if (hasAll) {
        return node.all.every(child =>
            evaluatePrereq(child, selectedRoles)
        );
    }

    return false;
}

function getSelectedTagFilters() {
    const result = {};

    document.querySelectorAll(".ruleset-tile.selected").forEach(tile => {
        const groupId = tile.dataset.group;
        const tag = tile.dataset.tag;

        if (!result[groupId]) {
            result[groupId] = [];
        }

        result[groupId].push(tag);
    });

    return result;
}

function roleMatchesAllFilterGroups(role, groupedFilters) {
    // Iterate over each group (ruleset, complexity, etc.)
    for (const groupId in groupedFilters) {
        const selectedTags = groupedFilters[groupId];

        // If no tags selected in this group → ignore it
        if (!selectedTags || selectedTags.length === 0) continue;

        // Role must match at least one tag in this group (OR)
        const matchesGroup = selectedTags.some(tag =>
            roleHasTag(role.id, tag)
        );

        // If it fails any group → overall failure (AND)
        if (!matchesGroup) {
            return false;
        }
    }

    return true;
}

function setRulesetTileState(tile, isSelected) {
    tile.classList.toggle("selected", isSelected);
    tile.classList.toggle("unselected", !isSelected);
}

function localizeStaticContent() {
    document.querySelectorAll("[data-loc]").forEach(el => {
        const key = el.dataset.loc;
        el.textContent = Loc(key);
    });
	
    document.querySelectorAll("[data-loc-placeholder]").forEach(el => {
        const key = el.dataset.locPlaceholder;
        el.placeholder = Loc(key);
    });
	
    document.querySelectorAll("[data-loc-html]").forEach(el => {
        const key = el.dataset.locHtml;
        el.innerHTML = Loc(key);
    });
	
    const titleEl = document.querySelector("title[data-loc]");
    if (titleEl) {
        titleEl.textContent = Loc(titleEl.dataset.loc);
    }
}

function openRoleOverlay(roleId) {
    const overlay = document.getElementById("roleOverlay");
    const content = document.getElementById("roleOverlayContent");

    const role = ROLES[roleId];
    if (!role) return;

    content.innerHTML = "";
    content.appendChild(createRoleDescriptionEntry(role));

    overlay.classList.remove("hidden");

    // Lock background scroll
    document.body.style.overflow = "hidden";
}

function closeRoleOverlay() {
    const overlay = document.getElementById("roleOverlay");
    overlay.classList.add("hidden");

    document.body.style.overflow = "";
}

function handleRoleClick(role) {
    const selectedRoleIds = getSelectedRoleIds();

    if (!roleIsAvailable(role, selectedRoleIds)) return;

    const current = roleCounts.get(role.id) ?? 0;

    let next;
    if (current === 0) next = role.minCount;
    else if (current < role.maxCount) next = current + 1;
    else next = 0;

    roleCounts.set(role.id, next);
    updateRolesUI();
}

/* =========================
   Event listeners
   ========================= */

function onWindowResize() {
	updateRoleScale();
	resizePromptBox();
}

function onSettingsReset() {
    initSettings();
	saveSettingsToStorage();
	refreshSettingsUIFromState();
    updatePrompt();
}

function onSelectedRolesReset() {
    const tiles = document.querySelectorAll(".role-tile");
	const selectedRoleIds = getSelectedRoleIds();


	tiles.forEach(tile => {
		const roleId = tile.dataset.roleId;
		roleCounts.set(roleId, 0);
	});

	updateRolesUI();
}

/* =========================
   Prompt handling
   ========================= */

function updatePrompt() {	
	const outputBox = document.getElementById("promptOutput");
	const roleList = document.getElementById("roleList");

    const selectedRoles = Array.from(
        roleList.querySelectorAll(".role-tile.selected")
    ).map(tile => tile.dataset.roleId);

    outputBox.value = buildPrompt(selectedRoles, getSettingsValues(), ROLES, getPlayerCount());
	resizePromptBox();
}

function resizePromptBox() {
	const outputBox = document.getElementById("promptOutput");
    outputBox.style.height = "auto";
    outputBox.style.height = outputBox.scrollHeight + "px";
}

/* ============================
   Role selection tile assembly
   ============================ */

function buildRoleSelection() {
	const LONG_PRESS_DELAY = 300; // ms
	
	let activeTile = null;
	let activePointerId = null;

    const roleList = document.getElementById("roleList");
	
    getSortedRoles().forEach(role => {
		let pressTimer = null;
		let longPressTriggered = false;
		let startX, startY;
		
		roleCounts.set(role.id, 0);
		
        const tile = createRoleRootEl(role, "role-tile unselected", "tiles");

        const icon = createRoleIcon(role);

        const label = document.createElement("div");
        label.className = "role-tile-name";
        label.textContent = Loc(role.nameKey);
		
		const count = document.createElement("div");
		count.className = "role-count";
		count.style.display = "none";

        tile.append(icon, label, count);

		tile.addEventListener("pointerdown", (e) => {
			activeTile = tile;
			activePointerId = e.pointerId;
			startX = e.clientX;
			startY = e.clientY;

			longPressTriggered = false;

			pressTimer = setTimeout(() => {
				longPressTriggered = true;
				openRoleOverlay(role.id);
			}, LONG_PRESS_DELAY);
		});
		
		tile.addEventListener("pointermove", (e) => {
			if (!pressTimer) return;

			const dx = Math.abs(e.clientX - startX);
			const dy = Math.abs(e.clientY - startY);

			if (dx > 10 || dy > 10) {
				clearTimeout(pressTimer);
			}
		});

		tile.addEventListener("pointerup", (e) => {
			if (e.pointerId !== activePointerId) return;
			
			clearTimeout(pressTimer);
			
			if (tile !== activeTile) return;

			if (!longPressTriggered) {
				handleRoleClick(role);
			}
			
			activeTile = null;
			activePointerId = null;
		});

		tile.addEventListener("pointerleave", () => {
			clearTimeout(pressTimer);
		});

		tile.addEventListener("pointercancel", () => {
			clearTimeout(pressTimer);
		});

        roleList.appendChild(tile);
    });
}

function buildRoleFilters() {
    const container = document.getElementById("roleFilterContainer");
    if (!container) return;

    container.innerHTML = "";

    TAG_FILTER_GROUPS.forEach(group => {
        // --- Section wrapper ---
		const section = document.createElement("fieldset");
		section.className = "ruleset-group";

		const legend = document.createElement("legend");
		legend.className = "ruleset-group-legend";
		legend.textContent = Loc(group.label);

		section.appendChild(legend);

        // --- Tile container ---
        const tileContainer = document.createElement("div");
        tileContainer.className = "ruleset-group-tiles";

        group.tags.forEach(f => {
            const tile = document.createElement("div");
            tile.className = "ruleset-tile";
            tile.dataset.tag = f.tag;
            tile.dataset.group = group.id;
/*
			const icon = document.createElement("div");
			icon.className = "ruleset-icon"; // styled similarly to role-icon
			tile.prepend(icon);
*/
            const label = document.createElement("div");
            label.className = "ruleset-name";
            label.textContent = Loc(f.label);

            tile.appendChild(label);

            // Set default state
            setRulesetTileState(tile, !!f.default);

            tile.addEventListener("click", () => {
                const isSelected = tile.classList.contains("selected");
                setRulesetTileState(tile, !isSelected);

                applyRoleTileFilter();
            });

            tileContainer.appendChild(tile);
        });

        section.appendChild(tileContainer);
        container.appendChild(section);
    });
}

/* =========================
   Role description assembly
   ========================= */

function getDescriptionTeamText(role) {
    let team = Loc(role.team);
	
    if (team && role.tags?.includes("CAN_CHANGE_ALIGNMENT")) {
        team += Loc("TEAM_VARIABLE_SUFFIX");
    }

    return team;
}

function getDescriptionRolePhase(role) {
	switch (role.phase) {
		case "NIGHT":
			return Loc("ROLE_PHASE_NIGHT");
		case "DAY":
			return Loc("ROLE_PHASE_DAY");
		case "DUSK":
			return Loc("ROLE_PHASE_DUSK");
	}
	
	console.warn("Unknown phase " + role.phase + " for role " + role.id + " when fetching description");
	return "";
}

function getDescriptionWinConditionText(role) {
    const roleKey = `UI_WINCONDITION_${role.id}`;
    if (hasLoc(roleKey)) {
        return Loc(roleKey);
    }

    const teamKey = `UI_WINCONDITION_${role.team}`;
    let base;

    if (hasLoc(teamKey)) {
        base = Loc(teamKey);
    } else {
        console.warn(`Missing team win condition: ${teamKey} (role: ${role.id})`);
        base = "";
    }

    if (role.tags?.includes("CAN_CHANGE_ALIGNMENT")) {
        base += (base ? " " : "") + Loc("UI_WINCONDITION_VARIABLE_NOTE");
    }

    return base;
}

function buildRoleDescriptions() {
    const roleDescriptionList = document.getElementById("roleDescriptionList");

    getSortedRoles().forEach(role => {
		const entry = createRoleDescriptionEntry(role);
		roleDescriptionList.appendChild(entry);
    });
}

function createRoleDescriptionEntry(role) {
    const entry = createRoleRootEl(role, "role-entry", "descriptions");

    const icon = createRoleIcon(role);

    const info = document.createElement("div");
    info.className = "role-info";

    const name = document.createElement("div");
    name.className = "role-description-name";
    name.textContent = Loc(role.nameKey, true);

    const header = document.createElement("div");
    header.className = "role-header";
    header.append(name);

    const phase = document.createElement("div");
    phase.className = "role-phase";
    phase.textContent = getDescriptionRolePhase(role);

    const team = document.createElement("div");
    team.className = "role-team";
    team.textContent = Loc("TEAM_PREFIX") + ": " + getDescriptionTeamText(role);
    if (role.tags?.includes("CAN_CHANGE_ALIGNMENT")) {
        team.classList.add("team-variable");
    }

    const meta = document.createElement("div");
    meta.className = "role-meta";
    meta.append(phase, team);

    const ability = document.createElement("div");
    ability.className = "role-ability";
    ability.textContent = Loc(role.abilityKey);

    const winCondition = document.createElement("div");
    winCondition.className = "win-condition";
    winCondition.textContent = getDescriptionWinConditionText(role);

    const rules = document.createElement("div");
    rules.className = "role-rules";
    rules.append(ability, winCondition);

    info.append(header, meta, rules);
    entry.append(icon, info);

    return entry;
}


/* =========================
   Settings assembly (NEW)
   ========================= */

/**
 * We render the settings tree using 3 visual node types:
 *
 * 1) header nodes: collapsible groups, slightly heavier than rows
 * 2) setting rows (leaf): label + input + metadata
 * 3) setting rows (branch): same as leaf, plus disclosure + children container
 *
 * IMPORTANT:
 * - We do NOT use .panel for settings nodes anymore.
 * - Only the main Settings panel (in index.html) remains a panel.
 */

function refreshSettingsUIFromState() {
    // Number inputs (weight + percent)
    const numInputs = document.querySelectorAll('input[type="number"][data-setting-oid]');
    numInputs.forEach(input => {
        const oid = input.dataset.settingOid;
        const v = getSettingByOid(oid);

        // If v is null/undefined, keep the current input value
        if (v === null || v === undefined) return;

        input.value = String(v);
    });

    // Toggles (checkboxes)
    const checkInputs = document.querySelectorAll('input[type="checkbox"][data-setting-oid]');
    checkInputs.forEach(input => {
        const oid = input.dataset.settingOid;
        const v = getSettingByOid(oid);

        if (v === null || v === undefined) return;

        input.checked = Boolean(v);
    });

    // Update derived UI
    updateSettingsValidationUI();
    updateWeightPercentages();
    updatePrompt();
}

/* -------------------------
   Helpers: element builders
   ------------------------- */

function createSettingRowEl() {
    const row = document.createElement("div");
    row.className = "setting-row2";
    return row;
}

function createSettingLabelEl(text) {
    const label = document.createElement("div");
    label.className = "setting-label2";
    label.textContent = text;
    return label;
}

function createSettingControlEl() {
    const wrap = document.createElement("div");
    wrap.className = "setting-control2";
    return wrap;
}

function createSettingChildrenWrap(depth) {
    const wrap = document.createElement("div");
    wrap.className = "setting-children2";
    wrap.dataset.depth = String(depth);
    return wrap;
}

function createSettingDisclosureButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "setting-disclosure2";
    btn.textContent = "▶";
    btn.setAttribute("aria-label", "Toggle");
    return btn;
}

function createSettingErrorBox() {
    const box = document.createElement("div");
    box.className = "setting-errors";
    box.style.display = "none";
    return box;
}

function setSettingErrors(errorBox, errors) {
    if (!errors || errors.length === 0) {
        errorBox.style.display = "none";
        errorBox.innerHTML = "";
        return;
    }

    errorBox.style.display = "";
    errorBox.innerHTML = "";

    for (const err of errors) {
        const line = document.createElement("div");
        line.className = "setting-error-line";
        line.textContent = Loc(err.messageKey);
        errorBox.appendChild(line);
    }
}

/* -------------------------
   Input creators (unchanged)
   ------------------------- */

function getParentOid(oid) {
    const i = oid.lastIndexOf(".");
    if (i === -1) return "root";
    return oid.slice(0, i);
}

function updateWeightPercentages() {
    const inputs = Array.from(document.querySelectorAll(
        'input[data-weight-group-id][data-setting-oid]'
    ));

    // groupKey -> inputs[]
    const groups = new Map();

    for (const input of inputs) {
        const groupId = input.dataset.weightGroupId;
        const oid = input.dataset.settingOid;

        if (!groupId || !oid) continue;

        const parentOid = getParentOid(oid);
        const key = `${parentOid}::${groupId}`;

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(input);
    }

    for (const groupInputs of groups.values()) {
        let sum = 0;

        for (const input of groupInputs) {
            const v = parseInt(input.value, 10);
            if (Number.isFinite(v) && v > 0) sum += v;
        }

        for (const input of groupInputs) {
            const oid = input.dataset.settingOid;
            const pctEl = document.querySelector(
                `.setting-weight-pct[data-setting-oid="${oid}"]`
            );
            if (!pctEl) continue;

            const v = parseInt(input.value, 10);

            if (!Number.isFinite(v) || v <= 0 || sum <= 0) {
                pctEl.textContent = "0%";
            } else {
                pctEl.textContent = `${Math.round((v / sum) * 1000) / 10}%`;
            }
        }
    }
}

function createWeightPercentLabel(node) {
    const pct = document.createElement("span");
    pct.className = "setting-weight-pct";
    pct.dataset.settingOid = node.oid;
    pct.textContent = "";
    return pct;
}

function createPercentUnitLabel(node) {
    const pct = document.createElement("span");
    pct.className = "setting-percent-unit";
    pct.dataset.settingOid = node.oid;
    pct.textContent = "%";
    return pct;
}

function createPercentInput(node) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.value = String(getSettingByOid(node.oid) ?? node.defaultValue ?? 0);

    input.dataset.settingOid = node.oid;

    input.addEventListener("input", () => {
        let v = parseInt(input.value, 10);
        if (!Number.isFinite(v) || v < 0) v = 0;
        if (v > 100) v = 100;

        input.value = String(v);

        setSettingByOid(node.oid, v);

        updateSettingsValidationUI();
        updatePrompt();
    });

    return input;
}

function createWeightInput(node) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = String(getSettingByOid(node.oid) ?? node.defaultValue ?? 0);

    input.dataset.settingOid = node.oid;
    input.dataset.weightGroupId = String(node.weightGroupId ?? "");

    input.addEventListener("input", () => {
        let v = parseInt(input.value, 10);
        if (!Number.isFinite(v) || v < 0) v = 0;

        input.value = String(v);

        setSettingByOid(node.oid, v);

        updateSettingsValidationUI();
        updateWeightPercentages();
        updatePrompt();
    });

    return input;
}

function createToggleInput(node) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(getSettingByOid(node.oid) ?? node.defaultValue ?? false);
	input.dataset.settingOid = node.oid;

    input.addEventListener("change", () => {
        setSettingByOid(node.oid, input.checked);

        updateSettingsValidationUI();
        updatePrompt();
    });

    return input;
}

/* -------------------------
   Row control assembly
   ------------------------- */

function buildSettingControlForNode(node) {
    const control = document.createElement("div");
    control.className = "setting-control2";

    const meta = document.createElement("span");
    meta.className = "setting-meta2";

    const inputWrap = document.createElement("div");
    inputWrap.className = "setting-input2";

    // LABEL: no control
    if (node.type === "label" || node.type === "separator") {
        meta.textContent = "";
        control.append(meta, inputWrap);
        return control;
    }

    // WEIGHT
	if (node.type === "weight") {
		const pct = createWeightPercentLabel(node);
		pct.classList.add("setting-meta2"); // use the same meta column sizing

		const input = createWeightInput(node);

		const weightWrap = document.createElement("div");
		weightWrap.className = "setting-weight-field2";

		const icon = document.createElement("span");
		icon.className = "setting-weight-icon2";
		icon.textContent = "⚖"; // can be changed later

		weightWrap.append(icon, input);

		control.append(pct, inputWrap);
		inputWrap.appendChild(weightWrap);

		return control;
	}

    // PERCENT
	if (node.type === "percent") {
		meta.textContent = ""; // no prefix

		const input = createPercentInput(node);

		const percentWrap = document.createElement("div");
		percentWrap.className = "setting-percent-field2";
		percentWrap.appendChild(input);

		control.append(meta, inputWrap);
		inputWrap.appendChild(percentWrap);

		return control;
	}

    // TOGGLE
    if (node.type === "toggle") {
        meta.textContent = "";

        const input = createToggleInput(node);

        control.append(meta, inputWrap);
        inputWrap.appendChild(input);

        return control;
    }

    // Unknown type
    meta.textContent = "";
    control.append(meta, inputWrap);
    return control;
}


/* -------------------------
   Render: setting row
   ------------------------- */

function renderSettingRow(node, depth) {
    const hasChildren = Boolean(node.children && node.children.length);
	const isSeparator = node.type === "separator";
	const isLabelOnly = node.type === "label";

    const container = document.createElement("div");
	container.className = isSeparator ? "setting-item2 setting-separator-item2" : "setting-item2";
    container.dataset.settingOid = node.oid;
    container.dataset.depth = String(depth);
    container.dataset.hasChildren = hasChildren ? "true" : "false";

    const row = createSettingRowEl();

	// SEPARATOR: special row layout
	if (isSeparator) {
		const spacer = document.createElement("div");
		spacer.className = "setting-disclosure-spacer2";
		row.appendChild(spacer);

		const line = document.createElement("div");
		line.className = "setting-separator-line2";

		// line spans label+control area
		row.appendChild(line);

	} else {
		// Left: disclosure spacer / button
		if (hasChildren && !isSeparator) {
			const disclosure = createSettingDisclosureButton();
			disclosure.dataset.expanded = "false";
			row.appendChild(disclosure);
		} else {
			const spacer = document.createElement("div");
			spacer.className = "setting-disclosure-spacer2";
			row.appendChild(spacer);
		}

		// Label
		const labelEl = createSettingLabelEl(Loc(node.textKey, true));
		applyTextStyleClasses(labelEl, node);
		row.appendChild(labelEl);

		// Control (empty for label nodes)
		row.appendChild(buildSettingControlForNode(node));
	}

    container.appendChild(row);

    // Error box belongs to the node container
	if (!isSeparator) {
		const errorBox = createSettingErrorBox();
		container.appendChild(errorBox);
	}

    // Children (if any)
    if (hasChildren && !isSeparator) {
        const childrenWrap = createSettingChildrenWrap(depth + 1);
        childrenWrap.style.display = "none"; // collapsed by default
        childrenWrap.dataset.collapsed = "true";

        for (const child of node.children) {
            childrenWrap.appendChild(renderSettingNode(child, depth + 1));
        }

        container.appendChild(childrenWrap);

        // Wire disclosure behavior
        const disclosure = row.querySelector(".setting-disclosure2");
        disclosure.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const collapsed = childrenWrap.dataset.collapsed === "true";
            childrenWrap.dataset.collapsed = collapsed ? "false" : "true";
            childrenWrap.style.display = collapsed ? "" : "none";
            disclosure.textContent = collapsed ? "▼" : "▶";
            disclosure.dataset.expanded = collapsed ? "true" : "false";
        });

        // Optional: clicking row toggles too, but not when interacting with input
        row.addEventListener("click", (e) => {
            if (e.target.closest("input, button, select, textarea, label")) return;
            disclosure.click();
        });
    }

    return container;
}

/* -------------------------
   Render: header group
   ------------------------- */

function renderSettingHeaderGroup(node, depth) {
    const hasChildren = Boolean(node.children && node.children.length);

    const group = document.createElement("div");
    group.className = "setting-group2";
    group.dataset.settingOid = node.oid;
    group.dataset.depth = String(depth);

    const header = document.createElement("div");
    header.className = "setting-group-header2";

    const disclosure = document.createElement("span");
    disclosure.className = "setting-group-toggle2";
    disclosure.textContent = hasChildren ? "▼" : "";

    const title = document.createElement("div");
    title.className = "setting-group-title2";
	title.textContent = Loc(node.textKey, true);
	applyTextStyleClasses(title, node);

    header.append(disclosure, title);
    group.appendChild(header);

    const body = document.createElement("div");
    body.className = "setting-group-body2";

    // Error box for group-level validation (weight group sum = 0 etc.)
    const errorBox = createSettingErrorBox();
    body.appendChild(errorBox);

    if (hasChildren) {
        for (const child of node.children) {
            body.appendChild(renderSettingNode(child, depth + 1));
        }
    }

    group.appendChild(body);

    // Collapse behavior for header groups
    if (hasChildren) {
        header.addEventListener("click", (e) => {
            if (e.target.closest("input, button, select, textarea, label")) return;

            const collapsed = body.style.display === "none";
            body.style.display = collapsed ? "" : "none";
            disclosure.textContent = collapsed ? "▼" : "▶";
        });

		// Default: collapsed
		disclosure.textContent = "▶";
		body.style.display = "none";
    }

    return group;
}

/* -------------------------
   Render: node dispatcher
   ------------------------- */

function renderSettingNode(node, depth = 0) {
    // Header nodes are their own grouping blocks
    if (node.type === "header") {
        return renderSettingHeaderGroup(node, depth);
    }

    // Everything else is a row (leaf or branch)
    return renderSettingRow(node, depth);
}

/* -------------------------
   Render: weight group borders
   ------------------------- */

function updateWeightGroupRowBorders() {
    const inputs = Array.from(document.querySelectorAll(
        'input[data-weight-group-id][data-setting-oid]'
    ));

    // groupKey -> inputs[]
    const groups = new Map();

    for (const input of inputs) {
        const groupId = input.dataset.weightGroupId;
        const oid = input.dataset.settingOid;

        if (!groupId || !oid) continue;

        const parentOid = getParentOid(oid);
        const key = `${parentOid}::${groupId}`;

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(input);
    }

    // Clear old markers
    document.querySelectorAll(".setting-item2").forEach(el => {
        el.classList.remove(
            "wg-box",
            "wg-box-first",
            "wg-box-middle",
            "wg-box-last"
        );
    });

    for (const groupInputs of groups.values()) {
        const items = groupInputs
            .map(input => input.closest(".setting-item2"))
            .filter(Boolean);

        // unique
        const unique = [];
        const seen = new Set();
        for (const item of items) {
            if (seen.has(item)) continue;
            seen.add(item);
            unique.push(item);
        }

        // If only 1 item, no point boxing it
        if (unique.length <= 1) continue;

        // Mark
        for (const item of unique) item.classList.add("wg-box");

        unique[0].classList.add("wg-box-first");
        unique[unique.length - 1].classList.add("wg-box-last");

        for (let i = 1; i < unique.length - 1; i++) {
            unique[i].classList.add("wg-box-middle");
        }
    }
}


/* -------------------------
   Build UI
   ------------------------- */

function buildSettingsUI() {
    const settingsList = document.getElementById("settings-list");
    if (!settingsList) return;

    settingsList.innerHTML = "";

    // Root nodes in SETTINGS_TREE
    for (const rootNode of SETTINGS_TREE) {
        settingsList.appendChild(renderSettingNode(rootNode, 0));
    }

    // Ensure UI state is correct
    updateSettingsValidationUI();
    updateWeightPercentages();
	updateWeightGroupRowBorders();
}

/* -------------------------
   Validation UI hookup
   ------------------------- */

function updateSettingsValidationUI() {
    const errors = validateSettings();

    // Group by oid
    const byOid = new Map();
    for (const err of errors) {
        if (!byOid.has(err.oid)) byOid.set(err.oid, []);
        byOid.get(err.oid).push(err);
    }

    // Clear all error boxes
    document.querySelectorAll(".setting-item2, .setting-group2").forEach(container => {
        const box = container.querySelector(":scope > .setting-errors") ||
                    container.querySelector(".setting-group-body2 > .setting-errors");
        if (box) setSettingErrors(box, []);
    });

    // Apply errors
    for (const [oid, errs] of byOid.entries()) {
        const container =
            document.querySelector(`.setting-item2[data-setting-oid="${oid}"]`) ||
            document.querySelector(`.setting-group2[data-setting-oid="${oid}"]`);

        if (!container) continue;

        // setting rows: direct child
        let box = container.querySelector(":scope > .setting-errors");

        // header groups: error box is inside body
        if (!box) box = container.querySelector(".setting-group-body2 > .setting-errors");

        if (box) setSettingErrors(box, errs);
    }

    updateWeightPercentages();
}





/* =========================
   Panel collapse behavior
   ========================= */

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

/* =========================
   Responsive scaling
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

function updateRoleScale() {
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
        .setProperty("--tile-scale", select_scale.toFixed(3));

    document.documentElement.style
        .setProperty("--description-tile-scale", description_scale.toFixed(3));
		
	const debugEl = document.getElementById("scaleDebugValue");
	if (debugEl) {
		debugEl.textContent = `${select_scale.toFixed(3)} / ${description_scale.toFixed(3)} | ${Math.round(width)}×${Math.round(height)}`;
	}
}

/* =========================
   Search role function
   ========================= */

function filterRoles(query, containerId) {
    const q = query.trim().toLowerCase();

    const container = document.getElementById(containerId);
    if (!container) return;

    container
        .querySelectorAll("[data-role-name]")
        .forEach(el => {
            el.classList.toggle(
                "role-hidden",
                !el.dataset.roleName.includes(q)
            );
        });
		
	applySelectionFilter();
	applyRoleTileFilter();
}

/* =========================
   Role selection filter (only show selected tags)
   ========================= */
   
function applyRoleTileFilter() {
    const search = document
        .getElementById("roleSelectionSearchField")
        .value
        .toLowerCase()
        .trim();

    const groupedFilters = getSelectedTagFilters();

    document.querySelectorAll(".role-tile").forEach(tile => {
        const roleId = tile.dataset.roleId;
        const role = ROLES[roleId];

        const isSelected = (roleCounts.get(roleId) ?? 0) > 0;

        const matchesSearch =
            !search || tile.dataset.roleName.includes(search);

        const matchesTag =
            roleMatchesAllFilterGroups(role, groupedFilters);

        if (search) {
            // Strict search mode (no selection override)
            tile.classList.toggle("role-filtered-out", !matchesSearch);
            tile.classList.remove("role-hidden");
        } else {
            // Selection overrides tag filtering
            const visible = matchesTag || isSelected;

            tile.classList.toggle("role-hidden", !visible);
            tile.classList.remove("role-filtered-out");
        }
    });
}

/* =========================
   Role description selection filter (only show selected roles)
   ========================= */
   
function applySelectionFilter() {
    const input = document.getElementById("roleDescriptionSearchField");
    const query = input.value.trim();

    // If search is active → do nothing (search has priority)
    if (query.length > 0) {
        document.querySelectorAll("#roleDescriptionList [data-role-id]")
            .forEach(el => el.classList.remove("role-filtered-out"));
        return;
    }

    // Check if any roles are selected
    let hasSelection = false;
    for (const count of roleCounts.values()) {
        if (count > 0) {
            hasSelection = true;
            break;
        }
    }

    const entries = document.querySelectorAll("#roleDescriptionList [data-role-id]");

    entries.forEach(el => {
        const roleId = el.dataset.roleId;

        const visible = !hasSelection || (roleCounts.get(roleId) ?? 0) > 0;

        el.classList.toggle("role-filtered-out", !visible);
    });
}

/* =========================
   Print buttons
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

function printRules() {
    const toHide = document.querySelectorAll(
        "h1, .role-search, .panel-header, .panel:not(.panel-rules)"
    );
    printWithHiddenElements([...toHide]);
}

function printRoleDescriptions() {
    const toHide = document.querySelectorAll(
        "h1, .role-search, .panel-header, .panel:not(.panel-role-descriptions)"
    );
    printWithHiddenElements([...toHide]);
}

/* =========================
   Init
   ========================= */

function initGUI() {
	const lang = loadLanguage()
	setLocalizationLanguage(lang);
	const selector = document.getElementById("languageSelector").value = lang;
	
	localizeStaticContent();
	buildRoleSelection();
	loadRolesFromStorage();
	buildRoleFilters();
	buildRoleDescriptions();
	buildSettingsUI();
	initPanels();
	
	updateRoleScale();
	
	window.addEventListener("resize", onWindowResize);
	window.visualViewport?.addEventListener("resize", onWindowResize);
	
	document.getElementById("btn-reset-settings")?.addEventListener("click", onSettingsReset);
	document.getElementById("btn-reset-roles")?.addEventListener("click", onSelectedRolesReset);
	document.querySelectorAll(".role-filter input").forEach(cb => { cb.addEventListener("change", applyRoleTileFilter); });	
	document.getElementById("roleOverlayClose").addEventListener("click", closeRoleOverlay);
	document.querySelector(".role-overlay-backdrop").addEventListener("click", closeRoleOverlay);
	document.getElementById("languageSelector").addEventListener("change", (e) => { setLanguage(e.target.value); });
	
	updatePlayerCountDisplay();
	
	updateRolesUI();
}

initGUI();
