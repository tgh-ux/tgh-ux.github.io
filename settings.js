/*
 * Central settings manager.
 *
 * Defines the complete settings hierarchy, stores current values, performs validation, persists settings to localStorage, and exposes
 * helper functions used by both the settings UI and prompt generation.
 *
 * Settings are defined declaratively as a tree. Runtime lookup tables and OIDs are generated automatically during initialization.
 *
 * Object ID (OID) is used to uniquely identify a node within the settings tree, and is used for getting and setting values.
 */

const Settings = (() => {
	
	/* =========================
	   Data
	   ========================= */
	   
	const SETTINGS_STORE = "onuw_settings";
	
	/*
	 * Current settings, mapping all OIDs to a value.
	 * Initially populated with all OIDs and their default values defined by SETTINGS_TREE during initialization, then overwritten by any values from persistent storage. May be mutated at
	 * runtime by changes in the UI, and used for lookup by other modules through the public `getValue(oid)`.
	 */
	const OID_TO_VALUE = {};
	
	// All input-type nodes, keyed by OID, for lookup and validation
	const OID_TO_NODE = {};
	
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
			validator: (value, node) => Number.isInteger(value) && value >= 0,
			errorMsgKey: (node) => "UI_SETTING_ERROR_WEIGHT_NOT_NONNEG_INT",
			defaultValue: (node) => node.defaultValue ?? 0,
		},
		percent: {
			validator: (value, node) => Number.isInteger(value) && value >= 0 && value <= 100,
			errorMsgKey: (node) => "UI_SETTING_ERROR_WEIGHT_NOT_PERCENT",
			defaultValue: (node) => node.defaultValue ?? 0,
		},
		toggle: {
			validator: (value, node) => typeof value === "boolean",
			errorMsgKey: (node) => "UI_SETTING_ERROR_TOGGLE_NOT_BOOL",
			defaultValue: (node) => node.defaultValue ?? false,
		},
		numeric: {
			validator: (value, node) => {
				if (typeof value !== "number" || !Number.isFinite(value)) return false;
				if (node.numericType === "integer" && !Number.isInteger(value)) return false;
				if (!node.allowNegative && value < 0) return false;
				return true;
			},
			errorMsgKey: (node) => {
				const integer = node.numericType === "integer";
				if (!node.allowNegative)
					return integer ? "UI_SETTING_ERROR_NUMERIC_NOT_NONNEG_INT" : "UI_SETTING_ERROR_NUMERIC_NOT_NONNEG_NUMBER";
				return integer ? "UI_SETTING_ERROR_NUMERIC_NOT_INT" : "UI_SETTING_ERROR_NUMERIC_NOT_NUMBER";
			},
			defaultValue: (node) => node.defaultValue ?? 0,
		},
	};
	
	/*
	 * Optional validation predicates that depend on the currently selected roles.
	 *
	 * Some settings are only meaningful when certain game configurations are present. These predicates determine whether a setting should
	 * participate in validation.
	 */
	const CONTEXT_REQUIREMENTS = {
		evilTeamPresent: (context) => {
			if (!context?.selectedRoles) return true; // no context supplied — fail open, see below
			return [...context.selectedRoles.keys()].some(id =>
				Roles.isTeam(id, "TEAM_WEREWOLF") || Roles.isTeam(id, "TEAM_VAMPIRE") || Roles.isTeam(id, "TEAM_ALIEN")
			);
		},
		alienTeamPresent: (context) => {
			if (!context?.selectedRoles) return true; // no context supplied — fail open, see below
			return [...context.selectedRoles.keys()].some(id =>
				Roles.isTeam(id, "TEAM_ALIEN") || id === "SYNTHETICALIEN"
			);
		},
	};

	/*
	 * Static, declarative description of the settings UI: the hierarchy of settings nodes, their types, and their default values.
	 *
	 * The same hierarchy drives:
	 * 	- GUI generation
	 * 	- default value generation
	 * 	- validation
	 * 	- persistence
	 *
	 * Settings tree, defines the available settings and their hierarchy for use in the GUI construction. Each node represents a row in the GUI, and contains attributes as below
	 *  - type:
	 *    + header: visual grouping panel, no value
	 *    + weight: integer >= 0, used for weighted choice pools
	 *    + percent: integer [0,100]
	 *    + numeric: integer or float, see numericType/allowNegative below
	 *    + toggle: boolean
	 *    + label: simple text node (supports children)
	 *    + separator: vertical line
	 *  - id: string id that is used for OID assembly and to identify a node from its siblings. Must be unique within its sibling group, but can be reused elsewhere in the tree
	 *  - textKey: string, localized key
	 *  - textStyle: string array containing font styles to apply to a label element
	 *    + "bold" | "italic" | "underline" | "muted" | "none"
	 *  - weightGroupId: (weight only) ID for weight group, validation demands sum > 0. Must be unique per sibling group
	 *  - requiresContext: (optional) key into CONTEXT_REQUIREMENTS - if present, this node's weight only counts toward its weight group's sum when the check passes
	 *  - contextErrorMsg: (optional) localization key used as error message if requiresContext validation fails
	 *  - defaultValue: default value of the input control
	 *  - numericType: (numeric only) "integer" | "float"
	 *  - allowNegative: (numeric only) boolean, whether values below zero are valid
	 *  - affectedRoles: an array of roles (role IDs or team IDs) for whom the settings are relevant, inherited by the node's children. Used to separate errors that will impact
	 *                   the current state from those that don't. For example, an error in the settings for a role that is not currently selected is still an error, but would
	 *                   not prevent a valid narration script from being generated as the incorrectly configured setting will never be used
	 */
	const SETTINGS_TREE = [
		{
			type: "header",
			id: "narration",
			textKey: "UI_SETTING_NARRATION",
			children: [
				{
					type: "numeric",
					allowNegative: false,
					numericType: "integer",
					id: "pause_short",
					textKey: "UI_SETTING_NARRATION_PAUSE_SHORT",
					defaultValue: 15,
				},
				{
					type: "numeric",
					allowNegative: false,
					numericType: "integer",
					id: "pause_medium",
					textKey: "UI_SETTING_NARRATION_PAUSE_MEDIUM",
					defaultValue: 30,
				},
				{
					type: "numeric",
					allowNegative: false,
					numericType: "integer",
					id: "pause_long",
					textKey: "UI_SETTING_NARRATION_PAUSE_LONG",
					defaultValue: 45,
				},
				{
					type: "numeric",
					allowNegative: false,
					numericType: "float",
					id: "pause_scale",
					textKey: "UI_SETTING_NARRATION_PAUSE_SCALE",
					defaultValue: 1.0,
				},
			]
		},
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
				//Test nodes, not for production
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
					id: "force_ripple",
					textKey: "UI_SETTING_ORACLE_FORCE_RIPPLE",
					weightGroupId: 1,
					defaultValue: 10,
					requiresContext: "alienTeamPresent",
					contextErrorMsg: "UI_SETTING_ERROR_WEIGHTGROUP_ORACLE_RIPPLE",
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
	 * Assigns a unique Object ID (OID) to every node by concatenating the hierarchy of IDs (e.g. "oracle.view_player.odd"), used for lookup,
	 * persistence and validation instead of storing direct references to tree nodes. Also indexes every input-type node by its OID (OID_TO_NODE)
	 * for the same reason.
	 *
	 *   tree     - the (sub)tree to normalize; defaults to the whole SETTINGS_TREE, and is otherwise only ever a node's own `children` on a
	 *              recursive call.
	 *   parentOid - the already-assigned OID of tree's parent, or "" at the root; combined with each node's own `id` to build its OID.
	 *
	 * No return value - mutates every node in tree in place (adds `oid`) and populates OID_TO_NODE for input-type nodes.
	 */
	function _normalizeTree(tree = SETTINGS_TREE, parentOid = "") {
		for (const node of tree) {
			const oid = _makeOid(parentOid, node.id);
			node.oid = oid;
			
			if (node.children && node.children.length) {
				_normalizeTree(node.children, oid);
			}
			
			if (_isInputType(node))
				OID_TO_NODE[oid] = node;
		}
	}

	/*
	 * Recursively locks obj and every nested plain-object value as immutable via Object.freeze; skips a value that's already frozen. No
	 * return value - obj is frozen in place.
	 */
	function _deepFreeze(obj) {
		Object.freeze(obj);

		for (const value of Object.values(obj)) {
			if (value && typeof value === "object" && !Object.isFrozen(value)) {
				_deepFreeze(value);
			}
		}
	}

	_init();



	/* =========================
	   Private functions
	   ========================= */

	/*
	 * Restores persisted settings from localStorage over the already-applied defaults, logging each value that actually differs from its
	 * default. Silently keeps the default for any stored OID that's no longer known, or whose stored value now fails validation (e.g. after
	 * a settings-tree change) - either case is logged but never thrown. No parameters, no return value.
	 */
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
	
	// Persists the full current OID_TO_VALUE map to localStorage as JSON. No parameters, no return value.
	function _save() {
		localStorage.setItem(SETTINGS_STORE, JSON.stringify(OID_TO_VALUE) );
	}
	
	/*
	 * Resets current settings values to default (see _getDefaultSettings), without persisting - callers decide separately whether to save
	 * (see reset(), which does). No parameters, no return value.
	 */
	function _resetToDefault() {
		const defaults = _getDefaultSettings();
		
		for (const [oid, value] of Object.entries(defaults)) {
			_setValue(oid, value, false);
		}
	}
	
	/*
	 * Walks the whole settings tree and computes each input-type node's default value via its SETTINGS_TYPES.defaultValue(node).
	 * No parameters. Returns a plain OID -> default value map, covering every input-type node in SETTINGS_TREE.
	 */
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

	/*
	 * Joins non-empty parts with "." to build an OID (e.g. _makeOid("oracle", "view_player") → "oracle.view_player"); a falsy part (notably
	 * the root's empty parentOid) is dropped rather than producing a leading/double dot. Returns the joined string.
	 */
	function _makeOid(...parts) {
		return parts.filter(Boolean).join(".");
	}
	
	/*
	 * True if node's `type` has an entry in SETTINGS_TYPES - i.e. it actually holds a value (weight/percent/toggle/numeric), as opposed to a
	 * purely structural node (header/label/separator). Returns a boolean.
	 */
	function _isInputType(node) {
		return node.type in SETTINGS_TYPES;
	}
	
	/*
	 * Centralized write path used by all callers (setValue, _resetToDefault, _load) to guarantee validation before a value is stored.
	 *
	 *   oid   - the OID to write; must already exist in OID_TO_NODE (i.e. be a real, normalized input-type node).
	 *   value - the value to store; validated via that node's own SETTINGS_TYPES[node.type].validator before being accepted.
	 *   save  - if true (default), persists to localStorage afterwards via _save(); false is used internally when a caller (e.g. _load(),
	 *           _resetToDefault()) is about to write many values in a row and will persist once itself afterward.
	 *
	 * Throws if oid is unknown, or if value fails validation for the node's type - either way, OID_TO_VALUE is left unchanged.
	 */
	function _setValue(oid, value, save = true) {
		const node = OID_TO_NODE[oid];

		if (!node)
			throw new Error(`Unknown setting OID to set: ${oid}`);

		const settingsType = SETTINGS_TYPES[node.type];

		if (!settingsType.validator(value, node))
			throw new Error(`Invalid value ${value} of type ${node.type} to set: ${oid}`);

		OID_TO_VALUE[oid] = value;

		if (save)
			_save();
	}
	
	/*
	 * Validation overview.
	 *
	 * Validation happens in two independent layers, both driven from _validateNode walking the tree top-down:
	 *   1. Per-node value validation - does this node's own stored value satisfy its type's validator (SETTINGS_TYPES[node.type])?
	 *      Produces errorType: "value" errors.
	 *   2. Weight-group validation - among a node's children that share a weightGroupId, does the group sum to something > 0?
	 *      Handled separately by _validateWeightGroupsAmongChildren, since it's a cross-sibling check rather than a single node's own
	 *      value. Produces errorType: "weightGroupSum" errors.
	 *
	 * Both layers are intentionally independent of which roles are currently selected - see the module's public validate() for why, and
	 * validateRelevant()/filterRelevant() for how role-relevance is layered on afterward rather than baked in here.
	 */

	/*
	 * Recursively validates a single node and its subtree, pushing any problems found onto the shared `errors` array rather than returning
	 * or throwing - this is what lets validate() report every invalid setting across the whole tree in one pass instead of stopping at the
	 * first failure.
	 *
	 *   node                  - the node to validate.
	 *   errors                - shared array that every error found (in this node, its weight groups, or any descendant) is pushed onto.
	 *   hierarchy             - textKeys accumulated on the way down from the root, purely so an error can report a human-readable
	 *                           breadcrumb of where it occurred (see optionKey on the pushed error).
	 *   context               - forwarded to _isContextuallyAvailable for any requiresContext check encountered in this subtree.
	 *   inheritedAffectedRoles - the nearest ancestor's `affectedRoles`, used when node doesn't declare its own - so leaf settings don't
	 *                           need to repeat which roles make them relevant.
	 *
	 * No return value - see `errors`.
	 */
	function _validateNode(node, errors, hierarchy = [], context = {}, inheritedAffectedRoles) {
		const affectedRoles = node.affectedRoles ?? inheritedAffectedRoles;
		const v = OID_TO_VALUE[node.oid];
		const lookup = SETTINGS_TYPES[node.type];
		const invalid = lookup && !lookup.validator(v, node);
		const newHierarchy = [ ...hierarchy, node.textKey ];
		
		if (invalid)
			errors.push({ oid: node.oid, errorType: "value", optionKey: newHierarchy, messageKey: lookup.errorMsgKey(node), affectedRoles: affectedRoles });
		
		// Child/group validation
		if (hasChildren(node)) {
			_validateWeightGroupsAmongChildren(node, errors, newHierarchy, context, affectedRoles);
			for (const child of getChildren(node))
				_validateNode(child, errors, newHierarchy, context, affectedRoles);
		}
	}
	
	/*
	 * Weighted-choice pools (e.g. "what does the Alien do") only make sense if at least one option in the group has a non-zero weight, or the
	 * random pick in rules.js has nothing to select and throws. This groups sibling children by weightGroupId and sums their values, but a child
	 * whose `requiresContext` check fails (e.g. a setting only meaningful when an evil team is in play) contributes 0 to the sum regardless of
	 * its configured value - so a weight group can appear to satisfy "sum > 0" in the settings UI generally, yet still be reported as
	 * invalid for the *current* role selection if the only non-zero entries are contextually unavailable right now.
	 *
	 * When a group's sum is zero, the error message differentiates between "you set everything to zero yourself" vs. "the only non-zero entry was
	 * excluded by context" (using that excluded child's own contextErrorMsg if it defines one), so the UI can explain *why* a
	 * group is failing rather than just that it is.
	 *
	 *   node                   - the parent whose direct children are grouped by weightGroupId; a child without one is ignored entirely.
	 *   errors                 - shared array (see _validateNode) that a zero-sum group's error is pushed onto.
	 *   hierarchy              - breadcrumb for the pushed error's optionKey, already including node's own textKey (see _validateNode).
	 *   context                - forwarded to _isContextuallyAvailable for each child's requiresContext check.
	 *   inheritedAffectedRoles - as in _validateNode; node's own affectedRoles wins if it declares one.
	 *
	 * No return value - see `errors`.
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

	/*
	 * True if node has no `requiresContext` key at all (always available), or if it does and CONTEXT_REQUIREMENTS[node.requiresContext]
	 * passes for the given context. An unrecognized requiresContext key logs a warning and returns true (fails open) rather than silently
	 * manufacturing a validation error out of a typo elsewhere in the settings tree. Returns a boolean.
	 */
	function _isContextuallyAvailable(node, context) {
		if (!node.requiresContext) return true;

		const check = CONTEXT_REQUIREMENTS[node.requiresContext];
		if (!check) {
			console.warn(`Unknown requiresContext key '${node.requiresContext}' on node ${node.oid}`);
			return true; // typo'd key shouldn't manufacture a false-positive error
		}
		return check(context);
	}
	
	/*
	 * True if roleId (a specific role, e.g. "SEER") matches entry, where entry is either that same role ID directly or a team ID
	 * (e.g. "TEAM_WEREWOLF") that roleId belongs to - the two forms an `affectedRoles` entry can take (see _isErrorRelevant). Returns a boolean.
	 */
	function _roleMatchesAffected(roleId, entry) {
		return roleId === entry || Roles.isTeam(roleId, entry);
	}
	
	/*
	 * True if error should be shown given selectedRoles: always true for a global setting (no affectedRoles at all), otherwise true only if
	 * at least one currently-selected role matches at least one entry in error.affectedRoles (role ID or team, see _roleMatchesAffected).
	 *   error         - one error object as produced by _validateNode/_validateWeightGroupsAmongChildren (see validate()'s return doc).
	 *   selectedRoles - Map<roleId, count> of the currently selected roles.
	 */
	function _isErrorRelevant(error, selectedRoles) {
		if (!error.affectedRoles) return true; // global setting — always relevant
		return [...selectedRoles.keys()].some(roleId =>
			error.affectedRoles.some(entry => _roleMatchesAffected(roleId, entry))
		);
	}
	
	
	
	/* =========================
	   Public functions
	   ========================= */

	// Returns the top-level nodes of the settings tree (SETTINGS_TREE itself). No parameters.
	function getRootNodes() {
		return SETTINGS_TREE;
	}

	// Returns node's direct children, or [] if it has none. node - any settings tree node.
	function getChildren(node) {
		return node.children ?? [];
	}

	// Returns true if node has at least one child. node - any settings tree node.
	function hasChildren(node) {
		return (node.children?.length ?? 0) > 0;
	}

	// Returns the current value stored for oid. Throws if oid isn't a known, normalized input-type node (see OID_TO_NODE).
	function getValue(oid) {
		if (!(oid in OID_TO_VALUE)) {
			throw new Error(`Unknown setting OID to get: ${oid}`);
		}

		return OID_TO_VALUE[oid];
	}

	/*
	 * Validates and stores value for oid, then persists immediately (unlike the internal _setValue, always saves). See _setValue for the
	 * validation/throw behavior.
	 */
	function setValue(oid, value) {
		_setValue(oid, value);
	}

	// Resets every setting back to its default value and persists the result immediately. No parameters, no return value.
	function reset() {
		_resetToDefault();
		_save();
	}

	// Returns a shallow copy of every current setting value, keyed by OID - a copy so the caller can't mutate the module's own state.
	function getAllValues() {
		return { ...OID_TO_VALUE };
	}

	/*
	 * Validates the entire settings tree, independent of which roles are currently selected (see validateRelevant() for the role-aware
	 * version most UI code actually wants). See "Validation overview" above _validateNode for the two validation layers this runs.
	 *
	 *   context - forwarded to every requiresContext check in the tree (see CONTEXT_REQUIREMENTS); typically { selectedRoles } even though
	 *             this function's own result is role-independent, since a requiresContext predicate may still need to know the current
	 *             role selection to decide a node's contextual availability (e.g. "is Alien in the game at all").
	 *
	 * Returns an array of error objects, one per failure found, each shaped as:
	 *   {
	 *     oid: string,                                // the node the error is attached to
	 *     errorType: "value" | "weightGroupSum",      // the type of error this represents
	 *     optionKey: string[],                        // textKey breadcrumb from root to oid, for display
	 *     messageKey: string,                         // localization key for the error message
	 *     affectedRoles: (string[] | undefined),      // role/team IDs this error is relevant to; undefined = global, always relevant
	 *     data: { weightGroupId } | undefined,        // weightGroupSum errors only
	 *   }
	 */
	function validate(context = {}) {
		const errors = [];
		
		for (const root of SETTINGS_TREE)
			_validateNode(root, errors, [], context);

		return errors;
	}
	
	/*
	 * Filters errors (as returned by validate()) down to the ones relevant to selectedRoles (Map<roleId, count>) - see _isErrorRelevant.
	 * Returns the filtered array; does not mutate errors.
	 */
	function filterRelevant(errors, selectedRoles) {
		return errors.filter(error => _isErrorRelevant(error, selectedRoles));
	}
	
	/*
	 * validate() deliberately ignores which roles are selected, so its results are stable regardless of the current game setup — useful for
	 * a "reset to sane defaults" check. validateRelevant() layers the role-awareness on top by filtering those same errors down to the ones
	 * whose `affectedRoles` intersects the roles actually in play, which is what the in-game UI should show (no point warning about Vampire
	 * settings when no Vampire role is selected).
	 *
	 *   context - passed through to validate(); context.selectedRoles (Map<roleId, count>, defaulting to an empty Map if absent) is also
	 *             what filterRelevant() filters against.
	 *
	 * Returns the same error-object array validate() does (see its return doc), filtered to relevant errors only.
	 */
	function validateRelevant(context) {
		return filterRelevant(validate(context), context.selectedRoles ?? new Map());
	}
	
	/*
	 * Returns node's textStyle normalized to an array: the array as-is if it's already one, a single-element array if it's a string, or []
	 * if textStyle is absent. Used by the GUI.
	 *   node - any settings tree node.
	 */
	function getNodeTextStyles(node) {
		const styles = node.textStyle;
		
		if (Array.isArray(styles))
			return styles;
		else if (typeof styles === "string")
			return [ styles ];
		
		return [];
	}



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
