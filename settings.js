/* =========================
   Settings tree (pure data)
   ========================= */

/**
 * type:
 * - header: visual grouping panel, no value
 * - weight: integer >= 0, used for weighted choice pools
 * - percent: integer [0,100]
 * - toggle: boolean (future)
 * - label: simple text node (supports children)
 * - separator: vertical line
 * id:
 * - string, must be unique per hierarchy
 * textKey:
 * - string, localized key
 * textStyle:
 * - "bold" | "italic" | "underline" | "muted" | "none"
 * weightGroupId:
 * - ID for weight group, validation demands sum > 0. Must be unique per sibling group
 * defaultValue:
 * - default value of the input control
 */

const SETTINGS_TREE = [
	{
		type: "header",
		id: "ripple",
		textKey: "UI_SETTING_RIPPLE",
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
				id: "show_Cards",
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
						defaultValue: 50
					},
					{
						type: "toggle",
						id: "oracle_test_3",
						textKey: "oracle_test_3",
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
				children: [
					{
						type: "weight",
						id: "full",
						textKey: "UI_SETTING_ORACLE_SWITCH_TEAM_FULL",
						weightGroupId: 1,
						defaultValue: 1
					},
					{
						type: "weight",
						id: "partial",
						textKey: "UI_SETTING_ORACLE_SWITCH_TEAM_PARTIAL",
						weightGroupId: 1,
						defaultValue: 1
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
   Internal state
   ========================= */

const SETTINGS_VALUES = {}; // oid -> current value

/* =========================
   Persistent storage
   ========================= */
   
function saveSettingsToStorage() {
  localStorage.setItem(
    "onuww_settings",
    JSON.stringify(SETTINGS_VALUES)
  );
}

function loadSettingsFromStorage() {
  const raw = localStorage.getItem("onuww_settings");
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);

    console.group("Loaded settings (diff from defaults)");

    for (const [oid, value] of Object.entries(saved)) {
      if (!(oid in SETTINGS_VALUES)) continue;

      const before = SETTINGS_VALUES[oid];

      if (before !== value) {
        console.log(`${oid}: ${before} → ${value}`);
      }

      SETTINGS_VALUES[oid] = value;
    }

    console.groupEnd();
  } catch {
    console.warn("Failed to parse stored settings");
  }
}

/* =========================
   OID helpers
   ========================= */

function makeOid(...parts) {
  return parts.filter(Boolean).join(".");
}

function normalizeSettingsTree(tree, parentOid = "") {
  for (const node of tree) {
    node.oid = makeOid(parentOid, node.id);

    if (node.children && node.children.length) {
      normalizeSettingsTree(node.children, node.oid);
    }
  }
}

/* =========================
   Default value assembly
   ========================= */

function buildDefaultSettingsValues(tree) {
  const values = {};

  function walk(nodes) {
    for (const node of nodes) {
      if (node.type === "weight") {
        values[node.oid] = node.defaultValue ?? 0;
      } else if (node.type === "toggle") {
        values[node.oid] = node.defaultValue ?? false;
      } else if (node.type === "percent") {
        values[node.oid] = node.defaultValue ?? 0;
      }

      if (node.children && node.children.length) walk(node.children);
    }
  }

  walk(tree);
  return values;
}

/* =========================
   Public API: init / get / set
   ========================= */

function initSettings() {
  // Adds node.oid to every node in the tree.
  normalizeSettingsTree(SETTINGS_TREE);

  // Fill SETTINGS_VALUES with defaults.
  const defaults = buildDefaultSettingsValues(SETTINGS_TREE);
  for (const [k, v] of Object.entries(defaults)) {
    SETTINGS_VALUES[k] = v;
  }
}

function getSettingByOid(oid) {
  return SETTINGS_VALUES[oid];
}

function setSettingByOid(oid, value) {
  SETTINGS_VALUES[oid] = value;
  saveSettingsToStorage();
}

function getSettingsValues() {
  // Return a shallow copy so rules.js can't accidentally mutate state.
  return { ...SETTINGS_VALUES };
}

/* =========================
   Validation
   ========================= */

/**
 * Returns an array of validation errors.
 * Each error: { oid, messageKey, details? }
 *
 * We keep messageKey as a localization key so this file stays dependency-free.
 */
function validateSettings() {
  const errors = [];

  function validateNode(node) {
    // Self validation
    if (node.type === "weight") {
      const v = SETTINGS_VALUES[node.oid];

      // Allow undefined during partial UI init
      if (v === undefined) return;

      if (!Number.isInteger(v) || v < 0) {
        errors.push({
          oid: node.oid,
          messageKey: "UI_SETTING_ERROR_WEIGHT_NOT_NONNEG_INT"
        });
      }
    }

    if (node.type === "toggle") {
      const v = SETTINGS_VALUES[node.oid];
      if (v === undefined) return;

      if (typeof v !== "boolean") {
        errors.push({
          oid: node.oid,
          messageKey: "UI_SETTING_ERROR_TOGGLE_NOT_BOOL"
        });
      }
    }
	
	if (node.type === "percent") {
      const v = SETTINGS_VALUES[node.oid];

      // Allow undefined during partial UI init
      if (v === undefined) return;

      if (!Number.isInteger(v) || v < 0 || v > 100) {
        errors.push({
          oid: node.oid,
          messageKey: "UI_SETTING_ERROR_WEIGHT_NOT_PERCENT"
        });
      }
    }

    // Child/group validation
    if (node.children && node.children.length) {
      validateWeightGroupsAmongChildren(node);
      for (const child of node.children) validateNode(child);
    }
  }

  function validateWeightGroupsAmongChildren(parentNode) {
    const weights = parentNode.children.filter(c => c.type === "weight");

    // Group by weightGroupId
    const groups = new Map(); // groupId -> childNodes[]
    for (const child of weights) {
      const gid = child.weightGroupId;
      if (gid === undefined || gid === null) continue;

      if (!groups.has(gid)) groups.set(gid, []);
      groups.get(gid).push(child);
    }

    for (const [gid, nodes] of groups.entries()) {
      let sum = 0;

      for (const n of nodes) {
        const v = SETTINGS_VALUES[n.oid];
        if (Number.isInteger(v) && v > 0) sum += v;
      }

      if (sum <= 0) {
        errors.push({
          oid: parentNode.oid,
          messageKey: "UI_SETTING_ERROR_WEIGHTGROUP_SUM_ZERO",
          details: { weightGroupId: gid }
        });
      }
    }
  }

  for (const root of SETTINGS_TREE) validateNode(root);

  return errors;
}

/* =========================
   Init at load
   ========================= */

function initializeSettingsWithPersistence() {
    initSettings();
    loadSettingsFromStorage();
}

initializeSettingsWithPersistence();
