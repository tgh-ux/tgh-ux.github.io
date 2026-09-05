const TTSManifest = (() => {
	
	/* =========================
	   Data
	   ========================= */

    let _map = null;   // normalized key -> file path
	
/*
Google Cloud TTS, Gemini 3.1 Flash TTS, Callirrhoe
Instruction prompt:
Read each line as an independent, calm statement. Maintain a professional, natural narrator tone with an even voice across all lines. Do not use an enthusiastic, dramatic, or list-like rising cadence. Ensure there is a distinct, clean pause between sentences so they do not blend together.
*/
	
	let manifest = {
		"eller": "list_or.mp3",
		"och": "list_and.mp3",
		"spelare": "player.mp3",
		
		"Individuellt får ni titta på": "view_card_prefix_individual.mp3",
		"Gemensamt inom laget får ni titta på": "view_card_prefix_together.mp3",
		"Du får titta på": "view_card_prefix_solo.mp3",

		"ett": "num_1.mp3",
		"två": "num_2.mp3",
		"tre": "num_3.mp3",
		"fyra": "num_4.mp3",
		"fem": "num_5.mp3",
		"sex": "num_6.mp3",
		"sju": "num_7.mp3",
		"åtta": "num_8.mp3",
		"nio": "num_9.mp3",
		"1": "num_1.mp3",
		"2": "num_2.mp3",
		"3": "num_3.mp3",
		"4": "num_4.mp3",
		"5": "num_5.mp3",
		"6": "num_6.mp3",
		"7": "num_7.mp3",
		"8": "num_8.mp3",
		"9": "num_9.mp3",

		"kort från andra spelare.": "view_card_suffix_other_players.mp3",
		"kort från udda spelare.": "view_card_suffix_odd_players.mp3",
		"kort från jämna spelare.": "view_card_suffix_even_players.mp3",
		"av mittenkorten.": "view_card_suffix_center.mp3",
		"ett kort från en annan spelare.": "view_card_suffix_one_player.mp3",
		"båda grannars kort.": "view_card_suffix_both_neighbors.mp3",
		"ditt eget kort.": "view_card_suffix_own.mp3",
		"en grannes kort.": "view_card_suffix_any_neighbor.mp3",
		"höger grannes kort.": "view_card_suffix_right_neighbor.mp3",
		"vänster grannes kort.": "view_card_suffix_left_neighbor.mp3",
		"kort som tillhör spelare": "view_card_playerlist_prefix.mp3",
		
		"Utomjordingar": "team_alien_p.mp3",
		"Vampyrer": "team_vampire_p.mp3",
		"Varulvar": "team_werewolf_p.mp3",
		
		"Alla spelare": "all_players.mp3",
		"Förälskade": "lovers.mp3",
		", vakna.": "generic_wake.mp3",
		", somna.": "generic_sleep.mp3",
		", vakna och identifiera varandra.": "wake_and_identify.mp3",
		"Dubbelgångare, om du såg": "doppelganger_wake_prefix.mp3",
		", du får titta på deras kort.": "shared_may_view_cards.mp3",
		"Alla spelare, ner med tummarna.": "all_thumbs_down.mp3",
		"Övriga spelare, fortsätt hålla ut tummen.": "others_thumb_out.mp3",
		"Alla andra spelare, håll ut en hand framför er.": "all_hands_out.mp3",
		", ner med tummen.": "thumb_down.mp3",
		", håll ut en hand framför dig.": "hand_out.mp3",
		", ner med handen.": "hand_down.mp3",
		"Alla spelare, ner med händerna.": "all_hands_down.mp3",
		
		"Titta på en annan spelares kort.": "doppelganger_1.mp3",
		"Du är nu rollen du såg.": "doppelganger_2.mp3",
		"Om rollen du såg var ": "doppelganger_3_prefix.mp3",
		", utför dess handling nu.": "doppelganger_3_suffix.mp3",
		"Om du såg en ": "doppelganger_4_prefix.mp3",
		", vakna tillsammans med det laget när de ropas upp.": "doppelganger_4_suffix.mp3",
		"Om du såg Drömvargen, vakna inte med Varulvarna men följ rollens instruktioner.": "doppelganger_4_dreamwolf.mp3",
		"Titta på ett av mittenkorten.": "copycat_1.mp3",
		//"Du är nu rollen du såg.": "copycat_2.mp3",
		"När rollen ropas upp, vakna och utför dess handling.": "copycat_3.mp3",
		"Tillsammans får ni välja en spelare vars märke ni byter ut mot Vampyrernas märke.": "vampire_team_1.mp3",
		"Byt ut en annan spelares märke mot Grevens märke.": "count_1.mp3",
		"Byt ut en av dina grannars märken mot den Smittades märke.": "diseased_1.mp3",
		"Byt ut två andra spelares märken mot Amors märke.": "cupid_1.mp3",
		"Byt ut en annan spelares märke mot Anstiftarens märke.": "instigator_1.mp3",
		"Byt ut ditt märke mot ett rent märke.": "priest_1.mp3",
		"Om du vill får du även byta ut en annan spelares märke mot ett rent märke.": "priest_2.mp3",
		"Kontrollera era märken utan att visa dem för någon annan.": "check_marks.mp3",
		"Om en av er röstas ut så kommer samtliga att röstas ut.": "lovers_1.mp3",
		"Placera en Sköldbricka på en annan spelares kort.": "sentinel_1.mp3",
		"Andra spelare får varken titta på eller flytta kortet under natten.": "sentinel_2.mp3",
		"Om det bara finns en Varulv får du titta på ett av mittenkorten.": "werewolf_team_1.mp3",
		"Byt det extra kortet i mitten mot någon annan spelares kort som inte redan är Varulv.": "alphawolf_1.mp3",
		//"Alla andra spelare, håll ut en hand framför er.": "thing_1.mp3",
		"Varelsen, rör handen tillhörande spelaren närmast till höger eller vänster.": "thing_2.mp3",
		"Du får titta på en annan spelares kort, eller två av mittenkorten.": "seer_1.mp3",
		"Du får titta på en till två andra spelares kort.": "paranormalinvestigator_1.mp3",
		"Om du ser:": "paranormalinvestigator_2.mp3",
		", måste du sluta, och tillhör då deras lag.": "paranormalinvestigator_3.mp3",
		"Titta på en annan spelares kort, samt ytterligare en annan spelares märke.": "marksman_1.mp3",
		"Det får inte vara samma spelare.": "marksman_2.mp3",
		"Du kan välja att stjäla en annan spelares kort och ersätta det med ditt kort.": "robber_1.mp3",
		"Titta sedan på kortet du stal.": "robber_2.mp3",
		"Du ska inte vakna när din nya roll ropas upp.": "robber_3.mp3",
		"Du kan välja att titta på ett av korten i mitten.": "witch_1.mp3",
		"Om du gör det måste du ge det kortet till dig själv eller en annan spelare.": "witch_2.mp3",
		"Du kan välja att stjäla en annan spelares märke och ersätta det med ditt märke.": "pickpocket_1.mp3",
		"Titta sedan på märket du stal.": "pickpocket_2.mp3",
		"Byt plats på två andra spelares kort, utan att titta på något av dem.": "troublemaker_1.mp3",
		"Du kan välja att flytta samtliga spelares kort ett steg åt vänster, åt höger, eller inte alls.": "villageidiot_1.mp3",
		"Byt plats på två andra spelares märken eller två andra spelares kort, utan att titta på något av dem.": "gremlin_1.mp3",
		"Byt ditt kort mot ett av mittenkorten utan att se vad det är.": "drunk_1.mp3",
		"Titta på ditt eget kort.": "insomniac_1.mp3",
		"Vänd upp en annan spelares kort.": "revealer_1.mp3",
		"Om kortet är:": "revealer_2.mp3",
		", vänd kortet tillbaka.": "revealer_3.mp3",
		"Placera en artefakt utan att titta på den med ansiktet ner framför en annan spelare.": "curator_1.mp3",
		"Du får vända": "exposer_1.mp3",
		//"av mittenkorten.": "exposer_2.mp3",
		", håll ut en tumme så att Betraktaren kan se vem ni är.": "beholder_1.mp3",
		"Byt ut en annan spelares märke mot Lönnmördarens märke.": "assassin_1.mp3",
		"Identifiera Lönnmördaren.": "apprenticeassassin_1.mp3",
		"Om det inte finns någon Lönnmördare:": "apprenticeassassin_2.mp3",
		", om ni har tittat på eller flyttat kort, håll ut en tumme så att Auraläsaren kan se den.": "auraseer_1.mp3",
		", med undantag för Drömvargen": "werewolf_team_dreamwolf_1.mp3",
		"Drömvarg, stick ut tummen så att andra Varulvar kan se vem du är.": "werewolf_team_dreamwolf_2.mp3",
		"Garvare, håll ut en tumme så att Garvargesällen kan se vem du är.": "apprenticetanner_1.mp3",
		"Garvare, fortsätt hålla ut tummen så att Dubbelgångaren kan se vem du är.": "apprenticetanner_doppelganger.mp3",
		"Du behöver enbart förhindra att du själv blir utröstad.": "blob_solo.mp3",
		"Du måste förhindra att du själv och närmaste spelare till höger blir utröstade.": "blob_duo_right.mp3",
		"Du måste förhindra att du själv och närmaste spelare till vänster blir utröstade.": "blob_duo_left.mp3",
		"Du måste förhindra att du själv, närmaste": "blob_multi_1.mp3",
		"spelare till vänster, och närmaste": "blob_multi_2.mp3",
		"spelare till höger blir utröstade.": "blob_multi_3.mp3",
		"Iaktta vad de andra spelarna gör.": "empath_1.mp3",
		", utan att vakna": "empath_2.mp3",
		", visa tummen upp om du tror att du kommer vinna, eller tummen ner om du tror att du kommer förlora.": "empath_q_10.mp3",
		", peka på den spelare som du tror är mest sannolik att redan ha glömt sin roll.": "empath_q_11.mp3",
		", peka på en spelare som du tror kommer vinna.": "empath_q_1.mp3",
		", peka på en spelare som du tror blir utröstad.": "empath_q_2.mp3",
		", peka på den spelare som du litar mest på.": "empath_q_3.mp3",
		", peka på den spelare som du litar minst på.": "empath_q_4.mp3",
		", peka på en spelare som du tror är en av Byborna.": "empath_q_5.mp3",
		", peka på den spelare som du tror kommer prata mest.": "empath_q_6.mp3",
		", peka på den spelare som du tror kommer prata minst.": "empath_q_7.mp3",
		", peka på den spelare som du tror är bäst på att bluffa.": "empath_q_8.mp3",
		", peka på den spelare som du tror är sämst på att bluffa.": "empath_q_9.mp3",
		
		"Du får titta på en till tre andra spelares kort.": "nostradamus_1.mp3",
		//"Om du ser:": "nostradamus_2.mp3",
		", måste du sluta.": "nostradamus_3.mp3",
		"Profeten tillhör nu": "nostradamus_4.mp3",
		"Om du inte blir utröstad och det laget vinner så vinner även du.": "nostradamus_5.mp3",
		"Dubbelgångare, om du såg Profeten gäller samma vinstvillkor för dig.": "nostradamus_doppelganger.mp3",
		"Visa era kort för varandra.": "alien_team_show_cards.mp3",
		"Ge era kort till närmaste Utomjording till höger om er.": "alien_team_shift_cards_right.mp3",
		"Ge era kort till närmaste Utomjording till vänster om er.": "alien_team_shift_cards_left.mp3",
		"Gör ingenting, stirra bara på varandra tills det blir pinsamt.": "alien_team_do_nothing.mp3",
		", och Dubbelgångaren om du såg Kon": "alien_team_cow_doppelganger.mp3",
		"Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand.": "alien_team_cow_1.mp3",
		"Utomjordingar, rör vid en annan spelares hand.": "alien_team_turncoat_1.mp3",
		"Spelaren är nu en Utomjording oavsett vad som händer med deras kort.": "alien_team_turncoat_2a.mp3",
		"Spelaren vinner nu om Utomjordingarna vinner oavsett om de själva blir utröstade och vad som händer med deras kort.": "alien_team_turncoat_2b.mp3",
		"Vampyrer, peka på den spelare som ni har gett Vampyrernas märke.": "renfield_1.mp3",
		", identifiera Vampyrerna och byt ut ditt märke mot Renfields märke.": "renfield_2.mp3",
		"Vampyrer, fortsätt peka på den spelare som ni har gett Vampyrernas märke.": "renfield_doppelganger.mp3",
		"Vampyrer, sluta peka.": "renfield_3.mp3",
		"Byt sedan ditt eget kort mot kortet du tittade på.": "bodysnatcher_1.mp3",
		"Ditt nya kort är nu också en Utomjording.": "bodysnatcher_2.mp3",
		", och Dubbelgångaren om du såg en av Frimurarna": "mason_doppelganger.mp3",
		"Varulvar, håll ut en tumme så att Underhuggaren kan se vem ni är.": "minion_1.mp3",
		"Varulvar, fortsätt hålla ut tummen.": "minion_doppelganger.mp3",
		"Varulvar, ner med tummarna.": "minion_2.mp3",
		"Varulvar, håll ut en tumme så att Lakejen kan se vem ni är.": "squire_1.mp3",
		//"Varulvar, fortsätt hålla ut tummen.": "squire_doppelganger.mp3",
		//"Varulvar, ner med tummarna.": "squire_2.mp3",
		"Det har inträffat en krusning i rum-tiden.": "ripple.mp3",
		"Ni har endast en minut på er innan ni måste rösta.": "ripple_timer.mp3",
		", får inte prata förrän efter omröstningen.": "ripple_mute.mp3",
		", måste vända sig från bordet fram till efter omröstningen.": "ripple_rebuke.mp3",
		", får under omröstningen använda båda händerna för dubbla röster.": "ripple_double_vote.mp3",
		"Vill du gå med i Varulvarnas lag?": "oracle_join_werewolves.mp3",
		"Vill du gå med i Utomjordingarnas lag?": "oracle_join_aliens.mp3",
		"Vill du gå med i Vampyrernas lag?": "oracle_join_vampires.mp3",
		"Oraklet är nu den rollen, och vaknar tillsammans med dem.": "oracle_join_full.mp3",
		"Oraklet vinner nu tillsammans med det laget, men är inte den rollen och vaknar inte tillsammans med dem.": "oracle_join_partial.mp3",
		"Oraklet är kvar i Bybornas lag.": "oracle_join_denied.mp3",
		"Orakel, rör vid en annan spelares hand som du vill blockera.": "oracle_block_1.mp3",
		"Spelaren får inte vakna eller utföra någon handling under natten oavsett vad deras roll är.": "oracle_block_2.mp3",
		"Ange om du har ett jämnt eller udda spelarnummer.": "oracle_even_odd.mp3",
		"Oraklet har ett jämnt spelarnummer.": "oracle_even.mp3",
		"Oraklet har ett udda spelarnummer.": "oracle_odd.mp3",
		"Gissa ett tal mellan ett och tio.": "oracle_guess_1.mp3",
		"Fel.": "oracle_guess_wrong_1.mp3",
		"Korrekt.": "oracle_guess_right_1.mp3",
		"Orakel, du vinner nu endast om du inte blir utröstad.": "oracle_guess_wrong_2.mp3",
		"Övriga spelare, oberoende av tidigare roll- och lagtillhörighet har ni nu endast ett vinstvillkor: hitta Oraklet.": "oracle_guess_wrong_3.mp3",
		"När en annan roll blir tillsagd att vakna kan du en gång under natten vakna tillsammans med dem för att iaktta vem de är och vad de gör.": "oracle_guess_right_2.mp3",
		"Du får dock inte vakna för att iaktta någon av följande roller:": "oracle_guess_right_3.mp3",
		"Vill du tvinga fram en krusning i rum-tiden?": "oracle_force_ripple.mp3",
		"En krusning är nu garanterad att inträffa.": "oracle_force_ripple_yes.mp3",
		"Ingen krusning är garanterad, men kan fortfarande inträffa slumpmässigt.": "oracle_force_ripple_no.mp3",
		", och Dubbelgångaren om du såg ett av deras kort": "feudingaliens_doppelganger.mp3",
		"Utomjordingar, håll ut en tumme så att Borgmästaren kan se vem ni är.": "leader_1.mp3",
		"Groob och Zerb, håll ut båda tummarna.": "leader_feudingaliens_1.mp3",
		"Borgmästare, om du ser både Groob och Zerb vinner du om ingen av dem röstas ut.": "leader_feudingaliens_2.mp3",
		"Utomjordingar, fortsätt hålla ut tummarna.": "leader_doppelganger.mp3",
		"Utomjordingar, ner med tummarna.": "leader_2.mp3",
	};


	/* =========================
	   Initialization
	   ========================= */

	function _init() {
		_map = new Map();

		Roles.getAllEnabled().forEach((role) => {
			const locName = Localization.localize(role.nameKey);
			const manifestKey = role.nameKey.toLowerCase() + ".mp3";
			manifest[locName] = manifestKey;
			
			const locNameDefinite = Localization.localize(role.nameKey + "_DEFINITE");
			if (locName !== locNameDefinite) {
				const manifestKeyDefinite = role.nameKey.toLowerCase() + "_d.mp3";
				manifest[locNameDefinite] = manifestKeyDefinite;
			}
		});

		for (const [key, value] of Object.entries(manifest)) {
			_map.set(_normalizeKey(key), value);
			
			//console.log(_normalizeKey(key) + " -> " + value);
		}
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

	/* =========================
	   Public functions
	   ========================= */

    function lookup(text) {
		const file = _map?.get(_normalizeKey(text)) ?? null;
		
		if (file !== null) {
			const lang = Localization.getLanguage();
			return `TTS/${lang}/${file}`;
		}
		
        return null;
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
	 * Returns an array of clip URLs, one per chosen group, in order; or null if no full covering exists.
	 */
	function lookupParts(atoms) {
		const n = atoms.length;
		if (n === 0) return [];

		const bestCost = new Array(n + 1).fill(Infinity);
		const bestUrls = new Array(n + 1).fill(null);
		bestCost[0] = 0;
		bestUrls[0] = [];

		for (let i = 1; i <= n; i++) {
			for (let j = 0; j < i; j++) {
				if (bestCost[j] === Infinity) continue;

				const url = lookup(atoms.slice(j, i).map(a => a.text).join(" "));
				if (url === null) continue;

				if (bestCost[j] + 1 < bestCost[i]) {
					bestCost[i] = bestCost[j] + 1;
					bestUrls[i] = [...bestUrls[j], url];
				}
			}
		}

		if (bestCost[n] === Infinity) {
			for (const atom of atoms) {
				if (lookup(atom.text) === null)
					console.log(`[TTSManifest] no recording for atom: ${JSON.stringify(atom.text)}`);
			}
			return null;
		}

		return bestUrls[n];
	}



    return {
		lookup,
		lookupParts,
	};
	
})();
