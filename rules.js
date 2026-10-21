/*
 * Narration rule engine.
 *
 * Generates an ordered list of narration turns from the currently selected roles. Each turn contains only structured data describing the
 * action and any randomly generated context required to narrate it.
 *
 * This module deliberately does not produce human-readable text. Interpretation and localization of the generated turn data is handled by a
 * separate prompt rendering module.
 */
const Rules = (() => {

	/* =========================
	   Data
	   ========================= */

	// Minimum number of players required to generate a narration prompt.
	const MIN_PLAYERS = 3;

	/*
	 * Resolver functions for TURN_ORDER entries that need to generate additional execution-specific data, such as randomized outcomes,
	 * player selections, or derived values.
	 *
	 * A resolver has the signature: (ctx, action, instigator, data) => resultData
	 *
	 * `data` contains data already supplied by the rule, including any Doppelganger-specific execution data. The returned object is merged
	 * over it.
	 *
	 * Resolvers must return structured data only; they do not generate narration text.
	 */
	const RESOLVERS = {
		/*
		 * Determines what the Alien team does on their collective turn. The view card scenario (individually or collectively) is
		 * implemented as nested tree of weighted choices, where the sub-trees represent the different target selections available.
		 */
		AlienResolver: (ctx, action, instigator, data) => {
			const rngKey = "alien_event" + (data.copiedRole ? "_doppelganger" : "");
			const choices = [
				{ 
					weight: Settings.getValue("alien.view_card_collective"), 
					subevents: [
						{ weight: Settings.getValue("alien.view_card_collective.even"), data: { type: "view_card_collective", target: "even_player", restriction: "any", count: 1 } },
						{ weight: Settings.getValue("alien.view_card_collective.odd"), data: { type: "view_card_collective", target: "odd_player", restriction: "any", count: 1 } },
						{ weight: Settings.getValue("alien.view_card_collective.center"), data: { type: "view_card_collective", target: "center", restriction: "any", count: 1 } },
						{ weight: Settings.getValue("alien.view_card_collective.specific"), data: { type: "view_card_collective", target: "player", restriction: "specific", count: 1, players: _getRandomPlayers(ctx.playerCount, rngKey) } },
					],
				},
				{ 
					weight: Settings.getValue("alien.view_card_individual"), 
					subevents: [
						{ weight: Settings.getValue("alien.view_card_individual.even"), data: { type: "view_card_individual", target: "even_player", restriction: "any", count: 1 } },
						{ weight: Settings.getValue("alien.view_card_individual.odd"), data: { type: "view_card_individual", target: "odd_player", restriction: "any", count: 1 } },
						{ weight: Settings.getValue("alien.view_card_individual.center"), data: { type: "view_card_individual", target: "center", restriction: "any", count: 1 } },
						{ weight: Settings.getValue("alien.view_card_individual.neighbor"), data: { type: "view_card_individual", target: "neighbor", restriction: "any", count: 1 } },
					],
				},
				{ weight: Settings.getValue("alien.nothing"), data: { type: "do_nothing" } },
				{ weight: Settings.getValue("alien.trade_cards") / 2, data: { type: "trade_team_cards", restriction: "left" } },
				{ weight: Settings.getValue("alien.trade_cards") / 2, data: { type: "trade_team_cards", restriction: "right" } },
				{ weight: Settings.getValue("alien.show_cards"), data: { type: "show_team_cards" } },
				{ weight: Settings.getValue("alien.make_alien"), data: { type: "make_alien" } },
				{ weight: Settings.getValue("alien.make_minion"), data: { type: "make_alien_minion" } },
			];

			return _chooseWeightedTree(choices, rngKey);
		},
		/*
		 * Calculates the number of surrounding players the Blob player must protect, scaled up with rising total player count. The final
		 * number of players to protect is balanced evenly to the right and left of the Blob player, with any remainder being randomly
		 * assigned.
		 */
		BlobResolver: (ctx, action, instigator, data) => {
			const rngKey = "blob_event" + (data.copiedRole ? "_doppelganger" : "");

			let blobCount = 0;

			if (ctx.playerCount >= 9) blobCount = 4;
			else if (ctx.playerCount >= 7) blobCount = 3;
			else if (ctx.playerCount >= 5) blobCount = 2;
			else if (ctx.playerCount >= 4) blobCount = 1;

			// Balanced split
			const left = Math.floor(blobCount / 2);
			const right = Math.ceil(blobCount / 2);

			// Randomly flip sides
			const flip = _getCachedRandom(rngKey + ".distribution") < 0.5;
			const finalLeft = flip ? right : left;
			const finalRight = flip ? left : right;

			return { blobTotal: finalLeft + finalRight, blobLeft: finalLeft, blobRight: finalRight };
		},
		// Determines the players that the Bodysnatcher may view and exchange cards with.
		BodysnatcherResolver: (ctx, action, instigator, data) => {
			const rngKey = "bodysnatcher_event" + (data.copiedRole ? "_doppelganger" : "");

			const choices = [
				{ weight: Settings.getValue("bodysnatcher.center"), data: { type: "view_card", target: "center", restriction: "any", count: 1 } },
				{ weight: Settings.getValue("bodysnatcher.neighbor"), data: { type: "view_card", target: "neighbor", restriction: "any", count: 1 } },
				{ weight: Settings.getValue("bodysnatcher.odd"), data: { type: "view_card", target: "odd_player", restriction: "any", count: 1 } },
				{ weight: Settings.getValue("bodysnatcher.even"), data: { type: "view_card", target: "even_player", restriction: "any", count: 1 } },
				{ weight: Settings.getValue("bodysnatcher.specific"), data: { type: "view_card", target: "player", restriction: "specific", count: 1, players: _getRandomPlayers(ctx.playerCount, rngKey) } },
			];

			return { ..._chooseWeightedTree(choices, rngKey) };
		},
		// Produces a seed used by the Random primitive in Localization to pick a question, and a list of players to answer it.
		EmpathResolver: (ctx, action, instigator, data) => {
			const rngKey = "empath_event" + (data.copiedRole ? "_doppelganger" : "");
			const maxPlayers = Math.max(Math.min(Math.floor(ctx.playerCount * 0.3), 4), 1);	// Ensure Empath can't be confirmed by everyone in small games
			const players = _getRandomPlayers(ctx.playerCount, rngKey, 1, maxPlayers);
			const rndSeed = _getCachedRandom(rngKey);

			return { rndSeed: rndSeed, players: players, count: players.length };
		},
		// Determines the number of center cards the Exposer may turn over.
		ExposerResolver: (ctx, action, instigator, data) => {
			const rngKey = "exposer_event" + (data.copiedRole ? "_doppelganger" : "");
			const choices = [
				{ weight: Settings.getValue("exposer.flip_one"), data: { type: "expose_center", count: 1 } },
				{ weight: Settings.getValue("exposer.flip_two"), data: { type: "expose_center", count: 2 } },
				{ weight: Settings.getValue("exposer.flip_three"), data: { type: "expose_center", count: 3 } },
			];

			return _chooseWeightedTree(choices, rngKey);
		},
		// Determines which card(s) the Mortician may view.
		MorticianResolver: (ctx, action, instigator, data) => {
			const rngKey = "mortician_event" + (data.copiedRole ? "_doppelganger" : "");
			const weights = [
				{ weight: Settings.getValue("mortician.neighbor") / 2, data: { type: "view_card", target: "neighbor", restriction: "left", count: 1 } },
				{ weight: Settings.getValue("mortician.neighbor") / 2, data: { type: "view_card", target: "neighbor", restriction: "right", count: 1 } },
				{ weight: Settings.getValue("mortician.both"), data: { type: "view_card", target: "neighbor", restriction: "both", count: 2 } },
				{ weight: Settings.getValue("mortician.self"), data: { type: "view_card", target: "self", count: 1 } },
			];

			return _chooseWeightedTree(weights, rngKey);
		},
		/*
		 * Nostradamus can switch team and have his new team announced. Since this depends on player choice, this can't be determined
		 * programatically and must be inserted by the narrator. In the case where Nostradamus is in the game but ends up in the unused
		 * center cards, the resolver picks a plausible "fallback" identity for him to join. Available choices are evenly weighted across
		 * every evil team currently in play, plus Tanner/Apprentice Tanner individually (since they aren't a team). Only options that are
		 * actually present in the current role selection are offered, with the village team always being present as Nostradamus' default,
		 * and given a weight equal to the sum of all others (50% chance).
		 */
		NostradamusResolver: (ctx, action, instigator, data) => {
			const rngKey = "nostradamus_event" + (data.copiedRole ? "_doppelganger" : "");
			const choices = [];

			// Add all evil teams, if present
			[ "TEAM_WEREWOLF", "TEAM_VAMPIRE", "TEAM_ALIEN" ].forEach((t) => {
				//if (ctx.isTeamPresent(t)) choices.push({ weight: 1, data: { fallbackTeam: t + "_PLURAL_DEFINITE" } });
				if (ctx.isTeamPresent(t)) choices.push({ weight: 1, data: { fallbackTeam: t } });
			});
			// Add Tanner/Apprentice Tanner, if present
			[ "TANNER", "APPRENTICETANNER" ].forEach((t) => {
				if (ctx.isRolePresent(t))
					//choices.push({ weight: 1, data: { fallbackTeam: "ROLE_" + t + "_PLURAL_DEFINITE" } });
					choices.push({ weight: 1, data: { fallbackTeam: "ROLE_" + t } });
			});
			// Add village team (always present, as it's Nostradamus default, and give it a 50% chance
			//choices.push({ weight: Math.max(choices.length, 1), data: { fallbackTeam: "TEAM_VILLAGE_PLURAL_DEFINITE" } });
			choices.push({ weight: Math.max(choices.length, 1), data: { fallbackTeam: "TEAM_VILLAGE" } });

			// Same candidate set that feeds the weighted fallback pick above, reshaped into {value,label} pairs for automatic narration's input
			// options - i.e. "every team Nostradamus's card-viewing could plausibly reveal", not just the one chosen for the no-player case.
			const availableTeams = choices.map(c => ({ value: c.data.fallbackTeam, label: c.data.fallbackTeam }));

			return { ..._chooseWeightedTree(choices, rngKey), availableTeams: availableTeams };
		},
		/*
		 * A more complicated resolver implementation; Oracle's action is a grab-bag of outcome categories, several of which need their own
		 * extra rolls *before* they can even be added as a weighted choice:
		 *
		 *   - "hunt": whether the hunt actually triggers is pre-rolled (`huntActive`) so the resulting turn data can also flag when a hunt
		 *     would reveal a role from a team the current settings consider "shouldn't" be exposed (`showExclusionWarning`).
		 *   - "change_team": only offered at all if an evil team is present; if offered, which team and whether it's a full/partial switch
		 *     are pre-rolled so the option's *data* is decided independent of whether the option is actually chosen.
		 *   - "force_ripple": only offered if the alien team is present (required for any ripple)
		 *
		 * The final _chooseWeightedTree call is wrapped in try/catch purely to produce a clearer diagnostic in the specific case where the
		 * only non-zero weight is "change_team" but no evil team exists to switch to — a misconfiguration that would otherwise surface as
		 * an opaque "total weight is zero" error.
		 *
		 * defaultEvenOdd and defaultJoinAccepted are used by the automatic TTS narration and is deliberately uncached random booleans as
		 * they are intended to emulate a player response at the table if none is given, not a stable value for the script.
		 *
		 * NOTE: this is now effectively a historical artifact. It predates settings.js's requiresContext mechanism, which already declares
		 * oracle.change_team as requiring evilTeamPresent within its weight group — Settings.validate() catches this exact misconfiguration
		 * before Rules.buildPrompt() is ever called from the GUI, so this catch block shouldn't currently be reachable in practice. Left in
		 * deliberately in case a future caller invokes Rules directly without going through settings validation first.
		 */
		OracleResolver: (ctx, action, instigator, data) => {
			const rngKey = "oracle_event" + (data.copiedRole ? "_doppelganger" : "");

			const choices = [
				{
					// View center cards
					weight: Settings.getValue("oracle.view_center"),
					subevents: [
						{ weight: Settings.getValue("oracle.view_center.one"), data: { type: "view_card", target: "center", restriction: "any", count: 1  } },
						{ weight: Settings.getValue("oracle.view_center.two"), data: { type: "view_card", target: "center", restriction: "any", count: 2 } },
						{ weight: Settings.getValue("oracle.view_center.three"), data: { type: "view_card", target: "center", restriction: "any", count: 3 } },
					],
				},
				{
					// View player cards
					weight: Settings.getValue("oracle.view_player"),
					subevents: [
						{ weight: Settings.getValue("oracle.view_player.even"), data: { type: "view_card", target: "even_player", restriction: "any", count: 1 } },
						{ weight: Settings.getValue("oracle.view_player.odd"), data: { type: "view_card", target: "odd_player", restriction: "any", count: 1 } },
						{ weight: Settings.getValue("oracle.view_player.any"), data: { type: "view_card", target: "player", restriction: "any", count: 1 } },
						{ weight: Settings.getValue("oracle.view_player.specific"), data: { type: "view_card", target: "player", restriction: "specific", count: 1, players: _getRandomPlayers(ctx.playerCount, rngKey) } },
					],
				},
				{ weight: Settings.getValue("oracle.block_action"), data: { type: "oracle_block_action" } },
				{ weight: Settings.getValue("oracle.drunk"), data: { type: "role_action", role: "DRUNK" } },
				{ weight: Settings.getValue("oracle.even_odd"), data: { type: "oracle_announce_even_odd", defaultEvenOdd: Math.random() > 0.5 ? "even" : "odd" } },
			];

			if (ctx.isTeamPresent("TEAM_ALIEN") || ctx.isRolePresent("SYNTHETICALIEN"))
				choices.push({ weight: Settings.getValue("oracle.force_ripple"), data: { type: "oracle_force_ripple", defaultRippleForce: false } });

			// Calculate hunt event
			const huntActive = _getCachedRandom(rngKey + ".hunt") * 100 < Settings.getValue("oracle.hunt.chance");
			const allowBad = Settings.getValue("oracle.hunt.allow_bad_teams")
			const exclusionData = allowBad ? {} : ctx.getTagList("ExcludedRoles", "ORACLE_OMNISCIENCE_EXCLUDED");
			const rndSeed = _getCachedRandom(rngKey + ".hunt.question");
			choices.push({ weight: Settings.getValue("oracle.hunt"), data: { type: "oracle_hunt", huntActive: huntActive, rndSeed: rndSeed, ...exclusionData } });

			// Calculate team switch
			const availableTeams = [];
			[ "TEAM_WEREWOLF", "TEAM_VAMPIRE", "TEAM_ALIEN" ].forEach((t) => { 
				if (ctx.isTeamPresent(t))
					availableTeams.push(t);
				else if (t === "TEAM_ALIEN" && ctx.isRolePresent("SYNTHETICALIEN"))
					availableTeams.push(t);
			});

			if (availableTeams.length > 0) {
				const joinFull = _getCachedRandom(rngKey + ".join_team.mode") * 100 < Settings.getValue("oracle.change_team.chance");
				const joinTeam = availableTeams[ Math.floor(_getCachedRandom(rngKey + ".join_team.team") * availableTeams.length) ];
				choices.push({ weight: Settings.getValue("oracle.change_team"), data: { type: "oracle_change_team", joinTeam: joinTeam, joinFull: joinFull, defaultJoinAccepted: Math.random() > 0.5 } });
			}

			try {
				const result = _chooseWeightedTree(choices, rngKey);
				ctx.oracleCanForceRipple = result.type === "oracle_force_ripple";

				return result
			} catch (error) {
				if (availableTeams.length === 0 && Settings.getValue("oracle.change_team") > 0) {
					throw new Error(
						`Oracle has no valid outcome: the only enabled weight is the evil-team switch, but no evil team (Werewolf/Vampire/Alien) is currently in the game.`,
						{ cause: error }
					);
				}
				throw error; // condition doesn't explain it — pass the original through unchanged
			}
		},
		// Determines what card(s) the Psychic is allowed to view.
		PsychicResolver: (ctx, action, instigator, data) => {
			const rngKey = "psychic_event" + (data.copiedRole ? "_doppelganger" : "");
			const doubleCardProbability = Settings.getValue("psychic.double_cards"); // 0...100

			const choices = [
				{ 
					weight: Settings.getValue("psychic.neighbor"),
					subevents: [
						{ weight: doubleCardProbability, data: { type: "view_card", target: "neighbor", restriction: "both", count: 2 } },	// 2 cards
						{ weight: 100-doubleCardProbability, data: { type: "view_card", target: "neighbor", restriction: "any", count: 1 } },	// 1 card
					]
				},
				{ 
					weight: Settings.getValue("psychic.odd"),
					subevents: [
						{ weight: doubleCardProbability, data: { type: "view_card", target: "odd_player", restriction: "any", count: 2 } },	// 2 cards
						{ weight: 100-doubleCardProbability, data: { type: "view_card", target: "odd_player", restriction: "any", count: 1 } },	// 1 card
					]
				},
				{ 
					weight: Settings.getValue("psychic.even"),
					subevents: [
						{ weight: doubleCardProbability, data: { type: "view_card", target: "even_player", restriction: "any", count: 2 } },	// 2 cards
						{ weight: 100-doubleCardProbability, data: { type: "view_card", target: "even_player", restriction: "any", count: 1 } },	// 1 card
					]
				},
				{ 
					weight: Settings.getValue("psychic.specific"),
					subevents: [
						{ weight: doubleCardProbability, data: { type: "view_card", target: "player", restriction: "specific", count: 2, players: _getRandomPlayers(ctx.playerCount, rngKey, 2, 2) } },	// 2 cards
						{ weight: 100-doubleCardProbability, data: { type: "view_card", target: "player", restriction: "specific", count: 1, players: _getRandomPlayers(ctx.playerCount, rngKey) } },	// 1 card
					]
				},
			];

			return _chooseWeightedTree(choices, rngKey);
		},
		//Determines the random role action the Rascal will perform.
		RascalResolver: (ctx, action, instigator, data) => {
			const rngKey = "rascal_event" + (data.copiedRole ? "_doppelganger" : "");
			const choices = [
				{ weight: Settings.getValue("rascal.troublemaker"), data: { type: "role_action", role: "TROUBLEMAKER" } },
				{ weight: Settings.getValue("rascal.robber"), data: { type: "role_action", role: "ROBBER" } },
				{ weight: Settings.getValue("rascal.witch"), data: { type: "role_action", role: "WITCH" } },
				{ weight: Settings.getValue("rascal.villageidiot"), data: { type: "role_action", role: "VILLAGEIDIOT" } },
				{ weight: Settings.getValue("rascal.drunk"), data: { type: "role_action", role: "DRUNK" } },
			];

			return _chooseWeightedTree(choices, rngKey);
		},
		/*
		 * "Ripple" is a special turn that can layer a secondary effect onto the game (re-running another role's action on a random player,
		 * muting/rebuking players, granting a double vote, etc.). It can only happen if at least one alien role (including the Synthetic)
		 * is present in the game.
		 *
		 * Player selections for every possible outcome are pre-rolled up front (`rndPlayers`, `rndEffectPlayers`) and reused across choices
		 * so that whichever outcome is ultimately chosen already has consistent, cached player picks rather than each branch rolling its
		 * own.
		 *
		 * "none" (no ripple) is intentionally the last entry in `choices` so it can be sliced off: if the first roll lands on "none", a
		 * second roll (".backup") is made against every *other* option to guarantee a real ripple is always available as a backup — this
		 * exists because Oracle's "force_ripple"-style outcome can force a ripple to occur even when the primary roll said there wouldn't
		 * be one. `noRipple` reports whether the primary roll actually wanted a ripple, so callers can tell a "genuine" ripple from a
		 * "backup one that only exists in case it's needed".
		 *
		 * This can't be resolved purely programmatically: forcing a ripple is a live player-response event (the narrator asks the Oracle
		 * player a yes/no question and gets a physical nod/shake in response), so the actual decision of whether to use the backup happens
		 * at the table, not in code — the resolver just needs to always have a valid backup on hand in case it's needed.
		 *
		 * POTENTIAL ISSUE: if every ripple effect except "none" is set to weight 0, no backup ripple can be rolled. This is guarded against
		 * in the settings validation, ensuring that at least one non-none ripple is available if an Oracle is present and has the force
		 * ripple option, which is currently the only scenario in which a backup ripple is rolled.
		 */
		RippleResolver: (ctx, action, instigator, data) => {
			const rngKey = "ripple_event";
			// Pre-compute these and reuse for the different options
			const rndPlayers = _getRandomPlayers(ctx.playerCount, rngKey + ".view_players", 3, 3);	
			const rndEffectPlayers = _getRandomPlayers(ctx.playerCount, rngKey + ".effect_players", 1, "20%");

			const choices = [
				{ weight: Settings.getValue("ripple.one_minute"), data: { type: "ripple_timer" } },
				{ weight: Settings.getValue("ripple.insomniac"), data: { type: "ripple_role_action", role: "INSOMNIAC", player: rndPlayers[0] } },
				{ weight: Settings.getValue("ripple.troublemaker"), data: { type: "ripple_role_action", role: "TROUBLEMAKER", player: rndPlayers[0] } },
				{ weight: Settings.getValue("ripple.robber"), data: { type: "ripple_role_action", role: "ROBBER", player: rndPlayers[0] } },
				{ weight: Settings.getValue("ripple.witch"), data: { type: "ripple_role_action", role: "WITCH", player: rndPlayers[0] } },
				{ weight: Settings.getValue("ripple.revealer"), data: { type: "ripple_role_action", role: "REVEALER", player: rndPlayers[0], ...ctx.getTagList("HiddenRoles", "REVEALER_HIDDEN_ROLE") } },
				{ weight: Settings.getValue("ripple.drunk"), data: { type: "ripple_role_action", role: "DRUNK", player: rndPlayers[0] } },
				{ weight: Settings.getValue("ripple.muted"), data: { type: "ripple_mute", players: rndEffectPlayers, count: rndEffectPlayers.length } },
				{ weight: Settings.getValue("ripple.rebuked"), data: { type: "ripple_rebuked", players: rndEffectPlayers, count: rndEffectPlayers.length } },
				{ weight: Settings.getValue("ripple.view_player"), data: { type: "ripple_view_player", count: 1, target: "player", restriction: "specific", player: rndPlayers[0], players: rndPlayers.slice(-1), count: 1 } },
				{ weight: Settings.getValue("ripple.dual_view_player"), data: { type: "ripple_view_player", count: 2, target: "player", restriction: "specific", player: rndPlayers[0], players: rndPlayers.slice(-2), count: 2 } },
				{ weight: Settings.getValue("ripple.double_vote"), data: { type: "ripple_double_vote", players: rndEffectPlayers, count: rndEffectPlayers.length } },
			];
			choices.push({ weight: Settings.getValue("ripple.none"), data: { type: "none" } });	// Ensure that this entry is always last so that the backup ripple can exclude it

			let result = _chooseWeightedTree(choices, rngKey);
			const noRipple = result.type === "none";

			// If the first result is no ripple but the Oracle can force one, add a backup ripple in case the Oracle chooses to do so
			if (noRipple && ctx.oracleCanForceRipple) {
				result = _chooseWeightedTree(choices.slice(0, choices.length-1), rngKey + ".backup");
			}

			return { ...result, noRipple: noRipple, oracleCanForceRipple: ctx.oracleCanForceRipple };
		},
	};

	/*
	 * Declarative narration turn definitions, evaluated from top to bottom by buildPrompt(). Turns are declared in chronological order,
	 * mirroring how they will be ordered in the final game script.
	 *
	 * Every entry must define:
	 *   action      - action/narration key used by Interpreter.
	 *   instigator  - identity performing the action.
	 *
	 * Optional fields:
	 *   condition     - returns whether the turn should be included for the current role selection. Always include if omitted,
	 *   resolveData   - function producing additional data for the turn.
	 *   resolver      - name of a function in RESOLVERS that produces additional data.
	 *   doppelganger  - controls how the Doppelganger participates:
	 *     "inline"    - included in the normal turn; `hasDoppelganger` is added to its data.
	 *     "echo"      - the turn is repeated as a separate turn immediately afterward by the Doppelganger, with the instigator switched to
	 *                   the Doppelganger and `copiedRole` set to the original instigator in the resolveData.
	 *
	 * The array order is significant: turns are generated in exactly this order.
	 */
	const TURN_ORDER = [
		{
			action: "UNIVERSAL_SLEEP",
			instigator: "SPECIAL_ALL"
		},
		{
			action: "ORACLE",
			instigator: "ROLE_ORACLE",
			condition: ctx => ctx.isRolePresent("ORACLE"),
			resolver: "OracleResolver",
		},
		{
			action: "COPYCAT",
			instigator: "ROLE_COPYCAT",
			condition: ctx => ctx.isRolePresent("COPYCAT")
		},
		{
			action: "DOPPELGANGER",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isRolePresent("DOPPELGANGER") && ctx.isAnyTagPresent("MARKS_ROLE"),
			resolveData: ctx => ({ 
				...ctx.getTagList("ImmediateActionRoles", "DOPPELGANGER_IMMEDIATE_ACTION"),
				...ctx.getTeamList("EvilTeams", "TEAM_ALIEN", "TEAM_VAMPIRE", "TEAM_WEREWOLF"),
				hasDreamWolf: ctx.isRolePresent("DREAMWOLF"),
			}),
		},
		{
			action: "VAMPIRE_TEAM",
			instigator: "TEAM_VAMPIRE",
			condition: ctx => ctx.isTeamPresent("TEAM_VAMPIRE"),
			doppelganger: "inline",
		},
		{
			action: "COUNT",
			instigator: "ROLE_COUNT",
			condition: ctx => ctx.isRolePresent("COUNT"),
			doppelganger: "echo",
		},
		{
			action: "RENFIELD",
			instigator: "ROLE_RENFIELD",
			condition: ctx => ctx.isRolePresent("RENFIELD"),
			doppelganger: "inline",
		},
		{
			action: "DISEASED",
			instigator: "ROLE_DISEASED",
			condition: ctx => ctx.isRolePresent("DISEASED")
		},
		{
			action: "CUPID",
			instigator: "ROLE_CUPID",
			condition: ctx => ctx.isRolePresent("CUPID")
		},
		{
			action: "INSTIGATOR",
			instigator: "ROLE_INSTIGATOR",
			condition: ctx => ctx.isRolePresent("INSTIGATOR")
		},
		{
			action: "PRIEST",
			instigator: "ROLE_PRIEST",
			condition: ctx => ctx.isRolePresent("PRIEST"),
			doppelganger: "echo",
		},
		{
			action: "ASSASSIN",
			instigator: "ROLE_ASSASSIN",
			condition: ctx => ctx.isRolePresent("ASSASSIN"),
			resolveData: ctx => ({ hasApprenticeAssassin: ctx.isRolePresent("APPRENTICEASSASSIN") }),
			doppelganger: "inline"
		},
		{
			// Explicit Doppelganger echoed turn, as it must exclude the apprentice
			action: "ASSASSIN",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("ASSASSIN", "DOPPELGANGER"),
			resolveData: ctx => ({ copiedRole: "ROLE_ASSASSIN" }),
		},
		{
			action: "CHECK_MARKS",
			instigator: "SPECIAL_ALL",
			condition: ctx => ctx.isAnyTagPresent("MARKS_ROLE")
		},
		{
			action: "LOVERS",
			instigator: "SPECIAL_LOVERS",
			condition: ctx => ctx.isRolePresent("CUPID")
		},
		{
			action: "SENTINEL",
			instigator: "ROLE_SENTINEL",
			condition: ctx => ctx.isRolePresent("SENTINEL")
		},
		{
			action: "DOPPELGANGER",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isRolePresent("DOPPELGANGER") && !ctx.isAnyTagPresent("MARKS_ROLE"),
			resolveData: ctx => ({ 
				...ctx.getTagList("ImmediateActionRoles", "DOPPELGANGER_IMMEDIATE_ACTION"),
				...ctx.getTeamList("EvilTeams", "TEAM_ALIEN", "TEAM_VAMPIRE", "TEAM_WEREWOLF"),
				hasDreamWolf: ctx.isRolePresent("DREAMWOLF"),
			}),
		},
		{
			action: "ALIEN_TEAM",
			instigator: "TEAM_ALIEN",
			condition: ctx => ctx.isTeamPresent("TEAM_ALIEN") || ctx.isRolePresent("SYNTHETICALIEN"),
			resolver: "AlienResolver",
			resolveData: ctx => ({ hasCow: ctx.isRolePresent("COW") }),
			doppelganger: "inline",
		},
		{
			action: "FEUDINGALIENS",
			instigator: "ROLE_FEUDINGALIENS",
			condition: ctx => ctx.isRolePresent("FEUDINGALIENS"),
			doppelganger: "inline",
		},
		{
			action: "BODYSNATCHER",
			instigator: "ROLE_BODYSNATCHER",
			condition: ctx => ctx.isRolePresent("BODYSNATCHER"),
			resolver: "BodysnatcherResolver",
			doppelganger: "echo",
		},
		{
			action: "WEREWOLF_TEAM",
			instigator: "TEAM_WEREWOLF",
			condition: ctx => ctx.isAnyRolePresent("WEREWOLF", "ALPHAWOLF", "MYSTICWOLF"),
			resolveData: ctx => ({ hasDreamWolf: ctx.isRolePresent("DREAMWOLF") }),
			doppelganger: "inline",
		},
		{
			action: "ALPHAWOLF",
			instigator: "ROLE_ALPHAWOLF",
			condition: ctx => ctx.isRolePresent("ALPHAWOLF")
		},
		{
			action: "MYSTICWOLF",
			instigator: "ROLE_MYSTICWOLF",
			condition: ctx => ctx.isRolePresent("MYSTICWOLF"),
			resolveData: ctx => ({ type: "view_card", target: "player", restriction: "any", count: 1 }),
		},
		{
			action: "MINION",
			instigator: "ROLE_MINION",
			condition: ctx => ctx.isRolePresent("MINION") && ctx.isTeamPresent("TEAM_WEREWOLF"),
			doppelganger: "inline",
		},
		{
			action: "APPRENTICETANNER",
			instigator: "ROLE_APPRENTICETANNER",
			condition: ctx => ctx.isRolePresent("APPRENTICETANNER") && ctx.isRolePresent("TANNER"),
			doppelganger: "inline",
		},
		{
			action: "LEADER",
			instigator: "ROLE_LEADER",
			condition: ctx => ctx.isRolePresent("LEADER") && (ctx.isTeamPresent("TEAM_ALIEN") || ctx.isRolePresent("SYNTHETICALIEN")),
			resolveData: ctx => ({ hasFeudingAliens: ctx.isRolePresent("FEUDINGALIENS") }),
			doppelganger: "inline",
		},
		{
			action: "MASON",
			instigator: "ROLE_MASON",
			condition: ctx => ctx.getTotalRoleCountPresent("MASON", "DOPPELGANGER") >= 2,
			doppelganger: "inline",
		},
		{
			action: "THING",
			instigator: "ROLE_THING",
			condition: ctx => ctx.isRolePresent("THING")
		},
		{
			action: "SEER",
			instigator: "ROLE_SEER",
			condition: ctx => ctx.isRolePresent("SEER")
		},
		{
			action: "APPRENTICESEER",
			instigator: "ROLE_APPRENTICESEER",
			condition: ctx => ctx.isRolePresent("APPRENTICESEER"),
			resolveData: ctx => ({ type: "view_card", target: "center", restriction: "any", count: 1 }),
		},
		{
			action: "PARANORMALINVESTIGATOR",
			instigator: "ROLE_PARANORMALINVESTIGATOR",
			condition: ctx => ctx.isRolePresent("PARANORMALINVESTIGATOR"),
			resolveData: ctx => ({ ...ctx.getTagList("DangerRoles", "PI_CONVERSION_ROLE") }),
		},
		{
			action: "MARKSMAN",
			instigator: "ROLE_MARKSMAN",
			condition: ctx => ctx.isRolePresent("MARKSMAN"),
			doppelganger: "echo",
		},
		{
			action: "NOSTRADAMUS",
			instigator: "ROLE_NOSTRADAMUS",
			condition: ctx => ctx.isRolePresent("NOSTRADAMUS"),
			resolver: "NostradamusResolver",
			resolveData: ctx => ({ ...ctx.getTagList("DangerRoles", "PI_CONVERSION_ROLE") }),
			doppelganger: "inline",
		},
		{
			action: "PSYCHIC",
			instigator: "ROLE_PSYCHIC",
			condition: ctx => ctx.isRolePresent("PSYCHIC"),
			resolver: "PsychicResolver",
			doppelganger: "echo",
		},
		{
			action: "ROBBER",
			instigator: "ROLE_ROBBER",
			condition: ctx => ctx.isRolePresent("ROBBER")
		},
		{
			action: "WITCH",
			instigator: "ROLE_WITCH",
			condition: ctx => ctx.isRolePresent("WITCH")
		},
		{
			action: "PICKPOCKET",
			instigator: "ROLE_PICKPOCKET",
			condition: ctx => ctx.isRolePresent("PICKPOCKET"),
			doppelganger: "echo",
		},
		{
			action: "TROUBLEMAKER",
			instigator: "ROLE_TROUBLEMAKER",
			condition: ctx => ctx.isRolePresent("TROUBLEMAKER")
		},
		{
			action: "VILLAGEIDIOT",
			instigator: "ROLE_VILLAGEIDIOT",
			condition: ctx => ctx.isRolePresent("VILLAGEIDIOT")
		},
		{
			action: "AURASEER",
			instigator: "ROLE_AURASEER",
			condition: ctx => ctx.isRolePresent("AURASEER") && ctx.isAnyTagPresent("AURA_SEER_DETECTABLE"),
			resolveData: ctx => ({ ...ctx.getTagList("DetectableRoles", "AURA_SEER_DETECTABLE") }),
			doppelganger: "inline",
		},
		{
			action: "GREMLIN",
			instigator: "ROLE_GREMLIN",
			condition: ctx => ctx.isRolePresent("GREMLIN"),
			doppelganger: "echo",
		},
		{
			action: "RASCAL",
			instigator: "ROLE_RASCAL",
			condition: ctx => ctx.isRolePresent("RASCAL"),
			resolver: "RascalResolver",
			doppelganger: "echo",
		},
		{
			action: "DRUNK",
			instigator: "ROLE_DRUNK",
			condition: ctx => ctx.isRolePresent("DRUNK")
		},
		{
			action: "INSOMNIAC",
			instigator: "ROLE_INSOMNIAC",
			condition: ctx => ctx.isRolePresent("INSOMNIAC"),
			doppelganger: "echo",
		},
		{
			action: "SQUIRE",
			instigator: "ROLE_SQUIRE",
			condition: ctx => ctx.isRolePresent("SQUIRE") && ctx.isTeamPresent("TEAM_WEREWOLF"),
			doppelganger: "inline",
		},
		{
			action: "BEHOLDER",
			instigator: "ROLE_BEHOLDER",
			condition: ctx => ctx.isRolePresent("BEHOLDER") && ctx.isAnyTagPresent("BEHOLDER_DETECTABLE"),
			resolveData: ctx => ({ ...ctx.getTagList("DetectableRoles", "BEHOLDER_DETECTABLE") }),
			doppelganger: "inline",
		},
		{
			action: "REVEALER",
			instigator: "ROLE_REVEALER",
			condition: ctx => ctx.isRolePresent("REVEALER"),
			resolveData: ctx => ({ ...ctx.getTagList("HiddenRoles", "REVEALER_HIDDEN_ROLE") }),
			doppelganger: "echo",
		},
		{
			action: "EXPOSER",
			instigator: "ROLE_EXPOSER",
			condition: ctx => ctx.isRolePresent("EXPOSER"),
			resolver: "ExposerResolver",
			doppelganger: "echo",
		},
		{
			action: "EMPATH",
			instigator: "ROLE_EMPATH",
			condition: ctx => ctx.isRolePresent("EMPATH"),
			resolver: "EmpathResolver",
			doppelganger: "echo",
		},
		{
			action: "CURATOR",
			instigator: "ROLE_CURATOR",
			condition: ctx => ctx.isRolePresent("CURATOR"),
			doppelganger: "echo",
		},
		{
			action: "BLOB",
			instigator: "ROLE_BLOB",
			condition: ctx => ctx.isRolePresent("BLOB"),
			resolver: "BlobResolver",
			doppelganger: "echo",
		},
		{
			action: "MORTICIAN",
			instigator: "ROLE_MORTICIAN",
			condition: ctx => ctx.isRolePresent("MORTICIAN"),
			resolver: "MorticianResolver",
			doppelganger: "echo",
		},
		{
			action: "RIPPLE",
			instigator: "INSTIGATOR_MISSING",
			condition: ctx => ctx.isTeamPresent("TEAM_ALIEN") || ctx.isRolePresent("SYNTHETICALIEN"),
			resolver: "RippleResolver",
		},
		{
			action: "UNIVERSAL_WAKE",
			instigator: "SPECIAL_ALL"
		},
	];

	/*
	 * Cached random values keyed by logical event.
	 *
	 * Each key produces one stable random value until rerandomize() clears the cache, allowing repeated prompt generation to preserve
	 * existing random choices.
	 */
	const RNG_CACHE = Object.create(null);


	/* =========================
	   Initialization
	   ========================= */

	function _init() {

	}

	_init();


	/* =========================
	   Private functions
	   ========================= */

	/**
	 * Selects a random set of distinct player numbers.
	 *
	 * `min` and `max` may be integer counts or percentage strings. Percentages are rounded up and all counts are clamped to the available
	 * player count. Player selection and the selected count are cached using `rndKey`, so repeated calls with the same key return the same
	 * result until rerandomize() is called.
	 *
	 * @param {number} playerCount - Number of players in the game.
	 * @param {string} rndKey - Base key used for cached random values.
	 * @param {number|string} min - Minimum number of players to select.
	 * @param {number|string} max - Maximum number of players to select.
	 * @returns {number[]} Distinct player numbers in draw order.
	 */
	function _getRandomPlayers(playerCount, rndKey, min = 1, max = 1) {
		rndKey += ".players";

		function parseArg(arg) {
			if (typeof arg === "string" && arg.endsWith("%")) {
				const p = parseFloat(arg) / 100.0;
				return Math.ceil(playerCount * p);
			}

			if (typeof arg === "number" && Number.isInteger(arg)) {
				return arg;
			}

			throw new Error(`_getRandomPlayers: invalid min/max player argument(s) for '${rndKey}': ${min} / ${max}`);
		}

		let minAbs = parseArg(min) ?? 1;
		let maxAbs = parseArg(max) ?? minAbs;

		if (minAbs > maxAbs) {
			[minAbs, maxAbs] = [maxAbs, minAbs];
		}

		minAbs = Math.min(minAbs, playerCount);
		maxAbs = Math.min(maxAbs, playerCount);

		const amount = Math.floor(_getCachedRandom(rndKey) * (maxAbs - minAbs + 1)) + minAbs;
		// console.log(min + ", " + max + ", " + minAbs + ", " + maxAbs + ", " + amount);

		const allPlayers = Array.from({length: playerCount}, (_, i) => i + 1);
		const players = [];

		for (let i = 0; i < amount; i++) {
			const idx = Math.floor(_getCachedRandom(rndKey + ".player_" + i) * allPlayers.length);
			players.push(allPlayers.splice(idx, 1)[0]);
		}

		return players;
	}

	/**
	 * Returns the cached random value for a key, generating it with Math.random() when the key has not been used yet.
	 *
	 * @param {string} key - Cache key.
	 * @returns {number} Cached random value in the range [0, 1).
	 */
	function _getCachedRandom(key) {
		let v = RNG_CACHE[key];
		if (v == null) {
			v = Math.random();
			RNG_CACHE[key] = v;
		}
		return v;
	}

	/**
	 * Selects one item from a flat weighted list using a cached random value.
	 *
	 * Zero-weight items cannot be selected. All weights must be finite and non-negative, and at least one weight must be greater than zero.
	 *
	 * @param {{weight: number, data: any}[]} items - Weighted options.
	 * @param {string} rngKey - Cache key for the random selection.
	 * @returns {any} The selected item's `data`.
	 * @throws {Error} If the list is empty, contains an invalid weight, or all weights are zero.
	 */
	function _chooseWeighted(items, rngKey) {
		if (!Array.isArray(items) || items.length === 0)
			throw new Error(`_chooseWeighted: no options provided for evaluation '${rngKey}'`);

		let total = 0;
		for (const it of items) {
			if (!Number.isFinite(it.weight) || it.weight < 0)
				throw new Error(`_chooseWeighted: weight '${it.weight}' is not a non-negative number for evaluation '${rngKey}'`);

			total += it.weight;
		}

		if (total <= 0)
			throw new Error(`_chooseWeighted: total weight is zero for evaluation '${rngKey}'`);

		const roll = _getCachedRandom(rngKey); // 0..1
		let r = roll * total;

		for (const it of items) {
			if (it.weight <= 0)
				continue;

			if (r < it.weight)
				return it.data;

			r -= it.weight;
		}

		// Return last option as last resort in case accumulated floating point errors causes a failure to match
		return items[items.length - 1].data;
	}

	/**
	 * Flattens a nested weighted option tree into weighted leaf options.
	 *
	 * A node with a non-empty `subevents` array is treated as a nested branch; otherwise it is treated as a leaf and must contain `data`.
	 * Nested weights are combined so the result can be passed directly to _chooseWeighted().
	 *
	 * @param {{weight: number, subevents?: object[], data?: any}[]} nodes - Weighted options or nested branches.
	 * @param {number} scale - Probability share represented by this level.
	 * @returns {{weight: number, data: any}[]} Flattened weighted leaves.
	 * @throws {Error} If the node list is empty, contains an invalid weight, or a leaf has no data.
	 */
	function _flattenWeighted(nodes, scale = 1) {
		if (!Array.isArray(nodes) || nodes.length === 0)
			throw new Error("_flattenWeighted: no options provided");

		let total = 0;

		for (const node of nodes) {
			if (!Number.isFinite(node.weight) || node.weight < 0)
				throw new Error(`_flattenWeighted: weight '${node.weight}' is not a non-negative number`);

			total += node.weight;
		}

		const result = [];
		for (const node of nodes) {
			const share = total > 0 ? (node.weight / total) * scale : 0;

			if (Array.isArray(node.subevents) && node.subevents.length > 0) {
				if (share > 0) // no point recursing into a branch that can never be picked
					result.push(..._flattenWeighted(node.subevents, share));
			} else {
				if (node.data == null)
					throw new Error("_flattenWeighted: leaf option is missing data");

				result.push({ weight: share, data: node.data });
			}
		}

		return result;
	}

	/**
	 * Flattens a weighted option tree and selects one leaf.
	 *
	 * @param {{weight: number, subevents?: object[], data?: any}[]} nodes - Weighted options or nested branches.
	 * @param {string} rngKey - Cache key for the random selection.
	 * @returns {any} The selected leaf's `data`.
	 */
	function _chooseWeightedTree(nodes, rngKey) {
		return _chooseWeighted(_flattenWeighted(nodes), rngKey);
	}

	/**
	 * Expands composite roles into their component role IDs for narration.
	 *
	 * Roles without `subRoles` are returned unchanged. Composite roles are replaced entirely by their `subRoles`; dropping the parent from
	 * the result.
	 *
	 * @param {string[]} roleIDs - Role IDs to expand.
	 * @returns {string[]} Role IDs with composite roles expanded.
	 */
	function _expandCompositeRoles(roleIDs) {
		return roleIDs.flatMap(id => Roles.getSubRoles(id) ?? [id]);;
	}

	/**
	 * Executes a TURN_ORDER rule and appends the resulting turn to an output array.
	 *
	 * Resolution errors are caught and stored as an error turn so one failed rule does not abort prompt generation.
	 *
	 * @param {object} ctx - Current rule evaluation context.
	 * @param {object[]} turns - Array receiving the generated turn.
	 * @param {object} rule - TURN_ORDER entry to execute.
	 * @param {string} instigator - Effective instigator; defaults to the rule's instigator.
	 * @param {object} executionData - Additional data for this execution.
	 */
	function _appendTurn(ctx, turns, rule, instigator = rule.instigator, executionData = {}) {
		try {
			turns.push(_runRule(ctx, rule, instigator, executionData));
		} catch (error) {
			turns.push({ action: rule.action, instigator: instigator, error: error });
		}
	}

	/**
	 * Executes one TURN_ORDER rule and produces its structured turn data.
	 *
	 * Rule-provided `resolveData`, execution-specific data, and any resolver result are combined into the turn. For `doppelganger:
	 * "inline"` rules, `hasDoppelganger` is added automatically.
	 *
	 * @param {object} ctx - Current rule evaluation context.
	 * @param {object} rule - TURN_ORDER entry to execute.
	 * @param {string} instigator - Effective instigator for this execution.
	 * @param {object} extraData - Additional execution-specific data.
	 * @returns {{action: string, instigator: string, data: object}} Structured turn.
	 * @throws {Error} If the rule has no action or instigator, or references an unknown resolver.
	 */
	function _runRule(ctx, rule, instigator = rule.instigator, extraData = {}) {
		if (!rule.action || !instigator)
			throw new Error(`TURN_ORDER entry missing required action/instigator: ${JSON.stringify(rule)}`);

		const resolveFn = rule.resolver ? RESOLVERS[rule.resolver] : null;
		if (rule.resolver && !resolveFn)
			throw new Error(`TURN_ORDER entry '${rule.action}'/'${instigator}' references unknown resolver '${rule.resolver}'`);

		const resolveData = { ...(rule.resolveData ? rule.resolveData(ctx) : {}), ...(rule.doppelganger === "inline" ? { hasDoppelganger: ctx.isRolePresent("DOPPELGANGER") } : {}), ...extraData };
		const resolveResult = resolveFn ? resolveFn(ctx, rule.action, instigator, resolveData) ?? {} : resolveData;

		return { action: rule.action, instigator: instigator, data: { ...resolveData, ...resolveResult } };
	}

	/**
	 * Creates the evaluation context passed to every rule.
	 *
	 * The context exposes convenience queries over the selected role set, allowing rule conditions and resolvers to remain declarative
	 * rather than repeatedly inspecting the raw role collection.
	 *
	 * Fields:
	 *    playerCount          - Number of players in the game based on selected roles.
	 *    selectedRoles        - Selected roles and instance counts (same as function parameter).
	 *    oracleCanForceRipple - Mutable flag set by the Oracle resolver, allows the Ripple resolver to decide whether to generate a backup
	 *                           ripple.
	 *
	 * Query and helper functions:
	 *    isRolePresent(roleID)                - True if a role is in the selection
	 *    isMinRolePresent(roleID, minCount)   - True if at least minCount instances of a role is in the selection
	 *    isAllRolesPresent(...roleIDs)        - True if all provided roles are in the selection
	 *    isAnyRolePresent(...roleIDs)         - True if any of the provided roles are in the selection
	 *    isAnyTagPresent(tag)                 - True if any role with the tag is in the selection
	 *    isTeamPresent(team)                  - True if any role belonging to the team is in the selection
	 *    getRoleCountPresent(roleID)          - The number of instances of a role in the selection
	 *    getTotalRoleCountPresent(...roleIDs) - The total number of instances of all the provided roles in the selection
	 *    getRolesPresentWithTag(tag)          - An array of role IDs for all roles in the selection that have the tag
	 *    getRolesPresentWithAllTags(...tags)  - An array with the role IDs of all roles in the selection that has all the provided tags
	 *    getRolesPresentInTeam(team)          - An array of role IDs for all roles in the selection that belong to the team
	 *    getTagList(fieldName, tag)           - An object containing information about roles in the selection that have the provided tag:
	 *                                             has<fieldName>   - true if at least one matching role is found, else false.
	 *                                             count<fieldName> - total number of matching roles found.
	 *                                             list<fieldName>  - an array of all matching role IDs.
	 *                                           Primarily used for generating necessary data for a turn resolver and/or to be passed
	 *                                           onward. E.g. getTagList("Test", "SOME_TAG") would generate:
	 *                                             { hasTest: ..., countTest: ..., listTest: [ ... ] }
	 *                                           with values based on the selected roles that have the SOME_TAG tag.
	 *    getTeamList(fieldName, ...teams)     - Similar to getTagList, except returns boolean, count and list based on which of the
	 *                                           provided teams have at least one role present in the game
	 *
	 * @param {Map<string, number>} roleCounts - Selected role IDs and instance counts.
	 * @returns {object} Evaluation context for the current role selection.
	 */
	function _makeCtx(roleCounts) {
		return {
			playerCount: Roles.calculatePlayerCount(roleCounts),
			selectedRoles: roleCounts,
			oracleCanForceRipple: false, // Flag for the ripple resolver to generate a backup if true, mutated by the Oracle resolver

			isRolePresent(roleID) {
				return this.selectedRoles.has(roleID);
			},
			isMinRolePresent(roleID, minCount) {
				return (this.selectedRoles.get(roleID) ?? 0) >= minCount;
			},
			isAllRolesPresent(...roleIDs) {
				return roleIDs.every(roleID => this.isRolePresent(roleID));
			},
			isAnyRolePresent(...roleIDs) {
				return roleIDs.some(roleID => this.isRolePresent(roleID));
			},
			isAnyTagPresent(tag) {
				for (const roleID of this.selectedRoles.keys()) {
					if (Roles.hasTag(roleID, tag))
						return true;
				}

				return false;
			},
			isTeamPresent(team) {
				for (const roleID of this.selectedRoles.keys()) {
					if (Roles.isTeam(roleID, team))
						return true;
				}

				return false;
			},
			getRoleCountPresent(roleID) {
				return this.selectedRoles.get(roleID) ?? 0;
			},
			getTotalRoleCountPresent(...roleIDs) {
				let count = 0;
				for (const roleID of roleIDs) {
					count += this.getRoleCountPresent(roleID);
				}
				return count;
			},
			getRolesPresentWithTag(tag) {
				return _expandCompositeRoles([...this.selectedRoles.keys()].filter(roleID => Roles.hasTag(roleID, tag)));
			},
			getRolesPresentWithAllTags(...tags) {
				return _expandCompositeRoles([...this.selectedRoles.keys()].filter(roleID => Roles.hasAllTags(roleID, ...tags)));
			},
			getRolesPresentInTeam(team) {
				return _expandCompositeRoles([...this.selectedRoles.keys()].filter(roleID => Roles.isTeam(roleID, team)));
			},
			getTagList(fieldName, tag) {
				const list = this.getRolesPresentWithTag(tag);
				return { ["has" + fieldName]: list.length > 0, ["count" + fieldName]: list.length, ["list" + fieldName]: list };
			},
			getTeamList(fieldName, ...teams) {
				const list = [];
				for (const team of teams) {
					// Need to special-case the Synthetic Alien since it is technically not a member of the alien team, but acts like it
					if (this.isTeamPresent(team) || (team === "TEAM_ALIEN" && this.isRolePresent("SYNTHETICALIEN")))
						list.push(team);
				}
				return { ["has" + fieldName]: list.length > 0, ["count" + fieldName]: list.length, ["list" + fieldName]: list };
			},
		};
	}


	/* =========================
	   Public functions
	   ========================= */

	/**
	 * Clears all cached random values.
	 *
	 * The next prompt generation will reroll every randomized choice.
	 */
	function rerandomize() {
		for (const k in RNG_CACHE) delete RNG_CACHE[k];
	}

	/**
	 * Generates the complete structured narration sequence for the selected roles.
	 *
	 * TURN_ORDER is evaluated from top to bottom. Rules whose conditions pass produce turns, including any resolved random data and
	 * Doppelganger handling. Rules using `doppelganger: "echo"` produce an additional turn immediately after the original, while
	 * `doppelganger: "inline"` adds `hasDoppelganger` to the turn data. Resolution errors are preserved as error turns rather than aborting
	 * generation.
	 *
	 * @param {Map<string, number>} roleCounts - Selected role IDs and their instance counts.
	 * @returns {{turns: object[], insufficientPlayers: boolean}} Generated turns and whether the player count is below MIN_PLAYERS.
	 */
	function buildPrompt(roleCounts) {
		const ctx = _makeCtx(roleCounts);

		if (ctx.playerCount < MIN_PLAYERS)
			return { turns: [], insufficientPlayers: true };

		const turns = [];
		const hasDoppelganger = ctx.isRolePresent("DOPPELGANGER");

		for (const rule of TURN_ORDER) {
			if (rule.condition && !rule.condition(ctx))
				continue;

			// Execute the rule normally.
			_appendTurn(ctx, turns, rule);

			// If this action is echoed by the Doppelganger, execute the same rule immediately afterward using ROLE_DOPPELGANGER as the instigator.
			if (rule.doppelganger === "echo" && hasDoppelganger) {
				_appendTurn(ctx, turns, rule, "ROLE_DOPPELGANGER", { copiedRole: rule.instigator });
			}
		}

		return { turns: turns, insufficientPlayers: false };
	}


	return {
		buildPrompt,
		rerandomize,
	};

})();