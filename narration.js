/*
 * Narration state, turn/input sequencing, and speech playback - the module the GUI drives to run a game script, and the sole caller of both
 * Synthesis and ClipPlayback (see the "Speech dispatch" section below for how a sentence is routed to one or the other).
 *
 * Consumes NarrationData produced by Interpreter.compileTurn()/compileAll().
 *
 * This module is deliberately unaware of how narration is structured beyond the small set of node types it needs to execute. It asks
 * Interpreter to evaluate the current turn only when that turn is reached, using the values accumulated from earlier inputs. It is equally
 * unaware of *how* a sentence ends up as sound: the "Speech dispatch" section is the one place that decides clips vs. synthesis and
 * normalizes both into the same { stop() } handle shape; everything above that section - turn sequencing, input handling, pause/resume, GUI
 * callbacks - only ever touches that handle, never Synthesis or ClipPlayback directly. That split is what a synthesis or clip backend swap
 * (see synthesis.js's own header) doesn't have to touch: as long as the replacement exposes the same speak()/isSupported() (Synthesis) or
 * resolve()/playSequence()/isAvailable() (ClipPlayback) shape, nothing below this file's own dispatch section changes.
 *
 * The Interpreter is also responsible for the final language rendering. For content nodes it returns both the localized text and the
 * structural source information that produced it; both are handed to the dispatch section, which is solely responsible for deciding whether
 * that source resolves to pre-recorded clips or falls back to synthesis, and for actually producing the sound either way.
 */
