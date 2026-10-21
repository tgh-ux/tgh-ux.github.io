/*
 * Maps narration to pre-recorded clip names for automatic (spoken) narration - see ClipPlayback for how a clip name actually gets turned
 * into audio; this module only decides *which* clip names a turn needs, or that none exist and the caller should fall back to synthesis.
 *
 * Pure decision layer - no I/O, no audio, no knowledge of whether a clip it names actually exists in the atlas. Not called directly outside
 * ClipPlayback.resolve() - that's the only place that composes this module with physical-clip existence checks, and the only module that
 * should ever import this one. This module deciding *which* names are needed and ClipPlayback deciding whether they *exist* stay separate
 * concerns on purpose: an author changing which clip covers a phrase, and a repack changing what's actually recorded, are different kinds
 * of change with different failure modes, and conflating them would mean an atlas gap looks identical to an authoring mistake instead of
 * being flagged as what it actually is.
 *
 * Lookup is always by structural ref, never by wording - see the `_map` comment below for what a ref is and where it comes from. `MANIFEST`
 * below is this module's primary authored data; see its own comment for what needs an entry and how an entry is written.
 * `ANNOUNCEMENT_CLIPS` is secondary authored data specifically for simple, plain clips, without the more advanced functionality of the main
 * manifest.
 */
