let LANG = "ENG";

const LOCALIZATION = {
	ENG: {
		LIST_AND: "and",
		LIST_OR: "or",
		PROMPT_ALIEN: "{TEAM_ALIEN_PLURAL}, {IfDoppelgangerPresent:'PROMPT_ALIEN_DOPPELGANGER'} wake up and identify each other. {AlienRandomEvent} {IfPresent:'COW','PROMPT_ALIEN_COW'} {TEAM_ALIEN_PLURAL}, go to sleep.",
		PROMPT_ALIEN_COW: "{ROLE_COW}{IfDoppelgangerPresent:'PROMPT_ALIEN_COW_DOPPELGANGER'}, hold out a hand. If at least one {TEAM_ALIEN} is adjacent to {ROLE_COW_DEFINITE}, touch {ROLE_COW_DEFINITE}'s hand. {ROLE_COW}, put your hand down.",
		PROMPT_ALIEN_COW_DOPPELGANGER: ", and {ROLE_DOPPELGANGER_DEFINITE} if you saw {ROLE_COW_DEFINITE}",
		PROMPT_ALIEN_DOPPELGANGER: "and {ROLE_DOPPELGANGER_DEFINITE} if you saw a {TEAM_ALIEN} card, ",
		PROMPT_ALIEN_MAKE_ALIEN: "All other players, hold out a hand. {TEAM_ALIEN_DEFINITE}, choose another player to turn into a {TEAM_ALIEN} and touch their hand. That player is now a {TEAM_ALIEN} regardless of what happens to their card. All players, put your hands down.",
		PROMPT_ALIEN_MAKE_MINION: "All other players, hold out a hand. {TEAM_ALIEN_DEFINITE}, choose another player to become a minion and touch their hand. That player now wins if {TEAM_ALIEN_DEFINITE} wins, regardless of whether they are eliminated or what happens to their card. All players, put your hands down.",
		PROMPT_ALIEN_NOTHING: "Do nothing, just stare at each other until it becomes awkward.",
		PROMPT_ALIEN_SHOW_CARDS: "Show your cards to all other {TEAM_ALIEN_DEFINITE}.",
		PROMPT_ALIEN_TRADE_LEFT: "Give your cards to the nearest {TEAM_ALIEN} to your left.",
		PROMPT_ALIEN_TRADE_RIGHT: "Give your cards to the nearest {TEAM_ALIEN} to your right.",
		PROMPT_ALIEN_VIEW_CARD_COLLECTIVE: "You may look at {AlienViewCard:true} together.",
		PROMPT_ALIEN_VIEW_CARD_INDIVIDUAL: "You may look at {AlienViewCard:false} individually.",
		PROMPT_ALPHA_WOLF: "{ROLE_ALPHAWOLF}, wake up. Exchange the extra center card with another player's card who is not already a werewolf. {ROLE_ALPHAWOLF}, go to sleep.",
		PROMPT_APPRENTICEASSASSIN: "{ROLE_APPRENTICEASSASSIN}, wake up. Identify {ROLE_ASSASSIN_DEFINITE}. If there is no {ROLE_ASSASSIN}, replace another player's mark with {ROLE_ASSASSIN_DEFINITE}'s mark. {ROLE_APPRENTICEASSASSIN}, go to sleep.",
		PROMPT_APPRENTICEASSASSIN_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_APPRENTICEASSASSIN_DEFINITE}, wake up. Identify {ROLE_ASSASSIN_DEFINITE}. If there is no {ROLE_ASSASSIN}, replace another player's mark with {ROLE_ASSASSIN_DEFINITE}'s mark. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_APPRENTICESEER: "{ROLE_APPRENTICESEER}, wake up. You may look at one of the center cards. {ROLE_APPRENTICESEER}, go to sleep.",
		PROMPT_APPRENTICETANNER: "{ROLE_APPRENTICETANNER}, wake up. {ROLE_TANNER}, hold out a thumb so {ROLE_APPRENTICETANNER} can see who you are. {ROLE_APPRENTICETANNER}, go to sleep. {IfDoppelgangerPresent:'PROMPT_APPRENTICETANNER_DOPPELGANGER'} {ROLE_TANNER}, put your thumb down.",
		PROMPT_APPRENTICETANNER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_APPRENTICETANNER_DEFINITE}, wake up. {ROLE_TANNER}, keep your thumb out so {ROLE_DOPPELGANGER_DEFINITE} can see who you are. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_ASSASSIN: "{ROLE_ASSASSIN}, wake up. Replace another player's mark with {ROLE_ASSASSIN_DEFINITE}'s mark. {IfPresent:'APPRENTICEASSASSIN','PROMPT_APPRENTICEASSASSIN'} {ApprenticeAssassinDoppelganger} {ROLE_ASSASSIN}, go to sleep.",
		PROMPT_ASSASSIN_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_ASSASSIN_DEFINITE}, wake up. Replace another player's mark with {ROLE_ASSASSIN_DEFINITE}'s mark. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_AURASEER: "{ROLE_AURASEER}, wake up. {ListRolesWithTag:'AURA_SEER_DETECTABLE',false}, if you have looked at or moved cards, hold out a thumb so {ROLE_AURASEER_DEFINITE} can see. {ROLE_AURASEER}, go to sleep. {IfDoppelgangerPresent:'PROMPT_AURASEER_DOPPELGANGER'} All players, put your thumbs down.",
		PROMPT_AURASEER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_AURASEER_DEFINITE}, wake up. Everyone else, keep your thumb out so {ROLE_DOPPELGANGER_DEFINITE} can see. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_BEHOLDER: "{ROLE_BEHOLDER}, wake up. {ListRolesWithTag:'BEHOLDER_DETECTABLE',false}, hold out a thumb so {ROLE_BEHOLDER_DEFINITE} can see. {ROLE_BEHOLDER}, look at their cards. {ROLE_BEHOLDER}, go to sleep. {IfDoppelgangerPresent:'PROMPT_BEHOLDER_DOPPELGANGER'} {ListRolesWithTag:'BEHOLDER_DETECTABLE',false}, put your thumbs down.",
		PROMPT_BEHOLDER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_BEHOLDER_DEFINITE}, wake up. {ListRolesWithTag:'BEHOLDER_DETECTABLE',false}, keep your thumb out so {ROLE_DOPPELGANGER_DEFINITE} can see. {ROLE_DOPPELGANGER}, look at their cards. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_BLOB: "{ROLE_BLOB}, {IfDoppelgangerPresent:'PROMPT_BLOB_DOPPELGANGER'} {BlobObjective}.",
		PROMPT_BLOB_DOPPELGANGER: "and {ROLE_DOPPELGANGER_DEFINITE} if you saw {ROLE_BLOB_DEFINITE},",
		PROMPT_BLOB_OBJECTIVE_ALONE: "You only need to prevent yourself from being eliminated",
		PROMPT_BLOB_OBJECTIVE_MULTI: "You must prevent the nearest {BlobPlayerCount:true} players to your left and {BlobPlayerCount:false} players to your right from being eliminated",
		PROMPT_BLOB_OBJECTIVE_SINGLE_LEFT: "You must prevent the player to your immediate left from being eliminated",
		PROMPT_BLOB_OBJECTIVE_SINGLE_RIGHT: "You must prevent the player to your immediate right from being eliminated",
		PROMPT_BODYSNATCHER: "{ROLE_BODYSNATCHER}, wake up. {BodySnatcherFakeEvent:false} You may look at {BodySnatcherRandomEvent:false}. Then swap your card with the one you viewed. Your new card is also a {TEAM_ALIEN}. {ROLE_BODYSNATCHER}, go to sleep.",
		PROMPT_BODYSNATCHER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_BODYSNATCHER_DEFINITE}, wake up. {BodySnatcherFakeEvent:true} You may look at {BodySnatcherRandomEvent:false}. Then swap your card with the one you viewed. Your new card is also a {TEAM_ALIEN}. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_BODYSNATCHER_FAKE_ACTION: "<Narrator: indicate that the action should not be performed>.",
		PROMPT_CHECK_MARKS: "All players, wake up. Check your marks without showing them to anyone else. All players, go to sleep.",
		PROMPT_COPYCAT: "{ROLE_COPYCAT}, wake up. Look at one of the center cards. You are now that role. When that role is called, wake up and perform its action. {ROLE_COPYCAT}, go to sleep.",
		PROMPT_COUNT: "{ROLE_COUNT}, wake up. {PROMPT_COUNT_ACTION} {ROLE_COUNT}, go to sleep.",
		PROMPT_COUNT_ACTION: "Replace another player's mark with {ROLE_COUNT_DEFINITE}'s mark.",
		PROMPT_COUNT_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_COUNT_DEFINITE}, wake up. {PROMPT_COUNT_ACTION} {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_CUPID: "{ROLE_CUPID}, wake up. Replace two other players' marks with {ROLE_CUPID_DEFINITE}'s mark. {ROLE_CUPID}, go to sleep.",
		PROMPT_CUPID_LOVERS: "Lovers, wake up. Identify each other. If one of you is eliminated, the other is also eliminated. Lovers, go to sleep.",
		PROMPT_CURATOR: "{ROLE_CURATOR}, wake up. {PROMPT_CURATOR_PLACE_ARTIFACT} {ROLE_CURATOR}, go to sleep.",
		PROMPT_CURATOR_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_CURATOR_DEFINITE}, wake up. {PROMPT_CURATOR_PLACE_ARTIFACT} {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_CURATOR_PLACE_ARTIFACT: "Place an artifact face down on another player's card without looking at it.",
		PROMPT_DISEASED: "{ROLE_DISEASED}, wake up. Replace one of your neighbors' marks with {ROLE_DISEASED_DEFINITE}'s mark. {ROLE_DISEASED}, go to sleep.",
		PROMPT_DOPPELGANGER: "{ROLE_DOPPELGANGER}, wake up. Look at another player's card. You are now that role. {IfAnyWithTag:'DOPPELGANGER_IMMEDIATE_ACTION','PROMPT_DOPPELGANGER_IMMEDIATE_ACTION'} {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_DOPPELGANGER_IMMEDIATE_ACTION: "If the role you saw was {ListRolesWithTag:'DOPPELGANGER_IMMEDIATE_ACTION'}, perform its action now.",
		PROMPT_DRUNK: "{ROLE_DRUNK}, wake up. {PROMPT_DRUNK_ACTION} {ROLE_DRUNK}, go to sleep.",
		PROMPT_DRUNK_ACTION: "Swap your card with one of the center cards without looking at it.",
		PROMPT_EMPATH: "{ROLE_EMPATH}, wake up. Observe what the other players are doing. Player {EmpathPlayerList:false}, without waking, {EmpathPlayerAction:false} {ROLE_EMPATH}, go to sleep.",
		PROMPT_EMPATH_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_EMPATH_DEFINITE}, wake up. Observe what the other players are doing. Player {EmpathPlayerList:true}, without waking, {EmpathPlayerAction:true} {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_EMPATH_QUESTION_10: "give a thumbs up if you think you will win, or a thumbs down if you think you will lose.",
		PROMPT_EMPATH_QUESTION_11: "point to the player you think is most likely to have already forgotten their role.",
		PROMPT_EMPATH_QUESTION_1: "point to a player you think will win.",
		PROMPT_EMPATH_QUESTION_2: "point to a player you think will be eliminated.",
		PROMPT_EMPATH_QUESTION_3: "point to the player you trust the most.",
		PROMPT_EMPATH_QUESTION_4: "point to the player you trust the least.",
		PROMPT_EMPATH_QUESTION_5: "point to a player you think is part of {TEAM_VILLAGE_DEFINITE}.",
		PROMPT_EMPATH_QUESTION_6: "point to the player you think will talk the most.",
		PROMPT_EMPATH_QUESTION_7: "point to the player you think will talk the least.",
		PROMPT_EMPATH_QUESTION_8: "point to the player you think is best at bluffing.",
		PROMPT_EMPATH_QUESTION_9: "point to the player you think is worst at bluffing.",
		PROMPT_EXPOSER: "{ROLE_EXPOSER}, wake up. You may flip {ExposerCardCount:false} center cards. {ROLE_EXPOSER}, go to sleep.",
		PROMPT_EXPOSER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_EXPOSER_DEFINITE}, wake up. You may flip {ExposerCardCount:true} center cards. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_FEUDINGALIENS: "{ROLE_FEUDINGALIENS}, {IfDoppelgangerPresent:'PROMPT_FEUDINGALIENS_DOPPELGANGER'} wake up and identify each other. {ROLE_FEUDINGALIENS}, go to sleep.",
		PROMPT_FEUDINGALIENS_DOPPELGANGER: "and {ROLE_DOPPELGANGER_DEFINITE} if you saw one of {ROLE_FEUDINGALIENS_DEFINITE}'s cards, ",
		PROMPT_GREMLIN: "{ROLE_GREMLIN}, wake up. {PROMPT_GREMLIN_ACTION} {ROLE_GREMLIN}, go to sleep.",
		PROMPT_GREMLIN_ACTION: "Swap either two other players' marks or two other players' cards, without looking at them.",
		PROMPT_GREMLIN_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_GREMLIN_DEFINITE}, wake up. {PROMPT_GREMLIN_ACTION} {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_INSOMNIAC: "{ROLE_INSOMNIAC}, wake up. Look at your own card. {ROLE_INSOMNIAC}, go to sleep.",
		PROMPT_INSOMNIAC_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_INSOMNIAC_DEFINITE}, wake up. Look at your own card. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_INSTIGATOR: "{ROLE_INSTIGATOR}, wake up. Replace another player's mark with {ROLE_INSTIGATOR_DEFINITE}'s mark. {ROLE_INSTIGATOR}, go to sleep.",
		PROMPT_LEADER: "{ROLE_LEADER}, wake up. {TEAM_ALIEN_PLURAL}, hold out a thumb so {ROLE_LEADER_DEFINITE} can see. {IfPresent:'FEUDINGALIENS','PROMPT_LEADER_FEUDINGALIENS'} {ROLE_LEADER}, go to sleep. {IfDoppelgangerPresent:'PROMPT_LEADER_DOPPELGANGER'} {TEAM_ALIEN_PLURAL}, put your thumbs down.",
		PROMPT_LEADER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_LEADER_DEFINITE}, wake up. {TEAM_ALIEN_PLURAL}, keep your thumbs out so {ROLE_DOPPELGANGER} can see. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_LEADER_FEUDINGALIENS: "{ROLE_FEUDINGALIENS}, hold out both thumbs. {ROLE_LEADER}, if you see both {ROLE_FEUDINGALIENS_DEFINITE}, you win if neither of them is eliminated.",
		PROMPT_MARKSMAN: "{ROLE_MARKSMAN}, wake up. {PROMPT_MARKSMAN_ACTION} {ROLE_MARKSMAN}, go to sleep.",
		PROMPT_MARKSMAN_ACTION: "Look at another player's card, and another player's mark. They must not be the same player.",
		PROMPT_MARKSMAN_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_MARKSMAN_DEFINITE}, wake up. {PROMPT_MARKSMAN_ACTION} {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_MASON: "{ROLE_MASON}, {IfDoppelgangerPresent:'PROMPT_MASON_DOPPELGANGER'} wake up and identify each other. {ROLE_MASON}, go to sleep.",
		PROMPT_MASON_DOPPELGANGER: "and {ROLE_DOPPELGANGER_DEFINITE} if you saw a {ROLE_MASON},",
		PROMPT_MINION: "{ROLE_MINION}, wake up. {TEAM_WEREWOLF_PLURAL}, hold out a thumb so {ROLE_MINION_DEFINITE} can see who you are. {ROLE_MINION}, go to sleep. {IfDoppelgangerPresent:'PROMPT_MINION_DOPPELGANGER'} {TEAM_WEREWOLF_PLURAL}, put your thumbs down.",
		PROMPT_MINION_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_MINION_DEFINITE}, wake up. {TEAM_WEREWOLF_PLURAL}, keep your thumbs out so {ROLE_DOPPELGANGER_DEFINITE} can see who you are. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_MORTICIAN: "{ROLE_MORTICIAN}, wake up. You may look at {MorticianRandomEvent:false}. {ROLE_MORTICIAN}, go to sleep.",
		PROMPT_MORTICIAN_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_MORTICIAN_DEFINITE}, wake up. You may look at {MorticianRandomEvent:true}. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_MORTICIAN_FALLBACK: "<left/right/both neighbors/your own card>",
		PROMPT_MYSTIC_WOLF: "{ROLE_MYSTICWOLF}, wake up. You may look at another player's card. {ROLE_MYSTICWOLF}, go to sleep.",
		PROMPT_NOSTRADAMUS_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_NOSTRADAMUS_DEFINITE}, the same win condition applies to you.",
		PROMPT_NOSTRADAMUS_MAIN: "{ROLE_NOSTRADAMUS}, wake up. You may look at one to three other players' cards. {IfAnyWithTag:'PI_CONVERSION_ROLE','PROMPT_NOSTRADAMUS_WARNING'} {ROLE_NOSTRADAMUS}, go to sleep.",
		PROMPT_NOSTRADAMUS_WARNING: "If you see: {ListRolesWithTag:'PI_CONVERSION_ROLE'}, you must stop. <Narrator: announce which team {ROLE_NOSTRADAMUS_DEFINITE} now belongs to, or {NostradamusRandomTeam}>. If you are not eliminated and that team wins, you also win.{IfDoppelgangerPresent:'PROMPT_NOSTRADAMUS_DOPPELGANGER'}",
		PROMPT_ORACLE: "{ROLE_ORACLE}, wake up. {OracleRandomEvent} {ROLE_ORACLE}, go to sleep.",
		PROMPT_ORACLE_BLOCK_ACTION: "All other players, hold out a hand. {ROLE_ORACLE}, touch another player's hand to block them. That player may not wake or perform any action during the night regardless of their role.",
		PROMPT_ORACLE_CHANGE_TEAM: "Do you want to join {OracleChangeTeamChoice}'s team? <IF YES> {OracleChangeTeamMode} <IF NO> {ROLE_ORACLE_DEFINITE} remains on the village team.",
		PROMPT_ORACLE_CHANGE_TEAM_FULL: "{ROLE_ORACLE_DEFINITE} is now that role and wakes with them.",
		PROMPT_ORACLE_CHANGE_TEAM_PARTIAL: "{ROLE_ORACLE_DEFINITE} now wins with that team, but is not that role and does not wake with them.",
		PROMPT_ORACLE_EVEN_ODD: "<Narrator: reveal whether {ROLE_ORACLE_DEFINITE} has an even or odd player number>.",
		PROMPT_ORACLE_FALLBACK: "<Error in settings for {ROLE_ORACLE}>",
		PROMPT_ORACLE_HUNT: "Guess a number between 1 and 10. {OracleHuntResult}",
		PROMPT_ORACLE_HUNT_AVOIDED: "Correct. When another role is instructed to wake, you may once during the night wake with them to observe who they are and what they do. {OracleOmniscienceExclusion}",
		PROMPT_ORACLE_HUNT_OMNISCIENCE: "However, you may not wake to observe any of the following roles: {ListRolesWithTag:'ORACLE_OMNISCIENCE_EXCLUDED'}.",
		PROMPT_ORACLE_HUNT_STARTED: "Incorrect. {ROLE_ORACLE}, you now win only if you are not eliminated. All other players, regardless of previous role and team, now have one win condition: find {ROLE_ORACLE_DEFINITE}.",
		PROMPT_ORACLE_VIEW_CARD: "You may look at {OracleViewCard}.",
		PROMPT_PARANORMALINVESTIGATOR_MAIN: "{ROLE_PARANORMALINVESTIGATOR}, wake up. You may look at one or two other players' cards. {IfAnyWithTag:'PI_CONVERSION_ROLE','PROMPT_PARANORMALINVESTIGATOR_WARNING'} {ROLE_PARANORMALINVESTIGATOR}, go to sleep.",
		PROMPT_PARANORMALINVESTIGATOR_WARNING: "If you see: {ListRolesWithTag:'PI_CONVERSION_ROLE'}, you must stop. You now belong to that team.",
		PROMPT_PICKPOCKET: "{ROLE_PICKPOCKET}, wake up. {PROMPT_PICKPOCKET_ACTION} {ROLE_PICKPOCKET}, go to sleep.",
		PROMPT_PICKPOCKET_ACTION: "You may choose to steal another player's mark and replace it with your own. Then look at the mark you took.",
		PROMPT_PICKPOCKET_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_PICKPOCKET_DEFINITE}, wake up. {PROMPT_PICKPOCKET_ACTION} {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_PRIEST: "{ROLE_PRIEST}, wake up. Replace your mark with a clean mark. You may also replace another player's mark with a clean mark. {ROLE_PRIEST}, go to sleep.",
		PROMPT_PRIEST_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_PRIEST_DEFINITE}, wake up. Replace your mark with a clean mark. You may also replace another player's mark with a clean mark. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_PSYCHIC: "{ROLE_PSYCHIC}, wake up. You may look at {PsychicRandomEvent:false}. {ROLE_PSYCHIC}, go to sleep.",
		PROMPT_PSYCHIC_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_PSYCHIC_DEFINITE}, wake up. You may look at {PsychicRandomEvent:true}. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_RASCAL: "{ROLE_RASCAL}, wake up. {RascalRandomEvent:false} {ROLE_RASCAL}, go to sleep.",
		PROMPT_RASCAL_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_RASCAL_DEFINITE}, wake up. {RascalRandomEvent:true} {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_RENFIELD: "{ROLE_RENFIELD}, wake up. {TEAM_VAMPIRE_PLURAL}, point to the player who was given the mark of the vampire. {ROLE_RENFIELD}, {PROMPT_RENFIELD_ACTION} {ROLE_RENFIELD}, go to sleep. {IfDoppelgangerPresent:PROMPT_RENFIELD_DOPPELGANGER} {TEAM_VAMPIRE_PLURAL}, stop pointing.",
		PROMPT_RENFIELD_ACTION: "identify {TEAM_VAMPIRE_DEFINITE} and replace your mark with {ROLE_RENFIELD_DEFINITE}'s mark.",
		PROMPT_RENFIELD_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_RENFIELD_DEFINITE}, wake up. {TEAM_VAMPIRE_PLURAL}, continue pointing to the player who was given the mark of the vampire. {ROLE_DOPPELGANGER}, {PROMPT_RENFIELD_ACTION} {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_REVEALER: "{ROLE_REVEALER}, wake up. {PROMPT_REVEALER_ACTION} {ROLE_REVEALER}, go to sleep.",
		PROMPT_REVEALER_ACTION: "Turn another player's card face up. {IfAnyWithTag:'REVEALER_HIDDEN_ROLE','PROMPT_REVEALER_HIDDEN_ROLE'}.",
		PROMPT_REVEALER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_REVEALER_DEFINITE}, wake up. {PROMPT_REVEALER_ACTION} {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_REVEALER_HIDDEN_ROLE: "If the card is: {ListRolesWithTag:'REVEALER_HIDDEN_ROLE'}, turn it back face down",
		PROMPT_RIPPLE: "{RippleRandomEvent}",
		PROMPT_RIPPLE_FALLBACK: " ",
		PROMPT_RIPPLE_NONE: "<Narrator: ignore the following unless {ROLE_ORACLE_DEFINITE} chose to force a ripple> {RippleRandomEvent:true}",
		PROMPT_ROBBER: "{ROLE_ROBBER}, wake up. {PROMPT_ROBBER_ACTION} {ROLE_ROBBER}, go to sleep.",
		PROMPT_ROBBER_ACTION: "You may choose to steal another player's card and replace it with your own. Then look at the card you took. You do not wake when your new role is called.",
		PROMPT_SEER: "{ROLE_SEER}, wake up. You may look at another player's card or two center cards. {ROLE_SEER}, go to sleep.",
		PROMPT_SENTINEL: "{ROLE_SENTINEL}, wake up. Place a shield token on another player's card. {ROLE_SENTINEL}, go to sleep.",
		PROMPT_SHARED_VIEW_CENTER_FOUR: "four of the center cards",
		PROMPT_SHARED_VIEW_CENTER_ONE: "one of the center cards",
		PROMPT_SHARED_VIEW_CENTER_THREE: "three of the center cards",
		PROMPT_SHARED_VIEW_CENTER_TWO: "two of the center cards",
		PROMPT_SHARED_VIEW_PLAYER_ANY: "another player's card",
		PROMPT_SHARED_VIEW_PLAYER_EVEN: "another even-numbered player's card",
		PROMPT_SHARED_VIEW_PLAYER_EVEN_DOUBLE: "two other even-numbered players' cards",
		PROMPT_SHARED_VIEW_PLAYER_NEIGHBOR_ANY: "any neighbor's card",
		PROMPT_SHARED_VIEW_PLAYER_NEIGHBOR_BOTH: "both neighbors' cards",
		PROMPT_SHARED_VIEW_PLAYER_NEIGHBOR_LEFT: "left neighbor's card",
		PROMPT_SHARED_VIEW_PLAYER_NEIGHBOR_RIGHT: "right neighbor's card",
		PROMPT_SHARED_VIEW_PLAYER_ODD: "another odd-numbered player's card",
		PROMPT_SHARED_VIEW_PLAYER_ODD_DOUBLE: "two other odd-numbered players' cards",
		PROMPT_SHARED_VIEW_PLAYER_SELF: "your own card",
		PROMPT_SHARED_VIEW_PLAYER_SPECIFIC: "player {SharedViewSpecificPlayerResult}'s card",
		PROMPT_SQUIRE: "{ROLE_SQUIRE}, wake up. {TEAM_WEREWOLF_PLURAL}, hold out a thumb so {ROLE_SQUIRE_DEFINITE} can see. {ROLE_SQUIRE}, you may look at {TEAM_WEREWOLF_DEFINITE}'s cards. {ROLE_SQUIRE}, go to sleep. {IfDoppelgangerPresent:'PROMPT_SQUIRE_DOPPELGANGER'} {TEAM_WEREWOLF_PLURAL}, put your thumbs down.",
		PROMPT_SQUIRE_DOPPELGANGER: "{ROLE_DOPPELGANGER}, if you saw {ROLE_SQUIRE_DEFINITE}, wake up. {TEAM_WEREWOLF_PLURAL}, keep your thumbs out so {ROLE_DOPPELGANGER_DEFINITE} can see. {ROLE_DOPPELGANGER}, you may look at {TEAM_WEREWOLF_DEFINITE}'s cards. {ROLE_DOPPELGANGER}, go to sleep.",
		PROMPT_THING: "{ROLE_THING}, wake up. All other players, hold out a hand. {ROLE_THING}, touch the hand of the player immediately to your left or right. {ROLE_THING}, go to sleep.",
		PROMPT_TROUBLEMAKER: "{ROLE_TROUBLEMAKER}, wake up. {PROMPT_TROUBLEMAKER_ACTION} {ROLE_TROUBLEMAKER}, go to sleep.",
		PROMPT_TROUBLEMAKER_ACTION: "Swap two other players' cards without looking at them.",
		PROMPT_VAMPIRE: "{IfDoppelgangerPresent:'PROMPT_VAMPIRE_DOPPELGANGER_PREFIX'} {TEAM_VAMPIRE_PLURAL}, wake up and identify each other. Together choose a player whose mark you replace with the mark of the vampire. {TEAM_VAMPIRE_PLURAL}, go to sleep.",
		PROMPT_VAMPIRE_DOPPELGANGER_PREFIX: "{ROLE_DOPPELGANGER}, if you saw a {TEAM_VAMPIRE}, follow that role's instructions.",
		PROMPT_VILLAGEIDIOT: "{ROLE_VILLAGEIDIOT}, wake up. {PROMPT_VILLAGEIDIOT_ACTION} {ROLE_VILLAGEIDIOT}, go to sleep.",
		PROMPT_VILLAGEIDIOT_ACTION: "You may choose to move all players' cards one step to the left, to the right, or not at all.",
		PROMPT_WEREWOLF: "{IfDoppelgangerPresent:'PROMPT_WEREWOLF_DOPPELGANGER_PREFIX'} {TEAM_WEREWOLF_PLURAL}, {IfPresent:'DREAMWOLF','PROMPT_WEREWOLF_DREAMWOLF_EXCEPTION'} wake up and identify each other. If there is only one {TEAM_WEREWOLF}, you may look at one of the center cards. {IfPresent:'DREAMWOLF','PROMPT_WEREWOLF_DREAMWOLF_GESTURE'} {TEAM_WEREWOLF_PLURAL}, go to sleep.",
		PROMPT_WEREWOLF_DOPPELGANGER_PREFIX: "{ROLE_DOPPELGANGER}, if you saw a {TEAM_WEREWOLF_DEFINITE}, follow that role's instructions.",
		PROMPT_WEREWOLF_DREAMWOLF_EXCEPTION: "except for {ROLE_DREAMWOLF_DEFINITE}, ",
		PROMPT_WEREWOLF_DREAMWOLF_GESTURE: "{ROLE_DREAMWOLF}, hold out your thumb so the other {TEAM_WEREWOLF_PLURAL} can see who you are. {ROLE_DREAMWOLF}, put your thumb down.",
		PROMPT_WITCH: "{ROLE_WITCH}, wake up. {PROMPT_WITCH_ACTION} {ROLE_WITCH}, go to sleep.",
		PROMPT_WITCH_ACTION: "You may choose to look at one of the center cards. If you do, you must give that card to yourself or another player.",
		ROLE_ALIEN: "Alien",
		ROLE_ALIEN_DEFINITE: "the Alien",
		ROLE_ALPHAWOLF: "Alpha Wolf",
		ROLE_ALPHAWOLF_DEFINITE: "the Alpha Wolf",
		ROLE_APPRENTICEASSASSIN: "Apprentice Assassin",
		ROLE_APPRENTICEASSASSIN_DEFINITE: "the Apprentice Assassin",
		ROLE_APPRENTICESEER: "Apprentice Seer",
		ROLE_APPRENTICESEER_DEFINITE: "the Apprentice Seer",
		ROLE_APPRENTICETANNER: "Apprentice Tanner",
		ROLE_APPRENTICETANNER_DEFINITE: "the Apprentice Tanner",
		ROLE_ASSASSIN: "Assassin",
		ROLE_ASSASSIN_DEFINITE: "the Assassin",
		ROLE_AURASEER: "Aura Seer",
		ROLE_AURASEER_DEFINITE: "the Aura Seer",
		ROLE_BEHOLDER: "Beholder",
		ROLE_BEHOLDER_DEFINITE: "the Beholder",
		ROLE_BLOB: "Blob",
		ROLE_BLOB_DEFINITE: "the Blob",
		ROLE_BODYGUARD: "Bodyguard",
		ROLE_BODYGUARD_DEFINITE: "the Bodyguard",
		ROLE_BODYSNATCHER: "Body Snatcher",
		ROLE_BODYSNATCHER_DEFINITE: "the Body Snatcher",
		ROLE_COPYCAT: "Copycat",
		ROLE_COPYCAT_DEFINITE: "the Copycat",
		ROLE_COUNT: "Count",
		ROLE_COUNT_DEFINITE: "the Count",
		ROLE_COW: "Cow",
		ROLE_COW_DEFINITE: "the Cow",
		ROLE_CUPID: "Cupid",
		ROLE_CUPID_DEFINITE: "Cupid",
		ROLE_CURATOR: "Curator",
		ROLE_CURATOR_DEFINITE: "the Curator",
		ROLE_CURSED: "Cursed",
		ROLE_CURSED_DEFINITE: "the Cursed",
		ROLE_DISEASED: "Diseased",
		ROLE_DISEASED_DEFINITE: "the Diseased",
		ROLE_DOPPELGANGER: "Doppelganger",
		ROLE_DOPPELGANGER_DEFINITE: "the Doppelganger",
		ROLE_DREAMWOLF: "Dream Wolf",
		ROLE_DREAMWOLF_DEFINITE: "the Dream Wolf",
		ROLE_DRUNK: "Drunk",
		ROLE_DRUNK_DEFINITE: "the Drunk",
		ROLE_EMPATH: "Empath",
		ROLE_EMPATH_DEFINITE: "the Empath",
		ROLE_EXPOSER: "Exposer",
		ROLE_EXPOSER_DEFINITE: "the Exposer",
		ROLE_FEUDINGALIENS: "Groob and Zerb",
		ROLE_FEUDINGALIENS_DEFINITE: "Groob and Zerb",
		ROLE_GREMLIN: "Gremlin",
		ROLE_GREMLIN_DEFINITE: "the Gremlin",
		ROLE_HUNTER: "Hunter",
		ROLE_HUNTER_DEFINITE: "the Hunter",
		ROLE_INSOMNIAC: "Insomniac",
		ROLE_INSOMNIAC_DEFINITE: "the Insomniac",
		ROLE_INSTIGATOR: "Instigator",
		ROLE_INSTIGATOR_DEFINITE: "the Instigator",
		ROLE_LEADER: "Leader",
		ROLE_LEADER_DEFINITE: "the Leader",
		ROLE_MARKSMAN: "Marksman",
		ROLE_MARKSMAN_DEFINITE: "the Marksman",
		ROLE_MASON: "Mason",
		ROLE_MASON_DEFINITE: "the Mason",
		ROLE_MASTER: "Master",
		ROLE_MASTER_DEFINITE: "the Master",
		ROLE_MINION: "Minion",
		ROLE_MINION_DEFINITE: "the Minion",
		ROLE_MORTICIAN: "Mortician",
		ROLE_MORTICIAN_DEFINITE: "the Mortician",
		ROLE_MYSTICWOLF: "Mystic Wolf",
		ROLE_MYSTICWOLF_DEFINITE: "the Mystic Wolf",
		ROLE_NOSTRADAMUS: "Nostradamus",
		ROLE_NOSTRADAMUS_DEFINITE: "Nostradamus",
		ROLE_ORACLE: "Oracle",
		ROLE_ORACLE_DEFINITE: "the Oracle",
		ROLE_PARANORMALINVESTIGATOR: "Paranormal Investigator",
		ROLE_PARANORMALINVESTIGATOR_DEFINITE: "the Paranormal Investigator",
		ROLE_PHASE_DAY: "day role",
		ROLE_PHASE_DUSK: "dust role",
		ROLE_PHASE_NIGHT: "night role",
		ROLE_PICKPOCKET: "Pickpocket",
		ROLE_PICKPOCKET_DEFINITE: "the Pickpocket",
		ROLE_PRIEST: "Priest",
		ROLE_PRIEST_DEFINITE: "the Priest",
		ROLE_PRINCE: "Prince",
		ROLE_PRINCE_DEFINITE: "the Prince",
		ROLE_PSYCHIC: "Psychic",
		ROLE_PSYCHIC_DEFINITE: "the Psychic",
		ROLE_RASCAL: "Rascal",
		ROLE_RASCAL_DEFINITE: "the Rascal",
		ROLE_RENFIELD: "Renfield",
		ROLE_RENFIELD_DEFINITE: "Renfield",
		ROLE_REVEALER: "Revealer",
		ROLE_REVEALER_DEFINITE: "the Revealer",
		ROLE_ROBBER: "Robber",
		ROLE_ROBBER_DEFINITE: "the Robber",
		ROLE_SEER: "Seer",
		ROLE_SEER_DEFINITE: "the Seer",
		ROLE_SENTINEL: "Sentinel",
		ROLE_SENTINEL_DEFINITE: "the Sentinel",
		ROLE_SQUIRE: "Squire",
		ROLE_SQUIRE_DEFINITE: "the Squire",
		ROLE_SYNTHETICALIEN: "Synthetic Alien",
		ROLE_SYNTHETICALIEN_DEFINITE: "the Synthetic Alien",
		ROLE_TANNER: "Tanner",
		ROLE_TANNER_DEFINITE: "the Tanner",
		ROLE_THING: "Thing",
		ROLE_THING_DEFINITE: "the Thing",
		ROLE_TROUBLEMAKER: "Troublemaker",
		ROLE_TROUBLEMAKER_DEFINITE: "the Troublemaker",
		ROLE_VAMPIRE: "Vampire",
		ROLE_VAMPIRE_DEFINITE: "the Vampire",
		ROLE_VILLAGEIDIOT: "Village Idiot",
		ROLE_VILLAGEIDIOT_DEFINITE: "the Village Idiot",
		ROLE_VILLAGER: "Villager",
		ROLE_VILLAGER_DEFINITE: "the Villager",
		ROLE_WEREWOLF: "Werewolf",
		ROLE_WEREWOLF_DEFINITE: "the Werewolf",
		ROLE_WITCH: "Witch",
		ROLE_WITCH_DEFINITE: "the Witch",
		TEAM_ALIEN: "Alien",
		TEAM_ALIEN_DEFINITE: "the Aliens",
		TEAM_ALIEN_PLURAL: "Aliens",
		TEAM_MINORITY: "Other",
		TEAM_MINORITY_DEFINITE: "the Others",
		TEAM_PREFIX: "Team",
		TEAM_VAMPIRE: "Vampire",
		TEAM_VAMPIRE_DEFINITE: "the Vampires",
		TEAM_VAMPIRE_PLURAL: "Vampires",
		TEAM_VARIABLE_SUFFIX: " (variable)",
		TEAM_VILLAGE: "Villager",
		TEAM_VILLAGE_DEFINITE: "the Villagers",
		TEAM_VILLAGE_PLURAL: "Villagers",
		TEAM_WEREWOLF: "Werewolf",
		TEAM_WEREWOLF_DEFINITE: "the Werewolves",
		TEAM_WEREWOLF_PLURAL: "Werewolves",
		UI_ABILITY_ALIEN: "Wakes up with all {TEAM_ALIEN_PLURAL} and identifies the other {TEAM_ALIEN_PLURAL}. May also collectively view one or more cards at random.",
		UI_ABILITY_ALPHAWOLF: "Wakes up first with all {TEAM_WEREWOLF_PLURAL}. Then wakes up alone and swaps a non-{TEAM_WEREWOLF_PLURAL} player's card with the unused {TEAM_WEREWOLF} card in the center. If {ROLE_ALPHAWOLF_DEFINITE} is used, an additional {TEAM_WEREWOLF} card is placed in the center, rotated 90 degrees.",
		UI_ABILITY_APPRENTICEASSASSIN: "Wakes up at the same time as {ROLE_ASSASSIN_DEFINITE} after the target mark has been placed so they can identify each other. If no {ROLE_ASSASSIN} is in play, {ROLE_APPRENTICEASSASSIN_DEFINITE} performs that action instead.",
		UI_ABILITY_APPRENTICESEER: "Wakes up and may look at one of the center cards.",
		UI_ABILITY_APPRENTICETANNER: "Wakes up and sees who {ROLE_TANNER_DEFINITE} is.",
		UI_ABILITY_ASSASSIN: "Wakes up and selects a target by placing a mark in front of a player.",
		UI_ABILITY_AURASEER: "Wakes up and sees which players have looked at or moved a card during the night.",
		UI_ABILITY_BEHOLDER: "Wakes up and sees who {ROLE_SEER_DEFINITE} and {ROLE_APPRENTICESEER_DEFINITE} are. May then check their cards to see if they were moved during the night.",
		UI_ABILITY_BLOB: "Does not wake up. At the start of the day, it is announced which nearby players (0–4) {ROLE_BLOB_DEFINITE} must protect.",
		UI_ABILITY_BODYGUARD: "The player voted for by {ROLE_BODYGUARD_DEFINITE} cannot be eliminated. The player with the second-highest votes is eliminated instead.",
		UI_ABILITY_BODYSNATCHER: "Wakes up and may choose to swap another player's card with their own, then look at their new card. Both {ROLE_BODYSNATCHER_DEFINITE} and the other card become a {TEAM_ALIEN}.",
		UI_ABILITY_COPYCAT: "Wakes up and looks at one of the center cards. {ROLE_COPYCAT_DEFINITE} copies that role and team. Role/team follows the card if moved during the night. {ROLE_COPYCAT_DEFINITE} later wakes and performs that role's action.",
		UI_ABILITY_COUNT: "Wakes up with all {TEAM_VAMPIRE_PLURAL}. Then wakes alone and places a fear mark on a non-vampire player. That player may not wake or perform any action during the night.",
		UI_ABILITY_COW: "Holds out a hand without waking. If one or more {TEAM_ALIEN_PLURAL} are adjacent to {ROLE_COW_DEFINITE}, they must touch {ROLE_COW_DEFINITE}'s hand.",
		UI_ABILITY_CUPID: "Wakes up and places love marks on two players. Those players wake together and identify each other. If one is eliminated, the other is also eliminated.",
		UI_ABILITY_CURATOR: "Wakes up and places a random artifact token in front of a player, including {ROLE_CURATOR_DEFINITE}. At the start of the day, that player may look at it. If it causes a role change, it overrides the player's card for ability and team.",
		UI_ABILITY_CURSED: "If at least one {TEAM_WEREWOLF}, {TEAM_VAMPIRE}, or {TEAM_ALIEN} votes for {ROLE_CURSED_DEFINITE}, it changes to that team.",
		UI_ABILITY_DISEASED: "Wakes up and places an infected mark on a neighbor. Any player who votes for {ROLE_DISEASED_DEFINITE} or a marked player automatically loses, even if their team wins.",
		UI_ABILITY_DOPPELGANGER: "Wakes up and looks at another player's card. {ROLE_DOPPELGANGER_DEFINITE} copies that role and team. This follows the card if moved. {ROLE_DOPPELGANGER_DEFINITE} later wakes and performs that role's action.",
		UI_ABILITY_DREAMWOLF: "Shows a thumb instead of waking with {TEAM_WEREWOLF_PLURAL} so they can identify {ROLE_DREAMWOLF_DEFINITE}.",
		UI_ABILITY_DRUNK: "Wakes up and swaps their card with a center card without looking at it.",
		UI_ABILITY_EMPATH: "Wakes up and observes players perform a random action without waking them.",
		UI_ABILITY_EXPOSER: "Wakes up and may flip 1–3 center cards face up, chosen randomly.",
		UI_ABILITY_FEUDINGALIENS: "Wakes up with all {TEAM_ALIEN_PLURAL}, then wakes together and identifies each other.",
		UI_ABILITY_GREMLIN: "Wakes up and swaps either two players’ marks or two players’ cards, but not both.",
		UI_ABILITY_HUNTER: "If {ROLE_HUNTER_DEFINITE} is eliminated, the player they voted for is also eliminated.",
		UI_ABILITY_INSOMNIAC: "Wakes last and looks at their own card.",
		UI_ABILITY_INSTIGATOR: "Wakes up and gives a traitor mark to a player. That player wins only if someone on their own team is eliminated.",
		UI_ABILITY_LEADER: "Wakes up and sees which players are {TEAM_ALIEN_PLURAL}. Also sees which of them are {ROLE_FEUDINGALIENS_DEFINITE}. If all {TEAM_ALIEN_DEFINITE} point at {ROLE_LEADER_DEFINITE}, they win regardless of outcome.",
		UI_ABILITY_MARKSMAN: "Wakes up and looks at one player's card and another player's mark. They must be different players.",
		UI_ABILITY_MASON: "Wakes up with the other {ROLE_MASON_DEFINITE} and identifies each other.",
		UI_ABILITY_MASTER: "Wakes up with all {TEAM_VAMPIRE_PLURAL}. If at least one other {TEAM_VAMPIRE} votes for {ROLE_MASTER_DEFINITE}, he becomes immune to elimination.",
		UI_ABILITY_MINION: "Wakes up and sees which players are {TEAM_WEREWOLF}.",
		UI_ABILITY_MORTICIAN: "Wakes up and looks at one or both neighbors’ cards or their own, chosen randomly.",
		UI_ABILITY_MYSTICWOLF: "Wakes with all {TEAM_WEREWOLF_PLURAL}, then wakes alone to view another player’s card.",
		UI_ABILITY_NOSTRADAMUS: "Wakes up and may look at up to three players' cards. If any are not {TEAM_VILLAGE_DEFINITE}, no more cards may be viewed and {ROLE_NOSTRADAMUS_DEFINITE} adopts that team. This follows the card if moved. The new team is announced.",
		UI_ABILITY_ORACLE: "Wakes up and performs a random predefined action that is read aloud.",
		UI_ABILITY_PARANORMALINVESTIGATOR: "Wakes up and may look at up to two players' cards. If any are not {TEAM_VILLAGE_DEFINITE}, no more cards may be viewed and {ROLE_PARANORMALINVESTIGATOR_DEFINITE} adopts that team.",
		UI_ABILITY_PICKPOCKET: "Wakes up and may swap a player's mark with their own, then view their new mark.",
		UI_ABILITY_PREFIX: "Ability/Action",
		UI_ABILITY_PRIEST: "Wakes up and replaces their own and optionally another player's marks with a clean mark.",
		UI_ABILITY_PRINCE: "Cannot be eliminated. The player with the second-highest votes is eliminated instead.",
		UI_ABILITY_PSYCHIC: "Wakes up and may look at another player's card with random restrictions.",
		UI_ABILITY_RASCAL: "Wakes up and performs a random action from {ROLE_TROUBLEMAKER_DEFINITE}, {ROLE_ROBBER_DEFINITE}, {ROLE_WITCH_DEFINITE}, {ROLE_VILLAGEIDIOT_DEFINITE}, or {ROLE_DRUNK_DEFINITE}.",
		UI_ABILITY_RENFIELD: "Wakes up and replaces their mark with {ROLE_RENFIELD_DEFINITE}'s mark. Sees all {TEAM_VAMPIRE} and which player received a vampire mark.",
		UI_ABILITY_REVEALER: "Wakes up and turns another player's card face up. If not {TEAM_VILLAGE_DEFINITE}, it is turned back down.",
		UI_ABILITY_ROBBER: "Wakes up and may swap cards with another player, then look at the new card. Does not wake again.",
		UI_ABILITY_SEER: "Wakes up and may look at another player's card or two center cards.",
		UI_ABILITY_SENTINEL: "Wakes up and places a shield token on another player's card. That card cannot be moved or viewed.",
		UI_ABILITY_SQUIRE: "Wakes up and sees which players are {TEAM_WEREWOLF}. Also checks if their cards were moved.",
		UI_ABILITY_SYNTHETICALIEN: "Wakes with all {TEAM_ALIEN_PLURAL} and identifies them. May also collectively view random cards.",
		UI_ABILITY_TANNER: "If {ROLE_TANNER_DEFINITE} is eliminated, {TEAM_WEREWOLF_DEFINITE}, {TEAM_VAMPIRE_DEFINITE}, and {TEAM_ALIEN_DEFINITE} lose.",
		UI_ABILITY_THING: "Wakes up and touches one of their adjacent players.",
		UI_ABILITY_TROUBLEMAKER: "Wakes up and swaps two other players' cards without looking.",
		UI_ABILITY_VAMPIRE: "Wakes with all {TEAM_VAMPIRE_PLURAL} and identifies them. Collectively choose a player to give a vampire mark.",
		UI_ABILITY_VILLAGEIDIOT: "Wakes up and may shift all other players’ cards left, right, or not at all.",
		UI_ABILITY_VILLAGER: "None.",
		UI_ABILITY_WEREWOLF: "Wakes up with all {TEAM_WEREWOLF_PLURAL} and identifies them. If alone, may view one center card.",
		UI_ABILITY_WITCH: "Wakes up and may look at a center card. If they do, they must give it to themselves or another player.",
		UI_FILTER_COMPLEXITY: "Difficulty",
		UI_FILTER_COMPLEXITY_EASY: "Easy",
		UI_FILTER_COMPLEXITY_HARD: "Hard",
		UI_FILTER_COMPLEXITY_MEDIUM: "Medium",
		UI_FILTER_RULESET: "Ruleset",
		UI_FILTER_RULESET_ADVANCED: "Advanced",
		UI_FILTER_RULESET_ALIEN: "Aliens",
		UI_FILTER_RULESET_BASIC: "Basic",
		UI_FILTER_RULESET_VAMPIRE: "Vampires",
		UI_GAMERULES: "Game Rules",
		UI_GENERATED_PROMPT: "Game Prompt",
		UI_PLAYER_COUNT: "Number of players:",
		UI_PRINT: "Print",
		UI_RESET: "Reset",
		UI_ROLEDESCRIPTIONS: "Role Descriptions",
		UI_ROLESELECTION: "Select Roles",
		UI_SEARCH: "Search",
		UI_SEARCH_PLACEHOLDER: "Filter roles...",
		UI_SETTING: "Settings",
		UI_SETTING_ALIENS_MAKE_ALIEN: "Turn another player into a {TEAM_ALIEN}",
		UI_SETTING_ALIENS_MAKE_MINION: "Turn another player into a minion",
		UI_SETTING_ALIENS_NOTHING: "No action",
		UI_SETTING_ALIENS_SHOW_CARDS: "Show their cards to other {TEAM_ALIEN_DEFINITE}",
		UI_SETTING_ALIENS_TRADE_CARDS: "Swap cards with other {TEAM_ALIEN_DEFINITE}",
		UI_SETTING_ALIENS_VIEW_CARD_COLLECTIVE: "View cards collectively",
		UI_SETTING_ALIENS_VIEW_CARD_INDIVIDUAL: "View cards individually",
		UI_SETTING_BODYSNATCHER_FAKE_ACTION: "Chance to only pretend to perform the action.",
		UI_SETTING_ERROR_WEIGHTGROUP_SUM_ZERO: "The total weight of the group must be greater than 0",
		UI_SETTING_EXPOSER_FLIP_ONE: "Flip one center card",
		UI_SETTING_EXPOSER_FLIP_THREE: "Flip three center cards",
		UI_SETTING_EXPOSER_FLIP_TWO: "Flip two center cards",
		UI_SETTING_LABEL_RASCAL: "Perform one of the following actions",
		UI_SETTING_LABEL_VIEW_CARD: "View player cards",
		UI_SETTING_ORACLE_BLOCK_ACTION: "Prevent another player from waking",
		UI_SETTING_ORACLE_DRUNK: "Swap your card with a center card",
		UI_SETTING_ORACLE_EVEN_ODD: "Announce whether {ROLE_ORACLE_DEFINITE} has an even or odd player number",
		UI_SETTING_ORACLE_HUNT: "Oracle Hunt",
		UI_SETTING_ORACLE_HUNT_ALLOW_BAD_TEAMS: "Allow waking for evil roles",
		UI_SETTING_ORACLE_HUNT_CHANCE: "Probability",
		UI_SETTING_ORACLE_SWITCH_TEAM: "Switch team",
		UI_SETTING_ORACLE_SWITCH_TEAM_FULL: "Switch role",
		UI_SETTING_ORACLE_SWITCH_TEAM_PARTIAL: "Switch team only",
		UI_SETTING_ORACLE_VIEW_CENTER: "View center cards",
		UI_SETTING_ORACLE_VIEW_PLAYER: "View player cards",
		UI_SETTING_PSYCHIC_VIEW_TWO_CARDS: "Chance to view two cards",
		UI_SETTING_RIPPLE: "Space-time ripple",
		UI_SETTING_RIPPLE_DOUBLE_VOTE: "Some players may cast two votes",
		UI_SETTING_RIPPLE_DRUNK: "A player swaps their card with a center card",
		UI_SETTING_RIPPLE_DUAL_VIEW_PLAYER: "Two players may view another player's card",
		UI_SETTING_RIPPLE_INSOMNIAC: "Some players view their cards after the night",
		UI_SETTING_RIPPLE_MUTED: "Some players may not speak",
		UI_SETTING_RIPPLE_NONE: "Nothing happens",
		UI_SETTING_RIPPLE_ONE_MINUTE: "Game time reduced to 1 minute",
		UI_SETTING_RIPPLE_REBUKED: "Some players must turn away",
		UI_SETTING_RIPPLE_REVEALER: "A player may reveal another player's card",
		UI_SETTING_RIPPLE_ROBBER: "A player may steal another player's card",
		UI_SETTING_RIPPLE_TROUBLEMAKER: "A player swaps two other players",
		UI_SETTING_RIPPLE_VIEW_PLAYER: "A player may view another player's card",
		UI_SETTING_RIPPLE_WITCH: "A player may view a center card and give it to a player",
		UI_SETTING_VIEW_CARD_CENTER_FOUR: "Four center cards",
		UI_SETTING_VIEW_CARD_CENTER_ONE: "One center card",
		UI_SETTING_VIEW_CARD_CENTER_THREE: "Three center cards",
		UI_SETTING_VIEW_CARD_CENTER_TWO: "Two center cards",
		UI_SETTING_VIEW_CARD_PLAYER_ANY: "Any player",
		UI_SETTING_VIEW_CARD_PLAYER_EVEN: "Even-numbered player",
		UI_SETTING_VIEW_CARD_PLAYER_NEIGHBOR: "Neighbor",
		UI_SETTING_VIEW_CARD_PLAYER_NEIGHBOR_BOTH: "Both neighbors",
		UI_SETTING_VIEW_CARD_PLAYER_ODD: "Odd-numbered player",
		UI_SETTING_VIEW_CARD_PLAYER_SELF: "Your own",
		UI_SETTING_VIEW_CARD_PLAYER_SPECIFIC: "Specific player",
		UI_TITLE: "One Night Ultimate Werewolf – Prompt Builder",
		UI_WINCONDITION_APPRENTICEASSASSIN: "Wins if {ROLE_ASSASSIN_DEFINITE} is eliminated, or if the chosen target is eliminated when no {ROLE_ASSASSIN} is in play.",
		UI_WINCONDITION_APPRENTICETANNER: "Wins if {ROLE_TANNER_DEFINITE} is eliminated, or if {ROLE_APPRENTICETANNER_DEFINITE} is eliminated when no {ROLE_TANNER} is in play.",
		UI_WINCONDITION_ASSASSIN: "Wins if the chosen target is eliminated.",
		UI_WINCONDITION_BLOB: "Wins if neither {ROLE_BLOB_DEFINITE} nor any players they must protect are eliminated.",
		UI_WINCONDITION_DOPPELGANGER: "{UI_WINCONDITION_TEAM_VILLAGE} If {ROLE_DOPPELGANGER_DEFINITE} copies another role, it instead uses that role's win condition.",
		UI_WINCONDITION_FEUDINGALIENS: "If only one is in play, they win with {TEAM_ALIEN}. If both are in play, one wins if the other is eliminated.",
		UI_WINCONDITION_LEADER: "If both {ROLE_FEUDINGALIENS_DEFINITE} are in play, {ROLE_LEADER_DEFINITE} wins if both survive. Otherwise, {ROLE_LEADER_DEFINITE} wins with {TEAM_VILLAGE_DEFINITE}.",
		UI_WINCONDITION_MINION: "If at least one {TEAM_WEREWOLF} is in play, {ROLE_MINION_DEFINITE} wins if no {TEAM_WEREWOLF} is eliminated, even if {ROLE_MINION_DEFINITE} is eliminated. If no {TEAM_WEREWOLF} is in play, {ROLE_MINION_DEFINITE} wins if at least one other player is eliminated.",
		UI_WINCONDITION_MORTICIAN: "Wins if one of {ROLE_MORTICIAN_DEFINITE}'s neighbors is eliminated.",
		UI_WINCONDITION_PARANORMALINVESTIGATOR: "{UI_WINCONDITION_TEAM_VILLAGE} If {ROLE_PARANORMALINVESTIGATOR_DEFINITE} sees a non-{TEAM_VILLAGE_DEFINITE} role during the night, they adopt that role’s win condition.",
		UI_WINCONDITION_PREFIX: "Win condition",
		UI_WINCONDITION_RENFIELD: "If at least one {TEAM_VAMPIRE} is in play, {ROLE_RENFIELD_DEFINITE} wins if no {TEAM_VAMPIRE} is eliminated, even if {ROLE_RENFIELD_DEFINITE} is eliminated. If no {TEAM_VAMPIRE} is in play, {ROLE_RENFIELD_DEFINITE} wins with {TEAM_VILLAGE_DEFINITE}.",
		UI_WINCONDITION_SQUIRE: "If at least one {TEAM_WEREWOLF} is in play, {ROLE_SQUIRE_DEFINITE} wins if no {TEAM_WEREWOLF} is eliminated, even if {ROLE_SQUIRE_DEFINITE} is eliminated. If no {TEAM_WEREWOLF} is in play, {ROLE_SQUIRE_DEFINITE} wins if at least one other player is eliminated.",
		UI_WINCONDITION_SYNTHETICALIEN: "Wins if {ROLE_SYNTHETICALIEN_DEFINITE} is eliminated.",
		UI_WINCONDITION_TANNER: "Wins if {ROLE_TANNER_DEFINITE} is eliminated.",
		UI_WINCONDITION_TEAM_ALIEN: "Wins if no {TEAM_ALIEN} is eliminated.",
		UI_WINCONDITION_TEAM_VAMPIRE: "Wins if no {TEAM_VAMPIRE} is eliminated.",
		UI_WINCONDITION_TEAM_VILLAGE: "Wins if at least one {TEAM_WEREWOLF}, {TEAM_VAMPIRE}, or {TEAM_ALIEN} is eliminated.",
		UI_WINCONDITION_TEAM_WEREWOLF: "Wins if no {TEAM_WEREWOLF} is eliminated.",
		UI_WINCONDITION_VARIABLE_NOTE: "This card’s win condition may change, such as when copying another role.",
	},
	SWE: {
		LIST_AND: "och",
		LIST_OR: "eller",
		PROMPT_ALIEN: "{TEAM_ALIEN_PLURAL}, {IfDoppelgangerPresent:'PROMPT_ALIEN_DOPPELGANGER'} vakna och identifiera varandra. {AlienRandomEvent} {IfPresent:'COW','PROMPT_ALIEN_COW'} {TEAM_ALIEN_PLURAL}, somna.",
		PROMPT_ALIEN_COW: "{ROLE_COW}{IfDoppelgangerPresent:'PROMPT_ALIEN_COW_DOPPELGANGER'}, håll ut en hand framför dig. Om minst en {TEAM_ALIEN} är granne med {ROLE_COW_DEFINITE}, rör vid {ROLE_COW_DEFINITE}s hand. {ROLE_COW}, ner med handen.",
		PROMPT_ALIEN_COW_DOPPELGANGER: ", och {ROLE_DOPPELGANGER_DEFINITE} om du såg {ROLE_COW_DEFINITE}",
		PROMPT_ALIEN_DOPPELGANGER: "och {ROLE_DOPPELGANGER_DEFINITE} om du såg ett {TEAM_ALIEN}skort, ",
		PROMPT_ALIEN_MAKE_ALIEN: "Alla andra spelare, håll ut en hand framför er. {TEAM_ALIEN_DEFINITE}, välj en annan spelare som ni vill göra till en {TEAM_ALIEN} och rör vid deras hand. Spelaren är nu en {TEAM_ALIEN} oavsett vad som händer med deras kort. Alla spelare, ner med händerna.",
		PROMPT_ALIEN_MAKE_MINION: "Alla andra spelare, håll ut en hand framför er. {TEAM_ALIEN_DEFINITE}, välj en annan spelare som ni vill göra till en medhjälpare och rör vid deras hand. Spelaren vinner nu om {TEAM_ALIEN_DEFINITE} vinner oavsett om de själva blir utröstade och vad som händer med deras kort. Alla spelare, ner med händerna.",
		PROMPT_ALIEN_NOTHING: "Gör ingenting, stirra bara på varandra tills det blir pinsamt.",
		PROMPT_ALIEN_SHOW_CARDS: "Visa era kort för alla andra {TEAM_ALIEN_DEFINITE}.",
		PROMPT_ALIEN_TRADE_LEFT: "Ge era kort till närmaste {TEAM_ALIEN} till vänster om er.",
		PROMPT_ALIEN_TRADE_RIGHT: "Ge era kort till närmaste {TEAM_ALIEN} till höger om er.",
		PROMPT_ALIEN_VIEW_CARD_COLLECTIVE: "Ni får titta på {AlienViewCard:true} gemensamt inom laget.",
		PROMPT_ALIEN_VIEW_CARD_INDIVIDUAL: "Ni får titta på {AlienViewCard:false} individuellt.",
		PROMPT_ALPHA_WOLF: "{ROLE_ALPHAWOLF}, vakna. Byt det extra kortet i mitten mot någon annan spelares kort som inte redan är varulv. {ROLE_ALPHAWOLF}, somna.",
		PROMPT_APPRENTICEASSASSIN: "{ROLE_APPRENTICEASSASSIN}, vakna. Identifiera {ROLE_ASSASSIN_DEFINITE}. Om det inte finns någon {ROLE_ASSASSIN}, byt ut en annan spelares märke mot {ROLE_ASSASSIN_DEFINITE}s märke. {ROLE_APPRENTICEASSASSIN}, somna.",
		PROMPT_APPRENTICEASSASSIN_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_APPRENTICEASSASSIN_DEFINITE}, vakna. Identifiera {ROLE_ASSASSIN_DEFINITE}. Om det inte finns någon {ROLE_ASSASSIN}, byt ut en annan spelares märke mot {ROLE_ASSASSIN_DEFINITE}s märke. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_APPRENTICESEER: "{ROLE_APPRENTICESEER}, vakna. Du får titta på ett av mittenkorten. {ROLE_APPRENTICESEER}, somna.",
		PROMPT_APPRENTICETANNER: "{ROLE_APPRENTICETANNER}, vakna. {ROLE_TANNER}, håll ut en tumme så att {ROLE_APPRENTICETANNER} kan se vem du är. {ROLE_APPRENTICETANNER}, somna. {IfDoppelgangerPresent:'PROMPT_APPRENTICETANNER_DOPPELGANGER'} {ROLE_TANNER}, ner med tummen.",
		PROMPT_APPRENTICETANNER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_APPRENTICETANNER_DEFINITE}, vakna. {ROLE_TANNER}, fortsätt hålla ut tummen så att {ROLE_DOPPELGANGER_DEFINITE} kan se vem ni är. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_ASSASSIN: "{ROLE_ASSASSIN}, vakna. Byt ut en annan spelares märke mot {ROLE_ASSASSIN_DEFINITE}s märke. {IfPresent:'APPRENTICEASSASSIN','PROMPT_APPRENTICEASSASSIN'} {ApprenticeAssassinDoppelganger} {ROLE_ASSASSIN}, somna.",
		PROMPT_ASSASSIN_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_ASSASSIN_DEFINITE}, vakna. Byt ut en annan spelares märke mot {ROLE_ASSASSIN_DEFINITE}s märke. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_AURASEER: "{ROLE_AURASEER}, vakna. {ListRolesWithTag:'AURA_SEER_DETECTABLE',false}, om ni har tittat på eller flyttat kort, håll ut en tumme så att {ROLE_AURASEER_DEFINITE} kan se den. {ROLE_AURASEER}, somna. {IfDoppelgangerPresent:'PROMPT_AURASEER_DOPPELGANGER'} Samtliga spelare, ner med tummarna.",
		PROMPT_AURASEER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_AURASEER_DEFINITE}, vakna. Alla andra, fortsätt hålla ut tummen så att {ROLE_DOPPELGANGER_DEFINITE} kan se den. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_BEHOLDER: "{ROLE_BEHOLDER}, vakna. {ListRolesWithTag:'BEHOLDER_DETECTABLE',false}, håll ut en tumme så att {ROLE_BEHOLDER_DEFINITE} kan se. {ROLE_BEHOLDER}, titta på deras kort. {ROLE_BEHOLDER}, somna. {IfDoppelgangerPresent:'PROMPT_BEHOLDER_DOPPELGANGER'} {ListRolesWithTag:'BEHOLDER_DETECTABLE',false}, ner med tummen.",
		PROMPT_BEHOLDER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_BEHOLDER_DEFINITE}, vakna. {ListRolesWithTag:'BEHOLDER_DETECTABLE',false}, fortsätt hålla ut tummen så att {ROLE_DOPPELGANGER_DEFINITE} kan se. {ROLE_DOPPELGANGER}, titta på deras kort. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_BLOB: "{ROLE_BLOB}, {IfDoppelgangerPresent:'PROMPT_BLOB_DOPPELGANGER'} {BlobObjective}.",
		PROMPT_BLOB_DOPPELGANGER: "och {ROLE_DOPPELGANGER_DEFINITE} om du såg {ROLE_BLOB_DEFINITE},",
		PROMPT_BLOB_OBJECTIVE_ALONE: "Du behöver bara förhindra att du själv blir utröstad",
		PROMPT_BLOB_OBJECTIVE_MULTI: "Du måste förhindra att närmaste {BlobPlayerCount:true} spelare till vänster och {BlobPlayerCount:false} spelare till höger blir utröstade",
		PROMPT_BLOB_OBJECTIVE_SINGLE_LEFT: "Du måste förhindra att spelaren närmast till vänster blir utröstad",
		PROMPT_BLOB_OBJECTIVE_SINGLE_RIGHT: "Du måste förhindra att spelaren närmast till höger blir utröstad",
		PROMPT_BODYSNATCHER: "{ROLE_BODYSNATCHER}, vakna. {BodySnatcherFakeEvent:false} Du får titta på {BodySnatcherRandomEvent:false}. Byt sedan ditt eget kort mot kortet du tittade på. Ditt nya kort är nu också en {TEAM_ALIEN}. {ROLE_BODYSNATCHER}, somna.",
		PROMPT_BODYSNATCHER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_BODYSNATCHER_DEFINITE}, vakna. {BodySnatcherFakeEvent:true} Du får titta på {BodySnatcherRandomEvent:false}. Byt sedan ditt eget kort mot kortet du tittade på. Ditt nya kort är nu också en {TEAM_ALIEN}. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_BODYSNATCHER_FAKE_ACTION: "<Berättare: visa att handlingen inte ska utföras>.",
		PROMPT_CHECK_MARKS: "Alla spelare, vakna. Kontrollera era märken utan att visa dem för någon annan. Alla spelare, somna.",
		PROMPT_COPYCAT: "{ROLE_COPYCAT}, vakna. Titta på ett av mittenkorten. Du är nu rollen du såg. När rollen ropas upp, vakna och utför dess handling. {ROLE_COPYCAT}, somna.",
		PROMPT_COUNT: "{ROLE_COUNT}, vakna. {PROMPT_COUNT_ACTION} {ROLE_COUNT}, somna.",
		PROMPT_COUNT_ACTION: "Byt ut en annan spelares märke mot {ROLE_COUNT_DEFINITE}s märke.",
		PROMPT_COUNT_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_COUNT_DEFINITE}, vakna. {PROMPT_COUNT_ACTION} {ROLE_DOPPELGANGER}, somna.",
		PROMPT_CUPID: "{ROLE_CUPID}, vakna. Byt ut två andra spelares märken mot {ROLE_CUPID_DEFINITE}s märke. {ROLE_CUPID}, somna.",
		PROMPT_CUPID_LOVERS: "Förälskade, vakna. Identifiera varandra. Om en av er röstas ut som kommer även den andra att röstas ut. Förälskade, somna.",
		PROMPT_CURATOR: "{ROLE_CURATOR}, vakna. {PROMPT_CURATOR_PLACE_ARTIFACT} {ROLE_CURATOR}, somna.",
		PROMPT_CURATOR_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_CURATOR_DEFINITE}, vakna. {PROMPT_CURATOR_PLACE_ARTIFACT} {ROLE_DOPPELGANGER}, somna.",
		PROMPT_CURATOR_PLACE_ARTIFACT: "Placera en artefakt med ansiktet ner på en annan spelares kort utan att titta på den.",
		PROMPT_DISEASED: "{ROLE_DISEASED}, vakna. Byt ut en av dina grannars märke mot {ROLE_DISEASED_DEFINITE}s märke. {ROLE_DISEASED}, somna.",
		PROMPT_DOPPELGANGER: "{ROLE_DOPPELGANGER}, vakna. Titta på en annan spelares kort. Du är nu rollen du såg. {IfAnyWithTag:'DOPPELGANGER_IMMEDIATE_ACTION','PROMPT_DOPPELGANGER_IMMEDIATE_ACTION'} {ROLE_DOPPELGANGER}, somna.",
		PROMPT_DOPPELGANGER_IMMEDIATE_ACTION: "Om rollen du såg var {ListRolesWithTag:'DOPPELGANGER_IMMEDIATE_ACTION'}, utför dess handling nu.",
		PROMPT_DRUNK: "{ROLE_DRUNK}, vakna. {PROMPT_DRUNK_ACTION} {ROLE_DRUNK}, somna.",
		PROMPT_DRUNK_ACTION: "Byt ditt kort mot ett av mittenkorten utan att se vad det är.",
		PROMPT_EMPATH: "{ROLE_EMPATH}, vakna. Iakta vad de andra spelarna gör. Spelare {EmpathPlayerList:false}, utan att vakna, {EmpathPlayerAction:false} {ROLE_EMPATH}, somna.",
		PROMPT_EMPATH_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_EMPATH_DEFINITE}, vakna. Iakta vad de andra spelarna gör. Spelare {EmpathPlayerList:true}, utan att vakna, {EmpathPlayerAction:true} {ROLE_DOPPELGANGER}, somna.",
		PROMPT_EMPATH_QUESTION_10: "visa en tumme upp om du tror att du kommer vinna, eller en tumme ner om du tror att du kommer förlora.",
		PROMPT_EMPATH_QUESTION_11: "peka på den spelare du tror är mest sannolik att redan ha glömt sin roll.",
		PROMPT_EMPATH_QUESTION_1: "peka på en spelare som du tror kommer vinna.",
		PROMPT_EMPATH_QUESTION_2: "peka på en spelare som du tror blir utröstad.",
		PROMPT_EMPATH_QUESTION_3: "peka på den spelare som du litar mest på.",
		PROMPT_EMPATH_QUESTION_4: "peka på den spelare som du litar minst på.",
		PROMPT_EMPATH_QUESTION_5: "peka på en spelare som du tror är en av {TEAM_VILLAGE_DEFINITE}.",
		PROMPT_EMPATH_QUESTION_6: "peka på den spelare som du tror kommer prata mest.",
		PROMPT_EMPATH_QUESTION_7: "peka på den spelare som du tror kommer prata minst.",
		PROMPT_EMPATH_QUESTION_8: "peka på den spelare som du tror är bäst på att bluffa.",
		PROMPT_EMPATH_QUESTION_9: "peka på den spelare som du tror är sämst på att bluffa.",
		PROMPT_EXPOSER: "{ROLE_EXPOSER}, vakna. Du får vända {ExposerCardCount:false} av mittenkorten. {ROLE_EXPOSER}, somna.",
		PROMPT_EXPOSER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_EXPOSER_DEFINITE}, vakna. Du får vända {ExposerCardCount:true} av mittenkorten. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_FEUDINGALIENS: "{ROLE_FEUDINGALIENS}, {IfDoppelgangerPresent:'PROMPT_FEUDINGALIENS_DOPPELGANGER'} vakna och identifiera varandra. {ROLE_FEUDINGALIENS}, somna.",
		PROMPT_FEUDINGALIENS_DOPPELGANGER: "och {ROLE_DOPPELGANGER_DEFINITE} om du såg ett av {ROLE_FEUDINGALIENS_DEFINITE}s kort, ",
		PROMPT_GREMLIN: "{ROLE_GREMLIN}, vakna. {PROMPT_GREMLIN_ACTION} {ROLE_GREMLIN}, somna.",
		PROMPT_GREMLIN_ACTION: "Byt plats på två andra spelares märken eller två andra spelares kort, utan att titta på något av dem.",
		PROMPT_GREMLIN_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_GREMLIN_DEFINITE}, vakna. {PROMPT_GREMLIN_ACTION} {ROLE_DOPPELGANGER}, somna.",
		PROMPT_INSOMNIAC: "{ROLE_INSOMNIAC}, vakna. Titta på ditt eget kort. {ROLE_INSOMNIAC}, somna.",
		PROMPT_INSOMNIAC_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_INSOMNIAC_DEFINITE}, vakna. Titta på ditt eget kort. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_INSTIGATOR: "{ROLE_INSTIGATOR}, vakna. Byt ut en annan spelares märke mot {ROLE_INSTIGATOR_DEFINITE}s märke. {ROLE_INSTIGATOR}, somna.",
		PROMPT_LEADER: "{ROLE_LEADER}, vakna. {TEAM_ALIEN_PLURAL}, håll ut en tumme så att {ROLE_LEADER_DEFINITE} kan se. {IfPresent:'FEUDINGALIENS','PROMPT_LEADER_FEUDINGALIENS'} {ROLE_LEADER}, somna. {IfDoppelgangerPresent:'PROMPT_LEADER_DOPPELGANGER'} {TEAM_ALIEN_PLURAL}, dra tillbaka tummarna.",
		PROMPT_LEADER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_LEADER_DEFINITE}, vakna. {TEAM_ALIEN_PLURAL}, fortsätt hålla ut tummarna så att {ROLE_DOPPELGANGER} kan se. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_LEADER_FEUDINGALIENS: "{ROLE_FEUDINGALIENS}, håll ut båda tummarna. {ROLE_LEADER}, om du ser både {ROLE_FEUDINGALIENS_DEFINITE} vinner du om ingen av dem röstas ut.",
		PROMPT_MARKSMAN: "{ROLE_MARKSMAN}, vakna. {PROMPT_MARKSMAN_ACTION} {ROLE_MARKSMAN}, somna.",
		PROMPT_MARKSMAN_ACTION: "Titta på en annan spelares kort, samt ytterligare en annan spelares märke. Det får inte vara samma spelare.",
		PROMPT_MARKSMAN_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_MARKSMAN_DEFINITE}, vakna. {PROMPT_MARKSMAN_ACTION} {ROLE_DOPPELGANGER}, somna.",
		PROMPT_MASON: "{ROLE_MASON}, {IfDoppelgangerPresent:'PROMPT_MASON_DOPPELGANGER'} vakna och identifiera varandra. {ROLE_MASON}, somna.",
		PROMPT_MASON_DOPPELGANGER: "och {ROLE_DOPPELGANGER_DEFINITE} om du såg en {ROLE_MASON},",
		PROMPT_MINION: "{ROLE_MINION}, vakna. {TEAM_WEREWOLF_PLURAL}, håll ut en tumme så att {ROLE_MINION_DEFINITE} kan se vem ni är. {ROLE_MINION}, somna. {IfDoppelgangerPresent:'PROMPT_MINION_DOPPELGANGER'} {TEAM_WEREWOLF_PLURAL}, ner med tummarna.",
		PROMPT_MINION_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_MINION_DEFINITE}, vakna. {TEAM_WEREWOLF_PLURAL}, fortsätt hålla ut tummen så att {ROLE_DOPPELGANGER_DEFINITE} kan se vem ni är. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_MORTICIAN: "{ROLE_MORTICIAN}, vakna. Du får titta på {MorticianRandomEvent:false}. {ROLE_MORTICIAN}, somna.",
		PROMPT_MORTICIAN_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_MORTICIAN_DEFINITE}, vakna. Du får titta på {MorticianRandomEvent:true}. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_MORTICIAN_FALLBACK: "<vänster/höger/båda grannar/eget kort>",
		PROMPT_MYSTIC_WOLF: "{ROLE_MYSTICWOLF}, vakna. Du får titta på en annan spelares kort. {ROLE_MYSTICWOLF}, somna.",
		PROMPT_NOSTRADAMUS_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_NOSTRADAMUS_DEFINITE} gäller samma vinstvilkor för dig.",
		PROMPT_NOSTRADAMUS_MAIN: "{ROLE_NOSTRADAMUS}, vakna. Du kan titta på en till tre andra spelares kort. {IfAnyWithTag:'PI_CONVERSION_ROLE','PROMPT_NOSTRADAMUS_WARNING'} {ROLE_NOSTRADAMUS}, somna.",
		PROMPT_NOSTRADAMUS_WARNING: "Om du ser: {ListRolesWithTag:'PI_CONVERSION_ROLE'}, måste du sluta. <Berättare: annonsera vilket lag {ROLE_NOSTRADAMUS_DEFINITE} nu tillhör, eller {NostradamusRandomTeam}>. Om du inte blir utröstad och det laget vinner så vinner även du.{IfDoppelgangerPresent:'PROMPT_NOSTRADAMUS_DOPPELGANGER'}",
		PROMPT_ORACLE: "{ROLE_ORACLE}, vakna. {OracleRandomEvent} {ROLE_ORACLE}, somna.",
		PROMPT_ORACLE_BLOCK_ACTION: "Samtliga andra spelare, räck ut en hand framför er. {ROLE_ORACLE}, rör vid en annan spelares hand som du vill blockera. Spelaren får inte vakna eller utföra någon handling under natten oavsett vad deras roll är.",
		PROMPT_ORACLE_CHANGE_TEAM: "Vill du gå med i {OracleChangeTeamChoice}s lag? <OM JA> {OracleChangeTeamMode} <OM NEJ> {ROLE_ORACLE_DEFINITE} är kvar i bybornas lag.",
		PROMPT_ORACLE_CHANGE_TEAM_FULL: "{ROLE_ORACLE_DEFINITE} är nu den rollen, och vaknar tillsammans med dem.",
		PROMPT_ORACLE_CHANGE_TEAM_PARTIAL: "{ROLE_ORACLE_DEFINITE} vinner nu tillsammans med det laget, men är inte den rollen och vaknar inte tillsammans med dem.",
		PROMPT_ORACLE_EVEN_ODD: "<Berättare: avslöja om {ROLE_ORACLE_DEFINITE} har ett jämt eller udda spelarnummer>.",
		PROMPT_ORACLE_FALLBACK: "<Fel vid inställningar för {ROLE_ORACLE}>",
		PROMPT_ORACLE_HUNT: "Gissa ett tal mellan 1 och 10. {OracleHuntResult}",
		PROMPT_ORACLE_HUNT_AVOIDED: "Korrekt. När en annan roll blir tillsagd att vakna kan du en gång under natten vakna tillsammans med dem för att iakta vem de är och vad de gör. {OracleOmniscienceExclusion}",
		PROMPT_ORACLE_HUNT_OMNISCIENCE: "Du får dock inte vakna för att iakta någon av följande roller: {ListRolesWithTag:'ORACLE_OMNISCIENCE_EXCLUDED'}.",
		PROMPT_ORACLE_HUNT_STARTED: "Fel. {ROLE_ORACLE}, du vinner nu endast om du inte blir utröstad. Övriga spelare, oberoende av tidigare roll- och lagtillhörighet har ni nu endast ett vinstvilkor: hitta {ROLE_ORACLE_DEFINITE}.",
		PROMPT_ORACLE_VIEW_CARD: "Du får titta på {OracleViewCard}.",
		PROMPT_PARANORMALINVESTIGATOR_MAIN: "{ROLE_PARANORMALINVESTIGATOR}, vakna. Du kan titta på en till två andras spelares kort. {IfAnyWithTag:'PI_CONVERSION_ROLE','PROMPT_PARANORMALINVESTIGATOR_WARNING'} {ROLE_PARANORMALINVESTIGATOR}, somna.",
		PROMPT_PARANORMALINVESTIGATOR_WARNING: "Om du ser: {ListRolesWithTag:'PI_CONVERSION_ROLE'}, måste du sluta. Du tillhör då det laget.",
		PROMPT_PICKPOCKET: "{ROLE_PICKPOCKET}, vakna. {PROMPT_PICKPOCKET_ACTION} {ROLE_PICKPOCKET}, somna.",
		PROMPT_PICKPOCKET_ACTION: "Du kan välja att stjäla en annan spelares märke och ersätta det med ditt märke. Titta sedan på märket du stal.",
		PROMPT_PICKPOCKET_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_PICKPOCKET_DEFINITE}, vakna. {PROMPT_PICKPOCKET_ACTION} {ROLE_DOPPELGANGER}, somna.",
		PROMPT_PRIEST: "{ROLE_PRIEST}, vakna. Byt ut ditt märke mot ett rent märke. Om du vill får du även byta ut en annan spelares märke mot ett rent märke. {ROLE_PRIEST}, somna.",
		PROMPT_PRIEST_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_PRIEST_DEFINITE}, vakna. Byt ut ditt märke mot ett rent märke. Om du vill får du även byta ut en annan spelares märke mot ett rent märke. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_PSYCHIC: "{ROLE_PSYCHIC}, vakna. Du får titta på {PsychicRandomEvent:false}. {ROLE_PSYCHIC}, somna.",
		PROMPT_PSYCHIC_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_PSYCHIC_DEFINITE}, vakna. Du får titta på {PsychicRandomEvent:true}. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_RASCAL: "{ROLE_RASCAL}, vakna. {RascalRandomEvent:false} {ROLE_RASCAL}, somna.",
		PROMPT_RASCAL_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_RASCAL_DEFINITE}, vakna. {RascalRandomEvent:true} {ROLE_DOPPELGANGER}, somna.",
		PROMPT_RENFIELD: "{ROLE_RENFIELD}, vakna. {TEAM_VAMPIRE_PLURAL}, peka på den spelare som ni har gett {TEAM_VAMPIRE_DEFINITE}s märke. {ROLE_RENFIELD}, {PROMPT_RENFIELD_ACTION} {ROLE_RENFIELD}, somna. {IfDoppelgangerPresent:PROMPT_RENFIELD_DOPPELGANGER} {TEAM_VAMPIRE_PLURAL}, sluta peka.",
		PROMPT_RENFIELD_ACTION: "identifiera {TEAM_VAMPIRE_DEFINITE} och byt ut ditt märke mot {ROLE_RENFIELD_DEFINITE}s märke.",
		PROMPT_RENFIELD_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_RENFIELD_DEFINITE}, vakna. {TEAM_VAMPIRE_PLURAL}, fortsätt peka på den spelare som ni har gett {TEAM_VAMPIRE_DEFINITE}s märke. {ROLE_DOPPELGANGER}, {PROMPT_RENFIELD_ACTION} {ROLE_DOPPELGANGER}, somna.",
		PROMPT_REVEALER: "{ROLE_REVEALER}, vakna. {PROMPT_REVEALER_ACTION} {ROLE_REVEALER}, somna.",
		PROMPT_REVEALER_ACTION: "Vänd en annan spelares kort ansiktet upp. {IfAnyWithTag:'REVEALER_HIDDEN_ROLE','PROMPT_REVEALER_HIDDEN_ROLE'}.",
		PROMPT_REVEALER_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_REVEALER_DEFINITE}, vakna. {PROMPT_REVEALER_ACTION} {ROLE_DOPPELGANGER}, somna.",
		PROMPT_REVEALER_HIDDEN_ROLE: "Om kortet är: {ListRolesWithTag:'REVEALER_HIDDEN_ROLE'}, vänd kortet tillbaka med ansiktet ner",
		PROMPT_RIPPLE: "{RippleRandomEvent}",
		PROMPT_RIPPLE_FALLBACK: " ",	//Empty string, something went wrong so just ignore the ripple
		PROMPT_RIPPLE_NONE: "<Berättare: ignorera följande om inte {ROLE_ORACLE_DEFINITE} valt att tvinga fram en krusning> {RippleRandomEvent:true}",
		PROMPT_ROBBER: "{ROLE_ROBBER}, vakna. {PROMPT_ROBBER_ACTION} {ROLE_ROBBER}, somna.",
		PROMPT_ROBBER_ACTION: "Du kan välja att stjäla en annan spelares kort och ersätta det med ditt kort. Titta sedan på kortet du stal. Du ska inte vakna när din nya roll ropas upp.",
		PROMPT_SEER: "{ROLE_SEER}, vakna. Du kan titta på en annan spelares kort, eller två av mittenkorten. {ROLE_SEER}, somna.",
		PROMPT_SENTINEL: "{ROLE_SENTINEL}, vakna. Placera en sköldbricka på en annan spelares kort. {ROLE_SENTINEL}, somna.",
		PROMPT_SHARED_VIEW_CENTER_FOUR: "fyra av mittenkorten",
		PROMPT_SHARED_VIEW_CENTER_ONE: "ett av mittenkorten",
		PROMPT_SHARED_VIEW_CENTER_THREE: "tre av mittenkorten",
		PROMPT_SHARED_VIEW_CENTER_TWO: "två av mittenkorten",
		PROMPT_SHARED_VIEW_PLAYER_ANY: "en annan spelares kort",
		PROMPT_SHARED_VIEW_PLAYER_EVEN: "en annan jämn spelares kort",
		PROMPT_SHARED_VIEW_PLAYER_EVEN_DOUBLE: "två andra jämna spelares kort",
		PROMPT_SHARED_VIEW_PLAYER_NEIGHBOR_ANY: "en valfri grannes kort",
		PROMPT_SHARED_VIEW_PLAYER_NEIGHBOR_BOTH: "båda grannars kort",
		PROMPT_SHARED_VIEW_PLAYER_NEIGHBOR_LEFT: "vänster grannes kort",
		PROMPT_SHARED_VIEW_PLAYER_NEIGHBOR_RIGHT: "höger grannes kort",
		PROMPT_SHARED_VIEW_PLAYER_ODD: "en annan udda spelares kort",
		PROMPT_SHARED_VIEW_PLAYER_ODD_DOUBLE: "två andra udda spelares kort",
		PROMPT_SHARED_VIEW_PLAYER_SELF: "ditt eget kort",
		PROMPT_SHARED_VIEW_PLAYER_SPECIFIC: "kort för spelare {SharedViewSpecificPlayerResult}",
		PROMPT_SQUIRE: "{ROLE_SQUIRE}, vakna. {TEAM_WEREWOLF_PLURAL}, håll ut en tumme så att {ROLE_SQUIRE_DEFINITE} kan se. {ROLE_SQUIRE}, du får titta på {TEAM_WEREWOLF_DEFINITE}s kort. {ROLE_SQUIRE}, somna. {IfDoppelgangerPresent:'PROMPT_SQUIRE_DOPPELGANGER'} {TEAM_WEREWOLF_PLURAL}, ner med tummarna.",
		PROMPT_SQUIRE_DOPPELGANGER: "{ROLE_DOPPELGANGER}, om du såg {ROLE_SQUIRE_DEFINITE}, vakna. {TEAM_WEREWOLF_PLURAL}, fortsätt hålla ut tummen så att {ROLE_DOPPELGANGER_DEFINITE} kan se. {ROLE_DOPPELGANGER}, du får titta på {TEAM_WEREWOLF_DEFINITE}s kort. {ROLE_DOPPELGANGER}, somna.",
		PROMPT_THING: "{ROLE_THING}, vakna. Samtliga andra spelare, räck ut en hand framför er. {ROLE_THING}, rör handen tilhörande spelarna närmast till höger eller vänster. {ROLE_THING}, somna.",
		PROMPT_TROUBLEMAKER: "{ROLE_TROUBLEMAKER}, vakna. {PROMPT_TROUBLEMAKER_ACTION} {ROLE_TROUBLEMAKER}, somna.",
		PROMPT_TROUBLEMAKER_ACTION: "Byt plats på två andra spelares kort, utan att titta på något av dem.",
		PROMPT_VAMPIRE: "{IfDoppelgangerPresent:'PROMPT_VAMPIRE_DOPPELGANGER_PREFIX'} {TEAM_VAMPIRE_PLURAL}, vakna och identifiera varandra. Tillsammans får ni välja en spelare vars märke ni byter ut mot {TEAM_VAMPIRE_DEFINITE}s märke. {TEAM_VAMPIRE_PLURAL}, somna.",
		PROMPT_VAMPIRE_DOPPELGANGER_PREFIX: "{ROLE_DOPPELGANGER}, om du såg någon av {TEAM_VAMPIRE_DEFINITE}, följ instruktionerna för rollen du såg.",
		PROMPT_VILLAGEIDIOT: "{ROLE_VILLAGEIDIOT}, vakna. {PROMPT_VILLAGEIDIOT_ACTION} {ROLE_VILLAGEIDIOT}, somna.",
		PROMPT_VILLAGEIDIOT_ACTION: "Du kan välja att flytta samtliga spelares kort ett steg åt vänster, åt höger, eller inte alls.",
		PROMPT_WEREWOLF: "{IfDoppelgangerPresent:'PROMPT_WEREWOLF_DOPPELGANGER_PREFIX'} {TEAM_WEREWOLF_PLURAL}, {IfPresent:'DREAMWOLF','PROMPT_WEREWOLF_DREAMWOLF_EXCEPTION'} vakna och identifiera varandra. Om det bara finns en {TEAM_WEREWOLF} får du titta på ett av mittenkorten. {IfPresent:'DREAMWOLF','PROMPT_WEREWOLF_DREAMWOLF_GESTURE'} {TEAM_WEREWOLF_PLURAL}, somna.",
		PROMPT_WEREWOLF_DOPPELGANGER_PREFIX: "{ROLE_DOPPELGANGER}, om du såg någon av {TEAM_WEREWOLF_DEFINITE}, följ instruktionerna för rollen du såg.",
		PROMPT_WEREWOLF_DREAMWOLF_EXCEPTION: "med undantag för {ROLE_DREAMWOLF_DEFINITE}, ",
		PROMPT_WEREWOLF_DREAMWOLF_GESTURE: "{ROLE_DREAMWOLF}, stick ut tummen så att andra {TEAM_WEREWOLF_PLURAL} kan se vem du är. {ROLE_DREAMWOLF}, ner med tummen.",
		PROMPT_WITCH: "{ROLE_WITCH}, vakna. {PROMPT_WITCH_ACTION} {ROLE_WITCH}, somna.",
		PROMPT_WITCH_ACTION: "Du kan välja att titta på ett av korten i mitten. Om du gör det måste du ge det kortet till dig själv eller en annan spelare.",
		ROLE_ALIEN: "Utomjording",
		ROLE_ALIEN_DEFINITE: "Utomjordingen",
		ROLE_ALPHAWOLF: "Alfavarg",
		ROLE_ALPHAWOLF_DEFINITE: "Alfavargen",
		ROLE_APPRENTICEASSASSIN: "Lönnmördarnovis",
		ROLE_APPRENTICEASSASSIN_DEFINITE: "Lönnmördarnovisen",
		ROLE_APPRENTICESEER: "Siarlärling",
		ROLE_APPRENTICESEER_DEFINITE: "Siarlärlingen",
		ROLE_APPRENTICETANNER: "Garvargesäll",
		ROLE_APPRENTICETANNER_DEFINITE: "Garvargesällen",
		ROLE_ASSASSIN: "Lönnmördare",
		ROLE_ASSASSIN_DEFINITE: "Lönnmördaren",
		ROLE_AURASEER: "Auraläsare",
		ROLE_AURASEER_DEFINITE: "Auraläsaren",
		ROLE_BEHOLDER: "Betraktare",
		ROLE_BEHOLDER_DEFINITE: "Betraktaren",
		ROLE_BLOB: "Blobb",
		ROLE_BLOB_DEFINITE: "Blobben",
		ROLE_BODYGUARD: "Livvakt",
		ROLE_BODYGUARD_DEFINITE: "Livvakten",
		ROLE_BODYSNATCHER: "Infiltratör",
		ROLE_BODYSNATCHER_DEFINITE: "Infiltratören",
		ROLE_COPYCAT: "Imitatör",
		ROLE_COPYCAT_DEFINITE: "Imitatören",
		ROLE_COUNT: "Greve",
		ROLE_COUNT_DEFINITE: "Greven",
		ROLE_COW: "Ko",
		ROLE_COW_DEFINITE: "Kon",
		ROLE_CUPID: "Amor",
		ROLE_CUPID_DEFINITE: "Amor",
		ROLE_CURATOR: "Kurator",
		ROLE_CURATOR_DEFINITE: "Kuratorn",
		ROLE_CURSED: "Fördömd",
		ROLE_CURSED_DEFINITE: "den Fördömda",
		ROLE_DISEASED: "Smittad",
		ROLE_DISEASED_DEFINITE: "den Smittade",
		ROLE_DOPPELGANGER: "Dubbelgångare",
		ROLE_DOPPELGANGER_DEFINITE: "Dubbelgångaren",
		ROLE_DREAMWOLF: "Drömvarg",
		ROLE_DREAMWOLF_DEFINITE: "Drömvargen",
		ROLE_DRUNK: "Berusad",
		ROLE_DRUNK_DEFINITE: "den Berusade",
		ROLE_EMPATH: "Empat",
		ROLE_EMPATH_DEFINITE: "Empaten",
		ROLE_EXPOSER: "Angivare",
		ROLE_EXPOSER_DEFINITE: "Angivaren",
		ROLE_FEUDINGALIENS: "Groob och Zerb",
		ROLE_FEUDINGALIENS_DEFINITE: "Groob och Zerb",
		ROLE_GREMLIN: "Troll",
		ROLE_GREMLIN_DEFINITE: "Trollet",
		ROLE_HUNTER: "Jägare",
		ROLE_HUNTER_DEFINITE: "Jägaren",
		ROLE_INSOMNIAC: "Sömnlös",
		ROLE_INSOMNIAC_DEFINITE: "den Sömnlösa",
		ROLE_INSTIGATOR: "Anstiftare",
		ROLE_INSTIGATOR_DEFINITE: "Anstiftaren",
		ROLE_LEADER: "Borgmästare",
		ROLE_LEADER_DEFINITE: "Borgmästaren",
		ROLE_MARKSMAN: "Spejare",
		ROLE_MARKSMAN_DEFINITE: "Spejaren",
		ROLE_MASON: "Frimurare",
		ROLE_MASON_DEFINITE: "Frimuraren",
		ROLE_MASTER: "Mästare",
		ROLE_MASTER_DEFINITE: "Mästaren",
		ROLE_MINION: "Underhuggare",
		ROLE_MINION_DEFINITE: "Underhuggaren",
		ROLE_MORTICIAN: "Obducent",
		ROLE_MORTICIAN_DEFINITE: "Obducenten",
		ROLE_MYSTICWOLF: "Siarvarg",
		ROLE_MYSTICWOLF_DEFINITE: "Siarvargen",
		ROLE_NOSTRADAMUS: "Profet",
		ROLE_NOSTRADAMUS_DEFINITE: "Profeten",
		ROLE_ORACLE: "Orakel",
		ROLE_ORACLE_DEFINITE: "Oraklet",
		ROLE_PARANORMALINVESTIGATOR: "Spökjägare",
		ROLE_PARANORMALINVESTIGATOR_DEFINITE: "Spökjägaren",
		ROLE_PHASE_DAY: "dagroll",
		ROLE_PHASE_DUSK: "skymmningsroll",
		ROLE_PHASE_NIGHT: "nattroll",
		ROLE_PICKPOCKET: "Ficktjuv",
		ROLE_PICKPOCKET_DEFINITE: "Ficktjuven",
		ROLE_PRIEST: "Präst",
		ROLE_PRIEST_DEFINITE: "Prästen",
		ROLE_PRINCE: "Prins",
		ROLE_PRINCE_DEFINITE: "Prinsen",
		ROLE_PSYCHIC: "Synsk",
		ROLE_PSYCHIC_DEFINITE: "den synska",
		ROLE_RASCAL: "Fifflare",
		ROLE_RASCAL_DEFINITE: "Fifflaren",
		ROLE_RENFIELD: "Renfield",
		ROLE_RENFIELD_DEFINITE: "Renfield",
		ROLE_REVEALER: "Astrolog",
		ROLE_REVEALER_DEFINITE: "Astrologen",
		ROLE_ROBBER: "Tjuv",
		ROLE_ROBBER_DEFINITE: "Tjuven",
		ROLE_SEER: "Siare",
		ROLE_SEER_DEFINITE: "Siaren",
		ROLE_SENTINEL: "Väktare",
		ROLE_SENTINEL_DEFINITE: "Väktaren",
		ROLE_SQUIRE: "Lakej",
		ROLE_SQUIRE_DEFINITE: "Lakejen",
		ROLE_SYNTHETICALIEN: "Syntet",
		ROLE_SYNTHETICALIEN_DEFINITE: "Syntet",
		ROLE_TANNER: "Garvare",
		ROLE_TANNER_DEFINITE: "Garvaren",
		ROLE_THING: "Varelsen",
		ROLE_THING_DEFINITE: "Varelsen",
		ROLE_TROUBLEMAKER: "Bråkmakare",
		ROLE_TROUBLEMAKER_DEFINITE: "Bråkmakaren",
		ROLE_VAMPIRE: "Vampyr",
		ROLE_VAMPIRE_DEFINITE: "Vampyren",
		ROLE_VILLAGEIDIOT: "Byfåne",
		ROLE_VILLAGEIDIOT_DEFINITE: "Byfånen",
		ROLE_VILLAGER: "Bybo",
		ROLE_VILLAGER_DEFINITE: "Bybon",
		ROLE_WEREWOLF: "Varulv",
		ROLE_WEREWOLF_DEFINITE: "Varulven",
		ROLE_WITCH: "Häxa",
		ROLE_WITCH_DEFINITE: "Häxan",
		TEAM_ALIEN: "Utomjording",
		TEAM_ALIEN_DEFINITE: "Utomjordingarna",
		TEAM_ALIEN_PLURAL: "Utomjordingar",
		TEAM_MINORITY: "Övriga",
		TEAM_MINORITY_DEFINITE: "de övriga",
		TEAM_PREFIX: "Lag",
		TEAM_VAMPIRE: "Vampyr",
		TEAM_VAMPIRE_DEFINITE: "Vampyrerna",
		TEAM_VAMPIRE_PLURAL: "Vampyrer",
		TEAM_VARIABLE_SUFFIX: " (variabel)",
		TEAM_VILLAGE: "By",
		TEAM_VILLAGE_DEFINITE: "Byn",
		TEAM_WEREWOLF: "Varulv",
		TEAM_WEREWOLF_DEFINITE: "Varulvarna",
		TEAM_WEREWOLF_PLURAL: "Varulvar",
		UI_ABILITY_ALIEN: "Vaknar tillsammans med alla {TEAM_ALIEN_PLURAL} och identifierar andra {TEAM_ALIEN_PLURAL}. Kan också kollektivt få titta på ett eller fler kort slumpmässigt.",
		UI_ABILITY_ALPHAWOLF: "Vaknar först tillsammans med alla {TEAM_WEREWOLF_PLURAL}. Vaknar sedan ensam och byter en icke-{TEAM_WEREWOLF_PLURAL}spelares kort med det oanvända {TEAM_WEREWOLF}skortet i mitten. Om {ROLE_ALPHAWOLF_DEFINITE} används placeras ytterligare ett {TEAM_WEREWOLF}skort i mitten, roterat 90 grader.",
		UI_ABILITY_APPRENTICEASSASSIN: "Vaknar samtidigt som {ROLE_ASSASSIN_DEFINITE} efter att markören för måltavlan placerats ut så att de kan identifiera varandra. Om ingen {ROLE_ASSASSIN} är i spel så utför {ROLE_APPRENTICEASSASSIN_DEFINITE} den handlingen istället.",
		UI_ABILITY_APPRENTICESEER: "Vaknar och får se på ett av mittenkorten.",
		UI_ABILITY_APPRENTICETANNER: "Vaknar och får se vem {ROLE_TANNER_DEFINITE} är.",
		UI_ABILITY_ASSASSIN: "Vaknar och väljer en måltavla genom att placera en markör framför spelaren.",
		UI_ABILITY_AURASEER: "Vaknar och får se vilka spelare som har tittat på eller flyttat ett kort under natten.",
		UI_ABILITY_BEHOLDER: "Vaknar och får se vem {ROLE_SEER_DEFINITE} och {ROLE_APPRENTICESEER_DEFINITE} är. Kan sedan kontrollera deras kort för att se om korten har flyttats under natten.",
		UI_ABILITY_BLOB: "Vaknar inte. I början av dagen annonseras vilka av de närmaste grannarna (0–4 st) som {ROLE_BLOB_DEFINITE} måste skydda.",
		UI_ABILITY_BODYGUARD: "Spelaren som {ROLE_BODYGUARD_DEFINITE} röstar på kan inte röstas ut. Spelaren med näst högst antal röster blir istället utröstad.",
		UI_ABILITY_BODYSNATCHER: "Vaknar och kan välja att byta en annan spelares kort mot sitt eget och sedan titta på sitt nya kort. Både {ROLE_BODYSNATCHER_DEFINITE} och det andra kortet är en {TEAM_ALIEN}.",
		UI_ABILITY_COPYCAT: "Vaknar och tittar på ett av korten i mitten. {ROLE_COPYCAT_DEFINITE} kopierar den rollen och lagtillhörighet. Roll/lag följer med kortet om det flyttas till en annan spelare under natten. {ROLE_COPYCAT_DEFINITE} vaknar senare under natten och utför den kopierade rollens aktivitet när den rollen ropas upp.",
		UI_ABILITY_COUNT: "Vaknar tillsammans med alla {TEAM_VAMPIRE_PLURAL}. Vaknar sedan ensam och placerar en rädsla-markör framör en annan icke-vampyr spelare. Spelaren med markören får inte vakna eller utföra sin handling under natten.",
		UI_ABILITY_COW: "Sträcker ut en hand utan att vakna. Om en eller flera {TEAM_ALIEN_PLURAL} sitter bredvid {ROLE_COW_DEFINITE} måste de röra vid {ROLE_COW_DEFINITE}s hand.",
		UI_ABILITY_CUPID: "Vaknar och placerar en kärleks-markör framför två spelare. Spelarna med kärleksmarkörer vaknar tillsammans och identiferar varandra. Om en av dem röstas ut så röstas även den andra ut.",
		UI_ABILITY_CURATOR: "Vaknar och placerar en slumpmässig artefaktbricka framför en spelare, inklusive {ROLE_CURATOR_DEFINITE} själv. I början av dagen får spelaren titta på brickan för att se vilken effekt den har. Om brickan innebär ett rollbyte så tar den prioritet över spelarens kort vad gäller förmåga och lagtillhögrighet.",
		UI_ABILITY_CURSED: "Om minst en {TEAM_WEREWOLF}, {TEAM_VAMPIRE} eller {TEAM_ALIEN} röstar på {ROLE_CURSED_DEFINITE} så byter den lagtillhörighet till laget i fråga.",
		UI_ABILITY_DISEASED: "Vaknar och placerar en infekterad markör framför en av sina grannar. En spelare som röstar på {ROLE_DISEASED_DEFINITE} eller på en spelare med markören förlorar automatiskt även om deras lag vinner.",
		UI_ABILITY_DOPPELGANGER: "Vaknar och tittar på en annan spelares kort. {ROLE_DOPPELGANGER_DEFINITE} kopierar den rollen och lagtillhörighet. Roll/lag följer med kortet om det flyttas till en annan spelare under natten. {ROLE_DOPPELGANGER_DEFINITE} blir sedan ombedd att vakna senare under natten och utför den kopierade rollens aktivitet.",
		UI_ABILITY_DREAMWOLF: "Sticker ut tummen istället för att vakna tillsammans med {TEAM_WEREWOLF_PLURAL} så att de kan se vem {ROLE_DREAMWOLF_DEFINITE} är.",
		UI_ABILITY_DRUNK: "Vaknar och byter sitt eget kort mot ett av de oanvända korten i mitten utan att tittat på det nya kortet.",
		UI_ABILITY_EMPATH: "Vaknar och får iakta spelare utföra en slumpmässig handling utan att själv vakna.",
		UI_ABILITY_EXPOSER: "Vaknar och får vända 1-3 av mittenkorten ansiktet upp, antal bestäms slumpmässigt.",
		UI_ABILITY_FEUDINGALIENS: "Vaknar tillsammans med alla {TEAM_ALIEN_PLURAL}. Vaknar sedan tillsammans och identifierar varandra.",
		UI_ABILITY_GREMLIN: "Vaknar och byter antingen plats på två andra spelares markörer eller kort, inte båda.",
		UI_ABILITY_HUNTER: "Om {ROLE_HUNTER_DEFINITE} blir utröstad kommer även spelaren som {ROLE_HUNTER_DEFINITE} röstade på att bli utröstad.",
		UI_ABILITY_INSOMNIAC: "Vaknar sist och tittar på sitt eget kort.",
		UI_ABILITY_INSTIGATOR: "Vaknar och ger en förrädar-markör till en spelare. Spelaren med markören vinner endast om en spelare i dess egna lag röstas ut.",
		UI_ABILITY_LEADER: "Vaknar och får veta vilka spelare som är {TEAM_ALIEN_PLURAL}. Får även veta vilka av {TEAM_ALIEN_DEFINITE} som är {ROLE_FEUDINGALIENS_DEFINITE}. Om alla {TEAM_ALIEN_DEFINITE} pekar på {ROLE_LEADER_DEFINITE} så vinner de oavsett vad som händer i övrigt.",
		UI_ABILITY_MARKSMAN: "Vaknar och får se på en annan spelares kort, och på en annan spelares markör. Det får inte vara samma spelare för båda.",
		UI_ABILITY_MASON: "Vaknar tillsammans med den andra {ROLE_MASON_DEFINITE} och identifierar varandra.",
		UI_ABILITY_MASTER: "Vaknar tillsammans med alla {TEAM_VAMPIRE_PLURAL}. Om minst en annan {TEAM_VAMPIRE} röstar på {ROLE_MASTER_DEFINITE} så blir han immun mot att röstas ut.",
		UI_ABILITY_MINION: "Vaknar och får se vilka spelare som är en {TEAM_WEREWOLF}.",
		UI_ABILITY_MORTICIAN: "Vaknar och får se på en eller båda sina grannars, eller sitt eget, kort. Bestäms slumpmässigt.",
		UI_ABILITY_MYSTICWOLF: "Vaknar först tillsammans med alla {TEAM_WEREWOLF_PLURAL}. Vaknar sedan ensam och tittar på en annan spelares kort.",
		UI_ABILITY_NOSTRADAMUS: "Vaknar och väljer att titta på upp till tre spelares kort. Om ett av korten inte tillhör {TEAM_VILLAGE_DEFINITE} får inga fler kort inspekteras, och {ROLE_NOSTRADAMUS_DEFINITE}s kort kopierar den lagtillhörigheten. Lagtillhörighet följer med kortet om det flyttas till en annan spelare under natten. Den nya lagtillhörigheten läses upp för alla.",
		UI_ABILITY_ORACLE: "Vaknar och utför en slumpmässig bestämd handling som läses upp.",
		UI_ABILITY_PARANORMALINVESTIGATOR: "Vaknar och väljer att titta på upp till två spelares kort. Om ett av korten inte tillhör {TEAM_VILLAGE_DEFINITE} får inga fler kort inspekteras, och {ROLE_PARANORMALINVESTIGATOR_DEFINITE}s kort kopierar den lagtillhörigheten. Lagtillhörighet följer med kortet om det flyttas till en annan spelare under natten.",
		UI_ABILITY_PICKPOCKET: "Vaknar och kan välja att byta en annan spelares markör mot sitt egna och sedan titta på sin nya markör.",
		UI_ABILITY_PREFIX: "Förmåga/aktivitet",
		UI_ABILITY_PRIEST: "Vaknar och byter ut sin egen och, om så önskas, en annan spelares markörer mot en ren markör.",
		UI_ABILITY_PRINCE: "Kan inte röstas ut. Spelaren med näst högst antal röster blir istället utröstad.",
		UI_ABILITY_PSYCHIC: "Vaknar och får se på en annan spelares kort med slumpmässiga restriktioner.",
		UI_ABILITY_RASCAL: "Vaknar och utför slumpmässigt samma handling som {ROLE_TROUBLEMAKER_DEFINITE}, {ROLE_ROBBER_DEFINITE}, {ROLE_WITCH_DEFINITE}, {ROLE_VILLAGEIDIOT_DEFINITE} eller {ROLE_DRUNK_DEFINITE}.",
		UI_ABILITY_RENFIELD: "Vaknar och ersätter sin egen markör med {ROLE_RENFIELD_DEFINITE}s markör. Får se vilka spelare som är {TEAM_VAMPIRE}, samt vilken spelare de har gett en vampyrmarkör till.",
		UI_ABILITY_REVEALER: "Vaknar och vänder en annan spelares kort ansiktet upp. Om kortet inte tillhör {TEAM_VILLAGE_DEFINITE} så vänds kortet tillbaka med ansiktet ner.",
		UI_ABILITY_ROBBER: "Vaknar och kan välja att byta en annan spelares kort mot sitt eget och sedan titta på sitt nya kort. Vaknar inte fler gånger under natten.",
		UI_ABILITY_SEER: "Vaknar och får välja att se på en annan spelares kort, eller två av de oanvända korten i mitten.",
		UI_ABILITY_SENTINEL: "Vaknar och placerar en sköldbricka på en annan spelares kort. Ett kort med en sköldbricka får inte flyttas eller tittas på av andra spelare under natten.",
		UI_ABILITY_SQUIRE: "Vaknar och får se vilka spelare som är en {TEAM_WEREWOLF}. Får även se på de spelarnas kort för att se om de har flyttats under natten. ",
		UI_ABILITY_SYNTHETICALIEN: "Vaknar tillsammans med alla {TEAM_ALIEN_PLURAL} och identifierar andra {TEAM_ALIEN_PLURAL}. Kan också kollektivt få se på ett eller fler kort slumpmässigt.",
		UI_ABILITY_TANNER: "Om {ROLE_TANNER_DEFINITE} blir utröstad förlorar {TEAM_WEREWOLF_DEFINITE}, {TEAM_VAMPIRE_DEFINITE} och {TEAM_ALIEN_DEFINITE}.",
		UI_ABILITY_THING: "Vaknar och rör vid en av sina direkta grannar.",
		UI_ABILITY_TROUBLEMAKER: "Vaknar och byter plats på två andra spelares kort utan att titta på korten.",
		UI_ABILITY_VAMPIRE: "Vaknar tillsammans med alla {TEAM_VAMPIRE_PLURAL} och identifierar andra {TEAM_VAMPIRE_PLURAL}. Väljer kollektivt att placera en vampyr markör framför en annan spelare, vilket gör spelaren till en vampyr.",
		UI_ABILITY_VILLAGEIDIOT: "Vaknar och väljer att skifta alla andra spelares kort ett steg till höger, vänster, eller inte alls.",
		UI_ABILITY_VILLAGER: "Ingen.",
		UI_ABILITY_WEREWOLF: "Vaknar tillsammans med alla {TEAM_WEREWOLF_PLURAL} och identifierar andra {TEAM_WEREWOLF_PLURAL}. Får titta på ett av de oanvända korten i mitten om ensam {TEAM_WEREWOLF}.",
		UI_ABILITY_WITCH: "Vaknar och väljer om de vill titta på ett av de oanvända korten i mitten. Om ett kort inspekteras måste kortet bytas mot sitt eget eller någon annan spelares kort.",
		UI_FILTER_COMPLEXITY: "Svårighet",
		UI_FILTER_COMPLEXITY_EASY: "Enkel",
		UI_FILTER_COMPLEXITY_HARD: "Svår",
		UI_FILTER_COMPLEXITY_MEDIUM: "Medel",
		UI_FILTER_RULESET: "Regelverk",
		UI_FILTER_RULESET_ADVANCED: "Utökad",
		UI_FILTER_RULESET_ALIEN: "Utomjordingar",
		UI_FILTER_RULESET_BASIC: "Grund",
		UI_FILTER_RULESET_VAMPIRE: "Vampyrer",
		UI_GAMERULES: "Spelregler",
		UI_GENERATED_PROMPT: "Spelprompt",
		UI_PLAYER_COUNT: "Antal spelare:",
		UI_PRINT: "Skriv ut",
		UI_RESET: "Nollställ",
		UI_ROLEDESCRIPTIONS: "Rollbeskrivningar",
		UI_ROLESELECTION: "Välj roller",
		UI_SEARCH: "Sök",
		UI_SEARCH_PLACEHOLDER: "Filtrera roll...",
		UI_SETTING: "Inställningar",
		UI_SETTING_ALIENS_MAKE_ALIEN: "Gör en annan spelare till en {TEAM_ALIEN}",
		UI_SETTING_ALIENS_MAKE_MINION: "Gör en annan spelare till en medhjälpare",
		UI_SETTING_ALIENS_NOTHING: "Ingen handling",
		UI_SETTING_ALIENS_SHOW_CARDS: "Visa sina kort för andra {TEAM_ALIEN_DEFINITE}",
		UI_SETTING_ALIENS_TRADE_CARDS: "Byt kort med andra {TEAM_ALIEN_DEFINITE}",
		UI_SETTING_ALIENS_VIEW_CARD_COLLECTIVE: "Titta på kort gemensamt",
		UI_SETTING_ALIENS_VIEW_CARD_INDIVIDUAL: "Titta på kort individuellt",
		UI_SETTING_BODYSNATCHER_FAKE_ACTION: "Sannolikhet att enbart få låtsas utföra handlingen.",
		UI_SETTING_ERROR_WEIGHTGROUP_SUM_ZERO: "Viktgruppens sammanlagda vikt måste vara större än 0",
		UI_SETTING_EXPOSER_FLIP_ONE: "Vänd ett mittenkort",
		UI_SETTING_EXPOSER_FLIP_THREE: "Vänd tre mittenkort",
		UI_SETTING_EXPOSER_FLIP_TWO: "Vänd två mittenkort",
		UI_SETTING_LABEL_RASCAL: "Utför en av följande handlingar",
		UI_SETTING_LABEL_VIEW_CARD: "Titta på spelarkort",
		UI_SETTING_ORACLE_BLOCK_ACTION: "Hindra en annan spelare från att vakna",
		UI_SETTING_ORACLE_DRUNK: "Byter sitt kort mot ett mittenkort",
		UI_SETTING_ORACLE_EVEN_ODD: "Annonsera om {ROLE_ORACLE_DEFINITE} har ett jämnt eller udda spelarnummer",
		UI_SETTING_ORACLE_HUNT: "Orakeljakt",
		UI_SETTING_ORACLE_HUNT_ALLOW_BAD_TEAMS: "Tillåt att vakna för onda roller",
		UI_SETTING_ORACLE_HUNT_CHANCE: "Sannolikhet",
		UI_SETTING_ORACLE_SWITCH_TEAM: "Byt lag",
		UI_SETTING_ORACLE_SWITCH_TEAM_FULL: "Byt roll",
		UI_SETTING_ORACLE_SWITCH_TEAM_PARTIAL: "Byt endast lag",
		UI_SETTING_ORACLE_VIEW_CENTER: "Titta på mittenkort",
		UI_SETTING_ORACLE_VIEW_PLAYER: "Titta på spelarkort",
		UI_SETTING_PSYCHIC_VIEW_TWO_CARDS: "Sannolikhet att få titta på två kort",
		UI_SETTING_RIPPLE: "Krusning i rum-tid",
		UI_SETTING_RIPPLE_DOUBLE_VOTE: "Vissa spelare får lägga två röster",
		UI_SETTING_RIPPLE_DRUNK: "En spelare byter sitt kort mot ett av mittenkorten",
		UI_SETTING_RIPPLE_DUAL_VIEW_PLAYER: "Två spelare får se på en annan spelares kort",
		UI_SETTING_RIPPLE_INSOMNIAC: "Vissa spelare tittar på sina kort efter natten",
		UI_SETTING_RIPPLE_MUTED: "Vissa spelare får inte prata",
		UI_SETTING_RIPPLE_NONE: "Ingenting händer",
		UI_SETTING_RIPPLE_ONE_MINUTE: "Speltid reducerad till 1 minut",
		UI_SETTING_RIPPLE_REBUKED: "Vissa spelare måste vända sig bort",
		UI_SETTING_RIPPLE_REVEALER: "En spelare får vända på en spelares kort",
		UI_SETTING_RIPPLE_ROBBER: "En spelare får stjäla en annan spelares kort",
		UI_SETTING_RIPPLE_TROUBLEMAKER: "En spelare byter plats på två andra spelare",
		UI_SETTING_RIPPLE_VIEW_PLAYER: "En spelare får se på en annan spelares kort",
		UI_SETTING_RIPPLE_WITCH: "En spelare får se på ett mittenkort och ge kortet till någon spelare",
		UI_SETTING_VIEW_CARD_CENTER_FOUR: "Fyra mittenkort",
		UI_SETTING_VIEW_CARD_CENTER_ONE: "Ett mittenkort",
		UI_SETTING_VIEW_CARD_CENTER_THREE: "Tre mittenkort",
		UI_SETTING_VIEW_CARD_CENTER_TWO: "Två mittenkort",
		UI_SETTING_VIEW_CARD_PLAYER_ANY: "Valfri spelare",
		UI_SETTING_VIEW_CARD_PLAYER_EVEN: "Jämn spelare",
		UI_SETTING_VIEW_CARD_PLAYER_NEIGHBOR: "Granne",
		UI_SETTING_VIEW_CARD_PLAYER_NEIGHBOR_BOTH: "Båda grannar",
		UI_SETTING_VIEW_CARD_PLAYER_ODD: "Udda spelare",
		UI_SETTING_VIEW_CARD_PLAYER_SELF: "Sitt eget",
		UI_SETTING_VIEW_CARD_PLAYER_SPECIFIC: "Specifik spelare",
		UI_TITLE: "One Night Ultimate Werewolf – Promptbyggare",
		UI_WINCONDITION_APPRENTICEASSASSIN: "Vinner om {ROLE_ASSASSIN_DEFINITE} röstas ut, eller om den utvalda måltavlan röstas ut om ingen {ROLE_ASSASSIN} är i spel.",
		UI_WINCONDITION_APPRENTICETANNER: "Vinner om {ROLE_TANNER_DEFINITE} röstas ut, eller om {ROLE_APPRENTICETANNER_DEFINITE} röstas ut om ingen {ROLE_TANNER} är i spel.",
		UI_WINCONDITION_ASSASSIN: "Vinner om den utvalda måltavlan röstas ut.",
		UI_WINCONDITION_BLOB: "Vinner om varken {ROLE_BLOB_DEFINITE} själv eller någon av spelarna den måste skydda röstas ut.",
		UI_WINCONDITION_DOPPELGANGER: "{UI_WINCONDITION_TEAM_VILLAGE} Om {ROLE_DOPPELGANGER_DEFINITE} kopierar en annan roll gäller istället samma vinstvilkor som för rollen som kopierades.",
		UI_WINCONDITION_FEUDINGALIENS: "Om endast en av dem är i spel vinner de tillsammans med {TEAM_ALIEN}. Om båda är i spel vinner den ena om den andra röstas ut.",
		UI_WINCONDITION_LEADER: "Om både {ROLE_FEUDINGALIENS_DEFINITE} är i spel så vinner {ROLE_LEADER_DEFINITE} om {ROLE_FEUDINGALIENS_DEFINITE} båda överlever. Annars vinner {ROLE_LEADER_DEFINITE} tillsammans med {TEAM_VILLAGE_DEFINITE}.",
		UI_WINCONDITION_MINION: "Om minst en {TEAM_WEREWOLF} är i spel vinner {ROLE_MINION_DEFINITE} om ingen {TEAM_WEREWOLF} röstas ut, även om {ROLE_MINION_DEFINITE} själv blir utröstad. Om ingen {TEAM_WEREWOLF} är i spel vinner {ROLE_MINION_DEFINITE} om minst en annan spelare röstas ut.",
		UI_WINCONDITION_MORTICIAN: "Vinner om en av {ROLE_MORTICIAN_DEFINITE} grannar röstas ut.",
		UI_WINCONDITION_PARANORMALINVESTIGATOR: "{UI_WINCONDITION_TEAM_VILLAGE} Om {ROLE_PARANORMALINVESTIGATOR_DEFINITE} under natten ser en roll som inte tillhör {TEAM_VILLAGE_DEFINITE} så gäller den rollens vinstvilkor även för {ROLE_PARANORMALINVESTIGATOR_DEFINITE}.",
		UI_WINCONDITION_PREFIX: "Vinstvilkor",
		UI_WINCONDITION_RENFIELD: "Om minst en {TEAM_VAMPIRE} är i spel vinner {ROLE_RENFIELD_DEFINITE} om ingen {TEAM_VAMPIRE} röstas ut, även om {ROLE_RENFIELD_DEFINITE} själv blir utröstad. Om ingen {TEAM_VAMPIRE} är i spel vinner {ROLE_RENFIELD_DEFINITE} tillsammans med {TEAM_VILLAGE_DEFINITE}.",
		UI_WINCONDITION_SQUIRE: "Om minst en {TEAM_WEREWOLF} är i spel vinner {ROLE_SQUIRE_DEFINITE} om ingen {TEAM_WEREWOLF} röstas ut, även om {ROLE_SQUIRE_DEFINITE} själv blir utröstad. Om ingen {TEAM_WEREWOLF} är i spel vinner {ROLE_SQUIRE_DEFINITE} om minst en annan spelare röstas ut.",
		UI_WINCONDITION_SYNTHETICALIEN: "Vinner om {ROLE_SYNTHETICALIEN_DEFINITE} röstas ut.",
		UI_WINCONDITION_TANNER: "Vinner om {ROLE_TANNER_DEFINITE} röstas ut.",
		UI_WINCONDITION_TEAM_ALIEN: "Vinner om ingen {TEAM_ALIEN} röstas ut.",
		UI_WINCONDITION_TEAM_VAMPIRE: "Vinner om ingen {TEAM_VAMPIRE} röstas ut.",
		UI_WINCONDITION_TEAM_VILLAGE: "Vinner om minst en {TEAM_WEREWOLF}, {TEAM_VAMPIRE} eller {TEAM_ALIEN} röstas ut.",
		UI_WINCONDITION_TEAM_WEREWOLF: "Vinner om ingen {TEAM_WEREWOLF} röstas ut.",
		UI_WINCONDITION_VARIABLE_NOTE: "Kortets vinstvilkor kan förändras, som vid kopiering av en annan roll.",		
	},
};

