/*
 * Central registry for all role and token definitions.
 *
 * This module contains the immutable metadata describing every role and token in the game, performs initialization to derive additional information
 * (tags, teams, phases, localization keys, etc.), validates the data, and exposes helper functions used throughout the application.
 *
 * The exported objects are frozen after initialization and should be treated as read-only.
 */

const Roles = (() => {

	/* =========================
	   Data
	   ========================= */
	
	/* 
	 * Definition of all tokens present in the game.
	 * TokenID:
	 * 	- type: token category for grouping
	 * 	- icon: x/y coordinates for the token icon in the token sprite sheets
	 * 	- usedBy: the IDs of all roles that directly place this token
	 * 	- prereq: the conditions for when a token is actively in play, depending on the currently selected roles
	 * 	- disabled: if present and true, excludes the token from consideration in the UI and logic. Automatically set at initialization if the prerequisites cannot be satisfied (e.g. required role is disabled)
	 */
	const TOKENS = {
		SHIELD:					{ type: "shield", icon: { x: 4, y: 0 }, usedBy: [ "SENTINEL" ], prereq: { type: "role", any: ["SENTINEL"] } },
		ARTIFACT_WEREWOLF:		{ type: "artifact", icon: { x: 0, y: 0 }, usedBy: [ "CURATOR" ], prereq: { type: "role", any: ["CURATOR"] } },
		ARTIFACT_VAMPIRE:		{ type: "artifact", icon: { x: 1, y: 0 }, usedBy: [ "CURATOR" ], prereq: { type: "role", any: ["CURATOR"] } },
		ARTIFACT_ALIEN:			{ type: "artifact", icon: { x: 3, y: 1 }, usedBy: [ "CURATOR" ], prereq: { type: "role", any: ["CURATOR"] } },
		ARTIFACT_TANNER:		{ type: "artifact", icon: { x: 3, y: 2 }, usedBy: [ "CURATOR" ], prereq: { type: "role", any: ["CURATOR"] } },
		ARTIFACT_HUNTER:		{ type: "artifact", icon: { x: 2, y: 2 }, usedBy: [ "CURATOR" ], prereq: { type: "role", any: ["CURATOR"] } },
		ARTIFACT_VILLAGER:		{ type: "artifact", icon: { x: 0, y: 2 }, usedBy: [ "CURATOR" ], prereq: { type: "role", any: ["CURATOR"] } },
		ARTIFACT_BODYGUARD:		{ type: "artifact", icon: { x: 1, y: 1 }, usedBy: [ "CURATOR" ], prereq: { type: "role", any: ["CURATOR"] } },
		ARTIFACT_PRINCE:		{ type: "artifact", icon: { x: 3, y: 0 }, usedBy: [ "CURATOR" ], prereq: { type: "role", any: ["CURATOR"] } },
		ARTIFACT_TRAITOR:		{ type: "artifact", icon: { x: 1, y: 2 }, usedBy: [ "CURATOR" ], prereq: { type: "role", any: ["CURATOR"] } },
		ARTIFACT_CLOAK:			{ type: "artifact", icon: { x: 0, y: 1 }, usedBy: [ "CURATOR" ], prereq: { type: "role", any: ["CURATOR"] } },
		ARTIFACT_MUTED:			{ type: "artifact", icon: { x: 2, y: 0 }, usedBy: [ "CURATOR" ], prereq: { type: "role", any: ["CURATOR"] } },
		ARTIFACT_VOID:			{ type: "artifact", icon: { x: 2, y: 1 }, usedBy: [ "CURATOR" ], prereq: { type: "role", any: ["CURATOR"] } },
		MARK_VAMPIRE:			{ type: "mark", icon: { x: 0, y: 3 }, usedBy: [ /* populated at init with all vampire team members */ ], prereq: { type: "team", any: ["TEAM_VAMPIRE"] } },
		MARK_RENFIELD:			{ type: "mark", icon: { x: 1, y: 3 }, usedBy: [ "RENFIELD" ], prereq: { type: "role", any: ["RENFIELD"] } },
		MARK_COUNT:				{ type: "mark", icon: { x: 0, y: 4 }, usedBy: [ "COUNT" ], prereq: { type: "role", any: ["COUNT"] } },
		MARK_DISEASED:			{ type: "mark", icon: { x: 1, y: 4 }, usedBy: [ "DISEASED" ], prereq: { type: "role", any: ["DISEASED"] } },
		MARK_INSTIGATOR:		{ type: "mark", icon: { x: 2, y: 4 }, usedBy: [ "INSTIGATOR" ], prereq: { type: "role", any: ["INSTIGATOR"] } },
		MARK_ASSASSIN:			{ type: "mark", icon: { x: 3, y: 3 }, usedBy: [ "ASSASSIN", "APPRENTICEASSASSIN" ], prereq: { type: "role", any: ["ASSASSIN", "APPRENTICEASSASSIN"] } },
		MARK_CUPID:				{ type: "mark", icon: { x: 2, y: 3 }, usedBy: [ "CUPID" ], prereq: { type: "role", any: ["CUPID"] } },
		MARK_CLARITY:			{ type: "mark", icon: { x: 3, y: 4 }, usedBy: [ "PRIEST" ], prereq: { type: "tag", any: ["PLACES_MARKS"] } },
	};

	/* 
	 * Definition of all roles present in the game, pre-defined with unique per-role data Only data that is unique to an individual role is stored here.
	 * Shared properties such as tags, team membership, active phase, localization keys and IDs are injected during initialization
	 * from the lookup tables below.
	 * 
	 * RoleID:
	 * 	- icon: x/y coordinates for the character portrait and first card art in their respective sprite sheets
	 * 	- cardIcons: array of x/y coordinates for addition card art in the card sprite sheet
	 * 	- minCount: minimum number of cards/instances of a role (if it is selected, else it is implicitly 0)
	 * 	- maxCount: maximum number of cards/instances of a role
	 * 	- prereq: a prerequisite tree defining what conditions must be true in order for a role to be eligible for use
	 * 	- extraCenterCards: how many extra unused center cards this role will contribute with (mainly for player count calculations)
	 * 	- disabled: if present and true, excludes the role from consideration in the UI and logic
	 * 	
	 * 	The following attributes are assigned during initialization
	 * 	- id: the ID of the role, same as its entry in the ROLES table
	 * 	- nameKey: localization key for the full role name
	 * 	- abilityKey: localization key for the full role ability description
	 * 	- tags: an array of strings that represent generic meta data, such as what rules apply for a role
	 * 	- team: defines the team a role is playing for (by default)
	 * 	- phase: defines the active phase during which the role will perform its action
	 */
	const ROLES = {
		ALIEN: {
			minCount: 1,
			maxCount: 2,
			icon: { x: 0, y: 4 },
			cardIcons: [ { x: 1, y: 4}, ],
		},
		ALPHAWOLF: {
			extraCenterCards: 1,
			icon: { x: 0, y: 1 },
			prereq: {
				type: "role",
				any: ["WEREWOLF", "DREAMWOLF", "MYSTICWOLF"]
			}
		},
		APPRENTICEASSASSIN: {
			icon: { x: 0, y: 3 },
			prereq: {
				type: "role",
				any: ["ASSASSIN"]
			},
		},
		APPRENTICESEER: {
			icon: { x: 1, y: 1 },
		},
		APPRENTICETANNER: {
			icon: { x: 0, y: 2 },
			prereq: {
				type: "role",
				any: ["TANNER"]
			}
		},
		ASSASSIN: {
			icon: { x: 1, y: 3 },
		},
		AURASEER: {
			icon: { x: 1, y: 2 },
			prereq: {
				type: "tag",
				any: ["AURA_SEER_DETECTABLE"]
			}
		},
		BEHOLDER: {
			icon: { x: 2, y: 2 },
			prereq: {
				type: "role",
				any: ["SEER", "APPRENTICESEER"]
			},
		},
		BLOB: { 
			icon: { x: 4, y: 4 },
		},
		BODYGUARD: { 
			icon: { x: 2, y: 1 }, 
		},
		BODYSNATCHER: { 
			icon: { x: 3, y: 2 }
		},
		COPYCAT: {
			icon: { x: 2, y: 3 },
		},
		COUNT: {
			icon: { x: 11, y: 3 },
		},
		COW: {
			icon: { x: 5, y: 4 },
			prereq: {
				any: [
					{
						type: "team",
						any: ["TEAM_ALIEN"]
					},
					{
						type: "role",
						any: ["SYNTHETICALIEN"]
					}
				]
			},
		},
		CUPID: {
			icon: { x: 3, y: 3 },
		},
		CURATOR: {
			icon: { x: 3, y: 1 },
		},
		CURSED: {
			icon: { x: 4, y: 2 },
		},
		DISEASED: {
			icon: { x: 4, y: 3 },
		},
		DOPPELGANGER: {
			icon: { x: 1, y: 0 },
		},
		DREAMWOLF: {
			icon: { x: 4, y: 1 },
		},
		DRUNK: {
			icon: { x: 3, y: 0 },
		},
		EMPATH: {
			icon: { x: 5, y: 2 },
		},
		EXPOSER: {
			icon: { x: 6, y: 4 },
		},
		FEUDINGALIENS: {
			minCount: 2,
			maxCount: 2,
			icon: { x: 2, y: 4 },
			cardIcons: [ { x: 3, y: 4}, ],
		},
		GREMLIN: {
			icon: { x: 5, y: 3 },
			prereq: {
				type: "tag",
				any: ["PLACES_MARKS"]
			},
		},
		HUNTER: {
			icon: { x: 5, y: 0 },
		},
		INSOMNIAC: {
			icon: { x: 8, y: 0 },
		},
		INSTIGATOR: {
			icon: { x: 6, y: 3 },
		},
		LEADER: {
			icon: { x: 7, y: 4 },
			prereq: {
				any: [
					{
						type: "team",
						any: ["TEAM_ALIEN"]
					},
					{
						type: "role",
						any: ["SYNTHETICALIEN"]
					}
				]
			},
		},
		MARKSMAN: {
			icon: { x: 7, y: 3 },
			prereq: {
				type: "tag",
				any: ["PLACES_MARKS"]
			},
		},
		MASON: {
			minCount: 2,
			maxCount: 2,
			icon: { x: 6, y: 0 },
		},
		MASTER: {
			icon: { x: 12, y: 3 },
		},
		MINION: {
			icon: { x: 11, y: 0 },
			prereq: {
				type: "team",
				any: ["TEAM_WEREWOLF"]
			}
		},
		MORTICIAN: {
			icon: { x: 8, y: 4 },
		},
		MYSTICWOLF: {
			icon: { x: 5, y: 1 },
		},
		NOSTRADAMUS: {
			icon: { x: 6, y: 2 },
		},
		ORACLE: {
			icon: { x: 9, y: 4 },
		},
		PARANORMALINVESTIGATOR: {
			icon: { x: 6, y: 1 },
		},
		PICKPOCKET: {
			icon: { x: 8, y: 3 },
			prereq: {
				type: "tag",
				any: ["PLACES_MARKS"]
			},
		},
		PRIEST: {
			icon: { x: 9, y: 3 },
			prereq: {
				type: "tag",
				any: ["PLACES_MARKS"]
			},
		},
		PRINCE: {
			icon: { x: 7, y: 2 },
		},
		PSYCHIC: {
			icon: { x: 10, y: 4 },
		},
		RASCAL: {
			icon: { x: 11, y: 4 },
		},
		RENFIELD: {
			icon: { x: 10, y: 3 },
			prereq: {
				type: "team",
				any: ["TEAM_VAMPIRE"]
			},
		},
		REVEALER: {
			icon: { x: 7, y: 1 },
		},
		ROBBER: {
			icon: { x: 9, y: 0 },
			cardIcons: [ { x: 2, y: 5}, ],
		},
		SEER: {
			icon: { x: 0, y: 0 },
			cardIcons: [ { x: 0, y: 5}, ],
		},
		SENTINEL: {
			icon: { x: 8, y: 1 },
		},
		SQUIRE: {
			icon: { x: 8, y: 2 },
			prereq: {
				type: "team",
				any: ["TEAM_WEREWOLF"]
			},
		},
		SYNTHETICALIEN: {
			icon: { x: 12, y: 4 },
		},
		TANNER: {
			icon: { x: 4, y: 0 },
		},
		THING: {
			icon: { x: 9, y: 2 },
			cardIcons: [ { x: 5, y: 5}, ],
		},
		TROUBLEMAKER: {
			icon: { x: 2, y: 0 }, 
			cardIcons: [ { x: 1, y: 5}, ],
		},
		VAMPIRE: {
			minCount: 1,
			maxCount: 2,
			icon: { x: 13, y: 3 },
			cardIcons: [ { x: 14, y: 3}, ],
		},
		VILLAGEIDIOT: {
			icon: { x: 9, y: 1 },
		},
		VILLAGER: {
			minCount: 1,
			maxCount: 3,
			icon: { x: 7, y: 0 },
			//disabled: true,
		},
		WEREWOLF: {
			minCount: 1,
			maxCount: 2,
			icon: { x: 10, y: 0 },
			cardIcons: [ { x: 3, y: 5}, { x: 4, y: 5}, ],
		},
		WITCH: {
			icon: { x: 10, y: 1 },
		},
	};
	
	/*
	 * Lookup tables mapping tags to the roles that possess them.
	 *
	 * During initialization these mappings are inverted so each role receives a `tags` array, avoiding duplication inside individual role definitions.
	 *
	 * Tags are used both for gameplay rules and as generic metadata for filtering, prerequisites and UI behaviour.
	 */
	const TAGS = {
		DOPPELGANGER_IMMEDIATE_ACTION: [
			"ALPHAWOLF",
			"APPRENTICESEER",
			"COPYCAT",
			"CUPID",
			"DISEASED",
			"DRUNK",
			"INSTIGATOR",
			"MYSTICWOLF",
			"PARANORMALINVESTIGATOR",
			"ROBBER",
			"SEER",
			"SENTINEL",
			"THING",
			"TROUBLEMAKER",
			"VILLAGEIDIOT",
			"WITCH",		
		],

		AURA_SEER_DETECTABLE: [
			"ALIEN",
			"ALPHAWOLF",
			"APPRENTICESEER",
			"BODYSNATCHER",
			"COPYCAT",
			"DOPPELGANGER",
			"FEUDINGALIENS",
			"MARKSMAN",
			"MYSTICWOLF",
			"NOSTRADAMUS",
			"ORACLE",
			"PARANORMALINVESTIGATOR",
			"PSYCHIC",
			"ROBBER",
			"SEER",
			"SYNTHETICALIEN",
			"TROUBLEMAKER",
			"VILLAGEIDIOT",
			"WEREWOLF",
			"WITCH",		
		],

		PI_CONVERSION_ROLE: [
			"ALIEN",
			"ALPHAWOLF",
			"APPRENTICEASSASSIN",
			"APPRENTICETANNER",
			"ASSASSIN",
			"BLOB",
			"BODYSNATCHER",
			"COUNT",
			"DREAMWOLF",
			"FEUDINGALIENS",
			"MASTER",
			"MINION",
			"MORTICIAN",
			"MYSTICWOLF",
			"RENFIELD",
			"SQUIRE",
			"SYNTHETICALIEN",
			"TANNER",
			"VAMPIRE",
			"WEREWOLF",		
		],

		REVEALER_HIDDEN_ROLE: [
			"ALIEN",
			"ALPHAWOLF",
			"APPRENTICEASSASSIN",
			"APPRENTICETANNER",
			"ASSASSIN",
			"BLOB",
			"BODYSNATCHER",
			"COUNT",
			"DREAMWOLF",
			"FEUDINGALIENS",
			"MASTER",
			"MINION",
			"MORTICIAN",
			"MYSTICWOLF",
			"RENFIELD",
			"SQUIRE",
			"SYNTHETICALIEN",
			"TANNER",
			"VAMPIRE",
			"WEREWOLF",		
		],

		ORACLE_OMNISCIENCE_EXCLUDED: [
			"ALIEN",
			"ALPHAWOLF",
			"BODYSNATCHER",
			"COUNT",
			"DREAMWOLF",
			"FEUDINGALIENS",
			"MASTER",
			"MINION",
			"MYSTICWOLF",
			"RENFIELD",
			"SQUIRE",
			"SYNTHETICALIEN",
			"VAMPIRE",
			"WEREWOLF",		
		],

		CAN_CHANGE_ALIGNMENT: [
			"COPYCAT",
			"CURSED",
			"DOPPELGANGER",
			"FEUDINGALIENS",
			"LEADER",
			"NOSTRADAMUS",
			"ORACLE",
			"PARANORMALINVESTIGATOR",		
		],

		BEHOLDER_DETECTABLE: [
			"APPRENTICESEER",
			"SEER",
		],

		MARKS_ROLE: [
			"APPRENTICEASSASSIN",
			"ASSASSIN",
			"COUNT",
			"CUPID",
			"DISEASED",
			"GREMLIN",
			"INSTIGATOR",
			"MARKSMAN",
			"MASTER",
			"PICKPOCKET",
			"PRIEST",
			"RENFIELD",
			"VAMPIRE",		
		],

		PLACES_MARKS: [
			"APPRENTICEASSASSIN",
			"ASSASSIN",
			"COUNT",
			"CUPID",
			"DISEASED",
			"INSTIGATOR",
			"MASTER",
			//"PRIEST", //Ignored as he technically resets marks
			"VAMPIRE",
		],
		
		RULESET_BASIC: [ 
			"DOPPELGANGER",
			"DRUNK",
			"HUNTER",
			"INSOMNIAC",
			"MASON",
			"MINION",
			"ROBBER",
			"SEER",
			"TANNER",
			"TROUBLEMAKER",
			"VILLAGER",
			"WEREWOLF",	
		],
		RULESET_ADVANCED: [ 
			"ALPHAWOLF",
			"APPRENTICESEER",
			"APPRENTICETANNER",
			"AURASEER",
			"BEHOLDER",
			"BODYGUARD",
			"COPYCAT",
			"CURATOR",
			"CURSED",
			"DREAMWOLF",
			"EXPOSER",
			"MYSTICWOLF",
			"NOSTRADAMUS",
			"PARANORMALINVESTIGATOR",
			"PRINCE",
			"REVEALER",
			"SENTINEL",
			"SQUIRE",
			"THING",
			"VILLAGEIDIOT",
			"WITCH",
		],
		RULESET_VAMPIRE: [ 
			"APPRENTICEASSASSIN",
			"ASSASSIN",
			"COUNT",
			"CUPID",
			"DISEASED",
			"GREMLIN",
			"INSTIGATOR",
			"MARKSMAN",
			"MASTER",
			"PICKPOCKET",
			"PRIEST",
			"RENFIELD",
			"VAMPIRE",	
		],
		RULESET_ALIEN: [ 
			"ALIEN",
			"BLOB",
			"BODYSNATCHER",
			"COW",
			"EMPATH",
			"FEUDINGALIENS",
			"LEADER",
			"MORTICIAN",
			"ORACLE",
			"PSYCHIC",
			"RASCAL",
			"SYNTHETICALIEN",	
		],
		
		COMPLEXITY_EASY: [ 
			"APPRENTICESEER",
			"AURASEER",
			"BEHOLDER",
			"BODYGUARD",
			"COW",
			"DRUNK",
			"EMPATH",
			"EXPOSER",
			"HUNTER",
			"INSOMNIAC",
			"MARKSMAN",
			"MASON",
			"MYSTICWOLF",
			"PICKPOCKET",
			"PRIEST",
			"PRINCE",
			"PSYCHIC",
			"RASCAL",
			"REVEALER",
			"ROBBER",
			"SEER",
			"SENTINEL",
			"THING",
			"TROUBLEMAKER",
			"VILLAGER",
			"WEREWOLF",	
		],
		COMPLEXITY_MEDIUM: [ 
			"ALIEN",
			"ALPHAWOLF",
			"APPRENTICETANNER",
			"BLOB",
			"COPYCAT",
			"COUNT",
			"CUPID",
			"CURATOR",
			"DOPPELGANGER",
			"DREAMWOLF",
			"FEUDINGALIENS",
			"GREMLIN",
			"INSTIGATOR",
			"MASTER",
			"MINION",
			"MORTICIAN",
			"NOSTRADAMUS",
			"ORACLE",
			"PARANORMALINVESTIGATOR",
			"RENFIELD",
			"SQUIRE",
			"SYNTHETICALIEN",
			"TANNER",
			"VAMPIRE",
			"WITCH",	
		],
		COMPLEXITY_HARD: [ 
			"APPRENTICEASSASSIN",
			"ASSASSIN",
			"BODYSNATCHER",
			"CURSED",
			"DISEASED",
			"LEADER",
			"VILLAGEIDIOT",	
		],
	};
	
	/*
	 * Lookup tables used during initialization.
	 *
	 * Rather than storing the active phase on every role directly, phases are declared once here and injected into the role definitions.
	 */
	const ROLE_PHASES = {
		DAY: [ "BLOB", "BODYGUARD", "CURSED", "HUNTER", "PRINCE", "TANNER", "VILLAGER", ], 
		DUSK: [ "APPRENTICEASSASSIN", "ASSASSIN", "COUNT", "CUPID", "DISEASED", "INSTIGATOR", "MASTER", "PRIEST", "RENFIELD", "VAMPIRE", ],
		NIGHT: [ "ALIEN", "ALPHAWOLF", "APPRENTICESEER", "APPRENTICETANNER", "AURASEER", "BEHOLDER", "BODYSNATCHER", "COPYCAT", "COW", "CURATOR", "DOPPELGANGER", "DREAMWOLF", "DRUNK", "EMPATH", "EXPOSER", "FEUDINGALIENS", "GREMLIN", "INSOMNIAC", "LEADER", "MARKSMAN", "MASON", "MINION", "MORTICIAN", "MYSTICWOLF", "NOSTRADAMUS", "ORACLE", "PARANORMALINVESTIGATOR", "PICKPOCKET", "PSYCHIC", "RASCAL", "REVEALER", "ROBBER", "SEER", "SENTINEL", "SQUIRE", "SYNTHETICALIEN", "THING", "TROUBLEMAKER", "VILLAGEIDIOT", "WEREWOLF", "WITCH", ], 	
	};
	
	/*
	 * Default team membership for each role.
	 *
	 * Some roles may later change alignment during gameplay, but this defines their starting affiliation.
	 */
	const ROLE_TEAMS = {
		TEAM_ALIEN: [ "ALIEN", "BODYSNATCHER", "FEUDINGALIENS", ], 
		TEAM_MINORITY: [ "APPRENTICEASSASSIN", "APPRENTICETANNER", "ASSASSIN", "BLOB", "MINION", "MORTICIAN", "RENFIELD", "SQUIRE", "SYNTHETICALIEN", "TANNER", ], 
		TEAM_VAMPIRE: [ "COUNT", "MASTER", "VAMPIRE", ],
		TEAM_VILLAGE: [ "APPRENTICESEER", "AURASEER", "BEHOLDER", "BODYGUARD", "COPYCAT", "COW", "CUPID", "CURATOR", "CURSED", "DISEASED", "DOPPELGANGER", "DRUNK", "EMPATH", "EXPOSER", "GREMLIN", "HUNTER", "INSOMNIAC", "INSTIGATOR", "LEADER", "MARKSMAN", "MASON", "NOSTRADAMUS", "ORACLE", "PARANORMALINVESTIGATOR", "PICKPOCKET", "PRIEST", "PRINCE", "PSYCHIC", "RASCAL", "REVEALER", "ROBBER", "SEER", "SENTINEL", "THING", "TROUBLEMAKER", "VILLAGEIDIOT", "VILLAGER", "WITCH", ], 
		TEAM_WEREWOLF: [ "ALPHAWOLF", "DREAMWOLF", "MYSTICWOLF", "WEREWOLF", ], 	
	};



	/* =========================
	   Initialization
	   ========================= */

	/*
	 * Converts the declarative data above into the final runtime representation.
	 *
	 * Responsibilities include:
	 *   - injecting derived properties
	 *   - validating data consistency
	 *   - generating localization keys
	 *   - disabling invalid definitions
	 *   - freezing the finished objects
	 */
	function _init() {
		_applyTags();
		_applyTeams();
		_applyPhases();
		_finalizeData();
		_deepFreeze(ROLES);
		_deepFreeze(TOKENS);
	}

	// Injects tags into the role definitions, from TAGS. Warns and skips (rather than throwing) on a TAGS entry naming an unknown role ID.
	function _applyTags() {
		Object.values(ROLES).forEach(r => r.tags = []);

		for (const [tag, roles] of Object.entries(TAGS)) {
			for (const id of roles) {
				if (!ROLES[id]) {
					console.warn(`Unknown role in TAGS: ${tag} → ${id}`);
					continue;
				}
				ROLES[id].tags.push(tag);
			}
		}
	}

	// Injects teams into the role definitions, from ROLE_TEAMS. Warns and skips on an unknown role ID, same as _applyTags.
	function _applyTeams() {
		for (const [team, roles] of Object.entries(ROLE_TEAMS)) {
			for (const id of roles) {
				if (!ROLES[id]) {
					console.warn(`Unknown role in TEAM: ${team} → ${id}`);
					continue;
				}
				ROLES[id].team = team;
			}
		}
	}

	// Injects active phase into the role definitions, from ROLE_PHASES. Warns and skips on an unknown role ID, same as _applyTags.
	function _applyPhases() {
		for (const [phase, roles] of Object.entries(ROLE_PHASES)) {
			for (const id of roles) {
				if (!ROLES[id]) {
					console.warn(`Unknown role in PHASE: ${phase} → ${id}`);
					continue;
				}
				ROLES[id].phase = phase;
			}
		}
	}

	/*
	 * Injects generic, derived data into every role and token definition and disables any that fail a basic sanity check - called once
	 * during _init(), after _applyTags/_applyTeams/_applyPhases have already populated tags/team/phase.
	 *
	 * For roles: assigns id/nameKey/abilityKey, defaults minCount/maxCount to 1, and disables (with a console warning identifying which
	 * check failed) any role missing tags, team, or phase, or lacking a recognized ruleset/complexity tag.
	 *
	 * For tokens: adds every TEAM_VAMPIRE role to the vampire mark's usedBy list, assigns id/nameKey/abilityKey, and disables any token
	 * whose prerequisites aren't satisfiable by the currently-enabled role set (see isTokenActive).
	 *
	 * No parameters, no return value - mutates ROLES/TOKENS in place.
	 */
	function _finalizeData() {
		// Finalize roles
		for (const [key, role] of Object.entries(ROLES)) {
			role.id = key;
			role.nameKey = "ROLE_" + key;
			role.abilityKey = "UI_ABILITY_" + key;

			role.minCount = role.minCount ?? 1;
			role.maxCount = role.maxCount ?? 1;

			if (!role.tags) {
				console.warn("Role " + role.id + " missing tags, disabling role");
				role.disabled = true;
				role.tags = [];
			}

			if (!role.team) {
				console.warn("Role " + role.id + " missing team, disabling role");
				role.disabled = true;
				role.team = "TEAM_VILLAGE";
			}

			if (!role.phase) {
				console.warn("Role " + role.id + " missing phase, disabling role");
				role.disabled = true;
				role.phase = "DAY";
			}

			if (!hasAnyTag(role, "RULESET_BASIC", "RULESET_ADVANCED", "RULESET_ALIEN", "RULESET_VAMPIRE")) {
				role.disabled = true;
				console.warn("Role " + role.id + " missing ruleset, disabling role");
			}

			if (!hasAnyTag(role, "COMPLEXITY_EASY", "COMPLEXITY_MEDIUM", "COMPLEXITY_HARD")) {
				role.disabled = true;
				console.warn("Role " + role.id + " missing complexity, disabling role");
			}

			if (role.disabled) {
				console.log("Role disabled: " + role.id);
			}
		}

		// Finalize tokens - add the vampire team to the vampire mark's usedBy list
		Object.values(ROLES).forEach(role => {
			if (isTeam(role, "TEAM_VAMPIRE"))
				TOKENS.MARK_VAMPIRE.usedBy.push(role.id);
		});

		const allEnabledRoles = getAllEnabled().map(role => role.id);
		for (const [tokenId, token] of Object.entries(TOKENS)) {
			token.id = tokenId;
			token.nameKey = "TOKEN_" + tokenId;
			token.abilityKey = "UI_ABILITY_" + tokenId;

			if (!isTokenActive(tokenId, allEnabledRoles)) {
				token.disabled = true;
			}

			//TODO: Sanity check on token fields, disable on failure
		}
	}

	/*
	 * Recursively locks obj and every nested plain-object value as immutable via Object.freeze; skips a value that's already frozen (so
	 * re-freezing shared/repeated references is harmless). No return value - obj is frozen in place.
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

	// Takes a role definition object or a role ID and returns the corresponding role definition object, or undefined if the ID isn't recognized.
	function _getRole(role) {
		return typeof role === "object" ? role : ROLES[role];
	}

	// Takes a token definition object or a token ID and returns the corresponding token definition object, or undefined if the ID isn't recognized.
	function _getToken(token) {
		return typeof token === "object" ? token : TOKENS[token];
	}

	/*
	 * Evaluates a prerequisite tree against a collection of selected roles.
	 *
	 * Nodes are either:
	 *
	 *   Leaf:
	 *     { type: "role"|"team"|"tag", any:[...] }
	 *     { type: "role"|"team"|"tag", all:[...] }
	 *
	 *   Logical:
	 *     { any: [ child1, child2, ... ] }
	 *     { all: [ child1, child2, ... ] }
	 *
	 * Trees may be nested arbitrarily to express complex eligibility rules.
	 *
	 *   node    - the (sub)tree to evaluate, at any depth; a role's or token's own top-level `prereq` is a node like any other.
	 *   roleIds - array of currently selected role IDs to test the tree against.
	 *
	 * Returns true if the tree is satisfied by roleIds, false otherwise - including for a malformed node (both/neither any-or-all,
	 * an unrecognized leaf `type`, or a leaf missing its value array), which is logged via console.warn rather than thrown.
	 */
	function _evaluatePrerequisiteNode(node, roleIds) {
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
						? values.every(r => roleIds.includes(r))
						: values.some(r => roleIds.includes(r));
				case "team":
					return node.all
						? values.every(team => roleIds.some(r => ROLES[r].team === team))
						: values.some(team => roleIds.some(r => ROLES[r].team === team));
				case "tag":
					return node.all
						? values.every(tag => roleIds.some(r => hasTag(r, tag)))
						: values.some(tag => roleIds.some(r => hasTag(r, tag)));
				default:
					console.warn("Unknown prereq type:", node.type);
					return false;
			}
		}

		// --- Logical nodes AFTER ---
		if (hasAny) {
			return node.any.some(child => _evaluatePrerequisiteNode(child, roleIds));
		}

		if (hasAll) {
			return node.all.every(child => _evaluatePrerequisiteNode(child, roleIds));
		}

		return false;
	}
	


	/* =========================
	   Public functions
	   ========================= */
	
	/*
	 * Public API.
	 *
	 * Most functions accept either a role/token ID string or the corresponding definition object for convenience.
	 */

	// -- Role functions --

	// Returns the x/y coordinates for the role character sprite in the role icon sprite sheet
	function getPortraitIcon(role) {
		return _getRole(role).icon;
	}

	// Returns an array of x/y coordinates for all the card art sprites in the card icon sprite sheet
	function getCardIcons(role) {
		const roleEntry = _getRole(role);
		return [ roleEntry.icon, ...(roleEntry.cardIcons ?? []) ];
	}

	// Returns the definitions of all currently enabled roles
	function getAllEnabled() {
		return Object.values(ROLES).filter(isEnabled);
	}

	// Returns the min and max number of instances allowed for a role
	function getMinMax(role) {
		const roleEntry = _getRole(role);
		return { minCount: roleEntry.minCount, maxCount: roleEntry.maxCount };
	}

	// Returns the localization name key of the role
	function getNameKey(role) {
		const roleEntry = _getRole(role);
		return roleEntry.nameKey;
	}

	// Returns true if a role has the specified tag, else false
	function hasTag(role, tag) {
		return _getRole(role)?.tags?.includes(tag) || false;
	}

	// Returns true if a role has any of the specified tags, else false
	function hasAnyTag(role, ...tags) {
		return tags.some(t => hasTag(role, t));
	}

	// Returns true if a role has all of the specified tags, else false
	function hasAllTags(role, ...tags) {
		return tags.every(t => hasTag(role, t));
	}

	// Returns true if a role belongs to the specified team, else false
	function isTeam(role, team) {
		return _getRole(role)?.team === team;
	}

	// Returns true if a role belongs to the specified active phase, else false
	function isPhase(role, phase) {
		return _getRole(role)?.phase === phase || false;
	}

	// Returns true if a role is enabled, else false
	function isEnabled(role) {
		return !_getRole(role)?.disabled;
	}

	/*
	 * Calculates and returns the number of players supported by a role selection, represented as a roleId -> count map.
	 *
	 * Every game always reserves 3 unused cards in the center regardless of player count, so the total card count starts 3 short of the player
	 * count. Some roles (e.g. Alpha Wolf) contribute extra cards to the center beyond their own instance — `extraCenterCards` — so each of
	 * those instances counts for one player less. The result is floored at 0 so a selection that's entirely center-fodder (e.g. no roles selected
	 * yet) never reports a negative player count.
	 */
	function calculatePlayerCount(roleCounts) {
		const CENTER_CARDS = 3;
		let playerCount = 0 - CENTER_CARDS;

		for (const [roleId, count] of roleCounts.entries()) {
			playerCount += count - (ROLES[roleId].extraCenterCards ?? 0) * count;
		}

		return Math.max(0, playerCount);
	}

	// Checks whether a role is eligible for selection, based on the provided role selection configuration, represented as a roleId -> count map
	function isSelectable(role, roleCounts) {
		const roleEntry = _getRole(role);
		const selectedRoleIds = Array.from(roleCounts.keys());
		return roleEntry.prereq ? _evaluatePrerequisiteNode(roleEntry.prereq, selectedRoleIds) : true;
	}

	// -- Token functions --

	// Returns the definitions of all currently enabled tokens
	function getAllEnabledTokens() {
		return Object.values(TOKENS).filter(t => !t.disabled);
	}

	// Returns the x/y coordinates for the token sprite in the token icon sprite sheet
	function getTokenIcon(token) {
		return _getToken(token).icon;
	}

	// Returns an array of all role IDs that use a provided token
	function getRolesUsingToken(token) {
		const tokenEntry = _getToken(token);
		return tokenEntry.usedBy;
	}

	// Returns an array of all tokens used by a provided role
	function getTokensUsedByRole(role) {
		const roleEntry = _getRole(role);
		return getAllEnabledTokens().filter(t => t.usedBy.includes(roleEntry.id));
	}

	// Returns true if a provided token is used by the provided role
	function isTokenUsedBy(token, role) {
		const roleId = _getRole(role).id;
		return getRolesUsingToken(token).includes(roleId);
	}

	// Checks whether a token is currently in play, based on the provided role selection configuration represented as an array of Role IDs
	function isTokenActive(token, selectedRoleIds) {
		const tokenEntry = _getToken(token);
		return tokenEntry.prereq ? _evaluatePrerequisiteNode(tokenEntry.prereq, selectedRoleIds) : true;
	}



	return {
		calculatePlayerCount,
		isEnabled,
		isSelectable,
		getAllEnabled,
		getCardIcons,
		getMinMax,
		getNameKey,
		getPortraitIcon,
		hasAllTags,
		hasAnyTag,
		hasTag,
		isPhase,
		isTeam,
		
		getAllEnabledTokens,
		getTokenIcon,
		getRolesUsingToken,
		getTokensUsedByRole,
		isTokenUsedBy,
		isTokenActive,
	};
	
})();
