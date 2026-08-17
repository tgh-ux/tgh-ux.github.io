/*
 * Narration rule engine.
 *
 * Generates an ordered list of narration turns from the currently selected roles. Each turn contains only structured data describing the action and
 * any randomly generated context required to narrate it.
 *
 * This module deliberately does not produce human-readable text. Interpretation and localization of the generated turn data is handled by
 * a separate prompt rendering module.
 */

const Rules = (() => {

	/* =========================
	   Data
	   ========================= */
	
	//If there are less players than this, simply don't generate a prompt.
	const MIN_PLAYERS = 3;
	
	/*
	 * Optional per-rule resolvers.
	 *
	 * A resolver generates any contextual data required by a turn, such as weighted random outcomes, randomly selected players or derived values.
	 * Resolvers never generate narration text directly; they only populate structured data consumed later by the prompt interpreter.
	 *
	 * Every resolver has the signature (ctx, action, instigator, data) => resultData, where ctx is the evaluation context (see _makeCtx),
	 * action/instigator are copied from the owning TURN_ORDER entry, and data is that entry's own resolveData(ctx) output (or {} if it has
	 * none). resultData is merged over data in the final turn (see _runRule) - most resolvers ignore action/instigator/data entirely and
	 * return a fresh object, since a rule needing to layer new fields onto its own resolveData is the exception, not the rule.
	 */
	const RESOLVERS = {
		/*
		 * Determines what the Alien team does on their turn.
		 *
		 * Builds a two-level weighted tree: top-level branches are broad categories (view a card collectively/individually, trade cards, do
		 * nothing, convert someone, etc.), each with its own Settings-driven weight. Categories that view cards branch again into *who* is
		 * targeted (center, odd/even player, specific player, neighbor). _chooseWeightedTree flattens both levels into one roll so the
		 * final probability of any leaf outcome is the product of its branch weights, without the caller needing to reason about nesting.
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
		 * Determines how many Blob center cards exist and how they're split left/right of center, scaled by player count (more players ⇒ more
		 * Blob cards). The left/right split is deliberately balanced (floor/ceil of half) rather than random, with only which *side*
		 * gets the extra odd card decided by a coin flip — this avoids wildly uneven distributions while still keeping some unpredictability.
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
		/*
		 * Picks who/what the Bodysnatcher views, plus a separate independent roll (`fakeAction`) for whether this turn is actually a decoy the
		 * app narrates purely to keep other players guessing about who has night actions — the interpreter/UI decides how to use that flag,
		 * this resolver only reports whether it's set.
		 */
		BodysnatcherResolver: (ctx, action, instigator, data) => {
			const rngKey = "bodysnatcher_event" + (data.copiedRole ? "_doppelganger" : "");
			const fakeAction = _getCachedRandom(rngKey + ".fake") * 100 < Settings.getValue("bodysnatcher.fake");
			
			const choices = [
				{ weight: Settings.getValue("bodysnatcher.center"), data: { type: "view_card", target: "center", restriction: "any", count: 1 } },
				{ weight: Settings.getValue("bodysnatcher.neighbor"), data: { type: "view_card", target: "neighbor", restriction: "any", count: 1 } },
				{ weight: Settings.getValue("bodysnatcher.odd"), data: { type: "view_card", target: "odd_player", restriction: "any", count: 1 } },
				{ weight: Settings.getValue("bodysnatcher.even"), data: { type: "view_card", target: "even_player", restriction: "any", count: 1 } },
				{ weight: Settings.getValue("bodysnatcher.specific"), data: { type: "view_card", target: "player", restriction: "specific", count: 1, players: _getRandomPlayers(ctx.playerCount, rngKey) } },
			];
			
			return { ..._chooseWeightedTree(choices, rngKey), fakeAction: fakeAction };
		},
		/*
		 * EmpathResolver queries Localization directly for available question keys, then picks one random question to assign for the prompt.
		 *
		 * This is an intentional exception to the otherwise data-driven design, allowing translators to add or remove question variants without requiring
		 * corresponding changes to the rules engine.
		 */
		EmpathResolver: (ctx, action, instigator, data) => {
			const rngKey = "empath_event" + (data.copiedRole ? "_doppelganger" : "");
			const availableQuestions = Localization.getKeysContaining("PROMPT_EMPATH_QUESTION_") ?? []
			
			if (availableQuestions.length <= 0)
				throw new Error(`EmpathResolver: No questions found in localization keys`);
			
			const questionID = Math.floor(_getCachedRandom(rngKey) * availableQuestions.length);
			const question = availableQuestions[questionID];
			const players = _getRandomPlayers(ctx.playerCount, rngKey, 1, 4);
			
			return { question: question, players: players, count: players.length };
		},
		ExposerResolver: (ctx, action, instigator, data) => {
			const rngKey = "exposer_event" + (data.copiedRole ? "_doppelganger" : "");
			const choices = [
				{ weight: Settings.getValue("exposer.flip_one"), data: { type: "expose_center", count: 1 } },
				{ weight: Settings.getValue("exposer.flip_two"), data: { type: "expose_center", count: 2 } },
				{ weight: Settings.getValue("exposer.flip_three"), data: { type: "expose_center", count: 3 } },
			];
			
			return _chooseWeightedTree(choices, rngKey);
		},
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
		 * Nostradamus can switch team and have his new team announced. Since this depends on player choice, this can't be determined programatically
		 * and must be inserted by the narrator. In the case where NOSTRADAMUS is in the game but ends up in the unused center cards, the resolver
		 * picks a plausible "fallback" identity for him to join. Available choices are evenly weighted across every evil team currently in play, plus
		 * Tanner/Apprentice Tanner individually (since they aren't a team). Only options that are actually present in the current role selection are
		 * offered, with the village team always being present as Nostradamus' default, and given a weight equal to the sum of all others (50% chance).
		 */
		NostradamusResolver: (ctx, action, instigator, data) => {
			const rngKey = "nostradamus_event" + (data.copiedRole ? "_doppelganger" : "");
			const choices = [];
			
			// Add all evil teams, if present
			[ "TEAM_WEREWOLF", "TEAM_VAMPIRE", "TEAM_ALIEN" ].forEach((t) => {
				if (ctx.isTeamPresent(t)) choices.push({ weight: 1, data: { fallbackTeam: t + "_PLURAL_DEFINITE" } });
			});
			// Add Tanner/Apprentice Tanner, if present
			[ "TANNER", "APPRENTICETANNER" ].forEach((t) => {
				if (ctx.isRolePresent(t))
					choices.push({ weight: 1, data: { fallbackTeam: "ROLE_" + t + "_DEFINITE" } });
			});
			// Add village team (always present, as it's Nostradamus default, and give it a 50% chance
			choices.push({ weight: Math.max(choices.length, 1), data: { fallbackTeam: "TEAM_VILLAGE_PLURAL_DEFINITE" } });
			
			// Same candidate set that feeds the weighted fallback pick above, reshaped into {value,label} pairs for automatic narration's input
			// options - i.e. "every team Nostradamus's card-viewing could plausibly reveal", not just the one chosen for the no-player case.
			const availableTeams = choices.map(c => ({ value: c.data.fallbackTeam, label: c.data.fallbackTeam }));
			
			return { ..._chooseWeightedTree(choices, rngKey), availableTeams: availableTeams };
		},
		/*
		 * A more complicated resolver implementation; Oracle's action is a grab-bag of outcome categories, several of which need their own
		 * extra rolls *before* they can even be added as a weighted choice:
		 *
		 *   - "hunt": whether the hunt actually triggers is pre-rolled (`huntActive`) so the resulting turn data can also flag when a
		 *     hunt would reveal a role from a team the current settings consider "shouldn't" be exposed (`showExclusionWarning`).
		 *   - "change_team": only offered at all if an evil team is present; if offered, which team and whether it's a full/partial switch
		 *     are pre-rolled so the option's *data* is decided independent of whether the option is actually chosen.
		 *   - "force_ripple": only offered if the alien team is present (required for any ripple)
		 *
		 * The final _chooseWeightedTree call is wrapped in try/catch purely to produce a clearer diagnostic in the specific case where the only
		 * non-zero weight is "change_team" but no evil team exists to switch to — a misconfiguration that would otherwise surface as an opaque
		 * "total weight is zero" error.
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
			
			if (ctx.isTeamPresent("TEAM_ALIEN"))
				choices.push({ weight: Settings.getValue("oracle.force_ripple"), data: { type: "oracle_force_ripple", defaultRippleForce: false } });
			
			// Calculate hunt event
			const huntActive = _getCachedRandom(rngKey + ".hunt") * 100 < Settings.getValue("oracle.hunt.chance");
			const allowBad = Settings.getValue("oracle.hunt.allow_bad_teams")
			const exclusionData = ctx.getTagList("ORACLE_OMNISCIENCE_EXCLUDED", "ExcludedRoles")
			choices.push({ weight: Settings.getValue("oracle.hunt"), data: { type: "oracle_hunt", huntActive: huntActive, showExclusionWarning: !allowBad && (exclusionData.countExcludedRoles > 0), defaultHuntGuess: Math.floor(Math.random() * 10) + 1, ...exclusionData } });
			
			// Calculate team switch
			const availableTeams = [];
			[ "TEAM_WEREWOLF", "TEAM_VAMPIRE", "TEAM_ALIEN" ].forEach((t) => { 
				if (ctx.isTeamPresent(t))
					availableTeams.push(t);
			});
			
			if (availableTeams.length > 0) {
				const joinFull = _getCachedRandom(rngKey + ".join_team.mode") * 100 < Settings.getValue("oracle.change_team.chance");
				const joinTeam = availableTeams[ Math.floor(_getCachedRandom(rngKey + ".join_team.team") * availableTeams.length) ];
				choices.push({ weight: Settings.getValue("oracle.change_team"), data: { type: "oracle_change_team", joinTeam: joinTeam, joinFull: joinFull, defaultJoinAccepted: Math.random() > 0.5 } });
			}
			
			try {
				return _chooseWeightedTree(choices, rngKey);
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
		 * so that whichever outcome is ultimately chosen already has consistent, cached player picks rather than each branch rolling
		 * its own.
		 *
		 * "none" (no ripple) is intentionally the last entry in `choices` so it can be sliced off: if the first roll lands on "none", a second
		 * roll (".backup") is made against every *other* option to guarantee a real ripple is always available as a backup — this exists
		 * because Oracle's "block_action"-style outcomes can force a ripple to occur even when the primary roll said there wouldn't be one.
		 * `noRipple` reports whether the primary roll actually wanted a ripple, so callers can tell a "genuine" ripple from a "backup one
		 * that only exists in case it's needed".
		 *
		 * This can't be resolved purely programmatically: forcing a ripple is a live player-response event (the narrator asks the Oracle
		 * player a yes/no question and gets a physical nod/shake in response), so the actual decision of whether to use the backup
		 * happens at the table, not in code — the resolver just needs to always have a valid backup on hand in case it's needed.
		 *
		 * KNOWN ISSUE: if every ripple effect except "none" is set to weight 0, Settings.validate() still passes (the weight group's sum is
		 * satisfied by "none" alone), but the backup roll here has no non-zero option to fall back to and throws. Needs a fix — either
		 * excluding this case from validation being "valid", or having this resolver degrade gracefully instead of throwing.
		 */
		RippleResolver: (ctx, action, instigator, data) => {
			const rngKey = "ripple_event";
			let noRipple = false;
			// Pre-compute these and reuse for the different options
			const rndPlayers = _getRandomPlayers(ctx.playerCount, rngKey + ".view_players", 3, 3);	
			const rndEffectPlayers = _getRandomPlayers(ctx.playerCount, rngKey + ".effect_players", 1, "20%");
			
			const choices = [
				{ weight: Settings.getValue("ripple.one_minute"), data: { type: "ripple_timer" } },
				{ weight: Settings.getValue("ripple.insomniac"), data: { type: "ripple_role_action", role: "INSOMNIAC", player: rndPlayers[0] } },
				{ weight: Settings.getValue("ripple.troublemaker"), data: { type: "ripple_role_action", role: "TROUBLEMAKER", player: rndPlayers[0] } },
				{ weight: Settings.getValue("ripple.robber"), data: { type: "ripple_role_action", role: "ROBBER", player: rndPlayers[0] } },
				{ weight: Settings.getValue("ripple.witch"), data: { type: "ripple_role_action", role: "WITCH", player: rndPlayers[0] } },
				{ weight: Settings.getValue("ripple.revealer"), data: { type: "ripple_role_action", role: "REVEALER", player: rndPlayers[0], ...ctx.getTagList("REVEALER_HIDDEN_ROLE", "HiddenRoles") } },
				{ weight: Settings.getValue("ripple.drunk"), data: { type: "ripple_role_action", role: "DRUNK", player: rndPlayers[0] } },
				{ weight: Settings.getValue("ripple.muted"), data: { type: "ripple_mute", players: rndEffectPlayers, count: rndEffectPlayers.length } },
				{ weight: Settings.getValue("ripple.rebuked"), data: { type: "ripple_rebuked", players: rndEffectPlayers, count: rndEffectPlayers.length } },
				{ weight: Settings.getValue("ripple.view_player"), data: { type: "ripple_view_player", player: rndPlayers[0], players: rndPlayers.slice(-1), count: 1 } },
				{ weight: Settings.getValue("ripple.dual_view_player"), data: { type: "ripple_view_player", player: rndPlayers[0], players: rndPlayers.slice(-2), count: 2 } },
				{ weight: Settings.getValue("ripple.double_vote"), data: { type: "ripple_double_vote", players: rndEffectPlayers, count: rndEffectPlayers.length } },
			];
			choices.push({ weight: Settings.getValue("ripple.none"), data: { type: "none" } });	// Ensure that this entry is always last so that the backup ripple can exclude it
			
			let result = _chooseWeightedTree(choices, rngKey);
			
			// If the first result is no ripple, add a backup ripple in case Oracle forces one.
			if (result.type === "none") {
				noRipple = true;
				result = _chooseWeightedTree(choices.slice(0, choices.length-1), rngKey + ".backup");
			}
			
			return { ...result, noRipple: noRipple };
		},
	};

	/*
	 * Declarative turn definitions. The turns are ordered chronologically, and is simply evaluated from top to bottom in buildPrompt().
	 *
	 * Each entry represents a possible narration step in chronological order. Each must contain, at minimum, an action field (what to do), as well as
	 * an instigator field (who does the action). The action value is used in the interpreter to find an entry point among the localization keys.
	 * Optional fields are condition, resolveData and resolver.
	 *
	 * Rules may:
	 *   - specify when they apply through conditions ('condition')
	 *   - generate additional contextual data ('resolveData')
	 *   - invoke a resolver for randomized outcomes ('resolver')
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
			resolveData: ctx => ({ ...ctx.getTagList("DOPPELGANGER_IMMEDIATE_ACTION", "ImmediateActionRoles") }),
		},
		{
			action: "VAMPIRE_TEAM",
			instigator: "TEAM_VAMPIRE",
			condition: ctx => ctx.isTeamPresent("TEAM_VAMPIRE"),
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER") }),
		},
		{
			action: "COUNT",
			instigator: "ROLE_COUNT",
			condition: ctx => ctx.isRolePresent("COUNT")
		},
		{
			action: "COUNT",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("COUNT", "DOPPELGANGER"),
			resolveData: ctx => ({ copiedRole: "ROLE_COUNT" }),
		},
		{
			action: "RENFIELD",
			instigator: "ROLE_RENFIELD",
			condition: ctx => ctx.isRolePresent("RENFIELD"),
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER") }),
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
			condition: ctx => ctx.isRolePresent("PRIEST")
		},
		{
			action: "PRIEST",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("PRIEST", "DOPPELGANGER"),
			resolveData: ctx => ({ copiedRole: "ROLE_PRIEST" }),
		},
		{
			action: "ASSASSIN",
			instigator: "ROLE_ASSASSIN",
			condition: ctx => ctx.isRolePresent("ASSASSIN"),
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER"), hasApprenticeAssassin: ctx.isRolePresent("APPRENTICEASSASSIN") })
		},
		{
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
			resolveData: ctx => ({ ...ctx.getTagList("DOPPELGANGER_IMMEDIATE_ACTION", "ImmediateActionRoles") }),
		},
		{
			action: "ALIEN_TEAM",
			instigator: "TEAM_ALIEN",
			condition: ctx => ctx.isTeamPresent("TEAM_ALIEN") || ctx.isRolePresent("SYNTHETICALIEN"),
			resolver: "AlienResolver",
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER"), hasCow: ctx.isRolePresent("COW") })
		},
		{
			action: "FEUDINGALIENS",
			instigator: "ROLE_FEUDINGALIENS",
			condition: ctx => ctx.isRolePresent("FEUDINGALIENS"),
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER") }),
		},
		{
			action: "BODYSNATCHER",
			instigator: "ROLE_BODYSNATCHER",
			condition: ctx => ctx.isRolePresent("BODYSNATCHER"),
			resolver: "BodysnatcherResolver",
		},
		{
			action: "BODYSNATCHER",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("BODYSNATCHER", "DOPPELGANGER"),
			resolver: "BodysnatcherResolver",
			resolveData: ctx => ({ copiedRole: "ROLE_BODYSNATCHER" }),
		},
		{
			action: "WEREWOLF_TEAM",
			instigator: "TEAM_WEREWOLF",
			condition: ctx => ctx.isAnyRolePresent("WEREWOLF", "ALPHAWOLF", "MYSTICWOLF"),
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER"), hasDreamWolf: ctx.isRolePresent("DREAMWOLF") })
		},
		{
			action: "ALPHAWOLF",
			instigator: "ROLE_ALPHAWOLF",
			condition: ctx => ctx.isRolePresent("ALPHAWOLF")
		},
		{
			action: "MYSTICWOLF",
			instigator: "ROLE_MYSTICWOLF",
			condition: ctx => ctx.isRolePresent("MYSTICWOLF")
		},
		{
			action: "MINION",
			instigator: "ROLE_MINION",
			condition: ctx => ctx.isRolePresent("MINION") && ctx.isTeamPresent("TEAM_WEREWOLF"),
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER") }),
		},
		{
			action: "APPRENTICETANNER",
			instigator: "ROLE_APPRENTICETANNER",
			condition: ctx => ctx.isRolePresent("APPRENTICETANNER") && ctx.isRolePresent("TANNER"),
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER") }),
		},
		{
			action: "LEADER",
			instigator: "ROLE_LEADER",
			condition: ctx => ctx.isRolePresent("LEADER") && (ctx.isTeamPresent("TEAM_ALIEN") || ctx.isRolePresent("SYNTHETICALIEN")),
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER"), hasFeudingAliens: ctx.isRolePresent("FEUDINGALIENS") })
		},
		{
			action: "MASON",
			instigator: "ROLE_MASON",
			condition: ctx => ctx.getTotalRoleCountPresent("MASON", "DOPPELGANGER") >= 2,
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER") }),
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
			condition: ctx => ctx.isRolePresent("APPRENTICESEER")
		},
		{
			action: "PARANORMALINVESTIGATOR",
			instigator: "ROLE_PARANORMALINVESTIGATOR",
			condition: ctx => ctx.isRolePresent("PARANORMALINVESTIGATOR"),
			resolveData: ctx => ({ ...ctx.getTagList("PI_CONVERSION_ROLE", "DangerRoles") }),
		},
		{
			action: "MARKSMAN",
			instigator: "ROLE_MARKSMAN",
			condition: ctx => ctx.isRolePresent("MARKSMAN")
		},
		{
			action: "MARKSMAN",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("MARKSMAN", "DOPPELGANGER"),
			resolveData: ctx => ({ copiedRole: "ROLE_MARKSMAN" }),
		},
		{
			action: "NOSTRADAMUS",
			instigator: "ROLE_NOSTRADAMUS",
			condition: ctx => ctx.isRolePresent("NOSTRADAMUS"),
			resolver: "NostradamusResolver",
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER"), ...ctx.getTagList("PI_CONVERSION_ROLE", "DangerRoles") }),
		},
		{
			action: "PSYCHIC",
			instigator: "ROLE_PSYCHIC",
			condition: ctx => ctx.isRolePresent("PSYCHIC"),
			resolver: "PsychicResolver",
		},
		{
			action: "PSYCHIC",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("PSYCHIC", "DOPPELGANGER"),
			resolver: "PsychicResolver",
			resolveData: ctx => ({ copiedRole: "ROLE_PSYCHIC" }),
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
			condition: ctx => ctx.isRolePresent("PICKPOCKET")
		},
		{
			action: "PICKPOCKET",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("PICKPOCKET", "DOPPELGANGER"),
			resolveData: ctx => ({ copiedRole: "ROLE_PICKPOCKET" }),
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
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER"), ...ctx.getTagList("AURA_SEER_DETECTABLE", "DetectableRoles") })
		},
		{
			action: "GREMLIN",
			instigator: "ROLE_GREMLIN",
			condition: ctx => ctx.isRolePresent("GREMLIN")
		},
		{
			action: "GREMLIN",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("GREMLIN", "DOPPELGANGER"),
			resolveData: ctx => ({ copiedRole: "ROLE_GREMLIN" }),
		},
		{
			action: "RASCAL",
			instigator: "ROLE_RASCAL",
			condition: ctx => ctx.isRolePresent("RASCAL"),
			resolver: "RascalResolver",
		},
		{
			action: "RASCAL",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("RASCAL", "DOPPELGANGER"),
			resolver: "RascalResolver",
			resolveData: ctx => ({ copiedRole: "ROLE_RASCAL" }),
		},
		{
			action: "DRUNK",
			instigator: "ROLE_DRUNK",
			condition: ctx => ctx.isRolePresent("DRUNK")
		},
		{
			action: "INSOMNIAC",
			instigator: "ROLE_INSOMNIAC",
			condition: ctx => ctx.isRolePresent("INSOMNIAC")
		},
		{
			action: "INSOMNIAC",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("INSOMNIAC", "DOPPELGANGER"),
			resolveData: ctx => ({ copiedRole: "ROLE_INSOMNIAC" }),
		},
		{
			action: "SQUIRE",
			instigator: "ROLE_SQUIRE",
			condition: ctx => ctx.isRolePresent("SQUIRE") && ctx.isTeamPresent("TEAM_WEREWOLF"),
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER") }),
		},
		{
			action: "BEHOLDER",
			instigator: "ROLE_BEHOLDER",
			condition: ctx => ctx.isRolePresent("BEHOLDER") && ctx.isAnyTagPresent("BEHOLDER_DETECTABLE"),
			resolveData: ctx => ({ hasDoppelganger: ctx.isRolePresent("DOPPELGANGER"), ...ctx.getTagList("BEHOLDER_DETECTABLE", "DetectableRoles") })
		},
		{
			action: "REVEALER",
			instigator: "ROLE_REVEALER",
			condition: ctx => ctx.isRolePresent("REVEALER"),
			resolveData: ctx => ({ ...ctx.getTagList("REVEALER_HIDDEN_ROLE", "HiddenRoles") }),
		},
		{
			action: "REVEALER",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("REVEALER", "DOPPELGANGER"),
			resolveData: ctx => ({ copiedRole: "ROLE_REVEALER", ...ctx.getTagList("REVEALER_HIDDEN_ROLE", "HiddenRoles") })
		},
		{
			action: "EXPOSER",
			instigator: "ROLE_EXPOSER",
			condition: ctx => ctx.isRolePresent("EXPOSER"),
			resolver: "ExposerResolver",
		},
		{
			action: "EXPOSER",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("EXPOSER", "DOPPELGANGER"),
			resolver: "ExposerResolver",
			resolveData: ctx => ({ copiedRole: "ROLE_EXPOSER" }),
		},
		{
			action: "EMPATH",
			instigator: "ROLE_EMPATH",
			condition: ctx => ctx.isRolePresent("EMPATH"),
			resolver: "EmpathResolver",
		},
		{
			action: "EMPATH",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("EMPATH", "DOPPELGANGER"),
			resolver: "EmpathResolver",
			resolveData: ctx => ({ copiedRole: "ROLE_EMPATH" }),
		},
		{
			action: "CURATOR",
			instigator: "ROLE_CURATOR",
			condition: ctx => ctx.isRolePresent("CURATOR")
		},
		{
			action: "CURATOR",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("CURATOR", "DOPPELGANGER"),
			resolveData: ctx => ({ copiedRole: "ROLE_CURATOR" }),
		},
		{
			action: "BLOB",
			instigator: "ROLE_BLOB",
			condition: ctx => ctx.isRolePresent("BLOB"),
			resolver: "BlobResolver",
		},
		{
			action: "BLOB",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("BLOB", "DOPPELGANGER"),
			resolver: "BlobResolver",
			resolveData: ctx => ({ copiedRole: "ROLE_BLOB" }),
		},
		{
			action: "MORTICIAN",
			instigator: "ROLE_MORTICIAN",
			condition: ctx => ctx.isRolePresent("MORTICIAN"),
			resolver: "MorticianResolver",
		},
		{
			action: "MORTICIAN",
			instigator: "ROLE_DOPPELGANGER",
			condition: ctx => ctx.isAllRolesPresent("MORTICIAN", "DOPPELGANGER"),
			resolver: "MorticianResolver",
			resolveData: ctx => ({ copiedRole: "ROLE_MORTICIAN" }),
		},
		{
			action: "RIPPLE",
			instigator: "INSTIGATOR_MISSING",
			condition: ctx => ctx.isTeamPresent("TEAM_ALIEN"),
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
	 * Using deterministic keys ensures the same prompt is generated every time until rerandomize() is called, preventing unrelated changes from altering
	 * previously generated random choices.
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

	/*
	 * Picks a random, non-repeating set of player numbers (1..playerCount).
	 *
	 * min/max control how many players are picked, and each accepts either an absolute integer or a percentage string (e.g. "20%"), which is
	 * resolved relative to playerCount and rounded up. If min > max after resolution they're swapped, and both are clamped to playerCount so
	 * resolvers can request more players than actually exist in a small game without crashing (e.g. "3 to 3" in a 2-player test config).
	 *
	 * The actual count is itself randomly rolled between min and max, then that many players are drawn without replacement. Every random draw
	 * goes through _getCachedRandom keyed off rndKey (plus a per-index suffix), so the same call with the same key always reproduces the
	 * same selection until Rules.rerandomize() clears the cache.
	 *
	 *   playerCount - total players in the current game; also the upper bound both min and max are clamped to.
	 *   rndKey      - base cache key for every random draw this call makes (see _getCachedRandom); combined with ".players"/".player_N" suffixes.
	 *   min, max    - how many players to pick, as an absolute integer or a percentage string (e.g. "20%"); default to 1 (pick exactly one).
	 *
	 * Returns an array of `amount` distinct player numbers (1..playerCount), in the order they were drawn.
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

	/*
	 * Fetches the random value stored in the cache under key, generating and caching one via Math.random() first if it isn't already present.
	 *
	 *   key - the cache key; the same key always returns the same value until Rules.rerandomize() clears RNG_CACHE.
	 *
	 * Returns a float in [0,1).
	 */
	function _getCachedRandom(key) {
		let v = RNG_CACHE[key];
		if (v == null) {
			v = Math.random();
			RNG_CACHE[key] = v;
		}
		return v;
	}

	/*
	 * Makes a single weighted pick from a flat list of { weight, data } items. One cached random float [0,1) is scaled by the total weight,
	 * then "consumed" by walking the list and subtracting each item's weight until the roll falls within an item's slice — the classic
	 * roulette-wheel selection. Zero-weight items are skipped since they can never be selected. Falling through to the last item is a deliberate
	 * safety net for floating-point rounding at the boundary, not an expected outcome path.
	 *
	 *   items  - flat array of { weight, data } (typically produced by _flattenWeighted); every weight must be a non-negative finite number,
	 *            and at least one must be > 0.
	 *   rngKey - cache key for the single random roll this call makes (see _getCachedRandom).
	 *
	 * Returns the selected item's `data`. Throws if items is empty, any weight is invalid, or every weight is zero.
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

	/*
	 * Recursively flattens a (possibly nested) weighted option tree into a flat array of { weight, data } leaves. A node with a non-empty `subevents`
	 * array is treated as a category and recursed into; otherwise it's a leaf outcome and must provide a `data`. Each leaf's resulting weight already
	 * reflects its share of the combined probability space across every level of nesting it was reached through, so the returned array can be fed
	 * directly into _chooseWeighted with a single roll.
	 *
	 *   nodes - array of { weight, subevents } (category) or { weight, data } (leaf) nodes, at any depth.
	 *   scale - the combined probability share this whole `nodes` array represents in the overall tree; 1 (the full space) at the top level,
	 *           narrowed on each recursive call into a category's subevents.
	 *
	 * Returns a flat array of { weight, data } leaves whose weights already sum to `scale`. Throws if nodes is empty, any weight is invalid,
	 * or a leaf is missing `data`.
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

	/*
	 * Convenience wrapper for the common case: flatten a tree (see _flattenWeighted), then make one weighted roll against it (see _chooseWeighted).
	 * Returns the selected leaf's `data`.
	 */
	function _chooseWeightedTree(nodes, rngKey) {
		return _chooseWeighted(_flattenWeighted(nodes), rngKey);
	}

	/*
	 * Executes a single TURN_ORDER rule and combines static, derived and resolved data into one turn.
	 *
	 *   ctx  - the evaluation context for the current game (see _makeCtx), passed through to rule.resolveData/rule.resolver unchanged.
	 *   rule - one TURN_ORDER entry: { action, instigator, resolver?, resolveData? }. `resolver`, if present, must name a function in
	 *          RESOLVERS. `resolveData(ctx)`, if present, computes base data merged with (and overridable by) the resolver's own result.
	 *
	 * Returns { action, instigator, data }, where data merges resolveData's output with the resolver's (the resolver's fields win on
	 * conflict). Throws if action/instigator are missing, or if `resolver` names a function that doesn't exist in RESOLVERS.
	 */
	function _runRule(ctx, rule) {
		if (!rule.action || !rule.instigator)
			throw new Error(`TURN_ORDER entry missing required action/instigator: ${JSON.stringify(rule)}`);

		const resolveFn = rule.resolver ? RESOLVERS[rule.resolver] : null;
		if (rule.resolver && !resolveFn)
			throw new Error(`TURN_ORDER entry '${rule.action}'/'${rule.instigator}' references unknown resolver '${rule.resolver}'`);

		const resolveData = rule.resolveData ? rule.resolveData(ctx) : {};
		const resolveResult = resolveFn ? resolveFn(ctx, rule.action, rule.instigator, resolveData) ?? {} : resolveData;

		return { action: rule.action, instigator: rule.instigator, data: { ...resolveData, ...resolveResult } };
	}

	/*
	 * Creates the immutable evaluation context passed to every rule.
	 *
	 * The context exposes convenience queries over the selected role set, allowing rule conditions and resolvers to remain declarative rather
	 * than repeatedly inspecting the raw role collection.
	 *
	 *   roleCounts - Map<roleID, count> of the currently selected roles, as supplied to buildPrompt().
	 *
	 * Returns a context object exposing playerCount, selectedRoles (== roleCounts), and the role/team/tag query methods below.
	 * getTagList(tag, fieldName) in particular returns { [`has${fieldName}`], [`count${fieldName}`], [`list${fieldName}`] } — dynamically
	 * named so a resolver can spread its result straight into a turn's data under caller-chosen field names (see OracleResolver's
	 * "ExcludedRoles" usage).
	 */
	function _makeCtx(roleCounts) {
		return {
			playerCount: Roles.calculatePlayerCount(roleCounts),
			selectedRoles: roleCounts,

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
				return [...this.selectedRoles.keys()].filter(roleID => Roles.hasTag(roleID, tag));
			},
			getRolesPresentWithAllTags(...tags) {
				return [...this.selectedRoles.keys()].filter(roleID => Roles.hasAllTags(roleID, ...tags));
			},
			getRolesPresentInTeam(team) {
				return [...this.selectedRoles.keys()].filter(roleID => Roles.isTeam(roleID, team));
			},
			getTagList(tag, fieldName) {
				const list = this.getRolesPresentWithTag(tag);
				return { ["has" + fieldName]: list.length > 0, ["count" + fieldName]: list.length, ["list" + fieldName]: list };
			},
		};
	}


	/* =========================
	   Public functions
	   ========================= */

	// Deletes all key-value pairs in the random cache, forcing regeneration on next use.
	function rerandomize() {
		for (const k in RNG_CACHE) delete RNG_CACHE[k];
	}

	/*
	 * Evaluates the turn definitions against the selected roles and produces the complete structured narration sequence.
	 *
	 * Rules that fail during resolution are preserved in the output as error turns rather than aborting generation entirely.
	 *
	 *   roleCounts - Map<roleID, count> of the currently selected roles.
	 *
	 * Returns { turns, insufficientPlayers }. If the resulting player count is below MIN_PLAYERS, turns is [] and insufficientPlayers is
	 * true. Otherwise turns is one entry per TURN_ORDER rule whose condition (if any) passed, each either a normal { action, instigator, data }
	 * turn (see _runRule) or, if that rule threw during resolution, { action, instigator, error } instead — the caller decides how to
	 * present a failed turn rather than the whole prompt failing to generate.
	 */
	function buildPrompt(roleCounts) {
		const ctx = _makeCtx(roleCounts);

		if (ctx.playerCount < MIN_PLAYERS)
			return { turns: [], insufficientPlayers: true };

		const turns = [];

		for (const rule of TURN_ORDER) {
			if (rule.condition && !rule.condition(ctx))
				continue;

			try {
				turns.push(_runRule(ctx, rule));
			} catch (error) {
				turns.push({ action: rule.action, instigator: rule.instigator, error: error });
			}
		}

		return { turns: turns, insufficientPlayers: false };
	}



	return {
		buildPrompt,
		rerandomize,
	};

})();