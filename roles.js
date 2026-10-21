/*
 * Central registry for all role and token definitions.
 *
 * This module contains the metadata describing every role and token in the game, builds the finalized definitions during initialization,
 * validates the data, and exposes helper functions used throughout the application. The exported objects are frozen after initialization
 * and should be treated as read-only.
 */
const Roles = (() => {

	/* =========================
	   Data
	   ========================= */

	/*
	 * Definitions of all tokens. The object key is the token ID.
	 *
	 * Authored fields:
	 *   type     - token category used for grouping.
	 *   icon     - { x, y } cell in the token sprite sheet.
	 *   usedBy   - role IDs that can directly place this token. MARK_VAMPIRE is populated automatically for all TEAM_VAMPIRE roles.
	 *   prereq   - prerequisite tree controlling when the token is active. See _evaluatePrerequisiteNode() for syntax.
	 *   disabled - optional flag that prevents the token from being used. Initialization may also disable tokens whose prerequisites cannot
	 *              be satisfied.
	 *
	 * Derived fields (id, nameKey, abilityKey) are added during initialization.
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
	 * Definitions of all roles. The object key is the role ID. Only role-specific data is authored here. Shared metadata is supplied by the
	 * lookup tables below and added during initialization.
	 *
	 * Authored fields:
	 *   icon             - { x, y } cell in the role sprite sheet.
	 *   cardIcons        - single object or array of { x, y } cells in the card sprite sheet.
	 *   minCount         - minimum number of instances when the role is selected. Defaults to 1.
	 *   maxCount         - maximum number of instances. Defaults to 1.
	 *   prereq           - prerequisite tree that must be satisfied for the role to be selectable. See _evaluatePrerequisiteNode().
	 *   extraCenterCards - additional center cards contributed by each instance, reducing the calculated player count.
	 *   disabled         - optional flag that prevents the role from being used. Initialization may also disable incomplete definitions.
	 *   subRoles         - optional pseudo-role IDs used only by Rules when expanding a composite role for narration. The parent remains
	 *                      one role for all logic.
	 *
	 * Derived fields (id, nameKey, abilityKey, tags, team, phase) are added during initialization.
	 */
	const ROLES = {
		ALIEN: {
			minCount: 1,
			maxCount: 2,
			icon: { x: 0, y: 4 },
			cardIcon: [ { x: 0, y: 3 }, { x: 0, y: 4 } ],
		},
		ALPHAWOLF: {
			extraCenterCards: 1,
			icon: { x: 0, y: 1 },
			cardIcon: { x: 7, y: 1 },
			prereq: {
				type: "role",
				any: ["WEREWOLF", "DREAMWOLF", "MYSTICWOLF"]
			}
		},
		APPRENTICEASSASSIN: {
			icon: { x: 0, y: 3 },
			cardIcon: { x: 11, y: 2 },
			prereq: {
				type: "role",
				any: ["ASSASSIN"]
			},
		},
		APPRENTICESEER: {
			icon: { x: 1, y: 1 },
			cardIcon: { x: 11, y: 0 },
		},
		APPRENTICETANNER: {
			icon: { x: 0, y: 2 },
			cardIcon: { x: 11, y: 1 },
			prereq: {
				type: "role",
				any: ["TANNER"]
			}
		},
		ASSASSIN: {
			icon: { x: 1, y: 3 },
			cardIcon: { x: 2, y: 3 },
		},
		AURASEER: {
			icon: { x: 1, y: 2 },
			cardIcon: { x: 9, y: 2 },
			prereq: {
				type: "tag",
				any: ["AURA_SEER_DETECTABLE"]
			}
		},
		BEHOLDER: {
			icon: { x: 2, y: 2 },
			cardIcon: { x: 2, y: 4 },
			prereq: {
				type: "role",
				any: ["SEER", "APPRENTICESEER"]
			},
		},
		BLOB: { 
			icon: { x: 4, y: 4 },
			cardIcon: { x: 8, y: 3 },
		},
		BODYGUARD: { 
			icon: { x: 2, y: 1 }, 
			cardIcon: { x: 6, y: 2 },
		},
		BODYSNATCHER: { 
			icon: { x: 3, y: 2 },
			cardIcon: { x: 0, y: 5 },
		},
		COPYCAT: {
			icon: { x: 2, y: 3 },
			cardIcon: { x: 10, y: 2 },
		},
		COUNT: {
			icon: { x: 11, y: 3 },
			cardIcon: { x: 6, y: 5 },
		},
		COW: {
			icon: { x: 5, y: 4 },
			cardIcon: { x: 8, y: 4 },
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
			cardIcon: { x: 4, y: 3 },
		},
		CURATOR: {
			icon: { x: 3, y: 1 },
			cardIcon: { x: 6, y: 0 },
		},
		CURSED: {
			icon: { x: 4, y: 2 },
			cardIcon: { x: 2, y: 5 },
		},
		DISEASED: {
			icon: { x: 4, y: 3 },
			cardIcon: { x: 4, y: 4 },
		},
		DOPPELGANGER: {
			icon: { x: 1, y: 0 },
			cardIcon: { x: 0, y: 0 },
		},
		DREAMWOLF: {
			icon: { x: 4, y: 1 },
			cardIcon: { x: 6, y: 1 },
		},
		DRUNK: {
			icon: { x: 3, y: 0 },
			cardIcon: { x: 2, y: 0 },
		},
		EMPATH: {
			icon: { x: 5, y: 2 },
			cardIcon: { x: 3, y: 3 },
		},
		EXPOSER: {
			icon: { x: 6, y: 4 },
			cardIcon: { x: 10, y: 1 },
		},
		FEUDINGALIENS: {
			minCount: 2,
			maxCount: 2,
			icon: { x: 2, y: 4 },
			cardIcon: [ { x: 1, y: 3 }, { x: 1, y: 4 } ],
			subRoles: [ "FEUDINGALIENS_GROOB", "FEUDINGALIENS_ZERB" ],
		},
		GREMLIN: {
			icon: { x: 5, y: 3 },
			cardIcon: { x: 4, y: 5 },
			prereq: {
				type: "tag",
				any: ["PLACES_MARKS"]
			},
		},
		HUNTER: {
			icon: { x: 5, y: 0 },
			cardIcon: { x: 2, y: 1 },
		},
		INSOMNIAC: {
			icon: { x: 8, y: 0 },
			cardIcon: { x: 0, y: 1 },
		},
		INSTIGATOR: {
			icon: { x: 6, y: 3 },
			cardIcon: { x: 5, y: 3 },
		},
		LEADER: {
			icon: { x: 7, y: 4 },
			cardIcon: { x: 8, y: 5 },
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
			cardIcon: { x: 5, y: 4 },
			prereq: {
				type: "tag",
				any: ["PLACES_MARKS"]
			},
		},
		MASON: {
			minCount: 2,
			maxCount: 2,
			icon: { x: 6, y: 0 },
			cardIcon: [ { x: 5, y: 0 }, { x: 5, y: 1 } ],
		},
		MASTER: {
			icon: { x: 12, y: 3 },
			cardIcon: { x: 7, y: 3 },
		},
		MINION: {
			icon: { x: 11, y: 0 },
			cardIcon: { x: 1, y: 1 },
			prereq: {
				type: "team",
				any: ["TEAM_WEREWOLF"]
			}
		},
		MORTICIAN: {
			icon: { x: 8, y: 4 },
			cardIcon: { x: 10, y: 0 },
		},
		MYSTICWOLF: {
			icon: { x: 5, y: 1 },
			cardIcon: { x: 7, y: 0 },
		},
		NOSTRADAMUS: {
			icon: { x: 6, y: 2 },
			cardIcon: { x: 3, y: 4 },
		},
		ORACLE: {
			icon: { x: 9, y: 4 },
			cardIcon: { x: 8, y: 2 },
		},
		PARANORMALINVESTIGATOR: {
			icon: { x: 6, y: 1 },
			cardIcon: { x: 8, y: 1 },
		},
		PICKPOCKET: {
			icon: { x: 8, y: 3 },
			cardIcon: { x: 5, y: 5 },
			prereq: {
				type: "tag",
				any: ["PLACES_MARKS"]
			},
		},
		PRIEST: {
			icon: { x: 9, y: 3 },
			cardIcon: { x: 6, y: 3 },
			prereq: {
				type: "tag",
				any: ["PLACES_MARKS"]
			},
		},
		PRINCE: {
			icon: { x: 7, y: 2 },
			cardIcon: { x: 9, y: 0 },
		},
		PSYCHIC: {
			icon: { x: 10, y: 4 },
			cardIcon: { x: 9, y: 3 },
		},
		RASCAL: {
			icon: { x: 11, y: 4 },
			cardIcon: { x: 9, y: 4 },
		},
		RENFIELD: {
			icon: { x: 10, y: 3 },
			cardIcon: { x: 6, y: 4 },
			prereq: {
				type: "team",
				any: ["TEAM_VAMPIRE"]
			},
		},
		REVEALER: {
			icon: { x: 7, y: 1 },
			cardIcon: { x: 5, y: 2 },
		},
		ROBBER: {
			icon: { x: 9, y: 0 },
			cardIcon: [ { x: 0, y: 2 }, { x: 9, y: 5 } ],
		},
		SEER: {
			icon: { x: 0, y: 0 },
			cardIcon: [ { x: 1, y: 2 }, { x: 10, y: 3 } ],
		},
		SENTINEL: {
			icon: { x: 8, y: 1 },
			cardIcon: { x: 4, y: 2 },
		},
		SQUIRE: {
			icon: { x: 8, y: 2 },
			cardIcon: { x: 3, y: 5 },
			prereq: {
				type: "team",
				any: ["TEAM_WEREWOLF"]
			},
		},
		SYNTHETICALIEN: {
			icon: { x: 12, y: 4 },
			cardIcon: { x: 1, y: 5 },
		},
		TANNER: {
			icon: { x: 4, y: 0 },
			cardIcon: { x: 2, y: 2 },
		},
		THING: {
			icon: { x: 9, y: 2 },
			cardIcon: [ { x: 11, y: 4 }, { x: 9, y: 1 } ],
		},
		TROUBLEMAKER: {
			icon: { x: 2, y: 0 }, 
			cardIcon: [ { x: 1, y: 0 }, { x: 10, y: 4 } ],
		},
		VAMPIRE: {
			minCount: 1,
			maxCount: 2,
			icon: { x: 13, y: 3 },
			cardIcon: [ { x: 7, y: 4 }, { x: 7, y: 5 } ],
		},
		VILLAGEIDIOT: {
			icon: { x: 9, y: 1 },
			cardIcon: { x: 7, y: 2 },
		},
		VILLAGER: {
			minCount: 1,
			maxCount: 3,
			icon: { x: 7, y: 0 },
			cardIcon: [ { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 } ],
		},
		WEREWOLF: {
			minCount: 1,
			maxCount: 2,
			icon: { x: 10, y: 0 },
			cardIcons: [ { x: 3, y: 5}, { x: 4, y: 5}, ],
			cardIcon: [ { x: 10, y: 5 }, { x: 11, y: 3 }, { x: 4, y: 0 }, { x: 4, y: 1 } ],
		},
		WITCH: {
			icon: { x: 10, y: 1 },
			cardIcon: { x: 8, y: 0 },
		},
	};

	// Maps tags to role IDs. Initialization converts this into each role's `tags` array. Tags are used by rules, prerequisites, filtering, and UI behaviour.
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

	// Maps each phase to the roles that act during it. Initialization adds the resulting phase to each role as its `phase` property.
	const ROLE_PHASES = {
		DAY: [ "BLOB", "BODYGUARD", "CURSED", "HUNTER", "PRINCE", "TANNER", "VILLAGER", ], 
		DUSK: [ "APPRENTICEASSASSIN", "ASSASSIN", "COUNT", "CUPID", "DISEASED", "INSTIGATOR", "MASTER", "PRIEST", "RENFIELD", "VAMPIRE", ],
		NIGHT: [ "ALIEN", "ALPHAWOLF", "APPRENTICESEER", "APPRENTICETANNER", "AURASEER", "BEHOLDER", "BODYSNATCHER", "COPYCAT", "COW", "CURATOR", "DOPPELGANGER", "DREAMWOLF", "DRUNK", "EMPATH", "EXPOSER", "FEUDINGALIENS", "GREMLIN", "INSOMNIAC", "LEADER", "MARKSMAN", "MASON", "MINION", "MORTICIAN", "MYSTICWOLF", "NOSTRADAMUS", "ORACLE", "PARANORMALINVESTIGATOR", "PICKPOCKET", "PSYCHIC", "RASCAL", "REVEALER", "ROBBER", "SEER", "SENTINEL", "SQUIRE", "SYNTHETICALIEN", "THING", "TROUBLEMAKER", "VILLAGEIDIOT", "WEREWOLF", "WITCH", ], 	
	};

	// Maps each default team to its roles. Initialization adds the resulting team to each role as its `team` property. Some roles may change alignment during gameplay.
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

	/**
	 * Builds the finalized role and token definitions from the authored data.
	 *
	 * Adds derived tags, teams, phases and localization keys, applies defaults, disables invalid or unusable definitions, and freezes the
	 * final objects.
	 */
	function _init() {
		_applyTags();
		_applyTeams();
		_applyPhases();
		_finalizeData();
		_deepFreeze(ROLES);
		_deepFreeze(TOKENS);
	}

	/**
	 * Populates each role's `tags` array from the TAGS lookup table. Unknown role IDs in TAGS are ignored and logged as warnings.
	 */
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

	/**
	 * Populates each role's `team` property from ROLE_TEAMS. Unknown role IDs in ROLE_TEAMS are ignored and logged as warnings.
	 */
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

	/**
	 * Populates each role's `phase` property from ROLE_PHASES. Unknown role IDs in ROLE_PHASES are ignored and logged as warnings.
	 */
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

	/**
	 * Completes and validates the role and token definitions before they are frozen.
	 *
	 * For roles, assigns derived IDs and localization keys, applies default instance counts, and disables definitions missing required
	 * metadata or a ruleset/complexity tag.
	 *
	 * For tokens, assigns derived IDs and localization keys, populates MARK_VAMPIRE's `usedBy` list, and disables tokens whose
	 * prerequisites cannot be satisfied.
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

	_init();


	/* =========================
	   Private functions
	   ========================= */

	/**
	 * Resolves a role ID or role definition to a role definition.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @returns {object|undefined} The corresponding role definition, or undefined if the ID is not recognized.
	 */
	function _getRole(role) {
		return typeof role === "object" ? role : ROLES[role];
	}

	/**
	 * Resolves a token ID or token definition to a token definition.
	 *
	 * @param {string|object} token - Token ID or token definition.
	 * @returns {object|undefined} The corresponding token definition, or undefined if the ID is not recognized.
	 */
	function _getToken(token) {
		return typeof token === "object" ? token : TOKENS[token];
	}

	/**
	 * Evaluates a prerequisite tree against a set of selected roles.
	 *
	 * A leaf node has the form:
	 *   { type: "role"|"team"|"tag", any: [...] }
	 *   { type: "role"|"team"|"tag", all: [...] }
	 *
	 * A logical node has the form:
	 *   { any: [ ... ] }
	 *   { all: [ ... ] }
	 *
	 * Logical nodes may contain other prerequisite nodes recursively. Malformed nodes are treated as unsatisfied and logged as warnings.
	 *
	 * @param {object} node - Prerequisite tree or subtree to evaluate.
	 * @param {string[]} roleIds - IDs of roles currently selected.
	 * @returns {boolean} True if the prerequisite is satisfied; otherwise false.
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

	// -- Role functions --

	/**
	 * Returns the sprite-sheet coordinates for a role's portrait.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @returns {{x: number, y: number}} Portrait sprite coordinates.
	 */
	function getPortraitIcon(role) {
		return _getRole(role).icon;
	}

	/**
	 * Returns the sprite-sheet coordinates for all card artwork for a role. The role's primary `icon` is always the first entry.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @returns {{x: number, y: number}[]} Card sprite coordinates.
	 */
	function getCardIcons(role) {
		const cardIcon = _getRole(role)?.cardIcon;
		return cardIcon == null ? [] : Array.isArray(cardIcon) ? [...cardIcon] : [cardIcon];
	}

	/**
	 * Returns all roles that are currently enabled.
	 *
	 * @returns {object[]} Enabled role definitions.
	 */
	function getAllEnabled() {
		return Object.values(ROLES).filter(isEnabled);
	}

	/**
	 * Returns the minimum and maximum number of instances allowed for a role.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @returns {{minCount: number, maxCount: number}} Allowed instance range.
	 */
	function getMinMax(role) {
		const roleEntry = _getRole(role);
		return { minCount: roleEntry.minCount, maxCount: roleEntry.maxCount };
	}

	/**
	 * Returns the localization key used for a role's name.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @returns {string} Role name localization key.
	 */
	function getNameKey(role) {
		const roleEntry = _getRole(role);
		return roleEntry.nameKey;
	}

	/**
	 * Returns the pseudo-roles associated with a composite role.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @returns {string[]|null} Sub-role IDs, or null if the role has none.
	 */
	function getSubRoles(role) {
		const roleEntry = _getRole(role);
		return roleEntry.subRoles ?? null;
	}

	/**
	 * Tests whether a role has a specific tag.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @param {string} tag - Tag to test for.
	 * @returns {boolean} True if the role has the tag.
	 */
	function hasTag(role, tag) {
		return _getRole(role)?.tags?.includes(tag) || false;
	}

	/**
	 * Tests whether a role has at least one of the specified tags.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @param {...string} tags - Tags to test for.
	 * @returns {boolean} True if the role has any of the tags.
	 */
	function hasAnyTag(role, ...tags) {
		return tags.some(t => hasTag(role, t));
	}

	/**
	 * Tests whether a role has all of the specified tags.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @param {...string} tags - Tags to test for.
	 * @returns {boolean} True if the role has every specified tag.
	 */
	function hasAllTags(role, ...tags) {
		return tags.every(t => hasTag(role, t));
	}

	/**
	 * Tests whether a role belongs to a specified team.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @param {string} team - Team ID to test for.
	 * @returns {boolean} True if the role belongs to the team.
	 */
	function isTeam(role, team) {
		return _getRole(role)?.team === team;
	}

	/**
	 * Tests whether a role acts during a specified phase.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @param {string} phase - Phase ID to test for.
	 * @returns {boolean} True if the role belongs to the phase.
	 */
	function isPhase(role, phase) {
		return _getRole(role)?.phase === phase || false;
	}

	/**
	 * Tests whether a role is enabled.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @returns {boolean} True if the role exists and is not disabled.
	 */
	function isEnabled(role) {
		const roleEntry = _getRole(role);

		if (roleEntry)
			return !roleEntry.disabled;

		return false;
	}

	/**
	 * Calculates the number of players supported by a role selection.
	 *
	 * Three cards are always reserved in the center. Each instance with `extraCenterCards` contributes fewer players accordingly.
	 *
	 * @param {Map<string, number>} roleCounts - Selected role IDs and instance counts.
	 * @returns {number} Calculated player count, never below zero.
	 */
	function calculatePlayerCount(roleCounts) {
		const CENTER_CARDS = 3;
		let playerCount = 0 - CENTER_CARDS;

		for (const [roleId, count] of roleCounts.entries()) {
			playerCount += count - (ROLES[roleId].extraCenterCards ?? 0) * count;
		}

		return Math.max(0, playerCount);
	}

	/**
	 * Tests whether a role's prerequisites are satisfied by the current selection.
	 *
	 * This checks the role's `prereq` tree only; it does not check the role's `disabled` state.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @param {Map<string, number>} roleCounts - Currently selected role IDs and counts.
	 * @returns {boolean} True if the role's prerequisite tree is satisfied, or no prerequisites exist.
	 */
	function isSelectable(role, roleCounts) {
		const roleEntry = _getRole(role);
		const selectedRoleIds = Array.from(roleCounts.keys());
		return roleEntry.prereq ? _evaluatePrerequisiteNode(roleEntry.prereq, selectedRoleIds) : true;
	}

	// -- Token functions --

	/**
	 * Returns all tokens that are currently enabled.
	 *
	 * @returns {object[]} Enabled token definitions.
	 */
	function getAllEnabledTokens() {
		return Object.values(TOKENS).filter(t => !t.disabled);
	}

	/**
	 * Returns the sprite-sheet coordinates for a token.
	 *
	 * @param {string|object} token - Token ID or token definition.
	 * @returns {{x: number, y: number}} Token sprite coordinates.
	 */
	function getTokenIcon(token) {
		return _getToken(token).icon;
	}

	/**
	 * Returns the role IDs that directly use a token.
	 *
	 * @param {string|object} token - Token ID or token definition.
	 * @returns {string[]} Role IDs that use the token.
	 */
	function getRolesUsingToken(token) {
		const tokenEntry = _getToken(token);
		return tokenEntry.usedBy;
	}

	/**
	 * Returns the enabled tokens used by a role.
	 *
	 * @param {string|object} role - Role ID or role definition.
	 * @returns {object[]} Enabled token definitions used by the role.
	 */
	function getTokensUsedByRole(role) {
		const roleEntry = _getRole(role);
		return getAllEnabledTokens().filter(t => t.usedBy.includes(roleEntry.id));
	}

	/**
	 * Tests whether a token is directly used by a role.
	 *
	 * @param {string|object} token - Token ID or token definition.
	 * @param {string|object} role - Role ID or role definition.
	 * @returns {boolean} True if the role uses the token.
	 */
	function isTokenUsedBy(token, role) {
		const roleId = _getRole(role).id;
		return getRolesUsingToken(token).includes(roleId);
	}

	/**
	 * Tests whether a token's prerequisites are satisfied by the selected roles.
	 *
	 * @param {string|object} token - Token ID or token definition.
	 * @param {string[]} selectedRoleIds - IDs of the currently selected roles.
	 * @returns {boolean} True if the token is active for the selection.
	 */
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
		getSubRoles,
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
