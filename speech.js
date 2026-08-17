/*
 * Speech playback.
 *
 * Plays a game's raw turns (as produced by Rules, before localization) as spoken narration, reporting progress via callbacks. Each turn is resolved
 * into a sequence just before it plays - never ahead of time - via Interpreter.resolveTurn(turn, { mode: "automatic", ... }), so a value an
 * earlier turn's input just bound (see _boundValues) is already visible to every turn resolved after it.
 *
 * This module is the only place aware of which speech engine is actually talking, and the only place aware of how an "input" segment's wait differs
 * from an ordinary "pause" (fixed duration regardless of input, see _playInput) - callers only ever deal in "play these turns" / "pause" /
 * "resume" / "stop" / "select this input value", plus the progress callbacks below. The engine boundary exists so the underlying engine
 * (currently the browser's Web Speech API) can be swapped later without touching anything outside this file - voice availability for some
 * languages (e.g. Swedish) is inconsistent across browsers, and that's expected to be the reason this gets revisited.
 */

const Speech = (() => {

	/* =========================
	   Data
	   ========================= */

	/*
	 * Silent gap inserted after each turn completes, before the next turn's first segment starts. Implemented via _startWait like an ordinary pause
	 * segment (so pause()/resume() handle it for free), but with a no-op onPause callback - the GUI's onPause is never invoked for it, so it
	 * never renders as a countdown. Intentionally not exposed as a "pause" segment type or a config option; it's playback pacing, not narration
	 * content.
	 */
	const INTER_TURN_GAP_SECONDS = 3;

	/*
	 * Bumped on every play()/stop(). Callbacks scheduled by a previous session (a pending setTimeout, a stray utterance.onend) capture the
	 * generation they belong to and check it before doing anything, so a session that's already been stopped can't resume itself just because
	 * one of its async callbacks was still in flight.
	 */
	let _generation = 0;
	let _active = false;
	let _paused = false;
	let _pendingTimer = null;
	
	/*
	 * What's currently in flight, so pause()/resume() know what to actually do: "speaking" defers to the engine's own pause/resume, "waiting" is
	 * handled entirely by this module (see _wait below). null means idle - nothing playing, so pause()/resume() have nothing to act on.
	 */
	let _phase = null;
	
	/*
	 * Snapshot of an in-progress pause segment's countdown, kept only while _phase === "waiting". Its remainingMs is exactly what lets pause()
	 * suspend the countdown and resume() pick it back up from the same point, rather than restarting or losing track of elapsed time.
	 */
	let _wait = null;

	/*
	 * Values bound by resolved input nodes, threaded forward into every subsequent turn's resolution - see Interpreter's boundValues merge.
	 * Fresh per play(), not per turn.
	 */
	let _boundValues = {};

	/*
	 * Set only while an input node's wait is running; lets selectInput() reach the active input instance without the module tracking "which
	 * node" itself. Calling it only ever records a value - the wait still runs its full course regardless of whether or when this is called, so
	 * there's no race between a late selection and the timeout.
	 */
	let _pendingInputSelect = null;

	// Callers don't have to supply all progress callbacks - anything they omit falls back to these no-ops.
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
	   Private functions
	   ========================= */

	// Shared by stop() and the start of play() - invalidates whatever session was previously running and clears any of its pending state.
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

		window.speechSynthesis?.cancel();
	}

	/*
	 * Resolves rawTurns[turnIndex] only now - not in play(), and not ahead of time for any other turn - so its data bag can see every _boundValues
	 * entry written by every earlier turn's input, including ones that just resolved a moment ago.
	 *
	 *   rawTurns      - the full raw turn array for this session (e.g. Rules.buildPrompt(...).turns); only ever indexed into, never mutated.
	 *   turnIndex     - the turn to resolve and play now. Recurses onto turnIndex + 1 once this turn's sequence and its inter-turn gap complete.
	 *   generation    - the session generation captured at play() time; re-checked against the live _generation before proceeding, so a
	 *                   stopped session's in-flight continuation becomes a no-op.
	 *   renderOptions - passed straight through to Interpreter.resolveTurn() (mode/verbosity); not interpreted here.
	 *   callbacks     - the full, already-defaulted callback set for this session (see play()).
	 *
	 * No return value - once turnIndex runs past the end of rawTurns, callbacks.onFinished() is invoked instead; all other progress is
	 * reported to callbacks as playback proceeds.
	 */
	function _playTurn(rawTurns, turnIndex, generation, renderOptions, callbacks) {
		if (generation !== _generation) return;

		if (turnIndex >= rawTurns.length) {
			_active = false;
			_phase = null;
			callbacks.onFinished();
			return;
		}

		const { action, instigator, sequence, error } =
			Interpreter.resolveTurn(rawTurns[turnIndex], { ...renderOptions, boundValues: _boundValues });

		if (error)
			console.error(`Narration: failed to render turn (action=${action}, instigator=${instigator}):`, error);

		_playSegments(sequence, 0, generation, callbacks, () => {
			callbacks.onTurnComplete(turnIndex);
			_startWait(INTER_TURN_GAP_SECONDS, generation, () => {}, () =>
				_playTurn(rawTurns, turnIndex + 1, generation, renderOptions, callbacks));
		});
	}

	/*
	 * Walks one turn's (mutable) sequence array from segIndex onward. onSequenceComplete fires once, when the array runs out - same role
	 * onTurnComplete played before, just decoupled from "turn" now that a sequence can grow mid-walk via input resolution.
	 *
	 *   sequence           - the current turn's segment array; may grow in place (see _playInput's splice) as input nodes resolve.
	 *   segIndex           - the segment to play now.
	 *   generation         - session generation guard, as in _playTurn.
	 *   callbacks          - the full, already-defaulted callback set for this session.
	 *   onSequenceComplete - zero-argument function invoked once segIndex reaches the end of sequence.
	 */
	function _playSegments(sequence, segIndex, generation, callbacks, onSequenceComplete) {
		if (generation !== _generation) return;

		if (segIndex >= sequence.length) {
			onSequenceComplete();
			return;
		}

		const segment = sequence[segIndex];
		const advance = () => _playSegments(sequence, segIndex + 1, generation, callbacks, onSequenceComplete);

		if (segment.type === "text") {
			_phase = "speaking";
			callbacks.onSpeaking(segment.value);
			_speakText(segment.value, generation, advance);
		} else if (segment.type === "pause") {
			_startWait(segment.duration, generation, callbacks.onPause, advance);
		} else if (segment.type === "input") {
			_playInput(sequence, segIndex, segment, generation, callbacks, onSequenceComplete);
		} else {
			/* 
			 * Unknown segment types are skipped to degrade gracefully and logged rather than become fatal. Any future segment type implemented
			 * must also be added here to handle it correctly.
			 */
			console.warn("_playSegments: Unknown segment type '" + segment.type + "'");
			advance();
		}
	}

	/*
	 * Runs an input node's full, fixed-length wait - identical in shape whether or not anyone presses anything - then resolves to whichever
	 * value won, records it, and splices the resulting continuation in place of the input node itself before resuming the walk at the same index.
	 * Splicing (rather than recursing into the continuation separately) means a continuation that itself contains another input is handled by
	 * this exact same code path with no extra cases.
	 *
	 *   sequence           - as in _playSegments; mutated in place once the input resolves (see above).
	 *   segIndex           - the position of this input node within sequence, and where its continuation is spliced in.
	 *   node               - the input segment itself: { type: "input", field, timeoutSeconds, defaultValue, options, branches | deferred }.
	 *   generation         - session generation guard, as in _playTurn.
	 *   callbacks          - the full, already-defaulted callback set for this session.
	 *   onSequenceComplete - forwarded unchanged to the _playSegments call that resumes the walk after splicing.
	 */
	function _playInput(sequence, segIndex, node, generation, callbacks, onSequenceComplete) {
		let selected = null;

		_pendingInputSelect = (value) => {
			if (node.options.some(o => o.value === value)) selected = value;
		};

		callbacks.onInputStart(node.field, node.options);

		_startWait(node.timeoutSeconds, generation, callbacks.onInputCountdown, () => {
			_pendingInputSelect = null;
			const value = selected ?? node.defaultValue;
			_boundValues[node.field] = value;
			callbacks.onInputResolved(node.field, value);

			const continuation = node.branches
				? node.branches[value]
				: Interpreter.resolveDeferredInput(node.deferred, value);

			sequence.splice(segIndex, 1, ...continuation);
			_playSegments(sequence, segIndex, generation, callbacks, onSequenceComplete);
		});
	}

	/*
	 * Starts a pause segment's countdown. Broken into short steps (sub-second range, rather than one setTimeout for the whole duration) specifically so
	 * pause() has something short enough to interrupt: at any step boundary, _wait.remainingMs is always accurate and the countdown can be suspended
	 * and resumed from exactly that point.
	 *
	 *   duration   - the full wait length in seconds before onDone fires.
	 *   generation - session generation guard, as in _playTurn.
	 *   onPause    - invoked with the seconds remaining (a float), once immediately and then roughly every step until it reaches 0.
	 *   onDone     - invoked with no arguments once the wait fully elapses.
	 */
	function _startWait(duration, generation, onPause, onDone) {
		_phase = "waiting";
		_wait = { remainingMs: Math.max(0, duration * 1000), generation, onPause, onDone };

		onPause(_wait.remainingMs / 1000);
		_scheduleWaitStep();
	}
	
	/*
	 * Schedules the next countdown step, unless paused - in which case resume() is what calls this again to pick the countdown back up. Operates entirely
	 * on the shared _wait/_pendingTimer state.
	 */
	function _scheduleWaitStep() {
		if (!_wait || _wait.generation !== _generation || _paused) return;

		const stepMs = Math.min(100, _wait.remainingMs);
		_wait.stepStartedAt = Date.now();

		_pendingTimer = setTimeout(() => {
			_pendingTimer = null;
			if (!_wait || _wait.generation !== _generation) return;

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
		}, stepMs);
	}
	
	/*
	 * Speaks a single text segment, calling onDone once speech actually finishes (or errors out). Always asynchronous, so the sequence walk
	 * above stays a plain chain of callbacks regardless of segment type.
	 *
	 *   value      - the text to speak.
	 *   generation - session generation guard, as in _playTurn.
	 *   onDone     - invoked with no arguments once speech ends, successfully or via error.
	 */
	function _speakText(value, generation, onDone) {
		const utterance = new SpeechSynthesisUtterance(value);
		utterance.lang = _langTag();

		const voice = _pickVoice(utterance.lang);
		if (voice) utterance.voice = voice;

		utterance.onend = () => {
			if (generation === _generation) onDone();
		};
		utterance.onerror = (event) => {
			console.warn("Speech synthesis error:", event.error);
			if (generation === _generation) onDone();
		};

		window.speechSynthesis.speak(utterance);
	}

	/*
	 * Picks a voice for the given speech-language tag. Currently a crude name-based lookup with a silent fallback to the engine default when no
	 * exact match is installed - a known limitation (Chrome commonly has no Swedish voice at all) that this function is the single place to
	 * improve later without touching any of the playback logic above.
	 *
	 * langTag - a BCP-47 speech-language tag as produced by _langTag() (e.g. "sv-SE", "en-US").
	 *
	 * Returns the matching SpeechSynthesisVoice, or null if none was found - null leaves utterance.voice unset, so the engine falls back to
	 * its own default voice for utterance.lang.
	 */
	function _pickVoice(langTag) {
		if (langTag !== "sv-SE") return null;

		const voices = window.speechSynthesis.getVoices();
		return voices.find(voice => voice.lang === "sv-SE" && voice.name.includes("Sofie")) ?? null;
	}

	// Returns the BCP-47 speech-language tag for the current UI language: "sv-SE" for Swedish, "en-US" otherwise.
	function _langTag() {
		return Localization.getLanguage() === "SWE" ? "sv-SE" : "en-US";
	}

	/* =========================
	   Public functions
	   ========================= */

	// Returns true if the browser's Web Speech API (speechSynthesis) is available at all; play() refuses to start when this is false.
	function isSupported() {
		return "speechSynthesis" in window;
	}

	// Returns true from play() until playback finishes on its own or stop() is called; stays true while merely paused (see isPaused()).
	function isActive() {
		return _active;
	}

	// Returns true if an active session is currently paused via pause(); always false when isActive() is false.
	function isPaused() {
		return _paused;
	}

	// Suspends playback in place - mid-speech or mid-wait - without losing position. No-op if not currently playing or already paused.
	function pause() {
		if (!_active || _paused) return;
		_paused = true;

		if (_phase === "waiting" && _wait) {
			if (_pendingTimer !== null) {
				clearTimeout(_pendingTimer);
				_pendingTimer = null;
			}
			//Account for whatever fraction of the current step had already elapsed, so the countdown doesn't lose (or gain) time across a pause - resume() sees an accurate remainingMs either way.
			_wait.remainingMs = Math.max(0, _wait.remainingMs - (Date.now() - _wait.stepStartedAt));
		} else if (_phase === "speaking") {
			window.speechSynthesis.pause();
		}
	}

	// Resumes playback exactly where pause() left it. No-op if not currently paused.
	function resume() {
		if (!_active || !_paused) return;
		_paused = false;

		if (_phase === "waiting") {
			_scheduleWaitStep();
		} else if (_phase === "speaking") {
			window.speechSynthesis.resume();
		}
	}

	/*
	 * Plays rawTurns (e.g. Rules.buildPrompt(...).turns) from the start. Each turn is resolved into a sequence just before it plays - see the module
	 * comment - so, options.verbosity aside, whatever a turn's template does with boundValues from an earlier turn is always current.
	 *
	 * Any playback already in progress is stopped first, and _boundValues is reset fresh for this session.
	 *
	 *   rawTurns                        - the raw turn array to play.
	 *   options.verbosity               - "verbose" (default) or "brief"; forwarded to Interpreter.resolveTurn() to pick which localization key variant narrates each turn.
	 *   callbacks (all optional):       - Callback table if functions to call when different events as document below triggers during the narration
	 *     onSpeaking(text)                - a text segment has started speaking.
	 *     onPause(secondsLeft)            - during an ordinary pause, roughly once a second, with the time remaining.
	 *     onInputStart(field,options)     - an input's wait has begun; options is [{value,label}, ...] to render as choices. See selectInput().
	 *     onInputCountdown(secondsLeft)   - same shape as onPause, fired for an input's wait instead - kept separate so a caller can show both a countdown and the option buttons at once.
	 *     onInputResolved(field,value)    - the input's wait has fully elapsed and value (selected or defaulted) is now bound; its continuation is about to play. Buttons can be cleared now.
	 *     onTurnComplete(index)           - rawTurns[index] has finished playing.
	 *     onFinished()                    - every turn finished playing on its own, start to end - not fired by stop(), since a caller that stops already knows to reset its own state.
	 *
	 * No return value - progress is reported entirely through callbacks.
	 */
	function play(rawTurns, options = {}, callbacks = {}) {
		if (!isSupported()) {
			console.warn("Speech synthesis is not supported by this browser.");
			return;
		}

		_reset();
		if (rawTurns.length === 0) return;

		_active = true;
		_boundValues = {};
		const renderOptions = { mode: "automatic", verbosity: options.verbosity ?? "verbose" };
		_playTurn(rawTurns, 0, _generation, renderOptions, { ..._NOOP_CALLBACKS, ...callbacks });
	}
	
	/*
	 * Stops any playback in progress and discards its position - the opposite of letting play() finish on its own. Does not invoke
	 * onFinished(); a caller that stops already knows to reset its own state. No parameters, no return value.
	 */
	function stop() {
		_reset();
	}

	/*
	 * Records value as the chosen option for whichever input node is currently awaiting a selection (see _pendingInputSelect and _playInput).
	 * A no-op if no input is currently active, or if value isn't among that input's own options. Does not affect timing - the input's wait
	 * still runs to completion regardless of whether or when this is called. No return value.
	 */
	function selectInput(value) {
		if (_pendingInputSelect)
			_pendingInputSelect(value);
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
	};

})();