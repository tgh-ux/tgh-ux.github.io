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
	 * Current setting values, keyed by normalized object ID (OID).
	 *
	 * Populated with defaults during initialization, then overwritten by valid values loaded from localStorage. Runtime changes made
	 * through setValue() are written here and persisted immediately.
	 */
	const OID_TO_VALUE = {};

	/*
	 * Normalized input-type settings, keyed by OID.
	 *
	 * Used to resolve a setting's definition for validation and value updates. Structural nodes such as headers, labels, and separators are
	 * not included.
	 */
	const OID_TO_NODE = {};

	/*
	 * Definition of each supported value-bearing setting type.
	 *
	 * Each type provides:
	 *   validator(value, node) - returns true when a value is valid for that node.
	 *   errorMsgKey(node)      - returns the localization key for an invalid-value message.
	 *   defaultValue(node)     - returns the node's initial value.
	 *
	 * The functions receive the complete node so type-specific behavior can use additional node properties such as numericType,
	 * allowNegative, or defaultValue.
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
	 * Optional predicates that determine whether a setting is contextually available.
	 *
	 * A setting can name one of these predicates through `requiresContext`. During validation, a contextually unavailable setting
	 * contributes no weight to its weight group.
	 *
	 * Predicates receive a context object, normally containing `selectedRoles`. They fail open when no role-selection context is supplied,
	 * allowing generic validation to run without requiring a game setup.
	 */
	const CONTEXT_REQUIREMENTS = {
		// True when the current role selection contains any evil-aligned team.
		evilTeamPresent: (context) => {
			if (!context?.selectedRoles) return true;
			return [...context.selectedRoles.keys()].some(id =>
				Roles.isTeam(id, "TEAM_WEREWOLF") || Roles.isTeam(id, "TEAM_VAMPIRE") || Roles.isTeam(id, "TEAM_ALIEN") || id === "SYNTHETICALIEN"
			);
		},
		// True when the current role selection contains an Alien team.
		alienTeamPresent: (context) => {
			if (!context?.selectedRoles) return true;
			return [...context.selectedRoles.keys()].some(id =>
				Roles.isTeam(id, "TEAM_ALIEN") || id === "SYNTHETICALIEN"
			);
		},
		// True when Oracle and an Alien team are present and Oracle's force-ripple weight is non-zero.
		oracleForceRippleAvailable: (context) => {
			if (!context?.selectedRoles) return true;

			const oraclePresent = context.selectedRoles.has("ORACLE");
			const alienTeamPresent = [...context.selectedRoles.keys()].some(id => Roles.isTeam(id, "TEAM_ALIEN") || id === "SYNTHETICALIEN");

			if (!oraclePresent || !alienTeamPresent)
				return false;

			return getValue("oracle.force_ripple") > 0;
		},
	};

	/*
	 * Declarative description of the complete settings UI and validation tree.
	 *
	 * The tree is the single source of truth for:
	 *   - available settings and their hierarchy
	 *   - GUI construction
	 *   - default values
	 *   - value validation
	 *   - persistence
	 *   - role-specific relevance
	 *
	 * Each node may contain:
	 *   type                    - The type of node the entry represents:
	 *                               header    - Visual grouping node; no value.
	 *                               label     - Text-only node; may contain children.
	 *                               separator - Visual separator; no value.
	 *                               weight    - Non-negative integer used in a weighted-choice group.
	 *                               percent   - Integer from 0 through 100.
	 *                               numeric   - Number whose integer/negative rules are controlled by numericType and allowNegative.
	 *                               toggle    - Boolean value.
	 *   id                      - Node identifier, unique among its siblings. May be reused in another branch. Combined with ancestor IDs
	 *                             during initialization to form the node's OID.
	 *   textKey                 - Localization key used for the node's displayed label and validation breadcrumb.
	 *   textStyle               - Optional style name or array of style names for the GUI label: "bold", "italic", "underline", "muted", or
	 *                             "none".
	 *   children                - Optional array of child nodes. Children inherit affectedRoles from their nearest ancestor that defines
	 *                             it.
	 *   defaultValue            - Initial value for an input-type node. The corresponding SETTINGS_TYPES entry determines how it is
	 *                             interpreted and validated.
	 *   weightGroupId           - Used by weight nodes to place sibling choices into the same weighted-choice pool. Each group's effective
	 *                             weight must be greater than zero when validated.
	 *   requiresContext         - Optional key into CONTEXT_REQUIREMENTS. When the predicate fails, the node is considered unavailable for
	 *                             weight-group validation and contributes no weight.
	 *   conditionalWeightGroups - Optional additional weight-group checks that are only active when their own requiresContext predicate
	 *                             passes. Each requirement may specify: weightGroupId requiresContext excludeIds errorMsgKey
	 *   contextErrorMsg         - Optional localization key used when this node is unavailable because its own requiresContext check fails
	 *                             but its weight would otherwise affect validation.
	 *   numericType             - For numeric nodes: "integer" or "float".
	 *   allowNegative           - For numeric nodes: whether values below zero are valid.
	 *   affectedRoles           - Optional role/team IDs for which this subtree is relevant. Child nodes inherit this value unless they
	 *                             define their own. Validation is always performed for the whole tree; validateRelevant() uses
	 *                             affectedRoles afterward to filter errors for the roles actually in play.
	 *
	 * OIDs are generated automatically during initialization, so they must not be authored manually in this tree.
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
				{
					type: "toggle",
					id: "play_timer_warnings",
					textKey: "UI_SETTING_NARRATION_TIMER_WARNINGS",
					defaultValue: true,
				},
				{
					type: "toggle",
					id: "play_timer_expired",
					textKey: "UI_SETTING_NARRATION_TIMER_EXPIRED",
					defaultValue: true,
				},
			]
		},
		{
			type: "header",
			id: "ripple",
			textKey: "UI_SETTING_RIPPLE",
			affectedRoles: [ "TEAM_ALIEN", "SYNTHETICALIEN" ],
			conditionalWeightGroups: [
				{
					weightGroupId: 1,
					requiresContext: "oracleForceRippleAvailable",
					excludeIds: [ "none" ],
					errorMsgKey: "UI_SETTING_ERROR_WEIGHTGROUP_RIPPLE_ORACLE"
				}
			],
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

	/**
	 * Initializes the settings tree and current values.
	 *
	 * Normalizes every node with its generated OID, populates the OID lookup table, applies defaults, loads valid persisted values, then
	 * freezes the resulting tree so setting definitions cannot be modified at runtime.
	 */
	function _init() {
		_normalizeTree();
		_resetToDefault();
		_load();
		_deepFreeze(SETTINGS_TREE);
	}

	_init();

	/**
	 * Assigns hierarchical OIDs to every node and indexes all input-type nodes by OID.
	 *
	 * A node's OID is formed by joining its ID with the OID of its parent, for example `oracle.view_player.odd`. The tree is modified in
	 * place by adding the `oid` field.
	 *
	 * @param {object[]} tree - Current settings subtree.
	 * @param {string} parentOid - OID of the parent node, or empty at the root.
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

	/**
	 * Recursively freezes an object and all nested objects and arrays in place.
	 *
	 * @param {object} obj - Object to freeze.
	 */
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

	/**
	 * Loads persisted setting values from localStorage over the current defaults.
	 *
	 * Unknown OIDs and values that fail current validation are ignored, leaving their defaults intact. Invalid stored data is reported to
	 * the console rather than preventing initialization.
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

	/**
	 * Persists the complete current setting-value map to localStorage.
	 */
	function _save() {
		localStorage.setItem(SETTINGS_STORE, JSON.stringify(OID_TO_VALUE) );
	}

	/**
	 * Replaces all current setting values with their configured defaults.
	 *
	 * Changes are not persisted; callers that need persistence must call _save() separately.
	 */
	function _resetToDefault() {
		const defaults = _getDefaultSettings();

		for (const [oid, value] of Object.entries(defaults)) {
			_setValue(oid, value, false);
		}
	}

	/**
	 * Builds a complete OID -> default-value map from SETTINGS_TREE.
	 *
	 * Only value-bearing nodes are included. Defaults are generated through the corresponding SETTINGS_TYPES definition rather than read
	 * directly from node.defaultValue, allowing each type to define its own fallback behavior.
	 *
	 * @returns {object} Map of setting OIDs to their default values.
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

	/**
	 * Builds an object ID (OID) by joining non-empty hierarchy components with ".".
	 *
	 * @param {...string} parts - OID components from the root toward the current node.
	 * @returns {string} Hierarchical OID.
	 */
	function _makeOid(...parts) {
		return parts.filter(Boolean).join(".");
	}

	/**
	 * Returns whether a settings node represents a value-bearing input control.
	 *
	 * @param {object} node - Settings tree node.
	 * @returns {boolean} True when the node's type is defined in SETTINGS_TYPES.
	 */
	function _isInputType(node) {
		return node.type in SETTINGS_TYPES;
	}

	/**
	 * Validates and stores one setting value, optionally persisting the change.
	 *
	 * The OID must identify a normalized input-type node. Validation is performed by that node's SETTINGS_TYPES validator before
	 * OID_TO_VALUE is changed.
	 *
	 * @param {string} oid - OID of the setting to update.
	 * @param {*} value - Value to validate and store.
	 * @param {boolean} [save=true] - Whether to persist the updated values immediately.
	 * @throws {Error} If the OID is unknown or the value fails validation.
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
	 * Validation consists of two independent checks:
	 *
	 *   1. Node values must satisfy their type-specific SETTINGS_TYPES validator.
	 *   2. Each sibling weight group must have an effective total greater than zero.
	 *
	 * Context-dependent availability affects weight-group totals, while role relevance is applied afterward by
	 * filterRelevant()/validateRelevant().
	 */

	/**
	 * Recursively validates a settings node and its descendants.
	 *
	 * Value errors are checked on the current node; child weight groups and conditional weight-group requirements are checked before
	 * descending into the children. Problems are appended to the shared `errors` array so validation can report every failure in the tree
	 * rather than stopping at the first one.
	 *
	 * @param {object} node - Node to validate.
	 * @param {object[]} errors - Shared array receiving validation errors.
	 * @param {string[]} [hierarchy=[]] - Localization-key breadcrumb accumulated from ancestors.
	 * @param {object} [context={}] - Context passed to requiresContext predicates.
	 * @param {string[]} [inheritedAffectedRoles] - affectedRoles inherited from the nearest ancestor that defines it.
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
			_validateConditionalWeightGroups(node, errors, newHierarchy, context, affectedRoles);

			for (const child of getChildren(node))
				_validateNode(child, errors, newHierarchy, context, affectedRoles);
		}
	}

	/**
	 * Validates the effective weight total of each weight group among a node's direct children.
	 *
	 * A child whose requiresContext condition fails contributes no weight. If a group's effective total is zero, a validation error is
	 * added; when possible, the error identifies that contextual exclusion as the reason the group has no available weight.
	 *
	 * @param {object} node - Parent whose direct children contain the weight groups.
	 * @param {object[]} errors - Shared array receiving validation errors.
	 * @param {string[]} hierarchy - Localization-key breadcrumb for the parent node.
	 * @param {object} context - Context passed to contextual-availability checks.
	 * @param {string[]} inheritedAffectedRoles - inherited affectedRoles for the error.
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
					messageKey: excluder?.contextErrorMsg ?? (excluder ? "UI_SETTING_ERROR_WEIGHTGROUP_SUM_ZERO_CONTEXT" : "UI_SETTING_ERROR_WEIGHTGROUP_SUM_ZERO"),
					data: { weightGroupId: gid },
					affectedRoles: affectedRoles,
				});
			}
		}
	}

	/**
	 * Validates additional, context-dependent requirements for weight groups.
	 *
	 * Each requirement becomes active only when its requiresContext predicate passes. An active requirement is satisfied when at least one
	 * non-excluded, contextually available child in the specified weight group has a positive weight.
	 *
	 * @param {object} node - Parent whose direct children contain the group.
	 * @param {object[]} errors - Shared array receiving validation errors.
	 * @param {string[]} hierarchy - Localization-key breadcrumb for the parent node.
	 * @param {object} context - Context passed to contextual-availability checks.
	 * @param {string[]} inheritedAffectedRoles - inherited affectedRoles for the error.
	 */
	function _validateConditionalWeightGroups(node, errors, hierarchy, context, inheritedAffectedRoles) {
		const requirements = node.conditionalWeightGroups;
		if (!requirements?.length) return;

		const affectedRoles = node.affectedRoles ?? inheritedAffectedRoles;

		for (const requirement of requirements) {
			if (!_isContextuallyAvailable({ requiresContext: requirement.requiresContext }, context)) continue;

			const excludedIds = new Set(requirement.excludeIds ?? []);
			let sum = 0;

			for (const child of getChildren(node)) {
				if (child.weightGroupId !== requirement.weightGroupId) continue;
				if (excludedIds.has(child.id)) continue;
				if (!_isContextuallyAvailable(child, context)) continue;

				sum += getValue(child.oid);
			}

			if (sum <= 0) {
				errors.push({
					oid: node.oid,
					errorType: "conditionalWeightGroup",
					optionKey: [...hierarchy],
					messageKey: requirement.errorMsgKey ?? "UI_SETTING_ERROR_WEIGHTGROUP_SUM_ZERO",
					affectedRoles: affectedRoles,
					data: {
						weightGroupId: requirement.weightGroupId,
						requiresContext: requirement.requiresContext,
						excludeIds: [...excludedIds]
					},
				});
			}
		}
	}

	/**
	 * Returns whether a node is available in the supplied validation context.
	 *
	 * Nodes without requiresContext are always available. An unknown requirement key is treated as available and logged as a warning rather
	 * than producing a validation error.
	 *
	 * @param {object} node - Settings node or requirement-like object containing requiresContext.
	 * @param {object} context - Context passed to the configured requirement predicate.
	 * @returns {boolean} Whether the node is contextually available.
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

	/**
	 * Returns whether a selected role matches an affectedRoles entry.
	 *
	 * An entry may name the role itself or a team that the role belongs to.
	 *
	 * @param {string} roleId - Selected role ID.
	 * @param {string} entry - Role ID or team ID from affectedRoles.
	 * @returns {boolean} True when the role matches the entry.
	 */
	function _roleMatchesAffected(roleId, entry) {
		return roleId === entry || Roles.isTeam(roleId, entry);
	}

	/**
	 * Returns whether a validation error is relevant to the current role selection.
	 *
	 * Errors without affectedRoles are global and always relevant. Otherwise, at least one selected role must match one of the error's
	 * affected role or team entries.
	 *
	 * @param {object} error - Validation error produced by validate().
	 * @param {Map<string, number>} selectedRoles - Currently selected roles and their counts.
	 * @returns {boolean} True when the error should be shown for the current selection.
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

	/**
	 * Returns the top-level nodes of the settings tree.
	 *
	 * The returned tree is immutable after initialization.
	 *
	 * @returns {object[]} Top-level settings nodes.
	 */
	function getRootNodes() {
		return SETTINGS_TREE;
	}

	/**
	 * Returns a node's direct children.
	 *
	 * @param {object} node - Settings tree node.
	 * @returns {object[]} Direct child nodes, or an empty array when the node has none.
	 */
	function getChildren(node) {
		return node.children ?? [];
	}

	/**
	 * Returns whether a settings node has any direct children.
	 *
	 * @param {object} node - Settings tree node.
	 * @returns {boolean} True when the node has at least one child.
	 */
	function hasChildren(node) {
		return (node.children?.length ?? 0) > 0;
	}

	/**
	 * Returns the current value of a setting.
	 *
	 * @param {string} oid - OID of the setting.
	 * @returns {*} Current setting value.
	 * @throws {Error} If the OID does not identify a known input-type setting.
	 */
	function getValue(oid) {
		if (!(oid in OID_TO_VALUE)) {
			throw new Error(`Unknown setting OID to get: ${oid}`);
		}

		return OID_TO_VALUE[oid];
	}

	/**
	 * Validates, stores, and persists a setting value.
	 *
	 * Validation is performed according to the setting's type definition. The value is only changed when validation succeeds.
	 *
	 * @param {string} oid - OID of the setting.
	 * @param {*} value - New value.
	 * @throws {Error} If the OID is unknown or the value is invalid for that setting.
	 */
	function setValue(oid, value) {
		_setValue(oid, value);
	}

	/**
	 * Resets every setting to its configured default value and persists the result.
	 */
	function reset() {
		_resetToDefault();
		_save();
	}

	/**
	 * Returns a copy of all current setting values keyed by OID.
	 *
	 * The returned object may be modified by the caller without affecting the module's internal value store.
	 *
	 * @returns {object} Shallow copy of the current OID -> value map.
	 */
	function getAllValues() {
		return { ...OID_TO_VALUE };
	}

	/**
	 * Validates the complete settings tree.
	 *
	 * Validation checks each input value against its type and verifies that every applicable weight group has a positive effective total.
	 * Context-dependent availability is evaluated using `context`, but role relevance is not filtered here; callers can use
	 * validateRelevant() when they only want errors affecting the current role selection.
	 *
	 * @param {object} [context={}] - Context forwarded to requiresContext predicates, typically containing `selectedRoles`.
	 * @returns {object[]} Validation errors. Each error has the form:
	 *   {
	 *     oid: string,
	 *     errorType: "value" | "weightGroupSum" | "conditionalWeightGroup",
	 *     optionKey: string[],
	 *     messageKey: string,
	 *     affectedRoles: string[] | undefined,
	 *     data: object | undefined
	 *   }
	 */
	function validate(context = {}) {
		const errors = [];

		for (const root of SETTINGS_TREE)
			_validateNode(root, errors, [], context);

		return errors;
	}

	/**
	 * Filters validation errors to those relevant to the currently selected roles.
	 *
	 * Global errors are retained. Errors with affectedRoles are retained when at least one selected role matches one of those role or team
	 * IDs.
	 *
	 * @param {object[]} errors - Validation errors returned by validate().
	 * @param {Map<string, number>} selectedRoles - Currently selected roles and counts.
	 * @returns {object[]} Filtered validation errors.
	 */
	function filterRelevant(errors, selectedRoles) {
		return errors.filter(error => _isErrorRelevant(error, selectedRoles));
	}

	/**
	 * Validates all settings and returns only errors relevant to the current role selection.
	 *
	 * This is equivalent to validate(context) followed by filterRelevant(errors, context.selectedRoles), with an empty role map when no
	 * selection is supplied.
	 *
	 * @param {object} context - Validation context, including selectedRoles when available.
	 * @returns {object[]} Validation errors relevant to the selected roles.
	 */
	function validateRelevant(context) {
		return filterRelevant(validate(context), context.selectedRoles ?? new Map());
	}

	/**
	 * Returns a node's text styles in normalized array form.
	 *
	 * A missing style becomes [], and a single string style becomes a one-element array.
	 *
	 * @param {object} node - Settings tree node.
	 * @returns {string[]} Normalized text-style names.
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