LOCALIZATION.SWE.UI_RULES_FULL = `
<h2>Spelregler – One Night Ultimate Werewolf</h2>

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
	<li>Vissa roller tittar på kort, vissa byter kort, vissa får iakta andra spelare göra något, och vissa gör ingenting.</li>
	<li>Om en roll inte är med i spelet hoppas den fasen över. Dock ska de oanvända rollerna i mitten också få instruktioner för att förhindra spelare från att veta vilka de är.</li>
	<li>Spelare som vaknar samtidigt får inte kommunicera mer än nödvändigt för att utföra sin handling.</li>
</ul>
<p>
	Det är viktigt att komma ihåg att <strong>kort kan byta plats under natten</strong>, och att en spelares ursprungliga roll inte nödvändigtvis är densamma som deras slutliga roll.
	Oavsett hur kort flyttas följer spelare instruktionerna som ges baserat på den information den har; om en spelare har fått sitt kort flyttat och därmed en ny roll kommer denna fortfarande att utföra sin ursprungliga rolls handling under natten.
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
	Beroende på roller som används kan flera lag vinna av olika anledningar om deras vinstvilkor har uppfyllts.
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
</ul>
`;

LOCALIZATION.ENG.UI_RULES_FULL = `
<h2>Game Rules – One Night Ultimate Werewolf</h2>

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
</ul>
`;


