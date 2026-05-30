const TURN_ORDER = [
    {
        description: "Oracle",
        condition: ctx => ctx.isPresent("ORACLE"),
		text: "PROMPT_ORACLE",
    },
    {
        description: "Copycat",
        condition: ctx => ctx.isPresent("COPYCAT"),
        text: "PROMPT_COPYCAT"
    },
	{
		description: "Doppelganger (with marks)",
		condition: ctx => ctx.isPresent("DOPPELGANGER") && ctx.anyWithTag("MARKS_ROLE"),
		text: "PROMPT_DOPPELGANGER",
	},
    {
        description: "Vampires",
		condition: ctx => ctx.anyInTeam("TEAM_VAMPIRE"),
		text: "PROMPT_VAMPIRE",
	},
    {
        description: "Count + doppelganger",
		condition: ctx => ctx.isPresent("COUNT"),
		rules: [
			{ text: "PROMPT_COUNT" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_COUNT_DOPPELGANGER"
            }
		],
	},
    {
        description: "Renfield + doppelganger",
        condition: ctx => ctx.isPresent("RENFIELD"),
        text: "PROMPT_RENFIELD"
    },
    {
        description: "Diseased",
        condition: ctx => ctx.isPresent("DISEASED"),
        text: "PROMPT_DISEASED"
    },
    {
        description: "Cupid",
        condition: ctx => ctx.isPresent("CUPID"),
        text: "PROMPT_CUPID"
    },
    {
        description: "Instigator",
        condition: ctx => ctx.isPresent("INSTIGATOR"),
        text: "PROMPT_INSTIGATOR"
    },
    {
        description: "Priest + doppelganger",
		condition: ctx => ctx.isPresent("PRIEST"),
		rules: [
			{ text: "PROMPT_PRIEST" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_PRIEST_DOPPELGANGER"
            }
		],
	},
    {
        description: "Assassin + apprentice assassin + doppelganger",
		condition: ctx => ctx.isPresent("ASSASSIN"),
		rules: [
			{ text: "PROMPT_ASSASSIN" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_ASSASSIN_DOPPELGANGER"
            }
		],
	},
    {
        description: "Check marks",
        condition: ctx => ctx.anyWithTag("MARKS_ROLE"),
        text: "PROMPT_CHECK_MARKS"
    },
    {
        description: "Lovers",
        condition: ctx => ctx.isPresent("CUPID"),
        text: "PROMPT_CUPID_LOVERS"
    },
    {
        description: "Sentinel",
        condition: ctx => ctx.isPresent("SENTINEL"),
        text: "PROMPT_SENTINEL"
    },
    {
        description: "Doppelganger",
        condition: ctx => ctx.isPresent("DOPPELGANGER") && !ctx.anyWithTag("MARKS_ROLE"),
		text: "PROMPT_DOPPELGANGER",
    },
    {
        description: "Aliens + Doppelganger alien + cow",
		condition: ctx => ctx.anyInTeam("TEAM_ALIEN") || ctx.isPresent("SYNTHETICALIEN"),
		text: "PROMPT_ALIEN",
	},
    {
        description: "Feuding aliens + Doppelganger feuding alien",
		condition: ctx => ctx.isPresent("FEUDINGALIENS"),
		text: "PROMPT_FEUDINGALIENS",
	},
    {
        description: "Body snatcher",
		condition: ctx => ctx.isPresent("BODYSNATCHER"),
		rules: [
			{ text: "PROMPT_BODYSNATCHER" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_BODYSNATCHER_DOPPELGANGER"
            }
		],
	},
    {
        description: "Werewolves",
		condition: ctx => ctx.anyPresent("WEREWOLF", "ALPHAWOLF", "MYSTICWOLF"),
		text: "PROMPT_WEREWOLF",
	},
    {
        description: "Alpha Wolf",
        condition: ctx => ctx.isPresent("ALPHAWOLF"),
        text: "PROMPT_ALPHA_WOLF"
    },
    {
        description: "Mystic Wolf",
        condition: ctx => ctx.isPresent("MYSTICWOLF"),
        text: "PROMPT_MYSTIC_WOLF"
    },
    {
        description: "Minion",
        condition: ctx => ctx.isPresent("MINION") && ctx.anyInTeam("TEAM_WEREWOLF"),
		text: "PROMPT_MINION",
    },
    {
        description: "Apprentice Tanner (+ Doppelganger)",
        condition: ctx => ctx.isPresent("APPRENTICETANNER") && ctx.isPresent("TANNER"),
		text: "PROMPT_APPRENTICETANNER",
    },
    {
        description: "Leader (+ Doppelganger)",
        condition: ctx => ctx.isPresent("LEADER") && (ctx.anyInTeam("TEAM_ALIEN") || ctx.isPresent("SYNTHETICALIEN")),
		text: "PROMPT_LEADER",
    },
    {
        description: "Masons",
        condition: ctx => ctx.isPresent("MASON"),
		text: "PROMPT_MASON",
    },
    {
        description: "Thing",
        condition: ctx => ctx.isPresent("THING"),
        text: "PROMPT_THING"
    },
    {
        description: "Seer",
        condition: ctx => ctx.isPresent("SEER"),
        text: "PROMPT_SEER"
    },
    {
        description: "Apprentice Seer",
        condition: ctx => ctx.isPresent("APPRENTICESEER"),
        text: "PROMPT_APPRENTICESEER"
    },
    {
        description: "Paranormal Investigator",
        condition: ctx => ctx.isPresent("PARANORMALINVESTIGATOR"),
		text: "PROMPT_PARANORMALINVESTIGATOR_MAIN",
    },
    {
        description: "Marksman",
		condition: ctx => ctx.isPresent("MARKSMAN"),
		rules: [
			{ text: "PROMPT_MARKSMAN" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_MARKSMAN_DOPPELGANGER"
            }
		]
	},
    {
        description: "Nostradamus",
        condition: ctx => ctx.isPresent("NOSTRADAMUS"),
		text: "PROMPT_NOSTRADAMUS_MAIN",
    },
    {
        description: "Psychic",
		condition: ctx => ctx.isPresent("PSYCHIC"),
		rules: [
			{ text: "PROMPT_PSYCHIC" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_PSYCHIC_DOPPELGANGER"
            }
		],
	},
    {
        description: "Robber",
        condition: ctx => ctx.isPresent("ROBBER"),
        text: "PROMPT_ROBBER"
    },
    {
        description: "Witch",
        condition: ctx => ctx.isPresent("WITCH"),
        text: "PROMPT_WITCH"
    },
    {
        description: "Pickpocket",
		condition: ctx => ctx.isPresent("PICKPOCKET"),
		rules: [
			{ text: "PROMPT_PICKPOCKET" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_PICKPOCKET_DOPPELGANGER"
            }
		],
	},
    {
        description: "Troublemaker",
        condition: ctx => ctx.isPresent("TROUBLEMAKER"),
        text: "PROMPT_TROUBLEMAKER"
    },
    {
        description: "Village Idiot",
        condition: ctx => ctx.isPresent("VILLAGEIDIOT"),
        text: "PROMPT_VILLAGEIDIOT"
    },
    {
        description: "Aura Seer",
        condition: ctx => ctx.isPresent("AURASEER") && ctx.anyWithTag("AURA_SEER_DETECTABLE"),
		text: "PROMPT_AURASEER",
    },
    {
        description: "Gremlin + doppelganger",
        condition: ctx => ctx.isPresent("GREMLIN"),
        rules: [
            { text: "PROMPT_GREMLIN" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_GREMLIN_DOPPELGANGER"
            }
        ]
    },
    {
        description: "Rascal + doppelganger",
        condition: ctx => ctx.isPresent("RASCAL"),
        rules: [
            { text: "PROMPT_RASCAL" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_RASCAL_DOPPELGANGER"
            }
        ]
    },
    {
        description: "Drunk",
        condition: ctx => ctx.isPresent("DRUNK"),
        text: "PROMPT_DRUNK"
    },
    {
        description: "Insomniac",
        condition: ctx => ctx.isPresent("INSOMNIAC"),
        rules: [
            { text: "PROMPT_INSOMNIAC" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_INSOMNIAC_DOPPELGANGER"
            }
        ]
    },
    {
        description: "Squire",
        condition: ctx => ctx.isPresent("SQUIRE") && ctx.anyInTeam("TEAM_WEREWOLF"),
		text: "PROMPT_SQUIRE",
    },
    {
        description: "Beholder",
        condition: ctx => ctx.isPresent("BEHOLDER") && (ctx.isPresent("SEER") || ctx.isPresent("APPRENTICESEER")),
		text: "PROMPT_BEHOLDER",
    },
    {
        description: "Revealer",
        condition: ctx => ctx.isPresent("REVEALER"),
        rules: [
            { text: "PROMPT_REVEALER" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_REVEALER_DOPPELGANGER"
            }
        ]
    },
    {
        description: "Exposer (+ Doppelganger)",
        condition: ctx => ctx.isPresent("EXPOSER"),
		rules: [
			{ text: "PROMPT_EXPOSER" },
			{
				condition: ctx => ctx.isPresent("DOPPELGANGER"),
				text: "PROMPT_EXPOSER_DOPPELGANGER",
			}
		]
    },
    {
        description: "Empath + doppelganger",
        condition: ctx => ctx.isPresent("EMPATH"),
        rules: [
            { text: "PROMPT_EMPATH" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_EMPATH_DOPPELGANGER"
            }
        ]
    },
    {
        description: "Curator",
        condition: ctx => ctx.isPresent("CURATOR"),
        rules: [
            { text: "PROMPT_CURATOR" },
            {
                condition: ctx => ctx.isPresent("DOPPELGANGER"),
                text: "PROMPT_CURATOR_DOPPELGANGER"
            }
        ]
    },
    {
        description: "Blob + doppelganger",
        condition: ctx => ctx.isPresent("BLOB"),
		text: "PROMPT_BLOB",
    },
    {
        description: "Mortician",
        condition: ctx => ctx.isPresent("MORTICIAN"),
		rules: [
			{ text: "PROMPT_MORTICIAN" },
			{
				condition: ctx => ctx.isPresent("DOPPELGANGER"),
				text: "PROMPT_MORTICIAN_DOPPELGANGER",
			}
		]
    },
    {
        description: "Ripple",
        condition: ctx => ctx.anyInTeam("TEAM_ALIEN"),
		text: "PROMPT_RIPPLE",
    },
];



