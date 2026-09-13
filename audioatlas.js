/*
 * Audio atlas playback via Web Audio API.
 *
 * CLIPS maps a clip name (the same name TTSManifest looks clips up by) to its {atlas, start, end}
 * region in seconds - regenerated wholesale by the packer script and pasted in here on every
 * repack. CLIP_GAP maps the same names to {pre, post} padding in seconds - hand-tuned
 * independently, and untouched by repacking; entries default to {0, 0} when absent so a freshly
 * packed clip with no tuned silence yet still plays back-to-back cleanly.
 */
const AudioAtlas = (() => {


	/* =========================
	   Data
	   ========================= */

	// Remote URL for the atlas file. Everything else in the project runs fine from a local folder
	// (just open index.html), but fetch() can't read file:// URLs, so the atlas is hosted here and
	// always fetched remotely rather than from disk - even during local testing.
	const ATLAS_BASE_URL = "https://tgh-ux.github.io/TTS";

	/*
	 * Table of clips within the atlas, indexed by clip name. The provided MakeAtlas.ps1 script is recommended for creating atlas and generating the table.
	 * A clip entry contains the following fields:
	 *   - atlas: the name of the atlas file, without path or extension
	 *   - start: start position offset from start of file for the start of the clip
	 *   - end:   end position offset from start of file for the end of the clip
	 *   - type:  (optional) clip category for shared gap configurations.
	*/
	const CLIPS = {
		"alien_team_cow_1": { atlas: "atlas_swe", start: 0.000, end: 6.220 },
		"alien_team_cow_doppelganger": { atlas: "atlas_swe", start: 6.220, end: 8.994 },
		"alien_team_do_nothing": { atlas: "atlas_swe", start: 8.994, end: 13.234 },
		"alien_team_shift_cards_left": { atlas: "atlas_swe", start: 13.234, end: 17.104 },
		"alien_team_shift_cards_right": { atlas: "atlas_swe", start: 17.104, end: 20.933 },
		"alien_team_show_cards": { atlas: "atlas_swe", start: 20.933, end: 22.612 },
		"alien_team_turncoat_1": { atlas: "atlas_swe", start: 22.612, end: 25.805 },
		"alien_team_turncoat_2a": { atlas: "atlas_swe", start: 25.805, end: 29.864 },
		"alien_team_turncoat_2b": { atlas: "atlas_swe", start: 29.864, end: 36.382 },
		"all_hands_down": { atlas: "atlas_swe", start: 36.382, end: 38.528 },
		"all_hands_out": { atlas: "atlas_swe", start: 38.528, end: 41.911 },
		"all_players": { atlas: "atlas_swe", start: 41.911, end: 42.940, type: "identity" },
		"all_thumbs_down": { atlas: "atlas_swe", start: 42.940, end: 45.197 },
		"alphawolf_1": { atlas: "atlas_swe", start: 45.197, end: 51.430 },
		"apprenticeassassin_1": { atlas: "atlas_swe", start: 51.430, end: 53.262 },
		"apprenticeassassin_2": { atlas: "atlas_swe", start: 53.262, end: 55.215 },
		"apprenticetanner_1": { atlas: "atlas_swe", start: 55.215, end: 60.379 },
		"apprenticetanner_doppelganger": { atlas: "atlas_swe", start: 60.379, end: 66.011 },
		"assassin_1": { atlas: "atlas_swe", start: 66.011, end: 70.153 },
		"auraseer_1": { atlas: "atlas_swe", start: 70.153, end: 75.769 },
		"beholder_1": { atlas: "atlas_swe", start: 75.769, end: 78.975 },
		"blob_duo_left": { atlas: "atlas_swe", start: 78.975, end: 84.087 },
		"blob_duo_right": { atlas: "atlas_swe", start: 84.087, end: 89.195 },
		"blob_multi_1": { atlas: "atlas_swe", start: 89.195, end: 91.941 },
		"blob_multi_2": { atlas: "atlas_swe", start: 91.941, end: 94.499 },
		"blob_multi_3": { atlas: "atlas_swe", start: 94.499, end: 96.952 },
		"blob_solo": { atlas: "atlas_swe", start: 96.952, end: 100.625 },
		"bodysnatcher_1": { atlas: "atlas_swe", start: 100.625, end: 103.991 },
		"bodysnatcher_2": { atlas: "atlas_swe", start: 103.991, end: 107.101 },
		"check_marks": { atlas: "atlas_swe", start: 107.101, end: 110.952 },
		"copycat_1": { atlas: "atlas_swe", start: 110.952, end: 112.894 },
		"copycat_3": { atlas: "atlas_swe", start: 112.894, end: 116.669 },
		"count_1": { atlas: "atlas_swe", start: 116.669, end: 120.442 },
		"cupid_1": { atlas: "atlas_swe", start: 120.442, end: 124.336 },
		"curator_1": { atlas: "atlas_swe", start: 124.336, end: 129.769 },
		"diseased_1": { atlas: "atlas_swe", start: 129.769, end: 133.807 },
		"doppelganger_1": { atlas: "atlas_swe", start: 133.807, end: 136.125 },
		"doppelganger_2": { atlas: "atlas_swe", start: 136.125, end: 137.872 },
		"doppelganger_3_prefix": { atlas: "atlas_swe", start: 137.872, end: 139.392 },
		"doppelganger_3_suffix": { atlas: "atlas_swe", start: 139.392, end: 141.008 },
		"doppelganger_4_dreamwolf": { atlas: "atlas_swe", start: 141.008, end: 147.110 },
		"doppelganger_4_prefix": { atlas: "atlas_swe", start: 147.110, end: 147.933 },
		"doppelganger_4_suffix": { atlas: "atlas_swe", start: 147.933, end: 150.918 },
		"doppelganger_wake_prefix": { atlas: "atlas_swe", start: 150.918, end: 153.170 },
		"drunk_1": { atlas: "atlas_swe", start: 153.170, end: 157.808 },
		"empath_1": { atlas: "atlas_swe", start: 157.808, end: 160.016 },
		"empath_2": { atlas: "atlas_swe", start: 160.016, end: 161.049 },
		"empath_q_1": { atlas: "atlas_swe", start: 161.049, end: 163.457 },
		"empath_q_10": { atlas: "atlas_swe", start: 163.457, end: 169.368 },
		"empath_q_11": { atlas: "atlas_swe", start: 169.368, end: 174.169 },
		"empath_q_2": { atlas: "atlas_swe", start: 174.169, end: 176.947 },
		"empath_q_3": { atlas: "atlas_swe", start: 176.947, end: 179.833 },
		"empath_q_4": { atlas: "atlas_swe", start: 179.833, end: 182.850 },
		"empath_q_5": { atlas: "atlas_swe", start: 182.850, end: 185.876 },
		"empath_q_6": { atlas: "atlas_swe", start: 185.876, end: 189.088 },
		"empath_q_7": { atlas: "atlas_swe", start: 189.088, end: 192.196 },
		"empath_q_8": { atlas: "atlas_swe", start: 192.196, end: 195.523 },
		"empath_q_9": { atlas: "atlas_swe", start: 195.523, end: 198.928 },
		"exposer_1": { atlas: "atlas_swe", start: 198.928, end: 199.739 },
		"feudingaliens_doppelganger": { atlas: "atlas_swe", start: 199.739, end: 203.089 },
		"generic_sleep": { atlas: "atlas_swe", start: 203.089, end: 203.641 },
		"generic_wake": { atlas: "atlas_swe", start: 203.641, end: 204.270 },
		"gremlin_1": { atlas: "atlas_swe", start: 204.270, end: 211.497 },
		"hand_down": { atlas: "atlas_swe", start: 211.497, end: 212.328 },
		"hand_out": { atlas: "atlas_swe", start: 212.328, end: 213.872 },
		"insomniac_1": { atlas: "atlas_swe", start: 213.872, end: 215.484 },
		"instigator_1": { atlas: "atlas_swe", start: 215.484, end: 219.659 },
		"leader_1": { atlas: "atlas_swe", start: 219.659, end: 224.556 },
		"leader_2": { atlas: "atlas_swe", start: 224.556, end: 226.815 },
		"leader_doppelganger": { atlas: "atlas_swe", start: 226.815, end: 229.652 },
		"leader_feudingaliens_1": { atlas: "atlas_swe", start: 229.652, end: 232.933 },
		"leader_feudingaliens_2": { atlas: "atlas_swe", start: 232.933, end: 238.965 },
		"list_and": { atlas: "atlas_swe", start: 238.965, end: 239.340 },
		"list_or": { atlas: "atlas_swe", start: 239.340, end: 239.789 },
		"lovers": { atlas: "atlas_swe", start: 239.789, end: 240.624, type: "identity" },
		"lovers_1": { atlas: "atlas_swe", start: 240.624, end: 244.551 },
		"marksman_1": { atlas: "atlas_swe", start: 244.551, end: 249.372 },
		"marksman_2": { atlas: "atlas_swe", start: 249.372, end: 251.198 },
		"mason_doppelganger": { atlas: "atlas_swe", start: 251.198, end: 254.109 },
		"minion_1": { atlas: "atlas_swe", start: 254.109, end: 258.543 },
		"minion_2": { atlas: "atlas_swe", start: 258.543, end: 260.643 },
		"minion_doppelganger": { atlas: "atlas_swe", start: 260.643, end: 263.121 },
		"nostradamus_1": { atlas: "atlas_swe", start: 263.121, end: 266.632 },
		"nostradamus_3": { atlas: "atlas_swe", start: 266.632, end: 267.568 },
		"nostradamus_4": { atlas: "atlas_swe", start: 267.568, end: 268.987 },
		"nostradamus_5": { atlas: "atlas_swe", start: 268.987, end: 273.996 },
		"nostradamus_auto": { atlas: "atlas_swe", start: 273.996, end: 277.924 },
		"nostradamus_doppelganger": { atlas: "atlas_swe", start: 277.924, end: 283.515 },
		"num_1": { atlas: "atlas_swe", start: 283.515, end: 284.008, type: "num" },
		"num_10": { atlas: "atlas_swe", start: 284.008, end: 284.428, type: "num" },
		"num_11": { atlas: "atlas_swe", start: 284.428, end: 284.899, type: "num" },
		"num_12": { atlas: "atlas_swe", start: 284.899, end: 285.384, type: "num" },
		"num_13": { atlas: "atlas_swe", start: 285.384, end: 286.061, type: "num" },
		"num_14": { atlas: "atlas_swe", start: 286.061, end: 286.854, type: "num" },
		"num_15": { atlas: "atlas_swe", start: 286.854, end: 287.639, type: "num" },
		"num_16": { atlas: "atlas_swe", start: 287.639, end: 288.332, type: "num" },
		"num_17": { atlas: "atlas_swe", start: 288.332, end: 289.049, type: "num" },
		"num_18": { atlas: "atlas_swe", start: 289.049, end: 289.704, type: "num" },
		"num_19": { atlas: "atlas_swe", start: 289.704, end: 290.413, type: "num" },
		"num_2": { atlas: "atlas_swe", start: 290.413, end: 290.866, type: "num" },
		"num_20": { atlas: "atlas_swe", start: 290.866, end: 291.498, type: "num" },
		"num_21": { atlas: "atlas_swe", start: 291.498, end: 292.380, type: "num" },
		"num_22": { atlas: "atlas_swe", start: 292.380, end: 293.142, type: "num" },
		"num_23": { atlas: "atlas_swe", start: 293.142, end: 293.902, type: "num" },
		"num_24": { atlas: "atlas_swe", start: 293.902, end: 294.769, type: "num" },
		"num_25": { atlas: "atlas_swe", start: 294.769, end: 295.559, type: "num" },
		"num_26": { atlas: "atlas_swe", start: 295.559, end: 296.443, type: "num" },
		"num_27": { atlas: "atlas_swe", start: 296.443, end: 297.193, type: "num" },
		"num_28": { atlas: "atlas_swe", start: 297.193, end: 298.049, type: "num" },
		"num_29": { atlas: "atlas_swe", start: 298.049, end: 298.857, type: "num" },
		"num_3": { atlas: "atlas_swe", start: 298.857, end: 299.285, type: "num" },
		"num_30": { atlas: "atlas_swe", start: 299.285, end: 299.847, type: "num" },
		"num_4": { atlas: "atlas_swe", start: 299.847, end: 300.380, type: "num" },
		"num_5": { atlas: "atlas_swe", start: 300.380, end: 300.919, type: "num" },
		"num_6": { atlas: "atlas_swe", start: 300.919, end: 301.515, type: "num" },
		"num_7": { atlas: "atlas_swe", start: 301.515, end: 301.931, type: "num" },
		"num_8": { atlas: "atlas_swe", start: 301.931, end: 302.411, type: "num" },
		"num_9": { atlas: "atlas_swe", start: 302.411, end: 302.881, type: "num" },
		"oracle_block_1": { atlas: "atlas_swe", start: 302.881, end: 307.298 },
		"oracle_block_2": { atlas: "atlas_swe", start: 307.298, end: 313.606 },
		"oracle_even": { atlas: "atlas_swe", start: 313.606, end: 315.720 },
		"oracle_even_odd": { atlas: "atlas_swe", start: 315.720, end: 318.867 },
		"oracle_force_ripple": { atlas: "atlas_swe", start: 318.867, end: 321.711 },
		"oracle_force_ripple_no": { atlas: "atlas_swe", start: 321.711, end: 326.624 },
		"oracle_force_ripple_yes": { atlas: "atlas_swe", start: 326.624, end: 329.596 },
		"oracle_guess_1": { atlas: "atlas_swe", start: 329.596, end: 331.945 },
		"oracle_guess_right_1": { atlas: "atlas_swe", start: 331.945, end: 332.567 },
		"oracle_guess_right_2": { atlas: "atlas_swe", start: 332.567, end: 341.340 },
		"oracle_guess_right_3": { atlas: "atlas_swe", start: 341.340, end: 345.225 },
		"oracle_guess_wrong_1": { atlas: "atlas_swe", start: 345.225, end: 345.769 },
		"oracle_guess_wrong_2": { atlas: "atlas_swe", start: 345.769, end: 350.193 },
		"oracle_guess_wrong_3": { atlas: "atlas_swe", start: 350.193, end: 359.662 },
		"oracle_join_aliens": { atlas: "atlas_swe", start: 359.662, end: 361.996 },
		"oracle_join_denied": { atlas: "atlas_swe", start: 361.996, end: 364.102 },
		"oracle_join_full": { atlas: "atlas_swe", start: 364.102, end: 367.521 },
		"oracle_join_partial": { atlas: "atlas_swe", start: 367.521, end: 373.581 },
		"oracle_join_vampires": { atlas: "atlas_swe", start: 373.581, end: 375.517 },
		"oracle_join_werewolves": { atlas: "atlas_swe", start: 375.517, end: 377.681 },
		"oracle_odd": { atlas: "atlas_swe", start: 377.681, end: 379.789 },
		"others_thumb_out": { atlas: "atlas_swe", start: 379.789, end: 382.715 },
		"paranormalinvestigator_1": { atlas: "atlas_swe", start: 382.715, end: 385.752 },
		"paranormalinvestigator_2": { atlas: "atlas_swe", start: 385.752, end: 386.505 },
		"paranormalinvestigator_3": { atlas: "atlas_swe", start: 386.505, end: 389.432 },
		"pickpocket_1": { atlas: "atlas_swe", start: 389.432, end: 394.477 },
		"pickpocket_2": { atlas: "atlas_swe", start: 394.477, end: 396.268 },
		"player": { atlas: "atlas_swe", start: 396.268, end: 396.818 },
		"priest_1": { atlas: "atlas_swe", start: 396.818, end: 399.527 },
		"priest_2": { atlas: "atlas_swe", start: 399.527, end: 404.110 },
		"renfield_1": { atlas: "atlas_swe", start: 404.110, end: 409.020 },
		"renfield_2": { atlas: "atlas_swe", start: 409.020, end: 414.285 },
		"renfield_3": { atlas: "atlas_swe", start: 414.285, end: 416.564 },
		"renfield_doppelganger": { atlas: "atlas_swe", start: 416.564, end: 421.676 },
		"revealer_1": { atlas: "atlas_swe", start: 421.676, end: 423.678 },
		"revealer_2": { atlas: "atlas_swe", start: 423.678, end: 424.609 },
		"revealer_3": { atlas: "atlas_swe", start: 424.609, end: 425.918 },
		"ripple": { atlas: "atlas_swe", start: 425.918, end: 429.220 },
		"ripple_double_vote": { atlas: "atlas_swe", start: 429.220, end: 433.845 },
		"ripple_mute": { atlas: "atlas_swe", start: 433.845, end: 436.642 },
		"ripple_rebuke": { atlas: "atlas_swe", start: 436.642, end: 440.587 },
		"ripple_timer": { atlas: "atlas_swe", start: 440.587, end: 444.141 },
		"robber_1": { atlas: "atlas_swe", start: 444.141, end: 448.975 },
		"robber_2": { atlas: "atlas_swe", start: 448.975, end: 450.725 },
		"robber_3": { atlas: "atlas_swe", start: 450.725, end: 453.676 },
		"role_alien": { atlas: "atlas_swe", start: 453.676, end: 454.533, type: "identity" },
		"role_alien_d": { atlas: "atlas_swe", start: 454.533, end: 455.455, type: "identity" },
		"role_alien_p": { atlas: "atlas_swe", start: 455.455, end: 456.598, type: "identity" },
		"role_alien_p_d": { atlas: "atlas_swe", start: 456.598, end: 457.659, type: "identity" },
		"role_alphawolf": { atlas: "atlas_swe", start: 457.659, end: 458.570, type: "identity" },
		"role_alphawolf_d": { atlas: "atlas_swe", start: 458.570, end: 459.588, type: "identity" },
		"role_apprenticeassassin": { atlas: "atlas_swe", start: 459.588, end: 460.872, type: "identity" },
		"role_apprenticeassassin_d": { atlas: "atlas_swe", start: 460.872, end: 462.133, type: "identity" },
		"role_apprenticeseer": { atlas: "atlas_swe", start: 462.133, end: 463.279, type: "identity" },
		"role_apprenticeseer_d": { atlas: "atlas_swe", start: 463.279, end: 464.389, type: "identity" },
		"role_apprenticetanner": { atlas: "atlas_swe", start: 464.389, end: 465.428, type: "identity" },
		"role_apprenticetanner_d": { atlas: "atlas_swe", start: 465.428, end: 466.522, type: "identity" },
		"role_apprenticetanner_p_d": { atlas: "atlas_swe", start: 466.522, end: 467.724, type: "identity" },
		"role_assassin": { atlas: "atlas_swe", start: 467.724, end: 468.626, type: "identity" },
		"role_assassin_d": { atlas: "atlas_swe", start: 468.626, end: 469.558, type: "identity" },
		"role_auraseer": { atlas: "atlas_swe", start: 469.558, end: 470.628, type: "identity" },
		"role_auraseer_d": { atlas: "atlas_swe", start: 470.628, end: 471.723, type: "identity" },
		"role_beholder": { atlas: "atlas_swe", start: 471.723, end: 472.587, type: "identity" },
		"role_beholder_d": { atlas: "atlas_swe", start: 472.587, end: 473.502, type: "identity" },
		"role_blob": { atlas: "atlas_swe", start: 473.502, end: 474.109, type: "identity" },
		"role_blob_d": { atlas: "atlas_swe", start: 474.109, end: 474.802, type: "identity" },
		"role_bodyguard": { atlas: "atlas_swe", start: 474.802, end: 475.596, type: "identity" },
		"role_bodyguard_d": { atlas: "atlas_swe", start: 475.596, end: 476.374, type: "identity" },
		"role_bodysnatcher": { atlas: "atlas_swe", start: 476.374, end: 477.429, type: "identity" },
		"role_bodysnatcher_d": { atlas: "atlas_swe", start: 477.429, end: 478.490, type: "identity" },
		"role_copycat": { atlas: "atlas_swe", start: 478.490, end: 479.229, type: "identity" },
		"role_copycat_d": { atlas: "atlas_swe", start: 479.229, end: 479.923, type: "identity" },
		"role_count": { atlas: "atlas_swe", start: 479.923, end: 480.527, type: "identity" },
		"role_count_d": { atlas: "atlas_swe", start: 480.527, end: 481.082, type: "identity" },
		"role_cow": { atlas: "atlas_swe", start: 481.082, end: 481.460, type: "identity" },
		"role_cow_d": { atlas: "atlas_swe", start: 481.460, end: 481.880, type: "identity" },
		"role_cupid": { atlas: "atlas_swe", start: 481.880, end: 482.419, type: "identity" },
		"role_cupid_d": { atlas: "atlas_swe", start: 482.419, end: 482.958, type: "identity" },
		"role_curator": { atlas: "atlas_swe", start: 482.958, end: 483.734, type: "identity" },
		"role_curator_d": { atlas: "atlas_swe", start: 483.734, end: 484.462, type: "identity" },
		"role_cursed": { atlas: "atlas_swe", start: 484.462, end: 485.190, type: "identity" },
		"role_cursed_d": { atlas: "atlas_swe", start: 485.190, end: 486.118, type: "identity" },
		"role_diseased": { atlas: "atlas_swe", start: 486.118, end: 486.879, type: "identity" },
		"role_diseased_d": { atlas: "atlas_swe", start: 486.879, end: 487.791, type: "identity" },
		"role_doppelganger": { atlas: "atlas_swe", start: 487.791, end: 488.877, type: "identity" },
		"role_doppelganger_d": { atlas: "atlas_swe", start: 488.877, end: 490.014, type: "identity" },
		"role_dreamwolf": { atlas: "atlas_swe", start: 490.014, end: 490.926, type: "identity" },
		"role_dreamwolf_d": { atlas: "atlas_swe", start: 490.926, end: 491.946, type: "identity" },
		"role_drunk": { atlas: "atlas_swe", start: 491.946, end: 492.868, type: "identity" },
		"role_drunk_d": { atlas: "atlas_swe", start: 492.868, end: 493.901, type: "identity" },
		"role_empath": { atlas: "atlas_swe", start: 493.901, end: 494.676, type: "identity" },
		"role_empath_d": { atlas: "atlas_swe", start: 494.676, end: 495.467, type: "identity" },
		"role_exposer": { atlas: "atlas_swe", start: 495.467, end: 496.386, type: "identity" },
		"role_exposer_d": { atlas: "atlas_swe", start: 496.386, end: 497.334, type: "identity" },
		"role_feudingaliens": { atlas: "atlas_swe", start: 497.334, end: 498.679, type: "identity" },
		"role_feudingaliens_d": { atlas: "atlas_swe", start: 498.679, end: 500.023, type: "identity" },
		"role_feudingaliens_d_p_g": { atlas: "atlas_swe", start: 500.023, end: 501.390, type: "identity" },
		"role_gremlin": { atlas: "atlas_swe", start: 501.390, end: 501.808, type: "identity" },
		"role_gremlin_d": { atlas: "atlas_swe", start: 501.808, end: 502.413, type: "identity" },
		"role_hunter": { atlas: "atlas_swe", start: 502.413, end: 503.119, type: "identity" },
		"role_hunter_d": { atlas: "atlas_swe", start: 503.119, end: 503.837, type: "identity" },
		"role_insomniac": { atlas: "atlas_swe", start: 503.837, end: 504.797, type: "identity" },
		"role_insomniac_d": { atlas: "atlas_swe", start: 504.797, end: 506.022, type: "identity" },
		"role_instigator": { atlas: "atlas_swe", start: 506.022, end: 506.988, type: "identity" },
		"role_instigator_d": { atlas: "atlas_swe", start: 506.988, end: 507.953, type: "identity" },
		"role_leader": { atlas: "atlas_swe", start: 507.953, end: 508.853, type: "identity" },
		"role_leader_d": { atlas: "atlas_swe", start: 508.853, end: 509.736, type: "identity" },
		"role_marksman": { atlas: "atlas_swe", start: 509.736, end: 510.447, type: "identity" },
		"role_marksman_d": { atlas: "atlas_swe", start: 510.447, end: 511.175, type: "identity" },
		"role_mason": { atlas: "atlas_swe", start: 511.175, end: 512.059, type: "identity" },
		"role_mason_d": { atlas: "atlas_swe", start: 512.059, end: 512.908, type: "identity" },
		"role_mason_d_p": { atlas: "atlas_swe", start: 512.908, end: 513.746, type: "identity" },
		"role_master": { atlas: "atlas_swe", start: 513.746, end: 514.446, type: "identity" },
		"role_master_d": { atlas: "atlas_swe", start: 514.446, end: 515.193, type: "identity" },
		"role_minion": { atlas: "atlas_swe", start: 515.193, end: 515.994, type: "identity" },
		"role_minion_d": { atlas: "atlas_swe", start: 515.994, end: 516.812, type: "identity" },
		"role_mortician": { atlas: "atlas_swe", start: 516.812, end: 517.679, type: "identity" },
		"role_mortician_d": { atlas: "atlas_swe", start: 517.679, end: 518.543, type: "identity" },
		"role_mysticwolf": { atlas: "atlas_swe", start: 518.543, end: 519.585, type: "identity" },
		"role_mysticwolf_d": { atlas: "atlas_swe", start: 519.585, end: 520.599, type: "identity" },
		"role_nostradamus": { atlas: "atlas_swe", start: 520.599, end: 521.237, type: "identity" },
		"role_nostradamus_d": { atlas: "atlas_swe", start: 521.237, end: 521.890, type: "identity" },
		"role_oracle": { atlas: "atlas_swe", start: 521.890, end: 522.582, type: "identity" },
		"role_oracle_d": { atlas: "atlas_swe", start: 522.582, end: 523.327, type: "identity" },
		"role_paranormalinvestigator": { atlas: "atlas_swe", start: 523.327, end: 524.359, type: "identity" },
		"role_paranormalinvestigator_d": { atlas: "atlas_swe", start: 524.359, end: 525.395, type: "identity" },
		"role_pickpocket": { atlas: "atlas_swe", start: 525.395, end: 526.126, type: "identity" },
		"role_pickpocket_d": { atlas: "atlas_swe", start: 526.126, end: 526.845, type: "identity" },
		"role_priest": { atlas: "atlas_swe", start: 526.845, end: 527.381, type: "identity" },
		"role_priest_d": { atlas: "atlas_swe", start: 527.381, end: 527.899, type: "identity" },
		"role_prince": { atlas: "atlas_swe", start: 527.899, end: 528.463, type: "identity" },
		"role_prince_d": { atlas: "atlas_swe", start: 528.463, end: 529.017, type: "identity" },
		"role_psychic": { atlas: "atlas_swe", start: 529.017, end: 529.794, type: "identity" },
		"role_psychic_d": { atlas: "atlas_swe", start: 529.794, end: 530.619, type: "identity" },
		"role_rascal": { atlas: "atlas_swe", start: 530.619, end: 531.254, type: "identity" },
		"role_rascal_d": { atlas: "atlas_swe", start: 531.254, end: 531.808, type: "identity" },
		"role_renfield": { atlas: "atlas_swe", start: 531.808, end: 532.499, type: "identity" },
		"role_renfield_d": { atlas: "atlas_swe", start: 532.499, end: 533.189, type: "identity" },
		"role_revealer": { atlas: "atlas_swe", start: 533.189, end: 534.020, type: "identity" },
		"role_revealer_d": { atlas: "atlas_swe", start: 534.020, end: 534.883, type: "identity" },
		"role_robber": { atlas: "atlas_swe", start: 534.883, end: 535.422, type: "identity" },
		"role_robber_d": { atlas: "atlas_swe", start: 535.422, end: 536.003, type: "identity" },
		"role_seer": { atlas: "atlas_swe", start: 536.003, end: 536.714, type: "identity" },
		"role_seer_d": { atlas: "atlas_swe", start: 536.714, end: 537.429, type: "identity" },
		"role_sentinel": { atlas: "atlas_swe", start: 537.429, end: 538.128, type: "identity" },
		"role_sentinel_d": { atlas: "atlas_swe", start: 538.128, end: 538.783, type: "identity" },
		"role_squire": { atlas: "atlas_swe", start: 538.783, end: 539.360, type: "identity" },
		"role_squire_d": { atlas: "atlas_swe", start: 539.360, end: 540.048, type: "identity" },
		"role_syntheticalien": { atlas: "atlas_swe", start: 540.048, end: 540.843, type: "identity" },
		"role_syntheticalien_d": { atlas: "atlas_swe", start: 540.843, end: 541.642, type: "identity" },
		"role_tanner": { atlas: "atlas_swe", start: 541.642, end: 542.284, type: "identity" },
		"role_tanner_d": { atlas: "atlas_swe", start: 542.284, end: 542.978, type: "identity" },
		"role_tanner_p_d": { atlas: "atlas_swe", start: 542.978, end: 543.683, type: "identity" },
		"role_thing": { atlas: "atlas_swe", start: 543.683, end: 544.579, type: "identity" },
		"role_thing_d": { atlas: "atlas_swe", start: 544.579, end: 545.334, type: "identity" },
		"role_troublemaker": { atlas: "atlas_swe", start: 545.334, end: 546.420, type: "identity" },
		"role_troublemaker_d": { atlas: "atlas_swe", start: 546.420, end: 547.525, type: "identity" },
		"role_vampire": { atlas: "atlas_swe", start: 547.525, end: 548.195, type: "identity" },
		"role_vampire_d": { atlas: "atlas_swe", start: 548.195, end: 548.843, type: "identity" },
		"role_vampire_p": { atlas: "atlas_swe", start: 548.843, end: 549.694, type: "identity" },
		"role_vampire_p_d": { atlas: "atlas_swe", start: 549.694, end: 550.591, type: "identity" },
		"role_villageidiot": { atlas: "atlas_swe", start: 550.591, end: 551.526, type: "identity" },
		"role_villageidiot_d": { atlas: "atlas_swe", start: 551.526, end: 552.508, type: "identity" },
		"role_villager": { atlas: "atlas_swe", start: 552.508, end: 553.259, type: "identity" },
		"role_villager_d": { atlas: "atlas_swe", start: 553.259, end: 554.035, type: "identity" },
		"role_villager_p_d": { atlas: "atlas_swe", start: 554.035, end: 554.710, type: "identity" },
		"role_werewolf": { atlas: "atlas_swe", start: 554.710, end: 555.577, type: "identity" },
		"role_werewolf_d": { atlas: "atlas_swe", start: 555.577, end: 556.532, type: "identity" },
		"role_werewolf_p": { atlas: "atlas_swe", start: 556.532, end: 557.348, type: "identity" },
		"role_werewolf_p_d": { atlas: "atlas_swe", start: 557.348, end: 558.158, type: "identity" },
		"role_witch": { atlas: "atlas_swe", start: 558.158, end: 558.646, type: "identity" },
		"role_witch_d": { atlas: "atlas_swe", start: 558.646, end: 559.107, type: "identity" },
		"seer_1": { atlas: "atlas_swe", start: 559.107, end: 563.722 },
		"sentinel_1": { atlas: "atlas_swe", start: 563.722, end: 567.355 },
		"sentinel_2": { atlas: "atlas_swe", start: 567.355, end: 571.665 },
		"shared_may_view_cards": { atlas: "atlas_swe", start: 571.665, end: 573.272 },
		"squire_1": { atlas: "atlas_swe", start: 573.272, end: 577.278 },
		"thing_2": { atlas: "atlas_swe", start: 577.278, end: 583.192 },
		"thumb_down": { atlas: "atlas_swe", start: 583.192, end: 584.062 },
		"timer_30s_warning": { atlas: "atlas_swe", start: 584.062, end: 585.957 },
		"timer_60s_warning": { atlas: "atlas_swe", start: 585.957, end: 587.590 },
		"timer_expired": { atlas: "atlas_swe", start: 587.590, end: 609.214 },
		"troublemaker_1": { atlas: "atlas_swe", start: 609.214, end: 613.974 },
		"vampire_team_1": { atlas: "atlas_swe", start: 613.974, end: 619.341 },
		"view_card_playerlist_prefix": { atlas: "atlas_swe", start: 619.341, end: 621.232 },
		"view_card_prefix_individual": { atlas: "atlas_swe", start: 621.232, end: 623.065 },
		"view_card_prefix_solo": { atlas: "atlas_swe", start: 623.065, end: 623.994 },
		"view_card_prefix_together": { atlas: "atlas_swe", start: 623.994, end: 626.582 },
		"view_card_suffix_any_neighbor": { atlas: "atlas_swe", start: 626.582, end: 627.645 },
		"view_card_suffix_both_neighbors": { atlas: "atlas_swe", start: 627.645, end: 628.924 },
		"view_card_suffix_center": { atlas: "atlas_swe", start: 628.924, end: 630.202 },
		"view_card_suffix_even_players": { atlas: "atlas_swe", start: 630.202, end: 632.472 },
		"view_card_suffix_left_neighbor": { atlas: "atlas_swe", start: 632.472, end: 633.717 },
		"view_card_suffix_odd_players": { atlas: "atlas_swe", start: 633.717, end: 635.978 },
		"view_card_suffix_one_player": { atlas: "atlas_swe", start: 635.978, end: 638.429 },
		"view_card_suffix_other_players": { atlas: "atlas_swe", start: 638.429, end: 640.531 },
		"view_card_suffix_own": { atlas: "atlas_swe", start: 640.531, end: 641.649 },
		"view_card_suffix_right_neighbor": { atlas: "atlas_swe", start: 641.649, end: 642.889 },
		"villageidiot_1": { atlas: "atlas_swe", start: 642.889, end: 649.777 },
		"wake_and_identify": { atlas: "atlas_swe", start: 649.777, end: 651.798 },
		"werewolf_team_1": { atlas: "atlas_swe", start: 651.798, end: 655.676 },
		"werewolf_team_dreamwolf_1": { atlas: "atlas_swe", start: 655.676, end: 658.020 },
		"werewolf_team_dreamwolf_2": { atlas: "atlas_swe", start: 658.020, end: 662.853 },
		"witch_1": { atlas: "atlas_swe", start: 662.853, end: 665.434 },
		"witch_2": { atlas: "atlas_swe", start: 665.434, end: 669.653 },
	};

	// Per clip tuning of silent gaps before (pre) and after (post) a clip is played, in seconds
	const CLIP_GAP = {
		"generic_sleep": { pre: 0.1, post: 0.5 },
		"generic_wake": { pre: 0.1, post: 0.5 },
		"wake_and_identify": { pre: 0.1 },
		"doppelganger_wake_prefix": { post: 0.1 },
		"all_thumbs_down": { post: 0.5 },
		"others_thumb_out": { post: 0.5 },
		"thumb_down": { pre: 0.1, post: 0.5 },
		"list_and": { pre: 0.1, post: 0.1 },
		"list_or": { pre: 0.1, post: 0.1 },
		"empath_2": { pre: 0.2, post: 0.2 },
		"doppelganger_3_prefix": { post: 0.2 },
		"doppelganger_4_prefix": { post: 0.2 },
		"alien_team_cow_doppelganger": { post: 0.2 },
		"mason_doppelganger": { post: 0.2 },
		"feudingaliens_doppelganger": { post: 0.2 },
		"paranormalinvestigator_2": { post: 0.2 },
		"revealer_2": { post: 0.2 },
		"oracle_guess_right_3": { post: 0.2 },
		"apprenticeassassin_2": { post: 0.2 },
		"werewolf_team_dreamwolf_1": { pre: 0.2, post: 0.2 },
		"view_card_prefix_individual": { post: 0.1 },
		"view_card_prefix_together": { post: 0.1 },
		"view_card_prefix_solo": { post: 0.1 },
	};
	
	// Per type tuning of silent gaps before (pre) and after (post) a clip is played, in seconds
	const TYPE_GAP = {
		identity: { post: 0.25 },
		num:  { pre: 0.15, post: 0.15 },
	};

	let _context = null;
	const _buffers = new Map(); // "lang/atlas" -> AudioBuffer | Promise<AudioBuffer>

	/* =========================
	   Initialization
	   ========================= */

	function _init() {
		
	}
	
	_init();


	/* =========================
	   Private functions
	   ========================= */

	function _getContext() {
		if (!_context) _context = new (window.AudioContext || window.webkitAudioContext)();
		return _context;
	}

	function _loadAtlas(lang, atlas) {
		const key = `${lang}/${atlas}`;
		if (_buffers.has(key)) return _buffers.get(key);

		const promise = fetch(`${ATLAS_BASE_URL}/${atlas}.mp3`)
			.then(response => response.arrayBuffer())
			.then(data => _getContext().decodeAudioData(data))
			.catch(error => { _buffers.delete(key); throw error; });

		_buffers.set(key, promise);
		return promise;
	}
	
	// Returns a { pre, post } object for the silent gap added to either side of a played clip
	function _getSilence(name, type) {
		const byClip = CLIP_GAP[name] ?? {};
		const byType = TYPE_GAP[type] ?? {};
		return {
			pre: (byClip.pre ?? 0) + (byType.pre ?? 0),
			post: (byClip.post ?? 0) + (byType.post ?? 0),
		};
	}


	/* =========================
	   Public functions
	   ========================= */

	// Optional: kicks off fetch+decode for every atlas referenced by CLIPS ahead of first use, e.g.
	// at game start, so the first clip of a session doesn't stall on a fetch. play() loads on demand
	// regardless, so this is purely a latency optimization.
	function preload(lang) {
		const atlases = new Set(Object.values(CLIPS).map(c => c.atlas));
		return Promise.all([...atlases].map(atlas => _loadAtlas(lang, atlas)));
	}

	/*
	 * Plays clip `name`. onDone fires once the clip and its post-silence have elapsed; onError fires
	 * instead if the atlas failed to load, or if `name` isn't in CLIPS at all.
	 *
	 * Returns a handle shaped like the bits of HTMLAudioElement callers already use: pause() stops
	 * playback outright, play() restarts the same clip from the beginning. There's no seek/resume-
	 * from-position - a paused atlas clip that resumes always replays in full.
	 */
	function play(name, lang, onDone, onError) {
		const clip = CLIPS[name];
		if (!clip) { onError(); return { pause() {}, play() {} }; }

		const silence = _getSilence(name, clip.type);
		let stopped = false;
		let sourceNode = null;
		let postTimer = null;

		function start() {
			stopped = false;
			_loadAtlas(lang, clip.atlas).then(buffer => {
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
				console.warn("AudioAtlas: failed to load/play clip", name, error);
				if (!stopped) onError();
			});
		}

		function pause() {
			stopped = true;
			if (postTimer !== null) { clearTimeout(postTimer); postTimer = null; }
			if (sourceNode) { sourceNode.onended = null; try { sourceNode.stop(); } catch {} sourceNode = null; }
		}

		start();
		return { pause, play: start };
	}

	return {
		preload,
		play
	};

})();