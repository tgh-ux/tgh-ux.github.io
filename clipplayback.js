/*
 * Pre-recorded clip narration - the sole entry point Narration uses for the clip backend. Composes ClipSelector
 * (structural ref -> logical clip name, no I/O, no knowledge of physical audio) internally via resolve() and
 * playSequence() below, so Narration itself never talks to ClipSelector directly - see clipselector.js's own
 * header for why that split exists and stays that way even though the two are always used together.
 *
 * Below the composition, this module is the physical-clip layer: it owns the atlas data and how a clip name
 * actually turns into sound via the Web Audio API. Has no knowledge of narration structure, sentences, or
 * turns beyond what resolve()/playSequence() need to bridge to ClipSelector - a clip name is otherwise just an
 * opaque key to it. resolveAnnouncement() exists along side this as a way to play a singular clip rather than 
 * a sequence, intended for things such as warnings and announcements outside normal game narration (timers etc.)
 * Not called directly outside Narration (and the debug helper here), with one exception: the GUI calls preload()
 * directly at its own discretion.
 *
 * Data is split per active language (see _language, set once in _init()). ATLAS maps each
 * language to its atlas mp3 file. CLIPS maps a clip name (the same name ClipSelector resolves
 * clips to) to its {start, end} region within that language's atlas, in seconds -
 * regenerated wholesale by the packer script and pasted in here on every repack. CLIP_ALIAS
 * lets a clip name reuse another clip's entry verbatim (e.g. plural forms that happen to
 * share a recording) instead of being packed separately - applied once in _init(). hasClip()
 * and isAvailable() below both read CLIPS post-alias-merge, so an aliased name counts
 * as present the same as one packed directly.
 *
 * CLIP_GAP maps clip names to {pre, post} silence padding in seconds; TYPE_GAP does the same
 * for a clip's optional `type` - a shared default for a whole category (e.g. every "num" clip)
 * that CLIP_GAP's per-clip tuning stacks on top of rather than replaces (see _getSilence).
 * Both are looked up per language first, falling back to their COMMON entry, then to no gap;
 * an override replaces the COMMON entry wholesale rather than merging field-by-field. Neither
 * is touched by repacking.
 */