const RNG_CACHE = Object.create(null);

const EXECUTORS = {
	formatListString: (ctx, items, isOr = true) => {
		if (!Array.isArray(items) || items.length === 0) {
			return "";
		}

		if (items.length === 1) {
			return String(items[0]);
		}

		const joinWord = LocR(isOr ? "LIST_OR" : "LIST_AND", ctx);

		if (items.length === 2) {
			return `${items[0]} ${joinWord} ${items[1]}`;
		}

		return ( items.slice(0, -1).join(", ") + ` ${joinWord} ` + items[items.length - 1] );
	},
	listRolesWithTag: (ctx, tag, isOr = true) => {
		const roles = getRolesWithTag(ctx, tag)
			.filter(role => ctx.isPresent(role.id))
			.map(role => LocR(role.nameKey, ctx));
			
		return EXECUTORS.formatListString(ctx, roles, isOr);
	},
	/*
	listRolesWithTag: (ctx, tag, isOr = true) => {
		const roles = getRolesWithTag(ctx, tag)
			.filter(role => ctx.isPresent(role.id))
			.map(role => LocR(role.nameKey, ctx));

		if (roles.length === 0) return "";
		if (roles.length === 1) return roles[0];
		if (roles.length === 2) return `${roles[0]} ${LocR(isOr ? "LIST_OR" : "LIST_AND", ctx)} ${roles[1]}`;

		return (
			roles.slice(0, -1).join(", ") +
			` ${LocR(isOr ? "LIST_OR" : "LIST_AND", ctx)} ` +
			roles[roles.length - 1]
		);
	},
	*/
	MorticianRandomEvent: (ctx, doppelganger = false) => {
		const weights = [
			{ id: "PROMPT_SHARED_VIEW_PLAYER_NEIGHBOR_LEFT",  weight: getSettingInt(ctx, "mortician.neighbor", 1) / 2 },
			{ id: "PROMPT_SHARED_VIEW_PLAYER_NEIGHBOR_RIGHT", weight: getSettingInt(ctx, "mortician.neighbor", 1) / 2 },
			{ id: "PROMPT_SHARED_VIEW_PLAYER_NEIGHBOR_BOTH",  weight: getSettingInt(ctx, "mortician.both", 1) },
			{ id: "PROMPT_SHARED_VIEW_PLAYER_SELF",  weight: getSettingInt(ctx, "mortician.self", 1) }
		];

		const role = "mortician" + (doppelganger ? "_doppelganger" : "");
		const prompt = chooseWeighted(weights, role + ".card_choice") ?? "PROMPT_MORTICIAN_FALLBACK";
		return LocR(prompt, ctx);
	},
	OracleRandomEvent: (ctx) => {
		let choices = [
			/*{ id: "change_team", weight: getSettingInt(ctx, "oracle.change_team", 0) },*/
			{ id: "view_center", weight: getSettingInt(ctx, "oracle.view_center", 0) },
			{ id: "view_player", weight: getSettingInt(ctx, "oracle.view_player", 0) },
			{ id: "hunt", weight: getSettingInt(ctx, "oracle.hunt", 0) },
			{ id: "block_action", weight: getSettingInt(ctx, "oracle.block_action", 0) },
			{ id: "drunk", weight: getSettingInt(ctx, "oracle.drunk", 0) },
			{ id: "even_odd", weight: getSettingInt(ctx, "oracle.even_odd", 0) },
		]
		
		//Check if there are any evil teams for Oracle to join, and if so, add the team change to the list of possible choices.
		const teams = [];
		[ "TEAM_WEREWOLF", "TEAM_VAMPIRE", "TEAM_ALIEN" ].forEach((t) => { if (ctx.anyInTeam(t)) teams.push(t); });
		if (teams.length > 0) { choices.push({ id: "change_team", weight: getSettingInt(ctx, "oracle.change_team", 0) }); }
		
		// Choose the main Oracle event
		const main = chooseWeighted(choices, "oracle.main_event") ?? "fallback";
		let prompt = "PROMPT_ORACLE_FALLBACK";
		let data = {};
		
		//Sub-events
		switch (main) {
			case "change_team":
				const join_team = chooseWeighted(teams.map(t => ({ id: t, weight: 1 })), "oracle.change_team.team") + "_DEFINITE";
				const join_full = chooseWeighted(
					[
						{ id: true, weight: getSettingInt(ctx, "oracle.change_team.full", 0) },
						{ id: false, weight: getSettingInt(ctx, "oracle.change_team.partial", 0) },
					],
					"oracle.change_team.mode"
				) ?? true;
				
				prompt = "PROMPT_ORACLE_CHANGE_TEAM";
				data = { oracle_join_team: join_team, oracle_join_full: join_full }
				break;
			case "view_center":
				prompt = "PROMPT_ORACLE_VIEW_CARD";
				data = { oracle_view_mode: "center" };
				break;
			case "view_player":
				prompt = "PROMPT_ORACLE_VIEW_CARD";
				data = { oracle_view_mode: "player" };
				break;
			case "hunt":
				prompt = "PROMPT_ORACLE_HUNT";
				break;
			case "block_action":
				prompt = "PROMPT_ORACLE_BLOCK_ACTION";
				break;
			case "drunk":
				prompt = "PROMPT_DRUNK_ACTION";
				break;
			case "even_odd":
				prompt = "PROMPT_ORACLE_EVEN_ODD";
				break;
		}
		
		return LocR(prompt, { ...ctx, ...data });
	},
	OracleViewCard: (ctx) => {
		let options = [];
		let prompt = "PROMPT_SHARED_VIEW_" + (ctx.oracle_view_mode).toUpperCase() + "_";
		let mode_fallback = ctx.oracle_view_mode === "center" ? "ONE" : "ANY";
		let rndKey = "oracle.view_" + ctx.oracle_view_mode + ".value"
		
		if (ctx.oracle_view_mode === "center") {
			options.push({ id: "ONE", weight: getSettingInt(ctx, "oracle.view_center.one", 0) });
			options.push({ id: "TWO", weight: getSettingInt(ctx, "oracle.view_center.two", 0) });
			options.push({ id: "THREE", weight: getSettingInt(ctx, "oracle.view_center.three", 0) });
		} else {
			options.push({ id: "EVEN", weight: getSettingInt(ctx, "oracle.view_player.even", 0) });
			options.push({ id: "ODD", weight: getSettingInt(ctx, "oracle.view_player.odd", 0) });
			options.push({ id: "ANY", weight: getSettingInt(ctx, "oracle.view_player.any", 0) });
			options.push({ id: "SPECIFIC", weight: getSettingInt(ctx, "oracle.view_player.specific", 0) });
		}
		
		const mode = chooseWeighted(options, rndKey) ?? mode_fallback;
		prompt = prompt + mode;
		let data = {};
		if (mode === "SPECIFIC") {
			const result = EXECUTORS.RandomPlayers(ctx, "oracle.view_player", 1);
			data = { specific_player_number: result };
			//data = { specific_player_number: (Math.floor(getCachedRandom("oracle.view_player.specific_player_number") * ctx.player_count) + 1).toString() };
		}
		
		return LocR(prompt, { ...ctx, ...data });
	},
	OracleHuntResult: (ctx) => {
		const chance = getSettingPercent(ctx, "oracle.hunt.chance", 0);
		const roll = getCachedRandom("oracle.hunt.roll") * 100;
		const prompt = roll < chance ? "PROMPT_ORACLE_HUNT_STARTED" : "PROMPT_ORACLE_HUNT_AVOIDED";
		const data = { oracle_allow_bad: getSettingToggle(ctx, "oracle.hunt.allow_bad_teams", false) };
		
		return LocR(prompt, { ...ctx, ...data });
	},
	AlienRandomEvent: (ctx) => { 
		let choices = [
			{ id: "view_card_collective", weight: getSettingInt(ctx, "alien.view_card_collective", 0) },
			{ id: "view_card_individual", weight: getSettingInt(ctx, "alien.view_card_individual", 0) },
			{ id: "do_nothing", weight: getSettingInt(ctx, "alien.do_nothing", 0) },
			{ id: "trade_cards", weight: getSettingInt(ctx, "alien.trade_cards", 0) },
			{ id: "show_cards", weight: getSettingInt(ctx, "alien.show_cards", 0) },
			{ id: "make_alien", weight: getSettingInt(ctx, "alien.make_alien", 0) },
			{ id: "make_minion", weight: getSettingInt(ctx, "alien.make_minion", 0) },
		]
		
		// Choose the main Alien event
		const main = chooseWeighted(choices, "alien.main_event");
		let prompt = "PROMPT_ALIEN_FALLBACK";
		let data = {};
		
		//Sub-events
		switch (main) {
			case "view_card_collective":
				prompt = "PROMPT_ALIEN_VIEW_CARD_COLLECTIVE";
				break;
			case "view_card_individual":
				prompt = "PROMPT_ALIEN_VIEW_CARD_INDIVIDUAL";
				break;
			case "do_nothing":
				prompt = "PROMPT_ALIEN_NOTHING";
				break;
			case "trade_cards":
				const r = getCachedRandom("alien.trade_cards.direction");
				prompt = "PROMPT_ALIEN_TRADE_" + (r > 0.5 ? "LEFT" : "RIGHT");
				break;
			case "show_cards":
				prompt = "PROMPT_ALIEN_SHOW_CARDS";
				break;
			case "make_alien":
				prompt = "PROMPT_ALIEN_MAKE_ALIEN";
				break;
			case "make_minion":
				prompt = "PROMPT_ALIEN_MAKE_MINION";
				break;
		}
		
		return LocR(prompt, { ...ctx, ...data});
	},
	AlienViewCard: (ctx, isCollective = false) => {
		const setting_node = "alien.view_card_" + (isCollective ? "collective" : "individual");
		
		let choices = [
			{ id: "PLAYER_EVEN", weight: getSettingInt(ctx, setting_node + ".even", 0) },
			{ id: "PLAYER_ODD", weight: getSettingInt(ctx, setting_node + ".odd", 0) },
			{ id: "CENTER_ONE", weight: getSettingInt(ctx, setting_node + ".center", 0) },
		];
		if (isCollective) {
			choices.push({ id: "PLAYER_SPECIFIC", weight: getSettingInt(ctx, setting_node + ".specific", 0) });
		} else {
			choices.push({ id: "PLAYER_NEIGHBOR_ANY", weight: getSettingInt(ctx, setting_node + ".neighbor", 0) });
		}
		
		const mode = chooseWeighted(choices, setting_node + ".mode");
		let prompt = "PROMPT_SHARED_VIEW_" + (mode ?? "PLAYER_NEIGHBOR_ANY");
		let data = {};
		if (mode === "PLAYER_SPECIFIC") {
			const result = EXECUTORS.RandomPlayers(ctx, setting_node, 1);
			data = { specific_player_number: result };
			//data = { specific_player_number: (Math.floor(getCachedRandom(setting_node + ".specific_player_number") * ctx.player_count) + 1).toString() };
		}
		
		return LocR(prompt, { ...ctx, ...data })
	},
	PsychicRandomEvent: (ctx, doppelganger = false) => {
		const r = getCachedRandom("psychic.double_cards") * 100
		const view_double = getSettingPercent(ctx, "psychic.double_cards", 0) > r;
		
		let choices = [
			{ id: "NEIGHBOR", weight: getSettingInt(ctx, "psychic.neighbor", 0) },
			{ id: "ODD", weight: getSettingInt(ctx, "psychic.odd", 0) },
			{ id: "EVEN", weight: getSettingInt(ctx, "psychic.even", 0) },
			{ id: "SPECIFIC", weight: getSettingInt(ctx, "psychic.specific", 0) },
		];
		
		const mode = chooseWeighted(choices, "psychic.view_cards") ?? "NEIGHBOR";
		let prompt = "PROMPT_SHARED_VIEW_PLAYER_" + mode;
		let data = {}
		
		switch (mode) {
			case "NEIGHBOR":
				prompt = prompt + (view_double ? "_BOTH" : "_ANY");
				break;
			case "SPECIFIC":
				const result = EXECUTORS.RandomPlayers(ctx, "psychic.specific", view_double ? 2 : 1);
				data = { specific_player_number: result.toString() };
				break;
			default:
				prompt = prompt + (view_double ? "_DOUBLE" : "");
				break;
		}
		
		return LocR(prompt, { ...ctx, ...data });
	},
	NostradamusRandomTeam: (ctx) => {
		const teams = [];
		[ "TEAM_WEREWOLF", "TEAM_VAMPIRE", "TEAM_ALIEN" ].forEach((t) => {
			if (ctx.anyInTeam(t)) teams.push(t);
		});
		if (ctx.isPresent("TANNER")) teams.push("ROLE_TANNER")
		
		return LocR((teams.length > 0 ? chooseWeighted(teams.map(t => ({ id: t, weight: 1 })), "nostradamus.random_team") : "TEAM_VILLAGE") + "_DEFINITE");
	},
	ExposerCardCount: (ctx, doppelganger = false) => {
		const choices = [
			{ id: 1,  weight: getSettingInt(ctx, "exposer.flip_one", 1) },
			{ id: 2, weight: getSettingInt(ctx, "exposer.flip_two", 1) },
			{ id: 3,  weight: getSettingInt(ctx, "exposer.flip_three", 1) },
		];

		const role = "exposer" + (doppelganger ? "_doppelganger" : "");
		const choice = chooseWeighted(choices, role + ".card_choice");

		return choice;
	},
	RascalRandomEvent: (ctx, doppelganger = false) => {
		const choices = [
			
			{ id: "PROMPT_TROUBLEMAKER_ACTION", weight: getSettingInt(ctx, "rascal.troublemaker", 0) },
			{ id: "PROMPT_ROBBER_ACTION", weight: getSettingInt(ctx, "rascal.robber", 0) },
			{ id: "PROMPT_WITCH_ACTION", weight: getSettingInt(ctx, "rascal.witch", 0) },
			{ id: "PROMPT_VILLAGEIDIOT_ACTION", weight: getSettingInt(ctx, "rascal.villageidiot", 0) },
			{ id: "PROMPT_DRUNK_ACTION", weight: getSettingInt(ctx, "rascal.drunk", 0) },
		]
		
		const role = "rascal" + (doppelganger ? "_doppelganger" : "");
		const prompt = chooseWeighted(choices, role + ".action") ?? "PROMPT_TROUBLEMAKER_ACTION";
		return LocR(prompt, ctx);
	},
	BlobObjective: (ctx) => {
		let blobCount = 0;

		if (ctx.player_count >= 9) blobCount = 4;
		else if (ctx.player_count >= 7) blobCount = 3;
		else if (ctx.player_count >= 5) blobCount = 2;
		else if (ctx.player_count >= 4) blobCount = 1;
		
		// Balanced split
		const left = Math.floor(blobCount / 2);
		const right = Math.ceil(blobCount / 2);

		// Randomly flip sides
		const flip = getCachedRandom("blob.side_distribution") < 0.5;
		const finalLeft = flip ? right : left;
		const finalRight = flip ? left : right;
		
		let prompt = "PROMPT_BLOB_OBJECTIVE_";
		switch (blobCount) {
			case 0:
				prompt = prompt + "ALONE";
				break;
			case 1:
				prompt = prompt + "SINGLE_" + (finalLeft > 0 ? "LEFT" : "RIGHT");
				break;
			default:
				prompt = prompt + "MULTI";
				break;
		}

		return LocR(prompt, { ...ctx, blob_left: finalLeft, blob_right: finalRight });
	},
	BlobPlayerCount: (ctx, isLeft = true) => { return (isLeft ? ctx.blob_left : ctx.blob_right).toString(); },
	BodySnatcherFakeEvent: (ctx, isDoppelganger = false) => {
		const rndKey = "bodysnatcher" + (isDoppelganger ? "_doppelganger" : "");
		const r = getCachedRandom(rndKey + ".fake") * 100;
		const fake_action = r < getSettingPercent(ctx, "bodysnatcher.fake", 0);
		
		return fake_action ? LocR("PROMPT_BODYSNATCHER_FAKE_ACTION", ctx) : "";
	},
	BodySnatcherRandomEvent: (ctx, isDoppelganger = false) => { 
		const rndKey = "bodysnatcher" + (isDoppelganger ? "_doppelganger" : "");
		
		let choices = [
			{ id: "CENTER_ONE", weight: getSettingInt(ctx, "bodysnatcher.center", 0) },
			{ id: "PLAYER_NEIGHBOR_ANY", weight: getSettingInt(ctx, "bodysnatcher.neighbor", 0) },
			{ id: "PLAYER_ODD", weight: getSettingInt(ctx, "bodysnatcher.odd", 0) },
			{ id: "PLAYER_EVEN", weight: getSettingInt(ctx, "bodysnatcher.even", 0) },
			{ id: "PLAYER_SPECIFIC", weight: getSettingInt(ctx, "bodysnatcher.specific", 0) },
		];
		
		const target = chooseWeighted(choices, rndKey + ".target");
		const prompt = "PROMPT_SHARED_VIEW_" + (target ?? "PLAYER_NEIGHBOR_ANY");
		
		let data = {};
		if (target === "PLAYER_SPECIFIC") {
			data = { specific_player_number: (Math.floor(getCachedRandom(rndKey + ".specific_player_number") * ctx.player_count) + 1).toString() };
		}
		
		return LocR(prompt, { ...ctx, ...data })
	},
	EmpathPlayerList: (ctx, isDoppelganger = false) => {
		const rndKey = "empath" + (isDoppelganger ? "_doppelganger" : "");
		return EXECUTORS.RandomPlayers(ctx, rndKey, 1, 4);
	},
	EmpathPlayerAction: (ctx, isDoppelganger = false) => {
		const rndKey = "empath" + (isDoppelganger ? "_doppelganger" : "");
		const questions = getLocKeysWith("PROMPT_EMPATH_QUESTION_");
		const prompt = questions[ Math.floor(getCachedRandom(rndKey + ".question") * questions.length) ];
		
		return LocR(prompt, ctx);
	},
	RippleRandomEvent: (ctx, override = false) => {
		let data = {};
		let choices = [
			{ id: "ONE_MINUTE", weight: getSettingInt(ctx, "ripple.one_minute", 0) },
			{ id: "INSOMNIAC", weight: getSettingInt(ctx, "ripple.insomniac", 0) },
			{ id: "MUTED", weight: getSettingInt(ctx, "ripple.muted", 0) },
			{ id: "REBUKED", weight: getSettingInt(ctx, "ripple.rebuked", 0) },
			{ id: "TROUBLEMAKER", weight: getSettingInt(ctx, "ripple.troublemaker", 0) },
			{ id: "ROBBER", weight: getSettingInt(ctx, "ripple.robber", 0) },
			{ id: "WITCH", weight: getSettingInt(ctx, "ripple.witch", 0) },
			{ id: "REVEALER", weight: getSettingInt(ctx, "ripple.revealer", 0) },
			{ id: "DRUNK", weight: getSettingInt(ctx, "ripple.drunk", 0) },
			{ id: "VIEW_PLAYER", weight: getSettingInt(ctx, "ripple.view_player", 0) },
			{ id: "DUAL_VIEW_PLAYER", weight: getSettingInt(ctx, "ripple.dual_view_player", 0) },
			{ id: "DOUBLE_VOTE", weight: getSettingInt(ctx, "ripple.double_vote", 0) },
		];
		if (!override) {
			choices.push({ id: "NONE", weight: getSettingInt(ctx, "ripple.none", 0) });
		}
		
		const mode = chooseWeighted(choices, "ripple.mode") ?? "FALLBACK";
		let prompt = "PROMPT_RIPPLE_" + mode;
		
		return LocR(prompt, { ...ctx, ...data });
	},
	
	
	ApprenticeAssassinDoppelganger: (ctx) => { return ctx.isPresent("APPRENTICEASSASSIN") ? EXECUTORS.IfDoppelgangerPresent(ctx, "PROMPT_APPRENTICEASSASSIN_DOPPELGANGER") : ""; },
	OracleChangeTeamChoice: (ctx) => { return LocR(ctx.oracle_join_team, ctx); },
	OracleChangeTeamMode: (ctx) => { return ctx.oracle_join_full ? LocR("PROMPT_ORACLE_CHANGE_TEAM_FULL", ctx) : LocR("PROMPT_ORACLE_CHANGE_TEAM_PARTIAL", ctx); },
	OracleOmniscienceExclusion: (ctx) => { return ctx.oracle_allow_bad ? "" : EXECUTORS.IfAnyWithTag(ctx, "ORACLE_OMNISCIENCE_EXCLUDED", "PROMPT_ORACLE_HUNT_OMNISCIENCE"); },
	SharedViewSpecificPlayerResult: (ctx) => { return ctx.specific_player_number.toString(); },	
	
	//Generic shared
	IfDoppelgangerPresent: (ctx, prompt) => { return EXECUTORS.IfPresent(ctx, "DOPPELGANGER", prompt); },
	IfPresent: (ctx, role, prompt) => { return ctx.isPresent(role) ? LocR(prompt, ctx) : ""; },
	IfAnyWithTag: (ctx, tag, prompt) => { return ctx.anyWithTag(tag) ? LocR(prompt, ctx) : ""; },
	ListRolesWithTag: (ctx, tag, isOr = true) => { return EXECUTORS.listRolesWithTag(ctx, tag, isOr); },
	RandomPlayers: (ctx, rndKey, min, max) => {		
		function parseArg(arg) {
			if (typeof arg === "string" && arg.endsWith("%")) {
				const p = parseFloat(arg) / 100.0;
				return Math.ceil(ctx.player_count * p);
			}
			
			if (typeof arg === "number" && Number.isInteger(arg)) {
				return arg;
			}

			return null;
		}

		let minAbs = parseArg(min) ?? 1;
		let maxAbs = parseArg(max) ?? minAbs;

		if (minAbs > maxAbs) {
			[minAbs, maxAbs] = [maxAbs, minAbs];
		}

		minAbs = Math.min(minAbs, ctx.player_count);
		maxAbs = Math.min(maxAbs, ctx.player_count);
		
		const playerCount = Math.floor(getCachedRandom(rndKey) * (maxAbs - minAbs + 1)) + minAbs;
		
		console.log(min + ", " + max + ", " + minAbs + ", " + maxAbs + ", " + playerCount);
		
		let all_players = Array.from({length: ctx.player_count}, (_, i) => i + 1)
		let players = [];
		
		for (let i = 0; i < playerCount; i++) {
			const idx = Math.floor(getCachedRandom(rndKey + ".player_" + i) * all_players.length);
			players.push(all_players.splice(idx, 1)[0]);
		}
		
		//return players.sort((a,b) => { return a-b; }).toString();
		return EXECUTORS.formatListString(ctx, players.sort((a, b) => a - b).map(String), false);
	},
}





