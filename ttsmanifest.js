const TTSManifest = (() => {
	
	/* =========================
	   Data
	   ========================= */

    let _map = null;   // normalized key -> file path
	
	let manifest = {
		"eller": "list_or.mp3",
		"och": "list_and.mp3",
		
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
		
		/*
Read each line as an independent, calm statement. Maintain a professional, natural narrator tone with an even voice across all lines. Do not use an enthusiastic, dramatic, or list-like rising cadence. Ensure there is a distinct, clean pause between sentences so they do not blend together.
		
		
		"Övriga spelare, fortsätt hålla ut tummen.": "others_thumb_out.mp3",
		"Alla spelare, ner med händerna.": "all_hands_down.mp3",
		"Alla spelare, ner med tummarna.": "all_thumbs_down.mp3",
		"Orakel, rör vid en annan spelares hand som du vill blockera.": "oracle_block_1.mp3",
		"Vill du tvinga fram en krusning i rum-tiden?": "oracle_ripple_1.mp3",
		"Ingen krusning är garanterad, men kan fortfarande inträffa slumpmässigt.": "oracle_ripple_2a.mp3",
		"En krusning är nu garanterad att inträffa.": "oracle_ripple_2b.mp3",
		"Spelaren får inte vakna eller utföra någon handling under natten oavsett vad deras roll är.": "oracle_block_2.mp3",
		"Om du såg Drömvargen, vakna inte med Varulvarna men följ rollens instruktioner.": "doppelganger_dreamwolf_info.mp3",
		"Vampyrer, peka på den spelare som ni har gett Vampyrernas märke.": "renfield_action_1.mp3",
		"Renfield, identifiera Vampyrerna och byt ut ditt märke mot Renfields märke.": "renfield_action_2.mp3",
		"Vampyrer, sluta peka.": "renfield_action_3.mp3",
		"Vampyrer, fortsätt peka på den spelare som ni har gett Vampyrernas märke.": "renfield_doppelganger_action_1.mp3",
		"Dubbelgångare, identifiera Vampyrerna och byt ut ditt märke mot Renfields märke.": "renfield_doppelganger_action_2.mp3",
		"Visa era kort för varandra.": "team_alien_show_cards.mp3",
		"Ko, håll ut en hand framför dig.": "cow_action_1.mp3",
		"Ko, och Dubbelgångaren om du såg Kon, håll ut en hand framför dig.": "cow_doppelganger_action.mp3",
		"Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand.": "cow_action_2.mp3",
		"Ko, ner med handen.": "cow_action_3.mp3",
		"Groob och Zerb, och Dubbelgångaren om du såg ett av Groobs och Zerbs kort, vakna och identifiera varandra.": "feudingaliens_doppelganger_action.mp3",
		"Groob och Zerb, vakna och identifiera varandra.": "feudingaliens_action.mp3",
		"Byt sedan ditt eget kort mot kortet du tittade på.": "infiltrator_action_1.mp3",
		"Ditt nya kort är nu också en Utomjording.": "infiltrator_action_2.mp3",
		"Varulvar, med undantag för Drömvargen, vakna och identifiera varandra.": "team_werewolf_dreamwolf_action_1.mp3",
		"Drömvarg, stick ut tummen så att andra Varulvar kan se vem du är.": "dreamwolf_action_1.mp3",
		"Drömvarg, ner med tummen.": "dreamwolf_action_2.mp3",
		"Varulvar, håll ut en tumme så att Underhuggaren kan se vem ni är.": "minion_action_1.mp3",
		"Varulvar, håll ut en tumme så att Lakejen kan se vem ni är.": "squire_action_1.mp3",
		"Lakej, du får titta på deras kort.": "squire_action_2.mp3",
		"Dubbelgångare, du får titta på deras kort.": "doppelganger_squire_beholder_action.mp3",
		"Varulvar, fortsätt hålla ut tummen.": "minion_squire_action_3.mp3",
		"Varulvar, ner med tummarna.": "minion_squire_action_4.mp3",
		"Garvare, håll ut en tumme så att Garvargesällen kan se vem du är.": "apprenticetanner_action_1.mp3",
		"Garvare, fortsätt hålla ut tummen så att Dubbelgångaren kan se vem du är.": "apprenticetanner_doppelganger_action.mp3",
		"Garvare, ner med tummen.": "apprenticetanner_action_2.mp3",
		"Utomjordingar, håll ut en tumme så att Borgmästaren kan se.": "leader_action_1.mp3",
		"Groob och Zerb, håll ut båda tummarna.": "leader_action_2.mp3",
		"Borgmästare, om du ser både Groob och Zerb vinner du om ingen av dem röstas ut.": "leader_action_3.mp3",
		"Utomjordingar, fortsätt hålla ut tummarna så att Dubbelgångaren kan se.": "leader_doppelganger_action.mp3",
		"Utomjordingar, ner med tummarna.": "leader_action_4.mp3",
		"Frimurare, och Dubbelgångaren om du såg en av Frimurarna, vakna och identifiera varandra.": "mason_doppelganger_action_1.mp3",
		"Frimurare, vakna och identifiera varandra.": "mason_action_1.mp3",
		"Frimurare, somna.": "mason_action_2.mp3",
		"Du får titta på en till tre andra spelares kort.": "nostradamus_action_1.mp3",
		"Profeten tillhör nu Varulvarna.": "nostradamus_action_3a.mp3",
		"Profeten tillhör nu Vampyrerna.": "nostradamus_action_3b.mp3",
		"Profeten tillhör nu Utomjordingarna.": "nostradamus_action_3c.mp3",
		"Profeten tillhör nu Garvarna.": "nostradamus_action_3d.mp3",
		"Profeten tillhör nu Garvargesällerna.": "nostradamus_action_3e.mp3",
		"Om du inte blir utröstad och det laget vinner så vinner även du.": "nostradamus_action_4.mp3",
		"Dubbelgångare, om du såg Profeten gäller samma vinstvillkor för dig.": "nostradamus_doppelganger.mp3",
		"Vänd upp en annan spelares kort.": "revealer_action_1.mp3",
		"Iaktta vad de andra spelarna gör.": "empath_action_1.mp3",
		"Placera en artefakt utan att titta på den med ansiktet ner framför en annan spelare.": "curator_action.mp3",
		"Vill du gå med i Utomjordingarnas lag?": "oracle_change_team_1a.mp3",
		"Vill du gå med i Vampyrernas lag?": "oracle_change_team_1b.mp3",
		"Vill du gå med i Varulvarnas lag?": "oracle_change_team_1c.mp3",
		"Oraklet är nu den rollen, och vaknar tillsammans med dem.": "oracle_change_team_2a.mp3",
		"Oraklet vinner nu tillsammans med det laget, men är inte den rollen och vaknar inte tillsammans med dem.": "oracle_change_team_2b.mp3",
		"Oraklet är kvar i Bybornas lag.": "oracle_change_team_2c.mp3",
		"Gissa ett tal mellan ett och tio.": "oracle_hunt_1.mp3",
		"Fel.": "oracle_hunt_2a.mp3",
		"Korrekt.": "oracle_hunt_2b.mp3",
		"När en annan roll blir tillsagd att vakna kan du en gång under natten vakna tillsammans med dem för att iaktta vem de är och vad de gör.": "oracle_hunt_3a.mp3",
		"Orakel, du vinner nu endast om du inte blir utröstad.": "oracle_hunt_3b.mp3",
		"Övriga spelare, oberoende av tidigare roll- och lagtillhörighet har ni nu endast ett vinstvillkor: hitta Oraklet.": "oracle_hunt_4b.mp3",
		"Ange om du har ett jämnt eller udda spelarnummer.": "oracle_evenodd_1.mp3",
		"Oraklet har ett jämnt spelarnummer.": "oracle_evenodd_2a.mp3",
		"Oraklet har ett udda spelarnummer.": "oracle_evenodd_2b.mp3",
		"Betraktare, du får titta på deras kort.": "beholder_action.mp3",
		"Lönnmördarnovis, vakna.": "apprenticeassassin_wake.mp3",
		"Lönnmördarnovis, somna.": "apprenticeassassin_sleep.mp3",
		*/
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






/*
PROMPT_ALIEN_TEAM (24 unique expansions)
1. Utomjordingar, vakna och identifiera varandra. Gör ingenting, stirra bara på varandra tills det blir pinsamt. Ko, och Dubbelgångaren om du såg Kon, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
2. Utomjordingar, vakna och identifiera varandra. Gör ingenting, stirra bara på varandra tills det blir pinsamt. Ko, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
3. Utomjordingar, vakna och identifiera varandra. Gör ingenting, stirra bara på varandra tills det blir pinsamt. Utomjordingar, somna.
4. Utomjordingar, vakna och identifiera varandra. Alla andra spelare, håll ut en hand framför er. Utomjordingar, rör vid en annan spelares hand som ni vill göra till en Utomjording. Spelaren är nu en Utomjording oavsett vad som händer med deras kort. Alla spelare, ner med händerna. Ko, och Dubbelgångaren om du såg Kon, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
5. Utomjordingar, vakna och identifiera varandra. Alla andra spelare, håll ut en hand framför er. Utomjordingar, rör vid en annan spelares hand som ni vill göra till en Utomjording. Spelaren är nu en Utomjording oavsett vad som händer med deras kort. Alla spelare, ner med händerna. Ko, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
6. Utomjordingar, vakna och identifiera varandra. Alla andra spelare, håll ut en hand framför er. Utomjordingar, rör vid en annan spelares hand som ni vill göra till en Utomjording. Spelaren är nu en Utomjording oavsett vad som händer med deras kort. Alla spelare, ner med händerna. Utomjordingar, somna.
7. Utomjordingar, vakna och identifiera varandra. Alla andra spelare, håll ut en hand framför er. Utomjordingar, rör vid en annan spelares hand som ni vill göra till en medhjälpare. Spelaren vinner nu om Utomjordingarna vinner oavsett om de själva blir utröstade och vad som händer med deras kort. Alla spelare, ner med händerna. Ko, och Dubbelgångaren om du såg Kon, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
8. Utomjordingar, vakna och identifiera varandra. Alla andra spelare, håll ut en hand framför er. Utomjordingar, rör vid en annan spelares hand som ni vill göra till en medhjälpare. Spelaren vinner nu om Utomjordingarna vinner oavsett om de själva blir utröstade och vad som händer med deras kort. Alla spelare, ner med händerna. Ko, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
9. Utomjordingar, vakna och identifiera varandra. Alla andra spelare, håll ut en hand framför er. Utomjordingar, rör vid en annan spelares hand som ni vill göra till en medhjälpare. Spelaren vinner nu om Utomjordingarna vinner oavsett om de själva blir utröstade och vad som händer med deras kort. Alla spelare, ner med händerna. Utomjordingar, somna.
10. Utomjordingar, vakna och identifiera varandra. Visa era kort för varandra. Ko, och Dubbelgångaren om du såg Kon, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
11. Utomjordingar, vakna och identifiera varandra. Visa era kort för varandra. Ko, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
12. Utomjordingar, vakna och identifiera varandra. Visa era kort för varandra. Utomjordingar, somna.
13. Utomjordingar, vakna och identifiera varandra. Ge era kort till närmaste Utomjording till vänster om er. Ko, och Dubbelgångaren om du såg Kon, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
14. Utomjordingar, vakna och identifiera varandra. Ge era kort till närmaste Utomjording till vänster om er. Ko, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
15. Utomjordingar, vakna och identifiera varandra. Ge era kort till närmaste Utomjording till vänster om er. Utomjordingar, somna.
16. Utomjordingar, vakna och identifiera varandra. Ge era kort till närmaste Utomjording till höger om er. Ko, och Dubbelgångaren om du såg Kon, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
17. Utomjordingar, vakna och identifiera varandra. Ge era kort till närmaste Utomjording till höger om er. Ko, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
18. Utomjordingar, vakna och identifiera varandra. Ge era kort till närmaste Utomjording till höger om er. Utomjordingar, somna.
19. Utomjordingar, vakna och identifiera varandra. Gemensamt inom laget får ni titta på . Ko, och Dubbelgångaren om du såg Kon, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
20. Utomjordingar, vakna och identifiera varandra. Gemensamt inom laget får ni titta på . Ko, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
21. Utomjordingar, vakna och identifiera varandra. Gemensamt inom laget får ni titta på . Utomjordingar, somna.
22. Utomjordingar, vakna och identifiera varandra. Individuellt får ni titta på . Ko, och Dubbelgångaren om du såg Kon, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
23. Utomjordingar, vakna och identifiera varandra. Individuellt får ni titta på . Ko, håll ut en hand framför dig. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand. Ko, ner med handen. Utomjordingar, somna.
24. Utomjordingar, vakna och identifiera varandra. Individuellt får ni titta på . Utomjordingar, somna.

PROMPT_APPRENTICETANNER (2 unique expansions)
1. Garvare, håll ut en tumme så att Garvargesällen kan se vem du är. Garvare, fortsätt hålla ut tummen så att Dubbelgångaren kan se vem du är. Dubbelgångare, somna. Garvare, ner med tummen.
2. Garvare, håll ut en tumme så att Garvargesällen kan se vem du är. Garvare, ner med tummen.

PROMPT_AURASEER (2 unique expansions)
1. {IdentityList:listDetectableRoles,and}, om ni har tittat på eller flyttat kort, håll ut en tumme så att Auraläsaren kan se den. Dubbelgångare, om du såg {Identity:instigator,definite}, vakna. Övriga spelare, fortsätt hålla ut tummen. Dubbelgångare, somna. Alla spelare, ner med tummarna.
2. {IdentityList:listDetectableRoles,and}, om ni har tittat på eller flyttat kort, håll ut en tumme så att Auraläsaren kan se den. Alla spelare, ner med tummarna.

PROMPT_BLOB (38 unique expansions)
1. Du behöver enbart förhindra att du själv blir utröstad.
2. Du måste förhindra att spelaren närmast till höger blir utröstad.
3. Du måste förhindra att spelaren närmast till vänster blir utröstad.
4. Du måste förhindra att närmaste två spelare till vänster och närmaste två spelare till höger blir utröstade. 
5. Du måste förhindra att närmaste två spelare till vänster och närmaste tre spelare till höger blir utröstade. 
6. Du måste förhindra att närmaste två spelare till vänster och närmaste fyra spelare till höger blir utröstade. {Identity:instigator}, somna.
7. Du måste förhindra att närmaste två spelare till vänster och närmaste spelare till höger blir utröstade. 
8. Du måste förhindra att närmaste tre spelare till vänster och närmaste två spelare till höger blir utröstade. 
9. Du måste förhindra att närmaste tre spelare till vänster och närmaste tre spelare till höger blir utröstade. 
10. Du måste förhindra att närmaste tre spelare till vänster och närmaste fyra spelare till höger blir utröstade. {Identity:instigator}, somna.
11. Du måste förhindra att närmaste tre spelare till vänster och närmaste spelare till höger blir utröstade. 
12. Du måste förhindra att närmaste fyra spelare till vänster och närmaste två spelare till höger blir utröstade. 
13. Du måste förhindra att närmaste fyra spelare till vänster och närmaste tre spelare till höger blir utröstade. 
14. Du måste förhindra att närmaste fyra spelare till vänster och närmaste fyra spelare till höger blir utröstade. {Identity:instigator}, somna.
15. Du måste förhindra att närmaste fyra spelare till vänster och närmaste spelare till höger blir utröstade. 
16. Du måste förhindra att närmaste spelare till vänster och närmaste två spelare till höger blir utröstade. 
17. Du måste förhindra att närmaste spelare till vänster och närmaste tre spelare till höger blir utröstade. 
18. Du måste förhindra att närmaste spelare till vänster och närmaste fyra spelare till höger blir utröstade. 
19. Du måste förhindra att närmaste spelare till vänster och närmaste spelare till höger blir utröstade. 
20. Du behöver enbart förhindra att du själv blir utröstad. 
21. Du måste förhindra att spelaren närmast till höger blir utröstad. 
22. Du måste förhindra att spelaren närmast till vänster blir utröstad. 
23. Du måste förhindra att närmaste två spelare till vänster och närmaste två spelare till höger blir utröstade. 
24. Du måste förhindra att närmaste två spelare till vänster och närmaste tre spelare till höger blir utröstade. 
25. Du måste förhindra att närmaste två spelare till vänster och närmaste fyra spelare till höger blir utröstade. 
26. Du måste förhindra att närmaste två spelare till vänster och närmaste spelare till höger blir utröstade.
27. Du måste förhindra att närmaste tre spelare till vänster och närmaste två spelare till höger blir utröstade. 
28. Du måste förhindra att närmaste tre spelare till vänster och närmaste tre spelare till höger blir utröstade. 
29. Du måste förhindra att närmaste tre spelare till vänster och närmaste fyra spelare till höger blir utröstade. 
30. Du måste förhindra att närmaste tre spelare till vänster och närmaste spelare till höger blir utröstade.
31. Du måste förhindra att närmaste fyra spelare till vänster och närmaste två spelare till höger blir utröstade. 
32. Du måste förhindra att närmaste fyra spelare till vänster och närmaste tre spelare till höger blir utröstade. 
33. Du måste förhindra att närmaste fyra spelare till vänster och närmaste fyra spelare till höger blir utröstade. 
34. Du måste förhindra att närmaste fyra spelare till vänster och närmaste spelare till höger blir utröstade.
35. Du måste förhindra att närmaste spelare till vänster och närmaste två spelare till höger blir utröstade. 
36. Du måste förhindra att närmaste spelare till vänster och närmaste tre spelare till höger blir utröstade. 
37. Du måste förhindra att närmaste spelare till vänster och närmaste fyra spelare till höger blir utröstade. 
38. Du måste förhindra att närmaste spelare till vänster och närmaste spelare till höger blir utröstade.

PROMPT_BODYSNATCHER (2 unique expansions)
1. Byt sedan ditt eget kort mot kortet du tittade på. Ditt nya kort är nu också en Utomjording. 
2. Byt sedan ditt eget kort mot kortet du tittade på. Ditt nya kort är nu också en Utomjording.

PROMPT_EMPATH (2 unique expansions)
1. Iaktta vad de andra spelarna gör. spelare {ValueList:players}, utan att vakna, {LocalizedValue:question} 
2. Iaktta vad de andra spelarna gör. spelare {ValueList:players}, utan att vakna, {LocalizedValue:question} 

PROMPT_FEUDINGALIENS (2 unique expansions)
1. Groob och Zerb, och Dubbelgångaren om du såg ett av Groobs och Zerbs kort, vakna och identifiera varandra. 
2. Groob och Zerb, vakna och identifiera varandra.

PROMPT_LEADER (4 unique expansions)
1. Utomjordingar, håll ut en tumme så att Borgmästaren kan se. Groob och Zerb, håll ut båda tummarna. Borgmästare, om du ser både Groob och Zerb vinner du om ingen av dem röstas ut. Dubbelgångare, om du såg {Identity:instigator,definite}, vakna. Utomjordingar, fortsätt hålla ut tummarna så att Dubbelgångaren kan se. Dubbelgångare, somna. Utomjordingar, ner med tummarna.
2. Utomjordingar, håll ut en tumme så att Borgmästaren kan se. Groob och Zerb, håll ut båda tummarna. Borgmästare, om du ser både Groob och Zerb vinner du om ingen av dem röstas ut. Utomjordingar, ner med tummarna.
3. Utomjordingar, håll ut en tumme så att Borgmästaren kan se. Dubbelgångare, om du såg {Identity:instigator,definite}, vakna. Utomjordingar, fortsätt hålla ut tummarna så att Dubbelgångaren kan se. Dubbelgångare, somna. Utomjordingar, ner med tummarna.
4. Utomjordingar, håll ut en tumme så att Borgmästaren kan se. Utomjordingar, ner med tummarna.

PROMPT_MASON (2 unique expansions)
1. Frimurare, och Dubbelgångaren om du såg en av Frimurarna, vakna och identifiera varandra. Frimurare, somna.
2. Frimurare, vakna och identifiera varandra. Frimurare, somna.

PROMPT_MINION (2 unique expansions)
1. Varulvar, håll ut en tumme så att Underhuggaren kan se vem ni är. Varulvar, fortsätt hålla ut tummen. Dubbelgångare, somna. Varulvar, ner med tummarna.
2. Varulvar, håll ut en tumme så att Underhuggaren kan se vem ni är. Varulvar, ner med tummarna.

PROMPT_MORTICIAN (2 unique expansions)
1. 
2. 

PROMPT_NOSTRADAMUS (6 unique expansions)
1. Du får titta på en till tre andra spelares kort. Om du ser: {IdentityList:listDangerRoles,or} måste du sluta. Profeten tillhör nu {LocalizedValue:nostradamusTeam}. Om du inte blir utröstad och det laget vinner så vinner även du. Dubbelgångare, om du såg Profeten gäller samma vinstvillkor för dig. {Identity:instigator}, somna.
2. Du får titta på en till tre andra spelares kort. Om du ser: {IdentityList:listDangerRoles,or} måste du sluta. Profeten tillhör nu {LocalizedValue:nostradamusTeam}. Om du inte blir utröstad och det laget vinner så vinner även du. 
3. Du får titta på en till tre andra spelares kort. {Identity:instigator}, somna.
4. Du får titta på en till tre andra spelares kort. Om du ser: {IdentityList:listDangerRoles,or} måste du sluta. Profeten tillhör nu {LocalizedValue:nostradamusTeam}. Om du inte blir utröstad och det laget vinner så vinner även du. Dubbelgångare, om du såg Profeten gäller samma vinstvillkor för dig.
5. Du får titta på en till tre andra spelares kort. Om du ser: {IdentityList:listDangerRoles,or} måste du sluta. Profeten tillhör nu {LocalizedValue:nostradamusTeam}. Om du inte blir utröstad och det laget vinner så vinner även du.
6. Du får titta på en till tre andra spelares kort. 

PROMPT_ORACLE (40 unique expansions)
1. 
2. Vill du gå med i {Identity:joinTeam,definite,genitive} lag? Oraklet är nu den rollen, och vaknar tillsammans med dem. {Identity:instigator}, somna.
3. Vill du gå med i {Identity:joinTeam,definite,genitive} lag? Oraklet vinner nu tillsammans med det laget, men är inte den rollen och vaknar inte tillsammans med dem. 
4. Vill du gå med i {Identity:joinTeam,definite,genitive} lag? Oraklet är kvar i Bybornas lag. 
5. Alla andra spelare, håll ut en hand framför er. Orakel, rör vid en annan spelares hand som du vill blockera. Spelaren får inte vakna eller utföra någon handling under natten oavsett vad deras roll är.
6. Byt ditt kort mot ett av mittenkorten utan att se vad det är.
7. Titta på ditt eget kort. 
8. Vänd upp en annan spelares kort. Om kortet är: {IdentityList:listHiddenRoles,or}, vänd kortet tillbaka.
9. Vänd upp en annan spelares kort. 
10. Du kan välja att stjäla en annan spelares kort och ersätta det med ditt kort. Titta sedan på kortet du stal. Du ska inte vakna när din nya roll ropas upp. 
11. Byt plats på två andra spelares kort, utan att titta på något av dem.
12. Du kan välja att flytta samtliga spelares kort ett steg åt vänster, åt höger, eller inte alls. 
13. Du kan välja att titta på ett av korten i mitten. Om du gör det måste du ge det kortet till dig själv eller en annan spelare.
14. Ange om du har ett jämnt eller udda spelarnummer. Oraklet har ett {UI_EVEN} spelarnummer. 
15. Ange om du har ett jämnt eller udda spelarnummer. Oraklet har ett {UI_ODD} spelarnummer. 
16. Gissa ett tal mellan ett och tio. Fel. Orakel, du vinner nu endast om du inte blir utröstad. Övriga spelare, oberoende av tidigare roll- och lagtillhörighet har ni nu endast ett vinstvillkor: hitta Oraklet. 
17. Gissa ett tal mellan ett och tio. Korrekt. När en annan roll blir tillsagd att vakna kan du en gång under natten vakna tillsammans med dem för att iaktta vem de är och vad de gör. Du får dock inte vakna för att iaktta någon av följande roller: {IdentityList:listExcludedRoles,or}. 
18. Gissa ett tal mellan ett och tio. Korrekt. När en annan roll blir tillsagd att vakna kan du en gång under natten vakna tillsammans med dem för att iaktta vem de är och vad de gör. {Identity:instigator}, somna.
19. Vill du tvinga fram en krusning i rum-tiden? En krusning är nu garanterad att inträffa. 
20. Vill du tvinga fram en krusning i rum-tiden? Ingen krusning är garanterad, men kan fortfarande inträffa slumpmässigt.
21. 
22. Vill du gå med i {Identity:joinTeam,definite,genitive} lag? Oraklet är nu den rollen, och vaknar tillsammans med dem. 
23. Vill du gå med i {Identity:joinTeam,definite,genitive} lag? Oraklet vinner nu tillsammans med det laget, men är inte den rollen och vaknar inte tillsammans med dem. 
24. Vill du gå med i {Identity:joinTeam,definite,genitive} lag? Oraklet är kvar i Bybornas lag. 
25. Alla andra spelare, håll ut en hand framför er. Orakel, rör vid en annan spelares hand som du vill blockera. Spelaren får inte vakna eller utföra någon handling under natten oavsett vad deras roll är. 
26. Byt ditt kort mot ett av mittenkorten utan att se vad det är. 
27. Titta på ditt eget kort.
28. Vänd upp en annan spelares kort. Om kortet är: {IdentityList:listHiddenRoles,or}, vänd kortet tillbaka.
29. Vänd upp en annan spelares kort.
30. Du kan välja att stjäla en annan spelares kort och ersätta det med ditt kort. Titta sedan på kortet du stal. Du ska inte vakna när din nya roll ropas upp.
31. Byt plats på två andra spelares kort, utan att titta på något av dem. 
32. Du kan välja att flytta samtliga spelares kort ett steg åt vänster, åt höger, eller inte alls.
33. Du kan välja att titta på ett av korten i mitten. Om du gör det måste du ge det kortet till dig själv eller en annan spelare. 
34. Ange om du har ett jämnt eller udda spelarnummer. Oraklet har ett {UI_EVEN} spelarnummer.
35. Ange om du har ett jämnt eller udda spelarnummer. Oraklet har ett {UI_ODD} spelarnummer.
36. Gissa ett tal mellan ett och tio. Fel. Orakel, du vinner nu endast om du inte blir utröstad. Övriga spelare, oberoende av tidigare roll- och lagtillhörighet har ni nu endast ett vinstvillkor: hitta Oraklet. {Identity:instigator}, somna.
37. Gissa ett tal mellan ett och tio. Korrekt. När en annan roll blir tillsagd att vakna kan du en gång under natten vakna tillsammans med dem för att iaktta vem de är och vad de gör. Du får dock inte vakna för att iaktta någon av följande roller: {IdentityList:listExcludedRoles,or}. {Identity:instigator}, somna.
38. Gissa ett tal mellan ett och tio. Korrekt. När en annan roll blir tillsagd att vakna kan du en gång under natten vakna tillsammans med dem för att iaktta vem de är och vad de gör. 
39. Vill du tvinga fram en krusning i rum-tiden? En krusning är nu garanterad att inträffa.
40. Vill du tvinga fram en krusning i rum-tiden? Ingen krusning är garanterad, men kan fortfarande inträffa slumpmässigt. 

PROMPT_PSYCHIC (2 unique expansions)
1. 
2. 

PROMPT_RASCAL (16 unique expansions)
1. Byt ditt kort mot ett av mittenkorten utan att se vad det är.
2. Titta på ditt eget kort. 
3. Vänd upp en annan spelares kort. Om kortet är: {IdentityList:listHiddenRoles,or}, vänd kortet tillbaka.
4. Vänd upp en annan spelares kort. 
5. Du kan välja att stjäla en annan spelares kort och ersätta det med ditt kort. Titta sedan på kortet du stal. Du ska inte vakna när din nya roll ropas upp. 
6. Byt plats på två andra spelares kort, utan att titta på något av dem.
7. Du kan välja att flytta samtliga spelares kort ett steg åt vänster, åt höger, eller inte alls. 
8. Du kan välja att titta på ett av korten i mitten. Om du gör det måste du ge det kortet till dig själv eller en annan spelare.
9. Byt ditt kort mot ett av mittenkorten utan att se vad det är. 
10. Titta på ditt eget kort.
11. Vänd upp en annan spelares kort. Om kortet är: {IdentityList:listHiddenRoles,or}, vänd kortet tillbaka.
12. Vänd upp en annan spelares kort.
13. Du kan välja att stjäla en annan spelares kort och ersätta det med ditt kort. Titta sedan på kortet du stal. Du ska inte vakna när din nya roll ropas upp.
14. Byt plats på två andra spelares kort, utan att titta på något av dem. 
15. Du kan välja att flytta samtliga spelares kort ett steg åt vänster, åt höger, eller inte alls.
16. Du kan välja att titta på ett av korten i mitten. Om du gör det måste du ge det kortet till dig själv eller en annan spelare. 

PROMPT_RENFIELD (2 unique expansions)
1. Vampyrer, peka på den spelare som ni har gett Vampyrernas märke. Renfield, identifiera Vampyrerna och byt ut ditt märke mot Renfields märke. Vampyrer, fortsätt peka på den spelare som ni har gett Vampyrernas märke. Dubbelgångare, identifiera Vampyrerna och byt ut ditt märke mot Renfields märke. Dubbelgångare, somna. Vampyrer, sluta peka.
2. Vampyrer, peka på den spelare som ni har gett Vampyrernas märke. Renfield, identifiera Vampyrerna och byt ut ditt märke mot Renfields märke. Vampyrer, sluta peka.

PROMPT_RIPPLE (13 unique expansions)
1. Det har inträffat en krusning i rum-tiden. Ni har endast en minut på er innan ni måste rösta.
2. Det har inträffat en krusning i rum-tiden. Spelare {Value:player}, vakna. Byt ditt kort mot ett av mittenkorten utan att se vad det är. Spelare {Value:player}, somna.
3. Det har inträffat en krusning i rum-tiden. Spelare {Value:player}, vakna. Titta på ditt eget kort. Spelare {Value:player}, somna.
4. Det har inträffat en krusning i rum-tiden. Spelare {Value:player}, vakna. Vänd upp en annan spelares kort. Om kortet är: {IdentityList:listHiddenRoles,or}, vänd kortet tillbaka. Spelare {Value:player}, somna.
5. Det har inträffat en krusning i rum-tiden. Spelare {Value:player}, vakna. Vänd upp en annan spelares kort. Spelare {Value:player}, somna.
6. Det har inträffat en krusning i rum-tiden. Spelare {Value:player}, vakna. Du kan välja att stjäla en annan spelares kort och ersätta det med ditt kort. Titta sedan på kortet du stal. Du ska inte vakna när din nya roll ropas upp. Spelare {Value:player}, somna.
7. Det har inträffat en krusning i rum-tiden. Spelare {Value:player}, vakna. Byt plats på två andra spelares kort, utan att titta på något av dem. Spelare {Value:player}, somna.
8. Det har inträffat en krusning i rum-tiden. Spelare {Value:player}, vakna. Du kan välja att flytta samtliga spelares kort ett steg åt vänster, åt höger, eller inte alls. Spelare {Value:player}, somna.
9. Det har inträffat en krusning i rum-tiden. Spelare {Value:player}, vakna. Du kan välja att titta på ett av korten i mitten. Om du gör det måste du ge det kortet till dig själv eller en annan spelare. Spelare {Value:player}, somna.
10. Det har inträffat en krusning i rum-tiden. Spelare {ValueList:players} får inte prata förrän efter omröstningen.
11. Det har inträffat en krusning i rum-tiden. Spelare {ValueList:players} måste vända sig från bordet förrän efter omröstningen.
12. Det har inträffat en krusning i rum-tiden. Spelare {Value:player}, vakna. Spelare {Value:player}, somna.
13. Det har inträffat en krusning i rum-tiden. Spelare {ValueList:players} får under omröstningen använda båda händerna för dubbla röster.

PROMPT_SQUIRE (2 unique expansions)
1. Varulvar, håll ut en tumme så att Lakejen kan se vem ni är. Lakej, du får titta på deras kort. Dubbelgångare, om du såg {Identity:instigator,definite}, vakna. Varulvar, fortsätt hålla ut tummen. Dubbelgångare, du får titta på deras kort. Dubbelgångare, somna. Varulvar, ner med tummarna.
2. Varulvar, håll ut en tumme så att Lakejen kan se vem ni är. Lakej, du får titta på deras kort. Varulvar, ner med tummarna.

PROMPT_VAMPIRE_TEAM (1 unique expansions)
1. Vampyrer, vakna och identifiera varandra. Tillsammans får ni välja en spelare vars märke ni byter ut mot Vampyrernas märke. Vampyrer, somna.

PROMPT_WEREWOLF_TEAM (2 unique expansions)
1. Varulvar, med undantag för Drömvargen, vakna och identifiera varandra. Drömvarg, stick ut tummen så att andra Varulvar kan se vem du är. Om det bara finns en Varulv får du titta på ett av mittenkorten. Drömvarg, ner med tummen. Varulvar, somna.
2. Varulvar, vakna och identifiera varandra. Om det bara finns en Varulv får du titta på ett av mittenkorten. Varulvar, somna.

SWE unique sentences (126)
1. Utomjordingar, vakna och identifiera varandra.
2. Gör ingenting, stirra bara på varandra tills det blir pinsamt.
3. Ko, och Dubbelgångaren om du såg Kon, håll ut en hand framför dig.
4. Utomjordingar, om minst en av er är granne med Kon, rör vid Kons hand.
5. Ko, ner med handen.
6. Utomjordingar, somna.
7. Ko, håll ut en hand framför dig.
8. Alla andra spelare, håll ut en hand framför er.
9. Utomjordingar, rör vid en annan spelares hand som ni vill göra till en Utomjording.
10. Spelaren är nu en Utomjording oavsett vad som händer med deras kort.
11. Alla spelare, ner med händerna.
12. Utomjordingar, rör vid en annan spelares hand som ni vill göra till en medhjälpare.
13. Spelaren vinner nu om Utomjordingarna vinner oavsett om de själva blir utröstade och vad som händer med deras kort.
14. Visa era kort för varandra.
15. Ge era kort till närmaste Utomjording till vänster om er.
16. Ge era kort till närmaste Utomjording till höger om er.
17. Gemensamt inom laget får ni titta på .
18. Individuellt får ni titta på .
19. 
20. Garvare, håll ut en tumme så att Garvargesällen kan se vem du är.
21. 
22. 
23. Garvare, fortsätt hålla ut tummen så att Dubbelgångaren kan se vem du är.
24. Dubbelgångare, somna.
25. Garvare, ner med tummen.
26. {IdentityList:listDetectableRoles,and}, om ni har tittat på eller flyttat kort, håll ut en tumme så att Auraläsaren kan se den.
27. Övriga spelare, fortsätt hålla ut tummen.
28. Alla spelare, ner med tummarna.
29. 
30. Du behöver enbart förhindra att du själv blir utröstad.
31. Du måste förhindra att spelaren närmast till höger blir utröstad.
32. Du måste förhindra att spelaren närmast till vänster blir utröstad.
33. Du måste förhindra att närmaste två spelare till vänster och närmaste två spelare till höger blir utröstade.
34. Du måste förhindra att närmaste två spelare till vänster och närmaste tre spelare till höger blir utröstade.
35. Du måste förhindra att närmaste två spelare till vänster och närmaste fyra spelare till höger blir utröstade.
36. Du måste förhindra att närmaste två spelare till vänster och närmaste spelare till höger blir utröstade.
37. Du måste förhindra att närmaste tre spelare till vänster och närmaste två spelare till höger blir utröstade.
38. Du måste förhindra att närmaste tre spelare till vänster och närmaste tre spelare till höger blir utröstade.
39. Du måste förhindra att närmaste tre spelare till vänster och närmaste fyra spelare till höger blir utröstade.
40. Du måste förhindra att närmaste tre spelare till vänster och närmaste spelare till höger blir utröstade.
41. Du måste förhindra att närmaste fyra spelare till vänster och närmaste två spelare till höger blir utröstade.
42. Du måste förhindra att närmaste fyra spelare till vänster och närmaste tre spelare till höger blir utröstade.
43. Du måste förhindra att närmaste fyra spelare till vänster och närmaste fyra spelare till höger blir utröstade.
44. Du måste förhindra att närmaste fyra spelare till vänster och närmaste spelare till höger blir utröstade.
45. Du måste förhindra att närmaste spelare till vänster och närmaste två spelare till höger blir utröstade.
46. Du måste förhindra att närmaste spelare till vänster och närmaste tre spelare till höger blir utröstade.
47. Du måste förhindra att närmaste spelare till vänster och närmaste fyra spelare till höger blir utröstade.
48. Du måste förhindra att närmaste spelare till vänster och närmaste spelare till höger blir utröstade.
49. 
50. Byt sedan ditt eget kort mot kortet du tittade på.
51. Ditt nya kort är nu också en Utomjording.
52. Iaktta vad de andra spelarna gör.
53. spelare {ValueList:players}, utan att vakna, {LocalizedValue:question} 
54. Groob och Zerb, och Dubbelgångaren om du såg ett av Groobs och Zerbs kort, vakna och identifiera varandra.
55. Groob och Zerb, vakna och identifiera varandra.
56. Utomjordingar, håll ut en tumme så att Borgmästaren kan se.
57. Groob och Zerb, håll ut båda tummarna.
58. Borgmästare, om du ser både Groob och Zerb vinner du om ingen av dem röstas ut.
59. Utomjordingar, fortsätt hålla ut tummarna så att Dubbelgångaren kan se.
60. Utomjordingar, ner med tummarna.
61. Frimurare, och Dubbelgångaren om du såg en av Frimurarna, vakna och identifiera varandra.
62. Frimurare, somna.
63. Frimurare, vakna och identifiera varandra.
64. Varulvar, håll ut en tumme så att Underhuggaren kan se vem ni är.
65. Varulvar, fortsätt hålla ut tummen.
66. Varulvar, ner med tummarna.
67. Du får titta på en till tre andra spelares kort.
68. Om du ser: {IdentityList:listDangerRoles,or} måste du sluta.
69. Profeten tillhör nu {LocalizedValue:nostradamusTeam}.
70. Om du inte blir utröstad och det laget vinner så vinner även du.
71. Dubbelgångare, om du såg Profeten gäller samma vinstvillkor för dig.
72. Vill du gå med i {Identity:joinTeam,definite,genitive} lag?
73. Oraklet är nu den rollen, och vaknar tillsammans med dem.
74. Oraklet vinner nu tillsammans med det laget, men är inte den rollen och vaknar inte tillsammans med dem.
75. Oraklet är kvar i Bybornas lag.
76. Orakel, rör vid en annan spelares hand som du vill blockera.
77. Spelaren får inte vakna eller utföra någon handling under natten oavsett vad deras roll är.
78. Byt ditt kort mot ett av mittenkorten utan att se vad det är.
79. Titta på ditt eget kort.
80. Vänd upp en annan spelares kort.
81. Om kortet är: {IdentityList:listHiddenRoles,or}, vänd kortet tillbaka.
82. Du kan välja att stjäla en annan spelares kort och ersätta det med ditt kort.
83. Titta sedan på kortet du stal.
84. Du ska inte vakna när din nya roll ropas upp.
85. Byt plats på två andra spelares kort, utan att titta på något av dem.
86. Du kan välja att flytta samtliga spelares kort ett steg åt vänster, åt höger, eller inte alls.
87. Du kan välja att titta på ett av korten i mitten.
88. Om du gör det måste du ge det kortet till dig själv eller en annan spelare.
89. Ange om du har ett jämnt eller udda spelarnummer.
90. Oraklet har ett {UI_EVEN} spelarnummer.
91. Oraklet har ett {UI_ODD} spelarnummer.
92. Gissa ett tal mellan ett och tio.
93. Fel.
94. Orakel, du vinner nu endast om du inte blir utröstad.
95. Övriga spelare, oberoende av tidigare roll- och lagtillhörighet har ni nu endast ett vinstvillkor: hitta Oraklet.
96. Korrekt.
97. När en annan roll blir tillsagd att vakna kan du en gång under natten vakna tillsammans med dem för att iaktta vem de är och vad de gör.
98. Du får dock inte vakna för att iaktta någon av följande roller: {IdentityList:listExcludedRoles,or}.
99. Vill du tvinga fram en krusning i rum-tiden?
100. En krusning är nu garanterad att inträffa.
101. Ingen krusning är garanterad, men kan fortfarande inträffa slumpmässigt.
102. Vampyrer, peka på den spelare som ni har gett Vampyrernas märke.
103. Renfield, identifiera Vampyrerna och byt ut ditt märke mot Renfields märke.
104. Vampyrer, fortsätt peka på den spelare som ni har gett Vampyrernas märke.
105. Dubbelgångare, identifiera Vampyrerna och byt ut ditt märke mot Renfields märke.
106. Vampyrer, sluta peka.
107. Det har inträffat en krusning i rum-tiden.
108. Ni har endast en minut på er innan ni måste rösta.
109. Spelare {Value:player}, vakna.
110. Spelare {Value:player}, somna.
111. Spelare {ValueList:players} får inte prata förrän efter omröstningen.
112. Spelare {ValueList:players} måste vända sig från bordet förrän efter omröstningen.
113. Spelare {ValueList:players} får under omröstningen använda båda händerna för dubbla röster.
114. Det har inträffat en krusning i rum-tiden.
115. Varulvar, håll ut en tumme så att Lakejen kan se vem ni är.
116. Lakej, du får titta på deras kort.
117. Dubbelgångare, du får titta på deras kort.
118. Vampyrer, vakna och identifiera varandra.
119. Tillsammans får ni välja en spelare vars märke ni byter ut mot Vampyrernas märke.
120. Vampyrer, somna.
121. Varulvar, med undantag för Drömvargen, vakna och identifiera varandra.
122. Drömvarg, stick ut tummen så att andra Varulvar kan se vem du är.
123. Om det bara finns en Varulv får du titta på ett av mittenkorten.
124. Drömvarg, ner med tummen.
125. Varulvar, somna.
126. Varulvar, vakna och identifiera varandra.
*/