/*
 * Maps narration to pre-recorded clip names for automatic (spoken) narration - see ClipPlayback for how a clip
 * name actually gets turned into audio; this module only decides *which* clip names a turn needs, or that none
 * exist and the caller should fall back to synthesis.
 *
 * Pure decision layer - no I/O, no audio, no knowledge of whether a clip it names actually exists in the atlas.
 * Not called directly outside ClipPlayback.resolve() - that's the only place that composes this module with
 * physical-clip existence checks, and the only module that should ever import this one. This module deciding
 * *which* names are needed and ClipPlayback deciding whether they *exist* stay separate concerns on purpose:
 * an author changing which clip covers a phrase, and a repack changing what's actually recorded, are different
 * kinds of change with different failure modes, and conflating them would mean an atlas gap looks identical to
 * an authoring mistake instead of being flagged as what it actually is.
 *
 * Lookup is always by structural ref, never by wording - see the `_map` comment below for what a ref is and
 * where it comes from. `MANIFEST` below is this module's primary authored data; see its own comment for what
 * needs an entry and how an entry is written. `ANNOUNCEMENT_CLIPS` is secondary authored data specifically 
 * for simple, plain clips, without the more advanced functionality of the main manifest.
 */

const ClipSelector = (() => {

	/* =========================
	   Data
	   ========================= */

	// A slot in a `MANIFEST` entry's array - see the header above. The identity of the symbol is all that
	// matters; the description is only ever read by a human looking at this file, never compared against.
	const REF = Symbol("position occupied by a {...} reference");
	const AGGREGATE = Symbol("MANIFEST aggregate");

	// Helper function for aggregating multiple positions/clips into an aggregated clip covering the range
	function agg(count, clip) {
		return { [AGGREGATE]: true, clip, count };
	}

	// Helper function for aggregating multiple positions into one of several clips, depending on which key a
	// dynamic branch resolves to. Branch is zero-based relative to this aggregate's range.
	function c_agg(count, alternatives) {
		return { [AGGREGATE]: true, count, alternatives };
	}

	/*
	 * Authored key -> clip definitions, evaluated and flattened during init into `_map`/`_templates`, the two
	 * structures lookup actually uses.
	 *
	 * One entry per localization key that has literal wording of its own worth a clip decision. A key that's
	 * pure structural routing - every one of its top-level pieces is itself a `{...}` reference, e.g. PROMPT_SEER,
	 * whose own template is just three key references and connecting whitespace - needs no entry at all: there's
	 * nothing here for an author to decide, and lookup never needs to "walk into" it, because by the time a part
	 * reaches this module it already carries the ref of whichever key actually produced it, however deep the
	 * chain of indirection went. So an entry only exists for a key like PROMPT_VIEW_CARD_PLAYER_ANY, which mixes
	 * template references with its own literal " från " - or a role/team name, or a number, both of which are
	 * populated automatically at init instead of authored here at all (see _initRoles/_initNumbers).
	 *
	 * Each entry maps one or more language-set keys - "|"-joined language codes, e.g. "SWE|ENG" or a single
	 * "SWE" - to the array that applies for exactly those languages. Since lookup is entirely ref-based, a clip
	 * name doesn't mean anything different per language - it's just the name ClipPlayback looks up within whichever
	 * language's own atlas is currently loaded - so most entries only ever need ONE variant covering every
	 * supported language at once (e.g. "SWE|ENG": [...]), and only the keys where the languages' actual wording
	 * structurally diverges (say, English inserting a literal "the" that Swedish's template never needed a slot
	 * for) need to be split into separate variants, one per group of languages that share a structure. There's no
	 * single privileged "default" group the way Localization's COMMON works - every variant is just a
	 * language-set claiming whichever languages belong to it, and _selectVariant picks whichever one covers the
	 * language currently active (throwing if none do, or if more than one ambiguously does - see there).
	 *
	 * An entry's array is written by reading that key's own raw template left to right: a string names the clip
	 * for that literal span; REF marks a `{...}` reference (a bareword key or a primitive call, no distinction
	 * needed - see _registerKey) and is never itself registered, since whatever ends up there will carry its own
	 * ref back to whichever key actually produced it. A REF's position in the array is purely documentation for
	 * whoever's authoring this - it consumes no span index of the key it's declared under, exactly mirroring how
	 * a `{...}` match never advances Localization's own literalIndex counter (see there). Concretely, for
	 * PROMPT_VIEW_CARD_PLAYER_ANY's template -
	 *   "{NUM_WORD} {Select:count,1,GRAMMAR_CARD_SINGULAR,*,GRAMMAR_CARD_PLURAL} från
	 *    {Select:count,1,...SINGLE,*,...MULTI} {Select:count,1,GRAMMAR_PLAYER_SINGULAR,*,GRAMMAR_PLAYER_PLURAL}"
	 * - the array is [ REF, REF, "from", REF, REF ]: four template references
	 * (whatever they each resolve to is looked up independently, under their own key's own entry) and exactly
	 * one literal span of this key's own, " från ", at index 0 (the only index this key's own template ever
	 * assigns, since every other piece is a reference elsewhere) - registered here as "from". No entry needs to
	 * account for how many *parts* a `{...}` reference eventually produces - an IdentityList or ValueList run of
	 * any length is still just a run of individually-refed parts once it reaches this module (see Interpreter's
	 * IdentityList/ValueList primitives), each looked up on its own exactly like any other part; nothing here
	 * needs to know it came from a list at all.
	 *
	 * Aggregation - collapsing a known run of clips into one better-prosody recording, e.g. the Doppelganger's
	 * echoed wake call, or a fully single-clip sentence with no part-level breakdown at all - is authored as an
	 * optional `groups` list alongside a key's `clips` (see _registerGroup for the exact shape). A group names a
	 * contiguous range of that key's own array positions - including REF ones - to collapse into one clip; it's
	 * compiled at init time into a fixed, fully-resolved sequence of exact refs, so lookup never matches on wording,
	 * only on refs, same as everything else here. This only works when every position in the range is statically
	 * knowable ahead of time - a literal span, or a REF standing for a bareword {OTHER_KEY} reference (never a
	 * primitive call with arguments, whose target key depends on turn data). This isn't a corner deliberately left
	 * uncut: a genuinely data-dependent position is exactly the case where pre-aggregating would mean recording a
	 * combinatorial explosion of variants instead of splicing - the same case an author would never choose to
	 * aggregate by hand either. See _registerGroup for what happens if a group's range includes one anyway (a clear
	 * error at init, not a silent wrong splice).
	 */
	const MANIFEST = {
		GRAMMAR_CARD_SINGULAR:                          { "SWE|ENG": [ "card" ] },
		GRAMMAR_CARD_PLURAL:                            { "SWE|ENG": [ "cards" ] },
		GRAMMAR_PLAYER_SINGULAR:                        { "SWE|ENG": [ "player" ] },
		GRAMMAR_PLAYER_PLURAL:                          { "SWE|ENG": [ "players" ] },
		LIST_AND:                                       { "SWE|ENG": [ "list_and" ] },
		LIST_OR:                                        { "SWE|ENG": [ "list_or" ] },

		SPECIAL_ALL:                                    { "SWE|ENG": [ "identity_all_players" ] },
		SPECIAL_LOVERS:                                 { "SWE|ENG": [ "identity_lovers" ] },

		PROMPT_ALIEN_TEAM:                              { "SWE|ENG": [ REF, "wake_and_identify", REF, REF, REF, "generic_sleep" ] },
		PROMPT_ALIEN_TEAM_ACTION_MAKE_ALIEN:            { "SWE|ENG": [ "all_hands_out", agg(2, "alien_team_turncoat_1"), agg(3, "alien_team_turncoat_2a"), "all_hands_down" ] },
		PROMPT_ALIEN_TEAM_ACTION_MAKE_MINION:           { "SWE|ENG": [ "all_hands_out", agg(2, "alien_team_turncoat_1"), agg(3, "alien_team_turncoat_2b"), "all_hands_down" ] },
		PROMPT_ALIEN_TEAM_ACTION_NOTHING:               { "SWE|ENG": [ "alien_team_do_nothing" ] },
		PROMPT_ALIEN_TEAM_ACTION_SHOW_CARDS:            { "SWE|ENG": [ "alien_team_show_cards" ] },
		PROMPT_ALIEN_TEAM_ACTION_VIEW_CARDS_COLLECTIVE: { "SWE|ENG": [ "view_card_prefix_together", REF ] },
		PROMPT_ALIEN_TEAM_ACTION_VIEW_CARDS_INDIVIDUAL: { "SWE|ENG": [ "view_card_prefix_individual", REF ] },
		PROMPT_ALIEN_TEAM_COW:                          { "SWE|ENG": [ REF, REF, "hand_out", agg(6, "alien_team_cow_1"), REF, "hand_down" ] },
		PROMPT_ALIEN_TEAM_COW_DOPPELGANGER:             { "SWE|ENG": [ agg(4, "alien_team_cow_doppelganger") ] },
		PROMPT_APPRENTICEASSASSIN:                      { "SWE|ENG": [ REF, "generic_wake", REF, REF, "generic_sleep", REF ] },
		PROMPT_APPRENTICEASSASSIN_ACTION:               { "SWE|ENG": [ agg(2, "apprenticeassassin_1"), agg(2, "apprenticeassassin_2"), REF ] },
		PROMPT_APPRENTICEASSASSIN_DOPPELGANGER:         { "SWE|ENG": [ agg(2, "doppelganger_wake_prefix"), REF, "generic_wake", REF, REF ] },
		PROMPT_APPRENTICETANNER:                        { "SWE|ENG": [ REF, agg(4, "apprenticetanner_1"), REF, REF, REF, "thumb_down" ] },
		PROMPT_APPRENTICETANNER_DOPPELGANGER:           { "SWE|ENG": [ REF, agg(4, "apprenticetanner_doppelganger"), REF ] },
		PROMPT_ASSASSIN_ACTION:                         { "SWE|ENG": [ agg(2, "assassin_1") ] },
		PROMPT_AURASEER:                                { "SWE|ENG": [ REF, REF, agg(3, "auraseer_1"), REF, REF, "all_thumbs_down" ] },
		PROMPT_AURASEER_DOPPELGANGER:                   { "SWE|ENG": [ REF, "others_thumb_out", REF ] },
		PROMPT_BEHOLDER:                                { "SWE|ENG": [ REF, REF, agg(3, "beholder_1"), REF, "shared_may_view_cards", REF, REF, "all_thumbs_down" ] },
		PROMPT_BEHOLDER_DOPPELGANGER:                   { "SWE|ENG": [ REF, "others_thumb_out", REF, "shared_may_view_cards", REF ] },
		PROMPT_BLOB_OBJECTIVE_ALONE:                    { "SWE|ENG": [ "blob_solo" ] },
		PROMPT_BLOB_OBJECTIVE_SINGLE:                   { "SWE|ENG": [ c_agg(3, { DIRECTION_RIGHT: "blob_duo_right", DIRECTION_LEFT: "blob_duo_left", }) ] },
		PROMPT_BODYSNATCHER_ACTION:                     { "SWE|ENG": [ REF, "bodysnatcher_1", agg(2, "bodysnatcher_2") ] },
		PROMPT_CHECK_MARKS_ACTION:                      { "SWE|ENG": [ "check_marks" ] },
		PROMPT_COPYCAT_ACTION:                          { "SWE|ENG": [ "copycat_1", "doppelganger_2", "copycat_3" ] },
		PROMPT_COUNT_ACTION:                            { "SWE|ENG": [ agg(2, "count_1") ] },
		PROMPT_CUPID_ACTION:                            { "SWE|ENG": [ agg(2, "cupid_1") ] },
		PROMPT_CURATOR_ACTION:                          { "SWE|ENG": [ "curator_1" ] },
		PROMPT_DISEASED_ACTION:                         { "SWE|ENG": [ agg(2, "diseased_1") ] },
		PROMPT_DOPPELGANGER_ACTION:                     { "SWE|ENG": [ "doppelganger_1", "doppelganger_2", REF ] },
		PROMPT_DOPPELGANGER_DREAMWOLF_EXCLUSION:        { "SWE|ENG": [ agg(5, "doppelganger_4_dreamwolf") ] },
		PROMPT_DOPPELGANGER_IMMEDIATE_ACTION:           { "SWE|ENG": [ "doppelganger_3_prefix", REF, "doppelganger_3_suffix" ] },
		PROMPT_DOPPELGANGER_SUFFIX:                     { "SWE|ENG": [ "doppelganger_4_prefix", REF, "doppelganger_4_suffix", REF ] },
		PROMPT_DRUNK_ACTION:                            { "SWE|ENG": [ "drunk_1" ] },
		PROMPT_EMPATH_ACTION:                           { "SWE|ENG": [ "empath_1", REF, REF, "empath_2", REF ] },
		PROMPT_EMPATH_QUESTION_10:                      { "SWE|ENG": [ "empath_q_10" ] },
		PROMPT_EMPATH_QUESTION_11:                      { "SWE|ENG": [ "empath_q_11" ] },
		PROMPT_EMPATH_QUESTION_1:                       { "SWE|ENG": [ "empath_q_1" ] },
		PROMPT_EMPATH_QUESTION_2:                       { "SWE|ENG": [ "empath_q_2" ] },
		PROMPT_EMPATH_QUESTION_3:                       { "SWE|ENG": [ "empath_q_3" ] },
		PROMPT_EMPATH_QUESTION_4:                       { "SWE|ENG": [ "empath_q_4" ] },
		PROMPT_EMPATH_QUESTION_5:                       { "SWE|ENG": [ agg(2, "empath_q_5") ] },
		PROMPT_EMPATH_QUESTION_6:                       { "SWE|ENG": [ "empath_q_6" ] },
		PROMPT_EMPATH_QUESTION_7:                       { "SWE|ENG": [ "empath_q_7" ] },
		PROMPT_EMPATH_QUESTION_8:                       { "SWE|ENG": [ "empath_q_8" ] },
		PROMPT_EMPATH_QUESTION_9:                       { "SWE|ENG": [ "empath_q_9" ] },
		PROMPT_EXPOSER_ACTION:                          { "SWE|ENG": [ "exposer_1", REF, "view_card_suffix_center" ] },
		PROMPT_FEUDINGALIENS:                           { "SWE|ENG": [ REF, REF, "wake_and_identify", REF ] },
		PROMPT_FEUDINGALIENS_DOPPELGANGER:              { "SWE|ENG": [ agg(3, "feudingaliens_doppelganger") ] },
		PROMPT_GREMLIN_ACTION:                          { "SWE|ENG": [ "gremlin_1" ] },
		PROMPT_INSOMNIAC_ACTION:                        { "SWE|ENG": [ "insomniac_1" ] },
		PROMPT_INSTIGATOR_ACTION:                       { "SWE|ENG": [ agg(2, "instigator_1") ] },
		PROMPT_LEADER:                                  { "SWE|ENG": [ REF, agg(4, "leader_1"), REF, REF, REF, agg(2, "leader_2") ] },
		PROMPT_LEADER_DOPPELGANGER:                     { "SWE|ENG": [ REF, agg(2, "leader_doppelganger"), REF ] },
		PROMPT_LEADER_FEUDINGALIENS:                    { "SWE|ENG": [ agg(2, "leader_feudingaliens_1"), agg(4, "leader_feudingaliens_2") ] },
		PROMPT_LOVERS:                                  { "SWE|ENG": [ REF, "wake_and_identify", "lovers_1", REF ] },
		PROMPT_MARKSMAN_ACTION:                         { "SWE|ENG": [ "marksman_1", "marksman_2" ] },
		PROMPT_MASON:                                   { "SWE|ENG": [ REF, REF, "wake_and_identify", REF, "generic_sleep" ] },
		PROMPT_MASON_DOPPELGANGER:                      { "SWE|ENG": [ agg(4, "mason_doppelganger") ] },
		PROMPT_MINION:                                  { "SWE|ENG": [ REF, agg(4, "minion_1"), REF, REF, agg(2, "minion_2") ] },
		PROMPT_MINION_DOPPELGANGER:                     { "SWE|ENG": [ REF, agg(2, "minion_doppelganger"), REF ] },
		PROMPT_NOSTRADAMUS_ACTION:                      { "SWE|ENG": [ "nostradamus_1", REF ] },
		PROMPT_NOSTRADAMUS_DOPPELGANGER:                { "SWE|ENG": [ agg(4, "nostradamus_doppelganger") ] },
		PROMPT_NOSTRADAMUS_SUFFIX:                      { "SWE|ENG": [ "nostradamus_5", REF ] },
		PROMPT_NOSTRADAMUS_WARNING:                     { "SWE|ENG": [ "paranormalinvestigator_2", REF, "nostradamus_3", REF ] },
		PROMPT_NOSTRADAMUS_WARNING_AUTO_HINT:           { "SWE|ENG": [ "nostradamus_auto" ] },
		PROMPT_NOSTRADAMUS_WARNING_RESOLVED:            { "SWE|ENG": [ agg(2, "nostradamus_4"), REF, REF ] },
		PROMPT_ORACLE_BLOCK_ACTION:                     { "SWE|ENG": [ "all_hands_out", agg(2, "oracle_block_1"), "oracle_block_2" ] },
		PROMPT_ORACLE_CHANGE_TEAM:                      { "SWE|ENG": [ c_agg(3, { TEAM_WEREWOLF_DEFINITE_GENITIVE: "oracle_join_werewolves", TEAM_ALIEN_DEFINITE_GENITIVE: "oracle_join_aliens", TEAM_VAMPIRE_DEFINITE_GENITIVE: "oracle_join_vampires" }) ] },
		PROMPT_ORACLE_CHANGE_TEAM_DECLINED:             { "SWE|ENG": [ agg(4, "oracle_join_denied") ] },
		PROMPT_ORACLE_CHANGE_TEAM_FULL:                 { "SWE|ENG": [ agg(2, "oracle_join_full") ] },
		PROMPT_ORACLE_CHANGE_TEAM_PARTIAL:              { "SWE|ENG": [ agg(2, "oracle_join_partial") ] },
		PROMPT_ORACLE_EVEN_ODD_AUTO:                    { "SWE|ENG": [ "oracle_even_odd" ] },
		PROMPT_ORACLE_EVEN_ODD_RESULT:                  { "SWE|ENG": [ c_agg(4, { PROMPT_EVEN: "oracle_even", PROMPT_ODD: "oracle_odd" }) ] },
		PROMPT_ORACLE_FORCE_RIPPLE:                     { "SWE|ENG": [ "oracle_force_ripple" ] },
		PROMPT_ORACLE_FORCE_RIPPLE_NO:                  { "SWE|ENG": [ "oracle_force_ripple_no" ] },
		PROMPT_ORACLE_FORCE_RIPPLE_YES:                 { "SWE|ENG": [ "oracle_force_ripple_yes" ] },
		PROMPT_ORACLE_HUNT:                             { "SWE|ENG": [ "oracle_hunt_intro", REF ] },
		PROMPT_ORACLE_HUNT_AVOIDED:                     { "SWE|ENG": [ agg(2, "oracle_guess_right_1"), "oracle_guess_right_2", REF ] },
		PROMPT_ORACLE_HUNT_OMNISCIENCE:                 { "SWE|ENG": [ "oracle_guess_right_3", REF ] },
		PROMPT_ORACLE_HUNT_QUESTION_1:                  { "SWE|ENG": [ "oracle_q_1", REF ] },
		PROMPT_ORACLE_HUNT_QUESTION_2:                  { "SWE|ENG": [ "oracle_q_2", REF ] },
		PROMPT_ORACLE_HUNT_QUESTION_3:                  { "SWE|ENG": [ "oracle_q_3", REF ] },
		PROMPT_ORACLE_HUNT_QUESTION_4:                  { "SWE|ENG": [ "oracle_q_4", REF ] },
		PROMPT_ORACLE_HUNT_QUESTION_5:                  { "SWE|ENG": [ "oracle_q_5", REF ] },
		PROMPT_ORACLE_HUNT_STARTED:                     { "SWE|ENG": [ agg(2, "oracle_guess_wrong_1"), agg(2, "oracle_guess_wrong_2"), agg(2, "oracle_guess_wrong_3") ] },
		PROMPT_PARANORMALINVESTIGATOR_ACTION:           { "SWE|ENG": [ "paranormalinvestigator_1", REF ] },
		PROMPT_PARANORMALINVESTIGATOR_WARNING:          { "SWE|ENG": [ "paranormalinvestigator_2", REF, "paranormalinvestigator_3" ] },
		PROMPT_PICKPOCKET_ACTION:                       { "SWE|ENG": [ "pickpocket_1", "pickpocket_2" ] },
		PROMPT_PRIEST_ACTION:                           { "SWE|ENG": [ agg(2, "priest_1"), agg(2, "priest_2") ] },
		PROMPT_RASCAL_ACTION:                           { "SWE|ENG": [ REF ] },
		PROMPT_RENFIELD:                                { "SWE|ENG": [ REF, agg(3, "renfield_1"), REF, REF, REF, REF, agg(2, "renfield_3") ] },
		PROMPT_RENFIELD_ACTION:                         { "SWE|ENG": [ agg(4, "renfield_2") ] },
		PROMPT_RENFIELD_DOPPELGANGER:                   { "SWE|ENG": [ REF, agg(3, "renfield_doppelganger"), REF, REF, REF ] },
		PROMPT_REVEALER_ACTION:                         { "SWE|ENG": [ "revealer_1", REF ] },
		PROMPT_REVEALER_HIDDEN_ROLE:                    { "SWE|ENG": [ "revealer_2", REF, "revealer_3" ] },
		PROMPT_RIPPLE_CONTENT:                          { "SWE|ENG": [ "ripple", REF ] },
		PROMPT_RIPPLE_ROLE_ACTION:                      { "SWE|ENG": [ "player", REF, "generic_wake", REF, "player", REF, "generic_sleep" ] },
		PROMPT_RIPPLE_TIMER:                            { "SWE|ENG": [ "ripple_timer" ] },
		PROMPT_RIPPLE_VIEW_PLAYER:                      { "SWE|ENG": [ "player", REF, "generic_wake", REF, "player", REF, "generic_sleep" ] },
		PROMPT_ROBBER_ACTION:                           { "SWE|ENG": [ "robber_1", "robber_2", "robber_3" ] },
		PROMPT_SEER_ACTION:                             { "SWE|ENG": [ "seer_1" ] },
		PROMPT_SENTINEL_ACTION:                         { "SWE|ENG": [ agg(3, "sentinel_1"), "sentinel_2" ] },
		PROMPT_SLEEP_CALL:                              { "SWE|ENG": [ REF, "generic_sleep" ] },
		PROMPT_SLEEP_CALL_DOPPELGANGER:                 { "SWE|ENG": [ REF, "generic_sleep" ] },
		PROMPT_SQUIRE:                                  { "SWE|ENG": [ REF, agg(4, "squire_1"), REF, "shared_may_view_cards", REF, REF, agg(2, "minion_2") ] },
		PROMPT_SQUIRE_DOPPELGANGER:                     { "SWE|ENG": [ REF, agg(2, "minion_doppelganger"), REF, "shared_may_view_cards", REF ] },
		PROMPT_THING_ACTION:                            { "SWE|ENG": [ "all_hands_out", agg(2, "thing_2") ] },
		PROMPT_TROUBLEMAKER_ACTION:                     { "SWE|ENG": [ "troublemaker_1" ] },
		PROMPT_VAMPIRE_TEAM:                            { "SWE|ENG": [ REF, "wake_and_identify", agg(2, "vampire_team_1"), REF, "generic_sleep" ] },
		PROMPT_VIEW_CARD:                               { "SWE|ENG": [ "view_card_prefix_solo", REF ] },
		PROMPT_VIEW_CARD_CENTER:                        { "SWE|ENG": [ REF, "view_card_suffix_center" ] },
		PROMPT_VIEW_CARD_NEIGHBOR_ANY:                  { "SWE|ENG": [ "view_card_suffix_any_neighbor" ] },
		PROMPT_VIEW_CARD_NEIGHBOR_BOTH:                 { "SWE|ENG": [ "view_card_suffix_both_neighbors" ] },
		PROMPT_VIEW_CARD_NEIGHBOR_LEFT:                 { "SWE|ENG": [ "view_card_suffix_left_neighbor" ] },
		PROMPT_VIEW_CARD_NEIGHBOR_RIGHT:                { "SWE|ENG": [ "view_card_suffix_right_neighbor" ] },
		PROMPT_VIEW_CARD_SELF:                          { "SWE|ENG": [ "view_card_suffix_own" ] },
		PROMPT_VILLAGEIDIOT_ACTION:                     { "SWE|ENG": [ "villageidiot_1" ] },
		PROMPT_WAKE_CALL:                               { "SWE|ENG": [ REF, "generic_wake" ] },
		PROMPT_WAKE_CALL_DOPPELGANGER_ECHO:             { "SWE|ENG": [ agg(2, "doppelganger_wake_prefix"), REF, "generic_wake" ] },
		PROMPT_WAKE_CALL_DOPPELGANGER_INLINE:           { "SWE|ENG": [ agg(2, "doppelganger_wake_prefix"), REF, "generic_wake" ] },
		PROMPT_WEREWOLF_TEAM_CORE_DREAMWOLF:            { "SWE|ENG": [ REF, agg(2, "werewolf_team_dreamwolf_1"), "wake_and_identify", agg(4, "werewolf_team_dreamwolf_2"), agg(3, "werewolf_team_1"), REF, "thumb_down", REF, "generic_sleep" ] },
		PROMPT_WEREWOLF_TEAM_CORE_STANDARD:             { "SWE|ENG": [ REF, "wake_and_identify", agg(3, "werewolf_team_1"), REF, "generic_sleep" ] },
		PROMPT_WITCH_ACTION:                            { "SWE|ENG": [ "witch_1", "witch_2" ] },
		
		// These keys need separate English and Swedish definitions, either due to player/card plural forms that needs conditional (or no) aggregation or different clips, or due to different sentence structure
		PROMPT_ALIEN_TEAM_ACTION_TRADE_CARDS:           { SWE: [ c_agg(5, { DIRECTION_LEFT: "alien_team_shift_cards_left", DIRECTION_RIGHT: "alien_team_shift_cards_right" }) ] },
		PROMPT_ALPHAWOLF_ACTION:                        { SWE: [ agg(2, "alphawolf_1") ] },
		PROMPT_BLOB_OBJECTIVE_MULTI:                    { SWE: [ "blob_multi_1", REF, c_agg(2, { "GRAMMAR_PLAYER_SINGULAR,GRAMMAR_PLAYER_PLURAL": "blob_multi_2" }),REF, c_agg(2, { "GRAMMAR_PLAYER_SINGULAR,GRAMMAR_PLAYER_PLURAL": "blob_multi_3" }) ] },
		PROMPT_RIPPLE_DOUBLE_VOTE:                      { SWE: [ "player", REF, "ripple_double_vote" ] },
		PROMPT_RIPPLE_MUTED:                            { SWE: [ "player", REF, "ripple_mute" ] },
		PROMPT_RIPPLE_REBUKED:                          { SWE: [ "player", REF, "ripple_rebuke" ] },
		PROMPT_VIEW_CARD_EVEN:                          { SWE: [ REF, c_agg(2, { "GRAMMAR_CARD_SINGULAR,GRAMMAR_CARD_PLURAL": "view_card_suffix_even_players" }) ] },
		PROMPT_VIEW_CARD_ODD:                           { SWE: [ REF, c_agg(2, { "GRAMMAR_CARD_SINGULAR,GRAMMAR_CARD_PLURAL": "view_card_suffix_odd_players" }) ] },
		PROMPT_VIEW_CARD_PLAYER_ANY:                    { SWE: [ REF, c_agg(4, { "GRAMMAR_CARD_SINGULAR|PROMPT_VIEW_CARD_PLAYER_ANY_SINGLE|GRAMMAR_PLAYER_SINGULAR": "view_card_suffix_one_player", "GRAMMAR_CARD_PLURAL|PROMPT_VIEW_CARD_PLAYER_ANY_MULTI|GRAMMAR_PLAYER_PLURAL": "view_card_suffix_other_players", }) ] },
		PROMPT_VIEW_CARD_PLAYER_SPECIFIC:               { SWE: [ c_agg(3, { "GRAMMAR_CARD_SINGULAR|GRAMMAR_PLAYER_SINGULAR": "view_card_playerlist_prefix", "GRAMMAR_CARD_PLURAL|GRAMMAR_PLAYER_PLURAL": "view_card_playerlist_prefix", }), REF ] },
	};
	
	// Plain announcement clips; key -> clip mapping, no sentence boundaries or extras
	const ANNOUNCEMENT_CLIPS = {
		UI_DAYTIMER_60S_WARNING: { "SWE|ENG": "timer_60s_warning" },
		UI_DAYTIMER_30S_WARNING: { "SWE|ENG": "timer_30s_warning" },
		UI_DAYTIMER_EXPIRED:     { "SWE|ENG": "timer_expired" },
	};

	/*
	 * (key,index)/value ref -> clip name, flattened from `MANIFEST` plus role/number auto-registration - see
	 * _init. Consulted first in lookup (via _coverParts) - a single part's own clip.
	 *
	 * A ref is the stable, language-independent address every part Interpreter hands this module already
	 * carries (see Interpreter's _splitRenderedParts, and Localization's parseTemplate underneath it):
	 * { type: "span", key, index } for text traced to a specific localization key's own template, or
	 * { type: "value", value } for a raw number - regardless of how many {...} hops of Identity/Select/If/etc.
	 * it took to resolve there. That means lookup is never about *wording* at all: two parts are the same lookup
	 * iff they carry the same ref, full stop, whatever any language's text for that key currently says - see
	 * localization.js's parseTemplate (specifically its addLiteralSpans helper) for exactly how span refs are
	 * derived.
	 */
	let _map = null;
	
	// Flattened key -> clip name map for announcements
	let _announcementMap = null;

	/*
	 * Exact-ref aggregation entries - { refs: [ref,...], clip }, compiled from authored groups (see
	 * _registerGroup) - a whole run of parts collapsing to one better-prosody recording. Consulted alongside
	 * _map in lookup (via _coverParts), always preferred over the equivalent individual clips when a full
	 * match is found, since it always costs fewer total clips.
	 */
	let _templates = null;


	/* =========================
	   Initialization
	   ========================= */

	function _init() {
		_map = new Map();
		_announcementMap = new Map();
		_templates = [];

		const language = Localization.getLanguage();

		_initNumbers();
		_initRoles();
		
		// Init MANIFEST entries
		for (const [key, variants] of Object.entries(MANIFEST)) {
			const entry = _selectVariant(key, variants, language);

			if (entry !== undefined)
				_registerKey(key, entry);
		}
		
		// Init ANNOUNCEMENT_CLIPS entries
		for (const [key, variants] of Object.entries(ANNOUNCEMENT_CLIPS)) {
			const clip = _selectVariant(key, variants, language);

			if (clip !== undefined) {
				if (typeof clip !== "string" || clip === "")
					throw new Error(`ClipSelector: announcement "${key}" must name a non-empty clip`);

				_announcementMap.set(key, clip);
			}
		}
	}

	_init();
	
	/*
	 * Registers every defined number 1..COUNT twice: once by its raw digit string (the { type: "value" } ref
	 * Interpreter's Value/Literal primitives produce) and once by its spelled-word key, e.g. NUM_ONE (an
	 * ordinary leaf key {NUM_WORD} resolves to via a Select on `count` - see localization.js's _initNumbers).
	 * Both forms exist for the same reason and cost nothing extra to cover: NUMBER_DATA already carries the
	 * key name, so there's no language-specific text to look up for either registration.
	 */
	function _initNumbers() {
		const table = Localization.getNumberTable();

		for (let value = 1; value <= table.COUNT; value++) {
			const [key] = table[value];
			const clip = `num_${value}`;

			_map.set(_refKey({ type: "value", value: String(value) }), clip);
			_map.set(_refKey({ type: "span", key: `NUM_${key}`, index: 0 }), clip);
		}
	}

	/*
	 * Registers every grammatical form of every enabled role/team's name, straight from the key-naming
	 * convention - no text lookup needed at all, since a role name's own leaf key always resolves to exactly
	 * one span, index 0 (see the MANIFEST header comment). This is what makes role/number coverage
	 * language-independent for free: nothing here depends on what any language's localization strings
	 * actually say.
	 */
	function _initRoles() {
		const forms = [
			{ keySuffix: "",                          clipSuffix: ""      },
			{ keySuffix: "_DEFINITE",                 clipSuffix: "_d"    },
			{ keySuffix: "_PLURAL",                   clipSuffix: "_p"    },
			{ keySuffix: "_GENITIVE",                 clipSuffix: "_g"    },
			{ keySuffix: "_PLURAL_DEFINITE",          clipSuffix: "_p_d"  },
			{ keySuffix: "_DEFINITE_GENITIVE",        clipSuffix: "_d_g"  },
			{ keySuffix: "_PLURAL_GENITIVE",          clipSuffix: "_p_g"  },
			{ keySuffix: "_PLURAL_DEFINITE_GENITIVE", clipSuffix: "_p_d_g" },
		];

		const roles = Roles.getAllEnabled();
		const teams = new Set();

		function addForms(baseKey) {
			const clipBase = baseKey.toLowerCase();

			forms.forEach(({ keySuffix, clipSuffix }) => {
				const refKey = _refKey({ type: "span", key: baseKey + keySuffix, index: 0 });
				if (!_map.has(refKey))
					_map.set(refKey, clipBase + clipSuffix);
			});
		}

		// Roles take precedence over teams (addForms' _map.has guard means whichever is added first wins).
		roles.forEach((role) => { addForms(role.nameKey); teams.add(role.team); });
		// Special case for the feuding aliens expansion as they are not proper roles
		[ "ROLE_FEUDINGALIENS_GROOB", "ROLE_FEUDINGALIENS_ZERB" ].forEach((roleID) => { addForms(roleID); });
		teams.forEach((team) => addForms(team));
	}

	/*
	 * Validates and compiles one MANIFEST entry (a single-language variant array, already picked by
	 * _selectVariant) against the key's own template positions, then registers it into `_map`/`_templates`.
	 *
	 * Walks the array left to right, consuming one template position per plain item (a literal clip name for a
	 * literal position, or REF for a {...} reference) and `item.count` positions per agg/ c_agg item, recording
	 * each aggregate's range as a `groups` entry instead of slotting it position-by-position. Once every
	 * position is accounted for, non-aggregated literal positions are registered directly into `_map`, and each
	 * recorded group is compiled via _registerGroup/_registerConditionalGroup. Throws on any mismatch between the
	 * entry and the key's actual template shape - wrong item count, a literal position without a clip name, a REF
	 * on a position that isn't a {...} reference, or an aggregate spanning past the end of the array.
	 */
	function _registerKey(key, entry) {
		if (!Array.isArray(entry) || entry.length === 0)
			throw new Error(`ClipSelector: entry "${key}" must be a non-empty MANIFEST array`);

		if (Localization.parseTemplate(key) === undefined)
			throw new Error(`ClipSelector: entry "${key}" doesn't match any localization key`);

		const positions = _templatePositions(key);
		const slots = new Array(positions.length);
		const groups = [];
		let positionIndex = 0;

		for (const item of entry) {
			if (Array.isArray(item)) {
				throw new Error(`ClipSelector: entry "${key}" contains a bare nested array; use agg(count, "clip") or c_agg(count, {...})`);
			}

			if (item && typeof item === "object" && item[AGGREGATE] === true) {
				const isConditional = Object.prototype.hasOwnProperty.call(item, "alternatives");

				if (!isConditional && (typeof item.clip !== "string" || item.clip === ""))
					throw new Error(`ClipSelector: entry "${key}" aggregate must have a non-empty clip name`);

				if (!Number.isInteger(item.count) || item.count <= 0)
					throw new Error(`ClipSelector: entry "${key}" aggregate must have a positive integer count`);

				if (isConditional) {
					if (!item.alternatives || typeof item.alternatives !== "object" || Array.isArray(item.alternatives)) {
						throw new Error(`ClipSelector: entry "${key}" conditional aggregate must have an alternatives object`);
					}

					if (Object.keys(item.alternatives).length === 0) {
						throw new Error(`ClipSelector: entry "${key}" conditional aggregate must define at least one alternative`);
					}
				}

				const start = positionIndex;
				const end = start + item.count - 1;

				if (end >= positions.length) {
					throw new Error(`ClipSelector: entry "${key}" aggregate spans ${item.count} position(s) starting at ${start}, but its template has only ${positions.length} position(s)`);
				}

				if (isConditional) {
					groups.push({ type: "conditional", range: [start, end], alternatives: item.alternatives });
				} else {
					groups.push({ type: "aggregate", range: [start, end], aggregate: item.clip });
				}

				positionIndex += item.count;
				continue;
			}

			if (positionIndex >= positions.length) {
				throw new Error(`ClipSelector: entry "${key}" contains more authored positions than its template`);
			}

			slots[positionIndex] = item;
			positionIndex++;
		}

		if (positionIndex !== positions.length) {
			throw new Error( `ClipSelector: entry "${key}" describes ${positionIndex} position(s) but its template has ${positions.length}`);
		}

		const aggregated = new Array(positions.length).fill(false);

		for (const group of groups) {
			for (let i = group.range[0]; i <= group.range[1]; i++)
				aggregated[i] = true;
		}

		for (let i = 0; i < positions.length; i++) {
			if (aggregated[i])
				continue;

			const position = positions[i];
			const slot = slots[i];

			if (position.kind === "literal") {
				if (typeof slot !== "string" || slot === "") {
					throw new Error(`ClipSelector: entry "${key}" position ${i} is a literal span and must be a non-empty clip name string`);
				}

				_map.set(_refKey({ type: "span", key, index: position.index }), slot);
			} else if (slot !== REF) {
				throw new Error(`ClipSelector: entry "${key}" position ${i} is a {...} reference and must be REF`);
			}
		}

		groups.forEach((group) => {
			if (group.type === "conditional")
				_registerConditionalGroup(key, positions, group);
			else
				_registerGroup(key, positions, group);
		});
	}

	/*
	 * Picks the one variant of a key's entry that covers the current language - see the MANIFEST header
	 * comment for what a variant's language-set key means. Exactly one of a key's variants must cover any
	 * given language to be valid. No key covering it means this key has never been authored for that language,
	 * which is recoverable by falling back on browser synthesis and requires a graceful failure. More than one 
	 * covering it is an authoring mistake (two variants both claiming the same language is ambiguous - which one
	 * should win is never something to guess at, so both fail loudly at init.
	 */
	function _selectVariant(key, variants, language) {
		const matches = Object.entries(variants).filter(([langSet]) => langSet.split("|").includes(language));
		
		if (matches.length === 0)
			return undefined;
		
		if (matches.length > 1)
			throw new Error(`ClipSelector: entry "${key}" has overlapping variants both covering language "${language}": ` + matches.map(([langSet]) => langSet).join(", "));

		return matches[0][1];
	}

	/*
	 * Converts a structural narration reference into a stable Map key.
	 *
	 * ClipSelector never matches on rendered wording. It only matches the structural reference supplied by
	 * Interpreter.renderContent().
	 */
	function _refKey(ref) {
		if (!ref)
			return null;

		if (ref.type === "span")
			return `span:${ref.key}:${ref.index}`;

		if (ref.type === "value")
			return `value:${String(ref.value)}`;

		return null;
	}

	/*
	 * Converts a parsed localization template into the ordered positions an authored MANIFEST entry describes.
	 *
	 * Localization.parseTemplate() is the single source of truth for template structure. It has already split
	 * literal text at sentence boundaries and assigned each literal span its stable (key,index) reference.
	 *
	 * Positions that do not correspond to independently recorded narration content are removed:
	 *   - punctuation/whitespace-only spans
	 *   - Pause, Break and Input expressions
	 *
	 * Remaining expressions are classified as:
	 *   - static  - bare {KEY} references whose target is independent of turn data
	 *   - dynamic - primitive calls whose target depends on turn data
	 */
	function _templatePositions(key) {
		const template = Localization.parseTemplate(key);

		if (template === undefined)
			throw new Error(`ClipSelector: entry "${key}" doesn't match any localization key`);

		const positions = [];

		for (const node of template) {

			if (node.type === "span") {
				if (_isMeaningfulSpan(node.text)) {
					positions.push({ kind: "literal", index: node.index });
				}

				continue;
			}

			if (node.type === "expression" && (node.name === "Pause" || node.name === "Break" || node.name === "Input")) {
				continue;
			}

			if (node.type === "expression") {
				positions.push({ kind: node.args.length === 0 ? "static" : "dynamic", key: node.name });
			}
		}

		return positions;
	}

	/*
	 * Compiles one authored conditional group - { range: [startPos, endPos], alternatives } - into one
	 * _templates entry per concrete combination of dynamic keys.
	 *
	 * Each key of `alternatives` encodes one concrete choice per dynamic position in the range, "|"-separated in
	 * position order; a position with more than one possible target key lists them comma-separated within its
	 * own segment (e.g. "GRAMMAR_CARD_SINGULAR,GRAMMAR_CARD_PLURAL|SOME_OTHER_KEY" - two alternatives for the
	 * first dynamic position, one for the second). _cartesianProduct expands that into every real combination,
	 * and _resolveGroupRefs resolves each combination to its exact refs, same as a plain (non-conditional)
	 * group's static/literal positions - see there.
	 */
	function _registerConditionalGroup(key, positions, group) {
		const [start, end] = group.range;
		const alternatives = group.alternatives;

		const dynamicCount = positions
				.slice(start, end + 1)
				.filter(position => position.kind === "dynamic")
				.length;

		for (const [encodedKeys, clip] of Object.entries(alternatives)) {
			const positionKeyLists = encodedKeys.split("|").map(segment => segment.split(",").map(k => k.trim()));

			if (positionKeyLists.length !== dynamicCount)
				throw new Error( `ClipSelector: entry "${key}" conditional aggregate [${start}, ${end}] expects ${dynamicCount} dynamic key(s), but alternative "${encodedKeys}" provides ${positionKeyLists.length}`);

			for (const dynamicKeys of _cartesianProduct(positionKeyLists)) {
				const refs = _resolveGroupRefs(key, positions, start, end, dynamicKeys);
				_templates.push({ refs, clip });
			}
		}
	}

	/*
	 * Validates one authored group - { range: [startPos, endPos], aggregate: clipName } - then compiles it into
	 * a single _templates entry via _resolveGroupRefs. The counterpart to _registerConditionalGroup: a plain
	 * group collapses its range to exactly one clip name regardless of turn data, so there's no dynamicKeys to
	 * supply and no data-dependent position is ever valid within it.
	 */
	function _registerGroup(key, positions, group) {
		const [start, end] = group.range;

		if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= positions.length)
			throw new Error(`ClipSelector: entry "${key}" has a group with an invalid range [${start}, ${end}] for ${positions.length} slot(s)`);
		if (typeof group.aggregate !== "string" || group.aggregate === "")
			throw new Error(`ClipSelector: entry "${key}" has a group with no aggregate clip name`);

		const refs = _resolveGroupRefs(key, positions, start, end);

		_templates.push({ refs, clip: group.aggregate });
	}

	/*
	 * True if a span has any letter/digit content worth its own clip - mirrors the exact filter Interpreter's
	 * _splitRenderedParts already applies when building each sentence's source list, so a span this says is
	 * "meaningless" here is guaranteed to never actually reach lookup as a part, and vice versa.
	 */
	function _isMeaningfulSpan(text) {
		return /[\p{L}\p{N}]/u.test(text);
	}

	/*
	 * All combinations of one item from each list, e.g. [["A","B"],["X"]] -> [["A","X"],["B","X"]]. Used by
	 * _registerConditionalGroup to expand a conditional aggregate's comma-separated per-position alternatives
	 * into one template per real combination.
	 */
	function _cartesianProduct(lists) {
		return lists.reduce((combos, list) => combos.flatMap((combo) => list.map((item) => [...combo, item])), [[]]);
	}

	/*
	 * Resolves one group's range - positions[start..end] - to the exact refs _templates needs, one call per
	 * concrete template (a plain group has exactly one; a conditional group produces one per combination from
	 * _registerConditionalGroup's cartesian expansion):
	 *   - "literal" positions already have one (this key's own just-registered span ref).
	 *   - "static" positions (a bareword {OTHER_KEY} reference) resolve to that key's own ref, recursively -
	 *     but only if OTHER_KEY is itself a simple one-span leaf (no {...} of its own); otherwise a single
	 *     group position could stand for more than one part at runtime, which this exact-ref mechanism can't
	 *     represent (see the MANIFEST header comment on why aggregation is deliberately static-only).
	 *   - "dynamic" positions (a primitive call with arguments) have no fixed ref to compile ahead of time on
	 *     their own - which key they resolve to depends on turn data. A plain group (dynamicKeys === null) can
	 *     never include one; a conditional group supplies the concrete target key for each dynamic position in
	 *     the range via dynamicKeys, one entry per dynamic position in order, already picked out of one
	 *     alternative by the caller.
	 */
	function _resolveGroupRefs(key, positions, start, end, dynamicKeys = null) {
		const refs = [];
		let dynamicIndex = 0;

		for (let i = start; i <= end; i++) {
			const position = positions[i];

			if (position.kind === "literal") {
				refs.push({ type: "span", key, index: position.index });
				continue;
			}

			if (position.kind === "static") {
				refs.push(..._expandStaticKey(key, i, position.key));
				continue;
			}

			// Dynamic position.
			if (dynamicKeys === null) {
				throw new Error(`ClipSelector: entry "${key}" group [${start}, ${end}] includes slot ${i}, a data-dependent {...} reference - use c_agg(...) to provide an explicit alternative key`);
			}

			if (dynamicIndex >= dynamicKeys.length) {
				throw new Error(`ClipSelector: entry "${key}" conditional aggregate has too few dynamic keys for the dynamic positions in range [${start}, ${end}]`);
			}

			const targetKey = dynamicKeys[dynamicIndex++];
			refs.push(..._expandStaticKey(key, i, targetKey));
		}

		if (dynamicKeys !== null && dynamicIndex !== dynamicKeys.length) {
			throw new Error(`ClipSelector: entry "${key}" conditional aggregate supplied ${dynamicKeys.length} dynamic key(s), but the range [${start}, ${end}] contains ${dynamicIndex} dynamic position(s)`);
		}

		return refs;
	}

	/*
	 * Recursively expands a static ({OTHER_KEY}, no arguments) reference into the exact structural references
	 * produced by that key.
	 *
	 * The template structure comes directly from Localization.parseTemplate() through _templatePositions(), so
	 * ClipSelector no longer maintains a second copy of Localization's template parser.
	 *
	 * Expansion is only valid when every position is static or literal. A dynamic expression would depend on turn
	 * data and therefore cannot be part of a precompiled aggregate.
	 */
	function _expandStaticKey(fromKey, slotIndex, targetKey, seen = new Set()) {
		if (seen.has(targetKey)) {
			throw new Error(`ClipSelector: entry "${fromKey}" slot ${slotIndex} - static reference cycle involving "${targetKey}"`);
		}

		if (Localization.parseTemplate(targetKey) === undefined) {
			throw new Error(`ClipSelector: entry "${fromKey}" slot ${slotIndex} references unknown key "${targetKey}"`);
		}

		const refs = [];

		for (const position of _templatePositions(targetKey)) {

			if (position.kind === "literal") {
				refs.push({ type: "span", key: targetKey, index: position.index });

			} else if (position.kind === "static") {
				refs.push(..._expandStaticKey(fromKey, slotIndex, position.key, new Set(seen).add(targetKey)));

			} else {
				throw new Error(`ClipSelector: entry "${fromKey}" slot ${slotIndex} references "${targetKey}", which contains a data-dependent {...} reference of its own - a group can't cover it`);
			}
		}

		return refs;
	}


	/* =========================
	   Private functions
	   ========================= */

	/*
	 * Finds the fewest logical recordings needed to cover an entire rendered content unit.
	 *
	 * `parts` are the rendered source fragments returned by Interpreter.renderContent():
	 *
	 *     { text, ref }
	 *
	 * Only `ref` participates in matching. `text` is deliberately ignored.
	 *
	 * Individual recordings and authored aggregate recordings are considered together. A complete covering is
	 * required; returning null tells AutoNarrator to synthesize the entire rendered unit instead.
	 */
	function _coverParts(parts) {
		const n = parts.length;

		const best = new Array(n + 1).fill(null);
		best[0] = [];

		for (let end = 1; end <= n; end++) {
			// Try the individual recording for the final part.
			if (best[end - 1] !== null) {
				const clip = _map.get(_refKey(parts[end - 1]?.ref));

				if (clip !== undefined) {
					best[end] = [ ...best[end - 1], clip ];
				}
			}

			// Try every aggregate whose final reference lands at this position.
			for (const template of _templates) {
				const length = template.refs.length;

				const start = end - length;

				if (start < 0 || best[start] === null) {
					continue;
				}

				if (best[end] !== null && best[start].length + 1 >= best[end].length) {
					continue;
				}

				let matches = true;

				for (let i = 0; i < length; i++) {
					if (_refKey(parts[start + i]?.ref) !== _refKey(template.refs[i])) {
						matches = false;
						break;
					}
				}

				if (matches) {
					best[end] = [ ...best[start], template.clip ];
				}
			}
		}

		return best[n];
	}


	/* =========================
	   Public functions
	   ========================= */

	/*
	 * Attempts to find recordings covering every part of one rendered content unit.
	 *
	 * The returned names are logical clip names. ClipSelector does not inspect or resolve those names, and never
	 * checks whether they actually exist in the atlas - ClipPlayback owns the mapping from logical clip names to
	 * physical audio, and ClipPlayback.resolve() is responsible for checking this function's result against it
	 * before treating anything as playable.
	 */
	function resolve(parts) {
		if (!Array.isArray(parts) || parts.length === 0)
			return null;

		const clips = _coverParts(parts);

		if (clips === null) {
			for (const part of parts) {
				const refKey = _refKey(part?.ref);

				if (!_map.has(refKey)) {
					console.log(`[ClipSelector] no recording for structural reference: ${refKey ?? "unattributed"}`);
				}
			}
		}

		return clips;
	}

	// Attempts to find recordings for an announcement from a simple key
	function resolveAnnouncement(key) {
		return _announcementMap.get(key) ?? null;
	}


	return {
		resolve,
		resolveAnnouncement,
	};
})();