/*
 * Narration state, turn/input sequencing, and speech playback - the module the GUI drives to run a game
 * script, and the sole caller of both Synthesis and ClipPlayback (formerly split out as a separate
 * NarrationAudio module; folded back in here since there was little left in that module beyond forwarding -
 * see the "Speech dispatch" section below for what remains of it).
 *
 * Consumes NarrationData produced by Interpreter.compileTurn()/compileAll().
 *
 * This module is deliberately unaware of how narration is structured beyond the small set of node types it
 * needs to execute. It asks Interpreter to evaluate the current turn only when that turn is reached, using the
 * values accumulated from earlier inputs. It is equally unaware of *how* a sentence ends up as sound: the
 * "Speech dispatch" section is the one place that decides clips vs. synthesis and normalizes both into the
 * same play/pause/resume handle shape; everything above that section - turn sequencing, input handling,
 * pause/resume, GUI callbacks - only ever touches that handle, never Synthesis or ClipPlayback directly. That
 * split is what a synthesis or clip backend swap (see synthesis.js's own header) doesn't have to touch: as
 * long as the replacement exposes the same speak()/isSupported() (Synthesis) or resolve()/playSequence()/
 * isAvailable() (ClipPlayback/Clips) shape, nothing below this file's own dispatch section changes.
 *
 * The Interpreter is also responsible for the final language rendering. For content nodes it returns both the
 * localized text and the structural source information that produced it; both are handed to the dispatch
 * section, which is solely responsible for deciding whether that source resolves to pre-recorded clips or
 * falls back to synthesis, and for actually producing the sound either way.
 */

