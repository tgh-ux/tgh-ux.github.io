/*
 * Browser speech synthesis backend via the Web Speech API.
 *
 * This is the fallback narration backend. It receives plain text and speaks it using the browser's speech synthesis engine; it has no
 * knowledge of clips, manifests, or narration structure.
 *
 * Narration is the only intended caller. The public API is deliberately small so the backend can be replaced later without changing
 * Narration or ClipPlayback.
 */
const Synthesis = (() => {


	/* =========================
	   Data
	   ========================= */

	/*
	 * Holds the utterance currently being spoken.
	 *
	 * Keeping a reference is necessary for browsers such as Chrome, which may otherwise garbage-collect an utterance before its
	 * completion/error events are delivered.
	 */
	let _activeUtterance = null;
	
	/*
	 * Fallback watchdog for speech synthesis. Normally speak() advances through the Web Speech API's onend/onerror events, but some
	 * browsers may fail to deliver them and leave Narration waiting indefinitely. The watchdog gives an utterance a base amount of time
	 * plus additional time proportional to its length before assuming that has happened, cancelling synthesis and advancing via onDone().
	 */
	const WATCHDOG_BASE_TIMEOUT = 5000;
	const WATCHDOG_PER_CHARACTER_TIMEOUT = 200;


	/* =========================
	   Initialization
	   ========================= */

	function _init() {

	}

	_init();


	/* =========================
	   Private functions
	   ========================= */

	/**
	 * Returns the Web Speech API language tag for the active application language.
	 *
	 * @returns {string} `sv-SE` for Swedish, otherwise `en-US`.
	 */
	function _langTag() {
		return Localization.getLanguage() === "SWE" ? "sv-SE" : "en-US";
	}

	/**
	 * Selects the preferred browser voice for the given language.
	 *
	 * Swedish prefers a voice whose language is `sv-SE` and whose name contains "Sofie". Other languages return null and allow the browser
	 * to choose its default voice.
	 *
	 * @param {string} langTag - Web Speech API language tag.
	 * @returns {SpeechSynthesisVoice|null} Preferred voice, or null when no specific voice is preferred or available.
	 */
	function _pickVoice(langTag) {
		if (langTag !== "sv-SE")
			return null;

		const voices = window.speechSynthesis.getVoices();

		return voices.find(voice => voice.lang === "sv-SE" && voice.name.includes("Sofie")) ?? null;
	}


	/* =========================
	   Public functions
	   ========================= */

	/**
	 * Returns whether the browser provides the Web Speech API.
	 *
	 * @returns {boolean} True when browser speech synthesis is available.
	 */
	function isSupported() {
		return "speechSynthesis" in window;
	}

	/**
	 * Initializes the browser's speech-synthesis voice list.
	 *
	 * Calling getVoices() ahead of time helps ensure voices are available when speak() selects a preferred voice. Does nothing when speech
	 * synthesis is unsupported.
	 */
	function preload() {
		if (isSupported())
			window.speechSynthesis.getVoices();
	}

	/**
	 * Speaks a complete text string using the browser's speech synthesis API.
	 *
	 * The returned handle can be used to stop the current utterance. `onDone` is called once when synthesis finishes, is stopped,
	 * encounters an error, or fails to deliver an end event within the watchdog timeout.
	 *
	 * @param {string} text - Text to speak.
	 * @param {object} options - Completion callback options.
	 * @param {Function} options.onDone - Called when the utterance is finished or abandoned.
	 * @returns {{stop: Function}} Handle for stopping the active utterance.
	 */
	function speak(text, { onDone }) {
		let finished = false;
		let watchdog = null;

		function cleanup() {
			if (finished) return false;

			finished = true;
			clearTimeout(watchdog);

			if (_activeUtterance === utterance)
				_activeUtterance = null;

			return true;
		}

		if (!isSupported()) {
			console.warn("Synthesis: speech synthesis is not supported; unable to speak:", text);
			onDone();
			return { stop() {} };
		}

		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = _langTag();

		const voice = _pickVoice(utterance.lang);
		if (voice)
			utterance.voice = voice;

		function finish() {
			if (!cleanup()) return;

			onDone();
		}

		function stop() {
			if (!cleanup()) return;

			window.speechSynthesis.cancel();
		}

		utterance.onend = finish;

		utterance.onerror = event => {
			if (event.error !== "canceled" && event.error !== "interrupted")
				console.warn("Synthesis: speech synthesis error:", event.error);

			finish();
		};

		_activeUtterance = utterance;
		window.speechSynthesis.speak(utterance);

		watchdog = setTimeout(() => {
			if (!cleanup()) return;

			console.warn("Synthesis: no end event received; moving on:", text);
			window.speechSynthesis.cancel();
			onDone();
		}, WATCHDOG_BASE_TIMEOUT + text.length * WATCHDOG_PER_CHARACTER_TIMEOUT);

		return { stop };
	}

	return {
		isSupported,
		preload,
		speak,
	};
})();
