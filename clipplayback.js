/*
 * Audio atlas playback via Web Audio API.
 *
 * Data is split per active language (see _language, set once in _init()). ATLAS maps each
 * language to its atlas mp3 file. CLIPS maps a clip name (the same name TTSManifest looks
 * clips up by) to its {start, end} region within that language's atlas, in seconds -
 * regenerated wholesale by the packer script and pasted in here on every repack. CLIP_ALIAS
 * lets a clip name reuse another clip's entry verbatim (e.g. plural forms that happen to
 * share a recording) instead of being packed separately - applied once in _init().
 *
 * CLIP_GAP maps clip names to {pre, post} silence padding in seconds; TYPE_GAP does the same
 * for a clip's optional `type` - a shared default for a whole category (e.g. every "num" clip)
 * that CLIP_GAP's per-clip tuning stacks on top of rather than replaces (see _getSilence).
 * Both are looked up per language first, falling back to their COMMON entry, then to no gap;
 * an override replaces the COMMON entry wholesale rather than merging field-by-field. Neither
 * is touched by repacking.
 */
const AudioAtlas = (() => {

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
	 * Table of clips within the atlas, indexed by clip name. The provided MakeAtlas.ps1 script is recommended for creating atlas and generating the table.
	 * A clip entry contains the following fields:
	 *   - start: start position offset from start of file for the start of the clip
	 *   - end:   end position offset from start of file for the end of the clip
	 *   - type:  (optional) clip category for shared gap configurations.
	*/
	const CLIPS = {
		SWE: {
			"alien_team_cow_1":                { start: 0.000, end: 6.220 },
			"alien_team_cow_doppelganger":     { start: 6.220, end: 8.994 },
			"alien_team_do_nothing":           { start: 8.994, end: 13.234 },
			"alien_team_shift_cards_left":     { start: 13.234, end: 17.104 },
			"alien_team_shift_cards_right":    { start: 17.104, end: 20.933 },
			"alien_team_show_cards":           { start: 20.933, end: 22.612 },
			"alien_team_turncoat_1":           { start: 22.612, end: 25.805 },
			"alien_team_turncoat_2a":          { start: 25.805, end: 29.864 },
			"alien_team_turncoat_2b":          { start: 29.864, end: 36.382 },
			"all_hands_down":                  { start: 36.382, end: 38.528 },
			"all_hands_out":                   { start: 38.528, end: 41.911 },
			"all_thumbs_down":                 { start: 41.911, end: 44.168 },
			"alphawolf_1":                     { start: 44.168, end: 50.401 },
			"apprenticeassassin_1":            { start: 50.401, end: 52.233 },
			"apprenticeassassin_2":            { start: 52.233, end: 54.186 },
			"apprenticetanner_1":              { start: 54.186, end: 59.350 },
			"apprenticetanner_doppelganger":   { start: 59.350, end: 64.982 },
			"assassin_1":                      { start: 64.982, end: 69.124 },
			"auraseer_1":                      { start: 69.124, end: 74.740 },
			"beholder_1":                      { start: 74.740, end: 77.946 },
			"blob_duo_left":                   { start: 77.946, end: 83.059 },
			"blob_duo_right":                  { start: 83.059, end: 88.166 },
			"blob_multi_1":                    { start: 88.166, end: 90.912 },
			"blob_multi_2":                    { start: 90.912, end: 93.470 },
			"blob_multi_3":                    { start: 93.470, end: 95.923 },
			"blob_solo":                       { start: 95.923, end: 99.596 },
			"bodysnatcher_1":                  { start: 99.596, end: 102.962 },
			"bodysnatcher_2":                  { start: 102.962, end: 106.072 },
			"check_marks":                     { start: 106.072, end: 109.923 },
			"copycat_1":                       { start: 109.923, end: 111.865 },
			"copycat_3":                       { start: 111.865, end: 115.640 },
			"count_1":                         { start: 115.640, end: 119.413 },
			"cupid_1":                         { start: 119.413, end: 123.307 },
			"curator_1":                       { start: 123.307, end: 128.740 },
			"diseased_1":                      { start: 128.740, end: 132.778 },
			"doppelganger_1":                  { start: 132.778, end: 135.097 },
			"doppelganger_2":                  { start: 135.097, end: 136.843 },
			"doppelganger_3_prefix":           { start: 136.843, end: 138.363 },
			"doppelganger_3_suffix":           { start: 138.363, end: 139.980 },
			"doppelganger_4_dreamwolf":        { start: 139.980, end: 146.081 },
			"doppelganger_4_prefix":           { start: 146.081, end: 146.904 },
			"doppelganger_4_suffix":           { start: 146.904, end: 149.889 },
			"doppelganger_wake_prefix":        { start: 149.889, end: 152.141 },
			"drunk_1":                         { start: 152.141, end: 156.779 },
			"empath_1":                        { start: 156.779, end: 158.987 },
			"empath_2":                        { start: 158.987, end: 160.020 },
			"empath_q_1":                      { start: 160.020, end: 162.428 },
			"empath_q_10":                     { start: 162.428, end: 168.339 },
			"empath_q_11":                     { start: 168.339, end: 173.140 },
			"empath_q_2":                      { start: 173.140, end: 175.918 },
			"empath_q_3":                      { start: 175.918, end: 178.804 },
			"empath_q_4":                      { start: 178.804, end: 181.821 },
			"empath_q_5":                      { start: 181.821, end: 184.847 },
			"empath_q_6":                      { start: 184.847, end: 188.059 },
			"empath_q_7":                      { start: 188.059, end: 191.167 },
			"empath_q_8":                      { start: 191.167, end: 194.494 },
			"empath_q_9":                      { start: 194.494, end: 197.899 },
			"exposer_1":                       { start: 197.899, end: 198.710 },
			"feudingaliens_doppelganger":      { start: 198.710, end: 202.061 },
			"generic_sleep":                   { start: 202.061, end: 202.612 },
			"generic_wake":                    { start: 202.612, end: 203.241 },
			"gremlin_1":                       { start: 203.241, end: 210.468 },
			"hand_down":                       { start: 210.468, end: 211.299 },
			"hand_out":                        { start: 211.299, end: 212.843 },
			"identity_all_players":            { start: 212.843, end: 213.872, type: "identity" },
			"identity_lovers":                 { start: 213.872, end: 214.708, type: "identity" },
			"insomniac_1":                     { start: 214.708, end: 216.320 },
			"instigator_1":                    { start: 216.320, end: 220.495 },
			"leader_1":                        { start: 220.495, end: 225.392 },
			"leader_2":                        { start: 225.392, end: 227.651 },
			"leader_doppelganger":             { start: 227.651, end: 230.488 },
			"leader_feudingaliens_1":          { start: 230.488, end: 233.769 },
			"leader_feudingaliens_2":          { start: 233.769, end: 239.801 },
			"list_and":                        { start: 239.801, end: 240.176 },
			"list_or":                         { start: 240.176, end: 240.624 },
			"lovers_1":                        { start: 240.624, end: 244.551 },
			"marksman_1":                      { start: 244.551, end: 249.372 },
			"marksman_2":                      { start: 249.372, end: 251.198 },
			"mason_doppelganger":              { start: 251.198, end: 254.109 },
			"minion_1":                        { start: 254.109, end: 258.543 },
			"minion_2":                        { start: 258.543, end: 260.643 },
			"minion_doppelganger":             { start: 260.643, end: 263.121 },
			"nostradamus_1":                   { start: 263.121, end: 266.632 },
			"nostradamus_3":                   { start: 266.632, end: 267.568 },
			"nostradamus_4":                   { start: 267.568, end: 268.987 },
			"nostradamus_5":                   { start: 268.987, end: 273.996 },
			"nostradamus_auto":                { start: 273.996, end: 277.924 },
			"nostradamus_doppelganger":        { start: 277.924, end: 283.515 },
			"num_1":                           { start: 283.515, end: 284.008, type: "num" },
			"num_10":                          { start: 284.008, end: 284.428, type: "num" },
			"num_11":                          { start: 284.428, end: 284.899, type: "num" },
			"num_12":                          { start: 284.899, end: 285.384, type: "num" },
			"num_13":                          { start: 285.384, end: 286.061, type: "num" },
			"num_14":                          { start: 286.061, end: 286.854, type: "num" },
			"num_15":                          { start: 286.854, end: 287.639, type: "num" },
			"num_16":                          { start: 287.639, end: 288.332, type: "num" },
			"num_17":                          { start: 288.332, end: 289.049, type: "num" },
			"num_18":                          { start: 289.049, end: 289.704, type: "num" },
			"num_19":                          { start: 289.704, end: 290.413, type: "num" },
			"num_2":                           { start: 290.413, end: 290.866, type: "num" },
			"num_20":                          { start: 290.866, end: 291.498, type: "num" },
			"num_21":                          { start: 291.498, end: 292.380, type: "num" },
			"num_22":                          { start: 292.380, end: 293.142, type: "num" },
			"num_23":                          { start: 293.142, end: 293.902, type: "num" },
			"num_24":                          { start: 293.902, end: 294.769, type: "num" },
			"num_25":                          { start: 294.769, end: 295.559, type: "num" },
			"num_26":                          { start: 295.559, end: 296.443, type: "num" },
			"num_27":                          { start: 296.443, end: 297.193, type: "num" },
			"num_28":                          { start: 297.193, end: 298.049, type: "num" },
			"num_29":                          { start: 298.049, end: 298.857, type: "num" },
			"num_3":                           { start: 298.857, end: 299.285, type: "num" },
			"num_30":                          { start: 299.285, end: 299.847, type: "num" },
			"num_4":                           { start: 299.847, end: 300.380, type: "num" },
			"num_5":                           { start: 300.380, end: 300.919, type: "num" },
			"num_6":                           { start: 300.919, end: 301.515, type: "num" },
			"num_7":                           { start: 301.515, end: 301.931, type: "num" },
			"num_8":                           { start: 301.931, end: 302.411, type: "num" },
			"num_9":                           { start: 302.411, end: 302.881, type: "num" },
			"oracle_block_1":                  { start: 302.881, end: 307.298 },
			"oracle_block_2":                  { start: 307.298, end: 313.606 },
			"oracle_even":                     { start: 313.606, end: 315.720 },
			"oracle_even_odd":                 { start: 315.720, end: 318.867 },
			"oracle_force_ripple":             { start: 318.867, end: 321.711 },
			"oracle_force_ripple_no":          { start: 321.711, end: 326.624 },
			"oracle_force_ripple_yes":         { start: 326.624, end: 329.596 },
			"oracle_guess_1":                  { start: 329.596, end: 331.945 },
			"oracle_guess_right_1":            { start: 331.945, end: 332.567 },
			"oracle_guess_right_2":            { start: 332.567, end: 341.340 },
			"oracle_guess_right_3":            { start: 341.340, end: 345.225 },
			"oracle_guess_wrong_1":            { start: 345.225, end: 345.769 },
			"oracle_guess_wrong_2":            { start: 345.769, end: 350.193 },
			"oracle_guess_wrong_3":            { start: 350.193, end: 359.662 },
			"oracle_join_aliens":              { start: 359.662, end: 361.996 },
			"oracle_join_denied":              { start: 361.996, end: 364.102 },
			"oracle_join_full":                { start: 364.102, end: 367.521 },
			"oracle_join_partial":             { start: 367.521, end: 373.581 },
			"oracle_join_vampires":            { start: 373.581, end: 375.517 },
			"oracle_join_werewolves":          { start: 375.517, end: 377.681 },
			"oracle_odd":                      { start: 377.681, end: 379.789 },
			"others_thumb_out":                { start: 379.789, end: 382.715 },
			"paranormalinvestigator_1":        { start: 382.715, end: 385.752 },
			"paranormalinvestigator_2":        { start: 385.752, end: 386.505 },
			"paranormalinvestigator_3":        { start: 386.505, end: 389.432 },
			"pickpocket_1":                    { start: 389.432, end: 394.477 },
			"pickpocket_2":                    { start: 394.477, end: 396.268 },
			"player":                          { start: 396.268, end: 396.818 },
			"priest_1":                        { start: 396.818, end: 399.527 },
			"priest_2":                        { start: 399.527, end: 404.110 },
			"renfield_1":                      { start: 404.110, end: 409.020 },
			"renfield_2":                      { start: 409.020, end: 414.285 },
			"renfield_3":                      { start: 414.285, end: 416.564 },
			"renfield_doppelganger":           { start: 416.564, end: 421.676 },
			"revealer_1":                      { start: 421.676, end: 423.678 },
			"revealer_2":                      { start: 423.678, end: 424.609 },
			"revealer_3":                      { start: 424.609, end: 425.918 },
			"ripple":                          { start: 425.918, end: 429.220 },
			"ripple_double_vote":              { start: 429.220, end: 433.845 },
			"ripple_mute":                     { start: 433.845, end: 436.642 },
			"ripple_rebuke":                   { start: 436.642, end: 440.587 },
			"ripple_timer":                    { start: 440.587, end: 444.141 },
			"robber_1":                        { start: 444.141, end: 448.975 },
			"robber_2":                        { start: 448.975, end: 450.725 },
			"robber_3":                        { start: 450.725, end: 453.676 },
			"role_alien":                      { start: 453.676, end: 454.533, type: "identity" },
			"role_alien_d":                    { start: 454.533, end: 455.455, type: "identity" },
			"role_alien_p":                    { start: 455.455, end: 456.598, type: "identity" },
			"role_alien_p_d":                  { start: 456.598, end: 457.659, type: "identity" },
			"role_alphawolf":                  { start: 457.659, end: 458.570, type: "identity" },
			"role_alphawolf_d":                { start: 458.570, end: 459.588, type: "identity" },
			"role_apprenticeassassin":         { start: 459.588, end: 460.872, type: "identity" },
			"role_apprenticeassassin_d":       { start: 460.872, end: 462.133, type: "identity" },
			"role_apprenticeseer":             { start: 462.133, end: 463.279, type: "identity" },
			"role_apprenticeseer_d":           { start: 463.279, end: 464.389, type: "identity" },
			"role_apprenticetanner":           { start: 464.389, end: 465.428, type: "identity" },
			"role_apprenticetanner_d":         { start: 465.428, end: 466.522, type: "identity" },
			"role_apprenticetanner_p_d":       { start: 466.522, end: 467.724, type: "identity" },
			"role_assassin":                   { start: 467.724, end: 468.626, type: "identity" },
			"role_assassin_d":                 { start: 468.626, end: 469.558, type: "identity" },
			"role_auraseer":                   { start: 469.558, end: 470.628, type: "identity" },
			"role_auraseer_d":                 { start: 470.628, end: 471.723, type: "identity" },
			"role_beholder":                   { start: 471.723, end: 472.587, type: "identity" },
			"role_beholder_d":                 { start: 472.587, end: 473.502, type: "identity" },
			"role_blob":                       { start: 473.502, end: 474.109, type: "identity" },
			"role_blob_d":                     { start: 474.109, end: 474.802, type: "identity" },
			"role_bodyguard":                  { start: 474.802, end: 475.596, type: "identity" },
			"role_bodyguard_d":                { start: 475.596, end: 476.374, type: "identity" },
			"role_bodysnatcher":               { start: 476.374, end: 477.429, type: "identity" },
			"role_bodysnatcher_d":             { start: 477.429, end: 478.490, type: "identity" },
			"role_copycat":                    { start: 478.490, end: 479.229, type: "identity" },
			"role_copycat_d":                  { start: 479.229, end: 479.923, type: "identity" },
			"role_count":                      { start: 479.923, end: 480.527, type: "identity" },
			"role_count_d":                    { start: 480.527, end: 481.082, type: "identity" },
			"role_cow":                        { start: 481.082, end: 481.460, type: "identity" },
			"role_cow_d":                      { start: 481.460, end: 481.880, type: "identity" },
			"role_cupid":                      { start: 481.880, end: 482.419, type: "identity" },
			"role_cupid_d":                    { start: 482.419, end: 482.958, type: "identity" },
			"role_curator":                    { start: 482.958, end: 483.734, type: "identity" },
			"role_curator_d":                  { start: 483.734, end: 484.462, type: "identity" },
			"role_cursed":                     { start: 484.462, end: 485.190, type: "identity" },
			"role_cursed_d":                   { start: 485.190, end: 486.118, type: "identity" },
			"role_diseased":                   { start: 486.118, end: 486.879, type: "identity" },
			"role_diseased_d":                 { start: 486.879, end: 487.791, type: "identity" },
			"role_doppelganger":               { start: 487.791, end: 488.877, type: "identity" },
			"role_doppelganger_d":             { start: 488.877, end: 490.014, type: "identity" },
			"role_dreamwolf":                  { start: 490.014, end: 490.926, type: "identity" },
			"role_dreamwolf_d":                { start: 490.926, end: 491.946, type: "identity" },
			"role_drunk":                      { start: 491.946, end: 492.868, type: "identity" },
			"role_drunk_d":                    { start: 492.868, end: 493.901, type: "identity" },
			"role_empath":                     { start: 493.901, end: 494.676, type: "identity" },
			"role_empath_d":                   { start: 494.676, end: 495.467, type: "identity" },
			"role_exposer":                    { start: 495.467, end: 496.386, type: "identity" },
			"role_exposer_d":                  { start: 496.386, end: 497.334, type: "identity" },
			"role_feudingaliens":              { start: 497.334, end: 498.679, type: "identity" },
			"role_feudingaliens_d":            { start: 498.679, end: 500.023, type: "identity" },
			"role_feudingaliens_d_p_g":        { start: 500.023, end: 501.390, type: "identity" },
			"role_gremlin":                    { start: 501.390, end: 501.808, type: "identity" },
			"role_gremlin_d":                  { start: 501.808, end: 502.413, type: "identity" },
			"role_hunter":                     { start: 502.413, end: 503.119, type: "identity" },
			"role_hunter_d":                   { start: 503.119, end: 503.837, type: "identity" },
			"role_insomniac":                  { start: 503.837, end: 504.797, type: "identity" },
			"role_insomniac_d":                { start: 504.797, end: 506.022, type: "identity" },
			"role_instigator":                 { start: 506.022, end: 506.988, type: "identity" },
			"role_instigator_d":               { start: 506.988, end: 507.953, type: "identity" },
			"role_leader":                     { start: 507.953, end: 508.853, type: "identity" },
			"role_leader_d":                   { start: 508.853, end: 509.736, type: "identity" },
			"role_marksman":                   { start: 509.736, end: 510.447, type: "identity" },
			"role_marksman_d":                 { start: 510.447, end: 511.175, type: "identity" },
			"role_mason":                      { start: 511.175, end: 512.059, type: "identity" },
			"role_mason_d":                    { start: 512.059, end: 512.908, type: "identity" },
			"role_mason_d_p":                  { start: 512.908, end: 513.746, type: "identity" },
			"role_master":                     { start: 513.746, end: 514.446, type: "identity" },
			"role_master_d":                   { start: 514.446, end: 515.193, type: "identity" },
			"role_minion":                     { start: 515.193, end: 515.994, type: "identity" },
			"role_minion_d":                   { start: 515.994, end: 516.812, type: "identity" },
			"role_mortician":                  { start: 516.812, end: 517.679, type: "identity" },
			"role_mortician_d":                { start: 517.679, end: 518.543, type: "identity" },
			"role_mysticwolf":                 { start: 518.543, end: 519.585, type: "identity" },
			"role_mysticwolf_d":               { start: 519.585, end: 520.599, type: "identity" },
			"role_nostradamus":                { start: 520.599, end: 521.237, type: "identity" },
			"role_nostradamus_d":              { start: 521.237, end: 521.890, type: "identity" },
			"role_oracle":                     { start: 521.890, end: 522.582, type: "identity" },
			"role_oracle_d":                   { start: 522.582, end: 523.327, type: "identity" },
			"role_paranormalinvestigator":     { start: 523.327, end: 524.359, type: "identity" },
			"role_paranormalinvestigator_d":   { start: 524.359, end: 525.395, type: "identity" },
			"role_pickpocket":                 { start: 525.395, end: 526.126, type: "identity" },
			"role_pickpocket_d":               { start: 526.126, end: 526.845, type: "identity" },
			"role_priest":                     { start: 526.845, end: 527.381, type: "identity" },
			"role_priest_d":                   { start: 527.381, end: 527.899, type: "identity" },
			"role_prince":                     { start: 527.899, end: 528.463, type: "identity" },
			"role_prince_d":                   { start: 528.463, end: 529.017, type: "identity" },
			"role_psychic":                    { start: 529.017, end: 529.794, type: "identity" },
			"role_psychic_d":                  { start: 529.794, end: 530.619, type: "identity" },
			"role_rascal":                     { start: 530.619, end: 531.254, type: "identity" },
			"role_rascal_d":                   { start: 531.254, end: 531.808, type: "identity" },
			"role_renfield":                   { start: 531.808, end: 532.499, type: "identity" },
			"role_renfield_d":                 { start: 532.499, end: 533.189, type: "identity" },
			"role_revealer":                   { start: 533.189, end: 534.020, type: "identity" },
			"role_revealer_d":                 { start: 534.020, end: 534.883, type: "identity" },
			"role_robber":                     { start: 534.883, end: 535.422, type: "identity" },
			"role_robber_d":                   { start: 535.422, end: 536.003, type: "identity" },
			"role_seer":                       { start: 536.003, end: 536.714, type: "identity" },
			"role_seer_d":                     { start: 536.714, end: 537.429, type: "identity" },
			"role_sentinel":                   { start: 537.429, end: 538.128, type: "identity" },
			"role_sentinel_d":                 { start: 538.128, end: 538.783, type: "identity" },
			"role_squire":                     { start: 538.783, end: 539.360, type: "identity" },
			"role_squire_d":                   { start: 539.360, end: 540.048, type: "identity" },
			"role_syntheticalien":             { start: 540.048, end: 540.843, type: "identity" },
			"role_syntheticalien_d":           { start: 540.843, end: 541.642, type: "identity" },
			"role_tanner":                     { start: 541.642, end: 542.284, type: "identity" },
			"role_tanner_d":                   { start: 542.284, end: 542.978, type: "identity" },
			"role_tanner_p_d":                 { start: 542.978, end: 543.683, type: "identity" },
			"role_thing":                      { start: 543.683, end: 544.579, type: "identity" },
			"role_thing_d":                    { start: 544.579, end: 545.334, type: "identity" },
			"role_troublemaker":               { start: 545.334, end: 546.420, type: "identity" },
			"role_troublemaker_d":             { start: 546.420, end: 547.525, type: "identity" },
			"role_vampire":                    { start: 547.525, end: 548.195, type: "identity" },
			"role_vampire_d":                  { start: 548.195, end: 548.843, type: "identity" },
			"role_vampire_p":                  { start: 548.843, end: 549.694, type: "identity" },
			"role_vampire_p_d":                { start: 549.694, end: 550.591, type: "identity" },
			"role_villageidiot":               { start: 550.591, end: 551.526, type: "identity" },
			"role_villageidiot_d":             { start: 551.526, end: 552.508, type: "identity" },
			"role_villager":                   { start: 552.508, end: 553.259, type: "identity" },
			"role_villager_d":                 { start: 553.259, end: 554.035, type: "identity" },
			"role_villager_p_d":               { start: 554.035, end: 554.710, type: "identity" },
			"role_werewolf":                   { start: 554.710, end: 555.577, type: "identity" },
			"role_werewolf_d":                 { start: 555.577, end: 556.532, type: "identity" },
			"role_werewolf_p":                 { start: 556.532, end: 557.348, type: "identity" },
			"role_werewolf_p_d":               { start: 557.348, end: 558.158, type: "identity" },
			"role_witch":                      { start: 558.158, end: 558.646, type: "identity" },
			"role_witch_d":                    { start: 558.646, end: 559.107, type: "identity" },
			"seer_1":                          { start: 559.107, end: 563.722 },
			"sentinel_1":                      { start: 563.722, end: 567.355 },
			"sentinel_2":                      { start: 567.355, end: 571.665 },
			"shared_may_view_cards":           { start: 571.665, end: 573.272 },
			"squire_1":                        { start: 573.272, end: 577.278 },
			"thing_2":                         { start: 577.278, end: 583.192 },
			"thumb_down":                      { start: 583.192, end: 584.062 },
			"timer_30s_warning":               { start: 584.062, end: 585.957 },
			"timer_60s_warning":               { start: 585.957, end: 587.590 },
			"timer_expired":                   { start: 587.590, end: 609.214 },
			"troublemaker_1":                  { start: 609.214, end: 613.974 },
			"vampire_team_1":                  { start: 613.974, end: 619.341 },
			"view_card_playerlist_prefix":     { start: 619.341, end: 621.232 },
			"view_card_prefix_individual":     { start: 621.232, end: 623.065 },
			"view_card_prefix_solo":           { start: 623.065, end: 623.994 },
			"view_card_prefix_together":       { start: 623.994, end: 626.582 },
			"view_card_suffix_any_neighbor":   { start: 626.582, end: 627.645 },
			"view_card_suffix_both_neighbors": { start: 627.645, end: 628.924 },
			"view_card_suffix_center":         { start: 628.924, end: 630.202 },
			"view_card_suffix_even_players":   { start: 630.202, end: 632.472 },
			"view_card_suffix_left_neighbor":  { start: 632.472, end: 633.717 },
			"view_card_suffix_odd_players":    { start: 633.717, end: 635.978 },
			"view_card_suffix_one_player":     { start: 635.978, end: 638.128 },
			"view_card_suffix_other_players":  { start: 638.128, end: 640.229 },
			"view_card_suffix_own":            { start: 640.229, end: 641.348 },
			"view_card_suffix_right_neighbor": { start: 641.348, end: 642.588 },
			"villageidiot_1":                  { start: 642.588, end: 649.475 },
			"wake_and_identify":               { start: 649.475, end: 651.497 },
			"werewolf_team_1":                 { start: 651.497, end: 655.375 },
			"werewolf_team_dreamwolf_1":       { start: 655.375, end: 657.719 },
			"werewolf_team_dreamwolf_2":       { start: 657.719, end: 662.551 },
			"witch_1":                         { start: 662.551, end: 665.133 },
			"witch_2":                         { start: 665.133, end: 669.351 },
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
			"players":              "player",
			"role_feudingaliens_p": "role_feudingaliens",
			"role_mason_p":         "role_mason",

			// ALIEN
			"team_alien":           "role_alien",
			"team_alien_d":         "role_alien_p_d",
			"team_alien_d_g":       "role_alien_p_d_g",
			"team_alien_g":         "role_alien_g",
			"team_alien_p":         "role_alien_p",
			"team_alien_p_d":       "role_alien_p_d",
			"team_alien_p_d_g":     "role_alien_p_d_g",
			"team_alien_p_g":       "role_alien_p_g",

			// VAMPIRE
			"team_vampire":         "role_vampire",
			"team_vampire_d":       "role_vampire_p_d",
			"team_vampire_d_g":     "role_vampire_p_d_g",
			"team_vampire_g":       "role_vampire_g",
			"team_vampire_p":       "role_vampire_p",
			"team_vampire_p_d":     "role_vampire_p_d",
			"team_vampire_p_d_g":   "role_vampire_p_d_g",
			"team_vampire_p_g":     "role_vampire_p_g",

			// VILLAGE -> VILLAGER
			"team_village":         "role_villager",
			"team_village_d":       "role_villager_p_d",
			"team_village_d_g":     "role_villager_p_d_g",
			"team_village_g":       "role_villager_g",
			"team_village_p":       "role_villager_p",
			"team_village_p_d":     "role_villager_p_d",
			"team_village_p_d_g":   "role_villager_p_d_g",
			"team_village_p_g":     "role_villager_p_g",

			// WEREWOLF
			"team_werewolf":        "role_werewolf",
			"team_werewolf_d":      "role_werewolf_p_d",
			"team_werewolf_d_g":    "role_werewolf_p_d_g",
			"team_werewolf_g":      "role_werewolf_g",
			"team_werewolf_p":      "role_werewolf_p",
			"team_werewolf_p_d":    "role_werewolf_p_d",
			"team_werewolf_p_d_g":  "role_werewolf_p_d_g",
			"team_werewolf_p_g":    "role_werewolf_p_g",
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
			console.warn(`AudioAtlas: no CLIPS table for language "${_language}"`);
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
		if (!clip) { onError(); return { pause() {}, play() {} }; }

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
				console.warn("AudioAtlas: failed to load/play clip", name, error);
				if (!stopped) onError();
			});
		}

		function pause() {
			stopped = true;
			stopNow();
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