const Narration = (() => {

	/* =========================
	   Data
	   ========================= */

	// Silent gap after a turn completes, before the next turn starts.
	const INTER_TURN_GAP_SECONDS = 2;

	// Default gap between adjacent spoken sentences when no explicit pause/input already separates them.
	const SENTENCE_GAP_SECONDS = 0.75;

	// Longest an announcement can hold the announcement guard below, in case its backend never reports completion.
	const ANNOUNCEMENT_MAX_SECONDS = 20;

	/*
	 * Lifetime invalidation counters - NOT part of _session below, and not touched by _resetSession(). Both
	 * only ever count up, for as long as the page lives, across every session: a callback captures the current
	 * value when it's issued, and is only honored if that value still matches when it fires. Resetting either
	 * one back to an initial value on session reset (the way every _session field is) would defeat that -  a
	 * stale callback captured before the very first session (generation/token 0) would then match a fresh reset
	 * session that also reads 0, and get honored when it shouldn't be. So these persist across _reset() and are
	 * only ever incremented, never reassigned to a fixed "initial" value.
	 */
	let _generation = 0;  // bumped whenever a session starts or stops
	let _speechToken = 0; // bumped whenever the current speech operation is abandoned/replaced

	/*
	 * Current session state - where play() is right now. Every field is meaningless once _reset() runs; see
	 * _resetSession() under Initialization for where it's set back to exactly this shape at the end of every
	 * session (and the moment just before a new one starts, from play()).
	 */
	let _session = {
		active: false,
		paused: false,
		/*
		 * Current execution phase:
		 *   null      - idle
		 *   waiting   - wait owns the current countdown
		 *   speaking  - activeAudio owns playback, whichever backend the dispatch section chose for it
		 */
		phase: null,
		// State for the current wait. remainingMs is maintained explicitly so pause()/resume() can suspend and continue from the same point rather than restarting the whole wait.
		wait: null,
		// The logical sentence currently being spoken. Retained while paused so resume() can replay it.
		currentSpeech: null,
		// Current speech-dispatch playback handle for whatever's currently speaking, recording or synthesis alike - Narration itself never needs to know which.
		activeAudio: null,
		// Timer currently handling a pause/input countdown.
		pendingTimer: null,
		// Values bound by resolved input nodes. They belong to the current play() session rather than an individual turn.
		boundValues: {},
		// Callback installed while an input is waiting. selectInput() calls this without needing to know which narration node is currently active.
		pendingInputSelect: null,
	};

	/*
	 * Guard state for the announcement currently playing, if any - see playAnnouncement() and play(). Deliberately
	 * not part of _session and never reset: announcements are independent of a narration session. While an
	 * announcement is playing, a new announcement or a new narration start is ignored instead of playing over it.
	 *
	 * busyUntil is a timestamp rather than a plain flag so that a backend which never reports completion can only
	 * hold the guard for ANNOUNCEMENT_MAX_SECONDS rather than forever. token only ever counts up, like the
	 * counters above, so that a late completion from an older announcement can't release a newer one.
	 */
	let _announcement = {
		busyUntil: 0,
		token: 0,
	};

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
		_resetSession();
	}

	// Resets _session back to its start-of-module shape (see Data above) - the one place that reset shape is
	// defined, used both by _init() (module load) and _reset() (end of every session).
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

	/* =========================
	   Speech dispatch

	   The one section of this module that knows Synthesis and ClipPlayback exist. Backend selection for one
	   call to _dispatchSpeak(), in order:
	     - no atlas at all for the current language (ClipPlayback.isAvailable() false) - synthesize, no
	       per-call warning. This is an expected state (e.g. no recordings exist yet for a given language),
	       not a bug, so it isn't reported as one.
	     - ClipPlayback.resolve() finds no full recorded coverage for `source` (no structural match at all, or
	       a resolved clip list naming a clip actually missing from the atlas - ClipPlayback.resolve() itself
	       logs which) - synthesize the whole thing instead.
	     - full coverage - play the complete sequence as one committed unit: either the whole thing is heard as
	       recordings, or (only on a genuine runtime failure once playback is already underway - a clip that
	       was resolved and confirmed present, but then failed to actually load/decode/play) the whole thing is
	       synthesized instead. Never a mix of the two within one call.

	   _dispatchSpeak() itself has no notion of sessions, turns, or announcements - see _speak() below for how
	   its result gets used.
	   ========================= */

	/*
	 * Speaks one already-rendered narration unit, choosing between pre-recorded clips and browser speech synthesis.
	 * Returns a handle valid for the lifetime of this one call, forwarding to whichever backend is currently live,
	 * including across the clip-to-synthesis fallback mid-sequence - a caller never needs to know which backend is live.
	 */
	function _dispatchSpeak(text, source, onDone) {
		if (!ClipPlayback.isAvailable()) {
			return Synthesis.speak(text, { onDone });
		}

		const names = ClipPlayback.resolve(source);

		if (!names) {
			return Synthesis.speak(text, { onDone });
		}

		let current = { pause() {}, resume() {}, stop() {} };

		const handle = {
			pause()  { current.pause(); },
			resume() { current.resume(); },
			stop()   { current.stop(); },
		};

		current = ClipPlayback.playSequence(names, {
			onDone,
			onError: name => {
				console.warn("Narration: clip playback failed at runtime, falling back to speech synthesis:", name);
				current = Synthesis.speak(text, { onDone });
			}
		});

		return handle;
	}

	/*
	 * Speaks `text` (with structural `source`, if any - see _dispatchSpeak() above) as one logical narration
	 * unit, tracking the resulting handle in _session.activeAudio for pause()/resume() and discarding it once done.
	 * Generation is checked here, once, before handing control back to the caller's onDone - _dispatchSpeak()
	 * itself has no notion of sessions or generations, so this is the one place that boundary is enforced.
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

	// Whether an announcement is currently playing - see _announcement in Data for why this is time-bounded.
	function _isAnnouncementBusy() {
		return Date.now() < _announcement.busyUntil;
	}

	/*
	 * Plays one localized sentence returned by Interpreter.renderContent().
	 *
	 * The text is what the GUI displays and what synthesis would speak, if used. The source is what
	 * _dispatchSpeak matches against recordings before deciding whether synthesis is needed at all.
	 */
	function _playRenderedSentence(rendered, generation, onDone) {
		if (!rendered?.text) {
			_session.phase = "speaking";
			onDone();
			return;
		}

		_speak(rendered.text, rendered.source, generation, onDone);
	}

	/*
	 * Renders one content node and plays its sentences in order.
	 *
	 * Sentence splitting is performed by Interpreter, not by Narration. Narration therefore never needs to know
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
			_speak(text, null, generation, onDone);
			
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
	 * _session.pendingInputSelect is installed before rendering (not after), so a selection arriving while the input is
	 * still being rendered is never lost. If rendering itself throws, playback isn't left stuck: the node's own
	 * defaultValue is used immediately, exactly as if the countdown had expired unanswered.
	 *
	 * On resolution, the input node is spliced out of `nodes` and replaced in place by its continuation, then
	 * _playNodes resumes at the same nodeIndex - so a continuation that itself contains another input runs through
	 * this exact same path, with no special-casing for nesting.
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

			/*
			 * Replace the input node with its continuation and resume at the same index.
			 * This gives nested inputs exactly the same execution path as the outer input.
			 */
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
			_session.active = false;
			_session.phase = null;
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
			nodes = Interpreter.getNodes(narration, "automatic", _session.boundValues);
		} catch (error) {
			console.error("Failed to resolve narration turn:", error);
			const text = _formatTurnError(narration, error);
			callbacks.onSpeaking(text);

			_speak(text, null, generation, () => {
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
		_session.phase = "waiting";
		_session.wait = { remainingMs: Math.max(0, duration * 1000), generation, onPause, onDone, stepStartedAt: Date.now() };
		onPause(_session.wait.remainingMs / 1000 );
		_scheduleWaitStep();
	}

	/*
	 * Advances the current wait by one step (at most 100ms), then reschedules itself until _session.wait.remainingMs
	 * reaches zero or the wait is abandoned (a new generation, or _session.wait itself replaced/cleared).
	 *
	 * Stepped rather than a single setTimeout for the full duration so pause() can suspend with sub-100ms
	 * accuracy at any point, and so onPause can report a live countdown rather than only firing once at the end.
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

				_session.wait.remainingMs = Math.max(0, _session.wait.remainingMs - stepMs);

				if (_session.wait.remainingMs <= 0) {
					const onDone = _session.wait.onDone;
					_session.wait.onPause(0);
					_session.phase = null;
					_session.wait = null;
					onDone();
					return;
				}

				_session.wait.onPause(_session.wait.remainingMs / 1000);
				_scheduleWaitStep();
			},
			stepMs
		);
	}


	/*
	 * Clears all narration-session state and stops anything it owns (a pending wait timer, an in-progress clip,
	 * or speech synthesis) so a new play() starts from a clean slate. Announcement playback is untouched - see
	 * playAnnouncement - since announcements are independent of a narration session.
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

	function isSupported() {
		return Synthesis.isSupported() || ClipPlayback.isAvailable();
	}

	function isActive() {
		return _session.active;
	}

	function isPaused() {
		return _session.paused;
	}

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

	/*
	 * Plays precompiled NarrationData from the beginning.
	 *
	 * NarrationData is not modified by Narration. Temporary node arrays are created from each turn when that turn
	 * is reached, allowing input continuations to be inserted without mutating the GUI's canonical narration data.
	 *
	 * If an announcement is currently playing, the request is ignored - narration is neither started over it nor
	 * is it cut off - and nothing changes, so the caller can simply try again. Returns whether narration started.
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

	function stop() {
		_reset();
	}

	function selectInput(value) {
		if (_session.pendingInputSelect)
			_session.pendingInputSelect(value);
	}

	/*
	 * Plays a standalone announcement (e.g. the game timer's "X seconds left" / "time's up") - a short clip
	 * outside of any narration session, with no play/pause/stop of its own since it's always brief: one clip,
	 * or one synthesized utterance, covering the whole thing - never split or reported back to the GUI.
	 *
	 * The key is a plain localization key that can be resolved to a localized string via Localization.localize(),
	 * the key is passed directly to ClipPlayback to be resolved, while the localized string can be passed for
	 * synthesis as a fallback if a clip does not exist.
	 *
	 * Never plays over narration or another announcement, and never cuts either off: if a narration session is
	 * active (including while paused), or another announcement is still playing, the request is dropped.
	 * play() applies the same rule in the other direction, so the two are never audible at once.
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
		play,
		pause,
		resume,
		stop,
		selectInput,
		playAnnouncement,
	};

})();