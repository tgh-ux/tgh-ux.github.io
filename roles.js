const ROLES = {
	ALIEN: {
		minCount: 1,
		maxCount: 2,
		icon: { x: 0, y: 4 },
	},
	ALPHAWOLF: {
		extraCenterCards: 1,
		icon: { x: 0, y: 1 },
	},
	APPRENTICEASSASSIN: {
		icon: { x: 0, y: 3 },
		prereq: {
			type: "role",
			any: ["ASSASSIN"]
		},
	},
	APPRENTICESEER: { icon: { x: 1, y: 1 } },
	APPRENTICETANNER: {
		icon: { x: 0, y: 2 },
		prereq: {
			type: "role",
			any: ["TANNER"]
		}
	},
	ASSASSIN: { icon: { x: 1, y: 3 }, },
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
	BLOB: { icon: { x: 4, y: 4 }, },
	BODYGUARD: { icon: { x: 2, y: 1 } },
	BODYSNATCHER: { icon: { x: 3, y: 2 } },
	COPYCAT: { icon: { x: 2, y: 3 } },
	COUNT: { icon: { x: 11, y: 3 }, },
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
	CUPID: { icon: { x: 3, y: 3 }, },
	CURATOR: { icon: { x: 3, y: 1 } },
	CURSED: { icon: { x: 4, y: 2 } },
	DISEASED: { icon: { x: 4, y: 3 }, },
	DOPPELGANGER: { icon: { x: 1, y: 0 } },
	DREAMWOLF: { icon: { x: 4, y: 1 } },
	DRUNK: { icon: { x: 3, y: 0 } },
	EMPATH: { icon: { x: 5, y: 2 }, },
	EXPOSER: { icon: { x: 6, y: 4 } },
	FEUDINGALIENS: {
		minCount: 2,
		maxCount: 2,
		icon: { x: 2, y: 4 },
	},
	GREMLIN: {
		icon: { x: 5, y: 3 },
		prereq: {
			type: "tag",
			any: ["PLACES_MARKS"]
		},
	},
	HUNTER: { icon: { x: 5, y: 0 } },
	INSOMNIAC: { icon: { x: 8, y: 0 } },
	INSTIGATOR: { icon: { x: 6, y: 3 }, },
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
	MASTER: { icon: { x: 12, y: 3 }, },
	MINION: {
		icon: { x: 11, y: 0 },
		prereq: {
			type: "team",
			any: ["TEAM_WEREWOLF"]
		}
	},
	MORTICIAN: { icon: { x: 8, y: 4 } },
	MYSTICWOLF: { icon: { x: 5, y: 1 } },
	NOSTRADAMUS: { icon: { x: 6, y: 2 } },
	ORACLE: { icon: { x: 9, y: 4 } },
	PARANORMALINVESTIGATOR: { icon: { x: 6, y: 1 } },
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
	PRINCE: { icon: { x: 7, y: 2 } },
	PSYCHIC: { icon: { x: 10, y: 4 }, },
	RASCAL: { icon: { x: 11, y: 4 }, },
	RENFIELD: {
		icon: { x: 10, y: 3 },
		prereq: {
			type: "team",
			any: ["TEAM_VAMPIRE"]
		},
	},
	REVEALER: { icon: { x: 7, y: 1 } },
	ROBBER: { icon: { x: 9, y: 0 } },
	SEER: { icon: { x: 0, y: 0 } },
	SENTINEL: { icon: { x: 8, y: 1 } },
	SQUIRE: {
		icon: { x: 8, y: 2 },
		prereq: {
			type: "team",
			any: ["TEAM_WEREWOLF"]
		},
	},
	SYNTHETICALIEN: { icon: { x: 12, y: 4 } },
	TANNER: { icon: { x: 4, y: 0 } },
	THING: { icon: { x: 9, y: 2 } },
	TROUBLEMAKER: { icon: { x: 2, y: 0 } },
	VAMPIRE: {
		minCount: 1,
		maxCount: 2,
		icon: { x: 13, y: 3 },
	},
	VILLAGEIDIOT: { icon: { x: 9, y: 1 } },
	VILLAGER: {
		minCount: 1,
		maxCount: 3,
		icon: { x: 7, y: 0 },
	},
	WEREWOLF: {
		minCount: 1,
		maxCount: 2,
		icon: { x: 10, y: 0 },
	},
	WITCH: { icon: { x: 10, y: 1 } },
};

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
		"NOSTRADAMUS",
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