function saveLanguage(lang) {
    localStorage.setItem("onuww_lang", lang);
}

function loadLanguage() {
    return localStorage.getItem("onuww_lang") || "ENG";
}

function setLocalizationLanguage(lang) {
	LANG = lang;
	saveLanguage(lang);
}

function getLocKeysWith(pattern) {
	return Object.keys(LOCALIZATION[LANG]).filter(k => k.includes(pattern));
}

function hasLoc(key) {
	return LOCALIZATION[LANG][key] ? true : false;
}

function parseTemplateArg(value) {
    value = value.trim();

    if (value === "") return "";
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (value === "undefined") return undefined;

    // Quoted strings
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }

    // Safer number parsing
    if (/^-?\d+(\.\d+)?$/.test(value)) {
        return Number(value);
    }

    return value;
}

function resolveTemplate(text, ctx = null, funcs = null) {
    let prev;
    let iterations = 0;
    const MAX_ITER = 10;

    do {
        prev = text;

        text = text.replace(/\{(.*?)\}/g, (_, raw) => {
            const parts = raw.split(":");
            const key = parts[0].trim();

            const args = parts.length > 1
                ? parts[1].split(",").map(a => parseTemplateArg(a.trim()))
                : [];

            // 1. Template function (only if ctx + funcs exist)
            if (ctx && funcs && typeof funcs[key] === "function") {
                try {
                    return funcs[key](ctx, ...args) ?? "";
                } catch (e) {
                    console.warn("Template function error:", key, e);
                    return "";
                }
            }

            // 2. Localization fallback
            if (hasLoc(key)) {
                return Loc(key, ctx, funcs);
            }

            // 3. Failure
            console.warn("Missing template key:", key);
			console.warn(ctx);
			console.warn(funcs)
            return "UNDEF: " + key;
        });

        iterations++;
        if (iterations > MAX_ITER) {
            console.warn("Template resolution exceeded max depth:", text);
            break;
        }

    } while (text !== prev);

	return normalizeSentences(
		text
			.replace(/\s+/g, " ")
			.replace(/\s([.,])/g, "$1")
			.trim()
	);
}

function normalizeSentences(text) {
    return text.replace(/([.!?])\s*(\p{L})/gu, (_, punct, letter) => {
        return punct + " " + letter.toUpperCase();
    });
}

function Loc(key, ctx = null, funcs = null) {
    const langTable = LOCALIZATION[LANG];
    const fallbackTable = LOCALIZATION.ENG;

    let text = langTable?.[key];

    if (!text) {
        console.warn(`Undefined localization key: ${key} (language: ${LANG})`);
        text = fallbackTable?.[key] ?? `UNDEF: ${key}`;
    }

    return resolveTemplate(text, ctx, funcs);
}

function Loc_SC(key, ctx = null, funcs = null) {
    const text = Loc(key, ctx, funcs);
    if (!text || !text[0]) return text;
    return text[0].toUpperCase() + text.slice(1);
}