const ClipPlayback = (() => {

	/* =========================
	   Data
	   ========================= */

	/*
	 * Remote URL for the atlas file. Everything else in the project runs fine from a local folder
	 * (just open index.html), but fetch() can't read file:// URLs, so the atlas is hosted here and
	 * always fetched remotely rather than from disk - even during local testing.
	 */
	const ATLAS_BASE_URL = "https://tgh-ux.github.io/TTS";

	const ATLAS = {
		SWE: "atlas_swe",
		ENG: "atlas_eng",
	};

	/*
	Google Cloud TTS, Gemini 3.1 Flash TTS, Callirrhoe
	Instruction prompt:
	Read each line as an independent, calm statement. Maintain a professional, natural narrator tone with an even voice across all lines. Do not use an enthusiastic, dramatic, or list-like rising cadence. Ensure there is a distinct, clean pause between sentences so they do not blend together.
	*/

	/*
	 * Table of clips within the atlas, indexed by clip name. The provided MakeAtlas.ps1 script is recommended for creating atlas and generating the table.
	 * A clip entry contains the following fields:
	 *   - start: start position offset from start of file for the start of the clip
	 *   - end:   end position offset from start of file for the end of the clip
	 *   - type:  (optional) clip category for shared gap configurations.
	*/
	const CLIPS = {
		SWE: {
			"alien_team_cow_1": { start: 0.000, end: 6.220 },
			"alien_team_cow_doppelganger": { start: 6.220, end: 8.994 },
			"alien_team_do_nothing": { start: 8.994, end: 13.234 },
			"alien_team_shift_cards_left": { start: 13.234, end: 17.104 },
			"alien_team_shift_cards_right": { start: 17.104, end: 20.933 },
			"alien_team_show_cards": { start: 20.933, end: 22.612 },
			"alien_team_turncoat_1": { start: 22.612, end: 25.805 },
			"alien_team_turncoat_2a": { start: 25.805, end: 29.864 },
			"alien_team_turncoat_2b": { start: 29.864, end: 36.382 },
			"all_hands_down": { start: 36.382, end: 38.528 },
			"all_hands_out": { start: 38.528, end: 41.911 },
			"all_thumbs_down": { start: 41.911, end: 44.168 },
			"alphawolf_1": { start: 44.168, end: 50.401 },
			"apprenticeassassin_1": { start: 50.401, end: 52.233 },
			"apprenticeassassin_2": { start: 52.233, end: 54.186 },
			"apprenticetanner_1": { start: 54.186, end: 59.350 },
			"apprenticetanner_doppelganger": { start: 59.350, end: 64.982 },
			"assassin_1": { start: 64.982, end: 69.124 },
			"auraseer_1": { start: 69.124, end: 74.740 },
			"beholder_1": { start: 74.740, end: 77.946 },
			"blob_duo_left": { start: 77.946, end: 83.059 },
			"blob_duo_right": { start: 83.059, end: 88.166 },
			"blob_multi_1": { start: 88.166, end: 90.912 },
			"blob_multi_2": { start: 90.912, end: 93.470 },
			"blob_multi_3": { start: 93.470, end: 95.923 },
			"blob_solo": { start: 95.923, end: 99.596 },
			"bodysnatcher_1": { start: 99.596, end: 102.962 },
			"bodysnatcher_2": { start: 102.962, end: 106.072 },
			"check_marks": { start: 106.072, end: 109.923 },
			"copycat_1": { start: 109.923, end: 111.865 },
			"copycat_3": { start: 111.865, end: 115.640 },
			"count_1": { start: 115.640, end: 119.413 },
			"cupid_1": { start: 119.413, end: 123.307 },
			"curator_1": { start: 123.307, end: 128.740 },
			"diseased_1": { start: 128.740, end: 132.778 },
			"doppelganger_1": { start: 132.778, end: 135.097 },
			"doppelganger_2": { start: 135.097, end: 136.843 },
			"doppelganger_3_prefix": { start: 136.843, end: 138.363 },
			"doppelganger_3_suffix": { start: 138.363, end: 139.980 },
			"doppelganger_4_dreamwolf": { start: 139.980, end: 146.081 },
			"doppelganger_4_prefix": { start: 146.081, end: 146.904 },
			"doppelganger_4_suffix": { start: 146.904, end: 149.889 },
			"doppelganger_wake_prefix": { start: 149.889, end: 152.141 },
			"drunk_1": { start: 152.141, end: 156.779 },
			"empath_1": { start: 156.779, end: 158.987 },
			"empath_2": { start: 158.987, end: 160.020 },
			"empath_q_1": { start: 160.020, end: 162.428 },
			"empath_q_10": { start: 162.428, end: 168.339 },
			"empath_q_11": { start: 168.339, end: 173.140 },
			"empath_q_2": { start: 173.140, end: 175.918 },
			"empath_q_3": { start: 175.918, end: 178.804 },
			"empath_q_4": { start: 178.804, end: 181.821 },
			"empath_q_5": { start: 181.821, end: 184.847 },
			"empath_q_6": { start: 184.847, end: 188.059 },
			"empath_q_7": { start: 188.059, end: 191.167 },
			"empath_q_8": { start: 191.167, end: 194.494 },
			"empath_q_9": { start: 194.494, end: 197.899 },
			"exposer_1": { start: 197.899, end: 198.710 },
			"feudingaliens_doppelganger": { start: 198.710, end: 202.061 },
			"generic_sleep": { start: 202.061, end: 202.612 },
			"generic_wake": { start: 202.612, end: 203.241 },
			"gremlin_1": { start: 203.241, end: 210.468 },
			"hand_down": { start: 210.468, end: 211.299 },
			"hand_out": { start: 211.299, end: 212.843 },
			"identity_all_players": { start: 212.843, end: 213.872, type: "identity" },
			"identity_lovers": { start: 213.872, end: 214.708, type: "identity" },
			"insomniac_1": { start: 214.708, end: 216.320 },
			"instigator_1": { start: 216.320, end: 220.495 },
			"leader_1": { start: 220.495, end: 225.392 },
			"leader_2": { start: 225.392, end: 227.651 },
			"leader_doppelganger": { start: 227.651, end: 230.488 },
			"leader_feudingaliens_1": { start: 230.488, end: 233.769 },
			"leader_feudingaliens_2": { start: 233.769, end: 239.801 },
			"list_and": { start: 239.801, end: 240.176 },
			"list_or": { start: 240.176, end: 240.624 },
			"lovers_1": { start: 240.624, end: 244.551 },
			"marksman_1": { start: 244.551, end: 249.372 },
			"marksman_2": { start: 249.372, end: 251.198 },
			"mason_doppelganger": { start: 251.198, end: 254.109 },
			"minion_1": { start: 254.109, end: 258.543 },
			"minion_2": { start: 258.543, end: 260.643 },
			"minion_doppelganger": { start: 260.643, end: 263.121 },
			"nostradamus_1": { start: 263.121, end: 266.632 },
			"nostradamus_3": { start: 266.632, end: 267.568 },
			"nostradamus_4": { start: 267.568, end: 268.987 },
			"nostradamus_5": { start: 268.987, end: 273.996 },
			"nostradamus_auto": { start: 273.996, end: 277.924 },
			"nostradamus_doppelganger": { start: 277.924, end: 283.515 },
			"num_1": { start: 283.515, end: 284.008, type: "num" },
			"num_10": { start: 284.008, end: 284.428, type: "num" },
			"num_11": { start: 284.428, end: 284.899, type: "num" },
			"num_12": { start: 284.899, end: 285.384, type: "num" },
			"num_13": { start: 285.384, end: 286.061, type: "num" },
			"num_14": { start: 286.061, end: 286.854, type: "num" },
			"num_15": { start: 286.854, end: 287.639, type: "num" },
			"num_16": { start: 287.639, end: 288.332, type: "num" },
			"num_17": { start: 288.332, end: 289.049, type: "num" },
			"num_18": { start: 289.049, end: 289.704, type: "num" },
			"num_19": { start: 289.704, end: 290.413, type: "num" },
			"num_2": { start: 290.413, end: 290.866, type: "num" },
			"num_20": { start: 290.866, end: 291.498, type: "num" },
			"num_21": { start: 291.498, end: 292.380, type: "num" },
			"num_22": { start: 292.380, end: 293.142, type: "num" },
			"num_23": { start: 293.142, end: 293.902, type: "num" },
			"num_24": { start: 293.902, end: 294.769, type: "num" },
			"num_25": { start: 294.769, end: 295.559, type: "num" },
			"num_26": { start: 295.559, end: 296.443, type: "num" },
			"num_27": { start: 296.443, end: 297.193, type: "num" },
			"num_28": { start: 297.193, end: 298.049, type: "num" },
			"num_29": { start: 298.049, end: 298.857, type: "num" },
			"num_3": { start: 298.857, end: 299.285, type: "num" },
			"num_30": { start: 299.285, end: 299.847, type: "num" },
			"num_4": { start: 299.847, end: 300.380, type: "num" },
			"num_5": { start: 300.380, end: 300.919, type: "num" },
			"num_6": { start: 300.919, end: 301.515, type: "num" },
			"num_7": { start: 301.515, end: 301.931, type: "num" },
			"num_8": { start: 301.931, end: 302.411, type: "num" },
			"num_9": { start: 302.411, end: 302.881, type: "num" },
			"oracle_block_1": { start: 302.881, end: 307.298 },
			"oracle_block_2": { start: 307.298, end: 313.606 },
			"oracle_even": { start: 313.606, end: 315.720 },
			"oracle_even_odd": { start: 315.720, end: 318.867 },
			"oracle_force_ripple": { start: 318.867, end: 321.711 },
			"oracle_force_ripple_no": { start: 321.711, end: 326.624 },
			"oracle_force_ripple_yes": { start: 326.624, end: 329.596 },
			"oracle_guess_right_1": { start: 329.596, end: 332.953 },
			"oracle_guess_right_2": { start: 332.953, end: 342.208 },
			"oracle_guess_right_3": { start: 342.208, end: 346.093 },
			"oracle_guess_wrong_1": { start: 346.093, end: 350.270 },
			"oracle_guess_wrong_2": { start: 350.270, end: 359.983 },
			"oracle_guess_wrong_3": { start: 359.983, end: 366.639 },
			"oracle_hunt_intro": { start: 366.639, end: 368.360 },
			"oracle_join_aliens": { start: 368.360, end: 370.695 },
			"oracle_join_denied": { start: 370.695, end: 372.801 },
			"oracle_join_full": { start: 372.801, end: 376.219 },
			"oracle_join_partial": { start: 376.219, end: 382.280 },
			"oracle_join_vampires": { start: 382.280, end: 384.215 },
			"oracle_join_werewolves": { start: 384.215, end: 386.379 },
			"oracle_odd": { start: 386.379, end: 388.487 },
			"oracle_q_1": { start: 388.487, end: 390.068 },
			"oracle_q_2": { start: 390.068, end: 391.741 },
			"oracle_q_3": { start: 391.741, end: 393.441 },
			"oracle_q_4": { start: 393.441, end: 396.127 },
			"oracle_q_5": { start: 396.127, end: 399.641 },
			"others_thumb_out": { start: 399.641, end: 402.567 },
			"paranormalinvestigator_1": { start: 402.567, end: 405.604 },
			"paranormalinvestigator_2": { start: 405.604, end: 406.357 },
			"paranormalinvestigator_3": { start: 406.357, end: 409.284 },
			"pickpocket_1": { start: 409.284, end: 414.329 },
			"pickpocket_2": { start: 414.329, end: 416.120 },
			"player": { start: 416.120, end: 416.670 },
			"priest_1": { start: 416.670, end: 419.379 },
			"priest_2": { start: 419.379, end: 423.962 },
			"renfield_1": { start: 423.962, end: 428.872 },
			"renfield_2": { start: 428.872, end: 434.137 },
			"renfield_3": { start: 434.137, end: 436.416 },
			"renfield_doppelganger": { start: 436.416, end: 441.528 },
			"revealer_1": { start: 441.528, end: 443.530 },
			"revealer_2": { start: 443.530, end: 444.461 },
			"revealer_3": { start: 444.461, end: 445.770 },
			"ripple": { start: 445.770, end: 449.072 },
			"ripple_double_vote": { start: 449.072, end: 453.697 },
			"ripple_mute": { start: 453.697, end: 456.494 },
			"ripple_rebuke": { start: 456.494, end: 460.439 },
			"ripple_timer": { start: 460.439, end: 463.993 },
			"robber_1": { start: 463.993, end: 468.827 },
			"robber_2": { start: 468.827, end: 470.577 },
			"robber_3": { start: 470.577, end: 473.528 },
			"role_alien": { start: 473.528, end: 474.385, type: "identity" },
			"role_alien_d": { start: 474.385, end: 475.307, type: "identity" },
			"role_alien_p": { start: 475.307, end: 476.450, type: "identity" },
			"role_alien_p_d": { start: 476.450, end: 477.511, type: "identity" },
			"role_alphawolf": { start: 477.511, end: 478.422, type: "identity" },
			"role_alphawolf_d": { start: 478.422, end: 479.440, type: "identity" },
			"role_apprenticeassassin": { start: 479.440, end: 480.724, type: "identity" },
			"role_apprenticeassassin_d": { start: 480.724, end: 481.985, type: "identity" },
			"role_apprenticeseer": { start: 481.985, end: 483.131, type: "identity" },
			"role_apprenticeseer_d": { start: 483.131, end: 484.241, type: "identity" },
			"role_apprenticetanner": { start: 484.241, end: 485.280, type: "identity" },
			"role_apprenticetanner_d": { start: 485.280, end: 486.374, type: "identity" },
			"role_apprenticetanner_p_d": { start: 486.374, end: 487.576, type: "identity" },
			"role_assassin": { start: 487.576, end: 488.478, type: "identity" },
			"role_assassin_d": { start: 488.478, end: 489.410, type: "identity" },
			"role_auraseer": { start: 489.410, end: 490.480, type: "identity" },
			"role_auraseer_d": { start: 490.480, end: 491.575, type: "identity" },
			"role_beholder": { start: 491.575, end: 492.439, type: "identity" },
			"role_beholder_d": { start: 492.439, end: 493.354, type: "identity" },
			"role_blob": { start: 493.354, end: 493.961, type: "identity" },
			"role_blob_d": { start: 493.961, end: 494.654, type: "identity" },
			"role_bodyguard": { start: 494.654, end: 495.448, type: "identity" },
			"role_bodyguard_d": { start: 495.448, end: 496.226, type: "identity" },
			"role_bodysnatcher": { start: 496.226, end: 497.281, type: "identity" },
			"role_bodysnatcher_d": { start: 497.281, end: 498.342, type: "identity" },
			"role_copycat": { start: 498.342, end: 499.081, type: "identity" },
			"role_copycat_d": { start: 499.081, end: 499.775, type: "identity" },
			"role_count": { start: 499.775, end: 500.379, type: "identity" },
			"role_count_d": { start: 500.379, end: 500.934, type: "identity" },
			"role_cow": { start: 500.934, end: 501.312, type: "identity" },
			"role_cow_d": { start: 501.312, end: 501.732, type: "identity" },
			"role_cupid": { start: 501.732, end: 502.271, type: "identity" },
			"role_cupid_d": { start: 502.271, end: 502.810, type: "identity" },
			"role_curator": { start: 502.810, end: 503.586, type: "identity" },
			"role_curator_d": { start: 503.586, end: 504.314, type: "identity" },
			"role_cursed": { start: 504.314, end: 505.042, type: "identity" },
			"role_cursed_d": { start: 505.042, end: 505.970, type: "identity" },
			"role_diseased": { start: 505.970, end: 506.731, type: "identity" },
			"role_diseased_d": { start: 506.731, end: 507.643, type: "identity" },
			"role_doppelganger": { start: 507.643, end: 508.729, type: "identity" },
			"role_doppelganger_d": { start: 508.729, end: 509.866, type: "identity" },
			"role_dreamwolf": { start: 509.866, end: 510.778, type: "identity" },
			"role_dreamwolf_d": { start: 510.778, end: 511.798, type: "identity" },
			"role_drunk": { start: 511.798, end: 512.720, type: "identity" },
			"role_drunk_d": { start: 512.720, end: 513.753, type: "identity" },
			"role_empath": { start: 513.753, end: 514.528, type: "identity" },
			"role_empath_d": { start: 514.528, end: 515.319, type: "identity" },
			"role_exposer": { start: 515.319, end: 516.238, type: "identity" },
			"role_exposer_d": { start: 516.238, end: 517.186, type: "identity" },
			"role_feudingaliens": { start: 517.186, end: 518.531, type: "identity" },
			"role_feudingaliens_d": { start: 518.531, end: 519.875, type: "identity" },
			"role_feudingaliens_d_p_g": { start: 519.875, end: 521.242, type: "identity" },
			"role_feudingaliens_groob": { start: 521.242, end: 521.899, type: "identity" },
			"role_feudingaliens_groob_g": { start: 521.899, end: 522.652, type: "identity" },
			"role_feudingaliens_zerb": { start: 522.652, end: 523.314, type: "identity" },
			"role_feudingaliens_zerb_g": { start: 523.314, end: 524.084, type: "identity" },
			"role_gremlin": { start: 524.084, end: 524.501, type: "identity" },
			"role_gremlin_d": { start: 524.501, end: 525.106, type: "identity" },
			"role_hunter": { start: 525.106, end: 525.812, type: "identity" },
			"role_hunter_d": { start: 525.812, end: 526.531, type: "identity" },
			"role_insomniac": { start: 526.531, end: 527.491, type: "identity" },
			"role_insomniac_d": { start: 527.491, end: 528.716, type: "identity" },
			"role_instigator": { start: 528.716, end: 529.682, type: "identity" },
			"role_instigator_d": { start: 529.682, end: 530.647, type: "identity" },
			"role_leader": { start: 530.647, end: 531.547, type: "identity" },
			"role_leader_d": { start: 531.547, end: 532.430, type: "identity" },
			"role_marksman": { start: 532.430, end: 533.141, type: "identity" },
			"role_marksman_d": { start: 533.141, end: 533.869, type: "identity" },
			"role_mason": { start: 533.869, end: 534.753, type: "identity" },
			"role_mason_d": { start: 534.753, end: 535.602, type: "identity" },
			"role_mason_d_p": { start: 535.602, end: 536.439, type: "identity" },
			"role_master": { start: 536.439, end: 537.140, type: "identity" },
			"role_master_d": { start: 537.140, end: 537.887, type: "identity" },
			"role_minion": { start: 537.887, end: 538.687, type: "identity" },
			"role_minion_d": { start: 538.687, end: 539.506, type: "identity" },
			"role_mortician": { start: 539.506, end: 540.373, type: "identity" },
			"role_mortician_d": { start: 540.373, end: 541.237, type: "identity" },
			"role_mysticwolf": { start: 541.237, end: 542.278, type: "identity" },
			"role_mysticwolf_d": { start: 542.278, end: 543.293, type: "identity" },
			"role_nostradamus": { start: 543.293, end: 543.931, type: "identity" },
			"role_nostradamus_d": { start: 543.931, end: 544.583, type: "identity" },
			"role_oracle": { start: 544.583, end: 545.276, type: "identity" },
			"role_oracle_d": { start: 545.276, end: 546.020, type: "identity" },
			"role_paranormalinvestigator": { start: 546.020, end: 547.053, type: "identity" },
			"role_paranormalinvestigator_d": { start: 547.053, end: 548.089, type: "identity" },
			"role_pickpocket": { start: 548.089, end: 548.819, type: "identity" },
			"role_pickpocket_d": { start: 548.819, end: 549.539, type: "identity" },
			"role_priest": { start: 549.539, end: 550.075, type: "identity" },
			"role_priest_d": { start: 550.075, end: 550.592, type: "identity" },
			"role_prince": { start: 550.592, end: 551.157, type: "identity" },
			"role_prince_d": { start: 551.157, end: 551.711, type: "identity" },
			"role_psychic": { start: 551.711, end: 552.488, type: "identity" },
			"role_psychic_d": { start: 552.488, end: 553.313, type: "identity" },
			"role_rascal": { start: 553.313, end: 553.947, type: "identity" },
			"role_rascal_d": { start: 553.947, end: 554.502, type: "identity" },
			"role_renfield": { start: 554.502, end: 555.192, type: "identity" },
			"role_renfield_d": { start: 555.192, end: 555.883, type: "identity" },
			"role_revealer": { start: 555.883, end: 556.714, type: "identity" },
			"role_revealer_d": { start: 556.714, end: 557.577, type: "identity" },
			"role_robber": { start: 557.577, end: 558.115, type: "identity" },
			"role_robber_d": { start: 558.115, end: 558.697, type: "identity" },
			"role_seer": { start: 558.697, end: 559.408, type: "identity" },
			"role_seer_d": { start: 559.408, end: 560.123, type: "identity" },
			"role_sentinel": { start: 560.123, end: 560.822, type: "identity" },
			"role_sentinel_d": { start: 560.822, end: 561.477, type: "identity" },
			"role_squire": { start: 561.477, end: 562.054, type: "identity" },
			"role_squire_d": { start: 562.054, end: 562.742, type: "identity" },
			"role_syntheticalien": { start: 562.742, end: 563.537, type: "identity" },
			"role_syntheticalien_d": { start: 563.537, end: 564.336, type: "identity" },
			"role_tanner": { start: 564.336, end: 564.978, type: "identity" },
			"role_tanner_d": { start: 564.978, end: 565.672, type: "identity" },
			"role_tanner_p_d": { start: 565.672, end: 566.377, type: "identity" },
			"role_thing": { start: 566.377, end: 567.272, type: "identity" },
			"role_thing_d": { start: 567.272, end: 568.028, type: "identity" },
			"role_troublemaker": { start: 568.028, end: 569.114, type: "identity" },
			"role_troublemaker_d": { start: 569.114, end: 570.218, type: "identity" },
			"role_vampire": { start: 570.218, end: 570.889, type: "identity" },
			"role_vampire_d": { start: 570.889, end: 571.537, type: "identity" },
			"role_vampire_p": { start: 571.537, end: 572.388, type: "identity" },
			"role_vampire_p_d": { start: 572.388, end: 573.285, type: "identity" },
			"role_villageidiot": { start: 573.285, end: 574.220, type: "identity" },
			"role_villageidiot_d": { start: 574.220, end: 575.202, type: "identity" },
			"role_villager": { start: 575.202, end: 575.952, type: "identity" },
			"role_villager_d": { start: 575.952, end: 576.729, type: "identity" },
			"role_villager_p_d": { start: 576.729, end: 577.404, type: "identity" },
			"role_werewolf": { start: 577.404, end: 578.271, type: "identity" },
			"role_werewolf_d": { start: 578.271, end: 579.225, type: "identity" },
			"role_werewolf_p": { start: 579.225, end: 580.042, type: "identity" },
			"role_werewolf_p_d": { start: 580.042, end: 580.852, type: "identity" },
			"role_witch": { start: 580.852, end: 581.340, type: "identity" },
			"role_witch_d": { start: 581.340, end: 581.801, type: "identity" },
			"seer_1": { start: 581.801, end: 586.415 },
			"sentinel_1": { start: 586.415, end: 590.049 },
			"sentinel_2": { start: 590.049, end: 594.359 },
			"shared_may_view_cards": { start: 594.359, end: 595.966 },
			"squire_1": { start: 595.966, end: 599.972 },
			"thing_2": { start: 599.972, end: 605.886 },
			"thumb_down": { start: 605.886, end: 606.756 },
			"timer_30s_warning": { start: 606.756, end: 608.651 },
			"timer_60s_warning": { start: 608.651, end: 610.284 },
			"timer_expired": { start: 610.284, end: 631.908 },
			"troublemaker_1": { start: 631.908, end: 636.667 },
			"vampire_team_1": { start: 636.667, end: 642.035 },
			"view_card_playerlist_prefix": { start: 642.035, end: 643.926 },
			"view_card_prefix_individual": { start: 643.926, end: 645.759 },
			"view_card_prefix_solo": { start: 645.759, end: 646.688 },
			"view_card_prefix_together": { start: 646.688, end: 649.276 },
			"view_card_suffix_any_neighbor": { start: 649.276, end: 650.338 },
			"view_card_suffix_both_neighbors": { start: 650.338, end: 651.618 },
			"view_card_suffix_center": { start: 651.618, end: 652.896 },
			"view_card_suffix_even_players": { start: 652.896, end: 655.165 },
			"view_card_suffix_left_neighbor": { start: 655.165, end: 656.410 },
			"view_card_suffix_odd_players": { start: 656.410, end: 658.671 },
			"view_card_suffix_one_player": { start: 658.671, end: 660.822 },
			"view_card_suffix_other_players": { start: 660.822, end: 662.923 },
			"view_card_suffix_own": { start: 662.923, end: 664.041 },
			"view_card_suffix_right_neighbor": { start: 664.041, end: 665.282 },
			"villageidiot_1": { start: 665.282, end: 672.169 },
			"wake_and_identify": { start: 672.169, end: 674.191 },
			"werewolf_team_1": { start: 674.191, end: 678.069 },
			"werewolf_team_dreamwolf_1": { start: 678.069, end: 680.413 },
			"werewolf_team_dreamwolf_2": { start: 680.413, end: 685.245 },
			"witch_1": { start: 685.245, end: 687.827 },
			"witch_2": { start: 687.827, end: 692.045 },
		},
		ENG: {},
	};
	
	let _language = null;

	/*
	 * Aliases created at initialization by cloning an existing clip entry.
	 * The source clip must exist; an explicitly defined destination is never overwritten.
	 */
	const CLIP_ALIAS = {
		SWE: {
			"players":                    "player",
			"role_feudingaliens_p":       "role_feudingaliens",
			"role_feudingaliens_groob_d": "role_feudingaliens_groob",
			"role_feudingaliens_zerb_d":  "role_feudingaliens_zerb",
			"role_mason_p":               "role_mason",

			// ALIEN
			"team_alien":                 "role_alien",
			"team_alien_d":               "role_alien_p_d",
			"team_alien_d_g":             "role_alien_p_d_g",
			"team_alien_g":               "role_alien_g",
			"team_alien_p":               "role_alien_p",
			"team_alien_p_d":             "role_alien_p_d",
			"team_alien_p_d_g":           "role_alien_p_d_g",
			"team_alien_p_g":             "role_alien_p_g",

			// VAMPIRE
			"team_vampire":               "role_vampire",
			"team_vampire_d":             "role_vampire_p_d",
			"team_vampire_d_g":           "role_vampire_p_d_g",
			"team_vampire_g":             "role_vampire_g",
			"team_vampire_p":             "role_vampire_p",
			"team_vampire_p_d":           "role_vampire_p_d",
			"team_vampire_p_d_g":         "role_vampire_p_d_g",
			"team_vampire_p_g":           "role_vampire_p_g",

			// VILLAGE->VILLAGER
			"team_village":               "role_villager",
			"team_village_d":             "role_villager_p_d",
			"team_village_d_g":           "role_villager_p_d_g",
			"team_village_g":             "role_villager_g",
			"team_village_p":             "role_villager_p",
			"team_village_p_d":           "role_villager_p_d",
			"team_village_p_d_g":         "role_villager_p_d_g",
			"team_village_p_g":           "role_villager_p_g",

			// WEREWOLF
			"team_werewolf":              "role_werewolf",
			"team_werewolf_d":            "role_werewolf_p_d",
			"team_werewolf_d_g":          "role_werewolf_p_d_g",
			"team_werewolf_g":            "role_werewolf_g",
			"team_werewolf_p":            "role_werewolf_p",
			"team_werewolf_p_d":          "role_werewolf_p_d",
			"team_werewolf_p_d_g":        "role_werewolf_p_d_g",
			"team_werewolf_p_g":          "role_werewolf_p_g",
		},
		ENG: {},
	};

	// Per clip tuning of silent gaps before (pre) and after (post) a clip is played, in seconds.
	// Language-specific overrides COMMON entries fully. Stacks with TYPE_GAP.
	const CLIP_GAP = {
		COMMON: {
			"generic_sleep":               { pre: 0.1, post: 0.5 },
			"generic_wake":                { pre: 0.1, post: 0.5 },
			"wake_and_identify":           { pre: 0.1 },
			"doppelganger_wake_prefix":    { post: 0.1 },
			"all_thumbs_down":             { post: 0.5 },
			"others_thumb_out":            { post: 0.5 },
			"thumb_down":                  { pre: 0.1, post: 0.5 },
			"list_and":                    { pre: 0.1, post: 0.1 },
			"list_or":                     { pre: 0.1, post: 0.1 },
			"nostradamus_4":               { post: 0.2 },
			"empath_2":                    { pre: 0.2, post: 0.2 },
			"doppelganger_3_prefix":       { post: 0.2 },
			"doppelganger_4_prefix":       { post: 0.2 },
			"alien_team_cow_doppelganger": { post: 0.2 },
			"mason_doppelganger":          { post: 0.2 },
			"feudingaliens_doppelganger":  { post: 0.2 },
			"paranormalinvestigator_2":    { post: 0.2 },
			"revealer_2":                  { post: 0.2 },
			"oracle_guess_right_3":        { post: 0.2 },
			"apprenticeassassin_2":        { post: 0.2 },
			"werewolf_team_dreamwolf_1":   { pre: 0.2, post: 0.2 },
			"view_card_prefix_individual": { post: 0.1 },
			"view_card_prefix_together":   { post: 0.1 },
			"view_card_prefix_solo":       { post: 0.1 },
		},
		SWE: {},
		ENG: {},
	};
	
	// Per type tuning of silent gaps before (pre) and after (post) a clip is played, in seconds.
	// Language-specific overrides COMMON entries fully. Stacks with CLIP_GAP.
	const TYPE_GAP = {
		COMMON: {
			identity: { post: 0.25 },
			num:      { pre: 0.15, post: 0.15 },
		},
		SWE: {},
		ENG: {},
	};

	let _context = null;
	let _bufferPromise = null;

	/* =========================
	   Initialization
	   ========================= */

	function _init() {
		_language = Localization.getLanguage();

		if (!CLIPS[_language]) {
			console.warn(`ClipPlayback: no CLIPS table for language "${_language}"`);
		}

		const clips = CLIPS[_language] ?? {};
		const aliases = CLIP_ALIAS[_language] ?? {};

		Object.entries(aliases).forEach(([alias, source]) => {
			if (clips[source] && !clips[alias]) {
				clips[alias] = { ...clips[source] };
			}
		});
	}
	
	_init();
	

	/* =========================
	   Private functions
	   ========================= */

	function _getContext() {
		if (!_context) _context = new (window.AudioContext || window.webkitAudioContext)();
		return _context;
	}

	/*
	 * Fetches and decodes `atlas`, memoizing the in-flight/decoded promise by atlas name so
	 * concurrent or repeated requests for the same atlas share one fetch. On failure the cache
	 * entry is removed, so a later call retries from scratch instead of staying stuck on a
	 * permanently-rejected promise.
	 */
	function _loadAtlas(atlas) {
		if (_bufferPromise) return _bufferPromise;

		_bufferPromise = fetch(`${ATLAS_BASE_URL}/${atlas}.mp3`)
			.then(response => response.arrayBuffer())
			.then(data => _getContext().decodeAudioData(data))
			.catch(error => { _bufferPromise = null; throw error; });

		return _bufferPromise;
	}
	
	/*
	 * Returns a { pre, post } object for the silent gap added to either side of a played clip.
	 * Lookup priority for each value is: active language -> COMMON -> 0
	 */
	function _getSilence(name, type) {
		const languageClip = CLIP_GAP[_language]?.[name];
		const commonClip = CLIP_GAP.COMMON?.[name];
		const byClip = languageClip ?? commonClip ?? {};

		const languageType = TYPE_GAP[_language]?.[type];
		const commonType = TYPE_GAP.COMMON?.[type];
		const byType = languageType ?? commonType ?? {};

		return {
			pre: (byClip.pre ?? 0) + (byType.pre ?? 0),
			post: (byClip.post ?? 0) + (byType.post ?? 0),
		};
	}


	/* =========================
	   Public functions
	   ========================= */

	/*
	 * Optional: kicks off fetch+decode for the current language atlas ahead of first use, e.g.
	 * at game start, so the first clip of a session doesn't stall on a fetch. play() loads on demand
	 * regardless, so this is purely a latency optimization.
	 */
	function preload() {
		return _loadAtlas(ATLAS[_language]);
	}

	/*
	 * Plays clip `name`. onDone fires once the clip and its post-silence have elapsed; onError fires
	 * instead if the atlas failed to load, or if `name` isn't in CLIPS at all.
	 *
	 * Returns a handle shaped like the bits of HTMLAudioElement callers already use: pause() stops
	 * playback outright, play() restarts the same clip from the beginning. There's no seek/resume-
	 * from-position - a paused atlas clip that resumes always replays in full.
	 */
	function play(name, onDone, onError) {
		const clips = CLIPS[_language] ?? {};
		const clip = clips[name];
		if (!clip) { onError(); return { pause() {}, play() {}, stop() {} }; }

		const silence = _getSilence(name, clip.type);
		const atlas = ATLAS[_language];

		let stopped = false;
		let sourceNode = null;
		let postTimer = null;

		function stopNow() {
			if (postTimer !== null) { clearTimeout(postTimer); postTimer = null; }
			if (sourceNode) { sourceNode.onended = null; try { sourceNode.stop(); } catch {} sourceNode = null; }
		}

		function start() {
			stopNow();
			stopped = false;
			
			_loadAtlas(atlas).then(buffer => {
				if (stopped) return;

				const ctx = _getContext();
				const source = ctx.createBufferSource();
				source.buffer = buffer;
				source.connect(ctx.destination);
				sourceNode = source;

				source.onended = () => {
					if (stopped) return;
					postTimer = setTimeout(() => { if (!stopped) onDone(); }, silence.post * 1000);
				};

				source.start(ctx.currentTime + silence.pre, clip.start, clip.end - clip.start);
			}).catch(error => {
				console.warn("ClipPlayback: failed to load/play clip", name, error);
				if (!stopped) onError();
			});
		}

		function pause() {
			stopped = true;
			stopNow();
			if (postTimer !== null) { clearTimeout(postTimer); postTimer = null; }
			if (sourceNode) { sourceNode.onended = null; try { sourceNode.stop(); } catch {} sourceNode = null; }
		}

		function stop() {
			stopped = true;
			stopNow();
		}

		start();
		return { pause, play: start, stop };
	}

	/*
	 * Whether `name` is actually present in the current language's atlas (post-alias-merge - see CLIP_ALIAS).
	 * A pure existence check, no playback side effects - lets a caller confirm an entire resolved clip sequence
	 * up front, before committing to playing any of it.
	 */
	function hasClip(name) {
		const clips = CLIPS[_language] ?? {};
		return Object.prototype.hasOwnProperty.call(clips, name);
	}

	/*
	 * Whether the current language has any recordings at all. False for a language with no CLIPS table, or an
	 * explicitly empty one (e.g. ENG today) - both mean "no atlas for this language", which is a deliberate,
	 * expected state (not every language needs recordings; browser synthesis can carry a language on its own)
	 * rather than a missing-clip bug. Narration checks this before calling resolve() at all - see there.
	 */
	function isAvailable() {
		return Object.keys(CLIPS[_language] ?? {}).length > 0;
	}


	/* =========================
	   Clip selection (composes ClipSelector)
	   ========================= */

	/*
	 * Attempts to find a fully-playable clip sequence for one rendered content unit's structural `source`
	 * (the { text, ref } parts Interpreter produces - see ClipSelector.resolve() for what `ref` means).
	 *
	 * This is the only place ClipSelector is called from. ClipSelector decides *which* clip names a structural
	 * source would need, with no knowledge of whether any of them actually exist in the atlas; this function
	 * adds that existence check on top, since only ClipPlayback knows what's actually packed. Returns null -
	 * meaning "no full recorded coverage, caller should synthesize" - if there's no structural coverage at all,
	 * or if coverage exists but names a clip this atlas doesn't have (logged so authoring gaps stay visible).
	 */
	function resolve(source) {
		const parts = Array.isArray(source) ? source : [];

		if (parts.length === 0)
			return null;

		const names = ClipSelector.resolve(parts);

		if (!names || names.length === 0)
			return null;

		const missing = names.filter(name => !hasClip(name));

		if (missing.length > 0) {
			missing.forEach(name =>
				console.warn(`ClipPlayback: manifest resolved clip "${name}" but it's missing from the atlas`)
			);
			return null;
		}

		return names;
	}
	
	function resolveAnnouncement(key) {
		if (!isAvailable()) return null;
		
		const name = ClipSelector.resolveAnnouncement(key);

		if (!name) return null;

		if (!hasClip(name)) {
			console.warn(`ClipPlayback: announcement clip "${name}" is missing from the atlas`);
			return null;
		}

		return name;
	}

	/*
	 * Plays a complete, already-resolved clip sequence (as returned by resolve()) as one logical unit, in
	 * order. The returned handle's pause()/resume() forward to whichever clip is currently live, so a caller
	 * never needs to track that itself.
	 *
	 * onDone fires once every clip has played. onError fires instead the moment any one clip fails at runtime
	 * (an atlas load/decode failure - resolve() already ruled out a clip simply being absent from CLIPS) and
	 * the sequence stops there; it does not attempt the remaining clips or fall back to anything itself -
	 * that decision belongs to the caller (Narration falls back to whole-sentence synthesis), since mixing
	 * some spoken clips with a synthesized remainder is never wanted (see Narration's speech-dispatch section).
	 */
	function playSequence(names, { onDone, onError }) {
		let index = 0;
		let current = { pause() {}, resume() {}, stop() {} };

		const handle = {
			pause()  { current.pause(); },
			resume() { current.resume(); },
			stop()   { current.stop(); },
		};

		const playNext = () => {
			if (index >= names.length) {
				onDone();
				return;
			}

			const name = names[index++];
			const clipHandle = play(name, () => playNext(), () => onError(name));
			current = {
				pause: clipHandle.pause,
				resume: clipHandle.play,
				stop: clipHandle.stop
			};
		};

		playNext();

		return handle;
	}

	/*
	 * Debug helper: plays a fixed sequence of known clip names directly - e.g. debugPlaySequence(["all_players",
	 * "generic_wake"]) - bypassing ClipSelector/resolve() entirely and skipping the missing-clip/language-
	 * availability handling resolve() does. No text, no synthesis fallback: if a named clip is missing or fails
	 * to play, that's exactly what this exists to surface, so it's reported via onError (and the sequence
	 * stops there) rather than papered over.
	 *
	 * Used as a prosody check for spliced sentences (e.g. "<role>, wake up") and to sanity-check the configured
	 * gaps around specific clips - mostly relevant when adding recordings for a new language, or re-verifying
	 * after a repack.
	 */
	function debugPlaySequence(names, { onDone = () => {}, onError = () => {} } = {}) {
		if (!Array.isArray(names) || names.length === 0) {
			return { pause() {}, resume() {}, stop() {} };
		}

		return playSequence(names, { onDone, onError });
	}

	return {
		preload,
		play,
		hasClip,
		isAvailable,
		resolve,
		resolveAnnouncement,
		playSequence,
		debugPlaySequence,
	};

})();