/*
 * Central settings manager.
 *
 * Defines the complete settings hierarchy, stores current values,
 * performs validation, persists settings to localStorage, and exposes
 * helper functions used by both the settings UI and prompt generation.
 *
 * Settings are defined declaratively as a tree. Runtime lookup tables
 * and OIDs are generated automatically during initialization.
 *
 * Object ID (OID) is used to uniquely identify a node within the
 * settings tree, and is used for getting and setting values.
 */

const Settings = (() => {
	
	/* =========================
	   Data
	   ========================= */
	   
	const SETTINGS_STORE = "onuw_settings";
	
	//Current settings, mapping all OIDs to a value
	const OID_TO_VALUE = {};
	
	//The type expected for each OID for quick lookup and validation
	const OID_TO_TYPE = {};
	
	/*
	 * Definition of each supported input type.
	 *
	 * Every input type specifies:
	 *   - validation
	 *   - default value generation
	 *   - localization key for validation errors
	 *
	 * This allows the settings tree itself to remain purely declarative.
	 */
	const SETTINGS_TYPES = {
		weight: {
			validator: (value) => { return (Number.isInteger(value) && value >= 0); },
			errorMsgKey: "UI_SETTING_ERROR_WEIGHT_NOT_NONNEG_INT",
			defaultValue: (node) => { return node.defaultValue ?? 0; },
		},
		percent: {
			validator: (value) => { return (Number.isInteger(value) && value >= 0 && value <= 100); },
			errorMsgKey: "UI_SETTING_ERROR_WEIGHT_NOT_PERCENT",
			defaultValue: (node) => { return node.defaultValue ?? 0; },
		},
		toggle: {
			validator: (value) => { return (typeof value === "boolean"); },
			errorMsgKey: "UI_SETTING_ERROR_TOGGLE_NOT_BOOL",
			defaultValue: (node) => { return node.defaultValue ?? false; },
		},
	};
	
	/*
	 * Optional validation predicates that depend on the currently selected roles.
	 *
	 * Some settings are only meaningful when certain game configurations
	 * are present. These predicates determine whether a setting should
	 * participate in validation.
	 */
	const CONTEXT_REQUIREMENTS = {
		evilTeamPresent: (context) => {
			if (!context?.selectedRoles) return true; // no context supplied — fail open, see below
			return [...context.selectedRoles.keys()].some(id =>
				Roles.isTeam(id, "TEAM_WEREWOLF") || Roles.isTeam(id, "TEAM_VAMPIRE") || Roles.isTeam(id, "TEAM_ALIEN")
			);
		},
	};

	/*
		Declarative description of the settings UI.
		The same hierarchy drives:
			- GUI generation
			- default value generation
			- validation
			- persistence
		Settings tree, defines the available settings and their hierarchy for use in the GUI construction. Each node represents a row in the GUI, and contains attributes as below
		 * type:
		 * - header: visual grouping panel, no value
		 * - weight: integer >= 0, used for weighted choice pools
		 * - percent: integer [0,100]
		 * - toggle: boolean (future)
		 * - label: simple text node (supports children)
		 * - separator: vertical line
		 * id: string, must be unique per hierarchy
		 * textKey: string, localized key
		 * textStyle: string array containing font styles to apply to a label element
		 * - "bold" | "italic" | "underline" | "muted" | "none"
		 * weightGroupId: ID for weight group, validation demands sum > 0. Must be unique per sibling group
		 * requiresContext: (optional) key into CONTEXT_REQUIREMENTS - if present, this node's weight only counts toward its weight group's sum when the check passes
		 * contextErrorMsg: (optional) localization key used as error message if requiresContext validation fails
		 * defaultValue: default value of the input control
	 */
	const SETTINGS_TREE = [
		{
			type: "header",
			id: "ripple",
			textKey: "UI_SETTING_RIPPLE",
			affectedRoles: [ "TEAM_ALIEN", "SYNTHETICALIEN" ],
			children: [
				{
					type: "weight",
					id: "one_minute",
					textKey: "UI_SETTING_RIPPLE_ONE_MINUTE",
					weightGroupId: 1,
					defaultValue: 10,
				},
				{
					type: "weight",
					id: "insomniac",
					textKey: "UI_SETTING_RIPPLE_INSOMNIAC",
					weightGroupId: 1,
					defaultValue: 10,
				},
				{
					type: "weight",
					id: "muted",
					textKey: "UI_SETTING_RIPPLE_MUTED",
					weightGroupId: 1,
					defaultValue: 10
				},
				{
					type: "weight",
					id: "rebuked",
					textKey: "UI_SETTING_RIPPLE_REBUKED",
					weightGroupId: 1,
					defaultValue: 0
				},
				{
					type: "weight",
					id: "troublemaker",
					textKey: "UI_SETTING_RIPPLE_TROUBLEMAKER",
					weightGroupId: 1,
					defaultValue: 10
				},
				{
					type: "weight",
					id: "robber",
					textKey: "UI_SETTING_RIPPLE_ROBBER",
					weightGroupId: 1,
					defaultValue: 10
				},
				{
					type: "weight",
					id: "witch",
					textKey: "UI_SETTING_RIPPLE_WITCH",
					weightGroupId: 1,
					defaultValue: 10
				},
				{
					type: "weight",
					id: "revealer",
					textKey: "UI_SETTING_RIPPLE_REVEALER",
					weightGroupId: 1,
					defaultValue: 10
				},
				{
					type: "weight",
					id: "drunk",
					textKey: "UI_SETTING_RIPPLE_DRUNK",
					weightGroupId: 1,
					defaultValue: 10
				},
				{
					type: "weight",
					id: "view_player",
					textKey: "UI_SETTING_RIPPLE_VIEW_PLAYER",
					weightGroupId: 1,
					defaultValue: 10
				},
				{
					type: "weight",
					id: "dual_view_player",
					textKey: "UI_SETTING_RIPPLE_DUAL_VIEW_PLAYER",
					weightGroupId: 1,
					defaultValue: 10
				},
				{
					type: "weight",
					id: "double_vote",
					textKey: "UI_SETTING_RIPPLE_DOUBLE_VOTE",
					weightGroupId: 1,
					defaultValue: 10
				},
				{
					type: "weight",
					id: "none",
					textKey: "UI_SETTING_RIPPLE_NONE",
					weightGroupId: 1,
					defaultValue: 40
				},
			]
		},
		{
			type: "header",
			id: "alien",
			textKey: "TEAM_ALIEN_PLURAL",
			affectedRoles: [ "TEAM_ALIEN", "SYNTHETICALIEN" ],
			children: [
				{
					type: "weight",
					id: "view_card_individual",
					textKey: "UI_SETTING_ALIENS_VIEW_CARD_INDIVIDUAL",
					weightGroupId: 1,
					defaultValue: 30,
					children: [
						{
							type: "weight",
							id: "center",
							textKey: "UI_SETTING_VIEW_CARD_CENTER_ONE",
							weightGroupId: 1,
							defaultValue: 10,
						},
						{
							type: "weight",
							id: "even",
							textKey: "UI_SETTING_VIEW_CARD_PLAYER_EVEN",
							weightGroupId: 1,
							defaultValue: 10,
						},
						{
							type: "weight",
							id: "odd",
							textKey: "UI_SETTING_VIEW_CARD_PLAYER_ODD",
							weightGroupId: 1,
							defaultValue: 10,
						},
						{
							type: "weight",
							id: "neighbor",
							textKey: "UI_SETTING_VIEW_CARD_PLAYER_NEIGHBOR",
							weightGroupId: 1,
							defaultValue: 10,
						},
					]
				},
				{
					type: "weight",
					id: "view_card_collective",
					textKey: "UI_SETTING_ALIENS_VIEW_CARD_COLLECTIVE",
					weightGroupId: 1,
					defaultValue: 30,
					children: [
						{
							type: "weight",
							id: "center",
							textKey: "UI_SETTING_VIEW_CARD_CENTER_ONE",
							weightGroupId: 1,
							defaultValue: 10,
						},
						{
							type: "weight",
							id: "even",
							textKey: "UI_SETTING_VIEW_CARD_PLAYER_EVEN",
							weightGroupId: 1,
							defaultValue: 10,
						},
						{
							type: "weight",
							id: "odd",
							textKey: "UI_SETTING_VIEW_CARD_PLAYER_ODD",
							weightGroupId: 1,
							defaultValue: 10,
						},
						{
							type: "weight",
							id: "specific",
							textKey: "UI_SETTING_VIEW_CARD_PLAYER_SPECIFIC",
							weightGroupId: 1,
							defaultValue: 10,
						},
					]
				},
				{
					type: "weight",
					id: "nothing",
					textKey: "UI_SETTING_ALIENS_NOTHING",
					weightGroupId: 1,
					defaultValue: 15
				},
				{
					type: "weight",
					id: "trade_cards",
					textKey: "UI_SETTING_ALIENS_TRADE_CARDS",
					weightGroupId: 1,
					defaultValue: 15
				},
				{
					type: "weight",
					id: "show_cards",
					textKey: "UI_SETTING_ALIENS_SHOW_CARDS",
					weightGroupId: 1,
					defaultValue: 10
				},
				{
					type: "weight",
					id: "make_alien",
					textKey: "UI_SETTING_ALIENS_MAKE_ALIEN",
					weightGroupId: 1,
					defaultValue: 0
				},
				{
					type: "weight",
					id: "make_minion",
					textKey: "UI_SETTING_ALIENS_MAKE_MINION",
					weightGroupId: 1,
					defaultValue: 0
				}
			]
		},
		{
			type: "header",
			id: "bodysnatcher",
			textKey: "ROLE_BODYSNATCHER",
			affectedRoles: [ "BODYSNATCHER" ],
			children: [
				{
					type: "weight",
					id: "center",
					textKey: "UI_SETTING_VIEW_CARD_CENTER_ONE",
					weightGroupId: 1,
					defaultValue: 20,
				},
				{
					type: "weight",
					id: "neighbor",
					textKey: "UI_SETTING_VIEW_CARD_PLAYER_NEIGHBOR",
					weightGroupId: 1,
					defaultValue: 20,
				},
				{
					type: "weight",
					id: "odd",
					textKey: "UI_SETTING_VIEW_CARD_PLAYER_ODD",
					weightGroupId: 1,
					defaultValue: 20
				},
				{
					type: "weight",
					id: "even",
					textKey: "UI_SETTING_VIEW_CARD_PLAYER_EVEN",
					weightGroupId: 1,
					defaultValue: 20
				},
				{
					type: "weight",
					id: "specific",
					textKey: "UI_SETTING_VIEW_CARD_PLAYER_SPECIFIC",
					weightGroupId: 1,
					defaultValue: 20
				},
				{
					type: "percent",
					id: "fake",
					textKey: "UI_SETTING_BODYSNATCHER_FAKE_ACTION",
					defaultValue: 0
				}
			]
		},
		{
			type: "header",
			id: "mortician",
			textKey: "ROLE_MORTICIAN",
			affectedRoles: [ "MORTICIAN" ],
			children: [
				{
					type: "label",
					id: "mortician_label",
					textKey: "UI_SETTING_LABEL_VIEW_CARD",
					textStyle: ["italic", "muted"]
				},
				{
					type: "weight",
					id: "neighbor",
					textKey: "UI_SETTING_VIEW_CARD_PLAYER_NEIGHBOR",
					weightGroupId: 1,
					defaultValue: 2,
				},
				{
					type: "weight",
					id: "both",
					textKey: "UI_SETTING_VIEW_CARD_PLAYER_NEIGHBOR_BOTH",
					weightGroupId: 1,
					defaultValue: 1
				},
				{
					type: "weight",
					id: "self",
					textKey: "UI_SETTING_VIEW_CARD_PLAYER_SELF",
					weightGroupId: 1,
					defaultValue: 1
				}
			]
		},
		{
			type: "header",
			id: "exposer",
			textKey: "ROLE_EXPOSER",
			affectedRoles: [ "EXPOSER" ],
			children: [
				{
					type: "weight",
					id: "flip_one",
					textKey: "UI_SETTING_EXPOSER_FLIP_ONE",
					weightGroupId: 1,
					defaultValue: 100,
				},
				{
					type: "weight",
					id: "flip_two",
					textKey: "UI_SETTING_EXPOSER_FLIP_TWO",
					weightGroupId: 1,
					defaultValue: 20
				},
				{
					type: "weight",
					id: "flip_three",
					textKey: "UI_SETTING_EXPOSER_FLIP_THREE",
					weightGroupId: 1,
					defaultValue: 0
				}
			]
		},
		{
			type: "header",
			id: "rascal",
			textKey: "ROLE_RASCAL",
			affectedRoles: [ "RASCAL" ],
			children: [
				{
					type: "label",
					id: "rascal_label",
					textKey: "UI_SETTING_LABEL_RASCAL",
					textStyle: ["italic", "muted"]
				},
				{
					type: "weight",
					id: "troublemaker",
					textKey: "ROLE_TROUBLEMAKER",
					weightGroupId: 1,
					defaultValue: 20,
				},
				{
					type: "weight",
					id: "robber",
					textKey: "ROLE_ROBBER",
					weightGroupId: 1,
					defaultValue: 20
				},
				{
					type: "weight",
					id: "witch",
					textKey: "ROLE_WITCH",
					weightGroupId: 1,
					defaultValue: 20
				},
				{
					type: "weight",
					id: "villageidiot",
					textKey: "ROLE_VILLAGEIDIOT",
					weightGroupId: 1,
					defaultValue: 0
				},
				{
					type: "weight",
					id: "drunk",
					textKey: "ROLE_DRUNK",
					weightGroupId: 1,
					defaultValue: 0
				},
			]
		},
		{
			type: "header",
			id: "psychic",
			textKey: "ROLE_PSYCHIC",
			affectedRoles: [ "PSYCHIC" ],
			children: [
				{
					type: "percent",
					id: "double_cards",
					textKey: "UI_SETTING_PSYCHIC_VIEW_TWO_CARDS",
					defaultValue: 0
				},
				{
					type: "label",
					id: "psychic_label",
					textKey: "UI_SETTING_LABEL_VIEW_CARD",
					textStyle: ["italic", "muted"]
				},
				{
					type: "weight",
					id: "neighbor",
					textKey: "UI_SETTING_VIEW_CARD_PLAYER_NEIGHBOR",
					weightGroupId: 1,
					defaultValue: 25,
				},
				{
					type: "weight",
					id: "odd",
					textKey: "UI_SETTING_VIEW_CARD_PLAYER_ODD",
					weightGroupId: 1,
					defaultValue: 25
				},
				{
					type: "weight",
					id: "even",
					textKey: "UI_SETTING_VIEW_CARD_PLAYER_EVEN",
					weightGroupId: 1,
					defaultValue: 25
				},
				{
					type: "weight",
					id: "specific",
					textKey: "UI_SETTING_VIEW_CARD_PLAYER_SPECIFIC",
					weightGroupId: 1,
					defaultValue: 25
				},
			]
		},
		{
			type: "header",
			id: "oracle",
			textKey: "ROLE_ORACLE",
			affectedRoles: [ "ORACLE" ],
			children: [
/*
				{
					type: "header",
					id: "oracle_test",
					textKey: "oracle_test",
					children: [
						{
							type: "percent",
							id: "oracle_test_1",
							textKey: "oracle_test_1",
							defaultValue: 25
						},
						{
							type: "separator",
							id: "oracle_test_sep",
						},
						{
							type: "label",
							id: "oracle_test_label",
							textKey: "oracle_test_label",
							textStyle: ["italic", "muted"]
						},
						{
							type: "percent",
							id: "oracle_test_2",
							textKey: "oracle_test_2",
							textStyle: ["bold"],
							defaultValue: 50
						},
						{
							type: "toggle",
							id: "oracle_test_3",
							textKey: "oracle_test_3",
							textStyle: ["underline"],
							defaultValue: false,
						},
					],
				},
*/
				{
					type: "weight",
					id: "change_team",
					textKey: "UI_SETTING_ORACLE_SWITCH_TEAM",
					weightGroupId: 1,
					defaultValue: 45,
					requiresContext: "evilTeamPresent",
					contextErrorMsg: "UI_SETTING_ERROR_WEIGHTGROUP_ORACLE_TEAM",
					children: [
						{
							type: "percent",
							id: "chance",
							textKey: "UI_SETTING_ORACLE_SWITCH_TEAM_MODE",
							defaultValue: 50
						},
					],
				},
				{
					type: "weight",
					id: "view_center",
					textKey: "UI_SETTING_ORACLE_VIEW_CENTER",
					weightGroupId: 1,
					defaultValue: 10,
					children: [
						{
							type: "weight",
							id: "one",
							textKey: "UI_SETTING_VIEW_CARD_CENTER_ONE",
							weightGroupId: 1,
							defaultValue: 3
						},
						{
							type: "weight",
							id: "two",
							textKey: "UI_SETTING_VIEW_CARD_CENTER_TWO",
							weightGroupId: 1,
							defaultValue: 2
						},
						{
							type: "weight",
							id: "three",
							textKey: "UI_SETTING_VIEW_CARD_CENTER_THREE",
							weightGroupId: 1,
							defaultValue: 1
						},
					],
				},
				{
					type: "weight",
					id: "view_player",
					textKey: "UI_SETTING_ORACLE_VIEW_PLAYER",
					weightGroupId: 1,
					defaultValue: 10,
					children: [
						{
							type: "weight",
							id: "even",
							textKey: "UI_SETTING_VIEW_CARD_PLAYER_EVEN",
							weightGroupId: 1,
							defaultValue: 3
						},
						{
							type: "weight",
							id: "odd",
							textKey: "UI_SETTING_VIEW_CARD_PLAYER_ODD",
							weightGroupId: 1,
							defaultValue: 3
						},
						{
							type: "weight",
							id: "any",
							textKey: "UI_SETTING_VIEW_CARD_PLAYER_ANY",
							weightGroupId: 1,
							defaultValue: 1
						},
						{
							type: "weight",
							id: "specific",
							textKey: "UI_SETTING_VIEW_CARD_PLAYER_SPECIFIC",
							weightGroupId: 1,
							defaultValue: 1
						},
					],
				},
				{
					type: "weight",
					id: "hunt",
					textKey: "UI_SETTING_ORACLE_HUNT",
					weightGroupId: 1,
					defaultValue: 10,
					children: [
						{
							type: "percent",
							id: "chance",
							textKey: "UI_SETTING_ORACLE_HUNT_CHANCE",
							defaultValue: 90
						},
						{
							type: "toggle",
							id: "allow_bad_teams",
							textKey: "UI_SETTING_ORACLE_HUNT_ALLOW_BAD_TEAMS",
							defaultValue: false
						},
					],
				},
				{
					type: "weight",
					id: "block_action",
					textKey: "UI_SETTING_ORACLE_BLOCK_ACTION",
					weightGroupId: 1,
					defaultValue: 10,
				},
				{
					type: "weight",
					id: "drunk",
					textKey: "UI_SETTING_ORACLE_DRUNK",
					weightGroupId: 1,
					defaultValue: 10,
				},
				{
					type: "weight",
					id: "even_odd",
					textKey: "UI_SETTING_ORACLE_EVEN_ODD",
					weightGroupId: 1,
					defaultValue: 10,
				},
			]
		}
	];



	/* =========================
	   Initialization
	   ========================= */

	function _init() {
		_normalizeTree();
		_resetToDefault();
		_load();
		_deepFreeze(SETTINGS_TREE);
	}
	
	/*
	 * Assigns a unique Object ID (OID) to every node by concatenating the
	 * hierarchy of IDs (e.g. "oracle.view_player.odd").
	 *
	 * OIDs are used for lookup, persistence and validation instead of
	 * storing direct references to tree nodes.
	 * Also defines the type of value expected in each OID for validation
	 */
	function _normalizeTree(tree = SETTINGS_TREE, parentOid = "") {
		for (const node of tree) {
			const oid = _makeOid(parentOid, node.id);
			node.oid = oid;
			
			if (node.children && node.children.length) {
				_normalizeTree(node.children, oid);
			}
			
			if (_isInputType(node))
				OID_TO_TYPE[oid] = node.type;
		}
	}

	//Locks the settings tree as immutable
	function _deepFreeze(obj) {
		Object.freeze(obj);

		for (const value of Object.values(obj)) {
			if (value && typeof value === "object" && !Object.isFrozen(value)) {
				_deepFreeze(value);
			}
		}
	}

	/* =========================
	   Private functions
	   ========================= */

	function _load() {
		const raw = localStorage.getItem(SETTINGS_STORE);
		if (!raw) return;

		try {
			const saved = JSON.parse(raw);

			console.group("Loaded settings (diff from defaults)");

			for (const [oid, value] of Object.entries(saved)) {
				if (!(oid in OID_TO_VALUE)) continue;

				const before = OID_TO_VALUE[oid];

				if (before !== value) {
					console.log(`${oid}: ${before} → ${value}`);
				}
				
				try {
					_setValue(oid, value, false);
				} catch {
					console.warn(`Skipping invalid stored value for ${oid}`);
				}
			}

			console.groupEnd();
		} catch {
			console.warn("Failed to parse stored settings");
		}
	}
	
	function _save() {
		localStorage.setItem(SETTINGS_STORE, JSON.stringify(OID_TO_VALUE) );
	}
	
	//Resets current settings values to default
	function _resetToDefault() {
		const defaults = _getDefaultSettings();
		
		for (const [oid, value] of Object.entries(defaults)) {
			_setValue(oid, value, false);
		}
	}
	
	function _getDefaultSettings() {
		const values = {};

		function walk(nodes) {
			for (const node of nodes) {
				if (SETTINGS_TYPES[node.type])
					values[node.oid] = SETTINGS_TYPES[node.type].defaultValue(node);
				
				if (node.children && node.children.length)
					walk(node.children);
			}
		}

		walk(SETTINGS_TREE);
		
		return values;
	}
	
	function _makeOid(...parts) {
		return parts.filter(Boolean).join(".");
	}
	
	function _isInputType(node) {
		return node.type in SETTINGS_TYPES;
	}
	
	//Centralized write path used by all callers to guarantee validation before a value is stored.
	function _setValue(oid, value, save = true) {
		const type = OID_TO_TYPE[oid];
		
		if (!type)
			throw new Error(`Unknown setting OID to set: ${oid}`);
		
		if (!SETTINGS_TYPES[type].validator(value))
			throw new Error(`Invalid value ${value} of type ${type} to set: ${oid}`);
		
		OID_TO_VALUE[oid] = value;
		
		if (save)
			_save();
	}
	
	/*
	 * Validation walks the entire settings tree and produces a list of
	 * structured error objects rather than stopping at the first error.
	 *
	 * This allows the UI to display every invalid setting simultaneously.
	 *
	 * Validation is intentionally independent of the currently selected
	 * roles. Relevant errors are filtered afterwards so the UI only reports
	 * problems that affect the current game configuration.
	 *
	 * Recursively validates a single node and its subtree, pushing any
	 * problems found onto the shared `errors` array rather than returning
	 * or throwing — this is what lets validate() report every invalid
	 * setting across the whole tree in one pass instead of stopping at the
	 * first failure.
	 *
	 * `affectedRoles` is inherited from the nearest ancestor that declares
	 * it (typically a header node) unless a node overrides it, so leaf
	 * settings don't need to repeat which roles make them relevant.
	 * `hierarchy` accumulates textKeys on the way down purely so an error
	 * can report a human-readable breadcrumb of where it occurred.
	 */
	function _validateNode(node, errors, hierarchy = [], context = {}, inheritedAffectedRoles) {
		const affectedRoles = node.affectedRoles ?? inheritedAffectedRoles;
		const v = OID_TO_VALUE[node.oid];
		const lookup = SETTINGS_TYPES[node.type];
		const invalid = lookup && !lookup.validator(v);
		const newHierarchy = [ ...hierarchy, node.textKey ];
		
		if (invalid)
			errors.push({ oid: node.oid, errorType: "value", optionKey: newHierarchy, messageKey: lookup.errorMsgKey, affectedRoles: affectedRoles });
		
		// Child/group validation
		if (hasChildren(node)) {
			_validateWeightGroupsAmongChildren(node, errors, newHierarchy, context, affectedRoles);
			for (const child of getChildren(node))
				_validateNode(child, errors, newHierarchy, context, affectedRoles);
		}
	}
	
	/*
	 * Weighted-choice pools (e.g. "what does the Alien do") only make sense
	 * if at least one option in the group has a non-zero weight, or the
	 * random pick in rules.js has nothing to select and throws. This groups
	 * sibling children by weightGroupId and sums their values, but a child
	 * whose `requiresContext` check fails (e.g. a setting only meaningful
	 * when an evil team is in play) contributes 0 to the sum regardless of
	 * its configured value — so a weight group can appear to satisfy
	 * "sum > 0" in the settings UI generally, yet still be reported as
	 * invalid for the *current* role selection if the only non-zero entries
	 * are contextually unavailable right now.
	 *
	 * When a group's sum is zero, the error message differentiates between
	 * "you set everything to zero yourself" vs. "the only non-zero entry was
	 * excluded by context" (using that excluded child's own
	 * contextErrorMsg if it defines one), so the UI can explain *why* a
	 * group is failing rather than just that it is.
	 */
	function _validateWeightGroupsAmongChildren(node, errors, hierarchy, context, inheritedAffectedRoles) {
		const affectedRoles = node.affectedRoles ?? inheritedAffectedRoles;
		const groupSums = new Map();
		const excludingChild = new Map(); // gid -> true if any child was excluded by context

		for (const child of getChildren(node)) {
			const gid = child.weightGroupId;
			if (gid == null) continue;	//Skip because it's either not a weight group or it is malformed

			const available = _isContextuallyAvailable(child, context);
			if (!available)
				excludingChild.set(gid, child);

			const sum = groupSums.get(gid) ?? 0;
			groupSums.set(gid, sum + (available ? getValue(child.oid) : 0));
		}

		for (const [gid, sum] of groupSums.entries()) {
			if (sum <= 0) {
				const excluder = excludingChild.get(gid);
				errors.push({
					oid: node.oid,
					errorType: "weightGroupSum",
					optionKey: [...hierarchy],
					messageKey: excluder?.contextErrorMsg ?? (excluder
						? "UI_SETTING_ERROR_WEIGHTGROUP_SUM_ZERO_CONTEXT"
						: "UI_SETTING_ERROR_WEIGHTGROUP_SUM_ZERO"),
					data: { weightGroupId: gid },
					affectedRoles: affectedRoles,
				});
			}
		}
	}
	
	function _isContextuallyAvailable(node, context) {
		if (!node.requiresContext) return true;

		const check = CONTEXT_REQUIREMENTS[node.requiresContext];
		if (!check) {
			console.warn(`Unknown requiresContext key '${node.requiresContext}' on node ${node.oid}`);
			return true; // typo'd key shouldn't manufacture a false-positive error
		}
		return check(context);
	}
	
	function _roleMatchesAffected(roleId, entry) {
		return roleId === entry || Roles.isTeam(roleId, entry);
	}
	
	function _isErrorRelevant(error, selectedRoles) {
		if (!error.affectedRoles) return true; // global setting — always relevant
		return [...selectedRoles.keys()].some(roleId =>
			error.affectedRoles.some(entry => _roleMatchesAffected(roleId, entry))
		);
	}
	
	
	/* =========================
	   Public functions
	   ========================= */

	function getRootNodes() {
		return SETTINGS_TREE;
	}
	
	function getChildren(node) {
		return node.children ?? [];
	}
	
	function hasChildren(node) {
		return (node.children?.length ?? 0) > 0;
	}
	
	function getValue(oid) {
		if (!(oid in OID_TO_VALUE)) {
			throw new Error(`Unknown setting OID to get: ${oid}`);
		}
		
		return OID_TO_VALUE[oid];
	}
	
	function setValue(oid, value) {
		_setValue(oid, value);
	}
	
	function reset() {
		_resetToDefault();
		_save();
	}
	
	function getAllValues() {
		//Return a shallow copy so it can't be externally mutated
		return { ...OID_TO_VALUE };
	}

	//validate returns every configuration error.
	function validate(context = {}) {
		const errors = [];
		
		for (const root of SETTINGS_TREE)
			_validateNode(root, errors, [], context);

		return errors;
	}
	
	function filterRelevant(errors, selectedRoles) {
		return errors.filter(error => _isErrorRelevant(error, selectedRoles));
	}
	
	/*
	 * validate() deliberately ignores which roles are selected, so its
	 * results are stable regardless of the current game setup — useful for
	 * a "reset to sane defaults" check. validateRelevant() layers the
	 * role-awareness on top by filtering those same errors down to the ones
	 * whose `affectedRoles` intersects the roles actually in play, which is
	 * what the in-game UI should show (no point warning about Vampire
	 * settings when no Vampire role is selected).
	 */
	function validateRelevant(context) {
		return filterRelevant(validate(context), context.selectedRoles ?? new Map());
	}
	
	function getNodeTextStyles(node) {
		const styles = node.textStyle;
		
		if (Array.isArray(styles))
			return styles;
		else if (typeof styles === "string")
			return [ styles ];
		
		return [];
	}


	//Initialization
	_init();

	return {
		getRootNodes,
		getChildren,
		hasChildren,
		getValue,
		setValue,
		reset,
		getAllValues,
		validate,
		filterRelevant,
		validateRelevant,
		getNodeTextStyles,
	};
	
})();