const ClipSelector = (() => {

	/* =========================
	   Data
	   ========================= */

	// Marks a MANIFEST position occupied by a template reference ({...}).
	const REF = Symbol("position occupied by a {...} reference");
	// Identifies an aggregate MANIFEST entry.
	const AGGREGATE = Symbol("MANIFEST aggregate");

	/**
	 * Defines an aggregate clip covering the next `count` template positions.
	 *
	 * @param {number} count - Number of template positions covered.
	 * @param {string} clip - Clip name covering the complete range.
	 * @returns {object} Aggregate manifest descriptor.
	 */
	function agg(count, clip) { return { [AGGREGATE]: true, clip, count }; }

	/**
	 * Defines a conditional aggregate clip covering the next `count` template positions.
	 *
	 * `alternatives` maps an encoded set of possible target keys to a clip name. The key uses:
	 *    "|" - separates dynamic positions, in template order.
	 *    "," - separates alternative target keys for one dynamic position.
	 *
	 * For example:
	 *    { "KEY_A,KEY_B|KEY_C": "clip_name" }
	 * means:
	 *    - the first dynamic position may resolve to KEY_A or KEY_B; and
	 *    - the second dynamic position must resolve to KEY_C.
	 *
	 * Multiple comma-separated alternatives are expanded into all possible combinations. The number of `|`-separated positions must match
	 * the number of dynamic positions covered by the aggregate.
	 *
	 * @param {number} count - Number of template positions covered.
	 * @param {object} alternatives - Mapping of encoded dynamic-key combinations to clip names.
	 * @returns {object} Conditional aggregate manifest descriptor.
	 */
	function c_agg(count, alternatives) { return { [AGGREGATE]: true, count, alternatives }; }

	/*
	 * Hand-authored mapping from localization keys to recordings.
	 *
	 * Each top-level key identifies one localization template. Its value is an object mapping a language set (for example "SWE|ENG") to
	 * that language's manifest entry. A language-set key claims every language named in it. Exactly one variant must cover the active
	 * language.
	 *
	 * A manifest entry is an array describing the template from left to right:
	 *    "clip_name"                                   - Assigns a recording to one literal span produced by the key.
	 *    REF                                           - Marks a template reference ({...}). The referenced content is resolved and
	 *                                                    matched independently, so REF itself does not register a clip.
	 *    agg(count, "clip_name")                       - Uses one recording for the next `count` template positions instead of resolving
	 *                                                    those positions individually.
	 *    c_agg(count, { targetKey: "clip_name", ... }) - Conditional aggregate. The covered range contains data-dependent references. The
	 *                                                    alternatives object uses the comma/pipe syntax documented on c_agg() to describe
	 *                                                    which resolved keys can occur at each dynamic position.
	 *
	 * An entry is only required for a key whose own template contains literal content that needs a clip decision. Pure routing keys made
	 * entirely from other references generally need no manifest entry.
	 *
	 * The array must match the key's actual template structure exactly. REF positions consume a manifest slot but do not correspond to a
	 * literal span of the key itself. Aggregates consume multiple template positions at once.
	 *
	 * Role/team names and numbers are registered automatically during initialization and therefore normally do not appear in this table.
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
		PROMPT_ALPHAWOLF_ACTION:                        { "SWE|ENG": [ agg(2, "alphawolf_1") ] },
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
		PROMPT_BLOB_OBJECTIVE_MULTI:                    { SWE: [ "blob_multi_1", REF, c_agg(2, { "GRAMMAR_PLAYER_SINGULAR,GRAMMAR_PLAYER_PLURAL": "blob_multi_2" }),REF, c_agg(2, { "GRAMMAR_PLAYER_SINGULAR,GRAMMAR_PLAYER_PLURAL": "blob_multi_3" }) ] },
		PROMPT_RIPPLE_DOUBLE_VOTE:                      { SWE: [ "player", REF, "ripple_double_vote" ] },
		PROMPT_RIPPLE_MUTED:                            { SWE: [ "player", REF, "ripple_mute" ] },
		PROMPT_RIPPLE_REBUKED:                          { SWE: [ "player", REF, "ripple_rebuke" ] },
		PROMPT_VIEW_CARD_EVEN:                          { SWE: [ REF, c_agg(2, { "GRAMMAR_CARD_SINGULAR,GRAMMAR_CARD_PLURAL": "view_card_suffix_even_players" }) ] },
		PROMPT_VIEW_CARD_ODD:                           { SWE: [ REF, c_agg(2, { "GRAMMAR_CARD_SINGULAR,GRAMMAR_CARD_PLURAL": "view_card_suffix_odd_players" }) ] },
		PROMPT_VIEW_CARD_PLAYER_ANY:                    { SWE: [ REF, c_agg(4, { "GRAMMAR_CARD_SINGULAR|PROMPT_VIEW_CARD_PLAYER_ANY_SINGLE|GRAMMAR_PLAYER_SINGULAR": "view_card_suffix_one_player", "GRAMMAR_CARD_PLURAL|PROMPT_VIEW_CARD_PLAYER_ANY_MULTI|GRAMMAR_PLAYER_PLURAL": "view_card_suffix_other_players", }) ] },
		PROMPT_VIEW_CARD_PLAYER_SPECIFIC:               { SWE: [ c_agg(3, { "GRAMMAR_CARD_SINGULAR|GRAMMAR_PLAYER_SINGULAR": "view_card_playerlist_prefix", "GRAMMAR_CARD_PLURAL|GRAMMAR_PLAYER_PLURAL": "view_card_playerlist_prefix", }), REF ] },
	};

	/*
	 * Hand-authored recordings for standalone announcements.
	 *
	 * Maps localization keys to one clip name per language set. Unlike MANIFEST entries, announcements are single clips with no
	 * template-position matching or aggregation.
	 */
	const ANNOUNCEMENT_CLIPS = {
		UI_DAYTIMER_60S_WARNING: { "SWE|ENG": "timer_60s_warning" },
		UI_DAYTIMER_30S_WARNING: { "SWE|ENG": "timer_30s_warning" },
		UI_DAYTIMER_EXPIRED:     { "SWE|ENG": "timer_expired" },
	};

	// Structural-reference -> clip-name lookup generated from MANIFEST and automatic registrations.
	let _map = null;

	// Localization-key -> clip-name lookup for standalone announcements.
	let _announcementMap = null;

	/*
	 * Aggregate recordings compiled from MANIFEST aggregate definitions. Each entry contains the exact structural reference sequence it
	 * covers and its clip name.
	 */
	let _templates = null;


	/* =========================
	   Initialization
	   ========================= */

	/**
	 * Builds the runtime clip-selection tables for the active language.
	 *
	 * Initializes the lookup maps, registers generated number and role/team entries, then compiles the applicable MANIFEST and announcement
	 * entries. MANIFEST entries are validated against their localization templates during registration. Announcement entries are reduced to
	 * a simple key -> clip lookup.
	 */
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

	/**
	 * Registers clip mappings for all supported numbers.
	 *
	 * Each number is registered in two forms:
	 *   - a value reference for raw numeric values (as digits).
	 *   - the span reference of its localized NUM_* key (lexical representation).
	 *
	 * Both forms map to the corresponding `num_N` clip.
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

	/**
	 * Registers clip mappings for role and team names in every supported grammatical form.
	 *
	 * Role and team clip names are derived from their localization key names and the suffix convention used by the recording atlas. Roles
	 * are registered before teams, so a role mapping takes precedence when a role and team would otherwise produce the same structural
	 * reference.
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

	/**
	 * Validates and compiles one selected MANIFEST entry into the runtime lookup tables.
	 *
	 * The manifest array is matched against the ordered positions produced by _templatePositions(). Plain entries consume one position;
	 * `REF` marks a template reference; agg()/c_agg() consume the number of positions specified by `count`. Literal positions are
	 * registered directly in `_map`. Aggregate ranges are compiled into `_templates` through _registerGroup() or
	 * _registerConditionalGroup().
	 *
	 * Throws when the manifest entry does not exactly match the localization template, such as having the wrong number of positions, using
	 * a clip where REF is required, or defining an aggregate outside the template range.
	 *
	 * @param {string} key - Localization key represented by the manifest entry.
	 * @param {Array} entry - Language-specific MANIFEST entry.
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

	/**
	 * Selects the MANIFEST or announcement variant covering the active language.
	 *
	 * A variant language-set is written as language codes separated by `|`. Exactly one variant may claim the requested language. No match
	 * returns `undefined`; overlapping matches throw an initialization error.
	 *
	 * @param {string} key - Entry being selected, used for error reporting.
	 * @param {object} variants - Language-set -> entry mappings.
	 * @param {string} language - Active language code.
	 * @returns {*} Selected variant, or undefined when no variant covers the language.
	 * @throws {Error} If multiple variants claim the same language.
	 */
	function _selectVariant(key, variants, language) {
		const matches = Object.entries(variants).filter(([langSet]) => langSet.split("|").includes(language));

		if (matches.length === 0)
			return undefined;

		if (matches.length > 1)
			throw new Error(`ClipSelector: entry "${key}" has overlapping variants both covering language "${language}": ` + matches.map(([langSet]) => langSet).join(", "));

		return matches[0][1];
	}

	/**
	 * Converts a structural narration reference into the canonical lookup-map key.
	 *
	 * Span references use the localization key and span index; value references use the string form of the value. Other reference types are
	 * not addressable.
	 *
	 * @param {object|null} ref - Structural reference from Interpreter.
	 * @returns {string|null} Canonical map key, or null for an unsupported reference.
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

	/**
	 * Extracts the ordered clip-selection positions from a localization template.
	 *
	 * Meaningless literal spans, Pause, Break, and Input expressions are excluded. Remaining expressions are classified as:
	 *    `static`  - a bare localization-key reference with no arguments.
	 *    `dynamic` - an expression whose target depends on runtime data.
	 *
	 * The result is the position sequence against which MANIFEST entries are validated.
	 *
	 * @param {string} key - Localization key to inspect.
	 * @returns {object[]} Ordered template positions.
	 * @throws {Error} If the localization key does not exist.
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

	/**
	 * Compiles a conditional aggregate into one exact-reference template for each possible combination of its dynamic target keys.
	 *
	 * Each alternative key uses `|` to separate dynamic positions and `,` to list multiple possible target keys for one position. The
	 * combinations are expanded with _cartesianProduct(), then resolved into exact structural references.
	 *
	 * @param {string} key - Localization key owning the aggregate.
	 * @param {object[]} positions - Template positions for the key.
	 * @param {object} group - Conditional aggregate definition.
	 * @throws {Error} If an alternative does not provide exactly one segment per dynamic position.
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

	/**
	 * Compiles a fixed aggregate range into one exact-reference template.
	 *
	 * Unlike a conditional aggregate, every position in the range must be statically resolvable because the same clip is used regardless of
	 * runtime data.
	 *
	 * @param {string} key - Localization key owning the aggregate.
	 * @param {object[]} positions - Template positions for the key.
	 * @param {object} group - Fixed aggregate definition.
	 * @throws {Error} If the range or aggregate clip is invalid, or the range contains a data-dependent position.
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

	/** 
	 * Checks if a string contains a meaningful text span of at least one letter or digit.
	 *
	 * Mirrors the exact filter from Interpreter's _splitRenderedParts() when building each sentence's source list, and prevents spans that
	 * has no need to be narrated from reaching lookup.
	 *
	 * @returns {boolean} True if span satisfies conditions, else false.
	 */
	function _isMeaningfulSpan(text) {
		return /[\p{L}\p{N}]/u.test(text);
	}

	/**
	 * Expands one list of alternatives per dynamic position into every possible combination.
	 *
	 * Example: [["A", "B"], ["X"]] -> [["A", "X"], ["B", "X"]].
	 *
	 * @param {any[][]} lists - Alternative values for each position.
	 * @returns {any[][]} All possible combinations.
	 */
	function _cartesianProduct(lists) {
		return lists.reduce((combos, list) => combos.flatMap((combo) => list.map((item) => [...combo, item])), [[]]);
	}

	/**
	 * Resolves an aggregate range into the exact structural references used for lookup.
	 *
	 * Literal positions become spans belonging to the owning key. Static references are recursively expanded. Dynamic positions require an
	 * explicit target key from `dynamicKeys`, which is supplied by a conditional aggregate.
	 *
	 * @param {string} key - Localization key owning the aggregate.
	 * @param {object[]} positions - Template positions for the key.
	 * @param {number} start - First position in the aggregate range.
	 * @param {number} end - Last position in the aggregate range.
	 * @param {string[]|null} dynamicKeys - Target keys for dynamic positions, or null for a fixed aggregate.
	 * @returns {object[]} Exact structural references covered by the aggregate.
	 * @throws {Error} If a fixed aggregate contains a dynamic position or the supplied dynamic keys do not match the dynamic positions.
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

	/**
	 * Recursively expands a static localization-key reference into its exact structural references.
	 *
	 * Expansion is only valid when the referenced key contains no data-dependent expressions. Static reference cycles and unknown keys are
	 * rejected during initialization.
	 *
	 * @param {string} fromKey - MANIFEST key whose aggregate is being compiled.
	 * @param {number} slotIndex - Manifest/template position being resolved.
	 * @param {string} targetKey - Referenced localization key.
	 * @param {Set<string>} seen - Keys already visited in this expansion path.
	 * @returns {object[]} Exact structural references produced by the target key.
	 * @throws {Error} On cycles, unknown keys, or data-dependent content.
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

	/**
	 * Finds the fewest logical recordings needed to cover an entire rendered content unit.
	 *
	 * Each part is matched by its structural `ref`; the rendered `text` is ignored. Both individual clip mappings and aggregate templates
	 * are considered. A result is returned only when the complete sequence can be covered.
	 *
	 * @param {object[]} parts - Rendered content parts from Interpreter.renderContent().
	 * @returns {string[]|null} Ordered logical clip names, or null when the parts cannot be covered completely.
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

	/**
	 * Resolves a rendered content unit to a complete sequence of logical recording names.
	 *
	 * Matching is based on each part's structural `ref`, not its rendered text. Individual recordings and aggregate recordings are
	 * considered together, with aggregate matches allowing a sentence to be covered by fewer clips.
	 *
	 * Returns null for empty/invalid input or when no complete recording coverage exists. Missing individual references are logged when
	 * complete coverage cannot be found. The returned names are logical clip names only; physical atlas availability is checked by
	 * ClipPlayback.
	 *
	 * @param {object[]} parts - Rendered content parts from Interpreter.renderContent().
	 * @returns {string[]|null} Ordered logical clip names, or null when full coverage is unavailable.
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

	/**
	 * Resolves a standalone announcement localization key to its logical recording name.
	 *
	 * Unlike resolve(), announcements have no template-position matching; the key maps directly to one recording for the active language.
	 *
	 * @param {string} key - Localization key for the announcement.
	 * @returns {string|null} Logical clip name, or null when no recording is registered.
	 */
	function resolveAnnouncement(key) {
		return _announcementMap.get(key) ?? null;
	}


	return {
		resolve,
		resolveAnnouncement,
	};
})();
