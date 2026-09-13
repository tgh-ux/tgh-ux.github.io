const TTSManifest = (() => {
	
	/* =========================
	   Data
	   ========================= */

	/*
	 * Map of sentences/atoms that can be represented by a pre-recorded clip. Atoms are assembled and 
	 * tested against entries to find longest fit. The map contains the normalized strings as keys and a clip
	 * name as value. It is filled at init, first by pre-defined entries (numbers, roles and teams), and then
	 * by the contents of the manifest object. The manifest content will always overwrite any existing map
	 * entries, so care needs to be taken for overlapping role/team entries.
	 */
	let _map = null;

	/*
	 * Templates for manifest entries that contain dynamic ("hole") content - matched against a run of atoms
	 * rather than looked up by a single normalized key, since the hole's own length isn't known until match
	 * time (e.g. an IdentityList atom run, whose length depends on how many identities are in it). Populated
	 * at init from any manifest entry whose value is an array (see _registerEntry / _parseTemplate). Each
	 * entry is { segments, staticTexts }:
	 *   segments    - the template's own literal/placeholder structure, in order: { type: "clip", clip } for
	 *                 a static piece with its own recording, or { type: "hole" } for a placeholder.
	 *   staticTexts - the normalized literal text belonging to each "clip" segment, in the same order those
	 *                 segments appear in `segments` - precomputed once here so matching a span of atoms never
	 *                 re-normalizes the same literal on every lookup attempt.
	 * See _matchTemplateAt / _tryTemplates for how a template is matched against an atom span, and
	 * lookupParts for where that plugs into the existing splice-cost search.
	 */
	let _templates = null;

	// Marks a cut point within a manifest template's key string: "%Name%" is a hole (dynamic content, resolved
	// recursively at lookup time - the name is a human label only, never inspected); "%%" (empty name) is a
	// splice point - "two separate static recordings meet here", with nothing dynamic allowed at all. A splice
	// point takes no slot in the clip-value array (unlike a hole, which needs HOLE there); if anything other
	// than the two static recordings' own atoms ever lands in that gap, the template simply fails to match
	// rather than absorbing it - see _matchTemplateAt.
	const PLACEHOLDER_PATTERN = /%([^%]*)%/g;

	// Sits in a template's clip-value array at every position its key string has a %Name% hole - a generic
	// "nothing recorded here, something gets spliced in at lookup time" marker. Deliberately carries no
	// information about *what* fills the hole (an identity, a number, a list of either) - the key string's
	// %Name% already documents that for a human reader, and TTSManifest itself never needs to know; it just
	// needs to know a position is a hole rather than a clip name. null rather than "" so it can never be
	// confused with a (however unlikely) empty-string clip-name typo.
	const HOLE = null;
	
	/*
	Google Cloud TTS, Gemini 3.1 Flash TTS, Callirrhoe
	Instruction prompt:
	Read each line as an independent, calm statement. Maintain a professional, natural narrator tone with an even voice across all lines. Do not use an enthusiastic, dramatic, or list-like rising cadence. Ensure there is a distinct, clean pause between sentences so they do not blend together.
	*/
	
	// Manual record of assembled atoms -> clip name translations, used to populate the _map library.
	const manifest = {
		SWE: {
			"eller": "list_or",
			"och": "list_and",
			"spelare": "player",
			
			"Individuellt får ni titta på": "view_card_prefix_individual",
			"Gemensamt inom laget får ni titta på": "view_card_prefix_together",
			"Du får titta på": "view_card_prefix_solo",
			"kort från andra spelare.": "view_card_suffix_other_players",
			"kort från udda spelare.": "view_card_suffix_odd_players",
			"kort från jämna spelare.": "view_card_suffix_even_players",
			"av mittenkorten.": "view_card_suffix_center",
			"ett kort från en annan spelare.": "view_card_suffix_one_player",
			"båda grannars kort.": "view_card_suffix_both_neighbors",
			"ditt eget kort.": "view_card_suffix_own",
			"en grannes kort.": "view_card_suffix_any_neighbor",
			"höger grannes kort.": "view_card_suffix_right_neighbor",
			"vänster grannes kort.": "view_card_suffix_left_neighbor",
			"kort som tillhör spelare": "view_card_playerlist_prefix",
			
			"Alla spelare": "all_players",
			"Förälskade": "lovers",
			", vakna.": "generic_wake",
			", somna.": "generic_sleep",
			", vakna och identifiera varandra.": "wake_and_identify",
			"Dubbelgångare, om du såg": "doppelganger_wake_prefix",
			", du får titta på deras kort.": "shared_may_view_cards",
			"Alla spelare, ner med tummarna.": "all_thumbs_down",
			"Övriga spelare, fortsätt hålla ut tummen.": "others_thumb_out",
			"Alla andra spelare, håll ut en hand framför er.": "all_hands_out",
			", ner med tummen.": "thumb_down",
			", håll ut en hand framför dig.": "hand_out",
			", ner med handen.": "hand_down",
			"Alla spelare, ner med händerna.": "all_hands_down",
			
			"Om det bara finns en Varulv får du titta på ett av mittenkorten.": "werewolf_team_1",
			", håll ut en tumme så att Betraktaren kan se vem ni är.": "beholder_1",
			"Byt ut en annan spelares märke mot Lönnmördarens märke.": "assassin_1",
			"Identifiera Lönnmördaren.": "apprenticeassassin_1",
			"Om det inte finns någon Lönnmördare:": "apprenticeassassin_2",
			", om ni har tittat på eller flyttat kort, håll ut en tumme så att Auraläsaren kan se den.": "auraseer_1",
			", med undantag för Drömvargen": "werewolf_team_dreamwolf_1",
			"Drömvarg, stick ut tummen så att andra Varulvar kan se vem du är.": "werewolf_team_dreamwolf_2",
			"Garvare, håll ut en tumme så att Garvargesällen kan se vem du är.": "apprenticetanner_1",
			"Garvare, fortsätt hålla ut tummen så att Dubbelgångaren kan se vem du är.": "apprenticetanner_doppelganger",
			"Visa era kort för varandra.": "alien_team_show_cards",
			"Ge era kort till närmaste Utomjording till höger om er.": "alien_team_shift_cards_right",
			"Ge era kort till närmaste Utomjording till vänster om er.": "alien_team_shift_cards_left",
			"Gör ingenting, stirra bara på varandra tills det blir pinsamt.": "alien_team_do_nothing",
			", och Dubbelgångaren om du såg Kon": "alien_team_cow_doppelganger",
			"Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand.": "alien_team_cow_1",
			"Utomjordingar, rör vid en annan spelares hand.": "alien_team_turncoat_1",
			"Spelaren är nu en Utomjording oavsett vad som händer med deras kort.": "alien_team_turncoat_2a",
			"Spelaren vinner nu om Utomjordingarna vinner oavsett om de själva blir utröstade och vad som händer med deras kort.": "alien_team_turncoat_2b",
			", och Dubbelgångaren om du såg en av Frimurarna": "mason_doppelganger",
			", och Dubbelgångaren om du såg ett av deras kort": "feudingaliens_doppelganger",
			
			
			
			
			
			"Vampyrer, peka på den spelare som ni har gett Vampyrernas märke. %Identity%, identifiera Vampyrerna och byt ut ditt märke mot Renfields märke. Vampyrer, sluta peka.": [ "renfield_1", [ HOLE, "renfield_2", ], "renfield_3" ],
			"Vampyrer, fortsätt peka på den spelare som ni har gett Vampyrernas märke.": "renfield_doppelganger",
			
			"Det har inträffat en krusning i rum-tiden. Ni har endast en minut på er innan ni måste rösta.": [ "ripple", "ripple_timer" ],
			"Det har inträffat en krusning i rum-tiden. Spelare %PlayerList% får inte prata förrän efter omröstningen.": [ "ripple", [ "player", HOLE, "ripple_mute" ] ],
			"Det har inträffat en krusning i rum-tiden. Spelare %PlayerList% måste vända sig från bordet fram till efter omröstningen.": [ "ripple", [ "player", HOLE, "ripple_rebuke" ] ],
			"Det har inträffat en krusning i rum-tiden. Spelare %PlayerList% får under omröstningen använda båda händerna för dubbla röster.": [ "ripple", [ "player", HOLE, "ripple_double_vote" ] ],
			"Det har inträffat en krusning i rum-tiden. Spelare %PlayerListAndAction%": [ "ripple", [ "player", HOLE ] ],
			
			"Varulvar, håll ut en tumme så att Underhuggaren kan se vem ni är. Varulvar, ner med tummarna.": [ "minion_1", "minion_2" ],
			"Varulvar, håll ut en tumme så att Lakejen kan se vem ni är. Varulvar, ner med tummarna.": [ "squire_1", "minion_2" ],
			"Varulvar, fortsätt hålla ut tummen.": "minion_doppelganger",
			
			"Utomjordingar, håll ut en tumme så att Borgmästaren kan se vem ni är. Groob och Zerb, håll ut båda tummarna. Borgmästare, om du ser både Groob och Zerb vinner du om ingen av dem röstas ut. Utomjordingar, fortsätt hålla ut tummarna. Utomjordingar, ner med tummarna.": [ "leader_1", "leader_feudingaliens_1", "leader_feudingaliens_2", "leader_doppelganger", "leader_2" ],
			
			"Iaktta vad de andra spelarna gör. Spelare %PlayerList%, utan att vakna, %EmpathQuestion%": [ "empath_1", ["player", HOLE, "empath_2", HOLE] ],
			", visa tummen upp om du tror att du kommer vinna, eller tummen ner om du tror att du kommer förlora.": "empath_q_10",
			", peka på den spelare som du tror är mest sannolik att redan ha glömt sin roll.": "empath_q_11",
			", peka på en spelare som du tror kommer vinna.": "empath_q_1",
			", peka på en spelare som du tror blir utröstad.": "empath_q_2",
			", peka på den spelare som du litar mest på.": "empath_q_3",
			", peka på den spelare som du litar minst på.": "empath_q_4",
			", peka på en spelare som du tror är en av Byborna.": "empath_q_5",
			", peka på den spelare som du tror kommer prata mest.": "empath_q_6",
			", peka på den spelare som du tror kommer prata minst.": "empath_q_7",
			", peka på den spelare som du tror är bäst på att bluffa.": "empath_q_8",
			", peka på den spelare som du tror är sämst på att bluffa.": "empath_q_9",
			
			"Gissa ett tal mellan ett och tio. Fel. Orakel, du vinner nu endast om du inte blir utröstad. Övriga spelare, oberoende av tidigare roll- och lagtillhörighet har ni nu endast ett vinstvillkor: hitta Oraklet.": [ "oracle_guess_1", "oracle_guess_wrong_1", "oracle_guess_wrong_2", "oracle_guess_wrong_3" ],
			"Gissa ett tal mellan ett och tio. Korrekt. När en annan roll blir tillsagd att vakna kan du en gång under natten vakna tillsammans med dem för att iaktta vem de är och vad de gör. Du får dock inte vakna för att iaktta någon av följande roller: %IdentityList%.": [ "oracle_guess_1", "oracle_guess_right_1", "oracle_guess_right_2", [ "oracle_guess_right_3", HOLE ] ],
			"Ange om du har ett jämnt eller udda spelarnummer. Oraklet har ett jämnt spelarnummer.": [ "oracle_even_odd", "oracle_even" ],
			"Ange om du har ett jämnt eller udda spelarnummer. Oraklet har ett udda spelarnummer.": [ "oracle_even_odd", "oracle_odd" ],
			"Vill du tvinga fram en krusning i rum-tiden? En krusning är nu garanterad att inträffa.": [ "oracle_force_ripple", "oracle_force_ripple_yes", ],
			"Vill du tvinga fram en krusning i rum-tiden? Ingen krusning är garanterad, men kan fortfarande inträffa slumpmässigt.": [ "oracle_force_ripple", "oracle_force_ripple_no" ],
			"Alla andra spelare, håll ut en hand framför er. Orakel, rör vid en annan spelares hand som du vill blockera. Spelaren får inte vakna eller utföra någon handling under natten oavsett vad deras roll är.": [ "all_hands_out", "oracle_block_1", "oracle_block_2" ],
			"Vill du gå med i Varulvarnas lag?": "oracle_join_werewolves",
			"Vill du gå med i Utomjordingarnas lag?": "oracle_join_aliens",
			"Vill du gå med i Vampyrernas lag?": "oracle_join_vampires",
			"Oraklet är nu den rollen, och vaknar tillsammans med dem.": "oracle_join_full",
			"Oraklet vinner nu tillsammans med det laget, men är inte den rollen och vaknar inte tillsammans med dem.": "oracle_join_partial",
			"Oraklet är kvar i Bybornas lag.": "oracle_join_denied",
			
			"Du behöver enbart förhindra att du själv blir utröstad.": "blob_solo",
			"Du måste förhindra att du själv och närmaste spelare till höger blir utröstade.": "blob_duo_right",
			"Du måste förhindra att du själv och närmaste spelare till vänster blir utröstade.": "blob_duo_left",
			"Du måste förhindra att du själv, närmaste %LeftCount% spelare till vänster, och närmaste %RightCount% spelare till höger blir utröstade.": [ "blob_multi_1", HOLE, "blob_multi_2", HOLE, "blob_multi_3" ],
			
			"Du får titta på en till tre andra spelares kort. Om du ser: %IdentityList%, måste du sluta. Välj sedan laget det sista kortet du tittade på tillhörde. Profeten tillhör nu %Identity%. Om du inte blir utröstad och det laget vinner så vinner även du. Dubbelgångare, om du såg Profeten gäller samma vinstvillkor för dig.": [ "nostradamus_1", [ "paranormalinvestigator_2", HOLE, "nostradamus_3" ], "nostradamus_auto", [ "nostradamus_4", HOLE ], "nostradamus_5", "nostradamus_doppelganger" ],
			"Titta på en annan spelares kort. Du är nu rollen du såg. Om rollen du såg var %IdentityList%, utför dess handling nu. Om du såg en %TeamList%, vakna tillsammans med det laget när de ropas upp. Om du såg Drömvargen, vakna inte med Varulvarna men följ rollens instruktioner.": [ "doppelganger_1", "doppelganger_2", [ "doppelganger_3_prefix", HOLE, "doppelganger_3_suffix" ], [ "doppelganger_4_prefix", HOLE, "doppelganger_4_suffix" ], "doppelganger_4_dreamwolf" ],
			"Titta på ett av mittenkorten. Du är nu rollen du såg. När rollen ropas upp, vakna och utför dess handling.": [ "copycat_1", "doppelganger_2", "copycat_3" ],
			"Du får titta på en till två andra spelares kort. Om du ser: %IdentityList%, måste du sluta, och tillhör då deras lag.": [ "paranormalinvestigator_1", [ "paranormalinvestigator_2", HOLE, "paranormalinvestigator_3" ] ],
			"Du kan välja att stjäla en annan spelares kort och ersätta det med ditt kort. Titta sedan på kortet du stal. Du ska inte vakna när din nya roll ropas upp.": [ "robber_1", "robber_2", "robber_3" ],
			"Byt ut ditt märke mot ett rent märke. Om du vill får du även byta ut en annan spelares märke mot ett rent märke.": [ "priest_1", "priest_2" ],
			"Titta på en annan spelares kort, samt ytterligare en annan spelares märke. Det får inte vara samma spelare.": [ "marksman_1", "marksman_2" ],
			"Placera en Sköldbricka på en annan spelares kort. Andra spelare får varken titta på eller flytta kortet under natten.": [ "sentinel_1", "sentinel_2" ],
			"Du kan välja att titta på ett av korten i mitten. Om du gör det måste du ge det kortet till dig själv eller en annan spelare.": [ "witch_1", "witch_2" ],
			"Du kan välja att stjäla en annan spelares märke och ersätta det med ditt märke. Titta sedan på märket du stal.": [ "pickpocket_1", "pickpocket_2" ],
			"Alla andra spelare, håll ut en hand framför er. Varelsen, rör handen tillhörande spelaren närmast till höger eller vänster.": [ "all_hands_out", "thing_2" ],
			"Vänd upp en annan spelares kort. Om kortet är: %IdentityList%, vänd kortet tillbaka.": [ "revealer_1", [ "revealer_2", HOLE, "revealer_3" ] ],
			"Du får vända %CardCount% av mittenkorten.": [ "exposer_1", HOLE, "view_card_suffix_center" ],
			"Byt sedan ditt eget kort mot kortet du tittade på. Ditt nya kort är nu också en Utomjording.": [ "bodysnatcher_1", "bodysnatcher_2" ],
			
			"Tillsammans får ni välja en spelare vars märke ni byter ut mot Vampyrernas märke.": "vampire_team_1",
			"Byt ut en annan spelares märke mot Grevens märke.": "count_1",
			"Byt ut en av dina grannars märken mot den Smittades märke.": "diseased_1",
			"Byt ut två andra spelares märken mot Amors märke.": "cupid_1",
			"Byt ut en annan spelares märke mot Anstiftarens märke.": "instigator_1",
			"Kontrollera era märken utan att visa dem för någon annan.": "check_marks",
			"Om en av er röstas ut så kommer samtliga att röstas ut.": "lovers_1",
			"Byt det extra kortet i mitten mot någon annan spelares kort som inte redan är Varulv.": "alphawolf_1",
			"Du kan välja att flytta samtliga spelares kort ett steg åt vänster, åt höger, eller inte alls.": "villageidiot_1",
			"Byt plats på två andra spelares märken eller två andra spelares kort, utan att titta på något av dem.": "gremlin_1",
			"Byt plats på två andra spelares kort, utan att titta på något av dem.": "troublemaker_1",
			"Du får titta på en annan spelares kort, eller två av mittenkorten.": "seer_1",
			"Byt ditt kort mot ett av mittenkorten utan att se vad det är.": "drunk_1",
			"Titta på ditt eget kort.": "insomniac_1",
			"Placera en artefakt utan att titta på den med ansiktet ner framför en annan spelare.": "curator_1",
		},
	};


	/* =========================
	   Initialization
	   ========================= */

	function _init() {
		_map = new Map();
		_templates = [];

		const language = Localization.getLanguage();

		_initTimerClips();
		_initNumbers(language);
		_initRoles();

		const languageManifest = manifest[language];

		if (!languageManifest) {
			throw new Error(`TTSManifest: no manifest for language "${language}"`);
		}

		// Tracks every normalized key registered from `manifest` itself (never numbers/roles - those are
		// documented to always be overwritten by manifest content, see the module comment) so a second entry
		// landing on the same key can be validated against the first instead of silently shadowing it - see
		// _checkCollision. Scoped to this init pass only; nothing here persists past _init returning.
		const registered = new Map();

		for (const [key, value] of Object.entries(languageManifest)) {
			const sentenceKeys = Interpreter.splitSentences(key);

			// A single-sentence entry's value is used as-is (a clip name, or one sentence's template array
			// exactly today's shape). A multi-sentence entry's value must be an array with one slot per
			// sentence, each slot independently either shape - see _registerEntry.
			if (sentenceKeys.length > 1 && (!Array.isArray(value) || value.length !== sentenceKeys.length)) {
				throw new Error(
					`TTSManifest: entry "${key}" splits into ${sentenceKeys.length} sentences but its value ` +
					`has ${Array.isArray(value) ? value.length : 1} slot(s) instead - expected exactly one per sentence`
				);
			}

			const sentenceValues = sentenceKeys.length === 1 ? [value] : value;
			sentenceKeys.forEach((sentenceText, idx) => _registerEntry(sentenceText, sentenceValues[idx], key, registered));
		}
	}

	/*
	 * Registers one sentence's worth of a manifest entry into _map or _templates - either a standalone
	 * single-sentence entry, or one slot of a multi-sentence block that _init already split apart. Once
	 * split, a block's sentence is handled completely indistinguishably from a standalone entry for that same
	 * sentence text; nothing downstream (lookup/lookupParts) can tell the two apart, or needs to.
	 *
	 *   sentenceText - this sentence's own text (already isolated from any siblings by _init).
	 *   value        - this sentence's value: a clip name string (flat entry), or an array (template entry -
	 *                  see _parseTemplate for the array's own shape).
	 *   sourceKey    - the original, unsplit manifest key - kept only for error messages.
	 *   registered   - shared collision-tracking map for this whole _init pass, as described there.
	 */
	function _registerEntry(sentenceText, value, sourceKey, registered) {
		const normalizedKey = _normalizeKey(sentenceText);

		if (typeof value === "string") {
			_checkCollision(normalizedKey, value, sourceKey, registered);
			_map.set(normalizedKey, value);
			return;
		}

		if (!Array.isArray(value)) {
			throw new Error(`TTSManifest: entry "${sourceKey}" has an invalid value (expected a clip name string or a template array)`);
		}

		_templates.push(_parseTemplate(sentenceText, value, sourceKey));
	}

	/*
	 * Checks a flat (no-hole) entry's normalized key against every other flat entry already registered this
	 * init pass. Two entries landing on the same key with the same clip are a harmless duplicate - the same
	 * sentence legitimately reused verbatim across different manifest blocks - and are silently accepted.
	 * The same key with two *different* clips (e.g. two roles with an identical wake-continuation line, each
	 * wanting its own recording) is an authoring ambiguity TTSManifest has no way to resolve on its own -
	 * lookup() has nothing but the normalized text to go on, so it can only ever return one of the two. That's
	 * a real, currently-open limitation rather than something this check can fix - but leaving it undetected
	 * means whichever entry Object.entries() happens to iterate last wins silently, which is worse than
	 * failing loudly at init.
	 */
	function _checkCollision(normalizedKey, clip, sourceKey, registered) {
		const existing = registered.get(normalizedKey);

		if (existing === undefined) {
			registered.set(normalizedKey, { clip, sourceKey });
			return;
		}

		if (existing.clip !== clip) {
			throw new Error(
				`TTSManifest: "${sourceKey}" and "${existing.sourceKey}" normalize to the same text but assign ` +
				`different clips ("${clip}" vs "${existing.clip}") - give them distinct wording, point them at the ` +
				`same clip, or (if they genuinely need to stay identical text with different recordings depending ` +
				`on which role/turn is speaking) that needs context-scoped lookup, which this manifest format doesn't support yet.`
			);
		}
		// Same key, same clip - already registered, nothing further to do.
	}

	/*
	 * Parses one sentence's template entry. sentenceText contains zero or more "%Name%" placeholders (see
	 * PLACEHOLDER_PATTERN); clipValues is the parallel array the author wrote against it, where each
	 * placeholder's position holds HOLE and every other position holds a clip name. The %Name% itself is
	 * purely a label for whoever's reading the manifest - it's never read back out of clipValues, and nothing
	 * here checks it says the same thing twice or means anything in particular.
	 *
	 * Segments of sentenceText that normalize to nothing (pure punctuation/whitespace, or genuinely empty -
	 * e.g. a hole sitting flush against the sentence's end, or against another hole) are dropped before
	 * matching clipValues against them - they have nothing to speak and nothing to look up, mirroring how
	 * Interpreter's own clipParts already drops punctuation-only atoms (see _toSequenceFromAtoms). This is
	 * also why clipValues only ever needs one entry per *meaningful* segment, not one per raw split - e.g.
	 * "Profeten tillhör nu %Identity%." needs only a two-entry array (one clip, one hole), since the
	 * trailing "." contributes no third entry.
	 *
	 * Two placeholders with nothing meaningful between them are rejected here rather than left to fail
	 * confusingly at match time - there is no way to know, from atoms alone, where the first hole ends and
	 * the second begins.
	 *
	 *   sentenceText - this sentence's key text, containing its placeholders.
	 *   clipValues   - the author's parallel value array.
	 *   sourceKey    - the original, unsplit manifest key - kept only for error messages.
	 *
	 * Returns { segments, staticTexts } - see the _templates comment for their shape.
	 */
	function _parseTemplate(sentenceText, clipValues, sourceKey) {
		const rawParts = [];
		let lastIndex = 0;
		let match;

		PLACEHOLDER_PATTERN.lastIndex = 0;
		while ((match = PLACEHOLDER_PATTERN.exec(sentenceText)) !== null) {
			rawParts.push({ literal: sentenceText.slice(lastIndex, match.index) });
			if (match[1] !== "") rawParts.push({ hole: true }); // non-empty name -> a real hole; empty ("%%") -> a splice point only, no entry needed
			lastIndex = PLACEHOLDER_PATTERN.lastIndex;
		}
		rawParts.push({ literal: sentenceText.slice(lastIndex) });

		const parts = rawParts.filter(p => p.hole || _normalizeKey(p.literal) !== "");

		for (let i = 1; i < parts.length; i++) {
			if (parts[i].hole && parts[i - 1].hole) {
				throw new Error(`TTSManifest: entry "${sourceKey}" has two placeholders with no static text between them - there's no way to tell where one ends and the next begins`);
			}
		}

		if (!parts.some(p => !p.hole)) {
			throw new Error(`TTSManifest: entry "${sourceKey}" is nothing but a placeholder - a template needs at least one static piece to anchor a match against`);
		}
		if (clipValues.length !== parts.length) {
			throw new Error(`TTSManifest: entry "${sourceKey}" has ${parts.length} meaningful segment(s) but ${clipValues.length} clip value(s)`);
		}

		const segments = [];
		const staticTexts = [];

		parts.forEach((part, i) => {
			const clipValue = clipValues[i];

			if (part.hole) {
				if (clipValue !== HOLE) {
					throw new Error(`TTSManifest: entry "${sourceKey}" - expected HOLE at position ${i} (this key segment is a %...% placeholder), got ${JSON.stringify(clipValue)}`);
				}
				segments.push({ type: "hole" });
			} else {
				if (typeof clipValue !== "string" || clipValue === "") {
					throw new Error(`TTSManifest: entry "${sourceKey}" - expected a clip name at position ${i} (this key segment is static text), got ${JSON.stringify(clipValue)}`);
				}
				segments.push({ type: "clip", clip: clipValue });
				staticTexts.push(_normalizeKey(part.literal));
			}
		});

		return { segments, staticTexts };
	}
	
	// Adds the day timer-related clips to the map as raw, normalized strings
	function _initTimerClips() {
		const SPECIAL_CLIPS = [
			{ textKey: "UI_DAYTIMER_60S_WARNING", clip: "timer_60s_warning" },
			{ textKey: "UI_DAYTIMER_30S_WARNING", clip: "timer_30s_warning" },
			{ textKey: "UI_DAYTIMER_EXPIRED",     clip: "timer_expired" },
		];
		
		for (const entry of SPECIAL_CLIPS) {
			const text = Localization.localize(entry.textKey);
			_map.set(_normalizeKey(text), entry.clip);
		}
	}
	
	// Adds numeric- and letter-form numbers to the map
	function _initNumbers(language) {
		const table = Localization.getNumberTable(); // The table of defined numbers, fetched from localization
		const languageIndex = table.FIELDS.indexOf(language);

		if (languageIndex === -1) {
			throw new Error(`TTSManifest: no number data for language "${language}"`);
		}

		for (let value = 1; value <= table.COUNT; value++) {
			const row = table[value];
			const word = row[languageIndex];
			const clipName = `num_${value}`;

			_map.set(_normalizeKey(word), clipName);
			_map.set(_normalizeKey(String(value)), clipName);
		}
	}
	
	// Adds all grammatical forms for enabled roles and teams to the map
	function _initRoles() {
		const forms = [
			{ keySuffix: "",                          clipSuffix: ""   },
			{ keySuffix: "_DEFINITE",                 clipSuffix: "_d"  },
			{ keySuffix: "_PLURAL",                   clipSuffix: "_p"  },
			{ keySuffix: "_GENITIVE",                 clipSuffix: "_g"  },
			{ keySuffix: "_PLURAL_DEFINITE",          clipSuffix: "_p_d" },
			{ keySuffix: "_DEFINITE_GENITIVE",        clipSuffix: "_d_g" },
			{ keySuffix: "_PLURAL_GENITIVE",          clipSuffix: "_p_g" },
			{ keySuffix: "_PLURAL_DEFINITE_GENITIVE", clipSuffix: "_p_d_g" },
		];

		const roles = Roles.getAllEnabled();
		const teams = new Set();

		function addForms(baseKey) {
			const clipBase = baseKey.toLowerCase();

			forms.forEach(({ keySuffix, clipSuffix }) => {
				const locName = Localization.localize(baseKey + keySuffix);
				const normalizedKey = _normalizeKey(locName);

				if (!_map.has(normalizedKey)) {
					_map.set(normalizedKey, clipBase + clipSuffix);
				}
			});
		}

		// Roles take precedence over teams.
		roles.forEach((role) => {
			addForms(role.nameKey);
			teams.add(role.team);
		});

		// Only add each team once, after all roles have been processed.
		teams.forEach((team) => {
			addForms(team);
		});
	}

	_init();

	/* =========================
	   Private functions
	   ========================= */

	function _normalizeKey(text) {
		return text
			.normalize("NFC")               // guard against decomposed vs. precomposed å/ä/ö
			.toLowerCase()
			.replace(/[^\p{L}\p{N}]+/gu, " ")  // collapse everything else to a single separator
			.trim();
	}

	/*
	 * Tries every registered template against atoms[j, i) - see _matchTemplateAt for how a single template's
	 * match (including its holes' atom ranges) is located within the span. For each template that fits, every
	 * hole is resolved recursively via lookupParts on just its own atom range - same all-or-nothing rule as
	 * everywhere else: a template only counts as fitting if *every* one of its holes resolves. Among every
	 * template that does fit, the cheapest (fewest total clips) is returned, so lookupParts' DP can compare it
	 * on equal footing against a flat lookup() match for the same span.
	 *
	 *   atoms - the full clipParts atom array for the sentence (as in lookupParts).
	 *   j, i  - the span under consideration, as in lookupParts' DP.
	 *
	 * Returns { clips } for the cheapest fitting template, or null if no template fits (or every one that
	 * matched structurally had a hole that couldn't itself be resolved).
	 */
	function _tryTemplates(atoms, j, i) {
		let best = null;

		for (const template of _templates) {
			const matched = _matchTemplateAt(template, atoms, j, i);
			if (matched === null) continue;

			const clips = [];
			let ok = true;

			for (const piece of matched) {
				if (piece.type === "clip") {
					clips.push(piece.clip);
					continue;
				}

				// piece.type === "hole" - an empty range (e.g. an IdentityList with zero entries) contributes
				// no clips of its own rather than being a failure to resolve.
				if (piece.from === piece.to) continue;

				const holeClips = _coverAtoms(atoms.slice(piece.from, piece.to));
				if (holeClips === null) { ok = false; break; }
				clips.push(...holeClips);
			}

			if (!ok) continue;
			if (best === null || clips.length < best.clips.length) best = { clips };
		}

		return best;
	}

	/*
	 * Matches one template's segments against atoms[start, end), locating each hole's atom range by scanning
	 * forward for the template's static ("clip") segments in order. A static segment's *first* matching run of
	 * atoms, left to right, is treated as authoritative - manifest entries are hand-authored by someone who
	 * knows the actual data, not adversarial input, so a static anchor that could in principle appear more
	 * than once ahead doesn't need cleverer disambiguation than "earliest point wins".
	 *
	 * Returns an ordered list of { type: "clip", clip } | { type: "hole", from, to } covering the whole span
	 * with nothing left over, or null if this template doesn't fit atoms[start, end) at all - a static segment
	 * never found, or atoms left over that no hole was open to absorb.
	 */
	function _matchTemplateAt(template, atoms, start, end) {
		const matched = [];
		let pos = start;
		let pendingHoleStart = null;
		let staticIdx = 0;

		for (const segment of template.segments) {
			if (segment.type === "hole") {
				pendingHoleStart = pos;
				continue;
			}

			const staticText = template.staticTexts[staticIdx++];
			const found = _findStaticRun(atoms, pos, end, staticText);
			if (found === null) return null;

			if (pendingHoleStart !== null) {
				matched.push({ type: "hole", from: pendingHoleStart, to: found.start });
				pendingHoleStart = null;
			} else if (found.start !== pos) {
				return null; // atoms sitting between two static segments with no hole open to claim them
			}

			matched.push({ type: "clip", clip: segment.clip });
			pos = found.end;
		}

		if (pendingHoleStart !== null) {
			matched.push({ type: "hole", from: pendingHoleStart, to: end });
		} else if (pos !== end) {
			return null; // trailing atoms after the last segment with nothing to assign them to
		}

		return matched;
	}

	/*
	 * Scans atoms[from, limit) for the first contiguous run of atoms whose joined, normalized text equals
	 * staticText - the same "join with a single space, then normalize" reconstruction lookupParts itself uses,
	 * so a run found here matches exactly what a human-written manifest entry for that phrase would.
	 *
	 * Returns { start, end } (end exclusive) of the matching run, or null if staticText never accumulates
	 * within the given range.
	 */
	function _findStaticRun(atoms, from, limit, staticText) {
		for (let start = from; start < limit; start++) {
			let acc = "";

			for (let end = start; end < limit; end++) {
				acc = acc ? `${acc} ${atoms[end].text}` : atoms[end].text;
				const normalized = _normalizeKey(acc);

				if (normalized === staticText) return { start, end: end + 1 };
				if (normalized.length > staticText.length) break; // only grows from here - no point scanning further from this start
			}
		}

		return null;
	}

	/*
	 * Does the actual work lookupParts describes - the DP search over every (j,i) span, both flat lookup()
	 * matches and template matches. No logging here: this is also called recursively by _tryTemplates to
	 * resolve a candidate template's hole(s), and a hole failing to resolve for one candidate span among
	 * many the outer DP tries is routine, recoverable exploration, not something worth reporting - only
	 * the outermost call (see lookupParts) represents a genuine, consequential failure.
	 */
	function _coverAtoms(atoms) {
		const n = atoms.length;
		if (n === 0) return [];

		const bestCost = new Array(n + 1).fill(Infinity);
		const bestClips = new Array(n + 1).fill(null);
		bestCost[0] = 0;
		bestClips[0] = [];

		for (let i = 1; i <= n; i++) {
			for (let j = 0; j < i; j++) {
				if (bestCost[j] === Infinity) continue;

				const clip = lookup(atoms.slice(j, i).map(a => a.text).join(" "));
				if (clip !== null && bestCost[j] + 1 < bestCost[i]) {
					bestCost[i] = bestCost[j] + 1;
					bestClips[i] = [...bestClips[j], clip];
				}

				const templateMatch = _tryTemplates(atoms, j, i);
				if (templateMatch !== null && bestCost[j] + templateMatch.clips.length < bestCost[i]) {
					bestCost[i] = bestCost[j] + templateMatch.clips.length;
					bestClips[i] = [...bestClips[j], ...templateMatch.clips];
				}
			}
		}

		return bestCost[n] === Infinity ? null : bestClips[n];
	}


	/* =========================
	   Public functions
	   ========================= */

	function lookup(text) {
		return _map?.get(_normalizeKey(text)) ?? null;
	}

	/*
	 * Looks up clips for an ordered list of atoms, for spliced automatic narration (see Interpreter's
	 * clipParts - a segment broken into individually-recordable pieces, e.g. a role's name plus a shared fixed
	 * suffix like ", vakna."). Rather than requiring every atom to have its own individual recording, this
	 * tries every way of grouping adjacent atoms into contiguous runs and picks whichever full covering of the
	 * atom list needs the fewest recordings (fewest splice seams) - so a group of atoms that were only split
	 * apart because two different template expressions happened to produce them (e.g. a bareword role reference
	 * sitting next to a literal phrase, both reached through an {If:...}/{Select:...} branch that Localization
	 * has to treat as unpredictable) still plays as one natural recording, as long as *that* recording exists.
	 * Which atoms end up grouped together is decided purely by what's actually in the manifest, not by
	 * anything about how the text was resolved - recording a combined phrase and adding it here is enough to
	 * start using it, with no other change required. Groups are looked up by joining their atoms' text with a
	 * single space before normalizing; since lookup()'s normalization already collapses all punctuation and
	 * whitespace runs to one separator, this reconstructs the same key a human-written manifest entry for that
	 * phrase would normalize to, regardless of the atoms' original punctuation.
	 *
	 * This is a small dynamic program (classic minimum-segments word-break): bestCost[i] is the fewest clips
	 * needed to cover atoms[0..i), built up by trying every earlier split point j and checking whether
	 * atoms[j..i) joined has a recording. For the handful of atoms a sentence realistically has, this is at
	 * most a few hundred cheap lookups - negligible next to actually playing audio.
	 *
	 * All-or-nothing still applies at the *whole segment* level: if no combination of groupings can cover
	 * every atom (some atom has no recording even entirely on its own), this returns null so the caller falls
	 * back to synthesizing the whole segment's plain text rather than mixing recorded and synthesized audio -
	 * same rule as before, just evaluated over a larger search space now. On that failure, every atom that
	 * has no recording even by itself is logged (the same diagnostic value the atom-by-atom version had),
	 * since those are exactly the ones a covering partition could never route around.
	 *
	 * atoms - ordered list of { text } chunks, e.g. a text segment's clipParts.
	 *
	 * Returns an array of clips, one per chosen group, in order; or null if no full covering exists.
	 */
	function lookupParts(atoms) {
		const names = _coverAtoms(atoms);
		if (names === null) {
			for (const atom of atoms) {
				if (lookup(atom.text) === null)
					console.log(`[TTSManifest] no recording for atom: ${JSON.stringify(atom.text)}`);
			}
		}
		return names;
	}



    return {
		lookup,
		lookupParts,
	};
	
})();