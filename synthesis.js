/*
 * Browser speech synthesis backend, via the Web Speech API.
 *
 * This is the fallback narration backend - used whenever Clips has no recording for the current language, or
 * no coverage for a specific sentence, or a clip fails at runtime mid-playback. Has no knowledge of narration
 * structure, clips, or manifests; it only ever receives a flat string to read aloud. Not called directly
 * outside Narration - that's the only intended caller.
 *
 * This module exists as a clean swap point: if browser synthesis quality ever stops being good enough (it's
 * the reason clip recordings exist at all) and a better TTS option shows up - a hosted API, a bundled library -
 * replacing this file with one implementing the same speak()/isSupported() shape is the entire migration;
 * Narration and Clips are both written to know nothing about how speech gets synthesized.
 */
const Synthesis = (() => {

	/* =========================
	   Private functions
	   ========================= */

	function _langTag() {
		return Localization.getLanguage() === "SWE" ? "sv-SE" : "en-US";
	}

	/*
	 * Selects the preferred voice used for browser synthesis. Currently lacks any interface with the user, and
	 * only Swedish has a specifically preferred voice ("Sofie"); other languages fall back to whatever voice
	 * the browser itself picks as default for utterance.lang.
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

	/*
	 * Whether this browser supports speech synthesis at all. Narration checks this (alongside Clips.isAvailable())
	 * to decide whether narration has any backend to speak through.
	 */
	function isSupported() {
		return "speechSynthesis" in window;
	}

	/*
	 * Speaks `text` via browser speech synthesis, returning a { pause(), resume(), stop() } handle forwarding to
	 * speechSynthesis. Always a full utterance - there's no partial-clip-then-synthesis mixing here, or any
	 * other awareness of clips at all; by the time this is called, Narration has already decided synthesis is
	 * what's speaking this sentence.
	 */
	function speak(text, { onDone }) {
		if (!isSupported()) {
			console.warn("Synthesis: speech synthesis is not supported; unable to speak:", text);
			onDone();
			return { pause() {}, resume() {}, stop() {} };
		}

		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = _langTag();
		const voice = _pickVoice(utterance.lang);

		if (voice)
			utterance.voice = voice;

		utterance.onend = () => onDone();
		utterance.onerror = event => {
			console.warn("Synthesis: speech synthesis error:", event.error);
			onDone();
		};

		window.speechSynthesis.speak(utterance);

		return {
			pause()  { window.speechSynthesis.pause(); },
			resume() { window.speechSynthesis.resume(); },
			stop()   { window.speechSynthesis.cancel(); },
		};
	}

	return {
		isSupported,
		speak,
	};
})();