const ROLE_PHASES = {
	DAY: [ "BLOB", "BODYGUARD", "CURSED", "HUNTER", "PRINCE", "TANNER", "VILLAGER", ], 
	DUSK: [ "APPRENTICEASSASSIN", "ASSASSIN", "COUNT", "CUPID", "DISEASED", "INSTIGATOR", "MASTER", "PRIEST", "RENFIELD", "VAMPIRE", ],
	NIGHT: [ "ALIEN", "ALPHAWOLF", "APPRENTICESEER", "APPRENTICETANNER", "AURASEER", "BEHOLDER", "BODYSNATCHER", "COPYCAT", "COW", "CURATOR", "DOPPELGANGER", "DREAMWOLF", "DRUNK", "EMPATH", "EXPOSER", "FEUDINGALIENS", "GREMLIN", "INSOMNIAC", "LEADER", "MARKSMAN", "MASON", "MINION", "MORTICIAN", "MYSTICWOLF", "NOSTRADAMUS", "ORACLE", "PARANORMALINVESTIGATOR", "PICKPOCKET", "PSYCHIC", "RASCAL", "REVEALER", "ROBBER", "SEER", "SENTINEL", "SQUIRE", "SYNTHETICALIEN", "THING", "TROUBLEMAKER", "VILLAGEIDIOT", "WEREWOLF", "WITCH", ], 	
};

const ROLE_TEAMS = {
	TEAM_ALIEN: [ "ALIEN", "BODYSNATCHER", "FEUDINGALIENS", ], 
	TEAM_MINORITY: [ "APPRENTICEASSASSIN", "APPRENTICETANNER", "ASSASSIN", "BLOB", "MINION", "MORTICIAN", "RENFIELD", "SQUIRE", "SYNTHETICALIEN", "TANNER", ], 
	TEAM_VAMPIRE: [ "COUNT", "MASTER", "VAMPIRE", ],
	TEAM_VILLAGE: [ "APPRENTICESEER", "AURASEER", "BEHOLDER", "BODYGUARD", "COPYCAT", "COW", "CUPID", "CURATOR", "CURSED", "DISEASED", "DOPPELGANGER", "DRUNK", "EMPATH", "EXPOSER", "GREMLIN", "HUNTER", "INSOMNIAC", "INSTIGATOR", "LEADER", "MARKSMAN", "MASON", "NOSTRADAMUS", "ORACLE", "PARANORMALINVESTIGATOR", "PICKPOCKET", "PRIEST", "PRINCE", "PSYCHIC", "RASCAL", "REVEALER", "ROBBER", "SEER", "SENTINEL", "THING", "TROUBLEMAKER", "VILLAGEIDIOT", "VILLAGER", "WITCH", ], 
	TEAM_WEREWOLF: [ "ALPHAWOLF", "DREAMWOLF", "MYSTICWOLF", "WEREWOLF", ], 	
};


function getRole(role) {
	return typeof role === "object" ? role : ROLES[role];
}

function roleHasTag(role, tag) {
	return getRole(role)?.tags?.includes(tag) || false;
}

function roleHasAnyTag(role, ...tags) {
	return tags.some(t => roleHasTag(role, t));
}

function roleIsTeam(role, team) {
	return getRole(role)?.team === team;
}

function roleIsPhase(role, phase) {
	return getRole(role)?.phase === phase || false;
}

function applyTags() {
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

function applyTeams() {
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

function applyPhases() {
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

applyTags();
applyTeams();
applyPhases();

for (const [key, role] of Object.entries(ROLES)) {
	role.id = key;
	role.nameKey = "ROLE_" + key;
	role.abilityKey = "UI_ABILITY_" + key;

	role.minCount = role.minCount ?? 1;
	role.maxCount = role.maxCount ?? 1;

	if (!role.tags) {
		console.warn("Role " + role.id + " missing tags");
		role.tags = [];
	}

	if (!role.team) {
		console.warn("Role " + role.id + " missing team");
		role.team = "TEAM_VILLAGE";
	}

	if (!role.phase) {
		console.warn("Role " + role.id + " missing phase");
		role.phase = "DAY";
	}
	
	if (!roleHasAnyTag(role, "RULESET_BASIC", "RULESET_ADVANCED", "RULESET_ALIEN", "RULESET_VAMPIRE")) {
		console.warn("Role " + role.id + " missing ruleset");
	}

	if (role.disable) {
		console.log("Role disabled: " + role.id);
	}
}

Object.freeze(ROLES)
