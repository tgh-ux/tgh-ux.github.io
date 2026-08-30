const TTSManifest = (() => {
	
	/* =========================
	   Data
	   ========================= */

    let _map = null;   // normalized key -> file path
	
	const manifest = {
		"Du kan titta på en annan spelares kort, eller två av mittenkorten.": "seer_action.mp3",
	};


	/* =========================
	   Initialization
	   ========================= */

	function _init() {
		_map = new Map();

		for (const [key, value] of Object.entries(manifest)) {
			_map.set(_normalizeKey(key), value);
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



    return {
		lookup,
	};
	
})();