function getCachedRandom(key) {
    let v = RNG_CACHE[key];
    if (v === undefined) {
        v = Math.random();     // float [0,1)
        RNG_CACHE[key] = v;
    }
    return v;
}

function resetPromptRandom() {
    for (const k in RNG_CACHE) delete RNG_CACHE[k];
}

function getSetting(ctx, oid) {
	return ctx.settings?.[oid];
}

function getSettingInt(ctx, oid, fallback = 0) {
    const v = getSetting(ctx, oid);
    return Number.isInteger(v) ? v : fallback;
}

function getSettingPercent(ctx, oid, fallback = 0) {
	const v = getSettingInt(ctx, oid, fallback)
	return Math.max(0, Math.min(100, v));
}

function getSettingToggle(ctx, oid, fallback = false) {
	const v = getSetting(ctx, oid);
	return v ? true : false;
}

function chooseWeighted(items, rngKey) {
    let total = 0;
    for (const it of items) {
        if (Number.isInteger(it.weight) && it.weight > 0) total += it.weight;
    }
    if (total <= 0) return null;

    const roll = getCachedRandom(rngKey); // 0..1
    let r = Math.floor(roll * total);

    for (const it of items) {
        const w = it.weight;
        if (!Number.isInteger(w) || w <= 0) continue;

        if (r < w) return it.id;
        r -= w;
    }

    return null;
}