const Narration = (() => {

	/* =========================
	   Data
	   ========================= */

	// Silent gap after a turn completes before the next turn starts, in seconds.
	const INTER_TURN_GAP_SECONDS = 2;

	// DDefault gap between adjacent spoken sentences when no explicit pause or input already separates them, in seconds.
	const SENTENCE_GAP_SECONDS = 0.75;

	// Duration for which a narration error is displayed before playback continues, in seconds. Errors are displayed but never spoken.
	const ERROR_DISPLAY_SECONDS = 5;

	/*
	 * Maximum duration for which a standalone announcement may block other narration or announcements, in seconds. This prevents a backend
	 * that never reports completion from blocking playback indefinitely.
	 */
	const ANNOUNCEMENT_MAX_SECONDS = 25;

	/*
	 * Session-generation counter used to invalidate callbacks belonging to older narration sessions. The value is never reset; each new or
	 * stopped session increments it.
	 */
	let _generation = 0;
	
	/*
	 * Speech-operation counter used to invalidate callbacks from abandoned or replaced speech operations. The value is never reset so stale
	 * callbacks cannot become valid again after a session reset.
	 */
	let _speechToken = 0;

	/*
	 * State of the current narration session.
	 *
	 * This state is reset to the initial shape by _resetSession(). It is meaningful only while the current session is active; callbacks and
	 * timers use the generation/token values above to reject stale asynchronous work.
	 *
	 *   active             - True if a narration session is in progress.
	 *   paused             - True if the current narration session has been suspended by a caller.
	 *   phase              - Current execution phase.
	 *                          null      - idle.
	 *                          waiting   - a pause or input countdown is active.
	 *                          speaking  - an audio operation is active.
	 *   wait               - Current wait state, or null when no countdown is active. `remainingMs` is preserved when paused so the wait
	 *                        resumes from the same point rather than restarting.
	 *   currentSpeech      - Current logical speech operation, retained while paused so it can be replayed.
	 *   activeAudio        - Playback handle for the current speech operation. This has the common `{ stop() }` interface regardless of
	 *                        whether the underlying backend is recorded clips or speech synthesis.
	 *   pendingTimer       - Timer ID for the currently scheduled wait step, or null.
	 *   boundValues        - Values collected from resolved input nodes during the current play() session, keyed by input field name.
	 *   pendingInputSelect - Callback used to deliver a selection to the currently active input node, or null when no input is awaiting a
	 *                        selection.
	 */
	let _session = {
		active: false,
		paused: false,
		phase: null,
		// 
		wait: null,
		currentSpeech: null,
		activeAudio: null,
		pendingTimer: null,
		boundValues: {},
		pendingInputSelect: null,
	};

	/*
	 * State for the standalone announcement currently being played.
	 *
	 * Announcements are independent of the narration session and therefore are deliberately kept outside _session.
	 *
	 *   busyUntil - Timestamp after which new narration/announcements may be started. A timestamp rather than a boolean provides a bounded
	 *               fallback if playback never reports completion.
	 *   token     - Monotonically increasing token used to prevent an older announcement from clearing the busy state of a newer one.
	 */
	let _announcement = {
		busyUntil: 0,
		token: 0,
	};

	/*
	 * Default callbacks used when play() is called without corresponding handlers.
	 *
	 * Callers may override any of these callbacks in the `callbacks` argument to play().
	 */
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

	/** Initializes the narration module's session state. */
	function _init() {
		_resetSession();
	}

	/**
	 * Resets the current narration session to its initial idle state.
	 *
	 * Clears all session-specific playback, wait, input, and bound-value state. Lifetime invalidation counters and standalone announcement
	 * state are not reset.
	 */
	function _resetSession() {
		_session = {
			active: false,
			paused: false,
			phase: null,
			wait: null,
			currentSpeech: null,
			activeAudio: null,
			pendingTimer: null,
			boundValues: {},
			pendingInputSelect: null,
		};
	}

	_init();


	/* =========================
	   Private functions
	   ========================= */

	/**
	 * Speaks one rendered narration unit using recorded clips when available, otherwise falling back to speech synthesis.
	 *
	 * When a recorded sequence fails during playback, the complete unit is re-synthesized rather than mixing recorded and synthesized
	 * audio.
	 *
	 * @param {string} text - Text to synthesize if recordings are unavailable.
	 * @param {*} source - Structural source information used to resolve recordings.
	 * @param {Function} onDone - Called when playback of the unit finishes.
	 * @returns {{stop: Function}} Playback handle with a stop() method.
	 */
	function _dispatchSpeak(text, source, onDone) {
		if (!ClipPlayback.isAvailable()) {
			return Synthesis.speak(text, { onDone });
		}

		const names = ClipPlayback.resolve(source);

		if (!names) {
			return Synthesis.speak(text, { onDone });
		}

		let current = { stop() {} };
		const handle = { stop() { current.stop(); } };

		current = ClipPlayback.playSequence(names, {
			onDone,
			onError: name => {
				console.warn("Narration: clip playback failed at runtime, falling back to speech synthesis:", name);
				current = Synthesis.speak(text, { onDone });
			}
		});

		return handle;
	}

	/**
	 * Starts playback of one logical narration unit and associates it with the current session.
	 *
	 * The completion callback is ignored when either the session generation or speech token no longer matches, preventing stale
	 * asynchronous callbacks from advancing a newer narration state.
	 *
	 * @param {string} text - Text to speak.
	 * @param {*} source - Structural source information for recorded-clip lookup.
	 * @param {number} generation - Session generation the operation belongs to.
	 * @param {Function} onDone - Called when the operation finishes.
	 */
	function _speak(text, source, generation, onDone) {
		const token = ++_speechToken;

		_session.currentSpeech = { text, source, generation, onDone };

		_session.phase = "speaking";

		_session.activeAudio = _dispatchSpeak(text, source, () => {
			if (generation !== _generation || token !== _speechToken)
				return;

			_session.activeAudio = null;
			_session.currentSpeech = null;
			onDone();
		});
	}

	/**
	 * Returns whether a standalone announcement is currently blocking narration.
	 *
	 * @returns {boolean} True while the announcement busy period has not expired.
	 */
	function _isAnnouncementBusy() {
		return Date.now() < _announcement.busyUntil;
	}

	/**
	 * Plays one rendered sentence.
	 *
	 * An empty sentence is treated as already complete; otherwise it is passed to
	 * _speak() for backend selection and playback.
	 *
	 * @param {{text: string, source: *}} rendered - Rendered sentence and its source.
	 * @param {number} generation - Session generation the operation belongs to.
	 * @param {Function} onDone - Called when the sentence finishes.
	 */
	function _playRenderedSentence(rendered, generation, onDone) {
		if (!rendered?.text) {
			_session.phase = "speaking";
			onDone();
			return;
		}

		_speak(rendered.text, rendered.source, generation, onDone);
	}

	/**
	 * Renders and plays all sentences represented by one content node in order.
	 *
	 * Rendering errors are displayed for ERROR_DISPLAY_SECONDS before continuing. The completion callback receives true when at least one
	 * sentence was spoken, or false when the node produced no sentences.
	 *
	 * @param {Object} node - Narration content node.
	 * @param {number} generation - Session generation the operation belongs to.
	 * @param {Object} callbacks - Playback callbacks, including onSpeaking().
	 * @param {Function} onDone - Called with whether the node contained spoken content.
	 */
	function _playContentNode(node, generation, callbacks, onDone) {
		let sentences;

		try {
			sentences = Interpreter.renderContent(node);
		} catch (error) {
			console.error("Failed to render narration content:", error);
			const text = `⚠ COULD NOT RENDER: ${error?.message ?? String(error)}`;
			callbacks.onSpeaking(text);
			_startWait(ERROR_DISPLAY_SECONDS, generation, () => {}, onDone);

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

	/**
	 * Checks whether a selected input value matches one of the node's options.
	 *
	 * Values are accepted when either their identity or their string representation matches, allowing equivalent values returned through
	 * GUI controls to resolve correctly.
	 *
	 * @param {Object} node - Input narration node containing an options array.
	 * @param {*} value - Value to validate.
	 * @returns {boolean} True when the value matches an available option.
	 */
	function _isInputValueAllowed(node, value) {
		return node.options.some(option => Object.is(option.value, value) || String(option.value) === String(value));
	}

	/**
	 * Executes an input node until its selection is resolved, then replaces the node with its continuation and resumes execution at the
	 * same node index.
	 *
	 * The current input handler is installed before rendering so a selection cannot be lost while the input UI is being prepared.
	 * Unanswered or failed inputs use the node's defaultValue.
	 *
	 * @param {Object} narration - Current narration turn.
	 * @param {Array<Object>} nodes - Mutable node list for the current turn.
	 * @param {number} nodeIndex - Index of the input node in nodes.
	 * @param {Object} node - Input narration node.
	 * @param {number} generation - Session generation the operation belongs to.
	 * @param {Object} callbacks - Narration callbacks.
	 * @param {Function} onNodesComplete - Called when the current node sequence finishes.
	 */
	function _playInput(narration, nodes, nodeIndex, node, generation, callbacks, onNodesComplete) {
		function resolveInput(selected) {
			_session.pendingInputSelect = null;
			// Continue with the node's default rather than leaving narration permanently stuck.
			const value = selected ?? node.defaultValue;
			_session.boundValues[node.field] = value;
			callbacks.onInputResolved(node.field, value);
			let continuation;

			try {
				continuation = Interpreter.resolveInput(narration, node, value, _session.boundValues);
			} catch (error) {
				console.error("Failed to resolve input continuation:", error);
				continuation = [];
			}

			// Replace the input node with its continuation and resume at the same index. This gives nested inputs exactly the same execution path as the outer input.
			nodes.splice(nodeIndex, 1, ...continuation);
			_playNodes(narration, nodes, nodeIndex, generation, callbacks, onNodesComplete);
		}

		let selected = null;

		_session.pendingInputSelect = value => {
			if (_isInputValueAllowed(node, value)) {
				selected = value;
			}
		};

		let renderedInput;

		try {
			renderedInput = Interpreter.renderInput(node);
		} catch (error) {
			console.error("Failed to render input:", error);
			resolveInput();
			return;
		}

		callbacks.onInputStart(renderedInput.field, renderedInput.options);

		_startWait(node.timeoutSeconds, generation, callbacks.onInputCountdown, () => {
			resolveInput(selected);
		});
	}

	/**
	 * Executes narration nodes in sequence.
	 *
	 * Supports content, pause, input, and break nodes. Input continuations replace their input node in the same array so nested inputs
	 * follow the same execution path. Unknown node types are skipped with a warning.
	 *
	 * @param {Object} narration - Current narration turn.
	 * @param {Array<Object>} nodes - Mutable node list for the current turn.
	 * @param {number} nodeIndex - Index of the next node to execute.
	 * @param {number} generation - Session generation the operation belongs to.
	 * @param {Object} callbacks - Narration callbacks.
	 * @param {Function} onComplete - Called when all nodes have been processed.
	 */
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

	/**
	 * Formats an error encountered while resolving a narration turn.
	 *
	 * @param {Object} narration - Narration turn associated with the error.
	 * @param {Error|*} error - Error that occurred.
	 * @returns {string} Displayable error message.
	 */
	function _formatTurnError(narration, error) {
		return `⚠ COULD NOT RENDER [${narration.action ?? "?"} / ${narration.instigator ?? "?"}]: ${error?.message ?? String(error)}`;
	}

	/**
	 * Resolves and plays one narration turn, then advances to the next turn.
	 *
	 * The turn is evaluated only when execution reaches it so input values bound by earlier nodes are available. Turns with no executable
	 * nodes are skipped. Resolution errors are displayed and then treated as a completed turn.
	 *
	 * @param {Array<Object>} narrations - Complete narration sequence.
	 * @param {number} turnIndex - Index of the turn to execute.
	 * @param {number} generation - Session generation the operation belongs to.
	 * @param {Object} callbacks - Narration callbacks.
	 */
	function _playTurn(narrations, turnIndex, generation, callbacks) {
		if (generation !== _generation)
			return;

		if (turnIndex >= narrations.length) {
			_session.active = false;
			_session.phase = null;
			callbacks.onFinished();
			return;
		}

		const narration = narrations[turnIndex];
		let nodes;

		try {
			// This is deliberately evaluated here, rather than when play() starts. Any values bound by earlier input nodes are therefore visible to this turn.
			nodes = Interpreter.getNodes(narration, "automatic", _session.boundValues);
		} catch (error) {
			console.error("Failed to resolve narration turn:", error);
			const text = _formatTurnError(narration, error);
			callbacks.onSpeaking(text);

			_startWait(ERROR_DISPLAY_SECONDS, generation, () => {}, () => {
				callbacks.onTurnComplete(turnIndex);
				_startWait(INTER_TURN_GAP_SECONDS, generation, () => {}, () => _playTurn(narrations, turnIndex + 1, generation, callbacks));
			});

			return;
		}

		if (nodes.length === 0) {
			// No executable narration in this turn: skip it completely.
			// Do not notify the GUI and do not apply the normal inter-turn gap.
			_playTurn(narrations, turnIndex + 1, generation, callbacks);
			return;
		}

		_playNodes(narration, nodes, 0, generation, callbacks, () => {
			if (generation !== _generation)
				return;

			callbacks.onTurnComplete(turnIndex);
			_startWait(INTER_TURN_GAP_SECONDS, generation, () => {}, () => _playTurn(narrations, turnIndex + 1, generation, callbacks));
		});
	}

	/**
	 * Starts a countdown used for narration pauses and input timeouts.
	 *
	 * The countdown reports its remaining time through onTick and calls onDone when it reaches zero.
	 *
	 * @param {number} duration - Countdown duration in seconds.
	 * @param {number} generation - Session generation the wait belongs to.
	 * @param {Function} onTick - Called with remaining seconds.
	 * @param {Function} onDone - Called when the countdown finishes.
	 */
	function _startWait(duration, generation, onTick, onDone) {
		_session.phase = "waiting";
		_session.wait = { remainingMs: Math.max(0, duration * 1000), generation, onTick, onDone, stepStartedAt: Date.now() };
		onTick(_session.wait.remainingMs / 1000);
		_scheduleWaitStep();
	}

	/**
	 * Advances the current wait and schedules its next update.
	 *
	 * Waits are processed in short steps rather than with one long timeout so pause/resume can preserve the remaining duration and onTick
	 * can report countdown progress.
	 */
	function _scheduleWaitStep() {
		if (!_session.wait || _session.wait.generation !== _generation || _session.paused) {
			return;
		}

		const stepMs = Math.min(100, _session.wait.remainingMs);
		_session.wait.stepStartedAt = Date.now();

		_session.pendingTimer = setTimeout(() => {
				_session.pendingTimer = null;

				if (!_session.wait || _session.wait.generation !== _generation) {
					return;
				}

				_session.wait.remainingMs = Math.max(0, _session.wait.remainingMs - (Date.now() - _session.wait.stepStartedAt));

				if (_session.wait.remainingMs <= 0) {
					const onDone = _session.wait.onDone;
					_session.wait.onTick(0);
					_session.phase = null;
					_session.wait = null;
					onDone();
					return;
				}

				_session.wait.onTick(_session.wait.remainingMs / 1000);
				_scheduleWaitStep();
			},
			stepMs
		);
	}


	/**
	 * Abandons the current narration session and stops any playback or pending wait.
	 *
	 * Increments the generation and speech token so callbacks belonging to the abandoned session are ignored. Standalone announcements are
	 * unaffected.
	 */
	function _reset() {
		_generation++;
		_speechToken++;

		if (_session.pendingTimer !== null) {
			clearTimeout(_session.pendingTimer);
		}

		if (_session.activeAudio) {
			_session.activeAudio.stop();
		}

		_resetSession();
	}


	/* =========================
	   Public functions
	   ========================= */

	/**
	 * Returns whether at least one narration playback backend is available.
	 *
	 * @returns {boolean} True when either speech synthesis or recorded clip playback is available.
	 */
	function isSupported() {
		return Synthesis.isSupported() || ClipPlayback.isAvailable();
	}

	/**
	 * Returns whether a narration session is currently active.
	 *
	 * @returns {boolean} True while narration is playing or paused.
	 */
	function isActive() {
		return _session.active;
	}

	/**
	 * Returns whether the current narration session is paused.
	 *
	 * @returns {boolean} True when an active session is paused.
	 */
	function isPaused() {
		return _session.paused;
	}

	/**
	 * Preloads the available narration backends.
	 *
	 * Speech synthesis is preloaded immediately. Recorded narration is preloaded asynchronously; failure is logged and does not prevent
	 * synthesis fallback.
	 */
	function preload() {
		Synthesis.preload();

		ClipPlayback.preload().catch(error => {
			console.warn("Narration: clip preload failed; recorded narration will fall back to synthesis:", error);
		});
	}

	/**
	 * Pauses the current narration session.
	 *
	 * A paused wait preserves its remaining duration. Active speech is stopped and will be restarted from the beginning of the current
	 * logical speech unit when resume() is called.
	 *
	 * Has no effect when narration is inactive or already paused.
	 */
	function pause() {
		if (!_session.active || _session.paused)
			return;

		_session.paused = true;

		if (_session.phase === "waiting" && _session.wait) {
			if (_session.pendingTimer !== null) {
				clearTimeout(_session.pendingTimer);
				_session.pendingTimer = null;
			}

			_session.wait.remainingMs = Math.max(0, _session.wait.remainingMs - (Date.now() - _session.wait.stepStartedAt));

			return;
		}

		if (_session.phase === "speaking") {
			// Invalidate completion from the audio operation we are about to abandon.
			_speechToken++;

			if (_session.activeAudio) {
				_session.activeAudio.stop();
				_session.activeAudio = null;
			}
		}
	}

	/**
	 * Resumes a paused narration session.
	 *
	 * A paused wait continues with its remaining duration. Paused speech is started again from the beginning of the current logical speech
	 * unit.
	 *
	 * Has no effect when narration is inactive or not paused.
	 */
	function resume() {
		if (!_session.active || !_session.paused)
			return;

		_session.paused = false;

		if (_session.phase === "waiting") {
			_scheduleWaitStep();
			return;
		}

		if (_session.phase === "speaking" && _session.currentSpeech) {
			const speech = _session.currentSpeech;

			_speak(
				speech.text,
				speech.source,
				speech.generation,
				speech.onDone
			);
		}
	}

	/**
	 * Starts playback of a precompiled narration sequence from the first turn.
	 *
	 * NarrationData is treated as read-only; temporary node arrays are created while each turn executes so input continuations can be
	 * inserted without modifying the original data.
	 *
	 * A narration request is rejected when no playback backend is available, the supplied sequence is empty or invalid, or a standalone
	 * announcement is currently playing.
	 *
	 * @param {Array<Object>} narrations - Precompiled NarrationData turns to execute.
	 * @param {Object} [callbacks={}] - Optional playback callbacks.
	 * @param {Function} [callbacks.onSpeaking] - Called with the text currently being spoken or displayed.
	 * @param {Function} [callbacks.onPause] - Called with remaining seconds during an explicit narration pause.
	 * @param {Function} [callbacks.onTurnComplete] - Called with the completed turn index.
	 * @param {Function} [callbacks.onFinished] - Called when the entire sequence has finished.
	 * @param {Function} [callbacks.onInputStart] - Called with the input field and available options when an input node begins.
	 * @param {Function} [callbacks.onInputCountdown] - Called with remaining seconds while an input is waiting for a selection.
	 * @param {Function} [callbacks.onInputResolved] - Called with the input field and resolved value.
	 * @returns {boolean} True when narration was started, otherwise false.
	 */
	function play(narrations, callbacks = {}) {
		if (!isSupported()) {
			console.warn("No narration playback backend is available.");
			return false;
		}

		if (_isAnnouncementBusy()) {
			console.warn("Narration.play: an announcement is playing, ignoring the request.");
			return false;
		}

		_reset();

		if (!Array.isArray(narrations) || narrations.length === 0) {
			return false;
		}

		_session.active = true;
		const mergedCallbacks = { ..._NOOP_CALLBACKS, ...callbacks };
		_playTurn(narrations, 0, _generation, mergedCallbacks);

		return true;
	}

	/**
	 * Stops the current narration session and resets its state.
	 *
	 * Any active speech, recorded clip playback, pending wait, and input selection handler belonging to the session are abandoned.
	 */
	function stop() {
		_reset();
	}

	/**
	 * Supplies a value to the input node currently awaiting a selection.
	 *
	 * Values that do not match one of the active input node's options are ignored. Has no effect when no input is currently waiting.
	 *
	 * @param {*} value - Selected input value.
	 */
	function selectInput(value) {
		if (_session.pendingInputSelect)
			_session.pendingInputSelect(value);
	}

	/**
	 * Plays a standalone localized announcement outside the narration session.
	 *
	 * The announcement uses a recorded clip when one is available and otherwise falls back to speech synthesis. Announcements never play
	 * concurrently with narration or another announcement; conflicting requests are ignored.
	 *
	 * @param {string} key - Localization key for the announcement text.
	 */
	function playAnnouncement(key) {
		if (!key) return;

		if (_session.active || _isAnnouncementBusy()) {
			console.warn("playAnnouncement: narration or another announcement is playing, dropping:", key);
			return;
		}

		const text = Localization.localize(key);

		if (!text) {
			console.warn("playAnnouncement: unknown localization key:", key);
			return;
		}

		const token = ++_announcement.token;
		_announcement.busyUntil = Date.now() + ANNOUNCEMENT_MAX_SECONDS * 1000;

		const done = () => {
			if (token === _announcement.token)
				_announcement.busyUntil = 0;
		};

		const clip = ClipPlayback.resolveAnnouncement(key);

		if (clip) {
			ClipPlayback.play(clip, done, () => {
				Synthesis.speak(text, { onDone: done });
			});
		} else {
			Synthesis.speak(text, { onDone: done });
		}
	}


	return {
		isSupported,
		isActive,
		isPaused,
		preload,
		play,
		pause,
		resume,
		stop,
		selectInput,
		playAnnouncement,
	};

})();