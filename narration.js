/*
 * Automatic narration and input handling.
 *
 * Consumes NarrationData produced by Interpreter.compileTurn()/compileAll().
 *
 * AutoNarrator is deliberately unaware of how narration is structured beyond the small set of node types it needs
 * to execute. It asks Interpreter to evaluate the current turn only when that turn is reached, using the values
 * accumulated from earlier inputs.
 *
 * The Interpreter is also responsible for the final language rendering. For content nodes it returns both the
 * localized text and the structural source information that produced it. TTSManifest uses that source information
 * to select pre-recorded clips; if complete clip coverage is unavailable, the full rendered text is synthesized.
 */

const AutoNarrator = (() => {

	/* =========================
	   Data
	   ========================= */

	// Silent gap after a turn completes, before the next turn starts.
	const INTER_TURN_GAP_SECONDS = 2;

	// Default gap between adjacent spoken sentences when no explicit pause/input already separates them.
	const SENTENCE_GAP_SECONDS = 0.75;

	// Bumped whenever a session starts or stops, invalidating callbacks belonging to an older session.
	let _generation = 0;

	let _active = false;
	let _paused = false;

	// Timer currently handling a pause/input countdown.
	let _pendingTimer = null;

	/*
	 * Current execution phase:
	 *   null      - idle
	 *   waiting   - _wait owns the current countdown
	 *   speaking  - either _activeAudio or speechSynthesis owns playback
	 */
	let _phase = null;

	/*
	 * State for the current wait. remainingMs is maintained explicitly so pause()/resume() can suspend and continue
	 * from the same point rather than restarting the whole wait.
	 */
	let _wait = null;

	// Current AudioAtlas playback handle, if the active narration is using a recording.
	let _activeAudio = null;

	// Standalone announcements are independent of a narration session.
	let _announcementAudio = null;

	// Values bound by resolved input nodes. They belong to the current play() session rather than an individual turn.
	let _boundValues = {};

	/*
	 * Callback installed while an input is waiting. selectInput() calls this without needing to know which narration
	 * node is currently active.
	 */
	let _pendingInputSelect = null;

	const _NOOP_CALLBACKS = {
		onSpeaking: () => {},
		onPause: () => {},
		onTurnComplete: () => {},
		onFinished: () => {},
		onInputStart: () => {},
		onInputCountdown: () => {},
		onInputResolved: () => {},
	};


	/* =========================
	   Initialization
	   ========================= */

	function _init() {
		
	}
	
	_init();


	/* =========================
	   Private functions
	   ========================= */

	function _playAtlasClip(name, onDone, onError) {
		return AudioAtlas.play(name, onDone, onError);
	}

	/*
	 * Plays a complete recording sequence as one logical narration unit.
	 *
	 * If any clip fails, the complete rendered text is synthesized from the beginning. This preserves the
	 * all-or-nothing behavior of TTSManifest.lookup() and avoids switching from recorded audio to synthesis halfway
	 * through a sentence.
	 */
	function _playClipSequence(names, text, generation, onDone) {
		let index = 0;

		const playNext = () => {
			if (generation !== _generation)
				return;

			if (index >= names.length) {
				onDone();
				return;
			}

			const name = names[index++];

			_activeAudio = _playAtlasClip(name, () => {
					if (generation !== _generation)
						return;

					_activeAudio = null;
					playNext();
				},
				() => {
					console.warn("Clip playback failed, falling back to speech synthesis:", name);
					_activeAudio = null;

					if (generation === _generation)
						_speakTextAsUtterance(text, generation, onDone);
				}
			);
		};

		playNext();
	}

	function _speakTextAsUtterance(text, generation, onDone) {
		if (!("speechSynthesis" in window)) {
			console.warn("Speech synthesis is not supported; unable to speak:", text);

			if (generation === _generation)
				onDone();

			return;
		}

		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = _langTag();
		const voice = _pickVoice(utterance.lang);

		if (voice)
			utterance.voice = voice;

		utterance.onend = () => { 
			if (generation === _generation) onDone();
		};
		utterance.onerror = event => {
			console.warn("Speech synthesis error:", event.error);

			if (generation === _generation)
				onDone();
		};

		window.speechSynthesis.speak(utterance);
	}

	/*
	 * Plays one localized sentence returned by Interpreter.renderContent().
	 *
	 * The text is what the GUI displays and what synthesis would speak.
	 * The source is what TTSManifest uses to select recordings.
	 */
	function _playRenderedSentence(rendered, generation, onDone) {
		_phase = "speaking";

		if (!rendered?.text) {
			onDone();
			return;
		}

		const source = Array.isArray(rendered.source) ? rendered.source : [];
		const names = source.length > 0 ? TTSManifest.lookup(source) : null;

		if (names && names.length > 0) {
			_playClipSequence(names, rendered.text, generation, onDone);
			return;
		}

		_speakTextAsUtterance(rendered.text, generation, onDone);
	}

	/*
	 * Renders one content node and plays its sentences in order.
	 *
	 * Sentence splitting is performed by Interpreter, not by AutoNarrator. AutoNarrator therefore never needs to know
	 * anything about the current language's sentence-boundary rules.
	 */
	function _playContentNode(node, generation, callbacks, onDone) {
		let sentences;

		try {
			sentences = Interpreter.renderContent(node);
		} catch (error) {
			console.error("Failed to render narration content:", error);
			const text = `⚠ COULD NOT RENDER: ${error?.message ?? String(error)}`;
			callbacks.onSpeaking(text);
			_speakTextAsUtterance(text, generation, onDone);
			
			return;
		}

		if (sentences.length === 0) {
			onDone(false);
			return;
		}

		const playSentence = index => {
			if (generation !== _generation)
				return;

			if (index >= sentences.length) {
				onDone(true);
				return;
			}

			const sentence = sentences[index];
			callbacks.onSpeaking(sentence.text);
			_playRenderedSentence(sentence, generation, () => {
				if (generation !== _generation)
					return;

				if (index + 1 < sentences.length) {
					_startWait(SENTENCE_GAP_SECONDS, generation, () => {}, () => playSentence(index + 1));
				} else {
					onDone(true);
				}
			});
		};

		playSentence(0);
	}

	/*
	 * True if value matches one of node's own option values - checked both by identity (Object.is) and by string
	 * form, since a selection relayed through the GUI may come back as a string even when the option's own value
	 * is a number (or vice versa).
	 */
	function _isInputValueAllowed(node, value) {
		return node.options.some(option => Object.is(option.value, value) || String(option.value) === String(value));
	}

	/*
	 * Runs one input node to completion: renders its prompt/options, waits up to node.timeoutSeconds for a
	 * selection via selectInput(), then resolves the continuation and resumes playback from the same node index.
	 *
	 * _pendingInputSelect is installed before rendering (not after), so a selection arriving while the input is
	 * still being rendered is never lost. If rendering itself throws, playback isn't left stuck: the node's own
	 * defaultValue is used immediately, exactly as if the countdown had expired unanswered.
	 *
	 * On resolution, the input node is spliced out of `nodes` and replaced in place by its continuation, then
	 * _playNodes resumes at the same nodeIndex - so a continuation that itself contains another input runs through
	 * this exact same path, with no special-casing for nesting.
	 */
	function _playInput(narration, nodes, nodeIndex, node, generation, callbacks, onNodesComplete) {
		let selected = null;

		_pendingInputSelect = value => {
			if (_isInputValueAllowed(node, value)) {
				selected = value;
			}
		};

		let renderedInput;

		try {
			renderedInput = Interpreter.renderInput(node);
		} catch (error) {
			console.error("Failed to render input:", error);
			_pendingInputSelect = null;
			// Continue with the node's default rather than leaving narration permanently stuck.
			const value = node.defaultValue;
			_boundValues[node.field] = value;
			callbacks.onInputResolved(node.field, value);
			const continuation = Interpreter.resolveInput(narration, node, value, _boundValues);
			nodes.splice(nodeIndex, 1, ...continuation);
			_playNodes(narration, nodes, nodeIndex, generation, callbacks, onNodesComplete);

			return;
		}

		callbacks.onInputStart(renderedInput.field, renderedInput.options);

		_startWait(node.timeoutSeconds, generation, callbacks.onInputCountdown, () => {
			_pendingInputSelect = null;
			const value = selected ?? node.defaultValue;
			_boundValues[node.field] = value;
			callbacks.onInputResolved(node.field, value);
			let continuation;

			try {
				continuation = Interpreter.resolveInput(narration, node, value, _boundValues);
			} catch (error) {
				console.error("Failed to resolve input continuation:", error);
				continuation = [];
			}

			/*
			 * Replace the input node with its continuation and resume at the same index.
			 * This gives nested inputs exactly the same execution path as the outer input.
			 */
			nodes.splice(nodeIndex, 1, ...continuation);
			_playNodes(narration, nodes, nodeIndex, generation, callbacks, onNodesComplete);
		});
	}

	function _playNodes(narration, nodes, nodeIndex, generation, callbacks, onComplete) {
		if (generation !== _generation)
			return;

		if (nodeIndex >= nodes.length) {
			onComplete();
			return;
		}

		const node = nodes[nodeIndex];

		switch (node.type) {
			case "content": {
				_playContentNode(node, generation, callbacks, hadContent => {
					if (generation !== _generation)
						return;

					const next = nodes[nodeIndex + 1];

					if (hadContent && next?.type === "content") {
						_startWait(SENTENCE_GAP_SECONDS, generation, () => {}, () => _playNodes(narration, nodes, nodeIndex + 1, generation, callbacks, onComplete));
					} else {
						_playNodes(narration, nodes, nodeIndex + 1, generation, callbacks, onComplete);
					}
				});
				return;
			}

			case "pause":
				_startWait(node.duration, generation, callbacks.onPause, () => _playNodes(narration, nodes, nodeIndex + 1, generation, callbacks, onComplete));
				return;

			case "input":
				_playInput(narration, nodes, nodeIndex, node, generation, callbacks, onComplete);
				return;

			case "break":
				// A break is an explicit structural boundary but carries no delay of its own.
				_playNodes(narration, nodes, nodeIndex + 1, generation, callbacks, onComplete);
				return;

			default:
				console.warn("_playNodes: Unknown narration node type:", node.type);
				_playNodes(narration, nodes, nodeIndex + 1, generation, callbacks, onComplete);
		}
	}

	function _formatTurnError(narration, error) {
		return `⚠ COULD NOT RENDER [${narration.action ?? "?"} / ${narration.instigator ?? "?"}]: ${error?.message ?? String(error)}`;
	}

	function _playTurn(narrations, turnIndex, generation, callbacks) {
		if (generation !== _generation)
			return;

		if (turnIndex >= narrations.length) {
			_active = false;
			_phase = null;
			callbacks.onFinished();
			return;
		}

		const narration = narrations[turnIndex];
		let nodes;

		try {
			/*
			 * This is deliberately evaluated here, rather than when play() starts. Any values bound by earlier
			 * input nodes are therefore visible to this turn.
			 */
			nodes = Interpreter.getNodes(narration, "automatic", _boundValues);
		} catch (error) {
			console.error("Failed to resolve narration turn:", error);
			const text = _formatTurnError(narration, error);
			callbacks.onSpeaking(text);

			_speakTextAsUtterance(text, generation, () => {
				if (generation !== _generation) {
					return;
				}

				callbacks.onTurnComplete(turnIndex);
				_startWait(INTER_TURN_GAP_SECONDS, generation, () => {}, () => _playTurn(narrations, turnIndex + 1, generation, callbacks));
			});

			return;
		}

		_playNodes(narration, nodes, 0, generation, callbacks, () => {
			if (generation !== _generation)
				return;

			callbacks.onTurnComplete(turnIndex);
			_startWait(INTER_TURN_GAP_SECONDS, generation, () => {}, () => _playTurn(narrations, turnIndex + 1, generation, callbacks));
		});
	}

	/*
	 * Starts a countdown of `duration` seconds, reporting the remaining time via onPause as it counts down and
	 * calling onDone once it reaches zero. Used for both narration pauses and input timeouts - the two cases
	 * differ only in what onPause/onDone do.
	 */
	function _startWait(duration, generation, onPause, onDone) {
		_phase = "waiting";
		_wait = { remainingMs: Math.max(0, duration * 1000), generation, onPause, onDone, stepStartedAt: Date.now() };
		onPause(_wait.remainingMs / 1000 );
		_scheduleWaitStep();
	}

	/*
	 * Advances the current wait by one step (at most 100ms), then reschedules itself until _wait.remainingMs
	 * reaches zero or the wait is abandoned (a new generation, or _wait itself replaced/cleared).
	 *
	 * Stepped rather than a single setTimeout for the full duration so pause() can suspend with sub-100ms
	 * accuracy at any point, and so onPause can report a live countdown rather than only firing once at the end.
	 */
	function _scheduleWaitStep() {
		if (!_wait || _wait.generation !== _generation || _paused) {
			return;
		}

		const stepMs = Math.min(100, _wait.remainingMs);
		_wait.stepStartedAt = Date.now();

		_pendingTimer = setTimeout(() => {
				_pendingTimer = null;

				if (!_wait || _wait.generation !== _generation) {
					return;
				}

				_wait.remainingMs = Math.max(0, _wait.remainingMs - stepMs);

				if (_wait.remainingMs <= 0) {
					const onDone = _wait.onDone;
					_wait.onPause(0);
					_phase = null;
					_wait = null;
					onDone();
					return;
				}

				_wait.onPause(_wait.remainingMs / 1000);
				_scheduleWaitStep();
			},
			stepMs
		);
	}

	
	/*
	 * Selects the preferred voice used for browser synthesis. Currently lacks an interface with the user, and
	 * only Swedish has a specifically preferred voice ("Sofie"); other languages fall back to whatever voice the
	 * browser picks as its own default for utterance.lang.
	 */
	function _pickVoice(langTag) {
		if (langTag !== "sv-SE")
			return null;

		const voices = window.speechSynthesis.getVoices();

		return voices.find(voice => voice.lang === "sv-SE" && voice.name.includes("Sofie")) ?? null;
	}

	function _langTag() {
		return Localization.getLanguage() === "SWE" ? "sv-SE" : "en-US";
	}

	/*
	 * Clears all narration-session state and stops anything it owns (a pending wait timer, an in-progress clip,
	 * or speech synthesis) so a new play() starts from a clean slate. Announcement playback is untouched - see
	 * playAnnouncement - since announcements are independent of a narration session.
	 */
	function _reset() {
		_generation++;

		_active = false;
		_paused = false;
		_phase = null;
		_wait = null;

		_pendingInputSelect = null;

		if (_pendingTimer !== null) {
			clearTimeout(_pendingTimer);
			_pendingTimer = null;
		}

		if (_activeAudio) {
			_activeAudio.pause();
			_activeAudio = null;
		}

		window.speechSynthesis?.cancel();
	}

	function _playAnnouncementClipSequence(names, text) {
		let index = 0;

		const playNext = () => {
			if (index >= names.length) {
				return;
			}

			const name = names[index++];

			const handle = _playAtlasClip( name, () => {
					if (_announcementAudio === handle) {
						_announcementAudio = null;
					}

					playNext();
				},
				() => {
					console.warn("Announcement clip playback failed, falling back to speech synthesis:", name);

					if (_announcementAudio === handle) {
						_announcementAudio = null;
					}

					_speakAnnouncementText(text);
				}
			);

			_announcementAudio = handle;
		};

		playNext();
	}

	function _speakAnnouncementText(text) {
		if (!("speechSynthesis" in window)) {
			console.warn("Unable to play announcement: speech synthesis is not supported.");
			return;
		}

		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = _langTag();
		const voice = _pickVoice(utterance.lang);

		if (voice)
			utterance.voice = voice;

		window.speechSynthesis.speak(utterance);
	}


	/* =========================
	   Public functions
	   ========================= */

	/*
	 * Returns whether this browser has at least one narration backend available.
	 *
	 * Speech synthesis is optional because a complete narration can consist entirely of pre-recorded clips.
	 */
	function isSupported() {
		return ("speechSynthesis" in window || typeof AudioAtlas?.play === "function");
	}

	function isActive() {
		return _active;
	}

	function isPaused() {
		return _paused;
	}

	function pause() {
		if (!_active || _paused)
			return;

		_paused = true;

		if (_phase === "waiting" && _wait) {
			if (_pendingTimer !== null) {
				clearTimeout(_pendingTimer);
				_pendingTimer = null;
			}

			_wait.remainingMs = Math.max(0, _wait.remainingMs - (Date.now() - _wait.stepStartedAt));

			return;
		}

		if (_phase === "speaking" && _activeAudio) { _activeAudio.pause(); return; }
		if (_phase === "speaking" && "speechSynthesis" in window) { window.speechSynthesis.pause(); return; }
	}

	function resume() {
		if (!_active || !_paused)
			return;

		_paused = false;

		if (_phase === "waiting") { _scheduleWaitStep(); return; }
		if (_phase === "speaking" && _activeAudio) { _activeAudio.play(); return; }
		if (_phase === "speaking" && "speechSynthesis" in window) { window.speechSynthesis.resume(); return; }
	}

	/*
	 * Plays precompiled NarrationData from the beginning.
	 *
	 * NarrationData is not modified by AutoNarrator. Temporary node arrays are created from each turn when that turn
	 * is reached, allowing input continuations to be inserted without mutating the GUI's canonical narration data.
	 */
	function play(narrations, callbacks = {}) {
		if (!isSupported()) {
			console.warn("No narration playback backend is available.");
			return;
		}

		_reset();

		if (!Array.isArray(narrations) || narrations.length === 0) {
			return;
		}

		_active = true;
		_boundValues = {};
		const mergedCallbacks = { ..._NOOP_CALLBACKS, ...callbacks };
		_playTurn(narrations, 0, _generation, mergedCallbacks);
	}

	function stop() {
		_reset();
	}

	function selectInput(value) {
		if (_pendingInputSelect)
			_pendingInputSelect(value);
	}

	/*
	 * Plays a standalone announcement (e.g. the game timer's "X seconds left" / "time's up") - a short clip
	 * outside of any narration session, with no play/pause/stop of its own since it's always brief: one clip
	 * sequence, or one synthesized utterance, covering the whole thing - never split or reported back to the GUI.
	 *
	 * Announcement keys are plain localization strings with no {...} templates of their own (unlike PROMPT_ keys),
	 * so this reads key's literal spans directly via Localization.parseTemplate() rather than going through
	 * Interpreter - there's no turn data or expression resolution involved. Each span's own (key,index) is exactly
	 * the ref TTSManifest.lookup() matches against (see ttsmanifest.js's own MANIFEST comment on what a ref is).
	 *
	 * A stray {...} expression in key's template can't be resolved here without Interpreter, so it's dropped with
	 * a warning rather than left as raw unresolved text - announcement keys aren't expected to have one, but this
	 * keeps that case visible instead of silently wrong if one's ever added.
	 */
	function playAnnouncement(key) {
		if (!key)
			return;

		const nodes = Localization.parseTemplate(key);

		if (!nodes) {
			console.warn("playAnnouncement: unknown localization key:", key);
			return;
		}

		const spans = nodes.filter(node => node.type === "span");

		if (spans.length < nodes.length) {
			console.warn("playAnnouncement: key contains a {...} expression, which isn't supported here - only its literal text will be spoken:", key);
		}

		if (spans.length === 0)
			return;

		const text = Localization.normalizeText(spans.map(span => span.text).join(""));
		const source = spans.map(span => ({ ref: { type: "span", key: span.key, index: span.index } }));
		const names = TTSManifest.lookup(source);

		if (names && names.length > 0) {
			_playAnnouncementClipSequence(names, text);
			return;
		}

		_speakAnnouncementText(text);
	}

	// Debug helper for testing a sequence of known AudioAtlas clips.
	function debugPlay(names) {
		if (!Array.isArray(names) || names.length === 0) {
			return;
		}

		_reset();
		_active = true;
		const generation = _generation;

		_playClipSequence(names, "", generation, () => {
			if (generation !== _generation) {
				return;
			}

			_active = false;
			_phase = null;
			_activeAudio = null;
		});
	}

	return {
		isSupported,
		isActive,
		isPaused,
		play,
		pause,
		resume,
		stop,
		selectInput,
		playAnnouncement,
		debugPlay,
	};

})();