//Fetches all defined role enums
function allRoles(ctx) {
  return Object.values(ctx.all_roles);
}

//Fetches all defined role enums that have the tag
function getRolesWithTag(ctx, tag) {
  return allRoles(ctx).filter(role => role.tags?.includes(tag));
}

//Wrapper function for Loc, to implicitly include executor table
function LocR(key, ctx) {
	return Loc(key, ctx, EXECUTORS);
}

//Executes the rule list, checking condition to run, building the text prompt, and recursively executes subrules.
function runRules(rules, ctx, output) {
    for (const rule of rules) {
        if (rule.condition && !rule.condition(ctx)) continue;

        if (rule.text) {
            let value;

            if (typeof rule.text === "string") {
				value = LocR(rule.text, ctx);
            } else if (
                typeof rule.text === "object" &&
                rule.text.exec &&
                EXECUTORS[rule.text.exec]
            ) {
                value = EXECUTORS[rule.text.exec](ctx, ...(rule.text.args ?? []));
            } else {
                const desc = rule.description ?? "(no description)";
                throw new Error(`Error in rule ${desc}: invalid text or missing executor`);
            }

            if (value) output.push(value);
        }

        if (rule.rules) runRules(rule.rules, ctx, output);
    }
}

function buildPrompt(selectedRoles, settings, all_roles, player_count) {
    const ctx = {
		settings: settings,
		all_roles: all_roles,
		player_count: player_count,
        selectedRoles: new Set(selectedRoles),

        isPresent(role_id) {
            return this.selectedRoles.has(role_id);
        },
        anyPresent(...roles) {
            return roles.some(r => this.isPresent(r));
        },
        anyWithTag(tag) {
            for (const role of Object.values(this.all_roles)) {
                if (
                    role.tags?.includes(tag) &&
                    this.selectedRoles.has(role.id)
                ) {
                    return true;
                }
            }
            return false;
        },		
		anyInTeam(team) {
            for (const role of Object.values(this.all_roles)) {
                if (
                    roleIsTeam(role, team) &&
                    this.selectedRoles.has(role.id)
                ) {
                    return true;
                }
            }
            return false;
        },		
    };

    const paragraphs = [];

    for (const rule of TURN_ORDER) {
        const buffer = [];

        // Treat top-level rule as a one-element rule list
        runRules([rule], ctx, buffer);

        if (buffer.length) {
            paragraphs.push(buffer.join(" ").replace(/\s+,/g, ","));
        }
    }

    return paragraphs.join("\n\n");
}
