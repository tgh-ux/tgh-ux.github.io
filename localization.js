/*
 * Localization and template engine.
 *
 * Stores all localized strings, manages the active language, and resolves localization templates into final text.
 *
 * The template language is intentionally lightweight, allowing narration, role descriptions and UI text to be generated from reusable localization
 * keys rather than hard-coded strings.
 */

const Localization = (() => {
	
	/* =========================
	   Data
	   ========================= */
	
	// Representation of currently selected language (and also default if not previously selected)
	let LANG = "SWE";
	
	// Persistent storage key for language selection
	const LANGUAGE_STORE = "onuw_lang"
	
	// Safety limit preventing an infinite loop caused by cyclic template references. Increase as needed if deeper template resolution is required.
	const MAX_ITERATIONS = 20;
	
	// Wrapper marking a template argument that was written as a quoted literal, as opposed to a bareword key reference - the two are otherwise
	// indistinguishable plain strings once _parseTemplateArg has stripped quotes. Primitives that branch between "wrap as key" and "use as-is" 
	// check isLiteral(); everything else can keep treating it as a string via normal coercion (+, `${}`, String(), etc. all fall through to toString()).
	class TemplateLiteral {
		constructor(value) { this.value = value; }
		toString() { return this.value; }
	}
	
/*
 * Localization data grouped by key.
 *
 * Each entry is keyed by its localization key, and holds the translations for that key across languages as named fields (e.g. ENG, SWE),
 * plus an optional COMMON field. This groups every translation of a given key together, rather than scattering them across separate
 * per-language tables, so a missing or drifted translation is visible right where the key is defined instead of requiring a cross-table diff.
 *
 * COMMON holds a language-independent value used as a fallback when the current language has no entry of its own for that key - see getString().
 * This is intended for keys that are pure structure (dispatchers, Select/If branch lists, bare Input/AutoKey calls) with no literal text of their
 * own, so that branching logic and reusable prompt skeletons live in exactly one place rather than being duplicated - and risking drifting -
 * across every language. A language's own entry always takes priority and can override COMMON where a language's grammar genuinely requires it
 * to diverge (e.g. differing clause order, or an inserted conditional another language doesn't need).
 *
 * Typically, every key is expected to have a usable entry (its own language field, or a COMMON fallback) for every language, in particular for
 * static content such as GUI strings. This isn't strictly enforced - Interpreter/Localization log and gracefully substitute a placeholder for any
 * key that resolves to nothing at all - but a language with no entry and no applicable COMMON fallback should be treated as a bug to fix, not a
 * silent gap. Some prompts require different grammatical helper keys for different forms in one language (e.g. one "card" vs two "cards") that
 * another language's phrasing sidesteps entirely - those keys are added only where the language actually needs them, and their absence in another
 * language's set is expected, not a gap. While not relevant for static content, this becomes very relevant with the templating implementation
 * used extensively in the prompts for script generation.
 *
 * Identity keys (roles and teams, e.g. ROLE_SEER, TEAM_WEREWOLF) follow a fixed suffix convention that Interpreter's Identity/RoleName primitives
 * build up from the raw ID + requested grammatical form(s):
 *   <ID>, <ID>_PLURAL, <ID>_DEFINITE, <ID>_GENITIVE, and their combinations (e.g. ROLE_SEER_PLURAL_DEFINITE_GENITIVE). Every identity key is expected
 *   to have all applicable combinations defined here, since the interpreter constructs the key name rather than looking up a pre-built variant list.
 */
	const LOCALIZATION_KEYS = {
		DIRECTION_LEFT: {
			ENG: "left",
			SWE: "vänster",
		},
		DIRECTION_RIGHT: {
			ENG: "right",
			SWE: "höger",
		},
		GRAMMAR_CARD_PLURAL: {
			ENG: "cards",
			SWE: "kort",
		},
		GRAMMAR_CARD_SINGULAR: {
			ENG: "card",
			SWE: "kort",
		},
		GRAMMAR_PLAYER_PLURAL: {
			ENG: "players",
			SWE: "spelare",
		},
		GRAMMAR_PLAYER_SINGULAR: {
			ENG: "player",
			SWE: "spelare",
		},
		LIST_AND: {
			ENG: "and",
			SWE: "och",
		},
		LIST_OR: {
			ENG: "or",
			SWE: "eller",
		},
		NUM_EIGHT: {
			ENG: "eight",
			SWE: "åtta",
		},
		NUM_FIVE: {
			ENG: "five",
			SWE: "fem",
		},
		NUM_FOUR: {
			ENG: "four",
			SWE: "fyra",
		},
		NUM_NINE: {
			ENG: "nine",
			SWE: "nio",
		},
		NUM_ONE: {
			ENG: "one",
			SWE: "ett",
		},
		NUM_SEVEN: {
			ENG: "seven",
			SWE: "sju",
		},
		NUM_SIX: {
			ENG: "six",
			SWE: "sex",
		},
		NUM_THREE: {
			ENG: "three",
			SWE: "tre",
		},
		NUM_TWO: {
			ENG: "two",
			SWE: "två",
		},
		NUM_WORD: {
			COMMON: "{Select:count,1,NUM_ONE,2,NUM_TWO,3,NUM_THREE,4,NUM_FOUR,5,NUM_FIVE,6,NUM_SIX,7,NUM_SEVEN,8,NUM_EIGHT,9,NUM_NINE}",
		},
		PHASE_DAY: {
			ENG: "day role",
			SWE: "dag",
		},
		PHASE_DAY_ROLE: {
			ENG: "day role",
			SWE: "dagroll",
		},
		PHASE_DUSK: {
			ENG: "dusk role",
			SWE: "skymmning",
		},
		PHASE_DUSK_ROLE: {
			ENG: "dusk role",
			SWE: "skymmningsroll",
		},
		PHASE_NIGHT: {
			ENG: "night role",
			SWE: "natt",
		},
		PHASE_NIGHT_ROLE: {
			ENG: "night role",
			SWE: "nattroll",
		},
		PROMPT_ALIEN_TEAM: {
			ENG: "{TEAM_ALIEN_PLURAL}, wake up and identify each other. {Pause:short} {PROMPT_ALIEN_TEAM_ACTION} {If:hasCow,PROMPT_ALIEN_TEAM_COW} {TEAM_ALIEN_PLURAL}, go to sleep.",
			SWE: "{TEAM_ALIEN_PLURAL}, vakna och identifiera varandra. {Pause:short} {PROMPT_ALIEN_TEAM_ACTION} {If:hasCow,PROMPT_ALIEN_TEAM_COW} {TEAM_ALIEN_PLURAL}, somna.",
		},
		PROMPT_ALIEN_TEAM_ACTION: {
			COMMON: "{Select:type,do_nothing,PROMPT_ALIEN_TEAM_ACTION_NOTHING,make_alien,PROMPT_ALIEN_TEAM_ACTION_MAKE_ALIEN,make_alien_minion,PROMPT_ALIEN_TEAM_ACTION_MAKE_MINION,show_team_cards,PROMPT_ALIEN_TEAM_ACTION_SHOW_CARDS,trade_team_cards,PROMPT_ALIEN_TEAM_ACTION_TRADE_CARDS,view_card_collective,PROMPT_ALIEN_TEAM_ACTION_VIEW_CARDS_COLLECTIVE,view_card_individual,PROMPT_ALIEN_TEAM_ACTION_VIEW_CARDS_INDIVIDUAL}",
		},
		PROMPT_ALIEN_TEAM_ACTION_MAKE_ALIEN: {
			ENG: "All other players, hold out a hand in front of you. {TEAM_ALIEN_PLURAL}, touch another player's hand that you want to turn into an {TEAM_ALIEN}. {Pause:short} That player is now an {TEAM_ALIEN} regardless of what happens to their card. All players, put your hands down.",
			SWE: "Alla andra spelare, håll ut en hand framför er. {TEAM_ALIEN_PLURAL}, rör vid en annan spelares hand som ni vill göra till en {TEAM_ALIEN}. {Pause:short} Spelaren är nu en {TEAM_ALIEN} oavsett vad som händer med deras kort. Alla spelare, ner med händerna.",
		},
		PROMPT_ALIEN_TEAM_ACTION_MAKE_MINION: {
			ENG: "All other players, hold out a hand in front of you. {TEAM_ALIEN_PLURAL}, touch another player's hand that you want to turn into a helper. {Pause:short} That player now wins if {TEAM_ALIEN_PLURAL_DEFINITE} win, regardless of whether they themselves are voted out and what happens to their card. All players, put your hands down.",
			SWE: "Alla andra spelare, håll ut en hand framför er. {TEAM_ALIEN_PLURAL}, rör vid en annan spelares hand som ni vill göra till en medhjälpare. {Pause:short} Spelaren vinner nu om {TEAM_ALIEN_PLURAL_DEFINITE} vinner oavsett om de själva blir utröstade och vad som händer med deras kort. Alla spelare, ner med händerna.",
		},
		PROMPT_ALIEN_TEAM_ACTION_NOTHING: {
			ENG: "Do nothing, just stare at each other until it gets awkward. {Pause:short}",
			SWE: "Gör ingenting, stirra bara på varandra tills det blir pinsamt. {Pause:short}",
		},
		PROMPT_ALIEN_TEAM_ACTION_SHOW_CARDS: {
			ENG: "Show your cards to each other. {Pause:short}",
			SWE: "Visa era kort för varandra. {Pause:short}",
		},
		PROMPT_ALIEN_TEAM_ACTION_TRADE_CARDS: {
			ENG: "Give your cards to the nearest {TEAM_ALIEN} to your {Select:restriction,left,DIRECTION_LEFT,right,DIRECTION_RIGHT}. {Pause:short}",
			SWE: "Ge era kort till närmaste {TEAM_ALIEN} till {Select:restriction,left,DIRECTION_LEFT,right,DIRECTION_RIGHT} om er. {Pause:short}",
		},
		PROMPT_ALIEN_TEAM_ACTION_VIEW_CARDS_COLLECTIVE: {
			ENG: "Together as a team, you may look at {PROMPT_VIEW_CARD_ENTRY}. {Pause:medium}",
			SWE: "Gemensamt inom laget får ni titta på {PROMPT_VIEW_CARD_ENTRY}. {Pause:medium}",
		},
		PROMPT_ALIEN_TEAM_ACTION_VIEW_CARDS_INDIVIDUAL: {
			ENG: "Individually, you may look at {PROMPT_VIEW_CARD_ENTRY}. {Pause:medium}",
			SWE: "Individuellt får ni titta på {PROMPT_VIEW_CARD_ENTRY}. {Pause:medium}",
		},
		PROMPT_ALIEN_TEAM_COW: {
			ENG: "{ROLE_COW}{If:hasDoppelganger,PROMPT_ALIEN_TEAM_COW_DOPPELGANGER}, hold out a hand in front of you. {TEAM_ALIEN_PLURAL}, if at least one of you is sitting next to {ROLE_COW_DEFINITE}, touch {ROLE_COW_DEFINITE_GENITIVE} hand. {Pause:short} {ROLE_COW}, put your hand down.",
			SWE: "{ROLE_COW}{If:hasDoppelganger,PROMPT_ALIEN_TEAM_COW_DOPPELGANGER}, håll ut en hand framför dig. {TEAM_ALIEN_PLURAL}, om minst en av er är granne med {ROLE_COW_DEFINITE}, rör vid {ROLE_COW_DEFINITE_GENITIVE} hand. {Pause:short} {ROLE_COW}, ner med handen.",
		},
		PROMPT_ALIEN_TEAM_COW_DOPPELGANGER: {
			ENG: ", and {ROLE_DOPPELGANGER_DEFINITE} if you saw {ROLE_COW_DEFINITE}",
			SWE: ", och {ROLE_DOPPELGANGER_DEFINITE} om du såg {ROLE_COW_DEFINITE}",
		},
		PROMPT_ALPHAWOLF: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_ALPHAWOLF_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_ALPHAWOLF_ACTION: {
			ENG: "Swap the extra card in the center for any non-{TEAM_WEREWOLF} player's card. {Pause:short}",
			SWE: "Byt det extra kortet i mitten mot någon annan spelares kort som inte redan är {TEAM_WEREWOLF}. {Pause:short}",
		},
		PROMPT_APPRENTICEASSASSIN: {
			ENG: "{ROLE_APPRENTICEASSASSIN}, wake up. {PROMPT_APPRENTICEASSASSIN_ACTION} {ROLE_APPRENTICEASSASSIN}, go to sleep. {If:hasDoppelganger,PROMPT_APPRENTICEASSASSIN_DOPPELGANGER}",
			SWE: "{ROLE_APPRENTICEASSASSIN}, vakna. {PROMPT_APPRENTICEASSASSIN_ACTION} {ROLE_APPRENTICEASSASSIN}, somna. {If:hasDoppelganger,PROMPT_APPRENTICEASSASSIN_DOPPELGANGER}",
		},
		PROMPT_APPRENTICEASSASSIN_ACTION: {
			ENG: "Identify {ROLE_ASSASSIN_DEFINITE}. If there is no {ROLE_ASSASSIN}: {PROMPT_ASSASSIN_ACTION}",
			SWE: "Identifiera {ROLE_ASSASSIN_DEFINITE}. Om det inte finns någon {ROLE_ASSASSIN}: {PROMPT_ASSASSIN_ACTION}",
		},
		PROMPT_APPRENTICEASSASSIN_DOPPELGANGER: {
			ENG: "{ROLE_DOPPELGANGER}, if you saw {ROLE_APPRENTICEASSASSIN_DEFINITE}, wake up. {PROMPT_APPRENTICEASSASSIN_ACTION} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
			SWE: "{ROLE_DOPPELGANGER}, om du såg {ROLE_APPRENTICEASSASSIN_DEFINITE}, vakna. {PROMPT_APPRENTICEASSASSIN_ACTION} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
		},
		PROMPT_APPRENTICESEER: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_VIEW_CARD} {Pause:short} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_APPRENTICETANNER: {
			ENG: "{PROMPT_WAKE_CALL} {ROLE_TANNER}, hold out a thumb so {ROLE_APPRENTICETANNER_DEFINITE} can see who you are. {Pause:short} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_APPRENTICETANNER_DOPPELGANGER} {ROLE_TANNER}, put your thumb down.",
			SWE: "{PROMPT_WAKE_CALL} {ROLE_TANNER}, håll ut en tumme så att {ROLE_APPRENTICETANNER_DEFINITE} kan se vem du är. {Pause:short} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_APPRENTICETANNER_DOPPELGANGER} {ROLE_TANNER}, ner med tummen.",
		},
		PROMPT_APPRENTICETANNER_DOPPELGANGER: {
			ENG: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} {ROLE_TANNER}, keep holding out your thumb so {ROLE_DOPPELGANGER_DEFINITE} can see who you are. {Pause:short} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
			SWE: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} {ROLE_TANNER}, fortsätt hålla ut tummen så att {ROLE_DOPPELGANGER_DEFINITE} kan se vem du är. {Pause:short} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
		},
		PROMPT_ASSASSIN: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_ASSASSIN_ACTION} {If:hasApprenticeAssassin,PROMPT_APPRENTICEASSASSIN} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_ASSASSIN_ACTION: {
			ENG: "Swap another player's marker for the {TOKEN_MARK_ASSASSIN}. {Pause:medium}",
			SWE: "Byt ut en annan spelares märke mot {TOKEN_MARK_ASSASSIN}. {Pause:medium}",
		},
		PROMPT_AURASEER: {
			ENG: "{PROMPT_WAKE_CALL} {IdentityList:listDetectableRoles,and}, if you looked at or moved a card, hold out a thumb so {ROLE_AURASEER_DEFINITE} can see it. {Pause:short} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_AURASEER_DOPPELGANGER} All players, put your thumbs down.",
			SWE: "{PROMPT_WAKE_CALL} {IdentityList:listDetectableRoles,and}, om ni har tittat på eller flyttat kort, håll ut en tumme så att {ROLE_AURASEER_DEFINITE} kan se den. {Pause:short} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_AURASEER_DOPPELGANGER} Alla spelare, ner med tummarna.",
		},
		PROMPT_AURASEER_DOPPELGANGER: {
			ENG: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} Other players, keep holding out your thumb. {Pause:short} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
			SWE: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} Övriga spelare, fortsätt hålla ut tummen. {Pause:short} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
		},
		PROMPT_AUTO_RIPPLE: {
			COMMON: "{If:noRipple,PROMPT_AUTO_RIPPLE_IF_FORCED,PROMPT_RIPPLE_CONTENT}",
		},
		PROMPT_AUTO_RIPPLE_IF_FORCED: {
			COMMON: "{If:oracleForcedRipple,PROMPT_RIPPLE_CONTENT}",
		},
		PROMPT_BEHOLDER: {
			ENG: "{PROMPT_WAKE_CALL} {IdentityList:listDetectableRoles,and}, hold out a thumb so {ROLE_BEHOLDER_DEFINITE} can see who you are. {ROLE_BEHOLDER}, you may look at their cards. {Pause:medium} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_BEHOLDER_DOPPELGANGER} All players, put your thumbs down.",
			SWE: "{PROMPT_WAKE_CALL} {IdentityList:listDetectableRoles,and}, håll ut en tumme så att {ROLE_BEHOLDER_DEFINITE} kan se vem ni är. {ROLE_BEHOLDER}, du får titta på deras kort. {Pause:medium} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_BEHOLDER_DOPPELGANGER} Alla spelare, ner med tummarna.",
		},
		PROMPT_BEHOLDER_DOPPELGANGER: {
			ENG: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} Other players, keep holding out your thumb. {ROLE_DOPPELGANGER}, you may look at their cards. {Pause:medium} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
			SWE: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} Övriga spelare, fortsätt hålla ut tummen. {ROLE_DOPPELGANGER}, du får titta på deras kort. {Pause:medium} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
		},
		PROMPT_BLOB: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {Select:blobTotal,0,PROMPT_BLOB_OBJECTIVE_ALONE,1,PROMPT_BLOB_OBJECTIVE_SINGLE,*,PROMPT_BLOB_OBJECTIVE_MULTI} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_BLOB_OBJECTIVE_ALONE: {
			ENG: "You need only to prevent yourself from being voted out.",
			SWE: "Du behöver enbart förhindra att du själv blir utröstad.",
		},
		PROMPT_BLOB_OBJECTIVE_MULTI: {
			ENG: "You must prevent the nearest {Select:blobLeft,2,NUM_TWO,3,NUM_THREE,4,NUM_FOUR,*,''} {Select:blobLeft,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} to your left and nearest {Select:blobRight,2,NUM_TWO,3,NUM_THREE,4,NUM_FOUR,*,''} {Select:blobRight,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} to your right from being voted out.",
			SWE: "Du måste förhindra att närmaste {Select:blobLeft,2,NUM_TWO,3,NUM_THREE,4,NUM_FOUR,*,''} {Select:blobLeft,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} till vänster och närmaste {Select:blobRight,2,NUM_TWO,3,NUM_THREE,4,NUM_FOUR,*,''} {Select:blobRight,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} till höger blir utröstade.",
		},
		PROMPT_BLOB_OBJECTIVE_SINGLE: {
			ENG: "You must prevent the player nearest to your {Select:blobLeft,0,DIRECTION_RIGHT,1,DIRECTION_LEFT} from being voted out.",
			SWE: "Du måste förhindra att spelaren närmast till {Select:blobLeft,0,DIRECTION_RIGHT,1,DIRECTION_LEFT} blir utröstad.",
		},
		PROMPT_BODYSNATCHER: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_BODYSNATCHER_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_BODYSNATCHER_ACTION: {
			ENG: "{PROMPT_VIEW_CARD} Then swap your own card for the card you looked at. {Pause:short} Your new card also becomes an {TEAM_ALIEN}.",
			SWE: "{PROMPT_VIEW_CARD} Byt sedan ditt eget kort mot kortet du tittade på. {Pause:short} Ditt nya kort är nu också en {TEAM_ALIEN}.",
		},
		PROMPT_BRIEF_ALIEN_MAKE_ALIEN: {
			ENG: "touch a hand, that player becomes an Alien.",
			SWE: "rör en hand, spelaren blir Utomjording.",
		},
		PROMPT_BRIEF_ALIEN_MAKE_MINION: {
			ENG: "touch a hand, that player wins with you.",
			SWE: "rör en hand, spelaren vinner med er.",
		},
		PROMPT_BRIEF_ALIEN_NOTHING: {
			ENG: "do nothing.",
			SWE: "gör ingenting.",
		},
		PROMPT_BRIEF_ALIEN_SHOW: {
			ENG: "show your cards to each other.",
			SWE: "visa era kort för varandra.",
		},
		PROMPT_BRIEF_ALIEN_TEAM: {
			ENG: "{TEAM_ALIEN_PLURAL}: identify each other. {PROMPT_BRIEF_ALIEN_TEAM_ACTION}{If:hasCow,PROMPT_BRIEF_ALIEN_TEAM_COW}",
			SWE: "{TEAM_ALIEN_PLURAL}: identifiera varandra. {PROMPT_BRIEF_ALIEN_TEAM_ACTION}{If:hasCow,PROMPT_BRIEF_ALIEN_TEAM_COW}",
		},
		PROMPT_BRIEF_ALIEN_TEAM_ACTION: {
			ENG: "{Select:type,do_nothing,PROMPT_BRIEF_ALIEN_NOTHING,make_alien,PROMPT_BRIEF_ALIEN_MAKE_ALIEN,make_alien_minion,PROMPT_BRIEF_ALIEN_MAKE_MINION,show_team_cards,PROMPT_BRIEF_ALIEN_SHOW,trade_team_cards,PROMPT_BRIEF_ALIEN_TRADE,view_card_collective,PROMPT_BRIEF_ALIEN_VIEW_COLLECTIVE,view_card_individual,PROMPT_BRIEF_ALIEN_VIEW_INDIVIDUAL}",
			SWE: "{Select:type,do_nothing,PROMPT_BRIEF_ALIEN_NOTHING,make_alien,PROMPT_BRIEF_ALIEN_MAKE_ALIEN,make_alien_minion,PROMPT_BRIEF_ALIEN_MAKE_MINION,show_team_cards,PROMPT_BRIEF_ALIEN_SHOW,trade_team_cards,PROMPT_BRIEF_ALIEN_TRADE,view_card_collective,PROMPT_BRIEF_ALIEN_VIEW_COLLECTIVE,view_card_individual,PROMPT_BRIEF_ALIEN_VIEW_INDIVIDUAL}",
		},
		PROMPT_BRIEF_ALIEN_TEAM_COW: {
			ENG: " Cow: hold out your hand, neighbor touches it.",
			SWE: " Ko: håll ut handen, granne rör vid den.",
		},
		PROMPT_BRIEF_ALIEN_TRADE: {
			ENG: "swap cards with neighbor to the {Select:restriction,left,DIRECTION_LEFT,right,DIRECTION_RIGHT}.",
			SWE: "byt kort med granne till {Select:restriction,left,DIRECTION_LEFT,right,DIRECTION_RIGHT}.",
		},
		PROMPT_BRIEF_ALIEN_VIEW_COLLECTIVE: {
			ENG: "look together at {PROMPT_VIEW_CARD_ENTRY}.",
			SWE: "titta gemensamt på {PROMPT_VIEW_CARD_ENTRY}.",
		},
		PROMPT_BRIEF_ALIEN_VIEW_INDIVIDUAL: {
			ENG: "look individually at {PROMPT_VIEW_CARD_ENTRY}.",
			SWE: "titta individuellt på {PROMPT_VIEW_CARD_ENTRY}.",
		},
		PROMPT_BRIEF_ALPHAWOLF: {
			ENG: "{PROMPT_BRIEF_HEADER} swap the extra werewolf card.",
			SWE: "{PROMPT_BRIEF_HEADER} byt det extra varulvskortet.",
		},
		PROMPT_BRIEF_APPRENTICEASSASSIN: {
			ENG: "{ROLE_APPRENTICEASSASSIN}: identify the Assassin (otherwise act as one).{If:hasDoppelganger,PROMPT_BRIEF_APPRENTICEASSASSIN_DOPPELGANGER}",
			SWE: "{ROLE_APPRENTICEASSASSIN}: identifiera Lönnmördaren (annars agera som denne).{If:hasDoppelganger,PROMPT_BRIEF_APPRENTICEASSASSIN_DOPPELGANGER}",
		},
		PROMPT_BRIEF_APPRENTICEASSASSIN_DOPPELGANGER: {
			ENG: " {ROLE_DOPPELGANGER} (if seen): same.",
			SWE: " {ROLE_DOPPELGANGER} (om sedd): samma.",
		},
		PROMPT_BRIEF_APPRENTICESEER: {
			ENG: "{PROMPT_BRIEF_HEADER} look at one center card.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på ett mittenkort.",
		},
		PROMPT_BRIEF_APPRENTICETANNER: {
			ENG: "{PROMPT_BRIEF_HEADER} look at {ROLE_TANNER}.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på {ROLE_TANNER}.",
		},
		PROMPT_BRIEF_ASSASSIN: {
			ENG: "{PROMPT_BRIEF_HEADER} swap out a player's marker. {If:hasApprenticeAssassin,PROMPT_BRIEF_APPRENTICEASSASSIN}",
			SWE: "{PROMPT_BRIEF_HEADER} byt ut en spelares märke. {If:hasApprenticeAssassin,PROMPT_BRIEF_APPRENTICEASSASSIN}",
		},
		PROMPT_BRIEF_AURASEER: {
			ENG: "{PROMPT_BRIEF_HEADER} see who acted: {IdentityList:listDetectableRoles}.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på vilka som agerat: {IdentityList:listDetectableRoles}.",
		},
		PROMPT_BRIEF_BEHOLDER: {
			ENG: "{PROMPT_BRIEF_HEADER} look at cards for {IdentityList:listDetectableRoles}.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på kort för {IdentityList:listDetectableRoles}.",
		},
		PROMPT_BRIEF_BLOB: {
			ENG: "{PROMPT_BRIEF_HEADER} protect {Select:blobTotal,0,PROMPT_BRIEF_BLOB_ALONE,1,PROMPT_BRIEF_BLOB_SINGLE,*,PROMPT_BRIEF_BLOB_MULTI}.",
			SWE: "{PROMPT_BRIEF_HEADER} skydda {Select:blobTotal,0,PROMPT_BRIEF_BLOB_ALONE,1,PROMPT_BRIEF_BLOB_SINGLE,*,PROMPT_BRIEF_BLOB_MULTI}.",
		},
		PROMPT_BRIEF_BLOB_ALONE: {
			ENG: "only yourself",
			SWE: "endast dig själv",
		},
		PROMPT_BRIEF_BLOB_MULTI: {
			ENG: "{Value:blobLeft} {Select:blobLeft,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} to the left and {Value:blobRight} {Select:blobRight,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} to the right",
			SWE: "{Value:blobLeft} {Select:blobLeft,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} till vänster och {Value:blobRight} {Select:blobRight,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} till höger",
		},
		PROMPT_BRIEF_BLOB_SINGLE: {
			ENG: "the player to your {Select:blobLeft,0,DIRECTION_RIGHT,1,DIRECTION_LEFT}",
			SWE: "spelaren till {Select:blobLeft,0,DIRECTION_RIGHT,1,DIRECTION_LEFT}",
		},
		PROMPT_BRIEF_BODYSNATCHER: {
			ENG: "{PROMPT_BRIEF_HEADER}{If:fakeAction,PROMPT_BRIEF_FAKE_NOTE} swap cards with {PROMPT_VIEW_CARD_ENTRY}, become an Alien.",
			SWE: "{PROMPT_BRIEF_HEADER}{If:fakeAction,PROMPT_BRIEF_FAKE_NOTE} byt kort med {PROMPT_VIEW_CARD_ENTRY}, bli Utomjording.",
		},
		PROMPT_BRIEF_CHECK_MARKS: {
			ENG: "{PROMPT_BRIEF_HEADER} check your markers.",
			SWE: "{PROMPT_BRIEF_HEADER} kolla era märken.",
		},
		PROMPT_BRIEF_COPYCAT: {
			ENG: "{PROMPT_BRIEF_HEADER} look at a center card, become that role.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på ett mittenkort, bli den rollen.",
		},
		PROMPT_BRIEF_COUNT: {
			ENG: "{PROMPT_BRIEF_HEADER} place a {TOKEN_MARK_COUNT}.",
			SWE: "{PROMPT_BRIEF_HEADER} placera {TOKEN_MARK_COUNT}.",
		},
		PROMPT_BRIEF_CUPID: {
			ENG: "{PROMPT_BRIEF_HEADER} place a {TOKEN_MARK_CUPID} in front of two players.",
			SWE: "{PROMPT_BRIEF_HEADER} placera {TOKEN_MARK_CUPID} framför två spelare.",
		},
		PROMPT_BRIEF_CURATOR: {
			ENG: "{PROMPT_BRIEF_HEADER} place an artifact.",
			SWE: "{PROMPT_BRIEF_HEADER} placera en artefakt.",
		},
		PROMPT_BRIEF_DISEASED: {
			ENG: "{PROMPT_BRIEF_HEADER} place the {TOKEN_MARK_DISEASED} on a neighbor.",
			SWE: "{PROMPT_BRIEF_HEADER} placera {TOKEN_MARK_DISEASED}.",
		},
		PROMPT_BRIEF_DOPPELGANGER: {
			ENG: "{PROMPT_BRIEF_HEADER} look at a player's card, become that role.{If:hasImmediateActionRoles,PROMPT_BRIEF_DOPPELGANGER_IMMEDIATE}",
			SWE: "{PROMPT_BRIEF_HEADER} titta på ett spelarkort, bli den rollen.{If:hasImmediateActionRoles,PROMPT_BRIEF_DOPPELGANGER_IMMEDIATE}",
		},
		PROMPT_BRIEF_DOPPELGANGER_IMMEDIATE: {
			ENG: " If: {IdentityList:listImmediateActionRoles,or} — act now.",
			SWE: " Om: {IdentityList:listImmediateActionRoles,or} — agera nu.",
		},
		PROMPT_BRIEF_DRUNK: {
			ENG: "{PROMPT_BRIEF_HEADER} swap your card for a center card.",
			SWE: "{PROMPT_BRIEF_HEADER} byt ditt kort mot ett mittenkort.",
		},
		PROMPT_BRIEF_EMPATH: {
			ENG: "{PROMPT_BRIEF_HEADER} {Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} {ValueList:players}: {LocalizedValue:question}",
			SWE: "{PROMPT_BRIEF_HEADER} {Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} {ValueList:players}: {LocalizedValue:question}",
		},
		PROMPT_BRIEF_EXPOSER: {
			ENG: "{PROMPT_BRIEF_HEADER} flip {Value:count} center {Select:count,1,GRAMMAR_CARD_SINGULAR,*,GRAMMAR_CARD_PLURAL}.",
			SWE: "{PROMPT_BRIEF_HEADER} vänd {Value:count} mittenkort.",
		},
		PROMPT_BRIEF_FAKE_NOTE: {
			ENG: " (fake)",
			SWE: " (fejk)",
		},
		PROMPT_BRIEF_FEUDINGALIENS: {
			ENG: "{ROLE_FEUDINGALIENS_PLURAL}: identify each other.",
			SWE: "{ROLE_FEUDINGALIENS_PLURAL}: identifiera varandra.",
		},
		PROMPT_BRIEF_GREMLIN: {
			ENG: "{PROMPT_BRIEF_HEADER} swap two markers or cards.",
			SWE: "{PROMPT_BRIEF_HEADER} byt plats på två märken eller kort.",
		},
		PROMPT_BRIEF_HEADER: {
			ENG: "{If:copiedRole,PROMPT_BRIEF_HEADER_ECHO,PROMPT_BRIEF_HEADER_DIRECT}",
			SWE: "{If:copiedRole,PROMPT_BRIEF_HEADER_ECHO,PROMPT_BRIEF_HEADER_DIRECT}",
		},
		PROMPT_BRIEF_HEADER_DIRECT: {
			ENG: "{Identity:instigator}:",
			SWE: "{Identity:instigator}:",
		},
		PROMPT_BRIEF_HEADER_ECHO: {
			ENG: "{Identity:instigator} ({Identity:copiedRole}):",
			SWE: "{Identity:instigator} ({Identity:copiedRole}):",
		},
		PROMPT_BRIEF_INSOMNIAC: {
			ENG: "{PROMPT_BRIEF_HEADER} look at your own card.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på ditt eget kort.",
		},
		PROMPT_BRIEF_INSTIGATOR: {
			ENG: "{PROMPT_BRIEF_HEADER} swap out a player's marker.",
			SWE: "{PROMPT_BRIEF_HEADER} byt ut en spelares märke.",
		},
		PROMPT_BRIEF_LEADER: {
			ENG: "{PROMPT_BRIEF_HEADER} look at {TEAM_ALIEN_PLURAL}. {If:hasFeudingAliens,PROMPT_BRIEF_LEADER_FEUDINGALIENS}",
			SWE: "{PROMPT_BRIEF_HEADER} titta på {TEAM_ALIEN_PLURAL}. {If:hasFeudingAliens,PROMPT_BRIEF_LEADER_FEUDINGALIENS}",
		},
		PROMPT_BRIEF_LEADER_FEUDINGALIENS: {
			ENG: "Wins if both Groob and Zerb survive.",
			SWE: "Vinner om både Groob och Zerb överlever.",
		},
		PROMPT_BRIEF_LOVERS: {
			ENG: "{PROMPT_BRIEF_HEADER} identify each other.",
			SWE: "{PROMPT_BRIEF_HEADER} identifiera varandra.",
		},
		PROMPT_BRIEF_MARKSMAN: {
			ENG: "{PROMPT_BRIEF_HEADER} look at a player's card + marker.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på en spelares kort + märke.",
		},
		PROMPT_BRIEF_MASON: {
			ENG: "{PROMPT_BRIEF_HEADER} identify each other.",
			SWE: "{PROMPT_BRIEF_HEADER} identifiera varandra.",
		},
		PROMPT_BRIEF_MINION: {
			ENG: "{PROMPT_BRIEF_HEADER} look at {TEAM_WEREWOLF_PLURAL}.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på {TEAM_WEREWOLF_PLURAL}.",
		},
		PROMPT_BRIEF_MORTICIAN: {
			ENG: "{PROMPT_BRIEF_HEADER} look at {PROMPT_VIEW_CARD_ENTRY}.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på {PROMPT_VIEW_CARD_ENTRY}.",
		},
		PROMPT_BRIEF_MYSTICWOLF: {
			ENG: "{PROMPT_BRIEF_HEADER} look at a player's card.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på en spelares kort.",
		},
		PROMPT_BRIEF_NOSTRADAMUS: {
			ENG: "{PROMPT_BRIEF_HEADER} look at 1-3 cards.{If:hasDangerRoles,PROMPT_BRIEF_NOSTRADAMUS_WARNING} Announce team: {LocalizedValue:fallbackTeam}.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på 1-3 kort.{If:hasDangerRoles,PROMPT_BRIEF_NOSTRADAMUS_WARNING} Annonsera lag: {LocalizedValue:fallbackTeam}.",
		},
		PROMPT_BRIEF_NOSTRADAMUS_WARNING: {
			ENG: " Warning on: {IdentityList:listDangerRoles,or}.",
			SWE: " Varning vid: {IdentityList:listDangerRoles,or}.",
		},
		PROMPT_BRIEF_ORACLE: {
			ENG: "{PROMPT_BRIEF_HEADER} {Select:type,view_card,PROMPT_BRIEF_ORACLE_VIEW,oracle_change_team,PROMPT_BRIEF_ORACLE_CHANGE_TEAM,oracle_block_action,PROMPT_BRIEF_ORACLE_BLOCK_ACTION,role_action,PROMPT_BRIEF_ORACLE_ROLE_ACTION,oracle_announce_even_odd,PROMPT_BRIEF_ORACLE_EVEN_ODD,oracle_hunt,PROMPT_BRIEF_ORACLE_HUNT}",
			SWE: "{PROMPT_BRIEF_HEADER} {Select:type,view_card,PROMPT_BRIEF_ORACLE_VIEW,oracle_change_team,PROMPT_BRIEF_ORACLE_CHANGE_TEAM,oracle_block_action,PROMPT_BRIEF_ORACLE_BLOCK_ACTION,role_action,PROMPT_BRIEF_ORACLE_ROLE_ACTION,oracle_announce_even_odd,PROMPT_BRIEF_ORACLE_EVEN_ODD,oracle_hunt,PROMPT_BRIEF_ORACLE_HUNT,oracle_force_ripple,PROMPT_BRIEF_ORACLE_FORCE_RIPPLE}",
		},
		PROMPT_BRIEF_ORACLE_BLOCK_ACTION: {
			ENG: "block a player's action.",
			SWE: "blockera en spelares handling.",
		},
		PROMPT_BRIEF_ORACLE_CHANGE_TEAM: {
			ENG: "offer a team change ({Identity:joinTeam}, {Select:joinFull,true,PROMPT_BRIEF_ORACLE_CHANGE_TEAM_FULL,false,PROMPT_BRIEF_ORACLE_CHANGE_TEAM_PARTIAL}).",
			SWE: "erbjud lagbyte ({Identity:joinTeam}, {Select:joinFull,true,PROMPT_BRIEF_ORACLE_CHANGE_TEAM_FULL,false,PROMPT_BRIEF_ORACLE_CHANGE_TEAM_PARTIAL}).",
		},
		PROMPT_BRIEF_ORACLE_CHANGE_TEAM_FULL: {
			ENG: "fully",
			SWE: "helt",
		},
		PROMPT_BRIEF_ORACLE_CHANGE_TEAM_PARTIAL: {
			ENG: "partially",
			SWE: "delvis",
		},
		PROMPT_BRIEF_ORACLE_EVEN_ODD: {
			ENG: "<Narrator: announce even/odd>.",
			SWE: "<Berättare: annonsera jämn/udda>.",
		},
		PROMPT_BRIEF_ORACLE_FORCE_RIPPLE: {
			ENG: "<Ask of the player wants to force a ripple (yes/no)>.",
			SWE: "<Fråga om spelaren vill tvinga fram en krusning (ja/nej)>.",
		},
		PROMPT_BRIEF_ORACLE_HUNT: {
			ENG: "{Select:huntActive,true,PROMPT_BRIEF_ORACLE_HUNT_STARTED,false,PROMPT_BRIEF_ORACLE_HUNT_AVOIDED}",
			SWE: "{Select:huntActive,true,PROMPT_BRIEF_ORACLE_HUNT_STARTED,false,PROMPT_BRIEF_ORACLE_HUNT_AVOIDED}",
		},
		PROMPT_BRIEF_ORACLE_HUNT_AVOIDED: {
			ENG: "hunt avoided — may wake once to observe all-seeing.{If:showExclusionWarning,PROMPT_BRIEF_ORACLE_HUNT_OMNISCIENCE}",
			SWE: "jakten undviks — får vakna en gång för allseende.{If:showExclusionWarning,PROMPT_BRIEF_ORACLE_HUNT_OMNISCIENCE}",
		},
		PROMPT_BRIEF_ORACLE_HUNT_OMNISCIENCE: {
			ENG: " Not for: {IdentityList:listExcludedRoles,or}.",
			SWE: " Ej vid: {IdentityList:listExcludedRoles,or}.",
		},
		PROMPT_BRIEF_ORACLE_HUNT_STARTED: {
			ENG: "hunt begins — players' goal changes to finding the Oracle.",
			SWE: "jakten startar — spelarnas mål byts till att hitta Oraklet.",
		},
		PROMPT_BRIEF_ORACLE_ROLE_ACTION: {
			ENG: "act as {RoleName:role}.",
			SWE: "agera som {RoleName:role}.",
		},
		PROMPT_BRIEF_ORACLE_VIEW: {
			ENG: "look at {PROMPT_VIEW_CARD_ENTRY}.",
			SWE: "titta på {PROMPT_VIEW_CARD_ENTRY}.",
		},
		PROMPT_BRIEF_PARANORMALINVESTIGATOR: {
			ENG: "{PROMPT_BRIEF_HEADER} look at 1-2 cards. Warning on: {IdentityList:listDangerRoles,or}.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på 1-2 kort. Varning vid: {IdentityList:listDangerRoles,or}.",
		},
		PROMPT_BRIEF_PICKPOCKET: {
			ENG: "{PROMPT_BRIEF_HEADER} swap markers with a player, look at it.",
			SWE: "{PROMPT_BRIEF_HEADER} byt märke med en spelare, titta på det.",
		},
		PROMPT_BRIEF_PRIEST: {
			ENG: "{PROMPT_BRIEF_HEADER} replace your mark with a {TOKEN_MARK_CLARITY}, optionally another player's.",
			SWE: "{PROMPT_BRIEF_HEADER} ersätt ditt märke med ett {TOKEN_MARK_CLARITY}, och valfritt även en annan spelares.",
		},
		PROMPT_BRIEF_PSYCHIC: {
			ENG: "{PROMPT_BRIEF_HEADER} look at {PROMPT_VIEW_CARD_ENTRY}.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på {PROMPT_VIEW_CARD_ENTRY}.",
		},
		PROMPT_BRIEF_RASCAL: {
			ENG: "{PROMPT_BRIEF_HEADER} act as {RoleName:role}.",
			SWE: "{PROMPT_BRIEF_HEADER} agera som {RoleName:role}.",
		},
		PROMPT_BRIEF_RENFIELD: {
			ENG: "{PROMPT_BRIEF_HEADER} identify {TEAM_VAMPIRE_DEFINITE}, swap your marker.",
			SWE: "{PROMPT_BRIEF_HEADER} identifiera {TEAM_VAMPIRE_DEFINITE}, byt ditt märke.",
		},
		PROMPT_BRIEF_REVEALER: {
			ENG: "{PROMPT_BRIEF_HEADER} flip a card, flip back if: {IdentityList:listHiddenRoles,or}.",
			SWE: "{PROMPT_BRIEF_HEADER} vänd ett kort, vänd tillbaka om: {IdentityList:listHiddenRoles,or}.",
		},
		PROMPT_BRIEF_RIPPLE: {
			ENG: "{If:noRipple,PROMPT_BRIEF_RIPPLE_NONE} Ripple: {PROMPT_BRIEF_RIPPLE_SELECTOR}",
			SWE: "{If:noRipple,PROMPT_BRIEF_RIPPLE_NONE} Krusning: {PROMPT_BRIEF_RIPPLE_SELECTOR}",
		},
		PROMPT_BRIEF_RIPPLE_DOUBLE_VOTE: {
			ENG: "{Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} {ValueList:players} get double votes.",
			SWE: "spelare {ValueList:players} får dubbla röster.",
		},
		PROMPT_BRIEF_RIPPLE_MUTED: {
			ENG: "{Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} {ValueList:players} may not speak.",
			SWE: "spelare {ValueList:players} får inte prata.",
		},
		PROMPT_BRIEF_RIPPLE_NONE: {
			ENG: "(only if forced by the Oracle)",
			SWE: "(endast om Orakel tvingar)",
		},
		PROMPT_BRIEF_RIPPLE_REBUKED: {
			ENG: "{Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} {ValueList:players} turn away.",
			SWE: "spelare {ValueList:players} vänder sig bort.",
		},
		PROMPT_BRIEF_RIPPLE_ROLE_ACTION: {
			ENG: "player {Value:player} acts as {RoleName:role}.",
			SWE: "spelare {Value:player} agerar som {RoleName:role}.",
		},
		PROMPT_BRIEF_RIPPLE_SELECTOR: {
			ENG: "{Select:type,ripple_timer,PROMPT_BRIEF_RIPPLE_TIMER,ripple_role_action,PROMPT_BRIEF_RIPPLE_ROLE_ACTION,ripple_mute,PROMPT_BRIEF_RIPPLE_MUTED,ripple_rebuked,PROMPT_BRIEF_RIPPLE_REBUKED,ripple_view_player,PROMPT_BRIEF_RIPPLE_VIEW_PLAYER,ripple_double_vote,PROMPT_BRIEF_RIPPLE_DOUBLE_VOTE}",
			SWE: "{Select:type,ripple_timer,PROMPT_BRIEF_RIPPLE_TIMER,ripple_role_action,PROMPT_BRIEF_RIPPLE_ROLE_ACTION,ripple_mute,PROMPT_BRIEF_RIPPLE_MUTED,ripple_rebuked,PROMPT_BRIEF_RIPPLE_REBUKED,ripple_view_player,PROMPT_BRIEF_RIPPLE_VIEW_PLAYER,ripple_double_vote,PROMPT_BRIEF_RIPPLE_DOUBLE_VOTE}",
		},
		PROMPT_BRIEF_RIPPLE_TIMER: {
			ENG: "one minute left to discuss.",
			SWE: "en minut kvar att diskutera.",
		},
		PROMPT_BRIEF_RIPPLE_VIEW_PLAYER: {
			ENG: "player {Value:player} look at {Select:count,1,GRAMMAR_CARD_SINGULAR,*,GRAMMAR_CARD_PLURAL} for {ValueList:players}.",
			SWE: "spelare {Value:player} titta på {Select:count,1,GRAMMAR_CARD_SINGULAR,*,GRAMMAR_CARD_PLURAL} för {ValueList:players}.",
		},
		PROMPT_BRIEF_ROBBER: {
			ENG: "{PROMPT_BRIEF_HEADER} swap cards with a player, look at it.",
			SWE: "{PROMPT_BRIEF_HEADER} byt kort med en spelare, titta på det.",
		},
		PROMPT_BRIEF_SEER: {
			ENG: "{PROMPT_BRIEF_HEADER} look at a player's card, or two center cards.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på ett spelarkort, eller två mittenkort.",
		},
		PROMPT_BRIEF_SENTINEL: {
			ENG: "{PROMPT_BRIEF_HEADER} place a {TOKEN_SHIELD}.",
			SWE: "{PROMPT_BRIEF_HEADER} placera en {TOKEN_SHIELD}.",
		},
		PROMPT_BRIEF_SQUIRE: {
			ENG: "{PROMPT_BRIEF_HEADER} look at cards for {TEAM_WEREWOLF_PLURAL}.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på kort för {TEAM_WEREWOLF_PLURAL}.",
		},
		PROMPT_BRIEF_THING: {
			ENG: "{PROMPT_BRIEF_HEADER} touch a neighbor's hand.",
			SWE: "{PROMPT_BRIEF_HEADER} rör en grannes hand.",
		},
		PROMPT_BRIEF_TROUBLEMAKER: {
			ENG: "{PROMPT_BRIEF_HEADER} swap two players' cards.",
			SWE: "{PROMPT_BRIEF_HEADER} byt plats på två spelares kort.",
		},
		PROMPT_BRIEF_VAMPIRE_TEAM: {
			ENG: "{TEAM_VAMPIRE_PLURAL}: identify each other, mark a player.",
			SWE: "{TEAM_VAMPIRE_PLURAL}: identifiera varandra, märk en spelare.",
		},
		PROMPT_BRIEF_VILLAGEIDIOT: {
			ENG: "{PROMPT_BRIEF_HEADER} move all cards one step, or not at all.",
			SWE: "{PROMPT_BRIEF_HEADER} flytta alla kort ett steg, eller inte alls.",
		},
		PROMPT_BRIEF_WEREWOLF_DREAMWOLF: {
			ENG: "{TEAM_WEREWOLF_PLURAL} (except {ROLE_DREAMWOLF}): identify each other. {ROLE_DREAMWOLF}: show your thumb to them.",
			SWE: "{TEAM_WEREWOLF_PLURAL} (ej {ROLE_DREAMWOLF}): identifiera varandra. {ROLE_DREAMWOLF}: visa tumme för dem.",
		},
		PROMPT_BRIEF_WEREWOLF_STANDARD: {
			ENG: "{TEAM_WEREWOLF_PLURAL}: identify each other (alone: look at center cards).",
			SWE: "{TEAM_WEREWOLF_PLURAL}: identifiera varandra (ensam: titta på mittenkort).",
		},
		PROMPT_BRIEF_WEREWOLF_TEAM: {
			ENG: "{If:hasDreamWolf,PROMPT_BRIEF_WEREWOLF_DREAMWOLF,PROMPT_BRIEF_WEREWOLF_STANDARD}",
			SWE: "{If:hasDreamWolf,PROMPT_BRIEF_WEREWOLF_DREAMWOLF,PROMPT_BRIEF_WEREWOLF_STANDARD}",
		},
		PROMPT_BRIEF_WITCH: {
			ENG: "{PROMPT_BRIEF_HEADER} look at a center card, give it away if you want.",
			SWE: "{PROMPT_BRIEF_HEADER} titta på ett mittenkort, ge bort det om du vill.",
		},
		PROMPT_CHECK_MARKS: {
			COMMON: "{PROMPT_WAKE_CALL} {PROMPT_CHECK_MARKS_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_CHECK_MARKS_ACTION: {
			ENG: "Check your markers without showing them to anyone else. {Pause:short}",
			SWE: "Kontrollera era märken utan att visa dem för någon annan. {Pause:short}",
		},
		PROMPT_COPYCAT: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_COPYCAT_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_COPYCAT_ACTION: {
			ENG: "Look at one of the center cards. {Pause:short} You are now the role you saw. When that role is called, wake up and perform its action.",
			SWE: "Titta på ett av mittenkorten. {Pause:short} Du är nu rollen du såg. När rollen ropas upp, vakna och utför dess handling.",
		},
		PROMPT_COUNT: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_COUNT_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_COUNT_ACTION: {
			ENG: "Swap another player's marker for {ROLE_COUNT_DEFINITE_GENITIVE} marker. {Pause:short}",
			SWE: "Byt ut en annan spelares märke mot {ROLE_COUNT_DEFINITE_GENITIVE} märke. {Pause:short}",
		},
		PROMPT_CUPID: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_CUPID_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_CUPID_ACTION: {
			ENG: "Swap two other players' markers for {ROLE_CUPID_DEFINITE_GENITIVE} marker. {Pause:medium}",
			SWE: "Byt ut två andra spelares märken mot {ROLE_CUPID_DEFINITE_GENITIVE} märke. {Pause:medium}",
		},
		PROMPT_CURATOR: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_CURATOR_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_CURATOR_ACTION: {
			ENG: "Place an artifact face-down in front of another player without looking at it. {Pause:short}",
			SWE: "Placera en artefakt utan att titta på den med ansiktet ner framför en annan spelare. {Pause:short}",
		},
		PROMPT_DISEASED: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_DISEASED_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_DISEASED_ACTION: {
			ENG: "Swap one of your neighbors' markers for {TOKEN_MARK_DISEASED}. {Pause:short}",
			SWE: "Byt ut en av dina grannars märken mot {TOKEN_MARK_DISEASED}. {Pause:short}",
		},
		PROMPT_DOPPELGANGER: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_DOPPELGANGER_ACTION} {If:hasEvilTeams,PROMPT_DOPPELGANGER_SUFFIX} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_DOPPELGANGER_ACTION: {
			ENG: "Look at another player's card. {Pause:short} You are now the role you saw. {If:hasImmediateActionRoles,PROMPT_DOPPELGANGER_IMMEDIATE_ACTION}",
			SWE: "Titta på en annan spelares kort. {Pause:short} Du är nu rollen du såg. {If:hasImmediateActionRoles,PROMPT_DOPPELGANGER_IMMEDIATE_ACTION}",
		},
		PROMPT_DOPPELGANGER_IMMEDIATE_ACTION: {
			ENG: "If the role you saw was {IdentityList:listImmediateActionRoles,or}, perform its action now. {Pause:long}",
			SWE: "Om rollen du såg var {IdentityList:listImmediateActionRoles,or}, utför dess handling nu. {Pause:long}",
		},
		PROMPT_DOPPELGANGER_SUFFIX: {
			ENG: "If you saw a {IdentityList:listEvilTeams,or}, wake up with them when they are called on. {If:hasDreamWolf,PROMPT_DOPPELGANGER_DREAMWOLF_EXCLUSION}",
			SWE: "Om du såg en {IdentityList:listEvilTeams,or}, vakna tillsammans med det laget när de ropas upp. {If:hasDreamWolf,PROMPT_DOPPELGANGER_DREAMWOLF_EXCLUSION}",
		},
		PROMPT_DOPPELGANGER_DREAMWOLF_EXCLUSION: {
			ENG: "If you saw {ROLE_DREAMWOLF_DEFINITE}, do not wake up with {TEAM_WEREWOLF_DEFINITE} but follow the instructions for that role.",
			SWE: "Om du såg {ROLE_DREAMWOLF_DEFINITE}, vakna inte med {TEAM_WEREWOLF_DEFINITE} men följ rollens instruktioner.",
		},
		PROMPT_DO_ROLE_ACTION: {
			COMMON: "{RoleAction:role}",
		},
		PROMPT_DRUNK: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_DRUNK_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_DRUNK_ACTION: {
			ENG: "Swap your card for one of the center cards without looking at it. {Pause:short}",
			SWE: "Byt ditt kort mot ett av mittenkorten utan att se vad det är. {Pause:short}",
		},
		PROMPT_EMPATH: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_EMPATH_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_EMPATH_ACTION: {
			ENG: "Observe what the other players do. {Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} {ValueList:players}, without waking up, {LocalizedValue:question} {Pause:short}",
			SWE: "Iaktta vad de andra spelarna gör. {Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} {ValueList:players}, utan att vakna, {LocalizedValue:question} {Pause:short}",
		},
		PROMPT_EMPATH_QUESTION_10: {
			ENG: "give a thumbs up if you think you will win, or a thumbs down if you think you will lose.",
			SWE: "visa tummen upp om du tror att du kommer vinna, eller tummen ner om du tror att du kommer förlora.",
		},
		PROMPT_EMPATH_QUESTION_11: {
			ENG: "point to the player you think is most likely to have already forgotten their role.",
			SWE: "peka på den spelare som du tror är mest sannolik att redan ha glömt sin roll.",
		},
		PROMPT_EMPATH_QUESTION_1: {
			ENG: "point to a player you think will win.",
			SWE: "peka på en spelare som du tror kommer vinna.",
		},
		PROMPT_EMPATH_QUESTION_2: {
			ENG: "point to a player you think will be eliminated.",
			SWE: "peka på en spelare som du tror blir utröstad.",
		},
		PROMPT_EMPATH_QUESTION_3: {
			ENG: "point to the player you trust the most.",
			SWE: "peka på den spelare som du litar mest på.",
		},
		PROMPT_EMPATH_QUESTION_4: {
			ENG: "point to the player you trust the least.",
			SWE: "peka på den spelare som du litar minst på.",
		},
		PROMPT_EMPATH_QUESTION_5: {
			ENG: "point to a player you think is part of {TEAM_VILLAGE_DEFINITE}.",
			SWE: "peka på en spelare som du tror är en av {TEAM_VILLAGE_DEFINITE}.",
		},
		PROMPT_EMPATH_QUESTION_6: {
			ENG: "point to the player you think will talk the most.",
			SWE: "peka på den spelare som du tror kommer prata mest.",
		},
		PROMPT_EMPATH_QUESTION_7: {
			ENG: "point to the player you think will talk the least.",
			SWE: "peka på den spelare som du tror kommer prata minst.",
		},
		PROMPT_EMPATH_QUESTION_8: {
			ENG: "point to the player you think is best at bluffing.",
			SWE: "peka på den spelare som du tror är bäst på att bluffa.",
		},
		PROMPT_EMPATH_QUESTION_9: {
			ENG: "point to the player you think is worst at bluffing.",
			SWE: "peka på den spelare som du tror är sämst på att bluffa.",
		},
		PROMPT_EXPOSER: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_EXPOSER_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_EXPOSER_ACTION: {
			ENG: "You may turn over {NUM_WORD} of the center cards. {Pause:short}",
			SWE: "Du får vända {NUM_WORD} av mittenkorten. {Pause:short}",
		},
		PROMPT_FEUDINGALIENS: {
			ENG: "{ROLE_FEUDINGALIENS_PLURAL}, {If:hasDoppelganger,PROMPT_FEUDINGALIENS_DOPPELGANGER} wake up and identify each other. {Pause:short} {PROMPT_SLEEP_CALL}",
			SWE: "{ROLE_FEUDINGALIENS_PLURAL}, {If:hasDoppelganger,PROMPT_FEUDINGALIENS_DOPPELGANGER} vakna och identifiera varandra. {Pause:short} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_FEUDINGALIENS_DOPPELGANGER: {
			ENG: "and {ROLE_DOPPELGANGER_DEFINITE} if you saw one of {ROLE_FEUDINGALIENS_PLURAL_DEFINITE_GENITIVE} cards,",
			SWE: "och {ROLE_DOPPELGANGER_DEFINITE} om du såg ett av {ROLE_FEUDINGALIENS_PLURAL_DEFINITE_GENITIVE} kort,",
		},
		PROMPT_GREMLIN: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_GREMLIN_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_GREMLIN_ACTION: {
			ENG: "Swap the positions of two other players' markers, or two other players' cards, without looking at either. {Pause:short}",
			SWE: "Byt plats på två andra spelares märken eller två andra spelares kort, utan att titta på något av dem. {Pause:short}",
		},
		PROMPT_INSOMNIAC: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_INSOMNIAC_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_INSOMNIAC_ACTION: {
			ENG: "Look at your own card. {Pause:short}",
			SWE: "Titta på ditt eget kort. {Pause:short}",
		},
		PROMPT_INSTIGATOR: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_INSTIGATOR_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_INSTIGATOR_ACTION: {
			ENG: "Swap another player's marker for {ROLE_INSTIGATOR_DEFINITE_GENITIVE} marker. {Pause:short}",
			SWE: "Byt ut en annan spelares märke mot {ROLE_INSTIGATOR_DEFINITE_GENITIVE} märke. {Pause:short}",
		},
		PROMPT_LEADER: {
			ENG: "{PROMPT_WAKE_CALL} {TEAM_ALIEN_PLURAL}, hold out a thumb so {ROLE_LEADER_DEFINITE} can see. {If:hasFeudingAliens,PROMPT_LEADER_FEUDINGALIENS} {Pause:short} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_LEADER_DOPPELGANGER} {TEAM_ALIEN_PLURAL}, put your thumbs down.",
			SWE: "{PROMPT_WAKE_CALL} {TEAM_ALIEN_PLURAL}, håll ut en tumme så att {ROLE_LEADER_DEFINITE} kan se. {If:hasFeudingAliens,PROMPT_LEADER_FEUDINGALIENS} {Pause:short} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_LEADER_DOPPELGANGER} {TEAM_ALIEN_PLURAL}, ner med tummarna.",
		},
		PROMPT_LEADER_DOPPELGANGER: {
			ENG: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} {TEAM_ALIEN_PLURAL}, keep holding out your thumbs so {ROLE_DOPPELGANGER_DEFINITE} can see. {Pause:short} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
			SWE: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} {TEAM_ALIEN_PLURAL}, fortsätt hålla ut tummarna så att {ROLE_DOPPELGANGER_DEFINITE} kan se. {Pause:short} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
		},
		PROMPT_LEADER_FEUDINGALIENS: {
			ENG: "{ROLE_FEUDINGALIENS_PLURAL}, hold out both thumbs. {ROLE_LEADER}, if you see both {ROLE_FEUDINGALIENS_DEFINITE}, you win if neither of them is voted out.",
			SWE: "{ROLE_FEUDINGALIENS_PLURAL}, håll ut båda tummarna. {ROLE_LEADER}, om du ser både {ROLE_FEUDINGALIENS_DEFINITE} vinner du om ingen av dem röstas ut.",
		},
		PROMPT_LOVERS: {
			ENG: "{SPECIAL_LOVERS}, wake up and identify each other. If one of you is voted out, the other is voted out too. {Pause:short} {PROMPT_SLEEP_CALL}",
			SWE: "{SPECIAL_LOVERS}, vakna och identifiera varandra. Om en av er röstas ut så kommer samtliga att röstas ut. {Pause:short} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_LOVERS_ACTION: {
		},
		PROMPT_MARKSMAN: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_MARKSMAN_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_MARKSMAN_ACTION: {
			ENG: "Look at another player's card, plus another player's marker. It must not be the same player. {Pause:medium}",
			SWE: "Titta på en annan spelares kort, samt ytterligare en annan spelares märke. Det får inte vara samma spelare. {Pause:medium}",
		},
		PROMPT_MASON: {
			ENG: "{ROLE_MASON_PLURAL}, {If:hasDoppelganger,PROMPT_MASON_DOPPELGANGER} wake up and identify each other. {Pause:short} {ROLE_MASON_PLURAL}, go to sleep.",
			SWE: "{ROLE_MASON_PLURAL}, {If:hasDoppelganger,PROMPT_MASON_DOPPELGANGER} vakna och identifiera varandra. {Pause:short} {ROLE_MASON_PLURAL}, somna.",
		},
		PROMPT_MASON_DOPPELGANGER: {
			ENG: "and {ROLE_DOPPELGANGER_DEFINITE} if you saw one of {ROLE_MASON_PLURAL_DEFINITE},",
			SWE: "och {ROLE_DOPPELGANGER_DEFINITE} om du såg en av {ROLE_MASON_PLURAL_DEFINITE},",
		},
		PROMPT_MINION: {
			ENG: "{PROMPT_WAKE_CALL} {TEAM_WEREWOLF_PLURAL}, hold out a thumb so {ROLE_MINION_DEFINITE} can see who you are. {Pause:short} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_MINION_DOPPELGANGER} {TEAM_WEREWOLF_PLURAL}, put your thumbs down.",
			SWE: "{PROMPT_WAKE_CALL} {TEAM_WEREWOLF_PLURAL}, håll ut en tumme så att {ROLE_MINION_DEFINITE} kan se vem ni är. {Pause:short} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_MINION_DOPPELGANGER} {TEAM_WEREWOLF_PLURAL}, ner med tummarna.",
		},
		PROMPT_MINION_DOPPELGANGER: {
			ENG: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} {TEAM_WEREWOLF_PLURAL}, keep holding out your thumb. {Pause:short} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
			SWE: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} {TEAM_WEREWOLF_PLURAL}, fortsätt hålla ut tummen. {Pause:short} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
		},
		PROMPT_MORTICIAN: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_VIEW_CARD} {Pause:short} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_MYSTICWOLF: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_VIEW_CARD} {Pause:short} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_NOSTRADAMUS: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_NOSTRADAMUS_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_NOSTRADAMUS_ACTION: {
			ENG: "You may look at one to three other players' cards. {If:hasDangerRoles,PROMPT_NOSTRADAMUS_WARNING,PROMPT_NOSTRADAMUS_NO_WARNING}",
			SWE: "Du får titta på en till tre andra spelares kort. {If:hasDangerRoles,PROMPT_NOSTRADAMUS_WARNING,PROMPT_NOSTRADAMUS_NO_WARNING}",
		},
		PROMPT_NOSTRADAMUS_DOPPELGANGER: {
			ENG: "{ROLE_DOPPELGANGER}, if you saw {ROLE_NOSTRADAMUS_DEFINITE}, the same win condition applies to you.",
			SWE: "{ROLE_DOPPELGANGER}, om du såg {ROLE_NOSTRADAMUS_DEFINITE} gäller samma vinstvillkor för dig.",
		},
		PROMPT_NOSTRADAMUS_NO_WARNING: {
			COMMON: "{Pause:medium}",
		},
		PROMPT_NOSTRADAMUS_SUFFIX: {
			ENG: "If you are not voted out and that team wins, you win too. {If:hasDoppelganger,PROMPT_NOSTRADAMUS_DOPPELGANGER}",
			SWE: "Om du inte blir utröstad och det laget vinner så vinner även du. {If:hasDoppelganger,PROMPT_NOSTRADAMUS_DOPPELGANGER}",
		},
		PROMPT_NOSTRADAMUS_WARNING: {
			ENG: "If you see: {IdentityList:listDangerRoles,or}, you must stop. {Input:nostradamusTeam,value,PROMPT_NOSTRADAMUS_WARNING_MANUAL,long,fallbackTeam,availableTeams,PROMPT_NOSTRADAMUS_WARNING_RESOLVED}",
			SWE: "Om du ser: {IdentityList:listDangerRoles,or} måste du sluta. {Input:nostradamusTeam,value,PROMPT_NOSTRADAMUS_WARNING_MANUAL,long,fallbackTeam,availableTeams,PROMPT_NOSTRADAMUS_WARNING_RESOLVED}",
		},
		PROMPT_NOSTRADAMUS_WARNING_MANUAL: {
			ENG: "<Narrator: announce which team {ROLE_NOSTRADAMUS_DEFINITE} now belongs to, or {LocalizedValue:fallbackTeam}>. {PROMPT_NOSTRADAMUS_SUFFIX}",
			SWE: "<Berättare: annonsera vilket lag {ROLE_NOSTRADAMUS_DEFINITE} nu tillhör, eller {LocalizedValue:fallbackTeam}>. {PROMPT_NOSTRADAMUS_SUFFIX}",
		},
		PROMPT_NOSTRADAMUS_WARNING_RESOLVED: {
			ENG: "{ROLE_NOSTRADAMUS_DEFINITE} now belongs to {LocalizedValue:nostradamusTeam}. {PROMPT_NOSTRADAMUS_SUFFIX}",
			SWE: "{ROLE_NOSTRADAMUS_DEFINITE} tillhör nu {LocalizedValue:nostradamusTeam}. {PROMPT_NOSTRADAMUS_SUFFIX}",
		},
		PROMPT_ORACLE: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {Select:type,view_card,PROMPT_ORACLE_VIEW_CARD,oracle_change_team,PROMPT_ORACLE_CHANGE_TEAM,oracle_block_action,PROMPT_ORACLE_BLOCK_ACTION,role_action,PROMPT_DO_ROLE_ACTION,oracle_announce_even_odd,PROMPT_ORACLE_EVEN_ODD,oracle_hunt,PROMPT_ORACLE_HUNT,oracle_force_ripple,PROMPT_ORACLE_FORCE_RIPPLE} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_ORACLE_BLOCK_ACTION: {
			ENG: "All other players, hold out a hand in front of you. {ROLE_ORACLE}, touch another player's hand that you want to block. That player may not wake up or perform any action during the night, regardless of their role. {Pause:short}",
			SWE: "Alla andra spelare, håll ut en hand framför er. {ROLE_ORACLE}, rör vid en annan spelares hand som du vill blockera. Spelaren får inte vakna eller utföra någon handling under natten oavsett vad deras roll är. {Pause:short}",
		},
		PROMPT_ORACLE_CHANGE_TEAM: {
			ENG: "Do you want to join {Identity:joinTeam,definite,genitive} team? {Input:oracleJoinAccepted,choice,PROMPT_ORACLE_CHANGE_TEAM_MANUAL,short,defaultJoinAccepted,true,UI_YES,PROMPT_ORACLE_CHANGE_TEAM_ACCEPTED,false,UI_NO,PROMPT_ORACLE_CHANGE_TEAM_DECLINED}",
			SWE: "Vill du gå med i {Identity:joinTeam,definite,genitive} lag? {Input:oracleJoinAccepted,choice,PROMPT_ORACLE_CHANGE_TEAM_MANUAL,short,defaultJoinAccepted,true,UI_YES,PROMPT_ORACLE_CHANGE_TEAM_ACCEPTED,false,UI_NO,PROMPT_ORACLE_CHANGE_TEAM_DECLINED}",
		},
		PROMPT_ORACLE_CHANGE_TEAM_ACCEPTED: {
			ENG: "{Select:joinFull,true,PROMPT_ORACLE_CHANGE_TEAM_FULL,false,PROMPT_ORACLE_CHANGE_TEAM_PARTIAL}",
			SWE: "{Select:joinFull,true,PROMPT_ORACLE_CHANGE_TEAM_FULL,false,PROMPT_ORACLE_CHANGE_TEAM_PARTIAL}",
		},
		PROMPT_ORACLE_CHANGE_TEAM_DECLINED: {
			ENG: "{ROLE_ORACLE_DEFINITE} remains on {TEAM_VILLAGE_DEFINITE_GENITIVE} team.",
			SWE: "{ROLE_ORACLE_DEFINITE} är kvar i {TEAM_VILLAGE_DEFINITE_GENITIVE} lag.",
		},
		PROMPT_ORACLE_CHANGE_TEAM_FULL: {
			ENG: "{ROLE_ORACLE_DEFINITE} is now that role, and wakes up together with them.",
			SWE: "{ROLE_ORACLE_DEFINITE} är nu den rollen, och vaknar tillsammans med dem.",
		},
		PROMPT_ORACLE_CHANGE_TEAM_MANUAL: {
			ENG: "If yes, {Select:joinFull,true,PROMPT_ORACLE_CHANGE_TEAM_FULL,false,PROMPT_ORACLE_CHANGE_TEAM_PARTIAL} If no, {ROLE_ORACLE_DEFINITE} remains on {TEAM_VILLAGE_DEFINITE_GENITIVE} team.",
			SWE: "Om ja, {Select:joinFull,true,PROMPT_ORACLE_CHANGE_TEAM_FULL,false,PROMPT_ORACLE_CHANGE_TEAM_PARTIAL} Om nej, {ROLE_ORACLE_DEFINITE} är kvar i {TEAM_VILLAGE_DEFINITE_GENITIVE} lag.",
		},
		PROMPT_ORACLE_CHANGE_TEAM_PARTIAL: {
			ENG: "{ROLE_ORACLE_DEFINITE} now wins together with that team, but is not that role and does not wake up together with them.",
			SWE: "{ROLE_ORACLE_DEFINITE} vinner nu tillsammans med det laget, men är inte den rollen och vaknar inte tillsammans med dem.",
		},
		PROMPT_ORACLE_EVEN_ODD: {
			COMMON: "{AutoKey:PROMPT_ORACLE_EVEN_ODD_MANUAL,PROMPT_ORACLE_EVEN_ODD_AUTO}",
		},
		PROMPT_ORACLE_EVEN_ODD_AUTO: {
			ENG: "State whether you have an even or odd player number. {Input:oracleEvenOdd,choice,PROMPT_ORACLE_EVEN_ODD_MANUAL,short,defaultEvenOdd,even,UI_EVEN,PROMPT_ORACLE_EVEN_ODD_RESULT,odd,UI_ODD,PROMPT_ORACLE_EVEN_ODD_RESULT}",
			SWE: "Ange om du har ett jämnt eller udda spelarnummer. {Input:oracleEvenOdd,choice,PROMPT_ORACLE_EVEN_ODD_MANUAL,short,defaultEvenOdd,even,UI_EVEN,PROMPT_ORACLE_EVEN_ODD_RESULT,odd,UI_ODD,PROMPT_ORACLE_EVEN_ODD_RESULT}",
		},
		PROMPT_ORACLE_EVEN_ODD_MANUAL: {
			ENG: "<Narrator: reveal whether {ROLE_ORACLE_DEFINITE} has an even or odd player number>.",
			SWE: "<Berättare: avslöja om {ROLE_ORACLE_DEFINITE} har ett jämnt eller udda spelarnummer>.",
		},
		PROMPT_ORACLE_EVEN_ODD_RESULT: {
			ENG: "{ROLE_ORACLE_DEFINITE} has an {Select:oracleEvenOdd,even,UI_EVEN,odd,UI_ODD} player number.",
			SWE: "{ROLE_ORACLE_DEFINITE} har ett {Select:oracleEvenOdd,even,UI_EVEN,odd,UI_ODD} spelarnummer.",
		},
		PROMPT_ORACLE_FORCE_RIPPLE: {
			ENG: "Do you want to force a ripple in space-time? {Input:oracleForcedRipple,choice,PROMPT_ORACLE_FORCE_RIPPLE_MANUAL,short,defaultRippleForce,true,UI_YES,PROMPT_ORACLE_FORCE_RIPPLE_YES,false,UI_NO,PROMPT_ORACLE_FORCE_RIPPLE_NO}",
			SWE: "Vill du tvinga fram en krusning i rum-tiden? {Input:oracleForcedRipple,choice,PROMPT_ORACLE_FORCE_RIPPLE_MANUAL,short,defaultRippleForce,true,UI_YES,PROMPT_ORACLE_FORCE_RIPPLE_YES,false,UI_NO,PROMPT_ORACLE_FORCE_RIPPLE_NO}",
		},
		PROMPT_ORACLE_FORCE_RIPPLE_MANUAL: {
			ENG: "<If yes: {PROMPT_ORACLE_FORCE_RIPPLE_YES} If no: {PROMPT_ORACLE_FORCE_RIPPLE_NO}>",
			SWE: "<Om ja: {PROMPT_ORACLE_FORCE_RIPPLE_YES} Om nej: {PROMPT_ORACLE_FORCE_RIPPLE_NO}>",
		},
		PROMPT_ORACLE_FORCE_RIPPLE_NO: {
			ENG: "No ripple is guaranteed, but one may still occur at random.",
			SWE: "Ingen krusning är garanterad, men kan fortfarande inträffa slumpmässigt.",
		},
		PROMPT_ORACLE_FORCE_RIPPLE_YES: {
			ENG: "A ripple is now guaranteed to occur.",
			SWE: "En krusning är nu garanterad att inträffa.",
		},
		PROMPT_ORACLE_HUNT: {
			ENG: "Guess a number between one and ten. {AutoKey:PROMPT_ORACLE_HUNT_MANUAL,PROMPT_ORACLE_HUNT_AUTO}",
			SWE: "Gissa ett tal mellan ett och tio. {AutoKey:PROMPT_ORACLE_HUNT_MANUAL,PROMPT_ORACLE_HUNT_AUTO}",
		},
		PROMPT_ORACLE_HUNT_AUTO: {
			COMMON: "{Input:oracleHuntGuess,choice,PROMPT_ORACLE_HUNT_MANUAL,short,defaultHuntGuess,1,UI_NUM_1,PROMPT_ORACLE_HUNT_RESOLVE,2,UI_NUM_2,PROMPT_ORACLE_HUNT_RESOLVE,3,UI_NUM_3,PROMPT_ORACLE_HUNT_RESOLVE,4,UI_NUM_4,PROMPT_ORACLE_HUNT_RESOLVE,5,UI_NUM_5,PROMPT_ORACLE_HUNT_RESOLVE,6,UI_NUM_6,PROMPT_ORACLE_HUNT_RESOLVE,7,UI_NUM_7,PROMPT_ORACLE_HUNT_RESOLVE,8,UI_NUM_8,PROMPT_ORACLE_HUNT_RESOLVE,9,UI_NUM_9,PROMPT_ORACLE_HUNT_RESOLVE,10,UI_NUM_10,PROMPT_ORACLE_HUNT_RESOLVE}",
		},
		PROMPT_ORACLE_HUNT_AVOIDED: {
			ENG: "Correct. Whenever another role is told to wake up, you may wake up with them once during the night to observe who they are and what they do. {If:showExclusionWarning,PROMPT_ORACLE_HUNT_OMNISCIENCE}",
			SWE: "Korrekt. När en annan roll blir tillsagd att vakna kan du en gång under natten vakna tillsammans med dem för att iaktta vem de är och vad de gör. {If:showExclusionWarning,PROMPT_ORACLE_HUNT_OMNISCIENCE}",
		},
		PROMPT_ORACLE_HUNT_MANUAL: {
			COMMON: "{Select:huntActive,true,PROMPT_ORACLE_HUNT_STARTED,false,PROMPT_ORACLE_HUNT_AVOIDED}",
		},
		PROMPT_ORACLE_HUNT_OMNISCIENCE: {
			ENG: "However, you may not wake up to observe any of the following roles: {IdentityList:listExcludedRoles,or}.",
			SWE: "Du får dock inte vakna för att iaktta någon av följande roller: {IdentityList:listExcludedRoles,or}.",
		},
		PROMPT_ORACLE_HUNT_RESOLVE: {
			COMMON: "{Select:huntActive,true,PROMPT_ORACLE_HUNT_STARTED,false,PROMPT_ORACLE_HUNT_AVOIDED}",
		},
		PROMPT_ORACLE_HUNT_STARTED: {
			ENG: "Wrong. {ROLE_ORACLE}, you now only win if you are not voted out. All other players, regardless of previous role and team, now have only one win condition: find {ROLE_ORACLE_DEFINITE}.",
			SWE: "Fel. {ROLE_ORACLE}, du vinner nu endast om du inte blir utröstad. Övriga spelare, oberoende av tidigare roll- och lagtillhörighet har ni nu endast ett vinstvillkor: hitta {ROLE_ORACLE_DEFINITE}.",
		},
		PROMPT_ORACLE_VIEW_CARD: {
			COMMON: "{PROMPT_VIEW_CARD} {Pause:medium}",
		},
		PROMPT_PARANORMALINVESTIGATOR: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_PARANORMALINVESTIGATOR_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_PARANORMALINVESTIGATOR_ACTION: {
			ENG: "You may look at one to two other players' cards. {If:hasDangerRoles,PROMPT_PARANORMALINVESTIGATOR_WARNING} {Pause:medium}",
			SWE: "Du får titta på en till två andra spelares kort. {If:hasDangerRoles,PROMPT_PARANORMALINVESTIGATOR_WARNING} {Pause:medium}",
		},
		PROMPT_PARANORMALINVESTIGATOR_WARNING: {
			ENG: "If you see: {IdentityList:listDangerRoles,or}, you must stop, and will join their team.",
			SWE: "Om du ser: {IdentityList:listDangerRoles,or}, måste du sluta, och tillhör då deras lag.",
		},
		PROMPT_PICKPOCKET: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_PICKPOCKET_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_PICKPOCKET_ACTION: {
			ENG: "You may choose to steal another player's marker and replace it with your own. Then look at the marker you stole. {Pause:short}",
			SWE: "Du kan välja att stjäla en annan spelares märke och ersätta det med ditt märke. Titta sedan på märket du stal. {Pause:short}",
		},
		PROMPT_PRIEST: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_PRIEST_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_PRIEST_ACTION: {
			ENG: "Swap your marker for a {TOKEN_MARK_CLARITY}. If you want, you may also swap another player's marker for a {TOKEN_MARK_CLARITY}. {Pause:medium}",
			SWE: "Byt ut ditt märke mot ett {TOKEN_MARK_CLARITY}. Om du vill får du även byta ut en annan spelares märke mot ett {TOKEN_MARK_CLARITY}. {Pause:medium}",
		},
		PROMPT_PSYCHIC: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_VIEW_CARD} {Pause:medium} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_RASCAL: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_RASCAL_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_RASCAL_ACTION: {
			ENG: "{PROMPT_DO_ROLE_ACTION}",
			SWE: "{PROMPT_DO_ROLE_ACTION}",
		},
		PROMPT_RENFIELD: {
			ENG: "{PROMPT_WAKE_CALL} {TEAM_VAMPIRE_PLURAL}, point at the player you have given {TEAM_VAMPIRE_DEFINITE_GENITIVE} marker. {ROLE_RENFIELD}, {PROMPT_RENFIELD_ACTION} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_RENFIELD_DOPPELGANGER} {TEAM_VAMPIRE_PLURAL}, stop pointing.",
			SWE: "{PROMPT_WAKE_CALL} {TEAM_VAMPIRE_PLURAL}, peka på den spelare som ni har gett {TEAM_VAMPIRE_DEFINITE_GENITIVE} märke. {ROLE_RENFIELD}, {PROMPT_RENFIELD_ACTION} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_RENFIELD_DOPPELGANGER} {TEAM_VAMPIRE_PLURAL}, sluta peka.",
		},
		PROMPT_RENFIELD_ACTION: {
			ENG: "identify {TEAM_VAMPIRE_DEFINITE} and swap your marker for {TOKEN_MARK_RENFIELD}. {Pause:medium}",
			SWE: "identifiera {TEAM_VAMPIRE_DEFINITE} och byt ut ditt märke mot {TOKEN_MARK_RENFIELD}. {Pause:medium}",
		},
		PROMPT_RENFIELD_DOPPELGANGER: {
			ENG: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} {TEAM_VAMPIRE_PLURAL}, keep pointing at the player you have given {TEAM_VAMPIRE_DEFINITE_GENITIVE} marker. {ROLE_DOPPELGANGER}, {PROMPT_RENFIELD_ACTION} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
			SWE: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} {TEAM_VAMPIRE_PLURAL}, fortsätt peka på den spelare som ni har gett {TEAM_VAMPIRE_DEFINITE_GENITIVE} märke. {ROLE_DOPPELGANGER}, {PROMPT_RENFIELD_ACTION} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
		},
		PROMPT_REVEALER: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_REVEALER_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_REVEALER_ACTION: {
			ENG: "Turn another player's card face up. {If:hasHiddenRoles,PROMPT_REVEALER_HIDDEN_ROLE} {Pause:short}",
			SWE: "Vänd upp en annan spelares kort. {If:hasHiddenRoles,PROMPT_REVEALER_HIDDEN_ROLE} {Pause:short}",
		},
		PROMPT_REVEALER_HIDDEN_ROLE: {
			ENG: "If the card is: {IdentityList:listHiddenRoles,or}, turn the card back face down.",
			SWE: "Om kortet är: {IdentityList:listHiddenRoles,or}, vänd kortet tillbaka.",
		},
		PROMPT_RIPPLE: {
			COMMON: "{If:noRipple,PROMPT_RIPPLE_NONE} {PROMPT_RIPPLE_CONTENT}",
		},
		PROMPT_RIPPLE_CONTENT: {
			ENG: "A ripple has occurred in space-time. {PROMPT_RIPPLE_SELECTOR}",
			SWE: "Det har inträffat en krusning i rum-tiden. {PROMPT_RIPPLE_SELECTOR}",
		},
		PROMPT_RIPPLE_DOUBLE_VOTE: {
			ENG: "{Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} {ValueList:players} may use both hands when voting, for double votes.",
			SWE: "Spelare {ValueList:players} får under omröstningen använda båda händerna för dubbla röster.",
		},
		PROMPT_RIPPLE_MUTED: {
			ENG: "{Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} {ValueList:players} may not speak until after the vote.",
			SWE: "Spelare {ValueList:players} får inte prata förrän efter omröstningen.",
		},
		PROMPT_RIPPLE_NONE: {
			ENG: "<Narrator: ignore the following unless {ROLE_ORACLE_DEFINITE} has chosen to force a ripple>",
			SWE: "<Berättare: ignorera följande om inte {ROLE_ORACLE_DEFINITE} valt att tvinga fram en krusning>",
		},
		PROMPT_RIPPLE_REBUKED: {
			ENG: "{Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} {ValueList:players} must turn away from the table until after the vote.",
			SWE: "Spelare {ValueList:players} måste vända sig från bordet förrän efter omröstningen.",
		},
		PROMPT_RIPPLE_ROLE_ACTION: {
			ENG: "Player {Value:player}, wake up. {PROMPT_DO_ROLE_ACTION} Player {Value:player}, go to sleep.",
			SWE: "Spelare {Value:player}, vakna. {PROMPT_DO_ROLE_ACTION} Spelare {Value:player}, somna.",
		},
		PROMPT_RIPPLE_SELECTOR: {
			COMMON: "{Select:type,ripple_timer,PROMPT_RIPPLE_TIMER,ripple_role_action,PROMPT_RIPPLE_ROLE_ACTION,ripple_mute,PROMPT_RIPPLE_MUTED,ripple_rebuked,PROMPT_RIPPLE_REBUKED,ripple_view_player,PROMPT_RIPPLE_VIEW_PLAYER,ripple_double_vote,PROMPT_RIPPLE_DOUBLE_VOTE}",
		},
		PROMPT_RIPPLE_TIMER: {
			ENG: "You have only one minute left before you must vote.",
			SWE: "Ni har endast en minut på er innan ni måste rösta.",
		},
		PROMPT_RIPPLE_VIEW_PLAYER: {
			ENG: "Player {Value:player}, wake up. {PROMPT_VIEW_CARD} {Pause:medium} Player {Value:player}, go to sleep.",
			SWE: "Spelare {Value:player}, vakna. {PROMPT_VIEW_CARD} {Pause:medium} Spelare {Value:player}, somna.",
		},
		PROMPT_ROBBER: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_ROBBER_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_ROBBER_ACTION: {
			ENG: "You may choose to steal another player's card and replace it with your own. Then look at the card you stole. Do not wake up when your new role is called. {Pause:short}",
			SWE: "Du kan välja att stjäla en annan spelares kort och ersätta det med ditt kort. Titta sedan på kortet du stal. Du ska inte vakna när din nya roll ropas upp. {Pause:short}",
		},
		PROMPT_SEER: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_SEER_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_SEER_ACTION: {
			ENG: "You may look at another player's card, or two of the center cards. {Pause:short}",
			SWE: "Du får titta på en annan spelares kort, eller två av mittenkorten. {Pause:short}",
		},
		PROMPT_SENTINEL: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_SENTINEL_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_SENTINEL_ACTION: {
			ENG: "Place a {TOKEN_SHIELD} on another player's card. Other players may not look at or move the card during the night. {Pause:short}",
			SWE: "Placera en {TOKEN_SHIELD} på en annan spelares kort. Andra spelare får varken titta på eller flytta kortet under natten. {Pause:short}",
		},
		PROMPT_SLEEP_CALL: {
			ENG: "{Identity:instigator}, go to sleep.",
			SWE: "{Identity:instigator}, somna.",
		},
		PROMPT_SLEEP_CALL_DOPPELGANGER: {
			ENG: "{ROLE_DOPPELGANGER}, go to sleep.",
			SWE: "{ROLE_DOPPELGANGER}, somna.",
		},
		PROMPT_SQUIRE: {
			ENG: "{PROMPT_WAKE_CALL} {TEAM_WEREWOLF_PLURAL}, hold out a thumb so {ROLE_SQUIRE_DEFINITE} can see who you are. {ROLE_SQUIRE}, you may look at their cards. {Pause:medium} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_SQUIRE_DOPPELGANGER} {TEAM_WEREWOLF_PLURAL}, put your thumbs down.",
			SWE: "{PROMPT_WAKE_CALL} {TEAM_WEREWOLF_PLURAL}, håll ut en tumme så att {ROLE_SQUIRE_DEFINITE} kan se vem ni är. {ROLE_SQUIRE}, du får titta på deras kort. {Pause:medium} {PROMPT_SLEEP_CALL} {If:hasDoppelganger,PROMPT_SQUIRE_DOPPELGANGER} {TEAM_WEREWOLF_PLURAL}, ner med tummarna.",
		},
		PROMPT_SQUIRE_DOPPELGANGER: {
			ENG: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} {TEAM_WEREWOLF_PLURAL}, keep holding out your thumb. {ROLE_DOPPELGANGER}, you may look at their cards. {Pause:medium} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
			SWE: "{PROMPT_WAKE_CALL_DOPPELGANGER_INLINE} {TEAM_WEREWOLF_PLURAL}, fortsätt hålla ut tummen. {ROLE_DOPPELGANGER}, du får titta på deras kort. {Pause:medium} {PROMPT_SLEEP_CALL_DOPPELGANGER}",
		},
		PROMPT_THING: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_THING_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_THING_ACTION: {
			ENG: "All other players, hold out a hand in front of you. {ROLE_THING}, touch the hand belonging to the players nearest to your right or left. {Pause:short}",
			SWE: "Alla andra spelare, håll ut en hand framför er. {ROLE_THING}, rör handen tillhörande spelaren närmast till höger eller vänster. {Pause:short}",
		},
		PROMPT_TROUBLEMAKER: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_TROUBLEMAKER_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_TROUBLEMAKER_ACTION: {
			ENG: "Swap the positions of two other players' cards, without looking at either. {Pause:short}",
			SWE: "Byt plats på två andra spelares kort, utan att titta på något av dem. {Pause:short}",
		},
		PROMPT_UNIVERSAL_SLEEP: {
			COMMON: "{PROMPT_SLEEP_CALL}",
		},
		PROMPT_UNIVERSAL_WAKE: {
			COMMON: "{PROMPT_WAKE_CALL}",
		},
		PROMPT_VAMPIRE_TEAM: {
			ENG: "{TEAM_VAMPIRE_PLURAL}, wake up and identify each other. Together, choose a player whose marker you swap for {TOKEN_MARK_VAMPIRE}. {Pause:medium} {TEAM_VAMPIRE_PLURAL}, go to sleep.",
			SWE: "{TEAM_VAMPIRE_PLURAL}, vakna och identifiera varandra. Tillsammans får ni välja en spelare vars märke ni byter ut mot {TOKEN_MARK_VAMPIRE}. {Pause:medium} {TEAM_VAMPIRE_PLURAL}, somna.",
		},
		PROMPT_VIEW_CARD: {
			ENG: "You may look at {PROMPT_VIEW_CARD_ENTRY}.",
			SWE: "Du får titta på {PROMPT_VIEW_CARD_ENTRY}.",
		},
		PROMPT_VIEW_CARD_CENTER: {
			ENG: "{NUM_WORD} of the center cards",
			SWE: "{NUM_WORD} av mittenkorten",
		},
		PROMPT_VIEW_CARD_ENTRY: {
			COMMON: "{Select:target,center,PROMPT_VIEW_CARD_CENTER,neighbor,PROMPT_VIEW_CARD_NEIGHBOR,even_player,PROMPT_VIEW_CARD_EVEN,odd_player,PROMPT_VIEW_CARD_ODD,player,PROMPT_VIEW_CARD_PLAYER,self,PROMPT_VIEW_CARD_SELF}",
		},
		PROMPT_VIEW_CARD_EVEN: {
			ENG: "{NUM_WORD} {Select:count,1,GRAMMAR_CARD_SINGULAR,*,GRAMMAR_CARD_PLURAL} from even-numbered players",
			SWE: "{NUM_WORD} {Select:count,1,GRAMMAR_CARD_SINGULAR,*,GRAMMAR_CARD_PLURAL} från jämna spelare",
		},
		PROMPT_VIEW_CARD_NEIGHBOR: {
			COMMON: "{Select:restriction,left,PROMPT_VIEW_CARD_NEIGHBOR_LEFT,right,PROMPT_VIEW_CARD_NEIGHBOR_RIGHT,both,PROMPT_VIEW_CARD_NEIGHBOR_BOTH,any,PROMPT_VIEW_CARD_NEIGHBOR_ANY}",
		},
		PROMPT_VIEW_CARD_NEIGHBOR_ANY: {
			ENG: "one of your neighbors' cards",
			SWE: "en grannes kort",
		},
		PROMPT_VIEW_CARD_NEIGHBOR_BOTH: {
			ENG: "both of your neighbors' cards",
			SWE: "båda grannars kort",
		},
		PROMPT_VIEW_CARD_NEIGHBOR_LEFT: {
			ENG: "your left neighbor's card",
			SWE: "vänster grannes kort",
		},
		PROMPT_VIEW_CARD_NEIGHBOR_RIGHT: {
			ENG: "your right neighbor's card",
			SWE: "höger grannes kort",
		},
		PROMPT_VIEW_CARD_ODD: {
			ENG: "{NUM_WORD} {Select:count,1,GRAMMAR_CARD_SINGULAR,*,GRAMMAR_CARD_PLURAL} from odd-numbered players",
			SWE: "{NUM_WORD} {Select:count,1,GRAMMAR_CARD_SINGULAR,*,GRAMMAR_CARD_PLURAL} från udda spelare",
		},
		PROMPT_VIEW_CARD_PLAYER: {
			COMMON: "{Select:restriction,any,PROMPT_VIEW_CARD_PLAYER_ANY,specific,PROMPT_VIEW_CARD_PLAYER_SPECIFIC}",
		},
		PROMPT_VIEW_CARD_PLAYER_ANY: {
			ENG: "{NUM_WORD} {Select:count,1,GRAMMAR_CARD_SINGULAR,*,GRAMMAR_CARD_PLURAL} from {Select:count,1,PROMPT_VIEW_CARD_PLAYER_ANY_SINGLE,*,PROMPT_VIEW_CARD_PLAYER_ANY_MULTI} {Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL}",
			SWE: "{NUM_WORD} {Select:count,1,GRAMMAR_CARD_SINGULAR,*,GRAMMAR_CARD_PLURAL} från {Select:count,1,PROMPT_VIEW_CARD_PLAYER_ANY_SINGLE,*,PROMPT_VIEW_CARD_PLAYER_ANY_MULTI} {Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL}",
		},
		PROMPT_VIEW_CARD_PLAYER_ANY_MULTI: {
			ENG: "other",
			SWE: "andra",
		},
		PROMPT_VIEW_CARD_PLAYER_ANY_SINGLE: {
			ENG: "another",
			SWE: "en annan",
		},
		PROMPT_VIEW_CARD_PLAYER_SPECIFIC: {
			ENG: "the {Select:count,1,GRAMMAR_CARD_SINGULAR,*,GRAMMAR_CARD_PLURAL} belonging to {Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} {ValueList:players}",
			SWE: "{Select:count,1,GRAMMAR_CARD_SINGULAR,*,GRAMMAR_CARD_PLURAL} som tillhör {Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL} {ValueList:players}",
		},
		PROMPT_VIEW_CARD_SELF: {
			ENG: "your own card",
			SWE: "ditt eget kort",
		},
		PROMPT_VILLAGEIDIOT: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_VILLAGEIDIOT_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_VILLAGEIDIOT_ACTION: {
			ENG: "You may choose to move every player's card one step to the left, to the right, or not at all. {Pause:long}",
			SWE: "Du kan välja att flytta samtliga spelares kort ett steg åt vänster, åt höger, eller inte alls. {Pause:long}",
		},
		PROMPT_WAKE_CALL: {
			ENG: "{Identity:instigator}, wake up.",
			SWE: "{Identity:instigator}, vakna.",
		},
		PROMPT_WAKE_CALL_DOPPELGANGER_ECHO: {
			ENG: "{ROLE_DOPPELGANGER}, if you saw {Identity:copiedRole,definite}, wake up.",
			SWE: "{ROLE_DOPPELGANGER}, om du såg {Identity:copiedRole,definite}, vakna.",
		},
		PROMPT_WAKE_CALL_DOPPELGANGER_INLINE: {
			ENG: "{ROLE_DOPPELGANGER}, if you saw {Identity:instigator,definite}, wake up.",
			SWE: "{ROLE_DOPPELGANGER}, om du såg {Identity:instigator,definite}, vakna.",
		},
		PROMPT_WEREWOLF_TEAM: {
			ENG: "{If:hasDreamWolf,PROMPT_WEREWOLF_TEAM_CORE_DREAMWOLF,PROMPT_WEREWOLF_TEAM_CORE_STANDARD}",
			SWE: "{If:hasDreamWolf,PROMPT_WEREWOLF_TEAM_CORE_DREAMWOLF,PROMPT_WEREWOLF_TEAM_CORE_STANDARD}",
		},
		PROMPT_WEREWOLF_TEAM_CORE_DREAMWOLF: {
			ENG: "{TEAM_WEREWOLF_PLURAL}, except for {ROLE_DREAMWOLF_DEFINITE}, wake up and identify each other. {ROLE_DREAMWOLF}, stick out your thumb so the other {TEAM_WEREWOLF_PLURAL} can see who you are. If there is only one {TEAM_WEREWOLF}, you may look at one of the center cards. {Pause:medium} {ROLE_DREAMWOLF}, put your thumb down. {TEAM_WEREWOLF_PLURAL}, go to sleep.",
			SWE: "{TEAM_WEREWOLF_PLURAL}, med undantag för {ROLE_DREAMWOLF_DEFINITE}, vakna och identifiera varandra. {ROLE_DREAMWOLF}, stick ut tummen så att andra {TEAM_WEREWOLF_PLURAL} kan se vem du är. Om det bara finns en {TEAM_WEREWOLF} får du titta på ett av mittenkorten. {Pause:medium} {ROLE_DREAMWOLF}, ner med tummen. {TEAM_WEREWOLF_PLURAL}, somna.",
		},
		PROMPT_WEREWOLF_TEAM_CORE_STANDARD: {
			ENG: "{TEAM_WEREWOLF_PLURAL}, wake up and identify each other. If there is only one {TEAM_WEREWOLF}, you may look at one of the center cards. {Pause:medium} {TEAM_WEREWOLF_PLURAL}, go to sleep.",
			SWE: "{TEAM_WEREWOLF_PLURAL}, vakna och identifiera varandra. Om det bara finns en {TEAM_WEREWOLF} får du titta på ett av mittenkorten. {Pause:medium} {TEAM_WEREWOLF_PLURAL}, somna.",
		},
		PROMPT_WITCH: {
			COMMON: "{If:copiedRole,PROMPT_WAKE_CALL_DOPPELGANGER_ECHO,PROMPT_WAKE_CALL} {PROMPT_WITCH_ACTION} {PROMPT_SLEEP_CALL}",
		},
		PROMPT_WITCH_ACTION: {
			ENG: "You may choose to look at one of the center cards. If you do, you must give that card to yourself or to another player. {Pause:short}",
			SWE: "Du kan välja att titta på ett av korten i mitten. Om du gör det måste du ge det kortet till dig själv eller en annan spelare. {Pause:short}",
		},
		ROLE_ALIEN: {
			ENG: "Alien",
			SWE: "Utomjording",
		},
		ROLE_ALIEN_DEFINITE: {
			ENG: "the Alien",
			SWE: "Utomjordingen",
		},
		ROLE_ALIEN_DEFINITE_GENITIVE: {
			ENG: "the Alien's",
			SWE: "Utomjordingens",
		},
		ROLE_ALIEN_GENITIVE: {
			ENG: "Alien's",
			SWE: "Utomjordings",
		},
		ROLE_ALIEN_PLURAL: {
			ENG: "Aliens",
			SWE: "Utomjordingar",
		},
		ROLE_ALIEN_PLURAL_DEFINITE: {
			ENG: "the Aliens",
			SWE: "Utomjordingarna",
		},
		ROLE_ALIEN_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Aliens'",
			SWE: "Utomjordingarnas",
		},
		ROLE_ALIEN_PLURAL_GENITIVE: {
			ENG: "Aliens'",
			SWE: "Utomjordingars",
		},
		ROLE_ALPHAWOLF: {
			ENG: "Alpha Wolf",
			SWE: "Alfavarg",
		},
		ROLE_ALPHAWOLF_DEFINITE: {
			ENG: "the Alpha Wolf",
			SWE: "Alfavargen",
		},
		ROLE_ALPHAWOLF_DEFINITE_GENITIVE: {
			ENG: "the Alpha Wolf's",
			SWE: "Alfavargens",
		},
		ROLE_ALPHAWOLF_GENITIVE: {
			ENG: "Alpha Wolf's",
			SWE: "Alfavargs",
		},
		ROLE_ALPHAWOLF_PLURAL: {
			ENG: "Alpha Wolves",
			SWE: "Alfavargar",
		},
		ROLE_ALPHAWOLF_PLURAL_DEFINITE: {
			ENG: "the Alpha Wolves",
			SWE: "Alfavargarna",
		},
		ROLE_ALPHAWOLF_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Alpha Wolves'",
			SWE: "Alfavargarnas",
		},
		ROLE_ALPHAWOLF_PLURAL_GENITIVE: {
			ENG: "Alpha Wolves'",
			SWE: "Alfavargars",
		},
		ROLE_APPRENTICEASSASSIN: {
			ENG: "Apprentice Assassin",
			SWE: "Lönnmördarnovis",
		},
		ROLE_APPRENTICEASSASSIN_DEFINITE: {
			ENG: "the Apprentice Assassin",
			SWE: "Lönnmördarnovisen",
		},
		ROLE_APPRENTICEASSASSIN_DEFINITE_GENITIVE: {
			ENG: "the Apprentice Assassin's",
			SWE: "Lönnmördarnovisens",
		},
		ROLE_APPRENTICEASSASSIN_GENITIVE: {
			ENG: "Apprentice Assassin's",
			SWE: "Lönnmördarnovis",
		},
		ROLE_APPRENTICEASSASSIN_PLURAL: {
			ENG: "Apprentice Assassins",
			SWE: "Lönnmördarnoviser",
		},
		ROLE_APPRENTICEASSASSIN_PLURAL_DEFINITE: {
			ENG: "the Apprentice Assassins",
			SWE: "Lönnmördarnoviserna",
		},
		ROLE_APPRENTICEASSASSIN_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Apprentice Assassins'",
			SWE: "Lönnmördarnovisernas",
		},
		ROLE_APPRENTICEASSASSIN_PLURAL_GENITIVE: {
			ENG: "Apprentice Assassins'",
			SWE: "Lönnmördarnovisers",
		},
		ROLE_APPRENTICESEER: {
			ENG: "Apprentice Seer",
			SWE: "Siarlärling",
		},
		ROLE_APPRENTICESEER_DEFINITE: {
			ENG: "the Apprentice Seer",
			SWE: "Siarlärlingen",
		},
		ROLE_APPRENTICESEER_DEFINITE_GENITIVE: {
			ENG: "the Apprentice Seer's",
			SWE: "Siarlärlingens",
		},
		ROLE_APPRENTICESEER_GENITIVE: {
			ENG: "Apprentice Seer's",
			SWE: "Siarlärlings",
		},
		ROLE_APPRENTICESEER_PLURAL: {
			ENG: "Apprentice Seers",
			SWE: "Siarlärlingar",
		},
		ROLE_APPRENTICESEER_PLURAL_DEFINITE: {
			ENG: "the Apprentice Seers",
			SWE: "Siarlärlingarna",
		},
		ROLE_APPRENTICESEER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Apprentice Seers'",
			SWE: "Siarlärlingarnas",
		},
		ROLE_APPRENTICESEER_PLURAL_GENITIVE: {
			ENG: "Apprentice Seers'",
			SWE: "Siarlärlingars",
		},
		ROLE_APPRENTICETANNER: {
			ENG: "Apprentice Tanner",
			SWE: "Garvargesäll",
		},
		ROLE_APPRENTICETANNER_DEFINITE: {
			ENG: "the Apprentice Tanner",
			SWE: "Garvargesällen",
		},
		ROLE_APPRENTICETANNER_DEFINITE_GENITIVE: {
			ENG: "the Apprentice Tanner's",
			SWE: "Garvargesällens",
		},
		ROLE_APPRENTICETANNER_GENITIVE: {
			ENG: "Apprentice Tanner's",
			SWE: "Garvargesälls",
		},
		ROLE_APPRENTICETANNER_PLURAL: {
			ENG: "Apprentice Tanners",
			SWE: "Garvargesäller",
		},
		ROLE_APPRENTICETANNER_PLURAL_DEFINITE: {
			ENG: "the Apprentice Tanners",
			SWE: "Garvargesällerna",
		},
		ROLE_APPRENTICETANNER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Apprentice Tanners'",
			SWE: "Garvargesällernas",
		},
		ROLE_APPRENTICETANNER_PLURAL_GENITIVE: {
			ENG: "Apprentice Tanners'",
			SWE: "Garvargesällers",
		},
		ROLE_ASSASSIN: {
			ENG: "Assassin",
			SWE: "Lönnmördare",
		},
		ROLE_ASSASSIN_DEFINITE: {
			ENG: "the Assassin",
			SWE: "Lönnmördaren",
		},
		ROLE_ASSASSIN_DEFINITE_GENITIVE: {
			ENG: "the Assassin's",
			SWE: "Lönnmördarens",
		},
		ROLE_ASSASSIN_GENITIVE: {
			ENG: "Assassin's",
			SWE: "Lönnmördares",
		},
		ROLE_ASSASSIN_PLURAL: {
			ENG: "Assassins",
			SWE: "Lönnmördare",
		},
		ROLE_ASSASSIN_PLURAL_DEFINITE: {
			ENG: "the Assassins",
			SWE: "Lönnmördarna",
		},
		ROLE_ASSASSIN_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Assassins'",
			SWE: "Lönnmördarnas",
		},
		ROLE_ASSASSIN_PLURAL_GENITIVE: {
			ENG: "Assassins'",
			SWE: "Lönnmördares",
		},
		ROLE_AURASEER: {
			ENG: "Aura Seer",
			SWE: "Auraläsare",
		},
		ROLE_AURASEER_DEFINITE: {
			ENG: "the Aura Seer",
			SWE: "Auraläsaren",
		},
		ROLE_AURASEER_DEFINITE_GENITIVE: {
			ENG: "the Aura Seer's",
			SWE: "Auraläsarens",
		},
		ROLE_AURASEER_GENITIVE: {
			ENG: "Aura Seer's",
			SWE: "Auraläsares",
		},
		ROLE_AURASEER_PLURAL: {
			ENG: "Aura Seers",
			SWE: "Auraläsare",
		},
		ROLE_AURASEER_PLURAL_DEFINITE: {
			ENG: "the Aura Seers",
			SWE: "Auraläsarna",
		},
		ROLE_AURASEER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Aura Seers'",
			SWE: "Auraläsarnas",
		},
		ROLE_AURASEER_PLURAL_GENITIVE: {
			ENG: "Aura Seers'",
			SWE: "Auraläsares",
		},
		ROLE_BEHOLDER: {
			ENG: "Beholder",
			SWE: "Betraktare",
		},
		ROLE_BEHOLDER_DEFINITE: {
			ENG: "the Beholder",
			SWE: "Betraktaren",
		},
		ROLE_BEHOLDER_DEFINITE_GENITIVE: {
			ENG: "the Beholder's",
			SWE: "Betraktarens",
		},
		ROLE_BEHOLDER_GENITIVE: {
			ENG: "Beholder's",
			SWE: "Betraktares",
		},
		ROLE_BEHOLDER_PLURAL: {
			ENG: "Beholders",
			SWE: "Betraktare",
		},
		ROLE_BEHOLDER_PLURAL_DEFINITE: {
			ENG: "the Beholders",
			SWE: "Betraktarna",
		},
		ROLE_BEHOLDER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Beholders'",
			SWE: "Betraktarnas",
		},
		ROLE_BEHOLDER_PLURAL_GENITIVE: {
			ENG: "Beholders'",
			SWE: "Betraktares",
		},
		ROLE_BLOB: {
			ENG: "Blob",
			SWE: "Blobb",
		},
		ROLE_BLOB_DEFINITE: {
			ENG: "the Blob",
			SWE: "Blobben",
		},
		ROLE_BLOB_DEFINITE_GENITIVE: {
			ENG: "the Blob's",
			SWE: "Blobbens",
		},
		ROLE_BLOB_GENITIVE: {
			ENG: "Blob's",
			SWE: "Blobbs",
		},
		ROLE_BLOB_PLURAL: {
			ENG: "Blobs",
			SWE: "Blobbar",
		},
		ROLE_BLOB_PLURAL_DEFINITE: {
			ENG: "the Blobs",
			SWE: "Blobbarna",
		},
		ROLE_BLOB_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Blobs'",
			SWE: "Blobbarnas",
		},
		ROLE_BLOB_PLURAL_GENITIVE: {
			ENG: "Blobs'",
			SWE: "Blobbars",
		},
		ROLE_BODYGUARD: {
			ENG: "Bodyguard",
			SWE: "Livvakt",
		},
		ROLE_BODYGUARD_DEFINITE: {
			ENG: "the Bodyguard",
			SWE: "Livvakten",
		},
		ROLE_BODYGUARD_DEFINITE_GENITIVE: {
			ENG: "the Bodyguard's",
			SWE: "Livvaktens",
		},
		ROLE_BODYGUARD_GENITIVE: {
			ENG: "Bodyguard's",
			SWE: "Livvakts",
		},
		ROLE_BODYGUARD_PLURAL: {
			ENG: "Bodyguards",
			SWE: "Livvakter",
		},
		ROLE_BODYGUARD_PLURAL_DEFINITE: {
			ENG: "the Bodyguards",
			SWE: "Livvakterna",
		},
		ROLE_BODYGUARD_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Bodyguards'",
			SWE: "Livvakternas",
		},
		ROLE_BODYGUARD_PLURAL_GENITIVE: {
			ENG: "Bodyguards'",
			SWE: "Livvakters",
		},
		ROLE_BODYSNATCHER: {
			ENG: "Body Snatcher",
			SWE: "Infiltratör",
		},
		ROLE_BODYSNATCHER_DEFINITE: {
			ENG: "the Body Snatcher",
			SWE: "Infiltratören",
		},
		ROLE_BODYSNATCHER_DEFINITE_GENITIVE: {
			ENG: "the Body Snatcher's",
			SWE: "Infiltratörens",
		},
		ROLE_BODYSNATCHER_GENITIVE: {
			ENG: "Body Snatcher's",
			SWE: "Infiltratörs",
		},
		ROLE_BODYSNATCHER_PLURAL: {
			ENG: "Body Snatchers",
			SWE: "Infiltratörer",
		},
		ROLE_BODYSNATCHER_PLURAL_DEFINITE: {
			ENG: "the Body Snatchers",
			SWE: "Infiltratörerna",
		},
		ROLE_BODYSNATCHER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Body Snatchers'",
			SWE: "Infiltratörernas",
		},
		ROLE_BODYSNATCHER_PLURAL_GENITIVE: {
			ENG: "Body Snatchers'",
			SWE: "Infiltratörers",
		},
		ROLE_COPYCAT: {
			ENG: "Copycat",
			SWE: "Imitatör",
		},
		ROLE_COPYCAT_DEFINITE: {
			ENG: "the Copycat",
			SWE: "Imitatören",
		},
		ROLE_COPYCAT_DEFINITE_GENITIVE: {
			ENG: "the Copycat's",
			SWE: "Imitatörens",
		},
		ROLE_COPYCAT_GENITIVE: {
			ENG: "Copycat's",
			SWE: "Imitatörs",
		},
		ROLE_COPYCAT_PLURAL: {
			ENG: "Copycats",
			SWE: "Imitatörer",
		},
		ROLE_COPYCAT_PLURAL_DEFINITE: {
			ENG: "the Copycats",
			SWE: "Imitatörerna",
		},
		ROLE_COPYCAT_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Copycats'",
			SWE: "Imitatörernas",
		},
		ROLE_COPYCAT_PLURAL_GENITIVE: {
			ENG: "Copycats'",
			SWE: "Imitatörers",
		},
		ROLE_COUNT: {
			ENG: "Count",
			SWE: "Greve",
		},
		ROLE_COUNT_DEFINITE: {
			ENG: "the Count",
			SWE: "Greven",
		},
		ROLE_COUNT_DEFINITE_GENITIVE: {
			ENG: "the Count's",
			SWE: "Grevens",
		},
		ROLE_COUNT_GENITIVE: {
			ENG: "Count's",
			SWE: "Greves",
		},
		ROLE_COUNT_PLURAL: {
			ENG: "Counts",
			SWE: "Grevar",
		},
		ROLE_COUNT_PLURAL_DEFINITE: {
			ENG: "the Counts",
			SWE: "Grevarna",
		},
		ROLE_COUNT_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Counts'",
			SWE: "Grevarnas",
		},
		ROLE_COUNT_PLURAL_GENITIVE: {
			ENG: "Counts'",
			SWE: "Grevars",
		},
		ROLE_COW: {
			ENG: "Cow",
			SWE: "Ko",
		},
		ROLE_COW_DEFINITE: {
			ENG: "the Cow",
			SWE: "Kon",
		},
		ROLE_COW_DEFINITE_GENITIVE: {
			ENG: "the Cow's",
			SWE: "Kons",
		},
		ROLE_COW_GENITIVE: {
			ENG: "Cow's",
			SWE: "Kos",
		},
		ROLE_COW_PLURAL: {
			ENG: "Cows",
			SWE: "Kor",
		},
		ROLE_COW_PLURAL_DEFINITE: {
			ENG: "the Cows",
			SWE: "Korna",
		},
		ROLE_COW_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Cows'",
			SWE: "Kornas",
		},
		ROLE_COW_PLURAL_GENITIVE: {
			ENG: "Cows'",
			SWE: "Kors",
		},
		ROLE_CUPID: {
			ENG: "Cupid",
			SWE: "Amor",
		},
		ROLE_CUPID_DEFINITE: {
			ENG: "Cupid",
			SWE: "Amor",
		},
		ROLE_CUPID_DEFINITE_GENITIVE: {
			ENG: "Cupid's",
			SWE: "Amors",
		},
		ROLE_CUPID_GENITIVE: {
			ENG: "Cupid's",
			SWE: "Amors",
		},
		ROLE_CUPID_PLURAL: {
			ENG: "Cupids",
			SWE: "Amorer",
		},
		ROLE_CUPID_PLURAL_DEFINITE: {
			ENG: "the Cupids",
			SWE: "Amorerna",
		},
		ROLE_CUPID_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Cupids'",
			SWE: "Amorernas",
		},
		ROLE_CUPID_PLURAL_GENITIVE: {
			ENG: "Cupids'",
			SWE: "Amorers",
		},
		ROLE_CURATOR: {
			ENG: "Curator",
			SWE: "Kurator",
		},
		ROLE_CURATOR_DEFINITE: {
			ENG: "the Curator",
			SWE: "Kuratorn",
		},
		ROLE_CURATOR_DEFINITE_GENITIVE: {
			ENG: "the Curator's",
			SWE: "Kuratorns",
		},
		ROLE_CURATOR_GENITIVE: {
			ENG: "Curator's",
			SWE: "Kurators",
		},
		ROLE_CURATOR_PLURAL: {
			ENG: "Curators",
			SWE: "Kuratorer",
		},
		ROLE_CURATOR_PLURAL_DEFINITE: {
			ENG: "the Curators",
			SWE: "Kuratorerna",
		},
		ROLE_CURATOR_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Curators'",
			SWE: "Kuratorernas",
		},
		ROLE_CURATOR_PLURAL_GENITIVE: {
			ENG: "Curators'",
			SWE: "Kuratorers",
		},
		ROLE_CURSED: {
			ENG: "Cursed",
			SWE: "Fördömd",
		},
		ROLE_CURSED_DEFINITE: {
			ENG: "the Cursed",
			SWE: "den Fördömda",
		},
		ROLE_CURSED_DEFINITE_GENITIVE: {
			ENG: "the Cursed's",
			SWE: "den Fördömdas",
		},
		ROLE_CURSED_GENITIVE: {
			ENG: "Cursed's",
			SWE: "Fördömds",
		},
		ROLE_CURSED_PLURAL: {
			ENG: "Cursed",
			SWE: "Fördömda",
		},
		ROLE_CURSED_PLURAL_DEFINITE: {
			ENG: "the Cursed",
			SWE: "de Fördömda",
		},
		ROLE_CURSED_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Cursed's",
			SWE: "de Fördömdas",
		},
		ROLE_CURSED_PLURAL_GENITIVE: {
			ENG: "Cursed's",
			SWE: "Fördömdas",
		},
		ROLE_DISEASED: {
			ENG: "Diseased",
			SWE: "Smittad",
		},
		ROLE_DISEASED_DEFINITE: {
			ENG: "the Diseased",
			SWE: "den Smittade",
		},
		ROLE_DISEASED_DEFINITE_GENITIVE: {
			ENG: "the Diseased's",
			SWE: "den Smittades",
		},
		ROLE_DISEASED_GENITIVE: {
			ENG: "Diseased's",
			SWE: "Smittads",
		},
		ROLE_DISEASED_PLURAL: {
			ENG: "Diseased",
			SWE: "Smittade",
		},
		ROLE_DISEASED_PLURAL_DEFINITE: {
			ENG: "the Diseased",
			SWE: "de Smittade",
		},
		ROLE_DISEASED_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Diseased's",
			SWE: "de Smittades",
		},
		ROLE_DISEASED_PLURAL_GENITIVE: {
			ENG: "Diseased's",
			SWE: "Smittades",
		},
		ROLE_DOPPELGANGER: {
			ENG: "Doppelganger",
			SWE: "Dubbelgångare",
		},
		ROLE_DOPPELGANGER_DEFINITE: {
			ENG: "the Doppelganger",
			SWE: "Dubbelgångaren",
		},
		ROLE_DOPPELGANGER_DEFINITE_GENITIVE: {
			ENG: "the Doppelganger's",
			SWE: "Dubbelgångarens",
		},
		ROLE_DOPPELGANGER_GENITIVE: {
			ENG: "Doppelganger's",
			SWE: "Dubbelgångares",
		},
		ROLE_DOPPELGANGER_PLURAL: {
			ENG: "Doppelgangers",
			SWE: "Dubbelgångare",
		},
		ROLE_DOPPELGANGER_PLURAL_DEFINITE: {
			ENG: "the Doppelgangers",
			SWE: "Dubbelgångarna",
		},
		ROLE_DOPPELGANGER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Doppelgangers'",
			SWE: "Dubbelgångarnas",
		},
		ROLE_DOPPELGANGER_PLURAL_GENITIVE: {
			ENG: "Doppelgangers'",
			SWE: "Dubbelgångares",
		},
		ROLE_DREAMWOLF: {
			ENG: "Dream Wolf",
			SWE: "Drömvarg",
		},
		ROLE_DREAMWOLF_DEFINITE: {
			ENG: "the Dream Wolf",
			SWE: "Drömvargen",
		},
		ROLE_DREAMWOLF_DEFINITE_GENITIVE: {
			ENG: "the Dream Wolf's",
			SWE: "Drömvargens",
		},
		ROLE_DREAMWOLF_GENITIVE: {
			ENG: "Dream Wolf's",
			SWE: "Drömvargs",
		},
		ROLE_DREAMWOLF_PLURAL: {
			ENG: "Dream Wolves",
			SWE: "Drömvargar",
		},
		ROLE_DREAMWOLF_PLURAL_DEFINITE: {
			ENG: "the Dream Wolves",
			SWE: "Drömvargarna",
		},
		ROLE_DREAMWOLF_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Dream Wolves'",
			SWE: "Drömvargarnas",
		},
		ROLE_DREAMWOLF_PLURAL_GENITIVE: {
			ENG: "Dream Wolves'",
			SWE: "Drömvargars",
		},
		ROLE_DRUNK: {
			ENG: "Drunk",
			SWE: "Berusad",
		},
		ROLE_DRUNK_DEFINITE: {
			ENG: "the Drunk",
			SWE: "den Berusade",
		},
		ROLE_DRUNK_DEFINITE_GENITIVE: {
			ENG: "the Drunk's",
			SWE: "den Berusades",
		},
		ROLE_DRUNK_GENITIVE: {
			ENG: "Drunk's",
			SWE: "Berusads",
		},
		ROLE_DRUNK_PLURAL: {
			ENG: "Drunks",
			SWE: "Berusade",
		},
		ROLE_DRUNK_PLURAL_DEFINITE: {
			ENG: "the Drunks",
			SWE: "de Berusade",
		},
		ROLE_DRUNK_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Drunks'",
			SWE: "de Berusades",
		},
		ROLE_DRUNK_PLURAL_GENITIVE: {
			ENG: "Drunks'",
			SWE: "Berusades",
		},
		ROLE_EMPATH: {
			ENG: "Empath",
			SWE: "Empat",
		},
		ROLE_EMPATH_DEFINITE: {
			ENG: "the Empath",
			SWE: "Empaten",
		},
		ROLE_EMPATH_DEFINITE_GENITIVE: {
			ENG: "the Empath's",
			SWE: "Empatens",
		},
		ROLE_EMPATH_GENITIVE: {
			ENG: "Empath's",
			SWE: "Empats",
		},
		ROLE_EMPATH_PLURAL: {
			ENG: "Empaths",
			SWE: "Empater",
		},
		ROLE_EMPATH_PLURAL_DEFINITE: {
			ENG: "the Empaths",
			SWE: "Empaterna",
		},
		ROLE_EMPATH_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Empaths'",
			SWE: "Empaternas",
		},
		ROLE_EMPATH_PLURAL_GENITIVE: {
			ENG: "Empaths'",
			SWE: "Empaters",
		},
		ROLE_EXPOSER: {
			ENG: "Exposer",
			SWE: "Angivare",
		},
		ROLE_EXPOSER_DEFINITE: {
			ENG: "the Exposer",
			SWE: "Angivaren",
		},
		ROLE_EXPOSER_DEFINITE_GENITIVE: {
			ENG: "the Exposer's",
			SWE: "Angivarens",
		},
		ROLE_EXPOSER_GENITIVE: {
			ENG: "Exposer's",
			SWE: "Angivares",
		},
		ROLE_EXPOSER_PLURAL: {
			ENG: "Exposers",
			SWE: "Angivare",
		},
		ROLE_EXPOSER_PLURAL_DEFINITE: {
			ENG: "the Exposers",
			SWE: "Angivarna",
		},
		ROLE_EXPOSER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Exposers'",
			SWE: "Angivarnas",
		},
		ROLE_EXPOSER_PLURAL_GENITIVE: {
			ENG: "Exposers'",
			SWE: "Angivares",
		},
		ROLE_FEUDINGALIENS: {
			ENG: "Groob and Zerb",
			SWE: "Groob och Zerb",
		},
		ROLE_FEUDINGALIENS_DEFINITE: {
			ENG: "Groob and Zerb",
			SWE: "Groob och Zerb",
		},
		ROLE_FEUDINGALIENS_DEFINITE_GENITIVE: {
			ENG: "Groob and Zerb's",
			SWE: "Groobs och Zerbs",
		},
		ROLE_FEUDINGALIENS_GENITIVE: {
			ENG: "Groob and Zerb's",
			SWE: "Groobs och Zerbs",
		},
		ROLE_FEUDINGALIENS_PLURAL: {
			ENG: "Groob and Zerb",
			SWE: "Groob och Zerb",
		},
		ROLE_FEUDINGALIENS_PLURAL_DEFINITE: {
			ENG: "Groob and Zerb",
			SWE: "Groob och Zerb",
		},
		ROLE_FEUDINGALIENS_PLURAL_DEFINITE_GENITIVE: {
			ENG: "Groob and Zerb's",
			SWE: "Groobs och Zerbs",
		},
		ROLE_FEUDINGALIENS_PLURAL_GENITIVE: {
			ENG: "Groob and Zerb's",
			SWE: "Groobs och Zerbs",
		},
		ROLE_GREMLIN: {
			ENG: "Gremlin",
			SWE: "Troll",
		},
		ROLE_GREMLIN_DEFINITE: {
			ENG: "the Gremlin",
			SWE: "Trollet",
		},
		ROLE_GREMLIN_DEFINITE_GENITIVE: {
			ENG: "the Gremlin's",
			SWE: "Trollets",
		},
		ROLE_GREMLIN_GENITIVE: {
			ENG: "Gremlin's",
			SWE: "Trolls",
		},
		ROLE_GREMLIN_PLURAL: {
			ENG: "Gremlins",
			SWE: "Troll",
		},
		ROLE_GREMLIN_PLURAL_DEFINITE: {
			ENG: "the Gremlins",
			SWE: "Trollen",
		},
		ROLE_GREMLIN_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Gremlins'",
			SWE: "Trollens",
		},
		ROLE_GREMLIN_PLURAL_GENITIVE: {
			ENG: "Gremlins'",
			SWE: "Trolls",
		},
		ROLE_HUNTER: {
			ENG: "Hunter",
			SWE: "Jägare",
		},
		ROLE_HUNTER_DEFINITE: {
			ENG: "the Hunter",
			SWE: "Jägaren",
		},
		ROLE_HUNTER_DEFINITE_GENITIVE: {
			ENG: "the Hunter's",
			SWE: "Jägarens",
		},
		ROLE_HUNTER_GENITIVE: {
			ENG: "Hunter's",
			SWE: "Jägares",
		},
		ROLE_HUNTER_PLURAL: {
			ENG: "Hunters",
			SWE: "Jägare",
		},
		ROLE_HUNTER_PLURAL_DEFINITE: {
			ENG: "the Hunters",
			SWE: "Jägarna",
		},
		ROLE_HUNTER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Hunters'",
			SWE: "Jägarnas",
		},
		ROLE_HUNTER_PLURAL_GENITIVE: {
			ENG: "Hunters'",
			SWE: "Jägares",
		},
		ROLE_INSOMNIAC: {
			ENG: "Insomniac",
			SWE: "Sömnlös",
		},
		ROLE_INSOMNIAC_DEFINITE: {
			ENG: "the Insomniac",
			SWE: "den Sömnlösa",
		},
		ROLE_INSOMNIAC_DEFINITE_GENITIVE: {
			ENG: "the Insomniac's",
			SWE: "den Sömnlösas",
		},
		ROLE_INSOMNIAC_GENITIVE: {
			ENG: "Insomniac's",
			SWE: "Sömnlöss",
		},
		ROLE_INSOMNIAC_PLURAL: {
			ENG: "Insomniacs",
			SWE: "Sömnlösa",
		},
		ROLE_INSOMNIAC_PLURAL_DEFINITE: {
			ENG: "the Insomniacs",
			SWE: "de Sömnlösa",
		},
		ROLE_INSOMNIAC_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Insomniacs'",
			SWE: "de Sömnlösas",
		},
		ROLE_INSOMNIAC_PLURAL_GENITIVE: {
			ENG: "Insomniacs'",
			SWE: "Sömnlösas",
		},
		ROLE_INSTIGATOR: {
			ENG: "Instigator",
			SWE: "Anstiftare",
		},
		ROLE_INSTIGATOR_DEFINITE: {
			ENG: "the Instigator",
			SWE: "Anstiftaren",
		},
		ROLE_INSTIGATOR_DEFINITE_GENITIVE: {
			ENG: "the Instigator's",
			SWE: "Anstiftarens",
		},
		ROLE_INSTIGATOR_GENITIVE: {
			ENG: "Instigator's",
			SWE: "Anstiftares",
		},
		ROLE_INSTIGATOR_PLURAL: {
			ENG: "Instigators",
			SWE: "Anstiftare",
		},
		ROLE_INSTIGATOR_PLURAL_DEFINITE: {
			ENG: "the Instigators",
			SWE: "Anstiftarna",
		},
		ROLE_INSTIGATOR_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Instigators'",
			SWE: "Anstiftarnas",
		},
		ROLE_INSTIGATOR_PLURAL_GENITIVE: {
			ENG: "Instigators'",
			SWE: "Anstiftares",
		},
		ROLE_LEADER: {
			ENG: "Leader",
			SWE: "Borgmästare",
		},
		ROLE_LEADER_DEFINITE: {
			ENG: "the Leader",
			SWE: "Borgmästaren",
		},
		ROLE_LEADER_DEFINITE_GENITIVE: {
			ENG: "the Leader's",
			SWE: "Borgmästarens",
		},
		ROLE_LEADER_GENITIVE: {
			ENG: "Leader's",
			SWE: "Borgmästares",
		},
		ROLE_LEADER_PLURAL: {
			ENG: "Leaders",
			SWE: "Borgmästare",
		},
		ROLE_LEADER_PLURAL_DEFINITE: {
			ENG: "the Leaders",
			SWE: "Borgmästarna",
		},
		ROLE_LEADER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Leaders'",
			SWE: "Borgmästarnas",
		},
		ROLE_LEADER_PLURAL_GENITIVE: {
			ENG: "Leaders'",
			SWE: "Borgmästares",
		},
		ROLE_MARKSMAN: {
			ENG: "Marksman",
			SWE: "Spejare",
		},
		ROLE_MARKSMAN_DEFINITE: {
			ENG: "the Marksman",
			SWE: "Spejaren",
		},
		ROLE_MARKSMAN_DEFINITE_GENITIVE: {
			ENG: "the Marksman's",
			SWE: "Spejarens",
		},
		ROLE_MARKSMAN_GENITIVE: {
			ENG: "Marksman's",
			SWE: "Spejares",
		},
		ROLE_MARKSMAN_PLURAL: {
			ENG: "Marksmen",
			SWE: "Spejare",
		},
		ROLE_MARKSMAN_PLURAL_DEFINITE: {
			ENG: "the Marksmen",
			SWE: "Spejarna",
		},
		ROLE_MARKSMAN_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Marksmen's",
			SWE: "Spejarnas",
		},
		ROLE_MARKSMAN_PLURAL_GENITIVE: {
			ENG: "Marksmen's",
			SWE: "Spejares",
		},
		ROLE_MASON: {
			ENG: "Mason",
			SWE: "Frimurare",
		},
		ROLE_MASON_DEFINITE: {
			ENG: "the Mason",
			SWE: "Frimuraren",
		},
		ROLE_MASON_DEFINITE_GENITIVE: {
			ENG: "the Mason's",
			SWE: "Frimurarens",
		},
		ROLE_MASON_GENITIVE: {
			ENG: "Mason's",
			SWE: "Frimurares",
		},
		ROLE_MASON_PLURAL: {
			ENG: "Masons",
			SWE: "Frimurare",
		},
		ROLE_MASON_PLURAL_DEFINITE: {
			ENG: "the Masons",
			SWE: "Frimurarna",
		},
		ROLE_MASON_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Masons'",
			SWE: "Frimurarnas",
		},
		ROLE_MASON_PLURAL_GENITIVE: {
			ENG: "Masons'",
			SWE: "Frimurares",
		},
		ROLE_MASTER: {
			ENG: "Master",
			SWE: "Mästare",
		},
		ROLE_MASTER_DEFINITE: {
			ENG: "the Master",
			SWE: "Mästaren",
		},
		ROLE_MASTER_DEFINITE_GENITIVE: {
			ENG: "the Master's",
			SWE: "Mästarens",
		},
		ROLE_MASTER_GENITIVE: {
			ENG: "Master's",
			SWE: "Mästares",
		},
		ROLE_MASTER_PLURAL: {
			ENG: "Masters",
			SWE: "Mästare",
		},
		ROLE_MASTER_PLURAL_DEFINITE: {
			ENG: "the Masters",
			SWE: "Mästarna",
		},
		ROLE_MASTER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Masters'",
			SWE: "Mästarnas",
		},
		ROLE_MASTER_PLURAL_GENITIVE: {
			ENG: "Masters'",
			SWE: "Mästares",
		},
		ROLE_MINION: {
			ENG: "Minion",
			SWE: "Underhuggare",
		},
		ROLE_MINION_DEFINITE: {
			ENG: "the Minion",
			SWE: "Underhuggaren",
		},
		ROLE_MINION_DEFINITE_GENITIVE: {
			ENG: "the Minion's",
			SWE: "Underhuggarens",
		},
		ROLE_MINION_GENITIVE: {
			ENG: "Minion's",
			SWE: "Underhuggares",
		},
		ROLE_MINION_PLURAL: {
			ENG: "Minions",
			SWE: "Underhuggare",
		},
		ROLE_MINION_PLURAL_DEFINITE: {
			ENG: "the Minions",
			SWE: "Underhuggarna",
		},
		ROLE_MINION_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Minions'",
			SWE: "Underhuggarnas",
		},
		ROLE_MINION_PLURAL_GENITIVE: {
			ENG: "Minions'",
			SWE: "Underhuggares",
		},
		ROLE_MORTICIAN: {
			ENG: "Mortician",
			SWE: "Obducent",
		},
		ROLE_MORTICIAN_DEFINITE: {
			ENG: "the Mortician",
			SWE: "Obducenten",
		},
		ROLE_MORTICIAN_DEFINITE_GENITIVE: {
			ENG: "the Mortician's",
			SWE: "Obducentens",
		},
		ROLE_MORTICIAN_GENITIVE: {
			ENG: "Mortician's",
			SWE: "Obducents",
		},
		ROLE_MORTICIAN_PLURAL: {
			ENG: "Morticians",
			SWE: "Obducenter",
		},
		ROLE_MORTICIAN_PLURAL_DEFINITE: {
			ENG: "the Morticians",
			SWE: "Obducenterna",
		},
		ROLE_MORTICIAN_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Morticians'",
			SWE: "Obducenternas",
		},
		ROLE_MORTICIAN_PLURAL_GENITIVE: {
			ENG: "Morticians'",
			SWE: "Obducenters",
		},
		ROLE_MYSTICWOLF: {
			ENG: "Mystic Wolf",
			SWE: "Siarvarg",
		},
		ROLE_MYSTICWOLF_DEFINITE: {
			ENG: "the Mystic Wolf",
			SWE: "Siarvargen",
		},
		ROLE_MYSTICWOLF_DEFINITE_GENITIVE: {
			ENG: "the Mystic Wolf's",
			SWE: "Siarvargens",
		},
		ROLE_MYSTICWOLF_GENITIVE: {
			ENG: "Mystic Wolf's",
			SWE: "Siarvargs",
		},
		ROLE_MYSTICWOLF_PLURAL: {
			ENG: "Mystic Wolves",
			SWE: "Siarvargar",
		},
		ROLE_MYSTICWOLF_PLURAL_DEFINITE: {
			ENG: "the Mystic Wolves",
			SWE: "Siarvargarna",
		},
		ROLE_MYSTICWOLF_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Mystic Wolves'",
			SWE: "Siarvargarnas",
		},
		ROLE_MYSTICWOLF_PLURAL_GENITIVE: {
			ENG: "Mystic Wolves'",
			SWE: "Siarvargars",
		},
		ROLE_NOSTRADAMUS: {
			ENG: "Nostradamus",
			SWE: "Profet",
		},
		ROLE_NOSTRADAMUS_DEFINITE: {
			ENG: "Nostradamus",
			SWE: "Profeten",
		},
		ROLE_NOSTRADAMUS_DEFINITE_GENITIVE: {
			ENG: "Nostradamus'",
			SWE: "Profetens",
		},
		ROLE_NOSTRADAMUS_GENITIVE: {
			ENG: "Nostradamus'",
			SWE: "Profets",
		},
		ROLE_NOSTRADAMUS_PLURAL: {
			ENG: "Nostradamuses",
			SWE: "Profeter",
		},
		ROLE_NOSTRADAMUS_PLURAL_DEFINITE: {
			ENG: "the Nostradamuses",
			SWE: "Profeterna",
		},
		ROLE_NOSTRADAMUS_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Nostradamuses'",
			SWE: "Profeternas",
		},
		ROLE_NOSTRADAMUS_PLURAL_GENITIVE: {
			ENG: "Nostradamuses'",
			SWE: "Profeters",
		},
		ROLE_ORACLE: {
			ENG: "Oracle",
			SWE: "Orakel",
		},
		ROLE_ORACLE_DEFINITE: {
			ENG: "the Oracle",
			SWE: "Oraklet",
		},
		ROLE_ORACLE_DEFINITE_GENITIVE: {
			ENG: "the Oracle's",
			SWE: "Oraklets",
		},
		ROLE_ORACLE_GENITIVE: {
			ENG: "Oracle's",
			SWE: "Orakels",
		},
		ROLE_ORACLE_PLURAL: {
			ENG: "Oracles",
			SWE: "Orakel",
		},
		ROLE_ORACLE_PLURAL_DEFINITE: {
			ENG: "the Oracles",
			SWE: "Oraklen",
		},
		ROLE_ORACLE_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Oracles'",
			SWE: "Oraklens",
		},
		ROLE_ORACLE_PLURAL_GENITIVE: {
			ENG: "Oracles'",
			SWE: "Orakels",
		},
		ROLE_PARANORMALINVESTIGATOR: {
			ENG: "Paranormal Investigator",
			SWE: "Spökjägare",
		},
		ROLE_PARANORMALINVESTIGATOR_DEFINITE: {
			ENG: "the Paranormal Investigator",
			SWE: "Spökjägaren",
		},
		ROLE_PARANORMALINVESTIGATOR_DEFINITE_GENITIVE: {
			ENG: "the Paranormal Investigator's",
			SWE: "Spökjägarens",
		},
		ROLE_PARANORMALINVESTIGATOR_GENITIVE: {
			ENG: "Paranormal Investigator's",
			SWE: "Spökjägares",
		},
		ROLE_PARANORMALINVESTIGATOR_PLURAL: {
			ENG: "Paranormal Investigators",
			SWE: "Spökjägare",
		},
		ROLE_PARANORMALINVESTIGATOR_PLURAL_DEFINITE: {
			ENG: "the Paranormal Investigators",
			SWE: "Spökjägarna",
		},
		ROLE_PARANORMALINVESTIGATOR_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Paranormal Investigators'",
			SWE: "Spökjägarnas",
		},
		ROLE_PARANORMALINVESTIGATOR_PLURAL_GENITIVE: {
			ENG: "Paranormal Investigators'",
			SWE: "Spökjägares",
		},
		ROLE_PICKPOCKET: {
			ENG: "Pickpocket",
			SWE: "Ficktjuv",
		},
		ROLE_PICKPOCKET_DEFINITE: {
			ENG: "the Pickpocket",
			SWE: "Ficktjuven",
		},
		ROLE_PICKPOCKET_DEFINITE_GENITIVE: {
			ENG: "the Pickpocket's",
			SWE: "Ficktjuvens",
		},
		ROLE_PICKPOCKET_GENITIVE: {
			ENG: "Pickpocket's",
			SWE: "Ficktjuvs",
		},
		ROLE_PICKPOCKET_PLURAL: {
			ENG: "Pickpockets",
			SWE: "Ficktjuvar",
		},
		ROLE_PICKPOCKET_PLURAL_DEFINITE: {
			ENG: "the Pickpockets",
			SWE: "Ficktjuvarna",
		},
		ROLE_PICKPOCKET_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Pickpockets'",
			SWE: "Ficktjuvarnas",
		},
		ROLE_PICKPOCKET_PLURAL_GENITIVE: {
			ENG: "Pickpockets'",
			SWE: "Ficktjuvars",
		},
		ROLE_PRIEST: {
			ENG: "Priest",
			SWE: "Präst",
		},
		ROLE_PRIEST_DEFINITE: {
			ENG: "the Priest",
			SWE: "Prästen",
		},
		ROLE_PRIEST_DEFINITE_GENITIVE: {
			ENG: "the Priest's",
			SWE: "Prästens",
		},
		ROLE_PRIEST_GENITIVE: {
			ENG: "Priest's",
			SWE: "Prästs",
		},
		ROLE_PRIEST_PLURAL: {
			ENG: "Priests",
			SWE: "Präster",
		},
		ROLE_PRIEST_PLURAL_DEFINITE: {
			ENG: "the Priests",
			SWE: "Prästerna",
		},
		ROLE_PRIEST_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Priests'",
			SWE: "Prästernas",
		},
		ROLE_PRIEST_PLURAL_GENITIVE: {
			ENG: "Priests'",
			SWE: "Prästers",
		},
		ROLE_PRINCE: {
			ENG: "Prince",
			SWE: "Prins",
		},
		ROLE_PRINCE_DEFINITE: {
			ENG: "the Prince",
			SWE: "Prinsen",
		},
		ROLE_PRINCE_DEFINITE_GENITIVE: {
			ENG: "the Prince's",
			SWE: "Prinsens",
		},
		ROLE_PRINCE_GENITIVE: {
			ENG: "Prince's",
			SWE: "Prinsens",
		},
		ROLE_PRINCE_PLURAL: {
			ENG: "Princes",
			SWE: "Prinsar",
		},
		ROLE_PRINCE_PLURAL_DEFINITE: {
			ENG: "the Princes",
			SWE: "Prinsarna",
		},
		ROLE_PRINCE_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Princes'",
			SWE: "Prinsarnas",
		},
		ROLE_PRINCE_PLURAL_GENITIVE: {
			ENG: "Princes'",
			SWE: "Prinsars",
		},
		ROLE_PSYCHIC: {
			ENG: "Psychic",
			SWE: "Synsk",
		},
		ROLE_PSYCHIC_DEFINITE: {
			ENG: "the Psychic",
			SWE: "den Synska",
		},
		ROLE_PSYCHIC_DEFINITE_GENITIVE: {
			ENG: "the Psychic's",
			SWE: "den Synskas",
		},
		ROLE_PSYCHIC_GENITIVE: {
			ENG: "Psychic's",
			SWE: "Synsks",
		},
		ROLE_PSYCHIC_PLURAL: {
			ENG: "Psychics",
			SWE: "Synska",
		},
		ROLE_PSYCHIC_PLURAL_DEFINITE: {
			ENG: "the Psychics",
			SWE: "de Synska",
		},
		ROLE_PSYCHIC_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Psychics'",
			SWE: "de Synskas",
		},
		ROLE_PSYCHIC_PLURAL_GENITIVE: {
			ENG: "Psychics'",
			SWE: "Synskas",
		},
		ROLE_RASCAL: {
			ENG: "Rascal",
			SWE: "Fifflare",
		},
		ROLE_RASCAL_DEFINITE: {
			ENG: "the Rascal",
			SWE: "Fifflaren",
		},
		ROLE_RASCAL_DEFINITE_GENITIVE: {
			ENG: "the Rascal's",
			SWE: "Fifflarens",
		},
		ROLE_RASCAL_GENITIVE: {
			ENG: "Rascal's",
			SWE: "Fifflares",
		},
		ROLE_RASCAL_PLURAL: {
			ENG: "Rascals",
			SWE: "Fifflare",
		},
		ROLE_RASCAL_PLURAL_DEFINITE: {
			ENG: "the Rascals",
			SWE: "Fifflarna",
		},
		ROLE_RASCAL_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Rascals'",
			SWE: "Fifflarnas",
		},
		ROLE_RASCAL_PLURAL_GENITIVE: {
			ENG: "Rascals'",
			SWE: "Fifflares",
		},
		ROLE_RENFIELD: {
			ENG: "Renfield",
			SWE: "Renfield",
		},
		ROLE_RENFIELD_DEFINITE: {
			ENG: "Renfield",
			SWE: "Renfield",
		},
		ROLE_RENFIELD_DEFINITE_GENITIVE: {
			ENG: "Renfield's",
			SWE: "Renfields",
		},
		ROLE_RENFIELD_GENITIVE: {
			ENG: "Renfield's",
			SWE: "Renfields",
		},
		ROLE_RENFIELD_PLURAL: {
			ENG: "Renfields",
			SWE: "Renfields",
		},
		ROLE_RENFIELD_PLURAL_DEFINITE: {
			ENG: "the Renfields",
			SWE: "Renfields",
		},
		ROLE_RENFIELD_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Renfields'",
			SWE: "Renfields",
		},
		ROLE_RENFIELD_PLURAL_GENITIVE: {
			ENG: "Renfields'",
			SWE: "Renfields",
		},
		ROLE_REVEALER: {
			ENG: "Revealer",
			SWE: "Astrolog",
		},
		ROLE_REVEALER_DEFINITE: {
			ENG: "the Revealer",
			SWE: "Astrologen",
		},
		ROLE_REVEALER_DEFINITE_GENITIVE: {
			ENG: "the Revealer's",
			SWE: "Astrologens",
		},
		ROLE_REVEALER_GENITIVE: {
			ENG: "Revealer's",
			SWE: "Astrologs",
		},
		ROLE_REVEALER_PLURAL: {
			ENG: "Revealers",
			SWE: "Astrologer",
		},
		ROLE_REVEALER_PLURAL_DEFINITE: {
			ENG: "the Revealers",
			SWE: "Astrologerna",
		},
		ROLE_REVEALER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Revealers'",
			SWE: "Astrologernas",
		},
		ROLE_REVEALER_PLURAL_GENITIVE: {
			ENG: "Revealers'",
			SWE: "Astrologers",
		},
		ROLE_ROBBER: {
			ENG: "Robber",
			SWE: "Tjuv",
		},
		ROLE_ROBBER_DEFINITE: {
			ENG: "the Robber",
			SWE: "Tjuven",
		},
		ROLE_ROBBER_DEFINITE_GENITIVE: {
			ENG: "the Robber's",
			SWE: "Tjuvens",
		},
		ROLE_ROBBER_GENITIVE: {
			ENG: "Robber's",
			SWE: "Tjuvs",
		},
		ROLE_ROBBER_PLURAL: {
			ENG: "Robbers",
			SWE: "Tjuvar",
		},
		ROLE_ROBBER_PLURAL_DEFINITE: {
			ENG: "the Robbers",
			SWE: "Tjuvarna",
		},
		ROLE_ROBBER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Robbers'",
			SWE: "Tjuvarnas",
		},
		ROLE_ROBBER_PLURAL_GENITIVE: {
			ENG: "Robbers'",
			SWE: "Tjuvars",
		},
		ROLE_SEER: {
			ENG: "Seer",
			SWE: "Siare",
		},
		ROLE_SEER_DEFINITE: {
			ENG: "the Seer",
			SWE: "Siaren",
		},
		ROLE_SEER_DEFINITE_GENITIVE: {
			ENG: "the Seer's",
			SWE: "Siarens",
		},
		ROLE_SEER_GENITIVE: {
			ENG: "Seer's",
			SWE: "Siares",
		},
		ROLE_SEER_PLURAL: {
			ENG: "Seers",
			SWE: "Siare",
		},
		ROLE_SEER_PLURAL_DEFINITE: {
			ENG: "the Seers",
			SWE: "Siarna",
		},
		ROLE_SEER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Seers'",
			SWE: "Siarnas",
		},
		ROLE_SEER_PLURAL_GENITIVE: {
			ENG: "Seers'",
			SWE: "Siares",
		},
		ROLE_SENTINEL: {
			ENG: "Sentinel",
			SWE: "Väktare",
		},
		ROLE_SENTINEL_DEFINITE: {
			ENG: "the Sentinel",
			SWE: "Väktaren",
		},
		ROLE_SENTINEL_DEFINITE_GENITIVE: {
			ENG: "the Sentinel's",
			SWE: "Väktarens",
		},
		ROLE_SENTINEL_GENITIVE: {
			ENG: "Sentinel's",
			SWE: "Väktares",
		},
		ROLE_SENTINEL_PLURAL: {
			ENG: "Sentinels",
			SWE: "Väktare",
		},
		ROLE_SENTINEL_PLURAL_DEFINITE: {
			ENG: "the Sentinels",
			SWE: "Väktarna",
		},
		ROLE_SENTINEL_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Sentinels'",
			SWE: "Väktarnas",
		},
		ROLE_SENTINEL_PLURAL_GENITIVE: {
			ENG: "Sentinels'",
			SWE: "Väktares",
		},
		ROLE_SQUIRE: {
			ENG: "Squire",
			SWE: "Lakej",
		},
		ROLE_SQUIRE_DEFINITE: {
			ENG: "the Squire",
			SWE: "Lakejen",
		},
		ROLE_SQUIRE_DEFINITE_GENITIVE: {
			ENG: "the Squire's",
			SWE: "Lakejens",
		},
		ROLE_SQUIRE_GENITIVE: {
			ENG: "Squire's",
			SWE: "Lakejs",
		},
		ROLE_SQUIRE_PLURAL: {
			ENG: "Squires",
			SWE: "Lakejer",
		},
		ROLE_SQUIRE_PLURAL_DEFINITE: {
			ENG: "the Squires",
			SWE: "Lakejerna",
		},
		ROLE_SQUIRE_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Squires'",
			SWE: "Lakejernas",
		},
		ROLE_SQUIRE_PLURAL_GENITIVE: {
			ENG: "Squires'",
			SWE: "Lakejers",
		},
		ROLE_SYNTHETICALIEN: {
			ENG: "Synthetic Alien",
			SWE: "Syntet",
		},
		ROLE_SYNTHETICALIEN_DEFINITE: {
			ENG: "the Synthetic Alien",
			SWE: "Synteten",
		},
		ROLE_SYNTHETICALIEN_DEFINITE_GENITIVE: {
			ENG: "the Synthetic Alien's",
			SWE: "Syntetens",
		},
		ROLE_SYNTHETICALIEN_GENITIVE: {
			ENG: "Synthetic Alien's",
			SWE: "Syntets",
		},
		ROLE_SYNTHETICALIEN_PLURAL: {
			ENG: "Synthetic Aliens",
			SWE: "Synteter",
		},
		ROLE_SYNTHETICALIEN_PLURAL_DEFINITE: {
			ENG: "the Synthetic Aliens",
			SWE: "Synteterna",
		},
		ROLE_SYNTHETICALIEN_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Synthetic Aliens'",
			SWE: "Synteternas",
		},
		ROLE_SYNTHETICALIEN_PLURAL_GENITIVE: {
			ENG: "Synthetic Aliens'",
			SWE: "Synteters",
		},
		ROLE_TANNER: {
			ENG: "Tanner",
			SWE: "Garvare",
		},
		ROLE_TANNER_DEFINITE: {
			ENG: "the Tanner",
			SWE: "Garvaren",
		},
		ROLE_TANNER_DEFINITE_GENITIVE: {
			ENG: "the Tanner's",
			SWE: "Garvarens",
		},
		ROLE_TANNER_GENITIVE: {
			ENG: "Tanner's",
			SWE: "Garvares",
		},
		ROLE_TANNER_PLURAL: {
			ENG: "Tanners",
			SWE: "Garvare",
		},
		ROLE_TANNER_PLURAL_DEFINITE: {
			ENG: "the Tanners",
			SWE: "Garvarna",
		},
		ROLE_TANNER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Tanners'",
			SWE: "Garvarnas",
		},
		ROLE_TANNER_PLURAL_GENITIVE: {
			ENG: "Tanners'",
			SWE: "Garvares",
		},
		ROLE_THING: {
			ENG: "Thing",
			SWE: "Varelsen",
		},
		ROLE_THING_DEFINITE: {
			ENG: "the Thing",
			SWE: "Varelsen",
		},
		ROLE_THING_DEFINITE_GENITIVE: {
			ENG: "the Thing's",
			SWE: "Varelsens",
		},
		ROLE_THING_GENITIVE: {
			ENG: "Thing's",
			SWE: "Varelsens",
		},
		ROLE_THING_PLURAL: {
			ENG: "Things",
			SWE: "Varelser",
		},
		ROLE_THING_PLURAL_DEFINITE: {
			ENG: "the Things",
			SWE: "Varelserna",
		},
		ROLE_THING_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Things'",
			SWE: "Varelsernas",
		},
		ROLE_THING_PLURAL_GENITIVE: {
			ENG: "Things'",
			SWE: "Varelsers",
		},
		ROLE_TROUBLEMAKER: {
			ENG: "Troublemaker",
			SWE: "Bråkmakare",
		},
		ROLE_TROUBLEMAKER_DEFINITE: {
			ENG: "the Troublemaker",
			SWE: "Bråkmakaren",
		},
		ROLE_TROUBLEMAKER_DEFINITE_GENITIVE: {
			ENG: "the Troublemaker's",
			SWE: "Bråkmakarens",
		},
		ROLE_TROUBLEMAKER_GENITIVE: {
			ENG: "Troublemaker's",
			SWE: "Bråkmakares",
		},
		ROLE_TROUBLEMAKER_PLURAL: {
			ENG: "Troublemakers",
			SWE: "Bråkmakare",
		},
		ROLE_TROUBLEMAKER_PLURAL_DEFINITE: {
			ENG: "the Troublemakers",
			SWE: "Bråkmakarna",
		},
		ROLE_TROUBLEMAKER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Troublemakers'",
			SWE: "Bråkmakarnas",
		},
		ROLE_TROUBLEMAKER_PLURAL_GENITIVE: {
			ENG: "Troublemakers'",
			SWE: "Bråkmakares",
		},
		ROLE_VAMPIRE: {
			ENG: "Vampire",
			SWE: "Vampyr",
		},
		ROLE_VAMPIRE_DEFINITE: {
			ENG: "the Vampire",
			SWE: "Vampyren",
		},
		ROLE_VAMPIRE_DEFINITE_GENITIVE: {
			ENG: "the Vampire's",
			SWE: "Vampyrens",
		},
		ROLE_VAMPIRE_GENITIVE: {
			ENG: "Vampire's",
			SWE: "Vampyrs",
		},
		ROLE_VAMPIRE_PLURAL: {
			ENG: "Vampires",
			SWE: "Vampyrer",
		},
		ROLE_VAMPIRE_PLURAL_DEFINITE: {
			ENG: "the Vampires",
			SWE: "Vampyrerna",
		},
		ROLE_VAMPIRE_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Vampires'",
			SWE: "Vampyrernas",
		},
		ROLE_VAMPIRE_PLURAL_GENITIVE: {
			ENG: "Vampires'",
			SWE: "Vampyrers",
		},
		ROLE_VILLAGEIDIOT: {
			ENG: "Village Idiot",
			SWE: "Byfåne",
		},
		ROLE_VILLAGEIDIOT_DEFINITE: {
			ENG: "the Village Idiot",
			SWE: "Byfånen",
		},
		ROLE_VILLAGEIDIOT_DEFINITE_GENITIVE: {
			ENG: "the Village Idiot's",
			SWE: "Byfånens",
		},
		ROLE_VILLAGEIDIOT_GENITIVE: {
			ENG: "Village Idiot's",
			SWE: "Byfånes",
		},
		ROLE_VILLAGEIDIOT_PLURAL: {
			ENG: "Village Idiots",
			SWE: "Byfånar",
		},
		ROLE_VILLAGEIDIOT_PLURAL_DEFINITE: {
			ENG: "the Village Idiots",
			SWE: "Byfånarna",
		},
		ROLE_VILLAGEIDIOT_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Village Idiots'",
			SWE: "Byfånarnas",
		},
		ROLE_VILLAGEIDIOT_PLURAL_GENITIVE: {
			ENG: "Village Idiots'",
			SWE: "Byfånars",
		},
		ROLE_VILLAGER: {
			ENG: "Villager",
			SWE: "Bybo",
		},
		ROLE_VILLAGER_DEFINITE: {
			ENG: "the Villager",
			SWE: "Bybon",
		},
		ROLE_VILLAGER_DEFINITE_GENITIVE: {
			ENG: "the Villager's",
			SWE: "Bybons",
		},
		ROLE_VILLAGER_GENITIVE: {
			ENG: "Villager's",
			SWE: "Bybos",
		},
		ROLE_VILLAGER_PLURAL: {
			ENG: "Villagers",
			SWE: "Bybor",
		},
		ROLE_VILLAGER_PLURAL_DEFINITE: {
			ENG: "the Villagers",
			SWE: "Byborna",
		},
		ROLE_VILLAGER_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Villagers'",
			SWE: "Bybornas",
		},
		ROLE_VILLAGER_PLURAL_GENITIVE: {
			ENG: "Villagers'",
			SWE: "Bybors",
		},
		ROLE_WEREWOLF: {
			ENG: "Werewolf",
			SWE: "Varulv",
		},
		ROLE_WEREWOLF_DEFINITE: {
			ENG: "the Werewolf",
			SWE: "Varulven",
		},
		ROLE_WEREWOLF_DEFINITE_GENITIVE: {
			ENG: "the Werewolf's",
			SWE: "Varulvens",
		},
		ROLE_WEREWOLF_GENITIVE: {
			ENG: "Werewolf's",
			SWE: "Varulvs",
		},
		ROLE_WEREWOLF_PLURAL: {
			ENG: "Werewolves",
			SWE: "Varulvar",
		},
		ROLE_WEREWOLF_PLURAL_DEFINITE: {
			ENG: "the Werewolves",
			SWE: "Varulvarna",
		},
		ROLE_WEREWOLF_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Werewolves'",
			SWE: "Varulvarnas",
		},
		ROLE_WEREWOLF_PLURAL_GENITIVE: {
			ENG: "Werewolves'",
			SWE: "Varulvars",
		},
		ROLE_WITCH: {
			ENG: "Witch",
			SWE: "Häxa",
		},
		ROLE_WITCH_DEFINITE: {
			ENG: "the Witch",
			SWE: "Häxan",
		},
		ROLE_WITCH_DEFINITE_GENITIVE: {
			ENG: "the Witch's",
			SWE: "Häxans",
		},
		ROLE_WITCH_GENITIVE: {
			ENG: "Witch's",
			SWE: "Häxas",
		},
		ROLE_WITCH_PLURAL: {
			ENG: "Witches",
			SWE: "Häxor",
		},
		ROLE_WITCH_PLURAL_DEFINITE: {
			ENG: "the Witches",
			SWE: "Häxorna",
		},
		ROLE_WITCH_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Witches'",
			SWE: "Häxornas",
		},
		ROLE_WITCH_PLURAL_GENITIVE: {
			ENG: "Witches'",
			SWE: "Häxors",
		},
		SPECIAL_ALL: {
			ENG: "All players",
			SWE: "Alla spelare",
		},
		SPECIAL_ALL_DEFINITE: {
			ENG: "All players",
			SWE: "Alla spelare",
		},
		SPECIAL_ALL_DEFINITE_GENITIVE: {
			ENG: "All players'",
			SWE: "Alla spelares",
		},
		SPECIAL_ALL_GENITIVE: {
			ENG: "All players'",
			SWE: "Alla spelares",
		},
		SPECIAL_ALL_PLURAL: {
			ENG: "All players",
			SWE: "Alla spelare",
		},
		SPECIAL_ALL_PLURAL_DEFINITE: {
			ENG: "All players",
			SWE: "Alla spelare",
		},
		SPECIAL_ALL_PLURAL_DEFINITE_GENITIVE: {
			ENG: "All players'",
			SWE: "Alla spelares",
		},
		SPECIAL_ALL_PLURAL_GENITIVE: {
			ENG: "All players'",
			SWE: "Alla spelares",
		},
		SPECIAL_LOVERS: {
			ENG: "Lovers",
			SWE: "Förälskade",
		},
		SPECIAL_LOVERS_DEFINITE: {
			ENG: "the Lovers",
			SWE: "de Förälskade",
		},
		SPECIAL_LOVERS_DEFINITE_GENITIVE: {
			ENG: "the Lovers'",
			SWE: "de Förälskades",
		},
		SPECIAL_LOVERS_GENITIVE: {
			ENG: "Lovers'",
			SWE: "Förälskades",
		},
		SPECIAL_LOVERS_PLURAL: {
			ENG: "Lovers",
			SWE: "Förälskade",
		},
		SPECIAL_LOVERS_PLURAL_DEFINITE: {
			ENG: "the Lovers",
			SWE: "de Förälskade",
		},
		SPECIAL_LOVERS_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Lovers'",
			SWE: "de Förälskades",
		},
		SPECIAL_LOVERS_PLURAL_GENITIVE: {
			ENG: "Lovers'",
			SWE: "Förälskades",
		},
		TEAM_ALIEN: {
			ENG: "Alien",
			SWE: "Utomjording",
		},
		TEAM_ALIEN_DEFINITE: {
			ENG: "the Aliens",
			SWE: "Utomjordingarna",
		},
		TEAM_ALIEN_DEFINITE_GENITIVE: {
			ENG: "the Aliens'",
			SWE: "Utomjordingarnas",
		},
		TEAM_ALIEN_GENITIVE: {
			ENG: "Alien's",
			SWE: "Utomjordings",
		},
		TEAM_ALIEN_PLURAL: {
			ENG: "Aliens",
			SWE: "Utomjordingar",
		},
		TEAM_ALIEN_PLURAL_DEFINITE: {
			ENG: "the Aliens",
			SWE: "Utomjordingarna",
		},
		TEAM_ALIEN_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Aliens'",
			SWE: "Utomjordingarnas",
		},
		TEAM_ALIEN_PLURAL_GENITIVE: {
			ENG: "Aliens'",
			SWE: "Utomjordingars",
		},
		TEAM_MINORITY: {
			ENG: "Other",
			SWE: "Övrig",
		},
		TEAM_MINORITY_DEFINITE: {
			ENG: "the Others",
			SWE: "De övriga",
		},
		TEAM_MINORITY_DEFINITE_GENITIVE: {
			ENG: "the Others'",
			SWE: "De övrigas",
		},
		TEAM_MINORITY_GENITIVE: {
			ENG: "Other's",
			SWE: "Övrigs",
		},
		TEAM_MINORITY_PLURAL: {
			ENG: "Others",
			SWE: "Övriga",
		},
		TEAM_MINORITY_PLURAL_DEFINITE: {
			ENG: "the Others",
			SWE: "De övriga",
		},
		TEAM_MINORITY_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Others'",
			SWE: "De övrigas",
		},
		TEAM_MINORITY_PLURAL_GENITIVE: {
			ENG: "Others'",
			SWE: "Övrigas",
		},
		TEAM_PREFIX: {
			ENG: "Team",
			SWE: "Lag",
		},
		TEAM_VAMPIRE: {
			ENG: "Vampire",
			SWE: "Vampyr",
		},
		TEAM_VAMPIRE_DEFINITE: {
			ENG: "the Vampires",
			SWE: "Vampyrerna",
		},
		TEAM_VAMPIRE_DEFINITE_GENITIVE: {
			ENG: "the Vampires'",
			SWE: "Vampyrernas",
		},
		TEAM_VAMPIRE_GENITIVE: {
			ENG: "Vampire's",
			SWE: "Vampyrs",
		},
		TEAM_VAMPIRE_PLURAL: {
			ENG: "Vampires",
			SWE: "Vampyrer",
		},
		TEAM_VAMPIRE_PLURAL_DEFINITE: {
			ENG: "the Vampires",
			SWE: "Vampyrerna",
		},
		TEAM_VAMPIRE_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Vampires'",
			SWE: "Vampyrernas",
		},
		TEAM_VAMPIRE_PLURAL_GENITIVE: {
			ENG: "Vampires'",
			SWE: "Vampyrers",
		},
		TEAM_VARIABLE_SUFFIX: {
			ENG: " (variable)",
			SWE: " (variabel)",
		},
		TEAM_VILLAGE: {
			ENG: "Villager",
			SWE: "Bybo",
		},
		TEAM_VILLAGE_DEFINITE: {
			ENG: "the Villagers",
			SWE: "Byborna",
		},
		TEAM_VILLAGE_DEFINITE_GENITIVE: {
			ENG: "the Villagers'",
			SWE: "Bybornas",
		},
		TEAM_VILLAGE_GENITIVE: {
			ENG: "Villager's",
			SWE: "Bybos",
		},
		TEAM_VILLAGE_PLURAL: {
			ENG: "Villagers",
			SWE: "Bybor",
		},
		TEAM_VILLAGE_PLURAL_DEFINITE: {
			ENG: "the Villagers",
			SWE: "Byborna",
		},
		TEAM_VILLAGE_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Villagers'",
			SWE: "Bybornas",
		},
		TEAM_VILLAGE_PLURAL_GENITIVE: {
			ENG: "Villagers'",
			SWE: "Bybors",
		},
		TEAM_WEREWOLF: {
			ENG: "Werewolf",
			SWE: "Varulv",
		},
		TEAM_WEREWOLF_DEFINITE: {
			ENG: "the Werewolves",
			SWE: "Varulvarna",
		},
		TEAM_WEREWOLF_DEFINITE_GENITIVE: {
			ENG: "the Werewolves'",
			SWE: "Varulvarnas",
		},
		TEAM_WEREWOLF_GENITIVE: {
			ENG: "Werewolf's",
			SWE: "Varulvs",
		},
		TEAM_WEREWOLF_PLURAL: {
			ENG: "Werewolves",
			SWE: "Varulvar",
		},
		TEAM_WEREWOLF_PLURAL_DEFINITE: {
			ENG: "the Werewolves",
			SWE: "Varulvarna",
		},
		TEAM_WEREWOLF_PLURAL_DEFINITE_GENITIVE: {
			ENG: "the Werewolves'",
			SWE: "Varulvarnas",
		},
		TEAM_WEREWOLF_PLURAL_GENITIVE: {
			ENG: "Werewolves'",
			SWE: "Varulvars",
		},
		TOKEN_ARTIFACT_ALIEN: {
			ENG: "{TEAM_ALIEN} artifact",
			SWE: "{TEAM_ALIEN_GENITIVE}artefakt",
		},
		TOKEN_ARTIFACT_BODYGUARD: {
			ENG: "Sword of the {ROLE_BODYGUARD}",
			SWE: "{ROLE_BODYGUARD_DEFINITE_GENITIVE} artefakt",
		},
		TOKEN_ARTIFACT_CLOAK: {
			ENG: "Cloak of Shame",
			SWE: "Pariaartefakt",
		},
		TOKEN_ARTIFACT_HUNTER: {
			ENG: "Rifle of the {ROLE_HUNTER}",
			SWE: "{ROLE_HUNTER_DEFINITE_GENITIVE} artefakt",
		},
		TOKEN_ARTIFACT_MUTED: {
			ENG: "Mask of Muting",
			SWE: "Tystadsartefakt",
		},
		TOKEN_ARTIFACT_PRINCE: {
			ENG: "Crown of the {ROLE_PRINCE}",
			SWE: "{ROLE_PRINCE_DEFINITE_GENITIVE} artefakt",
		},
		TOKEN_ARTIFACT_TANNER: {
			ENG: "Rack of the {ROLE_TANNER}",
			SWE: "{ROLE_TANNER_DEFINITE_GENITIVE} artefakt",
		},
		TOKEN_ARTIFACT_TRAITOR: {
			ENG: "Dagger of the Traitor",
			SWE: "Förrädarartefakt",
		},
		TOKEN_ARTIFACT_VAMPIRE: {
			ENG: "Bite of the {TEAM_VAMPIRE}",
			SWE: "{TEAM_VAMPIRE_GENITIVE}artefakt",
		},
		TOKEN_ARTIFACT_VILLAGER: {
			ENG: "Pitchfork of the Villager",
			SWE: "{ROLE_VILLAGER_DEFINITE_GENITIVE} artefakt",
		},
		TOKEN_ARTIFACT_VOID: {
			ENG: "Void",
			SWE: "Nullartefakt",
		},
		TOKEN_ARTIFACT_WEREWOLF: {
			ENG: "Claw of the {TEAM_WEREWOLF}",
			SWE: "{TEAM_WEREWOLF_GENITIVE}artefakt",
		},
		TOKEN_MARK_ASSASSIN: {
			ENG: "Mark of the {ROLE_ASSASSIN}",
			SWE: "{ROLE_ASSASSIN_DEFINITE_GENITIVE} märke",
		},
		TOKEN_MARK_CLARITY: {
			ENG: "Mark of Clarity",
			SWE: "Rent märke",
		},
		TOKEN_MARK_COUNT: {
			ENG: "Mark of Fear",
			SWE: "{ROLE_COUNT_DEFINITE_GENITIVE} märke",
		},
		TOKEN_MARK_CUPID: {
			ENG: "Mark of Love",
			SWE: "{ROLE_CUPID_DEFINITE_GENITIVE} märke",
		},
		TOKEN_MARK_DISEASED: {
			ENG: "Mark of {ROLE_DISEASED_DEFINITE}",
			SWE: "{ROLE_DISEASED_DEFINITE_GENITIVE} märke",
		},
		TOKEN_MARK_INSTIGATOR: {
			ENG: "Dagger of the Traitor",
			SWE: "{ROLE_INSTIGATOR_DEFINITE_GENITIVE} märke",
		},
		TOKEN_MARK_RENFIELD: {
			ENG: "Mark of {ROLE_RENFIELD}",
			SWE: "{ROLE_RENFIELD_DEFINITE_GENITIVE} märke",
		},
		TOKEN_MARK_VAMPIRE: {
			ENG: "Bite of the {TEAM_VAMPIRE}",
			SWE: "{TEAM_VAMPIRE_PLURAL_DEFINITE_GENITIVE} märke",
		},
		TOKEN_SHIELD: {
			ENG: "Shield token",
			SWE: "Sköldbricka",
		},
		UI_ABILITY_ALIEN: {
			ENG: "Wakes up with all {TEAM_ALIEN_PLURAL} and identifies the other {TEAM_ALIEN_PLURAL}. May also collectively view one or more cards at random.",
			SWE: "Vaknar tillsammans med alla {TEAM_ALIEN_PLURAL} och identifierar andra {TEAM_ALIEN_PLURAL}. Kan också kollektivt få titta på ett eller fler kort slumpmässigt.",
		},
		UI_ABILITY_ALPHAWOLF: {
			ENG: "Wakes up first with all {TEAM_WEREWOLF_PLURAL}. Then wakes up alone and swaps a non-{TEAM_WEREWOLF_PLURAL} player's card with the unused {TEAM_WEREWOLF} card in the center. If {ROLE_ALPHAWOLF_DEFINITE} is used, an additional {TEAM_WEREWOLF} card is placed in the center, rotated 90 degrees.",
			SWE: "Vaknar först tillsammans med alla {TEAM_WEREWOLF_PLURAL}. Vaknar sedan ensam och byter en icke-{TEAM_WEREWOLF_GENITIVE}spelares kort med det oanvända {TEAM_WEREWOLF_GENITIVE}kortet i mitten. Om {ROLE_ALPHAWOLF_DEFINITE} används placeras ytterligare ett {TEAM_WEREWOLF_GENITIVE}kort i mitten, roterat 90 grader.",
		},
		UI_ABILITY_APPRENTICEASSASSIN: {
			ENG: "Wakes up at the same time as {ROLE_ASSASSIN_DEFINITE} after the {TOKEN_MARK_ASSASSIN} has been placed so they can identify each other. If no {ROLE_ASSASSIN} is in play, {ROLE_APPRENTICEASSASSIN_DEFINITE} performs that action instead.",
			SWE: "Vaknar samtidigt som {ROLE_ASSASSIN_DEFINITE} efter att {TOKEN_MARK_ASSASSIN} placerats ut så att de kan identifiera varandra. Om ingen {ROLE_ASSASSIN} är i spel så utför {ROLE_APPRENTICEASSASSIN_DEFINITE} den handlingen istället.",
		},
		UI_ABILITY_APPRENTICESEER: {
			ENG: "Wakes up and may look at one of the center cards.",
			SWE: "Vaknar och får se på ett av mittenkorten.",
		},
		UI_ABILITY_APPRENTICETANNER: {
			ENG: "Wakes up and sees who {ROLE_TANNER_DEFINITE} is.",
			SWE: "Vaknar och får se vem {ROLE_TANNER_DEFINITE} är.",
		},
		UI_ABILITY_ARTIFACT_ALIEN: {
			ENG: "The player is now an {TEAM_ALIEN}, regardless of previous role.",
			SWE: "Spelaren är nu en {TEAM_ALIEN}, oberoende av tidigare roll.",
		},
		UI_ABILITY_ARTIFACT_BODYGUARD: {
			ENG: "The player is now a {ROLE_BODYGUARD}, regardless of previous role.",
			SWE: "Spelaren är nu en {ROLE_BODYGUARD}, oberoende av tidigare roll.",
		},
		UI_ABILITY_ARTIFACT_CLOAK: {
			ENG: "The player must turn away from all other players.",
			SWE: "Spelaren måste vända sig bort.",
		},
		UI_ABILITY_ARTIFACT_HUNTER: {
			ENG: "The player is now a {ROLE_HUNTER}, regardless of previous role.",
			SWE: "Spelaren är nu en {ROLE_HUNTER}, oberoende av tidigare roll.",
		},
		UI_ABILITY_ARTIFACT_MUTED: {
			ENG: "The player may not speak during the day.",
			SWE: "Spelaren får inte prata under dagen.",
		},
		UI_ABILITY_ARTIFACT_PRINCE: {
			ENG: "The player is now a {ROLE_PRINCE}, regardless of previous role.",
			SWE: "Spelaren är nu en {ROLE_PRINCE}, oberoende av tidigare roll.",
		},
		UI_ABILITY_ARTIFACT_TANNER: {
			ENG: "The player is now a {ROLE_TANNER}, regardless of previous role.",
			SWE: "Spelaren är nu en {ROLE_TANNER}, oberoende av tidigare roll.",
		},
		UI_ABILITY_ARTIFACT_TRAITOR: {
			ENG: "The player is now a traitor and will only win if their team loses.",
			SWE: "Spelaren är nu en förrädare och vinner endast om deras lag förlorar.",
		},
		UI_ABILITY_ARTIFACT_VAMPIRE: {
			ENG: "The player is now a {TEAM_VAMPIRE}, regardless of previous role.",
			SWE: "Spelaren är nu en {TEAM_VAMPIRE}, oberoende av tidigare roll.",
		},
		UI_ABILITY_ARTIFACT_VILLAGER: {
			ENG: "The player is now a {ROLE_VILLAGER}, regardless of previous role.",
			SWE: "Spelaren är nu en {ROLE_VILLAGER}, oberoende av tidigare roll.",
		},
		UI_ABILITY_ARTIFACT_VOID: {
			ENG: "No effect is imparted on the player.",
			SWE: "Artefakten har ingen effekt.",
		},
		UI_ABILITY_ARTIFACT_WEREWOLF: {
			ENG: "The player is now a {TEAM_WEREWOLF}, regardless of previous role.",
			SWE: "Spelaren är nu en {TEAM_WEREWOLF}, oberoende av tidigare roll.",
		},
		UI_ABILITY_ASSASSIN: {
			ENG: "Wakes up and selects a target by placing the {TOKEN_MARK_ASSASSIN} in front of a player.",
			SWE: "Vaknar och väljer en måltavla genom att placera {TOKEN_MARK_ASSASSIN} framför spelaren.",
		},
		UI_ABILITY_AURASEER: {
			ENG: "Wakes up and sees which players have looked at or moved a card during the night.",
			SWE: "Vaknar och får se vilka spelare som har tittat på eller flyttat ett kort under natten.",
		},
		UI_ABILITY_BEHOLDER: {
			ENG: "Wakes up and sees who {ROLE_SEER_DEFINITE} and {ROLE_APPRENTICESEER_DEFINITE} are. May then check their cards to see if they were moved during the night.",
			SWE: "Vaknar och får se vem {ROLE_SEER_DEFINITE} och {ROLE_APPRENTICESEER_DEFINITE} är. Kan sedan kontrollera deras kort för att se om korten har flyttats under natten.",
		},
		UI_ABILITY_BLOB: {
			ENG: "Does not wake up. At the start of the day, it is announced which nearby players (0–4) {ROLE_BLOB_DEFINITE} must protect.",
			SWE: "Vaknar inte. I början av dagen annonseras vilka av de närmaste grannarna (0–4 st) som {ROLE_BLOB_DEFINITE} måste skydda.",
		},
		UI_ABILITY_BODYGUARD: {
			ENG: "The player voted for by {ROLE_BODYGUARD_DEFINITE} cannot be eliminated. The player with the second-highest votes is eliminated instead.",
			SWE: "Spelaren som {ROLE_BODYGUARD_DEFINITE} röstar på kan inte röstas ut. Spelaren med näst högst antal röster blir istället utröstad.",
		},
		UI_ABILITY_BODYSNATCHER: {
			ENG: "Wakes up and may choose to swap another player's card with their own, then look at their new card. Both {ROLE_BODYSNATCHER_DEFINITE} and the other card become a member of {TEAM_ALIEN_PLURAL_DEFINITE}.",
			SWE: "Vaknar och kan välja att byta en annan spelares kort mot sitt eget och sedan titta på sitt nya kort. Både {ROLE_BODYSNATCHER_DEFINITE} och det andra kortet är en {TEAM_ALIEN}.",
		},
		UI_ABILITY_COPYCAT: {
			ENG: "Wakes up and looks at one of the center cards. {ROLE_COPYCAT_DEFINITE} copies that role and team. The copied role and team follows the card if it is moved during the night. {ROLE_COPYCAT_DEFINITE} later wakes and performs that role's action.",
			SWE: "Vaknar och tittar på ett av korten i mitten. {ROLE_COPYCAT_DEFINITE} kopierar den rollen och lagtillhörigheten. Roll/lag följer med kortet om det flyttas till en annan spelare under natten. {ROLE_COPYCAT_DEFINITE} vaknar senare under natten och utför den kopierade rollens aktivitet när den rollen ropas upp.",
		},
		UI_ABILITY_COUNT: {
			ENG: "Wakes up with all {TEAM_VAMPIRE_PLURAL}. Then wakes alone and places the {TOKEN_MARK_COUNT} on a non-{TEAM_VAMPIRE} player. That player may not wake or perform any action during the night.",
			SWE: "Vaknar tillsammans med alla {TEAM_VAMPIRE_PLURAL}. Vaknar sedan ensam och placerar {TOKEN_MARK_COUNT} framför en annan icke-{TEAM_VAMPIRE} spelare. Spelaren med märket får inte vakna eller utföra sin handling under natten.",
		},
		UI_ABILITY_COW: {
			ENG: "Holds out a hand without waking. If one or more {TEAM_ALIEN_PLURAL} are adjacent to {ROLE_COW_DEFINITE}, they must touch {ROLE_COW_DEFINITE}'s hand.",
			SWE: "Sträcker ut en hand utan att vakna. Om en eller flera {TEAM_ALIEN_PLURAL} sitter bredvid {ROLE_COW_DEFINITE} måste de röra vid {ROLE_COW_DEFINITE_GENITIVE} hand.",
		},
		UI_ABILITY_CUPID: {
			ENG: "Wakes up and places the {TOKEN_MARK_CUPID} on two players. Those players wake together and identify each other. If one is eliminated, the other is also eliminated.",
			SWE: "Vaknar och placerar {TOKEN_MARK_CUPID} framför två spelare. Spelarna med märket vaknar tillsammans och identifierar varandra. Om en av dem röstas ut så röstas även den andra ut.",
		},
		UI_ABILITY_CURATOR: {
			ENG: "Wakes up and places a random artifact token in front of a player, including {ROLE_CURATOR_DEFINITE}. At the start of the day, that player may look at it. If it causes a role change, it overrides the player's card for ability and team.",
			SWE: "Vaknar och placerar en slumpmässig artefakt framför en valfri spelare, inklusive {ROLE_CURATOR_DEFINITE} själv. I början av dagen får spelaren titta på artefakten för att se vilken effekt den har. Om artefakten innebär ett rollbyte så tar den prioritet över spelarens kort vad gäller förmåga och lagtillhörighet.",
		},
		UI_ABILITY_CURSED: {
			ENG: "If at least one {TEAM_WEREWOLF}, {TEAM_VAMPIRE}, or {TEAM_ALIEN} votes for {ROLE_CURSED_DEFINITE}, it changes to that team.",
			SWE: "Om minst en {TEAM_WEREWOLF}, {TEAM_VAMPIRE} eller {TEAM_ALIEN} röstar på {ROLE_CURSED_DEFINITE} så byter den lagtillhörighet till laget i fråga.",
		},
		UI_ABILITY_DISEASED: {
			ENG: "Wakes up and places the {TOKEN_MARK_DISEASED} on a neighbor. Any player who votes for {ROLE_DISEASED_DEFINITE} or a marked player automatically loses, even if their team wins.",
			SWE: "Vaknar och placerar {TOKEN_MARK_DISEASED} framför en av sina grannar. En spelare som röstar på {ROLE_DISEASED_DEFINITE} eller på en spelare med märket förlorar automatiskt även om deras lag vinner.",
		},
		UI_ABILITY_DOPPELGANGER: {
			ENG: "Wakes up and looks at another player's card. {ROLE_DOPPELGANGER_DEFINITE} copies that role and team. The copied role and team follows the card if it is moved during the night. {ROLE_DOPPELGANGER_DEFINITE} later wakes and performs that role's action.",
			SWE: "Vaknar och tittar på en annan spelares kort. {ROLE_DOPPELGANGER_DEFINITE} kopierar den rollen och lagtillhörigheten. Roll/lag följer med kortet om det flyttas till en annan spelare under natten. {ROLE_DOPPELGANGER_DEFINITE} blir sedan ombedd att vakna senare under natten och utför den kopierade rollens aktivitet.",
		},
		UI_ABILITY_DREAMWOLF: {
			ENG: "Shows a thumb instead of waking with {TEAM_WEREWOLF_PLURAL} so they can identify {ROLE_DREAMWOLF_DEFINITE}.",
			SWE: "Sticker ut tummen istället för att vakna tillsammans med {TEAM_WEREWOLF_PLURAL} så att de kan se vem {ROLE_DREAMWOLF_DEFINITE} är.",
		},
		UI_ABILITY_DRUNK: {
			ENG: "Wakes up and swaps their card with a center card without looking at it.",
			SWE: "Vaknar och byter sitt eget kort mot ett av de oanvända korten i mitten utan att titta på det nya kortet.",
		},
		UI_ABILITY_EMPATH: {
			ENG: "Wakes up and observes players perform a random action without waking them.",
			SWE: "Vaknar och får iaktta spelare utföra en slumpmässig handling utan att själv vakna.",
		},
		UI_ABILITY_EXPOSER: {
			ENG: "Wakes up and may flip 1–3 center cards face up, chosen randomly.",
			SWE: "Vaknar och får vända 1-3 av mittenkorten ansiktet upp, antal bestäms slumpmässigt.",
		},
		UI_ABILITY_FEUDINGALIENS: {
			ENG: "Wakes up with all {TEAM_ALIEN_PLURAL}, then wakes together and identifies each other.",
			SWE: "Vaknar tillsammans med alla {TEAM_ALIEN_PLURAL}. Vaknar sedan tillsammans och identifierar varandra.",
		},
		UI_ABILITY_GREMLIN: {
			ENG: "Wakes up and swaps either two players' marks or two players' cards, but not both.",
			SWE: "Vaknar och byter antingen plats på två andra spelares markörer eller kort, inte båda.",
		},
		UI_ABILITY_HUNTER: {
			ENG: "If {ROLE_HUNTER_DEFINITE} is eliminated, the player they voted for is also eliminated.",
			SWE: "Om {ROLE_HUNTER_DEFINITE} blir utröstad kommer även spelaren som {ROLE_HUNTER_DEFINITE} röstade på att bli utröstad.",
		},
		UI_ABILITY_INSOMNIAC: {
			ENG: "Wakes last and looks at their own card.",
			SWE: "Vaknar sist och tittar på sitt eget kort.",
		},
		UI_ABILITY_INSTIGATOR: {
			ENG: "Wakes up and gives a {TOKEN_MARK_INSTIGATOR} to a player. That player wins only if someone on their own team is eliminated.",
			SWE: "Vaknar och ger en {TOKEN_MARK_INSTIGATOR} till en spelare. Spelaren med markören vinner endast om en spelare i dennes egna lag röstas ut.",
		},
		UI_ABILITY_LEADER: {
			ENG: "Wakes up and sees which players are {TEAM_ALIEN_PLURAL}. Also sees which of them are {ROLE_FEUDINGALIENS_DEFINITE}. If all {TEAM_ALIEN_DEFINITE} point at {ROLE_LEADER_DEFINITE}, they win regardless of outcome.",
			SWE: "Vaknar och får veta vilka spelare som är {TEAM_ALIEN_PLURAL}. Får även veta vilka av {TEAM_ALIEN_DEFINITE} som är {ROLE_FEUDINGALIENS_DEFINITE}. Om alla {TEAM_ALIEN_DEFINITE} pekar på {ROLE_LEADER_DEFINITE} så vinner de oavsett vad som händer i övrigt.",
		},
		UI_ABILITY_MARKSMAN: {
			ENG: "Wakes up and looks at one player's card and another player's mark. They must be different players.",
			SWE: "Vaknar och får se på en annan spelares kort, och på en annan spelares markör. Det får inte vara samma spelare för båda.",
		},
		UI_ABILITY_MARK_ASSASSIN: {
			ENG: "The player is the target of {ROLE_ASSASSIN_DEFINITE}, who will only win if the player is eliminated.",
			SWE: "Spelaren är målet för {ROLE_ASSASSIN_DEFINITE}, som endast vinner om märkets ägare röstas ut.",
		},
		UI_ABILITY_MARK_CLARITY: {
			ENG: "The {TOKEN_MARK_CLARITY} has no effect, and is given to each player at the start of the game.",
			SWE: "Märket har ingen effekt, och delas ut till samtliga spelare vid spelets början.",
		},
		UI_ABILITY_MARK_COUNT: {
			ENG: "The player may not wake up during the night to perform their action.",
			SWE: "Spelaren får inte vakna under natten för att utföra sin handling.",
		},
		UI_ABILITY_MARK_CUPID: {
			ENG: "The players who receive the mark are linked to each other. If one is eliminated, all are eliminated. The players will wake to identify each other.",
			SWE: "Spelarna som mottar märket är bundna till varandra. Röstas en ut så röstas även de andra ut. Spelarna vaknar för att identifiera varandra.",
		},
		UI_ABILITY_MARK_DISEASED: {
			ENG: "Any player who votes for the recipient of the {TOKEN_MARK_DISEASED} will be unable to win, regardless of their win condition.",
			SWE: "Spelare som röstar på märkets mottagare kan inte vinna, oavsett deras vinstvillkor.",
		},
		UI_ABILITY_MARK_INSTIGATOR: {
			ENG: "The player is now a traitor and will only win if their team loses.",
			SWE: "Spelaren är nu en förrädare och vinner endast om deras lag förlorar.",
		},
		UI_ABILITY_MARK_RENFIELD: {
			ENG: "The mark has no effect and is used only by {ROLE_RENFIELD} to reset any mark given.",
			SWE: "Märket har ingen effekt och används endast av {ROLE_RENFIELD} för att ersätta andra märken.",
		},
		UI_ABILITY_MARK_VAMPIRE: {
			ENG: "The player is now a {TEAM_VAMPIRE}, regardless of previous role.",
			SWE: "Spelaren är nu en {TEAM_VAMPIRE}, oberoende av tidigare roll.",
		},
		UI_ABILITY_MASON: {
			ENG: "Wakes up with the other {ROLE_MASON_DEFINITE} and identifies each other.",
			SWE: "Vaknar tillsammans med den andra {ROLE_MASON_DEFINITE} och identifierar varandra.",
		},
		UI_ABILITY_MASTER: {
			ENG: "Wakes up with all {TEAM_VAMPIRE_PLURAL}. Becomes immune to elimination if at least one other {TEAM_VAMPIRE} votes for {ROLE_MASTER_DEFINITE}.",
			SWE: "Vaknar tillsammans med alla {TEAM_VAMPIRE_PLURAL}. Om minst en annan {TEAM_VAMPIRE} röstar på {ROLE_MASTER_DEFINITE} så blir han immun mot att röstas ut.",
		},
		UI_ABILITY_MINION: {
			ENG: "Wakes up and sees which players are {TEAM_WEREWOLF}.",
			SWE: "Vaknar och får se vilka spelare som är en {TEAM_WEREWOLF}.",
		},
		UI_ABILITY_MORTICIAN: {
			ENG: "Wakes up and looks at one or both neighbors' cards or their own, chosen randomly.",
			SWE: "Vaknar och får se på en eller båda sina grannars, eller sitt eget, kort. Bestäms slumpmässigt.",
		},
		UI_ABILITY_MYSTICWOLF: {
			ENG: "Wakes with all {TEAM_WEREWOLF_PLURAL}, then wakes alone to view another player's card.",
			SWE: "Vaknar först tillsammans med alla {TEAM_WEREWOLF_PLURAL}. Vaknar sedan ensam och tittar på en annan spelares kort.",
		},
		UI_ABILITY_NOSTRADAMUS: {
			ENG: "Wakes up and may look at up to three players' cards. If any are not {TEAM_VILLAGE_DEFINITE}, no more cards may be viewed and {ROLE_NOSTRADAMUS_DEFINITE} adopts that team. This follows the card if moved. The new team is announced.",
			SWE: "Vaknar och väljer att titta på upp till tre spelares kort. Om ett av korten inte tillhör {TEAM_VILLAGE_DEFINITE} får inga fler kort inspekteras, och {ROLE_NOSTRADAMUS_DEFINITE_GENITIVE} kort kopierar den lagtillhörigheten. Lagtillhörighet följer med kortet om det flyttas till en annan spelare under natten. Den nya lagtillhörigheten läses upp för alla.",
		},
		UI_ABILITY_ORACLE: {
			ENG: "Wakes up and performs a random predefined action that is read aloud.",
			SWE: "Vaknar och utför en slumpmässigt bestämd handling som läses upp.",
		},
		UI_ABILITY_PARANORMALINVESTIGATOR: {
			ENG: "Wakes up and may look at up to two players' cards. If any are not {TEAM_VILLAGE_DEFINITE}, no more cards may be viewed and {ROLE_PARANORMALINVESTIGATOR_DEFINITE} adopts that team.",
			SWE: "Vaknar och väljer att titta på upp till två spelares kort. Om ett av korten inte tillhör {TEAM_VILLAGE_DEFINITE} får inga fler kort inspekteras, och {ROLE_PARANORMALINVESTIGATOR_DEFINITE_GENITIVE} kort kopierar den lagtillhörigheten. Lagtillhörighet följer med kortet om det flyttas till en annan spelare under natten.",
		},
		UI_ABILITY_PICKPOCKET: {
			ENG: "Wakes up and may swap a player's mark with their own, then view their new mark.",
			SWE: "Vaknar och kan välja att byta en annan spelares markör mot sitt egna och sedan titta på sin nya markör.",
		},
		UI_ABILITY_PREFIX: {
			ENG: "Ability/Action",
			SWE: "Förmåga/aktivitet",
		},
		UI_ABILITY_PRIEST: {
			ENG: "Wakes up and replaces their own and optionally another player's marks with the {TOKEN_MARK_CLARITY}.",
			SWE: "Vaknar och byter ut sin egen och, om så önskas, en annan spelares markörer mot ett {TOKEN_MARK_CLARITY}.",
		},
		UI_ABILITY_PRINCE: {
			ENG: "Cannot be eliminated. The player with the second-highest votes is eliminated instead.",
			SWE: "Kan inte röstas ut. Spelaren med näst högst antal röster blir istället utröstad.",
		},
		UI_ABILITY_PSYCHIC: {
			ENG: "Wakes up and may look at another player's card with random restrictions.",
			SWE: "Vaknar och får se på en annan spelares kort med slumpmässiga restriktioner.",
		},
		UI_ABILITY_RASCAL: {
			ENG: "Wakes up and performs a random action from {ROLE_TROUBLEMAKER_DEFINITE}, {ROLE_ROBBER_DEFINITE}, {ROLE_WITCH_DEFINITE}, {ROLE_VILLAGEIDIOT_DEFINITE}, or {ROLE_DRUNK_DEFINITE}.",
			SWE: "Vaknar och utför slumpmässigt samma handling som {ROLE_TROUBLEMAKER_DEFINITE}, {ROLE_ROBBER_DEFINITE}, {ROLE_WITCH_DEFINITE}, {ROLE_VILLAGEIDIOT_DEFINITE} eller {ROLE_DRUNK_DEFINITE}.",
		},
		UI_ABILITY_RENFIELD: {
			ENG: "Wakes up and replaces their mark with {TOKEN_MARK_RENFIELD}. Sees all {TEAM_VAMPIRE_PLURAL} and which player received a {TOKEN_MARK_VAMPIRE}.",
			SWE: "Vaknar och ersätter sin egen markör med {TOKEN_MARK_RENFIELD}. Får se vilka spelare som är {TEAM_VAMPIRE}, samt vilken spelare de har gett en {TOKEN_MARK_VAMPIRE} till.",
		},
		UI_ABILITY_REVEALER: {
			ENG: "Wakes up and turns another player's card face up. If not {TEAM_VILLAGE_DEFINITE}, it is turned back down.",
			SWE: "Vaknar och vänder en annan spelares kort ansiktet upp. Om kortet inte tillhör {TEAM_VILLAGE_DEFINITE} så vänds kortet tillbaka med ansiktet ner.",
		},
		UI_ABILITY_ROBBER: {
			ENG: "Wakes up and may swap cards with another player, then look at the new card. Does not wake again.",
			SWE: "Vaknar och kan välja att byta en annan spelares kort mot sitt eget och sedan titta på sitt nya kort. Vaknar inte fler gånger under natten.",
		},
		UI_ABILITY_SEER: {
			ENG: "Wakes up and may look at another player's card or two center cards.",
			SWE: "Vaknar och får välja att se på en annan spelares kort, eller två av de oanvända korten i mitten.",
		},
		UI_ABILITY_SENTINEL: {
			ENG: "Wakes up and places a {TOKEN_SHIELD} on another player's card. That card cannot be moved or viewed.",
			SWE: "Vaknar och placerar en {TOKEN_SHIELD} på en annan spelares kort. Kortet får inte flyttas eller tittas på av andra spelare under natten.",
		},
		UI_ABILITY_SHIELD: {
			ENG: "A {TOKEN_SHIELD} placed on a player card forbids any player from interacting with the card, including the owner of the card.",
			SWE: "En {TOKEN_SHIELD} placerad på ett kort förbjuder samtliga spelare, även kortets ägare, från att flytta eller titta på kortet.",
		},
		UI_ABILITY_SQUIRE: {
			ENG: "Wakes up and sees which players are {TEAM_WEREWOLF}. Also checks if their cards were moved.",
			SWE: "Vaknar och får se vilka spelare som är en {TEAM_WEREWOLF}. Får även se på de spelarnas kort för att se om de har flyttats under natten. ",
		},
		UI_ABILITY_SYNTHETICALIEN: {
			ENG: "Wakes with all {TEAM_ALIEN_PLURAL} and identifies them. May also collectively view random cards.",
			SWE: "Vaknar tillsammans med alla {TEAM_ALIEN_PLURAL} och identifierar andra {TEAM_ALIEN_PLURAL}. Kan också kollektivt få se på ett eller fler kort slumpmässigt.",
		},
		UI_ABILITY_TANNER: {
			ENG: "If {ROLE_TANNER_DEFINITE} is eliminated, {TEAM_WEREWOLF_DEFINITE}, {TEAM_VAMPIRE_DEFINITE}, and {TEAM_ALIEN_DEFINITE} lose.",
			SWE: "Om {ROLE_TANNER_DEFINITE} blir utröstad förlorar {TEAM_WEREWOLF_DEFINITE}, {TEAM_VAMPIRE_DEFINITE} och {TEAM_ALIEN_DEFINITE}.",
		},
		UI_ABILITY_THING: {
			ENG: "Wakes up and touches one of their adjacent players.",
			SWE: "Vaknar och rör vid en av sina direkta grannar.",
		},
		UI_ABILITY_TROUBLEMAKER: {
			ENG: "Wakes up and swaps two other players' cards without looking.",
			SWE: "Vaknar och byter plats på två andra spelares kort utan att titta på korten.",
		},
		UI_ABILITY_VAMPIRE: {
			ENG: "Wakes with all {TEAM_VAMPIRE_PLURAL} and identifies them. Collectively choose a player to give the {TOKEN_MARK_VAMPIRE}.",
			SWE: "Vaknar tillsammans med alla {TEAM_VAMPIRE_PLURAL} och identifierar andra {TEAM_VAMPIRE_PLURAL}. Väljer kollektivt att placera {TOKEN_MARK_VAMPIRE} framför en annan spelare, vilket gör spelaren till en vampyr.",
		},
		UI_ABILITY_VILLAGEIDIOT: {
			ENG: "Wakes up and may shift all other players' cards left, right, or not at all.",
			SWE: "Vaknar och väljer att skifta alla andra spelares kort ett steg till höger, vänster, eller inte alls.",
		},
		UI_ABILITY_VILLAGER: {
			ENG: "None.",
			SWE: "Ingen.",
		},
		UI_ABILITY_WEREWOLF: {
			ENG: "Wakes up with all {TEAM_WEREWOLF_PLURAL} and identifies them. If alone, may view one center card.",
			SWE: "Vaknar tillsammans med alla {TEAM_WEREWOLF_PLURAL} och identifierar andra {TEAM_WEREWOLF_PLURAL}. Får titta på ett av de oanvända korten i mitten om ensam {TEAM_WEREWOLF}.",
		},
		UI_ABILITY_WITCH: {
			ENG: "Wakes up and may look at a center card. If they do, they must give it to themselves or another player.",
			SWE: "Vaknar och väljer om de vill titta på ett av de oanvända korten i mitten. Om ett kort inspekteras måste kortet bytas mot sitt eget eller någon annan spelares kort.",
		},
		UI_DAYTIMER_PAUSE: {
			ENG: "Pause",
			SWE: "Pausa",
		},
		UI_DAYTIMER_START: {
			ENG: "Start",
			SWE: "Start",
		},
		UI_DAYTIMER_STOP: {
			ENG: "Stop",
			SWE: "Stopp",
		},
		UI_EVEN: {
			ENG: "even",
			SWE: "jämnt"
		},
		UI_FILTER_COMPLEXITY: {
			ENG: "Difficulty",
			SWE: "Svårighet",
		},
		UI_FILTER_COMPLEXITY_EASY: {
			ENG: "Easy",
			SWE: "Enkel",
		},
		UI_FILTER_COMPLEXITY_HARD: {
			ENG: "Hard",
			SWE: "Svår",
		},
		UI_FILTER_COMPLEXITY_MEDIUM: {
			ENG: "Medium",
			SWE: "Medel",
		},
		UI_FILTER_RULESET: {
			ENG: "Ruleset",
			SWE: "Regelverk",
		},
		UI_FILTER_RULESET_ADVANCED: {
			ENG: "Advanced",
			SWE: "Utökad",
		},
		UI_FILTER_RULESET_ALIEN: {
			ENG: "Aliens",
			SWE: "Utomjordingar",
		},
		UI_FILTER_RULESET_BASIC: {
			ENG: "Basic",
			SWE: "Grund",
		},
		UI_FILTER_RULESET_VAMPIRE: {
			ENG: "Vampires",
			SWE: "Vampyrer",
		},
		UI_GAMERULES: {
			ENG: "Game Rules",
			SWE: "Spelregler",
		},
		UI_GENERATED_PROMPT: {
			ENG: "Game Prompt",
			SWE: "Spelprompt",
		},
		UI_NO: {
			ENG: "No",
			SWE: "Nej",
		},
		UI_NUM_10: {
			COMMON: "10",
		},
		UI_NUM_1: {
			COMMON: "1",
		},
		UI_NUM_2: {
			COMMON: "2",
		},
		UI_NUM_3: {
			COMMON: "3",
		},
		UI_NUM_4: {
			COMMON: "4",
		},
		UI_NUM_5: {
			COMMON: "5",
		},
		UI_NUM_6: {
			COMMON: "6",
		},
		UI_NUM_7: {
			COMMON: "7",
		},
		UI_NUM_8: {
			COMMON: "8",
		},
		UI_NUM_9: {
			COMMON: "9",
		},
		UI_ODD: {
			ENG: "odd",
			SWE: "udda"
		},
		UI_PLAYER_COUNT: {
			ENG: "Number of players:",
			SWE: "Antal spelare:",
		},
		UI_PRINT: {
			ENG: "Print",
			SWE: "Skriv ut",
		},
		UI_PROMPT_ERROR_INSUFFICIENT_PLAYERS: {
			ENG: "Prompt cannot be generated: too few roles selected.",
			SWE: "Prompt kan inte skapas: för få roller är valda.",
		},
		UI_PROMPT_ERROR_INVALID_SETTINGS: {
			ENG: "Prompt cannot be generated: check settings.",
			SWE: "Prompt kan inte skapas: kontrollera inställningar.",
		},
		UI_PROMPT_SINGLETURN: {
			ENG: "Split",
			SWE: "Dela",
		},
		UI_RERANDOMIZE: {
			ENG: "Rerandomize",
			SWE: "Slumpa om",
		},
		UI_RESET: {
			ENG: "Reset",
			SWE: "Nollställ",
		},
		UI_ROLEDESCRIPTIONS: {
			ENG: "Role Descriptions",
			SWE: "Rollbeskrivningar",
		},
		UI_ROLESELECTION: {
			ENG: "Select Roles",
			SWE: "Välj roller",
		},
		UI_SEARCH: {
			ENG: "Search",
			SWE: "Sök",
		},
		UI_SEARCH_PLACEHOLDER: {
			ENG: "Filter roles...",
			SWE: "Filtrera roll...",
		},
		UI_SETTING: {
			ENG: "Settings",
			SWE: "Inställningar",
		},
		UI_SETTING_ALIENS_MAKE_ALIEN: {
			ENG: "Turn another player into a {TEAM_ALIEN}",
			SWE: "Gör en annan spelare till en {TEAM_ALIEN}",
		},
		UI_SETTING_ALIENS_MAKE_MINION: {
			ENG: "Turn another player into a minion",
			SWE: "Gör en annan spelare till en medhjälpare",
		},
		UI_SETTING_ALIENS_NOTHING: {
			ENG: "No action",
			SWE: "Ingen handling",
		},
		UI_SETTING_ALIENS_SHOW_CARDS: {
			ENG: "Show their cards to other {TEAM_ALIEN_DEFINITE}",
			SWE: "Visa sina kort för andra {TEAM_ALIEN_DEFINITE}",
		},
		UI_SETTING_ALIENS_TRADE_CARDS: {
			ENG: "Swap cards with other {TEAM_ALIEN_DEFINITE}",
			SWE: "Byt kort med andra {TEAM_ALIEN_DEFINITE}",
		},
		UI_SETTING_ALIENS_VIEW_CARD_COLLECTIVE: {
			ENG: "View cards collectively",
			SWE: "Titta på kort gemensamt",
		},
		UI_SETTING_ALIENS_VIEW_CARD_INDIVIDUAL: {
			ENG: "View cards individually",
			SWE: "Titta på kort individuellt",
		},
		UI_SETTING_BODYSNATCHER_FAKE_ACTION: {
			ENG: "Chance to only pretend to perform the action.",
			SWE: "Sannolikhet att enbart få låtsas utföra handlingen.",
		},
		UI_SETTING_ERROR_WEIGHTGROUP_ORACLE_RIPPLE: {
			ENG: "The total weight of the group must be greater than 0. At least one {TEAM_ALIEN} must be selected for the force ripple weight to count.",
			SWE: "Viktgruppens sammanlagda vikt måste vara större än 0. Minst en {TEAM_ALIEN} måste vara närvarande för att vikten för att tvinga en krusning ska räknas",
		},
		UI_SETTING_ERROR_WEIGHTGROUP_ORACLE_TEAM: {
			ENG: "The total weight of the group must be greater than 0. At least one {TEAM_WEREWOLF}, {TEAM_ALIEN} or {TEAM_VAMPIRE} must be selected for the switch team weight to count.",
			SWE: "Viktgruppens sammanlagda vikt måste vara större än 0. Minst en {TEAM_WEREWOLF}, {TEAM_ALIEN} eller {TEAM_VAMPIRE} måste vara närvarande för att vikten för byte av lag ska räknas",
		},
		UI_SETTING_ERROR_WEIGHTGROUP_SUM_ZERO: {
			ENG: "The total weight of the group must be greater than 0",
			SWE: "Viktgruppens sammanlagda vikt måste vara större än 0",
		},
		UI_SETTING_ERROR_WEIGHTGROUP_SUM_ZERO_CONTEXT: {
			ENG: "The total weight of the group must be greater than 0, and satisfy the conditions for the currently selected roles.",
			SWE: "Viktgruppens sammanlagda vikt måste vara större än 0, och uppfylla krav för valda roller",
		},
		UI_SETTING_EXPOSER_FLIP_ONE: {
			ENG: "Flip one center card",
			SWE: "Vänd ett mittenkort",
		},
		UI_SETTING_EXPOSER_FLIP_THREE: {
			ENG: "Flip three center cards",
			SWE: "Vänd tre mittenkort",
		},
		UI_SETTING_EXPOSER_FLIP_TWO: {
			ENG: "Flip two center cards",
			SWE: "Vänd två mittenkort",
		},
		UI_SETTING_LABEL_RASCAL: {
			ENG: "Perform one of the following actions",
			SWE: "Utför en av följande handlingar",
		},
		UI_SETTING_LABEL_VIEW_CARD: {
			ENG: "View player cards",
			SWE: "Titta på spelarkort",
		},
		UI_SETTING_NARRATION: {
			ENG: "Narration",
			SWE: "Uppläsning",
		},
		UI_SETTING_NARRATION_PAUSE_LONG: {
			ENG: "Long Pause (s)",
			SWE: "Lång pauslängd (s)",
		},
		UI_SETTING_NARRATION_PAUSE_MEDIUM: {
			ENG: "Medium pause (s)",
			SWE: "Medium pauslängd (s)",
		},
		UI_SETTING_NARRATION_PAUSE_SCALE: {
			ENG: "Pause duration scale",
			SWE: "Skala för pauslängd",
		},
		UI_SETTING_NARRATION_PAUSE_SHORT: {
			ENG: "Short pause (s)",
			SWE: "Kort pauslängd (s)",
		},
		UI_SETTING_ORACLE_BLOCK_ACTION: {
			ENG: "Prevent another player from waking",
			SWE: "Hindra en annan spelare från att vakna",
		},
		UI_SETTING_ORACLE_DRUNK: {
			ENG: "Swap your card with a center card",
			SWE: "Byter sitt kort mot ett mittenkort",
		},
		UI_SETTING_ORACLE_EVEN_ODD: {
			ENG: "Announce whether {ROLE_ORACLE_DEFINITE} has an even or odd player number",
			SWE: "Annonsera om {ROLE_ORACLE_DEFINITE} har ett jämnt eller udda spelarnummer",
		},
		UI_SETTING_ORACLE_FORCE_RIPPLE: {
			ENG: "Force ripple",
			SWE: "Tvinga krusning",
		},
		UI_SETTING_ORACLE_HUNT: {
			ENG: "Oracle Hunt",
			SWE: "Orakeljakt",
		},
		UI_SETTING_ORACLE_HUNT_ALLOW_BAD_TEAMS: {
			ENG: "Allow waking for evil roles",
			SWE: "Tillåt att vakna för onda roller",
		},
		UI_SETTING_ORACLE_HUNT_CHANCE: {
			ENG: "Probability",
			SWE: "Sannolikhet",
		},
		UI_SETTING_ORACLE_SWITCH_TEAM: {
			ENG: "Switch team",
			SWE: "Byt lag",
		},
		UI_SETTING_ORACLE_SWITCH_TEAM_FULL: {
			ENG: "Switch role",
			SWE: "Byt roll",
		},
		UI_SETTING_ORACLE_SWITCH_TEAM_MODE: {
			ENG: "Probability of switching role as well",
			SWE: "Chans att byta även roll",
		},
		UI_SETTING_ORACLE_SWITCH_TEAM_PARTIAL: {
			ENG: "Switch team only",
			SWE: "Byt endast lag",
		},
		UI_SETTING_ORACLE_VIEW_CENTER: {
			ENG: "View center cards",
			SWE: "Titta på mittenkort",
		},
		UI_SETTING_ORACLE_VIEW_PLAYER: {
			ENG: "View player cards",
			SWE: "Titta på spelarkort",
		},
		UI_SETTING_PSYCHIC_VIEW_TWO_CARDS: {
			ENG: "Chance to view two cards",
			SWE: "Sannolikhet att få titta på två kort",
		},
		UI_SETTING_RIPPLE: {
			ENG: "Space-time ripple",
			SWE: "Krusning i rum-tid",
		},
		UI_SETTING_RIPPLE_DOUBLE_VOTE: {
			ENG: "Some players may cast two votes",
			SWE: "Vissa spelare får lägga två röster",
		},
		UI_SETTING_RIPPLE_DRUNK: {
			ENG: "A player swaps their card with a center card",
			SWE: "En spelare byter sitt kort mot ett av mittenkorten",
		},
		UI_SETTING_RIPPLE_DUAL_VIEW_PLAYER: {
			ENG: "Two players may view another player's card",
			SWE: "Två spelare får se på en annan spelares kort",
		},
		UI_SETTING_RIPPLE_INSOMNIAC: {
			ENG: "Some players view their cards after the night",
			SWE: "Vissa spelare tittar på sina kort efter natten",
		},
		UI_SETTING_RIPPLE_MUTED: {
			ENG: "Some players may not speak",
			SWE: "Vissa spelare får inte prata",
		},
		UI_SETTING_RIPPLE_NONE: {
			ENG: "Nothing happens",
			SWE: "Ingenting händer",
		},
		UI_SETTING_RIPPLE_ONE_MINUTE: {
			ENG: "Game time reduced to 1 minute",
			SWE: "Speltid reducerad till 1 minut",
		},
		UI_SETTING_RIPPLE_REBUKED: {
			ENG: "Some players must turn away",
			SWE: "Vissa spelare måste vända sig bort",
		},
		UI_SETTING_RIPPLE_REVEALER: {
			ENG: "A player may reveal another player's card",
			SWE: "En spelare får vända på en spelares kort",
		},
		UI_SETTING_RIPPLE_ROBBER: {
			ENG: "A player may steal another player's card",
			SWE: "En spelare får stjäla en annan spelares kort",
		},
		UI_SETTING_RIPPLE_TROUBLEMAKER: {
			ENG: "A player swaps two other players",
			SWE: "En spelare byter plats på två andra spelare",
		},
		UI_SETTING_RIPPLE_VIEW_PLAYER: {
			ENG: "A player may view another player's card",
			SWE: "En spelare får se på en annan spelares kort",
		},
		UI_SETTING_RIPPLE_WITCH: {
			ENG: "A player may view a center card and give it to a player",
			SWE: "En spelare får se på ett mittenkort och ge kortet till någon spelare",
		},
		UI_SETTING_VALIDATION_ERROR: {
			ENG: "Error in settings",
			SWE: "Fel i inställningar",
		},
		UI_SETTING_VIEW_CARD_CENTER_FOUR: {
			ENG: "Four center cards",
			SWE: "Fyra mittenkort",
		},
		UI_SETTING_VIEW_CARD_CENTER_ONE: {
			ENG: "One center card",
			SWE: "Ett mittenkort",
		},
		UI_SETTING_VIEW_CARD_CENTER_THREE: {
			ENG: "Three center cards",
			SWE: "Tre mittenkort",
		},
		UI_SETTING_VIEW_CARD_CENTER_TWO: {
			ENG: "Two center cards",
			SWE: "Två mittenkort",
		},
		UI_SETTING_VIEW_CARD_PLAYER_ANY: {
			ENG: "Any player",
			SWE: "Valfri spelare",
		},
		UI_SETTING_VIEW_CARD_PLAYER_EVEN: {
			ENG: "Even-numbered player",
			SWE: "Jämn spelare",
		},
		UI_SETTING_VIEW_CARD_PLAYER_NEIGHBOR: {
			ENG: "Neighbor",
			SWE: "Granne",
		},
		UI_SETTING_VIEW_CARD_PLAYER_NEIGHBOR_BOTH: {
			ENG: "Both neighbors",
			SWE: "Båda grannar",
		},
		UI_SETTING_VIEW_CARD_PLAYER_ODD: {
			ENG: "Odd-numbered player",
			SWE: "Udda spelare",
		},
		UI_SETTING_VIEW_CARD_PLAYER_SELF: {
			ENG: "Your own",
			SWE: "Sitt eget",
		},
		UI_SETTING_VIEW_CARD_PLAYER_SPECIFIC: {
			ENG: "Specific player",
			SWE: "Specifik spelare",
		},
		UI_SPEECH_INPUT: {
			ENG: "Waiting for user input",
			SWE: "Väntar på inmatning",
		},
		UI_SPEECH_PAUSED: {
			ENG: "Narration paused",
			SWE: "Uppläsning pausad",
		},
		UI_SPEECH_SPEAKING: {
			ENG: "Narrating",
			SWE: "Läser upp",
		},
		UI_SPEECH_WAITING: {
			ENG: "Waiting",
			SWE: "Väntar",
		},
		UI_TITLE: {
			ENG: "One Night Ultimate Werewolf – Prompt Builder",
			SWE: "One Night Ultimate Werewolf – Promptbyggare",
		},
		UI_TOKENDESCRIPTIONS: {
			ENG: "Tokens",
			SWE: "Brickor/märken",
		},
		UI_TOKENS_PLACES: {
			ENG: "Places",
			SWE: "Placerar:",
		},
		UI_USEDBY_PREFIX: {
			ENG: "Roles",
			SWE: "Roller",
		},
		UI_WINCONDITION_APPRENTICEASSASSIN: {
			ENG: "Wins if {ROLE_ASSASSIN_DEFINITE} is eliminated, or if the chosen target is eliminated when no {ROLE_ASSASSIN} is in play.",
			SWE: "Vinner om {ROLE_ASSASSIN_DEFINITE} röstas ut, eller om den utvalda måltavlan röstas ut om ingen {ROLE_ASSASSIN} är i spel.",
		},
		UI_WINCONDITION_APPRENTICETANNER: {
			ENG: "Wins if {ROLE_TANNER_DEFINITE} is eliminated, or if {ROLE_APPRENTICETANNER_DEFINITE} is eliminated when no {ROLE_TANNER} is in play.",
			SWE: "Vinner om {ROLE_TANNER_DEFINITE} röstas ut, eller om {ROLE_APPRENTICETANNER_DEFINITE} röstas ut om ingen {ROLE_TANNER} är i spel.",
		},
		UI_WINCONDITION_ASSASSIN: {
			ENG: "Wins if the chosen target is eliminated.",
			SWE: "Vinner om den utvalda måltavlan röstas ut.",
		},
		UI_WINCONDITION_BLOB: {
			ENG: "Wins if neither {ROLE_BLOB_DEFINITE} nor any players they must protect are eliminated.",
			SWE: "Vinner om varken {ROLE_BLOB_DEFINITE} själv eller någon av spelarna den måste skydda röstas ut.",
		},
		UI_WINCONDITION_COPYCAT: {
			ENG: "{ROLE_COPYCAT_DEFINITE} also copies the win condition of whatever role was copied during the night.",
			SWE: "{ROLE_COPYCAT_DEFINITE} kopierar även vinstvillkor från den rollen som kopierades under natten.",
		},
		UI_WINCONDITION_CURSED: {
			ENG: "{UI_WINCONDITION_TEAM_VILLAGE} If team alignment changes during the vote, so does the win condition.",
			SWE: "{UI_WINCONDITION_TEAM_VILLAGE} Om lagtillhörigheten ändras under omröstningen ändras även vinstvillkoren.",
		},
		UI_WINCONDITION_DOPPELGANGER: {
			ENG: "{UI_WINCONDITION_TEAM_VILLAGE} If {ROLE_DOPPELGANGER_DEFINITE} copies another role, it instead uses that role's win condition.",
			SWE: "{ROLE_DOPPELGANGER_DEFINITE} kopierar även vinstvillkor från den rollen som kopierades under natten.",
		},
		UI_WINCONDITION_FEUDINGALIENS: {
			ENG: "If only one is in play, they win with {TEAM_ALIEN}. If both are in play, one wins if the other is eliminated.",
			SWE: "Om endast en av dem är i spel vinner de tillsammans med {TEAM_ALIEN}. Om båda är i spel vinner den ena om den andra röstas ut.",
		},
		UI_WINCONDITION_LEADER: {
			ENG: "If both {ROLE_FEUDINGALIENS_DEFINITE} are in play, {ROLE_LEADER_DEFINITE} wins if both survive. Otherwise, {ROLE_LEADER_DEFINITE} wins with {TEAM_VILLAGE_DEFINITE}.",
			SWE: "Om både {ROLE_FEUDINGALIENS_DEFINITE} är i spel så vinner {ROLE_LEADER_DEFINITE} om {ROLE_FEUDINGALIENS_DEFINITE} båda överlever. Annars vinner {ROLE_LEADER_DEFINITE} tillsammans med {TEAM_VILLAGE_DEFINITE}.",
		},
		UI_WINCONDITION_MINION: {
			ENG: "If at least one {TEAM_WEREWOLF} is in play, {ROLE_MINION_DEFINITE} wins if no {TEAM_WEREWOLF} is eliminated, even if {ROLE_MINION_DEFINITE} is eliminated. If no {TEAM_WEREWOLF} is in play, {ROLE_MINION_DEFINITE} wins if at least one other player is eliminated.",
			SWE: "Om minst en {TEAM_WEREWOLF} är i spel vinner {ROLE_MINION_DEFINITE} om ingen {TEAM_WEREWOLF} röstas ut, även om {ROLE_MINION_DEFINITE} själv blir utröstad. Om ingen {TEAM_WEREWOLF} är i spel vinner {ROLE_MINION_DEFINITE} om minst en annan spelare röstas ut.",
		},
		UI_WINCONDITION_MORTICIAN: {
			ENG: "Wins if one of {ROLE_MORTICIAN_DEFINITE}'s neighbors is eliminated.",
			SWE: "Vinner om en av {ROLE_MORTICIAN_DEFINITE} grannar röstas ut.",
		},
		UI_WINCONDITION_NOSTRADAMUS: {
			ENG: "{UI_WINCONDITION_TEAM_VILLAGE} If {ROLE_NOSTRADAMUS_DEFINITE} sees a non-{TEAM_VILLAGE} role during the night, they adopt that role's win condition.",
			SWE: "{UI_WINCONDITION_TEAM_VILLAGE} Om {ROLE_NOSTRADAMUS_DEFINITE} under natten ser en roll som inte tillhör {TEAM_VILLAGE_DEFINITE} så vinner {ROLE_NOSTRADAMUS_DEFINITE} tillsammans med det laget förutsatt att {ROLE_NOSTRADAMUS_DEFINITE} inte blir utröstad.",
		},
		UI_WINCONDITION_ORACLE: {
			ENG: "{UI_WINCONDITION_TEAM_VILLAGE} {ROLE_ORACLE_DEFINITE_GENITIVE} win condition may change during the night.",
			SWE: "{UI_WINCONDITION_TEAM_VILLAGE} {ROLE_ORACLE_DEFINITE_GENITIVE} vinstvillkor kan ändras om så väljs under natten.",
		},
		UI_WINCONDITION_PARANORMALINVESTIGATOR: {
			ENG: "{UI_WINCONDITION_TEAM_VILLAGE} If {ROLE_PARANORMALINVESTIGATOR_DEFINITE} sees a non-{TEAM_VILLAGE} role during the night, they adopt that role's win condition.",
			SWE: "{UI_WINCONDITION_TEAM_VILLAGE} Om {ROLE_PARANORMALINVESTIGATOR_DEFINITE} under natten ser en roll som inte tillhör {TEAM_VILLAGE_DEFINITE} så gäller den rollens vinstvillkor även för {ROLE_PARANORMALINVESTIGATOR_DEFINITE}.",
		},
		UI_WINCONDITION_PREFIX: {
			ENG: "Win condition",
			SWE: "Vinstvillkor",
		},
		UI_WINCONDITION_RENFIELD: {
			ENG: "If at least one {TEAM_VAMPIRE} is in play, {ROLE_RENFIELD_DEFINITE} wins if no {TEAM_VAMPIRE} is eliminated, even if {ROLE_RENFIELD_DEFINITE} is eliminated. If no {TEAM_VAMPIRE} is in play, {ROLE_RENFIELD_DEFINITE} wins with {TEAM_VILLAGE_DEFINITE}.",
			SWE: "Om minst en {TEAM_VAMPIRE} är i spel vinner {ROLE_RENFIELD_DEFINITE} om ingen {TEAM_VAMPIRE} röstas ut, även om {ROLE_RENFIELD_DEFINITE} själv blir utröstad. Om ingen {TEAM_VAMPIRE} är i spel vinner {ROLE_RENFIELD_DEFINITE} tillsammans med {TEAM_VILLAGE_DEFINITE}.",
		},
		UI_WINCONDITION_SQUIRE: {
			ENG: "If at least one {TEAM_WEREWOLF} is in play, {ROLE_SQUIRE_DEFINITE} wins if no {TEAM_WEREWOLF} is eliminated, even if {ROLE_SQUIRE_DEFINITE} is eliminated. If no {TEAM_WEREWOLF} is in play, {ROLE_SQUIRE_DEFINITE} wins if at least one other player is eliminated.",
			SWE: "Om minst en {TEAM_WEREWOLF} är i spel vinner {ROLE_SQUIRE_DEFINITE} om ingen {TEAM_WEREWOLF} röstas ut, även om {ROLE_SQUIRE_DEFINITE} själv blir utröstad. Om ingen {TEAM_WEREWOLF} är i spel vinner {ROLE_SQUIRE_DEFINITE} om minst en annan spelare röstas ut.",
		},
		UI_WINCONDITION_SYNTHETICALIEN: {
			ENG: "Wins if {ROLE_SYNTHETICALIEN_DEFINITE} is eliminated.",
			SWE: "Vinner om {ROLE_SYNTHETICALIEN_DEFINITE} röstas ut.",
		},
		UI_WINCONDITION_TANNER: {
			ENG: "Wins if {ROLE_TANNER_DEFINITE} is eliminated.",
			SWE: "Vinner om {ROLE_TANNER_DEFINITE} röstas ut.",
		},
		UI_WINCONDITION_TEAM_ALIEN: {
			ENG: "Wins if no {TEAM_ALIEN} is eliminated.",
			SWE: "Vinner om ingen {TEAM_ALIEN} röstas ut.",
		},
		UI_WINCONDITION_TEAM_VAMPIRE: {
			ENG: "Wins if no {TEAM_VAMPIRE} is eliminated.",
			SWE: "Vinner om ingen {TEAM_VAMPIRE} röstas ut.",
		},
		UI_WINCONDITION_TEAM_VILLAGE: {
			ENG: "Wins if at least one {TEAM_WEREWOLF}, {TEAM_VAMPIRE}, or {TEAM_ALIEN} is eliminated.",
			SWE: "Vinner om minst en {TEAM_WEREWOLF}, {TEAM_VAMPIRE} eller {TEAM_ALIEN} röstas ut.",
		},
		UI_WINCONDITION_TEAM_WEREWOLF: {
			ENG: "Wins if no {TEAM_WEREWOLF} is eliminated.",
			SWE: "Vinner om ingen {TEAM_WEREWOLF} röstas ut.",
		},
		UI_WINCONDITION_VARIABLE_NOTE: {
			ENG: "This card's win condition may change, such as when copying another role.",
			SWE: "Kortets vinstvillkor kan förändras, som vid kopiering av en annan roll.",
		},
		UI_YES: {
			ENG: "Yes",
			SWE: "Ja",
		},
		UI_RULES_FULL: {
			ENG: `<h2>Game Rules – One Night Ultimate Werewolf</h2>

				<p>
					<strong>One Night Ultimate Werewolf</strong> is a fast-paced social deduction game consisting of two phases (three if roles from <strong>One Night Ultimate Vampire</strong> are used, as a dusk phase occurs first): the night phase where all actions take place, followed by the day phase where players discuss and attempt to decide who should be voted out once the day phase ends.
					The game is led by a narrator who guides the players through the various steps of the night.
				</p>

				<h3>Setup</h3>
				<ol>
					<li>Choose which roles will be included in the game. The number of cards should equal the number of players plus three extra cards.</li>
					<li>Shuffle the role cards and deal one card to each player.</li>
					<li>Place the remaining three cards face down in the center of the table.</li>
					<li>All players look at their own card without showing the others.</li>
					<li>If <strong>One Night Ultimate Vampire</strong> is being used, also place a blank token face down in front of each player.</li>
				</ol>

				<h3>The Night</h3>
				<p>
					All players close their eyes. The narrator wakes the roles <strong>one at a time</strong> and reads the instructions for each role included in the game.
				</p>
				<ul>
					<li>Only the players whose role is mentioned may open their eyes.</li>
					<li>Players perform their actions silently according to the instructions, or allow the narrator to perform them on their behalf.</li>
					<li>Some roles look at cards, some swap cards, some observe other players doing something, and some do nothing.</li>
					<li>If a role is not in the game, that phase is skipped. However, the unused roles in the center should also receive instructions to prevent players from knowing which roles they are.</li>
					<li>Players who wake up at the same time may not communicate more than necessary to perform their action.</li>
				</ul>
				<p>
					It is important to remember that <strong>cards can change places during the night</strong>, and that a player's original role is not necessarily the same as their final role.
					Regardless of how cards are moved, players follow the instructions given based on the information they have; if a player's card has been moved and they therefore have a new role, they will still perform the action of their original role during the night.
				</p>
				<p>
					If <strong>One Night Ultimate Vampire</strong> is used, a dusk phase also occurs before the night begins.
					The dusk phase works the same way as the night, but different roles wake up and place tokens in front of players.
					At the end of dusk, all players wake up and look at their own tokens without showing anyone else.
					After that, the night begins as normal.
				</p>
				<p>
					When the night phase is complete and all players have performed their actions, all players open their eyes and may begin discussing.
				</p>

				<h3>Daytime (Discussion)</h3>
				<p>
					After the night, players may discuss freely.
					The day lasts for a time limit adjusted to the group's preference, but usually around 5–10 minutes depending on the number of players.
				</p>
				<ul>
					<li>Players may say whatever they want – they may tell the truth, lie, or mislead others about both which role they have and what they did during the night.</li>
					<li>Everything is allowed except that no one may show their card.</li>
				</ul>
				<p>
					The goal of the day phase is partly to figure out what roles the other players have, but also what role you yourself have.
				</p>

				<h3>Voting</h3>
				<p>
					When the day is over, all players simultaneously vote for <strong>one player</strong> they wish to eliminate by pointing.
					The vote takes place simultaneously on the narrator's countdown.
					When all votes have been cast, they are counted to determine which players have been eliminated.
				</p>
				<ul>
					<li>Players may not vote for themselves.</li>
					<li>In the event of a tie, multiple players may be eliminated.</li>
					<li>At least two votes are required for a player to be eliminated.</li>
					<li>The group may decide whether abstaining is allowed, for example if there is reason to believe everyone is on the same team (all alternative teams belong to the unused cards in the center).</li>
				</ul>

				<h3>Reveal and Victory</h3>
				<p>
					All players reveal their <strong>final roles</strong> (not necessarily the ones they started with).
					Some roles may affect the outcome through abilities during voting, such as making themselves or others immune to elimination, or gaining the ability to eliminate an additional player.
					It is therefore important to count all votes even if there is a clear majority.
					Once it has been determined which player or players have been voted out, the winner is decided.
					Depending on the roles used, multiple teams may win for different reasons if their victory conditions have been fulfilled.
				</p>
				<p>
					Which team/player wins depends on:
				</p>
				<ul>
					<li>which roles are in the game</li>
					<li>which players were eliminated</li>
					<li>which roles the players had <strong>after the end of the night</strong></li>
				</ul>
				<p>
					If no team fulfills its victory condition, everyone loses.
				</p>

				<h3>Important Things to Remember</h3>
				<ul>
					<li>It is the <strong>cards</strong>, not the players, that belong to a team.</li>
					<li>A player may change teams without realizing it.</li>
					<li>All information from the night is private, and players decide for themselves what they wish to share – there is no guarantee that anyone is telling the truth.</li>
					<li>Bluffing is a tool both for protecting yourself and for gathering information from others.</li>
				</ul>`,
			SWE: `<h2>Spelregler – One Night Ultimate Werewolf</h2>

				<p>
					<strong>One Night Ultimate Werewolf</strong> är ett snabbt socialt deduktionsspel bestående av två faser (tre om roller från <strong>One Night Ultimate Vampire</strong> används, då en skymmningsfas kommer först): nattfasen där alla handlingar sker, följt av dagfasen där spelarna diskuterar och försöker besluta vem som ska röstas ut efter att dagfasen är över.
					Spelet leds av en berättare som guidar spelarna genom nattens olika steg.
				</p>

				<h3>Förberedelser</h3>
				<ol>
					<li>Välj vilka roller som ska vara med i spelet. Antalet kort skall vara antalet spelare plus tre extra kort.</li>
					<li>Blanda rollkorten och dela ut ett kort till varje spelare.</li>
					<li>Lägg de återstående tre korten med ansiktet nedåt i mitten av bordet.</li>
					<li>Alla spelare tittar på sitt kort utan att visa övriga.</li>
					<li>Om <strong>One Night Ultimate Vampire</strong> används placeras även ett rent märke framför varje spelare med ansiktet nedåt.</li>
				</ol>

				<h3>Natten</h3>
				<p>
					Alla spelare blundar. Berättaren väcker rollerna <strong>i tur och ordning</strong> och läser upp instruktioner för varje roll som är med i spelet.
				</p>
				<ul>
					<li>Endast de spelare vars roll nämns får öppna ögonen.</li>
					<li>Spelare utför sina handlingar tyst, enligt instruktionerna, eller låter berättaren göra det åt dem.</li>
					<li>Vissa roller tittar på kort, vissa byter kort, vissa får iaktta andra spelare göra något, och vissa gör ingenting.</li>
					<li>Om en roll inte är med i spelet hoppas den fasen över. Dock ska de oanvända rollerna i mitten också få instruktioner för att förhindra spelare från att veta vilka de är.</li>
					<li>Spelare som vaknar samtidigt får inte kommunicera mer än nödvändigt för att utföra sin handling.</li>
				</ul>
				<p>
					Det är viktigt att komma ihåg att <strong>kort kan byta plats under natten</strong>, och att en spelares ursprungliga roll inte nödvändigtvis är densamma som deras slutliga roll.
					Oavsett hur kort flyttas följer spelare instruktionerna som ges baserat på den information de har; om en spelare har fått sitt kort flyttat och därmed en ny roll kommer denna fortfarande att utföra sin ursprungliga rolls handling under natten.
				</p>
				<p>
					Om <strong>One Night Ultimate Vampire</strong> används inträffar även en skymmningsfas innan natten börjar.
					Skymmningen fungerar på samma sätt som natten, men andra roller vaknar och placerar märken framför spelare.
					Vid slutet av skymmningen vaknar samtliga spelare och tittar på sina egna märken utan att visa någon annan.
					Därefter börjar natten som vanligt.
				</p>
				<p>
					När nattfasen är klar och alla spelare har utfört sina handling öppnar alla spelare ögonen och får börja diskutera.
				</p>

				<h3>Dagen (Diskussion)</h3>
				<p>
					Efter natten får spelarna diskutera fritt.
					Dagen varar under en tidsgräns som justeras efter gruppens preferens, men vanligtvis ca. 5-10 minuter beroende på antalet spelare.
				</p>
				<ul>
					<li>Spelarna får säga vad de vill – de kan tala sanning, ljuga eller vilseleda om både vilken roll de har och vad de har gjort under natten.</li>
					<li>Allt är tillåtet med undantag för att ingen får visa sitt kort.</li>
				</ul>
				<p>
					Målet med dagfasen är dels att försöka ta reda på vilken roll de övriga spelarna har, men även vilken roll man själv har.
				</p>

				<h3>Omröstning</h3>
				<p>
					När dagen är över röstar alla spelare samtidigt på <strong>en spelare</strong> som de vill eliminera genom att peka.
					Röstningen sker samtidigt på berättarens nedräkning.
					När alla röster är lagda räknas de ihop för att avgöra vilka spelare som blivit eliminerade.
				</p>
				<ul>
					<li>Spelare kan inte rösta på sig själva.</li>
					<li>Vid lika röstetal kan flera spelare elimineras.</li>
					<li>Minst två röster krävs för att en spelare ska bli eliminerad.</li>
					<li>Gruppen kan bestämma om det är tillåtet att lägga ner sin röst, exempelvis om det finns anledning att tro att alla spelar för samma lag (alla alternativa lag tillhör de oanvända korten i mitten).</li>
				</ul>

				<h3>Avslöjande och vinst</h3>
				<p>
					Alla spelare visar sina <strong>slutliga roller</strong> (inte nödvändigtvis de de började med).
					Vissa roller kan påverka resultatet genom förmågor vid röstningen, som att göra sig själv eller andra immuna mot att bli eliminerad, eller att ha möjlighet att eliminera ytterligare en spelare.
					Det är därför viktigt att räkna samtliga röster även om det finns en klar majoritet.
					När det är avgjort vilken eller vilka spelare som är utröstade så avgörs vem som har vunnit.
					Beroende på roller som används kan flera lag vinna av olika anledningar om deras vinstvillkor har uppfyllts.
				</p>
				<p>
					Vilket lag/spelare som vinner beror på:
				</p>
				<ul>
					<li>vilka roller som finns i spelet</li>
					<li>vilka spelare som eliminerades</li>
					<li>vilka roller spelarna hade <strong>efter nattens slut</strong></li>
				</ul>
				<p>
					Om inget lag uppfyller sitt vinstvillkor, förlorar alla.
				</p>

				<h3>Viktigt att komma ihåg</h3>
				<ul>
					<li>Det är <strong>korten</strong>, inte spelarna, som tillhör ett lag.</li>
					<li>En spelare kan byta lag utan att själv veta om det.</li>
					<li>All information från natten är privat och spelare väljer själva vad de vill dela med sig av – det finns inga garantier för att någon talar sanning.</li>
					<li>Att bluffa är ett verktyg för att skydda sig själv, men även för att få fram information från andra.</li>
				</ul>`,
		},
	};



	/* =========================
	   Initialization
	   ========================= */

	function _init() {
		_loadLanguage();
	}

	_init();



	/* =========================
	   Private functions
	   ========================= */

	// Persists the current language (LANG) to localStorage. No parameters, no return value.
	function _saveLanguage() {
		localStorage.setItem(LANGUAGE_STORE, LANG);
	}

	// Restores the persisted language into LANG, if one was saved; otherwise leaves LANG at its existing (default) value. No parameters,
	function _loadLanguage() {
		LANG = localStorage.getItem(LANGUAGE_STORE) || LANG;
	}

	/*
	 * Splits a template call's raw argument string on commas, treating commas inside a matching pair of quotes (' or ") as part of the
	 * argument rather than a separator - e.g. {Function:count,"one, two",A} keeps "one, two" as a single argument. Quote characters are
	 * left in place; _parseTemplateArg still strips them. Unterminated quotes are not an error here - the trailing text is just returned
	 * as-is and will fail the quote check in _parseTemplateArg, same as any other malformed argument.
	 *
	 * argStr - the raw argument text from a {Function:...} call, already isolated by _resolveTemplate.
	 *
	 * Returns an array of raw (untrimmed, still-quoted) argument substrings.
	 */
	function _splitTemplateArgs(argStr) {
		const args = [];
		let current = "";
		let quoteChar = null;

		for (const ch of argStr) {
			if (quoteChar) {
				current += ch;
				if (ch === quoteChar) quoteChar = null;
			} else if (ch === '"' || ch === "'") {
				quoteChar = ch;
				current += ch;
			} else if (ch === ",") {
				args.push(current);
				current = "";
			} else {
				current += ch;
			}
		}
		args.push(current);
		return args;
	}

	/*
	 * Converts one raw argument string from a template primitive call (e.g. the "true" in {Function:true}) into its typed value.
	 *
	 * value - the raw, comma-split argument text, not yet trimmed or unquoted.
	 *
	 * Returns, in order of precedence: "" for an empty/whitespace-only argument; the literals true/false/null/undefined as their actual
	 * typed values; a quoted string ('...' or "...") with its quotes stripped and wrapped in a class in order to ensure it is properly
	 * interpreted by an external caller using typeof and toString on it; a bare integer or decimal as a Number; otherwise the trimmed string
	 * unchanged.
	 */
	function _parseTemplateArg(value) {
		value = value.trim();

		if (value === "") return "";
		if (value === "true") return true;
		if (value === "false") return false;
		if (value === "null") return null;
		if (value === "undefined") return undefined;

		// Quoted strings
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			return new TemplateLiteral(value.slice(1, -1));
		}

		// Safer number parsing
		if (/^-?\d+(\.\d+)?$/.test(value)) {
			return Number(value);
		}

		return value;
	}

	/*
	 * Capitalizes the first letter of each sentence (after a ./!/? or at the very start of the text), left over from template expansion
	 * pulling in lowercase fragments. text - fully resolved narration text. Returns the capitalized text.
	 */
	function _normalizeSentences(text) {
		return text.replace(/([.!?]|^)\s*(\p{L})/gu, (_, punct, letter) => {
			return (punct === "" ? "" : punct + " ") + letter.toUpperCase();
		});
	}

	/*
	 * Collapses runs of multiple spaces to one, removes a stray space before ,.!?, and trims the ends — cleanup for gaps left by
	 * conditional/empty template expansion. text - fully resolved narration text. Returns the cleaned-up text.
	 */
	function _trimExtraSpaces(text) {
		return text.replace(/ {2,}/g, " ").replace(/ ([,.!?])/g, "$1").trim();
	}

	/*
	 * Iteratively resolves template expressions embedded within localized text.
	 *
	 * Templates are entered into localized strings using the bracket {...} notation. Templates can by default substitute localized keys directly. If a function
	 * table is provided, it can also call named primitives with arguments. Arguments are provided as comma separated values, prefixed by a colon.
	 *
	 * A name that matches an entry in funcs always takes priority over a plain localization key of the same name - {Break} calls
	 * funcs.Break(data) even though "Break" isn't itself a real localization key, and would still do so even if it happened to be one.
	 *
	 * Template functions may themselves return templates, allowing complex narration to be assembled from small reusable components. Resolution continues until no
	 * template expressions remain or the maximum iteration count is reached.
	 *
	 * Template syntax:
	 *	{KEY}
	 *		Inserts another localization key.
	 *	{Function:arg1,arg2,...}
	 *		Invokes a named function from the supplied function table, e.g. Interpreter.PRIMITIVES. Arguments are always passed as strings, converted to typed
	 *      values first (e.g. "true" -> boolean true).
	 *
	 * An optional data argument and error function can also be provided for extra control over arguments and error handling.
	 *
	 *   text    - the text to resolve; typically starts as a single {KEY} (see localize()) but may already contain arbitrary text mixed
	 *             with further {...} expressions once functions start returning their own templates.
	 *   funcs   - optional function table (name -> (data, ...args) => string); a name absent from funcs falls back to a plain localization
	 *             key lookup instead. null/undefined disables function calls entirely, treating every {name...} as a key lookup.
	 *   data    - opaque value passed as the first argument to every function call; not otherwise inspected here.
	 *   onError - (type, key, data) => string | undefined, called for "missing_key" (a plain key or function name resolved to nothing) or
	 *             "max_iterations" (resolution didn't settle within MAX_ITERATIONS - very likely a cyclic reference). Defaults to
	 *             _defaultTemplateError. See that function for the undefined-return convention on the "max_iterations" path.
	 *
	 * Returns the fully resolved, sentence-capitalized, whitespace-cleaned text (see _normalizeSentences/_trimExtraSpaces).
	 */
	function _resolveTemplate(text, funcs, data, onError) {
		return _resolveTemplateCore(text, funcs, data, onError).text;
	}

	/*
	 * Same resolution as _resolveTemplate, but keeps track of which substrings of the final result came from
	 * which distinct {...} expression, all the way down through recursive expansion (a primitive returning
	 * another key reference, that key's own COMMON entry containing further primitives, etc.) - so a caller
	 * can treat each one as an individually addressable "atom" (e.g. for per-role/per-phrase pre-recorded audio
	 * clips - see Interpreter's automatic-mode splicing) without any change to how localization strings are
	 * authored.
	 *
	 * Instead of rewriting one string in place like _resolveTemplate did, this maintains an ordered list of
	 * { text, final } chunks. Each pass scans every non-final chunk for {...} matches: a match's replacement
	 * always becomes a *new* chunk of its own (marked final only once it itself contains no further {...}),
	 * and any literal text immediately before/after/between matches within the same chunk is split off as its
	 * own final chunk. Because a match can only ever occupy a contiguous span of exactly one chunk's text (a
	 * replacement is never glued onto surrounding chunks), this converges on precisely the boundaries between
	 * "text produced by resolving one {...} expression" and "text that was always literal" - e.g.
	 * "{Identity:instigator}, vakna." first becomes one chunk (the Identity call spans the whole original
	 * text), then on the next pass splits into [Identity's result (still unresolved), ", vakna." (already
	 * final)], and finally the first chunk itself resolves down to a single leaf of plain text.
	 *
	 * Every leaf chunk ends up its own atom here - no attempt is made to guess which boundaries are "really"
	 * static (e.g. a bareword {KEY} reference, which never varies with `data`) and pre-merge them with their
	 * neighbors. An earlier version of this function tried exactly that, tracking a `dynamic` flag through the
	 * resolution chain and merging unbroken runs of non-dynamic chunks - but that guess turned out to be both
	 * unnecessary and occasionally wrong (a bareword role reference sitting inside an {If:...}/{Select:...}
	 * branch has to be treated as dynamic too, since Localization can't tell "choosing between two whole
	 * sentences" apart from "choosing a grammar word" - both are just a function call whose result gets
	 * rescanned for more {...}). TTSManifest.lookupParts now makes that grouping decision instead, empirically,
	 * by trying every way of joining adjacent atoms and checking what's actually recorded - which strictly
	 * subsumes any merge this layer could have pre-computed (the same grouping is found whenever that combined
	 * text is recorded) while staying free to fall back to finer atoms whenever a coarser one isn't recorded,
	 * something a merge locked in here could never undo. So the simplest, most granular boundary is also the
	 * most useful one: split at every distinct {...} expression, and let the manifest decide what to combine.
	 *
	 * Same parameter contract as _resolveTemplate/localize.
	 *
	 * Returns { text, atoms }. text is exactly what _resolveTemplate used to return (all chunks joined, then
	 * sentence-capitalized/whitespace-cleaned as before). atoms is the ordered list of leaf chunks with empty
	 * ones dropped (text kept raw/untrimmed otherwise - see the comment where atoms is built, below) - or null
	 * if resolution hit MAX_ITERATIONS, since a cyclic reference makes the chunk boundaries themselves
	 * unreliable; callers that don't need atoms should keep using _resolveTemplate/localize, which never
	 * inspects this field.
	 */
	function _resolveTemplateCore(text, funcs, data, onError) {
		let segments = [{ text, final: false }];

		for (let i = 0; i < MAX_ITERATIONS; i++) {
			let changed = false;
			const next = [];

			for (const seg of segments) {
				if (seg.final) { next.push(seg); continue; }

				const regex = /\{(.*?)\}/g;
				let lastIndex = 0;
				let match;
				let sawMatch = false;

				while ((match = regex.exec(seg.text)) !== null) {
					sawMatch = true;
					changed = true;

					if (match.index > lastIndex)
						next.push({ text: seg.text.slice(lastIndex, match.index), final: true });

					const inner = match[1];
					const colonIdx = inner.indexOf(":");
					const name = colonIdx === -1 ? inner : inner.slice(0, colonIdx);
					const argStr = colonIdx === -1 ? "" : inner.slice(colonIdx + 1);
					const args = argStr === "" ? [] : _splitTemplateArgs(argStr).map(a => _parseTemplateArg(a));

					let replacement;
					if (funcs && typeof funcs[name] === "function")
						replacement = funcs[name](data, ...args) ?? "";
					else {
						const key = getString(name);
						replacement = key !== undefined ? key : onError("missing_key", name, data);
					}

					next.push({ text: String(replacement), final: false });
					lastIndex = regex.lastIndex;
				}

				if (!sawMatch) { next.push({ ...seg, final: true }); continue; }

				if (lastIndex < seg.text.length)
					next.push({ text: seg.text.slice(lastIndex), final: true });
			}

			segments = next;

			if (!changed) break;

			if (i === MAX_ITERATIONS - 1) {
				const joined = segments.map(s => s.text).join("");
				return { text: onError("max_iterations", text, data) ?? joined, atoms: null };
			}
		}

		const joined = segments.map(s => s.text).join("");

		// Every leaf chunk becomes its own atom, one per distinct {...} expression (or literal gap between
		// them) - no attempt is made here to guess which ones are "really" static and could safely be merged.
		// That decision is made later, empirically, by TTSManifest.lookupParts: it tries every way of grouping
		// adjacent atoms and picks whichever full covering actually has recordings, which strictly subsumes
		// any merge this layer could have pre-computed (it can reconstruct the same grouping whenever that
		// combined text is recorded) while also staying free to fall back to finer atoms whenever a coarser
		// grouping isn't recorded - something a merge performed here, once locked in, could never undo. Text
		// is kept raw/untrimmed here (including whitespace-only atoms, e.g. the space IdentityList glues
		// between two role names) so a caller reconstructing text from atoms gets the same spacing joined
		// would; trimming/dropping whitespace is left to the caller, which needs different rules depending on
		// what it's using atoms for (Interpreter trims per-atom only for clip lookup, not for the text it
		// rebuilds - see _toSequenceFromAtoms).
		const atoms = segments.map(s => ({ text: s.text })).filter(s => s.text.length > 0);

		return {
			text: _normalizeSentences(_trimExtraSpaces(joined)),
			atoms,
		};
	}

	/*
	 * Default onError implementation for _resolveTemplate (see its `onError` parameter for the contract).
	 *   type - "missing_key" or "max_iterations".
	 *   key  - the missing key/function name for "missing_key"; the original, still-unresolved text for "max_iterations".
	 * Returns a visible "UNDEF: KEY" placeholder for "missing_key" (recoverable - narration continues around it); returns undefined for
	 * "max_iterations" (unrecoverable), which tells _resolveTemplate's caller to fall back to keeping the partially-resolved text rather
	 * than substituting anything in its place.
	 */
	function _defaultTemplateError(type, key) {
		console.warn(`Template resolution issue (${type}):`, key);
		return type === "missing_key" ? `UNDEF: ${key}` : undefined; // undefined ⇒ caller keeps the partially-resolved text
	}



	/* =========================
	   Public functions
	   ========================= */

	/*
	 * Public localization interface.
	 *
	 * Most callers should use localize(), which resolves both localization keys and any embedded template expressions.
	 */

	/*
	 * Resolves key (and anything it expands into) to final narration text - the main entry point for localizing a key.
	 *
	 *   key     - the localization key to resolve
	 *   funcs   - optional list of functions/primitives that the resolver may use for more advanced resolution
	 *   data    - optional data that gets passed to any primitive function call
	 *   onError - optional custom error handler in cause errors are encountered during resolution
	 *
	 * Also see _resolveTemplate for the full parameter contracts (funcs/data/onError) and template syntax. Returns the resolved text.
	 */
	function localize(key, funcs = null, data = null, onError = _defaultTemplateError) {
		return _resolveTemplate(`{${key}}`, funcs, data, onError);
	}

	/*
	 * Same as localize(), but also returns the atom breakdown described in _resolveTemplateCore - for callers
	 * that need to know which parts of the resolved text came from which distinct template expression (e.g.
	 * Interpreter's automatic-mode audio splicing). Plain localize() callers are unaffected; this is purely
	 * additive.
	 *
	 * Returns { text, atoms } - see _resolveTemplateCore.
	 */
	function localizeWithAtoms(key, funcs = null, data = null, onError = _defaultTemplateError) {
		return _resolveTemplateCore(`{${key}}`, funcs, data, onError);
	}

	/*
	 * Applies the same sentence-capitalization/whitespace-cleanup localize() applies to its result, to a piece
	 * of text a caller assembled itself outside the normal resolve loop. Used by Interpreter when it rebuilds
	 * per-sentence text directly from localizeWithAtoms' atom list (see _toSequenceFromAtoms) rather than from
	 * one already-cleaned flat string, so both paths end up looking identical to a reader/listener.
	 */
	function normalizeText(text) {
		return _normalizeSentences(_trimExtraSpaces(text));
	}

	/*
	 * True if key exists in the current language's dictionary. Returns false (rather than throwing) if the current language itself has no
	 * loaded dictionary.
	 */
	function hasKey(key) {
		return getString(key) !== undefined;
	}

	/*
	 * Looks up key's raw (unresolved) string in the current language's dictionary, using the COMMON field as a fallback (if it exists).
	 *
	 * key - the localization key to look up.
	 *
	 * Returns the raw string if found; undefined if the current language has a dictionary but key isn't in it; null if the current
	 * language itself has no dictionary at all (e.g. an unrecognized LANG). Note the two "not found" cases return different values -
	 * _resolveTemplate's missing-key check only tests `!== undefined`, so the null case would currently pass through as a resolved value
	 * of `null` rather than triggering onError. Worth keeping in mind if LANG can ever end up invalid at runtime.
	 */
	function getString(key) {
		const entry = LOCALIZATION_KEYS[key];
		if (!entry) return undefined;
		return entry[LANG] ?? entry.COMMON;
	}

	// Returns the current language code (e.g. "ENG", "SWE"). No parameters.
	function getLanguage() {
		return LANG;
	}

	// Sets the current language and persists it. lang - a language code matching a key in LOCALIZATION_KEYS. No return value.
	function setLanguage(lang) {
		LANG = lang;
		_saveLanguage();
	}

	/*
	 * Returns every key in the current language's dictionary whose name contains pattern (plain substring match via String.includes, not
	 * a regex) - e.g. used by EmpathResolver to enumerate all "PROMPT_EMPATH_QUESTION_*" variants without hardcoding how many exist.
	 */
	function getKeysContaining(pattern) {
		return Object.keys(LOCALIZATION_KEYS).filter(k => k.includes(pattern) && getString(k) !== undefined);
	}

	/*
	 * Checks if a template argument is a TemplateLiteral instance, i.e. a literal string rather than a localization key, and returns true if so
	 */
	function isLiteral(arg) {
		return arg instanceof TemplateLiteral;
	}


	return {
		getLanguage,
		getKeysContaining,
		getString,
		hasKey,
		isLiteral,
		localize,
		localizeWithAtoms,
		normalizeText,
		setLanguage,
	};
	
})();